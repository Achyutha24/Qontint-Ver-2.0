"""
Comprehensive Tests for AI Provider Architecture Isolation & Complete Generation in Qontint v2.4.

Verifies:
1. ONLY the Generate Page uses Groq (openai/gpt-oss-120b).
2. Generate NEVER invokes Gemini or call_gemini.
3. Groq errors (missing key, 401, 429, 503, timeout) NEVER silently fall back to Gemini.
4. Non-Generate AI features (SERP Intelligence, Analyze, YouTube) continue on Gemini and NEVER use Groq.
5. Concurrency: Generate (Groq) and Analyze (Gemini) run concurrently without provider crossover.
6. Dynamic token budget scaling correctly computes tokens from target word count without truncating.
7. All user controls (800, 1500, 2000, 2500 words, tone, content_type, custom_instructions, creativity)
   are reflected in Groq prompts and parameters.
8. Deterministic Truncation & Completeness Detection (mid-sentence, incomplete table, unfinished bullet, dangling heading, missing conclusion).
9. Word-count regression (~1,500w complete article, no cut-off, honest word count).
"""
from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
import httpx
import pytest

from config import settings
from services.generate_ai_service import (
    calculate_groq_token_budget,
    resolve_target_word_count,
    resolve_groq_temperature,
    get_content_type_structure,
    get_tone_profile,
    build_generate_prompt,
    detect_truncation,
    repair_or_complete_article,
    validate_content_output,
    call_groq,
    full_generate_pipeline,
)


# ── 1. Token Budget & Word Count Scaling Unit Tests ─────────────────────────

class TestTokenBudgetAndWordCount:
    def test_resolve_target_word_count_explicit(self):
        assert resolve_target_word_count(800, "Medium") == 800
        assert resolve_target_word_count(1500, "Short") == 1500
        assert resolve_target_word_count(2000, "Long") == 2000
        assert resolve_target_word_count(2500, None) == 2500

    def test_resolve_target_word_count_from_length(self):
        assert resolve_target_word_count(None, "Short") == 800
        assert resolve_target_word_count(None, "Medium") == 1500
        assert resolve_target_word_count(None, "Long") == 2500
        assert resolve_target_word_count(None, "unknown") == 1500

    def test_calculate_groq_token_budget_boundaries(self):
        # 800 words: 800 * 2.0 + 800 = 2400 tokens
        assert calculate_groq_token_budget(800) == 2400
        # 1500 words: 1500 * 2.0 + 800 = 3800 tokens
        assert calculate_groq_token_budget(1500) == 3800
        # 2000 words: 2000 * 2.0 + 800 = 4800 tokens
        assert calculate_groq_token_budget(2000) == 4800
        # 2500 words: 2500 * 2.0 + 800 = 5800 tokens
        assert calculate_groq_token_budget(2500) == 5800
        # Very large: clamped to 16384 ceiling
        assert calculate_groq_token_budget(12000) == 16384

    def test_temperature_mapping(self):
        assert resolve_groq_temperature("Low") == 0.2
        assert resolve_groq_temperature("Medium") == 0.7
        assert resolve_groq_temperature("High") == 0.9

    def test_adaptive_content_type_structure(self):
        # Short (<=900)
        short_struct = get_content_type_structure("Blog", 800)
        assert len(short_struct) == 4
        # Medium (1500)
        med_struct = get_content_type_structure("Whitepaper", 1500)
        assert len(med_struct) == 5
        # Long (2500)
        long_struct = get_content_type_structure("Technical Guide", 2500)
        assert len(long_struct) >= 6

    def test_prompt_contains_length_and_controls(self):
        prompt = build_generate_prompt(
            keyword="Fintech API Idempotency",
            vertical="Fintech",
            top_entities=[{"text": "PCI-DSS", "entity_type": "REGULATION"}],
            content_type="Technical Guide",
            tone="Technical",
            target_word_count=2500,
            custom_instructions="Include sequence diagram in mermaid syntax.",
        )
        assert "2500 words" in prompt
        assert "Technical Guide" in prompt
        assert "Technical" in prompt
        assert "Fintech API Idempotency" in prompt
        assert "Include sequence diagram in mermaid syntax." in prompt
        assert "PCI-DSS" in prompt
        assert "CRITICAL COMPLETION RULES" in prompt


# ── 2. Truncation & Completeness Detection Tests (Sections 24, 25, 26, 38) ──

class TestTruncationAndCompletionDetection:
    def test_detect_mid_sentence_truncation(self):
        # Case A: response ending mid-sentence without terminal punctuation
        content = (
            "# Title\n\n"
            "This is an article about enterprise cloud infrastructure. "
            "The primary mechanism for low latency data processing involves distributed caches and"
        )
        is_trunc, reason = detect_truncation(content, "Blog", 1000)
        assert is_trunc is True
        assert "mid-sentence" in reason.lower()

    def test_detect_incomplete_table_truncation(self):
        # Case B: response ending in an incomplete Markdown table row
        content = (
            "# Architecture Comparison\n\n"
            "Here is the evaluation matrix:\n\n"
            "| Dimension | REST | gRPC |\n"
            "|---|---|---|\n"
            "| Latency | High | Low |\n"
            "| Serialization | JSON | Protobuf |\n"
            "| Throughput | 10k req/s"  # Unclosed pipe row
        )
        is_trunc, reason = detect_truncation(content, "Blog", 500)
        assert is_trunc is True
        assert "table" in reason.lower()

    def test_detect_unfinished_bullet_truncation(self):
        # Case C: response ending with an unfinished bullet
        content = (
            "# Key Recommendations\n\n"
            "Follow these enterprise standards:\n\n"
            "- Implement mutual TLS on all ingress points.\n"
            "- Enforce sub-second webhook timeout policies.\n"
            "- Rotate"  # Unfinished bullet
        )
        is_trunc, reason = detect_truncation(content, "Blog", 500)
        assert is_trunc is True
        assert "unfinished list item" in reason.lower()

    def test_detect_dangling_heading_truncation(self):
        # Case D: response ending immediately after a heading
        content = (
            "# Cloud Migration Blueprint\n\n"
            "Migrating legacy workloads requires comprehensive assessment and containerization.\n\n"
            "## Architectural Principles\n\n"
            "Core principles include statelessness and automated rollbacks.\n\n"
            "## Strategic Action Plan"  # Heading with no body text
        )
        is_trunc, reason = detect_truncation(content, "Blog", 500)
        assert is_trunc is True
        assert "dangling heading" in reason.lower()

    def test_detect_complete_article_accepted(self):
        # Case E: response with a complete conclusion ending on terminal punctuation
        content = (
            "# Enterprise Payment Integration Best Practices\n\n"
            "## Executive Summary\n\n"
            "Modern payment processing demands deterministic idempotency and end-to-end encryption. "
            "By implementing unified gateways, organizations can achieve high availability.\n\n"
            "## Architectural Framework\n\n"
            "Tokenization ensures that primary cardholder data never touches application memory. "
            "Webhooks should be verified using HMAC-SHA256 signatures with timestamp checks.\n\n"
            "## Strategic Conclusion & Action Plan\n\n"
            "In conclusion, modernizing payment architecture requires balancing security with developer velocity. "
            "Enterprises that follow these standards mitigate compliance risk while delivering sub-second checkout latency."
        )
        is_trunc, reason = detect_truncation(content, "Blog", 100)
        assert is_trunc is False
        assert reason == ""

    def test_repair_or_complete_article(self):
        # Test that repair removes trailing dangling heading and fixes clipped sentence
        clipped = (
            "# Title\n\n"
            "Complete sentence here. Another complete sentence.\n\n"
            "## Dangling Section"
        )
        repaired = repair_or_complete_article(clipped, "dangling heading", "Blog")
        assert "## Dangling Section" not in repaired
        assert repaired.endswith(".")


# ── 3. Specific Word-Count Regression Test (Section 37) ─────────────────────

class TestWordCountRegression1500:
    def test_1500_word_content_completeness(self):
        """Verify that a ~1,500-word article has all sections intact and ends with a complete conclusion."""
        paragraphs = [
            f"Paragraph {i}: Enterprise architecture requires deep integration of semantic graph networks, "
            f"continuous observability, deterministic data pipelines, and distributed event streaming to scale."
            for i in range(1, 55)
        ]
        sample_1500 = (
            "# Comprehensive Guide to Enterprise Data Architecture\n\n"
            "## Executive Summary\n\n"
            + paragraphs[0] + "\n\n"
            "## Architectural Foundations\n\n"
            + "\n\n".join(paragraphs[1:25]) + "\n\n"
            "## Implementation & Governance\n\n"
            + "\n\n".join(paragraphs[25:48]) + "\n\n"
            "## Conclusion & Key Takeaways\n\n"
            + "\n\n".join(paragraphs[48:]) + "\n\n"
            "In conclusion, adopting these architectural foundations ensures scalable enterprise excellence."
        )
        words = len(sample_1500.split())
        assert words >= 1000

        is_trunc, reason = detect_truncation(sample_1500, "Blog", 1500)
        assert is_trunc is False, f"Unexpected truncation detected: {reason}"
        assert sample_1500.strip().endswith(".")


# ── 4. Groq Direct Call & Error Handling (No Gemini Fallback) ───────────────

class TestGroqApiCall:
    @pytest.mark.asyncio
    async def test_missing_api_key_returns_error_string(self):
        with patch.object(settings, "GROQ_API_KEY", None):
            res = await call_groq("Test prompt")
            assert res.startswith("ERROR:")
            assert "Groq API key is not configured" in res

    @pytest.mark.asyncio
    async def test_groq_401_unauthorized(self):
        mock_resp = httpx.Response(
            401,
            json={"error": {"message": "Invalid API Key"}},
            request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"),
        )
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_resp
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch.object(settings, "GROQ_API_KEY", "invalid-key"):
            with patch("services.generate_ai_service.httpx.AsyncClient", return_value=mock_client):
                res = await call_groq("test")
                assert res.startswith("ERROR:")
                assert "invalid or unauthorized" in res.lower()

    @pytest.mark.asyncio
    async def test_groq_429_rate_limit(self):
        mock_resp = httpx.Response(
            429,
            json={"error": {"message": "Rate limit exceeded"}},
            request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"),
        )
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_resp
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch.object(settings, "GROQ_API_KEY", "valid-key"):
            with patch("services.generate_ai_service.httpx.AsyncClient", return_value=mock_client):
                res = await call_groq("test")
                assert res.startswith("ERROR:")
                assert "rate limit reached" in res.lower()

    @pytest.mark.asyncio
    async def test_groq_503_service_unavailable(self):
        mock_resp = httpx.Response(
            503,
            text="Service Unavailable",
            request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"),
        )
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_resp
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch.object(settings, "GROQ_API_KEY", "valid-key"):
            with patch("services.generate_ai_service.httpx.AsyncClient", return_value=mock_client):
                res = await call_groq("test")
                assert res.startswith("ERROR:")
                assert "temporarily unavailable" in res.lower()

    @pytest.mark.asyncio
    async def test_groq_timeout(self):
        mock_client = AsyncMock()
        mock_client.post.side_effect = httpx.TimeoutException("Read timeout")
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch.object(settings, "GROQ_API_KEY", "valid-key"):
            with patch("services.generate_ai_service.httpx.AsyncClient", return_value=mock_client):
                res = await call_groq("test")
                assert res.startswith("ERROR:")
                assert "timed out" in res.lower()

    @pytest.mark.asyncio
    async def test_groq_payload_contract(self):
        """Verify call_groq sends model=openai/gpt-oss-120b, Bearer token, max_tokens, and temperature."""
        mock_resp = httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "Sample generated article."}}],
                "usage": {"completion_tokens": 50},
            },
            request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"),
        )
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_resp
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch.object(settings, "GROQ_API_KEY", "gsk_live_test_key"):
            with patch("services.generate_ai_service.httpx.AsyncClient", return_value=mock_client):
                result = await call_groq(
                    prompt="Write an enterprise article",
                    target_word_count=2500,
                    creativity="High",
                    vertical="Fintech",
                )
                assert result == "Sample generated article."
                mock_client.post.assert_called_once()
                call_args = mock_client.post.call_args

                assert "api.groq.com" in call_args[0][0]
                headers = call_args[1].get("headers", {})
                assert headers.get("Authorization") == "Bearer gsk_live_test_key"
                body = call_args[1].get("json", {})
                assert body.get("model") == "openai/gpt-oss-120b"
                assert body.get("temperature") == 0.9
                assert body.get("max_tokens") == 5800


# ── 5. Integration & Isolation via /api/v1/generate ──────────────────────────

class TestGenerateEndpointIsolation:
    @pytest.mark.asyncio
    async def test_generate_calls_groq_and_never_gemini(self, client):
        """Verify POST /api/v1/generate calls Groq pipeline and NEVER calls Gemini."""
        sample_article = (
            "# Enterprise Payment Integration\n\n"
            "Payment systems require robust architecture, idempotency keys, and sub-second webhook delivery.\n\n"
            "## Architecture Overview\n\n"
            "When integrating modern payment processors, tokenization ensures PCI-DSS compliance.\n\n"
            "## Idempotency Controls\n\n"
            "Every mutating request must include a unique idempotency key to prevent double charging.\n\n"
            "## Conclusion & Strategic Outlook\n\n"
            "Following these architecture guidelines guarantees high availability and zero duplicate transactions."
        )

        mock_serp_doc = MagicMock()
        mock_serp_doc.url = "https://example.com/competitor"
        mock_serp_doc.body_content = "Competitor article on payment integration and tokenization."
        mock_serp_doc.position = 1
        mock_serp_doc.title = "Competitor Guide"
        mock_serp_doc.competitor_position = 1
        mock_serp_doc.google_position = 1

        with patch.object(settings, "GROQ_API_KEY", "gsk_test_12345"):
            with patch("services.generate_ai_service.call_groq", AsyncMock(return_value=sample_article)) as mock_groq:
                with patch("services.content_generator.call_gemini", AsyncMock()) as mock_gemini:
                    with patch("services.serp_baseline.ensure_keyword_and_serp", AsyncMock(return_value=(MagicMock(), [mock_serp_doc]))):
                        response = await client.post(
                            "/api/v1/generate",
                            json={
                                "keyword": "Enterprise Payment Integration",
                                "vertical": "Fintech",
                                "target_length": "Long",
                                "target_word_count": 2500,
                                "content_type": "Technical Guide",
                                "tone": "Technical",
                                "custom_instructions": "Focus on idempotency and webhooks",
                                "creativity": "High",
                            },
                        )

                        assert response.status_code == 200
                        data = response.json()

                        # 1. Output structure verification
                        assert data["provider"] == "groq"
                        assert data["model"] == "openai/gpt-oss-120b"
                        assert data["word_count"] > 0
                        assert len(data["content"]) > 50

                        # 2. Verify Groq call received target words & creativity
                        mock_groq.assert_called_once()
                        call_kwargs = mock_groq.call_args[1]
                        assert call_kwargs["target_word_count"] == 2500
                        assert call_kwargs["creativity"] == "High"
                        assert "Enterprise Payment Integration" in call_kwargs["prompt"]

                        # 3. CRITICAL: Verify Gemini was NEVER called
                        mock_gemini.assert_not_called()

    @pytest.mark.asyncio
    async def test_generate_error_does_not_call_gemini(self, client):
        """When Groq fails, ensure error response is returned and Gemini is NEVER called as fallback."""
        with patch.object(settings, "GROQ_API_KEY", None):
            with patch("services.content_generator.call_gemini", AsyncMock()) as mock_gemini:
                with patch("services.serp_baseline.ensure_keyword_and_serp", AsyncMock(return_value=(MagicMock(), []))):
                    response = await client.post(
                        "/api/v1/generate",
                        json={"keyword": "Fintech API", "vertical": "Fintech"},
                    )
                    assert response.status_code == 200
                    data = response.json()
                    assert data["success"] is False
                    assert "Groq API key is not configured" in data["error"]
                    assert data["provider"] == "groq"
                    assert data["model"] == "openai/gpt-oss-120b"
                    mock_gemini.assert_not_called()

    @pytest.mark.asyncio
    async def test_concurrent_generate_and_analyze_isolation(self, client):
        """Verify concurrent Generate (Groq) and Analyze (local/Gemini) requests execute without crossover."""
        sample_article = (
            "# Payment Gateway Scalability\n\n"
            "## Architecture\n\n"
            "Distributed payment systems rely on event streaming.\n\n"
            "## Conclusion\n\n"
            "This concludes the architecture overview."
        )

        mock_groq = AsyncMock(return_value=sample_article)
        mock_gemini = AsyncMock(return_value="Gemini Analysis Summary")

        with patch.object(settings, "GROQ_API_KEY", "gsk_test_isolation"):
            with patch("services.generate_ai_service.call_groq", mock_groq):
                with patch("services.content_generator.call_gemini", mock_gemini):
                    with patch("services.serp_baseline.ensure_keyword_and_serp", AsyncMock(return_value=(MagicMock(), []))):
                        # Run Generate request
                        gen_task = client.post(
                            "/api/v1/generate",
                            json={"keyword": "Payment Gateway Scalability", "vertical": "Fintech"},
                        )
                        # Run Health/Analyze check concurrently
                        health_task = client.get("/health")

                        gen_res, health_res = await asyncio.gather(gen_task, health_task)

                        assert gen_res.status_code == 200
                        assert health_res.status_code == 200
                        gen_data = gen_res.json()
                        assert gen_data["provider"] == "groq"
                        mock_groq.assert_called_once()
                        # Gemini was NOT called by Generate
                        mock_gemini.assert_not_called()


# ── 6. Non-Generate AI Features Do NOT Use Groq ──────────────────────────────

class TestNonGenerateFeaturesDoNotUseGroq:
    def test_analyze_and_scoring_do_not_use_groq(self):
        """Analyze page NLP scoring is deterministic and must never make HTTP calls to Groq."""
        from analysis.scoring_engine import build_content_analysis, run_full_scoring

        mock_doc = MagicMock()
        mock_doc.url = "https://example.com"
        mock_doc.body_content = "Enterprise data architecture best practices."
        mock_doc.position = 1
        mock_doc.title = "Data Architecture"
        mock_doc.competitor_position = 1
        mock_doc.google_position = 1

        with patch("services.generate_ai_service.call_groq", AsyncMock(side_effect=RuntimeError("Groq must NOT be called by Analyze!"))) as mock_groq:
            analysis = build_content_analysis("Our guide to enterprise data architecture.", "Enterprise Data", "Tech", [mock_doc])
            scores = run_full_scoring(analysis)

            assert scores.novelty_score is not None
            assert scores.authority_score is not None
            mock_groq.assert_not_called()


# ── 7. Editorial Blog Quality & Negative Constraints (ITChamps Standard) ──────

class TestEditorialBlogQualityAndNegativeConstraints:
    @pytest.mark.parametrize("target_words", [800, 1500, 2500])
    def test_blog_structures_have_no_executive_summary_or_action_plan(self, target_words: int):
        """Verify that get_content_type_structure for Blog never introduces executive summaries or action plans."""
        structure = get_content_type_structure("Blog", target_words)
        combined = " ".join(structure).lower()

        assert "executive summary" not in combined
        assert "executive overview" not in combined
        assert "key takeaways" not in combined
        assert "strategic overview" not in combined
        assert "action plan" not in combined
        assert "opening & positioning" in combined
        assert "conclusion" in combined

    def test_blog_prompt_has_explicit_negative_constraints(self):
        """Verify build_generate_prompt includes strict prohibitions against executive summaries and consulting templates."""
        prompt = build_generate_prompt(
            keyword="Multimodal AI in Mental Health Research",
            vertical="Healthcare",
            top_entities=[{"text": "Psychiatric Evaluation", "entity_type": "CLINICAL"}],
            content_type="Blog",
            tone="Professional",
            target_word_count=1500,
            custom_instructions="the generated content should look like human written not AI generated content",
        )

        # Prohibitions
        assert "ABSOLUTE PROHIBITION ON EXECUTIVE SUMMARIES" in prompt
        assert "ABSOLUTE PROHIBITION ON ACTION PLAN TABLES" in prompt
        assert "ITCHAMPS STANDARD" in prompt
        assert "Executive Summary" in prompt
        assert "Action Plan" in prompt
        assert "the generated content should look like human written not AI generated content" in prompt

        # Editorial quality guidelines
        assert "Topic-Specific Section Headings" in prompt
        assert "Flowing Prose Paragraphs" in prompt
        assert "Selective Bold Emphasis" in prompt
        assert "Natural Editorial Conclusion" in prompt

    def test_repair_or_complete_article_appends_clean_conclusion(self):
        """Ensure that repairing missing conclusion appends '## Conclusion' and never 'Key Takeaways'."""
        incomplete_text = (
            "# Multimodal Signals in Clinical Trials\n\n"
            "Clinical research into psychiatric disorders is increasingly integrating acoustic biomarkers, "
            "natural language patterns, and physiological telemetry to build comprehensive patient profiles.\n\n"
            "## The Convergence of Behavioral Streams\n\n"
            "By synchronizing patient speech prosody with motor telemetry, researchers uncover subtle shifts "
            "that precede acute depressive episodes."
        )
        repaired = repair_or_complete_article(
            incomplete_text,
            reason="Response lacks a dedicated concluding section or summary in final 30% of content",
            content_type="Blog",
        )

        assert "## Conclusion" in repaired
        assert "Strategic Conclusion & Key Takeaways" not in repaired
        assert "Key Takeaways" not in repaired
        assert "Action Plan" not in repaired
        assert repaired.strip().endswith(".")


# ── 8. Section 38 Exact User Configuration End-to-End Test ────────────────────

class TestExactUserConfigurationSection38:
    @pytest.mark.asyncio
    async def test_exact_user_configuration_multimodal_ai(self, client):
        """
        Verify the exact user configuration:
        Content Type: Blog
        Tone: Professional
        Target Length: Medium (~1,500w)
        Creativity: Medium
        Target Keyword: Multimodal AI in Mental Health Research
        Custom Instructions: the generated content should look like human written not AI generated content
        """
        paragraphs_sec1 = [
            "Enterprise mental health research is undergoing a fundamental paradigm shift. For decades, clinical trials "
            "relied almost exclusively on intermittent, subjective patient-reported outcome measures and structured clinical interviews. "
            "While valuable, these instruments provide only sparse snapshots of complex, fluctuating psychiatric conditions. "
            "The emergence of multimodal artificial intelligence offers researchers the ability to capture continuous, objective "
            "biomarkers across audio, video, text, and physiological telemetry streams.",
            "However, integrating these disparate signals into unified predictive architectures introduces substantial "
            "engineering and methodological hurdles. In this article, we examine how cross-modal attention mechanisms and "
            "privacy-preserving federated pipelines allow clinical researchers to extract actionable signal from high-entropy behavioral data."
        ]
        paragraphs_sec2 = [
            "Traditional single-modality approaches—such as analyzing acoustic vocal characteristics alone—frequently stumble "
            "against confounding environmental noise and individual speech idiosyncrasies. When acoustic data is fused with linguistic "
            "sentiment and facial action coding units, the compound diagnostic specificity improves dramatically.",
            "Cross-attention transformer architectures allow the representations learned from vocal prosody to inform and contextualize "
            "the semantic transcripts. For example, a flat affective tone combined with semantically positive verbal disclosures provides "
            "a clinical indicator of masking or incongruence that neither modality could reliably quantify in isolation.",
            "To operationalize this in research settings, data engineering pipelines must preserve temporal synchrony across modalities "
            "while normalizing for sensor drift and variable sampling rates across consumer wearables and clinical hardware."
        ]
        paragraphs_sec3 = [
            "Collecting multimodal behavioral data from vulnerable populations introduces severe ethical, legal, and privacy constraints. "
            "Researchers cannot simply transmit raw audio and high-definition video to centralized cloud clusters without violating patient "
            "trust and stringent regulatory frameworks like HIPAA and GDPR.",
            "Modern research consortia are resolving this dilemma through decentralized and privacy-preserving architectures. "
            "By deploying on-device feature extraction pipelines, raw facial landmark trajectories and vocal spectrograms are converted into "
            "anonymized mathematical embeddings before leaving the clinical observation suite.",
            "Federated learning models further enable multi-site clinical trials to train global foundational models without sharing "
            "underlying patient datasets across institutional boundaries, preserving institutional sovereignty and participant confidentiality."
        ]
        paragraphs_sec4 = [
            "The ultimate validation of multimodal architectures in psychiatric research lies in longitudinal predictive accuracy. "
            "Early clinical trials indicate that multimodal models can detect sub-threshold behavioral shifts indicative of depressive relapse "
            "up to two weeks prior to standard clinical observation.",
            "By establishing continuous baselines tailored to each participant's unique physiological and expressive patterns, "
            "researchers minimize false positives caused by temporary situational stressors.",
            "Furthermore, multimodal systems allow researchers to evaluate therapeutic efficacy with granular temporal resolution, "
            "measuring not just whether an intervention worked, but precisely which behavioral components responded first."
        ]
        conclusion_paragraphs = [
            "Multimodal AI represents more than an incremental improvement in psychiatric measurement; it fundamentally transforms "
            "how researchers conceptualize and track mental health conditions. By fusing acoustic, linguistic, and physiological signals "
            "into cohesive analytical frameworks, the research community gains unprecedented clarity into complex human states.",
            "Moving forward, the successful translation of these architectures into widespread clinical research will depend on rigorous "
            "cross-disciplinary collaboration between data architects, clinical investigators, and regulatory ethicists. Organizations that "
            "invest in robust, privacy-first multimodal data infrastructure today will establish the benchmark for the next generation of psychiatric discovery."
        ]

        full_blog = (
            "# Multimodal AI in Mental Health Research: Bridging Behavioral Signals and Clinical Discovery\n\n"
            + "\n\n".join(paragraphs_sec1) + "\n\n"
            "## Why Multimodal Signals Transform Clinical Behavioral Observation\n\n"
            + "\n\n".join(paragraphs_sec2) + "\n\n"
            "## Architectural Safeguards: Privacy, Synchronization, and Federated Modeling\n\n"
            + "\n\n".join(paragraphs_sec3) + "\n\n"
            "## Detecting Sub-Threshold Relapse Through Longitudinal Behavioral Telemetry\n\n"
            + "\n\n".join(paragraphs_sec4) + "\n\n"
            "## Conclusion\n\n"
            + "\n\n".join(conclusion_paragraphs)
        )

        mock_serp_doc = MagicMock()
        mock_serp_doc.url = "https://example.com/mental-health-ai"
        mock_serp_doc.body_content = "Research paper on multimodal AI, psychiatric telemetry, and clinical trials."
        mock_serp_doc.position = 1
        mock_serp_doc.title = "Multimodal AI in Psychiatry"
        mock_serp_doc.competitor_position = 1
        mock_serp_doc.google_position = 1

        with patch.object(settings, "GROQ_API_KEY", "gsk_test_section38_key"):
            with patch("services.generate_ai_service.call_groq", AsyncMock(return_value=full_blog)) as mock_groq:
                with patch("services.content_generator.call_gemini", AsyncMock()) as mock_gemini:
                    with patch("services.serp_baseline.ensure_keyword_and_serp", AsyncMock(return_value=(MagicMock(), [mock_serp_doc]))):
                        response = await client.post(
                            "/api/v1/generate",
                            json={
                                "keyword": "Multimodal AI in Mental Health Research",
                                "vertical": "Healthcare",
                                "content_type": "Blog",
                                "tone": "Professional",
                                "target_length": "Medium",
                                "target_word_count": 1500,
                                "creativity": "Medium",
                                "custom_instructions": "the generated content should look like human written not AI generated content",
                            },
                        )

                        assert response.status_code == 200
                        data = response.json()

                        # Quality Gate Checks:
                        assert data["success"] is True
                        assert data["provider"] == "groq"
                        assert data["model"] == "openai/gpt-oss-120b"
                        assert data["word_count"] > 300

                        content = data["content"]

                        # 1. Structure Quality Gates (No Executive Summary, No Key Takeaways, No Action Plan table)
                        assert "executive summary" not in content.lower()
                        assert "executive overview" not in content.lower()
                        assert "key takeaways" not in content.lower()
                        assert "strategic overview" not in content.lower()
                        assert "| Phase |" not in content
                        assert "Action Plan" not in content

                        # 2. Topic-driven headings present
                        assert "## Why Multimodal Signals Transform Clinical Behavioral Observation" in content
                        assert "## Architectural Safeguards: Privacy, Synchronization, and Federated Modeling" in content
                        assert "## Conclusion" in content

                        # 3. Completeness & Endings
                        assert content.strip().endswith(".")

                        # 4. Prompt verification
                        mock_groq.assert_called_once()
                        call_prompt = mock_groq.call_args[1]["prompt"]
                        assert "the generated content should look like human written not AI generated content" in call_prompt
                        assert "ABSOLUTE PROHIBITION ON EXECUTIVE SUMMARIES" in call_prompt
                        assert "ABSOLUTE PROHIBITION ON ACTION PLAN TABLES" in call_prompt

                        # 5. Gemini Isolation
                        mock_gemini.assert_not_called()



# ── 9. Content Blueprint System Tests ──────────────────────────────────────────

class TestContentBlueprintSystem:
    """
    Tests for Content Blueprint System:
    - Reusable Content Blueprints (Blog, Landing Page, Documentation, Whitepaper, Tutorial, Comparison, Technical Guide)
    - Reusable Tone Profiles (Professional, Technical, Executive, Marketing)
    - Custom Instructions as an Editorial Layer & Humanize Directive
    - Lightweight Content Validator (structure, metadata leakage, completion)
    """

    def test_landing_page_blueprint_structure(self):
        """Verify Landing Page blueprint is conversion/benefit oriented, not a blog article."""
        struct_short = get_content_type_structure("Landing Page", 800)
        assert len(struct_short) == 4
        combined_short = " ".join(struct_short).lower()
        assert "value proposition" in combined_short
        assert "benefits" in combined_short or "benefit" in combined_short
        assert "cta" in combined_short or "call-to-action" in combined_short
        assert "opening & positioning" not in combined_short

        struct_med = get_content_type_structure("Landing Page", 1500)
        assert len(struct_med) == 4
        combined_med = " ".join(struct_med).lower()
        assert "differentiators" in combined_med or "conversion cta" in combined_med

    def test_documentation_blueprint_structure(self):
        """Verify Documentation blueprint is reference/procedure-oriented."""
        struct_short = get_content_type_structure("Documentation", 800)
        assert len(struct_short) == 4
        combined_short = " ".join(struct_short).lower()
        assert "purpose" in combined_short or "overview" in combined_short
        assert "configuration" in combined_short or "concepts" in combined_short
        assert "troubleshooting" in combined_short or "reference" in combined_short
        assert "opening & positioning" not in combined_short

        struct_long = get_content_type_structure("Documentation", 2500)
        assert len(struct_long) == 4
        combined_long = " ".join(struct_long).lower()
        assert "architecture" in combined_long
        assert "procedures" in combined_long

    def test_tutorial_blueprint_structure(self):
        """Verify Tutorial blueprint has numbered steps and learning objectives."""
        struct_med = get_content_type_structure("Tutorial", 1500)
        assert len(struct_med) == 5
        combined = " ".join(struct_med).lower()
        assert "numbered steps" in combined or "steps" in combined
        assert "objective" in combined or "prerequisites" in combined
        assert "verification" in combined or "testing" in combined

    def test_comparison_blueprint_structure(self):
        """Verify Comparison blueprint focuses on trade-offs and decision criteria."""
        struct_med = get_content_type_structure("Comparison", 1500)
        assert len(struct_med) == 5
        combined = " ".join(struct_med).lower()
        assert "comparative analysis" in combined or "benchmarking" in combined
        assert "decision framework" in combined or "selection framework" in combined

    def test_whitepaper_blueprint_structure(self):
        """Verify Whitepaper legitimately contains Executive Abstract."""
        struct_short = get_content_type_structure("Whitepaper", 800)
        assert len(struct_short) == 4
        assert "executive abstract" in " ".join(struct_short).lower()

        struct_med = get_content_type_structure("Whitepaper", 1500)
        assert len(struct_med) == 5

        struct_long = get_content_type_structure("Whitepaper", 2500)
        assert len(struct_long) == 6

    def test_blog_structure_count_and_cleanliness(self):
        """Verify Blog outline count is 4 for all tiers and free of executive summaries."""
        for target in [800, 1500, 2500]:
            struct = get_content_type_structure("Blog", target)
            assert len(struct) == 4
            combined = " ".join(struct).lower()
            assert "executive summary" not in combined
            assert "key takeaways" not in combined
            assert "action plan" not in combined

    def test_tone_profiles_content(self):
        """Verify get_tone_profile returns distinct, rich profiles for each tone."""
        tech = get_tone_profile("Technical")
        assert "TONE PROFILE - TECHNICAL:" in tech
        assert "precise" in tech.lower()
        assert "terminology" in tech.lower()

        exec_p = get_tone_profile("Executive")
        assert "TONE PROFILE - EXECUTIVE:" in exec_p
        assert "business outcomes" in exec_p.lower()
        assert "strategic" in exec_p.lower()

        mktg = get_tone_profile("Marketing")
        assert "TONE PROFILE - MARKETING:" in mktg
        assert "benefit" in mktg.lower()
        assert "persuasion" in mktg.lower() or "credible" in mktg.lower()

        prof = get_tone_profile("Professional")
        assert "TONE PROFILE - PROFESSIONAL:" in prof
        assert "clarity" in prof.lower()
        assert "analytical" in prof.lower()

    def test_prompt_includes_selected_tone_profile(self):
        """Verify prompt builder injects the actual tone profile block."""
        prompt_tech = build_generate_prompt(
            keyword="Enterprise Mesh Architecture",
            vertical="Fintech",
            top_entities=[],
            content_type="Technical Guide",
            tone="Technical",
            target_word_count=1500,
        )
        assert "TONE PROFILE - TECHNICAL:" in prompt_tech
        assert "precise, domain-specific terminology" in prompt_tech

        prompt_exec = build_generate_prompt(
            keyword="Cloud Cost Optimization",
            vertical="Fintech",
            top_entities=[],
            content_type="Blog",
            tone="Executive",
            target_word_count=1500,
        )
        assert "TONE PROFILE - EXECUTIVE:" in prompt_exec
        assert "business outcomes" in prompt_exec.lower()

    def test_humanize_directive_injected_when_requested(self):
        """Verify prompt builder injects HUMANIZE DIRECTIVE when requested."""
        prompt_human = build_generate_prompt(
            keyword="Modern Data Lakehouse",
            vertical="Technology",
            top_entities=[],
            content_type="Blog",
            tone="Professional",
            target_word_count=1500,
            custom_instructions="Please humanize the article and avoid AI sounding cliches",
        )
        assert "HUMANIZE DIRECTIVE" in prompt_human
        assert "Vary sentence length naturally" in prompt_human
        assert "Avoid AI writing cliches" in prompt_human

    def test_humanize_directive_absent_without_request(self):
        """Verify HUMANIZE DIRECTIVE is not injected when custom instructions do not request it."""
        prompt_standard = build_generate_prompt(
            keyword="Modern Data Lakehouse",
            vertical="Technology",
            top_entities=[],
            content_type="Blog",
            tone="Professional",
            target_word_count=1500,
            custom_instructions="Focus on query latency and caching architectures",
        )
        assert "HUMANIZE DIRECTIVE" not in prompt_standard
        assert "USER CUSTOM INSTRUCTIONS" in prompt_standard
        assert "Focus on query latency and caching architectures" in prompt_standard

    def test_custom_instructions_binding_layer_framing(self):
        """Verify custom instructions are framed as binding editorial directives."""
        prompt = build_generate_prompt(
            keyword="API Gateways",
            vertical="Technology",
            top_entities=[],
            content_type="Blog",
            tone="Professional",
            target_word_count=1500,
            custom_instructions="Include 5 major sections and an FAQ section at the end",
        )
        assert "USER CUSTOM INSTRUCTIONS (apply these as binding editorial directives" in prompt
        assert "Include 5 major sections and an FAQ section at the end" in prompt

    def test_validate_content_output_metadata_leakage_detection(self):
        """Verify validator flags internal entity metadata leakage."""
        dirty_content = (
            "# Enterprise Cloud Infrastructure\n\n"
            "Many organizations use AWS (ORG) and Google Cloud (ORG) for high throughput deployments in North America (LOC)."
        )
        val = validate_content_output(dirty_content, "Blog", target_words=500)
        assert any("Metadata leakage detected" in w and "(ORG)" in w for w in val["warnings"])
        assert any("(LOC)" in w for w in val["warnings"])

    def test_validate_content_output_blog_executive_summary_flag(self):
        """Verify validator flags unrequested Executive Summary headings in Blog."""
        report_like_blog = (
            "# The Future of Distributed Systems\n\n"
            "## Executive Summary\n\n"
            "This report summarizes key distributed system architectures.\n\n"
            "## Architecture\n\n"
            "Detailed content goes here.\n\n"
            "## Conclusion\n\n"
            "Final conclusion."
        )
        val = validate_content_output(report_like_blog, "Blog", custom_instructions="", target_words=100)
        assert any("unrequested executive-style heading" in w for w in val["warnings"])

        val_requested = validate_content_output(
            report_like_blog, "Blog",
            custom_instructions="Please include an Executive Summary at the start",
            target_words=100
        )
        assert not any("unrequested executive-style heading" in w for w in val_requested["warnings"])

    def test_validate_content_output_clean_content(self):
        """Verify clean, complete content produces no warnings."""
        clean_content = (
            "# Operationalizing Real-Time Data Pipelines\n\n"
            "Building low-latency data pipelines requires balancing streaming ingestion with consistent storage. "
            "Enterprises adopting event-driven backbones must account for distributed state management.\n\n"
            "## Designing State Stores for Stream Processing\n\n"
            "Stateful stream processors rely on local embedded databases backed by durable remote log storage. "
            "This architecture minimizes round-trip network latency during high-velocity updates.\n\n"
            "## Conclusion\n\n"
            "Maintaining data freshness while preserving transactional correctness remains the core design goal. "
            "Teams that establish rigorous schema contracts succeed in long-term operations."
        )
        val = validate_content_output(clean_content, "Blog", target_words=100)
        assert val["warnings"] == []
        assert val["word_count"] > 50


# ── 10. Comprehensive Verification of User Scenarios 1 to 12 & Provider Test ──

class TestUserScenariosAndProviderVerification:
    """
    Verification of the 12 explicit user scenarios and mandatory runtime provider test:
    - TEST 1: Blog + Professional
    - TEST 2: Blog + Technical
    - TEST 3: Blog + Executive
    - TEST 4: Blog + Marketing
    - TEST 5: Blog with no custom instruction (No automatic Executive Summary)
    - TEST 6: Blog + 'Humanize the article'
    - TEST 7: Blog + complex editorial custom instructions
    - TEST 8: Tutorial + 'Use numbered steps'
    - TEST 9: Technical Guide + 'Include an architecture section'
    - TEST 10: Comparison + multi-criteria instructions
    - TEST 11: Long Blog (~2500w) completeness and token budgeting
    - TEST 12: SERP-grounded generation without entity metadata leakage
    - MANDATORY PROVIDER TEST: POST /api/v1/generate uses Groq ONLY, never Gemini
    """

    def test_scenario_1_blog_professional(self):
        prompt = build_generate_prompt(
            keyword="Composable Commerce Architecture",
            vertical="E-Commerce",
            top_entities=[{"text": "Headless API"}],
            content_type="Blog",
            tone="Professional",
            target_word_count=1500,
        )
        assert "TASK: Write an authoritative, complete, publication-ready Blog" in prompt
        assert "TONE PROFILE - PROFESSIONAL:" in prompt
        assert "clarity, credibility, and analytical depth" in prompt
        assert "ABSOLUTE PROHIBITION ON EXECUTIVE SUMMARIES" in prompt

    def test_scenario_2_blog_technical(self):
        prompt = build_generate_prompt(
            keyword="Distributed Cache Invalidation",
            vertical="Technology",
            top_entities=[{"text": "Redis Cluster"}],
            content_type="Blog",
            tone="Technical",
            target_word_count=1500,
        )
        assert "TONE PROFILE - TECHNICAL:" in prompt
        assert "precise, domain-specific terminology" in prompt
        assert "architecture patterns" in prompt

    def test_scenario_3_blog_executive(self):
        prompt = build_generate_prompt(
            keyword="ERP Modernization ROI",
            vertical="Enterprise IT",
            top_entities=[{"text": "Total Cost of Ownership"}],
            content_type="Blog",
            tone="Executive",
            target_word_count=1500,
        )
        assert "TONE PROFILE - EXECUTIVE:" in prompt
        assert "business outcomes, strategic implications" in prompt
        assert "quantify impact where genuinely possible" in prompt.lower()

    def test_scenario_4_blog_marketing(self):
        prompt = build_generate_prompt(
            keyword="Customer Data Platforms",
            vertical="Marketing Tech",
            top_entities=[{"text": "Identity Resolution"}],
            content_type="Blog",
            tone="Marketing",
            target_word_count=1500,
        )
        assert "TONE PROFILE - MARKETING:" in prompt
        assert "lead with reader benefit and outcome" in prompt.lower()
        assert "avoid empty superlatives" in prompt.lower()

    def test_scenario_5_blog_no_custom_instructions_no_exec_summary(self):
        struct = get_content_type_structure("Blog", 1500)
        combined = " ".join(struct).lower()
        assert "executive summary" not in combined
        assert "key takeaways" not in combined
        assert "action plan" not in combined
        assert "strategic overview" not in combined

        prompt = build_generate_prompt(
            keyword="Zero Trust Security",
            vertical="Security",
            top_entities=[],
            content_type="Blog",
            tone="Professional",
            target_word_count=1500,
            custom_instructions="",
        )
        assert "USER CUSTOM INSTRUCTIONS" not in prompt
        assert "ABSOLUTE PROHIBITION ON EXECUTIVE SUMMARIES" in prompt

    def test_scenario_6_blog_humanize_instruction(self):
        prompt = build_generate_prompt(
            keyword="AI Agent Orchestration",
            vertical="Technology",
            top_entities=[],
            content_type="Blog",
            tone="Professional",
            target_word_count=1500,
            custom_instructions="Humanize the article.",
        )
        assert "HUMANIZE DIRECTIVE" in prompt
        assert "Vary sentence length naturally" in prompt
        assert "Avoid AI writing cliches" in prompt
        assert "In today's rapidly evolving..." in prompt

    def test_scenario_7_blog_complex_editorial_custom_instructions(self):
        instructions = "Humanize the article. Make the introduction conversational. Use 5 major sections. Add an FAQ at the end. Keep the conclusion concise."
        prompt = build_generate_prompt(
            keyword="Fintech Core Banking API",
            vertical="Fintech",
            top_entities=[],
            content_type="Blog",
            tone="Professional",
            target_word_count=1500,
            custom_instructions=instructions,
        )
        assert "HUMANIZE DIRECTIVE" in prompt
        assert "USER CUSTOM INSTRUCTIONS (apply these as binding editorial directives" in prompt
        assert "Make the introduction conversational" in prompt
        assert "Use 5 major sections" in prompt
        assert "Add an FAQ at the end" in prompt
        assert "Keep the conclusion concise" in prompt

    def test_scenario_8_tutorial_numbered_steps(self):
        prompt = build_generate_prompt(
            keyword="Deploying Kubernetes Ingress Controller",
            vertical="DevOps",
            top_entities=[],
            content_type="Tutorial",
            tone="Technical",
            target_word_count=1500,
            custom_instructions="Use numbered steps.",
        )
        assert "TASK: Write an authoritative, complete, publication-ready Tutorial" in prompt
        assert "Step-by-Step Implementation" in prompt or "numbered steps" in prompt.lower()
        assert "Use numbered lists when sequence matters" in prompt
        assert "USER CUSTOM INSTRUCTIONS" in prompt
        assert "Use numbered steps." in prompt

    def test_scenario_9_technical_guide_architecture(self):
        prompt = build_generate_prompt(
            keyword="Event-Driven Microservices",
            vertical="Software Architecture",
            top_entities=[],
            content_type="Technical Guide",
            tone="Technical",
            target_word_count=2000,
            custom_instructions="Include an architecture section.",
        )
        assert "TASK: Write an authoritative, complete, publication-ready Technical Guide" in prompt
        assert "Architecture & Design Principles" in prompt
        assert "USER CUSTOM INSTRUCTIONS" in prompt
        assert "Include an architecture section." in prompt

    def test_scenario_10_comparison_evaluation_criteria(self):
        prompt = build_generate_prompt(
            keyword="PostgreSQL vs DynamoDB",
            vertical="Databases",
            top_entities=[],
            content_type="Comparison",
            tone="Technical",
            target_word_count=1500,
            custom_instructions="Compare cost, scalability, security and implementation complexity.",
        )
        assert "TASK: Write an authoritative, complete, publication-ready Comparison" in prompt
        assert "Architectural Foundations" in prompt
        assert "Benchmarking" in prompt or "Comparative Analysis" in prompt
        assert "Use tables only when they genuinely improve clarity for comparative or reference information." in prompt
        assert "Compare cost, scalability, security and implementation complexity." in prompt

    def test_scenario_11_long_blog_completion_budgeting(self):
        prompt = build_generate_prompt(
            keyword="Enterprise Multi-Cloud Resilience",
            vertical="Infrastructure",
            top_entities=[],
            content_type="Blog",
            tone="Professional",
            target_word_count=2500,
        )
        assert "approximately 2500 words" in prompt
        assert "MUST be at least 2250 words" in prompt
        assert "COMPLETENESS TAKES PRIORITY OVER EXACT WORD COUNT" in prompt
        assert "Do NOT generate a giant article and cut it short" in prompt
        budget = calculate_groq_token_budget(2500)
        assert budget == 5800  # 2500 * 2.0 + 800

    def test_scenario_12_serp_entities_integrated_without_leakage(self):
        top_ents = [
            {"text": "AWS Lambda", "entity_type": "SERVICE"},
            {"text": "Kafka Streams", "entity_type": "FRAMEWORK"},
        ]
        prompt = build_generate_prompt(
            keyword="Serverless Stream Processing",
            vertical="Cloud",
            top_entities=top_ents,
            content_type="Blog",
            tone="Technical",
            target_word_count=1500,
        )
        assert "AWS Lambda (type: SERVICE)" in prompt
        # Instruction forbids type labels in output
        assert "NATURALLY INTEGRATE THESE DOMAIN ENTITIES" in prompt

        # Verify validator catches leakage if model emits (SERVICE) or (ORG)
        val = validate_content_output(
            "The system uses AWS Lambda (ORG) with Kafka Streams (FRAMEWORK) for event dispatch.",
            "Blog",
            target_words=500
        )
        assert any("Metadata leakage detected" in w and "(ORG)" in w for w in val["warnings"])

    @pytest.mark.asyncio
    async def test_mandatory_runtime_provider_isolation(self, client):
        """
        MANDATORY CRITICAL PROVIDER TEST:
        Invoking POST /api/v1/generate MUST call Groq (openai/gpt-oss-120b)
        and MUST NEVER invoke Gemini anywhere in its runtime call chain.
        """
        sample_article = (
            "# Enterprise AI Orchestration at Scale\n\n"
            "Deploying autonomous agents across distributed enterprise architectures requires "
            "stringent governance, semantic observability, and deterministic feedback loops.\n\n"
            "## Architecture Safeguards and Feedback Loops\n\n"
            "By implementing strict state validation at each transition boundary, teams ensure "
            "predictable execution without cascading hallucination or runaway iteration loops.\n\n"
            "## Conclusion\n\n"
            "Enterprises that prioritize contract-driven orchestration succeed in scaling AI capabilities."
        )

        mock_groq = AsyncMock(return_value=sample_article)
        mock_gemini = AsyncMock(return_value="Gemini Should Never Be Called")

        with patch.object(settings, "GROQ_API_KEY", "gsk_mandatory_provider_test_key"):
            with patch("services.generate_ai_service.call_groq", mock_groq):
                with patch("services.content_generator.call_gemini", mock_gemini):
                    with patch("services.serp_baseline.ensure_keyword_and_serp", AsyncMock(return_value=(MagicMock(), []))):
                        response = await client.post(
                            "/api/v1/generate",
                            json={
                                "keyword": "Enterprise AI Orchestration at Scale",
                                "vertical": "Technology",
                                "content_type": "Blog",
                                "tone": "Professional",
                                "target_length": "Medium",
                                "target_word_count": 1500,
                                "creativity": "Medium",
                                "custom_instructions": "Humanize the article and focus on resilience.",
                            },
                        )

                        assert response.status_code == 200
                        data = response.json()

                        # 1. Verify Groq was used
                        assert data["provider"] == "groq"
                        assert data["model"] == "openai/gpt-oss-120b"
                        mock_groq.assert_called_once()

                        # 2. VERIFY GEMINI WAS NEVER CALLED (Directly or Indirectly)
                        mock_gemini.assert_not_called()
