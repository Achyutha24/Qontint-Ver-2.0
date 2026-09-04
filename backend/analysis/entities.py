"""
M2 — Entity Extractor (spaCy en_core_web_lg + custom vertical patterns)
"""
from __future__ import annotations

import functools
import logging
import re
import time
import uuid
from typing import Any
from collections import Counter

import spacy
from spacy.language import Language
from spacy.matcher import PhraseMatcher
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.db import Entity, EntityOccurrence

logger = logging.getLogger(__name__)

_nlp: Language | None = None

VERTICAL_PATTERNS: dict[str, list[dict]] = {
    "accounting_finance": [
        {"label": "TECHNOLOGY", "pattern": "AP automation"},
        {"label": "TECHNOLOGY", "pattern": "AR automation"},
        {"label": "TECHNOLOGY", "pattern": "financial close"},
        {"label": "TECHNOLOGY", "pattern": "month-end close"},
        {"label": "PRODUCT", "pattern": "ERP"},
        {"label": "CONCEPT", "pattern": "GAAP"},
        {"label": "CONCEPT", "pattern": "IFRS"},
        {"label": "CONCEPT", "pattern": "cash flow"},
        {"label": "CONCEPT", "pattern": "accounts payable"},
        {"label": "CONCEPT", "pattern": "accounts receivable"},
        {"label": "CONCEPT", "pattern": "procure-to-pay"},
        {"label": "CONCEPT", "pattern": "order-to-cash"},
    ],
    "banking_lending": [
        {"label": "TECHNOLOGY", "pattern": "core banking"},
        {"label": "TECHNOLOGY", "pattern": "digital lending"},
        {"label": "TECHNOLOGY", "pattern": "BaaS"},
        {"label": "TECHNOLOGY", "pattern": "embedded finance"},
        {"label": "TECHNOLOGY", "pattern": "RegTech"},
        {"label": "CONCEPT", "pattern": "KYC"},
        {"label": "CONCEPT", "pattern": "AML"},
        {"label": "CONCEPT", "pattern": "credit scoring"},
        {"label": "CONCEPT", "pattern": "loan origination"},
        {"label": "CONCEPT", "pattern": "mortgage banking"},
        {"label": "REGULATION", "pattern": "CFPB"},
        {"label": "REGULATION", "pattern": "Basel III"},
        {"label": "CONCEPT", "pattern": "GSE"},
        {"label": "CONCEPT", "pattern": "LTV"},
        {"label": "CONCEPT", "pattern": "DTI"},
        {"label": "REGULATION", "pattern": "RESPA"},
        {"label": "REGULATION", "pattern": "HMDA"},
        {"label": "ORG", "pattern": "Fannie Mae"},
        {"label": "ORG", "pattern": "Freddie Mac"},
    ],
    "payroll_hr": [
        {"label": "TECHNOLOGY", "pattern": "HRIS"},
        {"label": "TECHNOLOGY", "pattern": "HCM"},
        {"label": "CONCEPT", "pattern": "direct deposit"},
        {"label": "CONCEPT", "pattern": "tax withholding"},
        {"label": "CONCEPT", "pattern": "garnishment"},
        {"label": "CONCEPT", "pattern": "time and attendance"},
        {"label": "ORG", "pattern": "ADP"},
        {"label": "ORG", "pattern": "Gusto"},
        {"label": "ORG", "pattern": "Paychex"},
        {"label": "ORG", "pattern": "Workday"},
    ],
    "crm_sales": [
        {"label": "TECHNOLOGY", "pattern": "sales automation"},
        {"label": "TECHNOLOGY", "pattern": "lead scoring"},
        {"label": "TECHNOLOGY", "pattern": "pipeline management"},
        {"label": "ORG", "pattern": "Salesforce"},
        {"label": "ORG", "pattern": "HubSpot"},
        {"label": "ORG", "pattern": "Zoho CRM"},
        {"label": "ORG", "pattern": "Pipedrive"},
    ],
    "cloud_cybersecurity": [
        {"label": "TECHNOLOGY", "pattern": "Zero Trust"},
        {"label": "TECHNOLOGY", "pattern": "SIEM"},
        {"label": "TECHNOLOGY", "pattern": "EDR"},
        {"label": "TECHNOLOGY", "pattern": "XDR"},
        {"label": "TECHNOLOGY", "pattern": "IAM"},
        {"label": "REGULATION", "pattern": "SOC2"},
        {"label": "REGULATION", "pattern": "SOC 2"},
        {"label": "REGULATION", "pattern": "HIPAA"},
        {"label": "TECHNOLOGY", "pattern": "Kubernetes"},
        {"label": "TECHNOLOGY", "pattern": "Docker"},
        {"label": "TECHNOLOGY", "pattern": "Serverless"},
        {"label": "ORG", "pattern": "AWS"},
        {"label": "ORG", "pattern": "Azure"},
        {"label": "ORG", "pattern": "GCP"},
    ],
    "ai_ml": [
        {"label": "TECHNOLOGY", "pattern": "generative AI"},
        {"label": "TECHNOLOGY", "pattern": "LLM"},
        {"label": "TECHNOLOGY", "pattern": "RAG"},
        {"label": "TECHNOLOGY", "pattern": "prompt engineering"},
        {"label": "TECHNOLOGY", "pattern": "neural networks"},
        {"label": "TECHNOLOGY", "pattern": "natural language processing"},
        {"label": "TECHNOLOGY", "pattern": "NLP"},
    ],
    "healthcare": [
        {"label": "TECHNOLOGY", "pattern": "EHR"},
        {"label": "TECHNOLOGY", "pattern": "EMR"},
        {"label": "TECHNOLOGY", "pattern": "telehealth"},
        {"label": "CONCEPT", "pattern": "medical billing"},
        {"label": "REGULATION", "pattern": "HIPAA Compliance"},
    ],
    "manufacturing_supply": [
        {"label": "TECHNOLOGY", "pattern": "WMS"},
        {"label": "TECHNOLOGY", "pattern": "TMS"},
        {"label": "TECHNOLOGY", "pattern": "MES"},
        {"label": "TECHNOLOGY", "pattern": "IIoT"},
        {"label": "CONCEPT", "pattern": "smart factory"},
        {"label": "CONCEPT", "pattern": "lean manufacturing"},
        {"label": "CONCEPT", "pattern": "demand forecasting"},
    ],
}

CUSTOM_FINTECH_ENTITIES = [
    "artificial intelligence",
    "machine learning",
    "predictive analytics",
    "logistics",
    "supply chain",
    "inventory management",
    "automation",
    "ERP",
    "warehouse optimization",
    "demand forecasting",
    "B2B",
    "SaaS",
    "PaaS",
    "IaaS",
    "ETL",
    "REST API",
]


from analysis.domain_vocabularies import (
    DOMAIN_VOCABULARIES,
    CANONICAL_ENTITY_MAP,
    get_all_vertical_patterns,
)
from spacy.matcher import Matcher

logger = logging.getLogger(__name__)

_nlp: Language | None = None
_phrase_matcher: PhraseMatcher | None = None
_token_matcher: Matcher | None = None


def normalize_entity(term: str) -> dict[str, Any]:
    """
    Centralized Entity Normalization Layer.
    Normalizes synonyms, acronyms, plurals, singulars, and abbreviations into canonical form.
    """
    if not term:
        return {"raw_term": "", "normalized": "", "canonical": "", "acronym": "", "category": "General"}

    raw = term.strip()
    key = raw.lower()

    # Check canonical dictionary lookup first
    if key in CANONICAL_ENTITY_MAP:
        info = CANONICAL_ENTITY_MAP[key]
        return {
            "raw_term": raw,
            "normalized": info["canonical"],
            "canonical": info["canonical"],
            "acronym": info.get("acronym", ""),
            "category": info.get("category", "General"),
        }

    # Clean punctuation and normalize spacing
    cleaned = re.sub(r'[^\w\s\-]', '', key)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    # Plural -> Singular basic normalization
    if cleaned.endswith("ies") and len(cleaned) > 5:
        singular = cleaned[:-3] + "y"
    elif cleaned.endswith("s") and not cleaned.endswith("ss") and len(cleaned) > 4:
        singular = cleaned[:-1]
    else:
        singular = cleaned

    canonical_title = singular.title()

    return {
        "raw_term": raw,
        "normalized": canonical_title,
        "canonical": canonical_title,
        "acronym": "",
        "category": "General",
    }


def clean_boilerplate(text: str) -> str:
    """Strip cookie notices, footer, login, and navigation boilerplate prior to NLP."""
    if not text:
        return ""
    
    BOILERPLATE_RE = re.compile(
        r"(cookie|privacy policy|terms of use|terms & conditions|all rights reserved|"
        r"copyright ©|sign in|log in|register|newsletter|share on|follow us|advertisement|accept all cookies)",
        re.I
    )
    
    lines = text.split("\n")
    cleaned_lines = [l for l in lines if not (len(l.strip()) < 120 and BOILERPLATE_RE.search(l))]
    result = " ".join(cleaned_lines)
    return re.sub(r'\s+', ' ', result).strip()


def get_nlp() -> Language:
    global _nlp
    if _nlp is None:
        logger.info("Loading spaCy model en_core_web_lg & vertical rules...")
        _nlp = spacy.load("en_core_web_lg")
        
        # Add EntityRuler with 13 vertical domain patterns before NER
        ruler = _nlp.add_pipe("entity_ruler", name="vertical_ruler", before="ner")
        all_patterns = get_all_vertical_patterns()
        
        # Add legacy fallback patterns
        for kw in CUSTOM_FINTECH_ENTITIES:
            all_patterns.append({"label": "CUSTOM_KEYWORD", "pattern": kw})
            all_patterns.append({"label": "CUSTOM_KEYWORD", "pattern": kw.lower()})
            all_patterns.append({"label": "CUSTOM_KEYWORD", "pattern": kw.title()})

        ruler.add_patterns(all_patterns)
        logger.info("spaCy en_core_web_lg + EntityRuler loaded (%d patterns)", len(all_patterns))
    return _nlp


def get_phrase_matcher(nlp: Language) -> PhraseMatcher:
    global _phrase_matcher
    if _phrase_matcher is None:
        matcher = PhraseMatcher(nlp.vocab, attr="LOWER")
        # Extract phrase patterns from domain vocabularies
        phrases = set(CUSTOM_FINTECH_ENTITIES)
        for domain, info in DOMAIN_VOCABULARIES.items():
            for p in info.get("patterns", []):
                phrases.add(p["pattern"])
        
        patterns = [nlp.make_doc(text) for text in phrases]
        matcher.add("DOMAIN_PHRASES", patterns)
        _phrase_matcher = matcher
    return _phrase_matcher


def get_token_matcher(nlp: Language) -> Matcher:
    global _token_matcher
    if _token_matcher is None:
        matcher = Matcher(nlp.vocab)
        # Token pattern for spec codes / compliance standards (e.g. SOC 2, ISO 27001, IEEE 802.11)
        matcher.add("SPEC_CODE", [
            [{"LOWER": "soc"}, {"IS_DIGIT": True}],
            [{"LOWER": "iso"}, {"IS_DIGIT": True}],
            [{"LOWER": "pci"}, {"LOWER": "dss"}],
            [{"LOWER": "basel"}, {"LOWER": "iii"}],
        ])
        _token_matcher = matcher
    return _token_matcher


@functools.lru_cache(maxsize=512)
def get_spacy_doc(content: str, max_len: int):
    nlp = get_nlp()
    return nlp(content[:max_len])


def extract_entities_from_text(
    content: str,
    vertical: str,
    max_len: int = 50_000,
    page_metadata: Optional[Dict[str, Any]] = None,
) -> list[dict[str, Any]]:
    """
    Multi-Layer Enterprise NLP Pipeline:
      Layer 1: spaCy NER (en_core_web_lg)
      Layer 2: EntityRuler (13 vertical domain patterns)
      Layer 3: PhraseMatcher (multi-word domain terms)
      Layer 4: Token Matcher (acronyms & spec standards)
      Layer 5: Dependency Parsing (syntactic noun chunks)
    Centralized Normalization & Provenance Tracking.
    """
    cleaned_content = clean_boilerplate(content)
    nlp = get_nlp()
    doc = get_spacy_doc(cleaned_content, max_len)
    
    phrase_matcher = get_phrase_matcher(nlp)
    token_matcher = get_token_matcher(nlp)

    KEEP_LABELS = {"ORG", "PRODUCT", "GPE", "PERSON", "LAW", "NORP",
                   "TECHNOLOGY", "CONCEPT", "REGULATION", "CUSTOM_KEYWORD"}

    extracted_items = []  # tuple: (norm_canonical, raw_text, label, method, confidence)

    # Layer 1 & 2: NER & EntityRuler
    for ent in doc.ents:
        raw_text = ent.text.strip()
        label = ent.label_
        if label in KEEP_LABELS and 2 <= len(raw_text) <= 100:
            norm_info = normalize_entity(raw_text)
            method = "entity_ruler" if label in {"TECHNOLOGY", "CONCEPT", "REGULATION"} else "spacy_ner"
            conf = 1.0 if method == "entity_ruler" else 0.88
            extracted_items.append((norm_info["canonical"], raw_text, label, method, conf, norm_info))

    # Layer 3: PhraseMatcher
    pm_matches = phrase_matcher(doc)
    for match_id, start, end in pm_matches:
        span = doc[start:end]
        raw_text = span.text.strip()
        if 2 <= len(raw_text) <= 100:
            norm_info = normalize_entity(raw_text)
            extracted_items.append((norm_info["canonical"], raw_text, "CUSTOM_KEYWORD", "phrase_matcher", 0.95, norm_info))

    # Layer 4: Token Matcher (Spec Codes)
    tm_matches = token_matcher(doc)
    for match_id, start, end in tm_matches:
        span = doc[start:end]
        raw_text = span.text.strip()
        if len(raw_text) >= 2:
            norm_info = normalize_entity(raw_text)
            extracted_items.append((norm_info["canonical"], raw_text, "REGULATION", "token_matcher", 1.0, norm_info))

    # Layer 5: Syntactic Noun Chunks
    for chunk in doc.noun_chunks:
        raw_text = chunk.text.strip()
        if 3 <= len(raw_text) <= 50 and chunk.root.pos_ in {"NOUN", "PROPN"}:
            norm_info = normalize_entity(raw_text)
            extracted_items.append((norm_info["canonical"], raw_text, "NOUN_CHUNK", "noun_chunk", 0.75, norm_info))

    meta = page_metadata or {}
    comp_url = meta.get("url", "")
    google_rank = meta.get("google_position", 1)
    comp_rank = meta.get("competitor_position", 1)

    # Aggregate & Centralized Normalization
    entity_map: Dict[str, dict[str, Any]] = {}

    for canonical, raw_text, label, method, conf, norm_info in extracted_items:
        if not canonical or len(canonical) < 2:
            continue

        if canonical not in entity_map:
            cluster = "general"
            if label in {"TECHNOLOGY", "PRODUCT"}: cluster = "technology"
            elif label in {"CONCEPT", "NOUN_CHUNK"}: cluster = "concept"
            elif label in {"ORG", "PERSON", "GPE"}: cluster = "named_entity"
            elif label == "CUSTOM_KEYWORD": cluster = "industry_term"

            entity_map[canonical] = {
                "entity": canonical, # Centralized normalized canonical form
                "text": canonical,   # Backwards compatibility
                "raw_term": raw_text,
                "acronym": norm_info.get("acronym", ""),
                "category": norm_info.get("category", "General"),
                "entity_type": label,
                "frequency": 1,
                "confidence_score": conf,
                "confidence": conf,
                "relevance_score": conf * 1.1,
                "semantic_cluster": cluster,
                "extraction_method": method,
                "authority_score": 0.0,
                # Entity Provenance Foundation
                "competitor_url": comp_url,
                "google_rank": google_rank,
                "competitor_rank": comp_rank,
                "source_heading": f"Section for {canonical}",
                "source_paragraph": f"Extracted from competitor content #{comp_rank}",
                "source_confidence": conf,
            }
        else:
            entity_map[canonical]["frequency"] += 1
            entity_map[canonical]["relevance_score"] = entity_map[canonical]["confidence_score"] * (1.0 + min(entity_map[canonical]["frequency"], 5) * 0.1)

    return list(entity_map.values())


async def extract_and_store_entities(
    content: str,
    vertical: str,
    serp_result_id: str,
    db: AsyncSession,
) -> list[dict[str, Any]]:
    entities = extract_entities_from_text(content, vertical)

    needed_texts = [e["text"] for e in entities]
    entity_cache = {}
    if needed_texts:
        for i in range(0, len(needed_texts), 500):
            batch = needed_texts[i:i+500]
            ent_res = await db.execute(select(Entity).where(Entity.text.in_(batch), Entity.vertical == vertical))
            for ent_obj in ent_res.scalars().all():
                entity_cache[ent_obj.text] = ent_obj

    for ent_data in entities:
        text = ent_data["text"]
        if text in entity_cache:
            entity = entity_cache[text]
            entity.frequency += 1
        else:
            entity = Entity(
                id=str(uuid.uuid4()),
                text=text,
                entity_type=ent_data["entity_type"],
                vertical=vertical,
                frequency=1,
            )
            db.add(entity)
            entity_cache[text] = entity

        db.add(EntityOccurrence(
            id=str(uuid.uuid4()),
            entity_id=entity.id,
            serp_result_id=serp_result_id,
            confidence=ent_data["confidence"],
        ))

    await db.commit()
    return entities
