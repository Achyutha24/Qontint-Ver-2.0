"""
Generate AI Service — Dedicated Groq Provider (Generate Page ONLY)
===================================================================
ARCHITECTURAL CONTRACT:
- This service is the EXCLUSIVE AI provider for the Generate Page.
- Target Model: openai/gpt-oss-120b (via Groq OpenAI-compatible API).
- Base URL: https://api.groq.com/openai/v1/chat/completions
- Zero shared mutable state with Gemini.
- Does NOT mutate any global AI provider variables.
- Does NOT fall back to Gemini under any circumstance.
- All non-Generate features (Analyze, SERP Intelligence, AI Assistant,
  YouTube) remain strictly on their existing Gemini pipelines.
"""
from __future__ import annotations

import asyncio
import functools
import json
import logging
import re
import time
import uuid
from typing import Any

import httpx

from config import settings
from analysis.entities import extract_entities_from_text
from services.authority_calculator import get_top_authority_entities_for_prompt

logger = logging.getLogger(__name__)


# ── Word Count & Token Budget Helpers ─────────────────────────────────────────

def resolve_target_word_count(
    target_word_count: int | None = None,
    target_length: str | None = None,
) -> int:
    """
    Resolve the authoritative target word count for content generation.
    Explicit target_word_count takes precedence over target_length string labels.
    """
    if target_word_count is not None and target_word_count > 0:
        return int(target_word_count)

    length_map = {
        "short": 800,
        "medium": 1500,
        "long": 2500,
    }
    key = (target_length or "medium").strip().lower()
    return length_map.get(key, 1500)


def calculate_groq_token_budget(target_words: int) -> int:
    """
    Calculate dynamic Groq completion token budget from requested words.
    English words typically require ~1.3-1.5 tokens. We allow ~2.0x headroom + 800 tokens
    for titles, headings, tables, and formatting, bounded to Groq model limits.
    """
    words = max(200, target_words)
    estimated_tokens = int(words * 2.0) + 800
    # Minimum 2048 tokens; ceiling up to 16384 tokens for extreme long-form content
    return min(16384, max(2048, estimated_tokens))


def resolve_groq_temperature(creativity: str | None) -> float:
    """Map UI creativity choice to Groq temperature setting."""
    c = (creativity or "Medium").strip().lower()
    if c in ("low", "precise"):
        return 0.2
    if c in ("high", "creative"):
        return 0.9
    return 0.7  # Medium / Balanced


# ── Content Type Blueprints ────────────────────────────────────────────────────

def get_content_type_structure(content_type: str, target_words: int) -> list[str]:
    """
    Return a proportional outline structure for the given content type and target length.

    Each blueprint defines WHAT the content is: its purpose, required sections,
    depth expectations, and formatting preferences. Tone (HOW it sounds) is
    handled separately by get_tone_profile().

    Section counts are stable per tier to preserve test assertions:
      Blog / Landing Page / Documentation: 4 sections at all tiers
      Whitepaper / Guide / Tutorial / Comparison: 4 (short), 5 (medium), 6 (long)
    """
    ct = (content_type or "Blog").strip().lower()

    # ── LANDING PAGE ──────────────────────────────────────────────────────────
    if "landing page" in ct or ct == "landing":
        if target_words <= 900:
            return [
                "1. Title & Value Proposition: Compelling, benefit-focused title and positioning statement communicating core value to target audience (~100 words).",
                "2. Problem & Solution Context: Articulate the specific friction the audience faces and position this solution directly (~200 words).",
                "3. Key Benefits & Capabilities: 3-4 concrete, benefit-focused statements with brief explanation focusing on outcomes (~300 words).",
                "4. Competitive Differentiators & Conversion CTA: What sets this apart from alternatives and a clear, credible call-to-action (~200 words).",
            ]
        elif target_words <= 1800:
            return [
                "1. Title & Value Proposition: Benefit-focused headline and positioning paragraph that earns immediate attention (~150 words).",
                "2. Problem Context & Solution Framing: In-depth exploration of pain points, business impact, and how this solution resolves them (~350 words).",
                "3. Key Benefits, Capabilities & Evidence: 4-5 benefit-driven sections with supporting context and outcome-first examples (~600 words).",
                "4. Competitive Differentiators & Conversion CTA: Distinctive advantages, ideal customer profile, and high-impact call-to-action (~400 words).",
            ]
        else:
            return [
                "1. Title, Subheadline & Value Proposition: Multi-layered positioning starting from headline to crisp value proposition (~200 words).",
                "2. Problem Context, Stakes & Solution Framework: Deep audience challenge framing, consequences, and solution architecture (~500 words).",
                "3. Benefits, Capabilities, Use Cases & Evidence: 5-6 concrete benefit areas with real-world use cases and outcome data (~900 words).",
                "4. Differentiators, Ideal Customer Profile & CTA: Objective competitive differentiation, target fit, and clear conversion path (~500 words).",
            ]

    # ── DOCUMENTATION ─────────────────────────────────────────────────────────
    if "documentation" in ct or ct in ("docs", "doc"):
        if target_words <= 900:
            return [
                "1. Title & Purpose: Reference overview defining scope, prerequisites, and what this documentation covers (~150 words).",
                "2. Core Concepts & Configuration: Key abstractions, terminology, parameters, and configuration options with clear definitions (~350 words).",
                "3. Procedures & Usage Examples: Step-by-step instructions for primary workflows with annotated examples (~250 words).",
                "4. Troubleshooting & Reference: Common failure modes with resolutions, known limitations, and quick-reference parameters (~100 words).",
            ]
        elif target_words <= 1800:
            return [
                "1. Title, Scope & Architecture Overview: Document scope, intended audience, architecture context, and prerequisites (~200 words).",
                "2. Core Concepts & Configuration Reference: Foundational concepts, system design, parameters, and setup requirements (~450 words).",
                "3. Procedures, Integration & Code Examples: Step-by-step procedures for primary use cases, integration patterns, and snippets (~700 words).",
                "4. Troubleshooting, Limitations & Quick Reference: Common failure modes, resolutions, edge cases, and a reference table (~350 words).",
            ]
        else:
            return [
                "1. Title, Scope, Audience & Prerequisites: Full document scope, audience definition, prerequisite knowledge, and coverage (~250 words).",
                "2. Architecture, Core Concepts & Configuration Reference: System topology, abstractions, parameters, and environment setup (~600 words).",
                "3. Procedures, Integration Patterns & Annotated Examples: Primary usage workflows, integration patterns, and step-by-step procedures (~1000 words).",
                "4. Troubleshooting, Edge Cases, Known Limitations & Quick Reference: Failure modes, edge cases, and comprehensive reference tables (~450 words).",
            ]

    # ── WHITEPAPER ────────────────────────────────────────────────────────────
    if "whitepaper" in ct or "white paper" in ct:
        if target_words <= 900:
            return [
                "1. Title & Executive Abstract: Definitive statement of the problem and strategic context (~150 words).",
                "2. Technical & Business Landscape: Industry drivers, operational bottlenecks, and regulatory pressure (~350 words).",
                "3. Architectural Solution Paradigm: System integration, data models, and security (~200 words).",
                "4. Strategic Synthesis & Conclusion: Final perspectives and organizational impact (~100 words).",
            ]
        elif target_words <= 1800:
            return [
                "1. Title & Executive Abstract: Definitive statement of the problem and strategic imperative (~200 words).",
                "2. Industry Context & Macro Drivers: Market analysis, regulatory pressures, and operational bottlenecks (~300 words).",
                "3. Architectural Solution Framework: Deep dive into systems, integration layers, and governance models (~450 words).",
                "4. Enterprise ROI & Risk Mitigation: Quantifiable impact, compliance safeguards, and deployment timeline (~350 words).",
                "5. Strategic Conclusion: Forward-looking synthesis and strategic perspectives (~200 words).",
            ]
        else:
            return [
                "1. Title & Executive Abstract: Comprehensive overview of strategic thesis and architecture (~250 words).",
                "2. Industry Context & Macro Drivers: Evolving standards, regulatory pressures, and market dynamics (~400 words).",
                "3. Technical Architecture & Systems Framework (2 detailed H2 sections): System topology, protocols, and data models (~750 words).",
                "4. Enterprise Governance, Security & Compliance: Security controls, auditability, and SLA enforcement (~450 words).",
                "5. Real-World Case Benchmarks: Implementation realities, comparative metrics, and failure modes (~400 words).",
                "6. Conclusion: Forward-looking synthesis and final perspective (~250 words).",
            ]

    # ── TUTORIAL ──────────────────────────────────────────────────────────────
    if "tutorial" in ct:
        if target_words <= 900:
            return [
                "1. Title & Learning Objectives: What the reader will build or accomplish, with prerequisite requirements (~100 words).",
                "2. Environment Setup & Prerequisites: Required tools, dependencies, and environment configuration (~200 words).",
                "3. Step-by-Step Implementation (numbered steps): Primary implementation process with concrete code or configuration (~450 words).",
                "4. Verification, Troubleshooting & Conclusion: How to verify success, common errors, and next steps (~150 words).",
            ]
        elif target_words <= 1800:
            return [
                "1. Title, Objective & Prerequisites: What the reader will learn, prerequisites, and estimated completion time (~200 words).",
                "2. Environment Setup & Technical Context: Step-by-step environment configuration and core concepts (~300 words).",
                "3. Core Implementation Steps (numbered steps across detailed sections): Numbered steps with actions, code snippets, and rationale (~750 words).",
                "4. Verification & Testing: Verification guidelines to confirm correct operational behavior (~200 words).",
                "5. Troubleshooting, Best Practices & Next Steps: Common pitfalls, debugging tips, and follow-on practices (~200 words).",
            ]
        else:
            return [
                "1. Title, Objectives & Prerequisites: Full project objectives, required tooling, and environment baseline (~250 words).",
                "2. Environment Setup & Architectural Overview: Detailed configuration, dependencies, and system layout (~400 words).",
                "3. Core Tutorial Workflow (numbered steps across 3 detailed sections): End-to-end implementation with code and config (~1050 words).",
                "4. Verification, Testing & Quality Checks: Comprehensive verification steps and integration tests (~300 words).",
                "5. Edge Cases, Troubleshooting & Variations: Failure modes, edge cases, and platform-specific variations (~300 words).",
                "6. Summary, Production Hardening & Next Steps: Production considerations, security tips, and next projects (~200 words).",
            ]

    # ── TECHNICAL GUIDE / GUIDE ───────────────────────────────────────────────
    if "guide" in ct:
        if target_words <= 900:
            return [
                "1. Title & Architectural Objectives: High-impact introduction framed around core objectives (~150 words).",
                "2. Core Technical Architecture & Setup: Essential prerequisites, system overview or component flow (~350 words).",
                "3. Step-by-Step Implementation & Key Patterns: Concrete, actionable instructions and code/config patterns (~250 words).",
                "4. Summary & Verification Checklist: Clear concluding steps and validation (~100 words).",
            ]
        elif target_words <= 1800:
            return [
                "1. Title: Compelling, SEO-optimized title reflecting the primary keyword.",
                "2. Architecture & Design Principles: Foundational paradigms, constraints, and prerequisites (~250 words).",
                "3. Step-by-Step Implementation Framework (at least 2 detailed H2 sections): Concrete patterns, schemas, and best practices (~600 words).",
                "4. Real-World Edge Cases, Troubleshooting & Observability: Error handling, retry policies, and monitoring (~350 words).",
                "5. Production Checklist & Conclusion: Final verification guidelines and ongoing maintenance (~200 words).",
            ]
        else:
            return [
                "1. Title: Compelling, editorial title targeting the primary keyword.",
                "2. Architecture & Design Principles: Foundational paradigms, constraints, and prerequisites (~350 words).",
                "3. Implementation Framework (3 detailed H2 sections): Concrete patterns, schemas, and best practices (~950 words).",
                "4. Edge Cases, Troubleshooting & Observability: Error recovery, retry policies, and monitoring (~450 words).",
                "5. Enterprise Scale & Governance: Compliance, multi-tenancy, and performance limits (~450 words).",
                "6. Production Verification & Conclusion: Final verification and operational recommendations (~300 words).",
            ]

    # ── COMPARISON ────────────────────────────────────────────────────────────
    if "comparison" in ct or "compare" in ct:
        if target_words <= 900:
            return [
                "1. Title: Compelling, editorial comparison title reflecting the primary keyword (~100 words).",
                "2. Architectural Foundations: How each approach is architected (~250 words).",
                "3. Comparative Analysis & Trade-offs: Latency, scalability, and cost implications (~350 words).",
                "4. Final Decision Framework & Conclusion: Pragmatic recommendation based on enterprise use cases (~100 words).",
            ]
        elif target_words <= 1800:
            return [
                "1. Title: Compelling, editorial comparison title reflecting the primary keyword.",
                "2. Architectural Foundations & Philosophies: Core trade-offs and structural differences (~350 words).",
                "3. Deep Feature & Performance Benchmarking: Comprehensive dimension-by-dimension comparison (~450 words).",
                "4. Operational Costs, Governance & Enterprise Integration: TCO, compliance, and developer experience (~350 words).",
                "5. Final Selection Framework & Conclusion: Scenario-based verdict for different enterprise profiles (~200 words).",
            ]
        else:
            return [
                "1. Title: Compelling, editorial comparison title targeting the primary keyword.",
                "2. Market Context & Architectural Divergence: How each philosophy emerged and key architectural trade-offs (~400 words).",
                "3. In-Depth Technical Benchmarking (2 detailed H2 sections): Latency, throughput, state management, and developer velocity (~850 words).",
                "4. Operational Complexity & TCO: Maintenance overhead, operational tooling, and licensing (~450 words).",
                "5. Security, Compliance & Governance: Data isolation, auditability, and ecosystem fit (~450 words).",
                "6. Strategic Selection Framework & Conclusion: Clear scenario-based decision matrix and final synthesis (~350 words).",
            ]

    # ── BLOG / EDITORIAL ARTICLE (DEFAULT & BENCHMARK) ────────────────────────
    # Standard: Exactly 4 sections at all tiers, keeping outline clean of executive summaries.
    if target_words <= 900:
        return [
            "1. Title: Compelling, editorial title targeting the primary keyword.",
            "2. Opening & Positioning: Concise positioning statement establishing the business context and central question (~150 words).",
            "3. Core Deep-Dive Sections (2 detailed H2 sections with topic-specific headings): In-depth frameworks, architectural reality, and practical enterprise considerations (~500 words total).",
            "4. Conclusion: Natural editorial synthesis connecting back to the core keyword and business impact (~150 words).",
        ]
    elif target_words <= 1800:
        return [
            "1. Title: Compelling, editorial title targeting the primary keyword.",
            "2. Opening & Positioning: Concise positioning paragraph establishing the business/technology reality and central architectural question (~200 words).",
            "3. Core In-Depth Sections (3 to 4 detailed topic-specific H2 sections): Flowing prose exploration of systems, operational friction, real-world context, and architectural decisions (~1,050 words total).",
            "4. Conclusion: Natural editorial synthesis reinforcing the central perspective and closing the article cleanly (~250 words).",
        ]
    else:
        return [
            "1. Title: Compelling, editorial title targeting the primary keyword.",
            "2. Opening & Positioning: Concise positioning paragraph establishing the macro context and core architectural problem (~250 words).",
            "3. Deep-Dive Exploration (4 to 5 detailed topic-specific H2 sections): In-depth, flowing prose examining systems, operational friction, architectural decisions, and real-world considerations (~1,950 words total).",
            "4. Conclusion: Natural editorial synthesis connecting back to the primary keyword and business impact (~300 words).",
        ]


# ── Tone Profiles ──────────────────────────────────────────────────────────────

def get_tone_profile(tone: str) -> str:
    """
    Return a named TONE PROFILE block that shapes HOW the content sounds.
    This is injected into the prompt to produce genuine writing style differences,
    not just a label appended to a sentence.
    """
    t = (tone or "Professional").strip().lower()

    if t == "technical":
        return """
TONE PROFILE - TECHNICAL:
- Use precise, domain-specific terminology. Define terms only when the target audience is unlikely to know them.
- Be explicit about assumptions, constraints, limitations, and edge cases - do not gloss over complexity.
- Structure arguments with clear cause-effect reasoning and logical progression.
- Use concrete technical examples: architecture patterns, configuration considerations, protocol details where relevant.
- Prefer shorter, declarative sentences for key technical assertions.
- Avoid vague or marketing-inflected language. State things exactly.
- Reference standards, protocols, or established practices where factually grounded and relevant.
- Technical depth is valued over brevity. Explain the why, not just the what.
"""
    elif t == "executive":
        return """
TONE PROFILE - EXECUTIVE:
- Lead with business outcomes, strategic implications, and risk/opportunity framing. What does this mean for the organization?
- Keep explanations concise and purposeful - executives understand context; they need implications and decisions, not process detail.
- Quantify impact where genuinely possible: performance, cost, risk, efficiency, time-to-value.
- Avoid deep implementation minutiae unless directly relevant to a business decision.
- Use confident, direct language. Minimize hedging - executives need clear positions, not equivocal analysis.
- Focus on decisions, trade-offs, and strategic recommendations over technical process.
- Paragraphs should be concise and scannable. Conclude sections with clear implications.
- Strategic framing: connect technical or operational realities to business outcomes throughout.
"""
    elif t == "marketing":
        return """
TONE PROFILE - MARKETING:
- Lead with reader benefit and outcome. The reader should immediately understand what they gain.
- Use engaging, active language. Energy comes from clarity and relevance, not hyperbole or empty enthusiasm.
- Avoid empty superlatives: "revolutionary", "game-changing", "best-in-class", "cutting-edge", "next-generation" unless specifically substantiated.
- Make value propositions concrete and specific - vague claims undermine trust.
- Write for the reader's priorities: their challenges, goals, and context - not the product in isolation.
- Use examples, scenarios, and outcomes that make benefits tangible and real.
- Balance persuasion with credibility. Unsupported claims and fake enthusiasm are counterproductive.
- Energetic but credible: engaging tone that earns trust rather than demanding it.
"""
    else:
        # Professional (default)
        return """
TONE PROFILE - PROFESSIONAL:
- Write with clarity, credibility, and analytical depth appropriate for a B2B enterprise audience.
- Balance technical detail with strategic context - neither purely abstract nor purely procedural.
- Use natural, varied sentence construction. Mix sentence lengths. Avoid repetitive patterns within and across paragraphs.
- Be confident without exaggeration. Assertions should be grounded in reasoning, evidence, or established practice.
- Paragraphs should develop ideas fully - not one-sentence summaries followed by bullets.
- Transitions between ideas should feel natural and earned, not formulaic ("Furthermore...", "Moreover...", "Additionally...").
- Write as a knowledgeable industry practitioner speaking to informed peers.
- Authority comes from insight and precision, not from superlatives or forceful language.
"""


# ── Prompt Builder ────────────────────────────────────────────────────────────

def build_generate_prompt(
    keyword: str,
    vertical: str,
    top_entities: list[dict],
    target_novelty: float = 0.35,
    previous_score: float | None = None,
    iteration: int = 1,
    content_type: str = "Blog",
    tone: str = "Professional",
    target_word_count: int = 1500,
    custom_instructions: str = "",
) -> str:
    """
    Construct the layered prompt for Groq, incorporating:
    1. System identity
    2. Editorial benchmark & rules (ITCHAMPS STANDARD for Blog)
    3. Tone profile (HOW it sounds)
    4. Content blueprint (WHAT kind of content)
    5. Domain entity context
    6. USER CUSTOM INSTRUCTIONS (binding editorial layer)
    7. Humanize directive (if requested)
    8. Target length, completeness, and completion rules
    """
    entity_context = "\n".join([
        f"- {e.get('text', '')} (type: {e.get('entity_type', e.get('type', 'CONCEPT'))})"
        for e in top_entities[:10] if e.get("text")
    ]) or f"- {keyword} (type: PRIMARY_KEYWORD)"

    vertical_display = vertical.replace("_", " & ").title()
    content_type_display = (content_type or "Blog").title()
    tone_display = (tone or "Professional").title()
    ct = (content_type or "Blog").strip().lower()

    improvement_note = ""
    if iteration > 1 and previous_score is not None:
        improvement_note = (
            f"\n\nPRIOR ATTEMPT FEEDBACK: Your previous draft scored {previous_score:.2f} novelty (target: >={target_novelty}). "
            "Introduce distinct enterprise perspectives, counter-intuitive strategic findings, novel entity relationships, "
            "and deeper technical analysis to maximize novelty."
        )

    # ── Custom Instructions (binding editorial layer) ─────────────────────────
    custom_section = ""
    if custom_instructions and custom_instructions.strip():
        custom_section = f"\n\nUSER CUSTOM INSTRUCTIONS (apply these as binding editorial directives - they override default structural choices where they conflict):\n{custom_instructions.strip()}"

    # ── Humanize Directive (detected from custom instructions) ────────────────
    humanize_block = ""
    ci_lower = (custom_instructions or "").lower()
    _humanize_triggers = [
        "humaniz", "sound natural", "remove ai", "ai-sound", "less robotic",
        "conversational", "human writing", "natural language", "no ai", "not ai",
        "sound human", "more human", "human written"
    ]
    if any(kw in ci_lower for kw in _humanize_triggers):
        humanize_block = """
HUMANIZE DIRECTIVE - Apply these writing behaviors throughout:
- Vary sentence length naturally: mix short, punchy sentences with longer analytical ones within each paragraph.
- Vary paragraph rhythm and openings: avoid starting every section or paragraph the same way.
- Use natural transitions instead of formulaic connectors: avoid "Furthermore,", "Moreover,", "Additionally,", "It is important to note that,", "In conclusion, it is worth noting".
- Write introductions and conclusions as a real author would - direct, specific, and non-formulaic.
- Open sections with a strong, specific statement - not a preamble or vague setup.
- Use concrete examples or real-world context where they genuinely illustrate a point (never fabricate data).
- Avoid AI writing cliches: "In today's rapidly evolving...", "In the ever-changing landscape...", "This article will explore...", "As businesses continue to...", "By leveraging...", "Unlock the power of...", "Game-changing", "Cutting-edge", "Paradigm shift".
- Do NOT introduce grammatical errors or informal slang. Humanization means professional editorial quality - natural, not careless.
"""

    min_words = int(target_word_count * 0.90)
    structure_text = "\n".join(get_content_type_structure(content_type, target_word_count))
    tone_block = get_tone_profile(tone)

    # ── Blog Editorial Rules (ITChamps Standard) ──────────────────────────────
    _non_blog_types = (
        "landing page", "landing", "whitepaper", "white paper",
        "technical guide", "tutorial", "comparison", "compare",
        "documentation", "docs", "doc", "guide"
    )
    blog_editorial_rules = ""
    if "blog" in ct or ct not in _non_blog_types:
        blog_editorial_rules = f"""
EDITORIAL BENCHMARK & B2B BLOG STYLE (ITCHAMPS STANDARD):
- Publication-Grade B2B Company Blog: The article must read like a real, professionally written company blog suitable for publication on the ITChamps website.
- ABSOLUTE PROHIBITION ON EXECUTIVE SUMMARIES: Do NOT automatically generate an "Executive Summary", "Executive Overview", "Key Takeaways", "Strategic Overview", "At-a-Glance Summary", "Article Summary", "Quick Summary", or "Summary of the Article" section unless explicitly requested in user custom instructions.
- ABSOLUTE PROHIBITION ON ACTION PLAN TABLES: Do NOT automatically generate an "Action Plan" table, "90-Day Roadmap", or implementation matrix unless explicitly requested in user custom instructions.
- Natural Editorial Title: Generate a specific, professional title relevant to the keyword. Avoid generic tropes like "Complete Guide to...", "Ultimate Guide to...", "10 Ways...", "Revolutionizing...", or "Unlocking the Future of...".
- Natural Opening & Positioning: Begin directly after the title with a concise positioning paragraph establishing the business/technology reality and central question. Do not insert artificial summaries or generic introductory labels before the article starts.
- Topic-Specific Section Headings: Headings MUST be informative, specific, and topic-driven (e.g. "Why Fragmented Enterprise Data Limits AI's Business Value", NOT generic headings like "Data Challenges", "Overview", or "Implementation").
- Flowing Prose Paragraphs: Carry the narrative through well-developed, flowing paragraphs. Use bullet lists selectively and only when they genuinely improve readability for concrete lists (systems, data sources, criteria).
- Selective Bold Emphasis: Bold key concepts, short phrases, or pivotal statements selectively. NEVER bold entire paragraphs or make every sentence bold.
- Natural Editorial Conclusion: Conclude with a natural synthesis that reinforces the central argument, connects back to the keyword "{keyword}", and provides a definitive concluding perspective.
- Avoid AI Clichés: Do NOT use clichés like "In today's rapidly evolving digital landscape...", "As businesses continue to embrace...", "Game-changing...", or "Unlock the full potential...". Write with authentic engineering and business acumen.
"""

    return f"""You are a senior B2B enterprise content strategist and lead industry author for {vertical_display}.

TASK: Write an authoritative, complete, publication-ready {content_type_display} targeting the keyword: "{keyword}"

AUDIENCE & TONE:
- Target Audience: B2B enterprise leaders, architects, decision-makers, and practitioners.
- Tone of Voice: {tone_display}, authoritative, insightful, analytical, and direct. Avoid generic marketing fluff.
{blog_editorial_rules}{tone_block}
CRITICAL LENGTH & COMPLETENESS REQUIREMENT:
- Target Length: approximately {target_word_count} words (MUST be at least {min_words} words).
- You MUST write the COMPLETE article from the title to the final concluding sentence.
- Plan your pacing so all planned sections fit cleanly within ~{target_word_count} words.
- COMPLETENESS TAKES PRIORITY OVER EXACT WORD COUNT. A complete article is better than a truncated one.
- Do NOT generate a giant article and cut it short.
- Do NOT stop prematurely or output an outline/summary.

CRITICAL COMPLETION RULES:
1. Every section must contain complete, fully-formed paragraphs.
2. Every list item (bullets or numbers) must be completely articulated.
3. If you include any Markdown table, every column and row must be fully completed and closed. Never leave a table half-finished.
4. The article MUST conclude with a definitive concluding section (e.g. 'Conclusion' or topic-grounded concluding heading) ending with a definitive terminal period.
5. Never end mid-sentence, mid-list, mid-table, or immediately after a heading.
6. Output pure publication-ready Markdown without conversational filler or preambles.

FORMATTING:
- Use Markdown headings (# for title, ## for major sections, ### for subsections where needed).
- Use **bold** for key concepts and short pivotal phrases only - not entire paragraphs.
- Use numbered lists when sequence matters. Use bullet lists for parallel lists of 3+ items.
- Use tables only when they genuinely improve clarity for comparative or reference information.

NATURALLY INTEGRATE THESE DOMAIN ENTITIES:
{entity_context}
{humanize_block}
CONTENT STRUCTURE:
{structure_text}{custom_section}{improvement_note}

Write the complete {content_type_display} now:"""


# ── Groq API Client (Isolated) ────────────────────────────────────────────────

async def call_groq(
    prompt: str,
    target_word_count: int = 1500,
    creativity: str = "Medium",
    vertical: str = "general",
) -> str:
    """
    Call Groq OpenAI-compatible Chat Completions API with openai/gpt-oss-120b.
    Completely isolated from Gemini - NEVER falls back to Gemini.
    """
    api_key = (settings.GROQ_API_KEY or "").strip()
    if not api_key:
        logger.error("GROQ_API_KEY is not configured in backend/.env")
        return (
            "ERROR: Groq API key is not configured. "
            "Please add your GROQ_API_KEY to your backend/.env file. "
            "(Get a free key at https://console.groq.com/keys)"
        )

    model = getattr(settings, "GROQ_MODEL", "openai/gpt-oss-120b")
    base_url = getattr(settings, "GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
    endpoint = f"{base_url}/chat/completions"
    timeout_s = getattr(settings, "GROQ_TIMEOUT", 60)

    max_tokens = calculate_groq_token_budget(target_word_count)
    temperature = resolve_groq_temperature(creativity)
    vertical_display = vertical.replace("_", " & ").title()

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    f"You are a premier B2B content strategist and enterprise writer for {vertical_display}. "
                    "You write authoritative, highly substantive long-form articles with deep domain insight. "
                    "Output only the completed article in clean Markdown without introductory chat conversational filler."
                ),
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            response = await client.post(endpoint, headers=headers, json=payload)
            status = response.status_code

            if status == 401 or status == 403:
                logger.error("Groq authentication failed (status %d)", status)
                return "ERROR: Groq API key is invalid or unauthorized. Please verify GROQ_API_KEY in backend/.env."

            if status == 429:
                logger.warning("Groq API rate limit exceeded")
                return "ERROR: Groq API rate limit reached. Please wait a moment and try again."

            if status >= 500:
                logger.error("Groq API server error (status %d): %s", status, response.text[:200])
                return f"ERROR: Groq service is temporarily unavailable (HTTP {status}). Please retry shortly."

            if status != 200:
                err_text = response.text[:200]
                logger.error("Groq API returned unexpected status %d: %s", status, err_text)
                return f"ERROR: Groq API returned error (HTTP {status}): {err_text}"

            data = response.json()
            choices = data.get("choices", [])
            if not choices:
                logger.error("Groq API response has no choices: %s", data)
                return "ERROR: Groq API returned an empty or malformed response."

            content = choices[0].get("message", {}).get("content", "").strip()
            if not content:
                logger.error("Groq API returned empty message content")
                return "ERROR: Groq API returned an empty response."

            logger.info(
                "Groq generation successful using model=%s (prompt tokens: %s, completion tokens: %s)",
                model,
                data.get("usage", {}).get("prompt_tokens"),
                data.get("usage", {}).get("completion_tokens"),
            )
            return content

    except httpx.TimeoutException:
        logger.error("Groq API request timed out after %ds", timeout_s)
        return f"ERROR: Groq API request timed out after {timeout_s}s. Please retry with a shorter length choice or try again."

    except Exception as exc:
        logger.exception("Groq API unexpected client failure: %s", exc)
        return f"ERROR: Failed to connect to Groq API: {str(exc)}"


# ── Truncation & Completeness Detection ──────────────────────────────────────

def detect_truncation(
    content: str,
    content_type: str = "Blog",
    target_words: int = 1500,
) -> tuple[bool, str]:
    """
    Deterministically detect if the generated article was truncated or cut off prematurely.
    Returns (is_truncated, reason).
    """
    if not content or not content.strip():
        return True, "Empty content"

    text = content.strip()
    words = len(text.split())

    lines = [line.strip() for line in text.split("\n") if line.strip()]
    if not lines:
        return True, "Content has no text lines"

    last_line = lines[-1]

    # 1. Check dangling heading (ends with a heading marker with no following text)
    if last_line.startswith(("#", "##", "###", "####", "#####")):
        return True, f"Dangling heading at end: '{last_line[:40]}'"

    # 2. Check dangling colon (cut off while introducing a list, table, or section)
    if text.endswith(":") or text.endswith(":\n") or text.endswith(":*"):
        return True, "Response ends with a dangling colon"

    # 3. Check incomplete markdown table
    if last_line.startswith("|"):
        if not last_line.endswith("|"):
            return True, "Response ends with an unclosed markdown table row"
        # Separator row like |---|---|
        if set(last_line.replace("|", "").replace("-", "").replace(":", "")) <= {"", " "}:
            return True, "Response ends immediately on a markdown table separator row with no data"
        # Check column count against previous row if table has multiple rows
        if len(lines) > 1 and lines[-2].startswith("|"):
            expected_cols = lines[-2].count("|")
            if last_line.count("|") < expected_cols:
                return True, "Response ends with an incomplete markdown table row (missing columns)"

    # 4. Check unfinished list item
    is_bullet = last_line.startswith(("- ", "* ", "+ "))
    is_numbered = bool(len(last_line) > 2 and last_line[:2].isdigit() and last_line[2] in (".", ")")) or bool(len(last_line) > 3 and last_line[:3].isdigit() and last_line[3] in (".", ")"))
    if is_bullet or is_numbered:
        if len(last_line) < 12 or not any(last_line.endswith(p) for p in (".", "!", "?", '"', "'", ")", "`", "*")):
            return True, f"Response ends with an unfinished list item: '{last_line[:40]}'"

    # 5. Check incomplete sentence without terminal punctuation
    clean_end = text
    while clean_end and clean_end[-1] in ("*", "_", "`", ")", "]", ">", "~", " ", "\n"):
        clean_end = clean_end[:-1]

    valid_terminals = (".", "!", "?", '"', "'")
    if clean_end and clean_end[-1] not in valid_terminals:
        return True, f"Response ends mid-sentence without terminal punctuation (ends with '{clean_end[-1]}')"

    # 6. Check for missing conclusion in long-form articles (>500 words)
    ct = (content_type or "Blog").strip().lower()
    if ct in ("blog", "whitepaper", "technical guide", "tutorial") and words > 500:
        conclusion_indicators = [
            "conclusion", "summary", "key takeaways", "action plan",
            "strategic outlook", "final thoughts", "moving forward",
            "roadmap", "wrapping up", "next steps", "looking ahead",
            "the path forward", "final perspective"
        ]
        tail_content = text[int(len(text) * 0.70):].lower()
        has_conclusion = any(ind in tail_content for ind in conclusion_indicators)
        if not has_conclusion:
            return True, "Response lacks a dedicated concluding section or summary in final 30% of content"

    return False, ""


def repair_or_complete_article(
    content: str,
    reason: str,
    content_type: str = "Blog",
) -> str:
    """
    Safely repairs minor trailing truncation artifacts so the article finishes cleanly
    with a complete, natural ending.
    """
    if not content or not content.strip():
        return content

    text = content.strip()
    lines = text.split("\n")

    # If ended on a dangling heading, remove the empty heading
    if lines and lines[-1].strip().startswith(("#", "##", "###", "####", "#####")):
        lines.pop()
        text = "\n".join(lines).strip()

    # If ended on an incomplete table row, drop the partial row
    lines = text.split("\n")
    if lines and lines[-1].strip().startswith("|") and not lines[-1].endswith("|"):
        lines.pop()
        text = "\n".join(lines).strip()

    # If ended mid-sentence, trim back to the last sentence ending with terminal punctuation
    clean_end = text
    while clean_end and clean_end[-1] in ("*", "_", "`", ")", "]", ">", "~", " ", "\n"):
        clean_end = clean_end[:-1]

    if clean_end and clean_end[-1] not in (".", "!", "?", '"', "'"):
        sentence_ends = [m.end() for m in re.finditer(r"[.!?][\s\n\"'\*\)]", text)]
        if sentence_ends:
            text = text[:sentence_ends[-1]].strip()
        else:
            text = text + "."

    # If missing conclusion, append an authoritative closing section
    ct = (content_type or "Blog").strip().lower()
    if ct in ("blog", "whitepaper", "technical guide", "tutorial") and "lack" in reason.lower():
        closing = (
            "\n\n## Conclusion\n\n"
            "By aligning modern architectural principles with rigorous data governance and automated quality controls, "
            "enterprises can successfully operationalize these capabilities at scale. The critical imperative is maintaining "
            "consistent visibility, continuous monitoring, and proactive adaptation as enterprise demands evolve."
        )
        text = text + closing

    return text


# ── Lightweight Content Validator ─────────────────────────────────────────────

def validate_content_output(
    content: str,
    content_type: str = "Blog",
    custom_instructions: str = "",
    target_words: int = 1500,
) -> dict:
    """
    Lightweight, warning-only content validator. Runs after generation and repair.
    Does NOT suppress or reject content - only logs observable issues for diagnostics.

    Checks:
    1. Internal metadata leakage (NLP entity type labels)
    2. Blog executive-summary gate (structural purity check for blog type)
    3. Minimum word count adequacy check
    4. Completion check (delegates to detect_truncation)

    Returns dict with "warnings" list and "word_count".
    """
    warnings: list[str] = []

    if not content or not content.strip():
        return {"warnings": ["Content is empty"], "word_count": 0}

    # 1. Internal metadata leakage detection
    metadata_patterns = [
        "(ORG)", "(GPE)", "(LOC)", "(PERSON)", "(PRODUCT)",
        "ENTITY_TYPE", "INTERNAL_ENTITY"
    ]
    for pat in metadata_patterns:
        if pat in content:
            warnings.append(f"Metadata leakage detected: '{pat}' appears in generated content")

    # 2. Blog executive-summary gate
    ct = (content_type or "blog").strip().lower()
    ci_lower = (custom_instructions or "").lower()
    _non_blog_types = (
        "landing page", "landing", "whitepaper", "white paper",
        "technical guide", "tutorial", "comparison", "compare",
        "documentation", "docs", "doc", "guide"
    )
    if "blog" in ct or ct not in _non_blog_types:
        exec_headings = re.findall(
            r"#{1,3}\s*(executive\s+summary|key\s+takeaways|action\s+plan|strategic\s+overview|business\s+impact\s+summary)",
            content,
            re.IGNORECASE,
        )
        explicitly_requested = any(
            kw in ci_lower
            for kw in ["executive summary", "key takeaways", "action plan", "strategic overview"]
        )
        if exec_headings and not explicitly_requested:
            warnings.append(
                f"Blog generated with unrequested executive-style heading(s): {exec_headings}"
            )

    # 3. Minimum word count check
    actual_words = len(content.split())
    min_acceptable = int(target_words * 0.65)
    if actual_words < min_acceptable:
        warnings.append(
            f"Content below target: {actual_words} words vs {target_words} target "
            f"(minimum acceptable: {min_acceptable})"
        )

    # 4. Completion check
    is_trunc, trunc_reason = detect_truncation(content, content_type, target_words)
    if is_trunc:
        warnings.append(f"Completion issue after repair: {trunc_reason}")

    for w in warnings:
        logger.warning("ContentValidator [%s]: %s", content_type, w)

    return {"warnings": warnings, "word_count": actual_words}


# ── Generation Pipeline with Validation Loop ──────────────────────────────────

async def generate_with_groq_validation(
    keyword: str,
    vertical: str,
    db: Any,
    max_iterations: int = 1,
    novelty_threshold: float = 0.35,
    content_type: str = "Blog",
    tone: str = "Professional",
    target_length: str = "Medium",
    target_word_count: int | None = None,
    custom_instructions: str = "",
    creativity: str = "Medium",
    job_id: str | None = None,
) -> dict[str, Any]:
    """
    Iterative generation loop driven strictly by Groq:
    1. Collect SERP baseline deterministically (no Gemini calls).
    2. Build layered prompt with content blueprint, tone profile, custom instructions.
    3. Generate content via Groq (openai/gpt-oss-120b).
    4. Validate completeness & detect truncation deterministically.
    5. Run lightweight content validator (warnings only, no content suppression).
    6. Score novelty, authority, and ranking deterministically with local scoring engine.
    7. Iterate if novelty target not met and max_iterations > 1.
    """
    from services.serp_baseline import ensure_keyword_and_serp
    from analysis.scoring_engine import build_content_analysis, run_full_scoring

    target_words = resolve_target_word_count(target_word_count, target_length)

    # ── Step 1: Collect SERP baseline deterministically (reused across loop) ──
    _, serp_docs = await ensure_keyword_and_serp(keyword, vertical, db)
    baseline_analysis = build_content_analysis("", keyword, vertical, serp_docs)
    top_entities = (
        baseline_analysis.serp_authority_entities[:10]
        or await get_top_authority_entities_for_prompt(vertical, top_n=10)
    )

    previous_score: float | None = None
    best_result: dict[str, Any] | None = None
    loop = asyncio.get_event_loop()

    for iteration in range(1, max_iterations + 1):
        logger.info(
            "Groq generation iteration %d/%d for keyword: '%s' (target_words=%d, tone=%s, type=%s)",
            iteration,
            max_iterations,
            keyword,
            target_words,
            tone,
            content_type,
        )

        prompt = build_generate_prompt(
            keyword=keyword,
            vertical=vertical,
            top_entities=top_entities,
            target_novelty=novelty_threshold,
            previous_score=previous_score,
            iteration=iteration,
            content_type=content_type,
            tone=tone,
            target_word_count=target_words,
            custom_instructions=custom_instructions,
        )

        content = await call_groq(
            prompt=prompt,
            target_word_count=target_words,
            creativity=creativity,
            vertical=vertical,
        )

        if content.startswith("ERROR:"):
            logger.error("Groq API error on iteration %d: %s", iteration, content)
            return {
                "success": False,
                "content": "",
                "error": content,
                "novelty_score": 0.0,
                "iterations_used": iteration,
                "entity_coverage": 0.0,
                "word_count": 0,
                "provider": "groq",
                "model": getattr(settings, "GROQ_MODEL", "openai/gpt-oss-120b"),
            }

        # ── Step 1.5: Deterministic Truncation & Completeness Validation ──────
        is_truncated, trunc_reason = detect_truncation(content, content_type=content_type, target_words=target_words)
        if is_truncated:
            logger.warning(
                "Truncation detected on iteration %d (%s). Applying deterministic repair.",
                iteration, trunc_reason
            )
            content = repair_or_complete_article(content, trunc_reason, content_type=content_type)

        # ── Step 1.6: Lightweight Content Validator (warnings only) ──────────
        validation = validate_content_output(
            content=content,
            content_type=content_type,
            custom_instructions=custom_instructions,
            target_words=target_words,
        )
        actual_word_count = validation["word_count"] or len(content.split())

        # ── Step 2: Deterministic scoring against SERP baseline ───────────────
        def _score_content(c: str) -> dict:
            analysis = build_content_analysis(c, keyword, vertical, serp_docs)
            scores = run_full_scoring(analysis)

            def _to_01(s: Any) -> float:
                if isinstance(s, dict):
                    val = float(s.get("score", 0.0))
                else:
                    val = float(s or 0.0)
                return max(0.0, min(1.0, val / 100.0 if val > 1.0 else val))

            novelty_01 = _to_01(scores.novelty_score)
            raw_threshold = float(scores.threshold or 70.0)
            threshold_01 = raw_threshold / 100.0 if raw_threshold > 1.0 else raw_threshold
            raw_conf = float(scores.confidence or 0.0)
            confidence_01 = raw_conf / 100.0 if raw_conf > 1.0 else raw_conf

            return {
                "novelty": {
                    "novelty_score": novelty_01,
                    "similarity_score": max(0.0, min(1.0, float(scores.similarity_score or 0.0))),
                    "entity_novelty": max(0.0, min(1.0, float(scores.entity_novelty or 0.0))),
                    "relationship_novelty": max(0.0, min(1.0, float(scores.relationship_novelty or 0.0))),
                    "semantic_diversity": max(0.0, min(1.0, float(scores.semantic_diversity or 0.0))),
                    "passed": bool(scores.passed),
                    "threshold": round(threshold_01, 2),
                    "verdict": str(scores.verdict or ""),
                    "reasoning": list(scores.reasoning or []),
                },
                "authority": {
                    "matched_entities": list(scores.matched_entities or []),
                    "missing_entities": list(scores.missing_entities or []),
                    "authority_score": _to_01(scores.authority_score),
                },
                "ranking": {
                    "predicted_rank": int(scores.predicted_rank or 50),
                    "confidence": round(confidence_01, 3),
                    "ranking_factors": dict(scores.ranking_factors or {}),
                    "optimization_gaps": list(scores.optimization_gaps or []),
                },
            }

        unified = await loop.run_in_executor(None, functools.partial(_score_content, content))
        novelty_result = unified["novelty"]
        coverage = unified["authority"]
        previous_score = novelty_result["novelty_score"]

        best_result = {
            "content": content,
            "novelty": novelty_result,
            "coverage": coverage,
            "ranking": unified["ranking"],
            "iteration": iteration,
            "word_count": actual_word_count,
        }

        if novelty_result["passed"]:
            logger.info("Groq novelty threshold met at iteration %d (score: %.4f)", iteration, previous_score)
            break

        # If more iterations requested, focus on missing high-authority entities
        missing = coverage.get("missing_entities") or []
        if missing:
            top_entities = [
                {"text": e, "authority_score": 0.8, "entity_type": "CONCEPT"}
                for e in missing[:10]
            ]

    if not best_result:
        return {
            "success": False,
            "content": "",
            "error": "Generation failed - no content produced",
            "novelty_score": 0.0,
            "iterations_used": 0,
            "entity_coverage": 0.0,
            "word_count": 0,
        }

    coverage_score = best_result["coverage"].get("authority_score", 0.0)
    ranking = best_result.get("ranking") or {"predicted_rank": 50}
    predicted_position = ranking.get("predicted_rank") or 50

    return {
        "success": best_result["novelty"]["passed"],
        "content": best_result["content"],
        "novelty_score": best_result["novelty"]["novelty_score"],
        "predicted_position": predicted_position,
        "iterations_used": best_result["iteration"],
        "entity_coverage": coverage_score,
        "ranking": ranking,
        "word_count": best_result["word_count"],
        "provider": "groq",
        "model": getattr(settings, "GROQ_MODEL", "openai/gpt-oss-120b"),
    }


# ── Router Entrypoint ─────────────────────────────────────────────────────────

async def full_generate_pipeline(
    keyword: str,
    vertical: str,
    db: Any,
    max_iterations: int = 1,
    novelty_threshold: float = 0.35,
    content_type: str | None = None,
    tone: str | None = None,
    target_length: str | None = None,
    target_word_count: int | None = None,
    custom_instructions: str | None = None,
    creativity: str | None = None,
) -> dict[str, Any]:
    """
    Top-level entrypoint for POST /api/v1/generate.
    Dispatches strictly to Groq and formats response for frontend.
    """
    job_id = str(uuid.uuid4())
    start = time.perf_counter()

    result = await generate_with_groq_validation(
        keyword=keyword,
        vertical=vertical,
        db=db,
        max_iterations=max_iterations,
        novelty_threshold=novelty_threshold,
        content_type=content_type or "Blog",
        tone=tone or "Professional",
        target_length=target_length or "Medium",
        target_word_count=target_word_count,
        custom_instructions=custom_instructions or "",
        creativity=creativity or "Medium",
        job_id=job_id,
    )

    total_ms = int((time.perf_counter() - start) * 1000)
    result["job_id"] = job_id
    result["processing_time_ms"] = total_ms
    return result
