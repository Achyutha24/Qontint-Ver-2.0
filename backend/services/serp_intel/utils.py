"""
Shared Utility Functions for SERP Intelligence Pipeline.
"""
from __future__ import annotations

import ast
import json
import re
import urllib.parse
from datetime import datetime
from typing import Any, Dict, List, Optional

from services.serp_intel.constants import NOISE_TERMS, SYNONYM_MAP, MARKETING_SLOGAN_PATTERNS


def _extract_domain(url: str) -> str:
    try:
        return urllib.parse.urlparse(url).netloc.replace("www.", "")
    except Exception:
        return "unknown"


def _is_clean_semantic_term(term: str) -> bool:
    """Filter out timestamps, dates, pure numbers, and UI/navigation noise."""
    if not term or not isinstance(term, str):
        return False
    t_clean = term.strip().lower()
    if len(t_clean) < 3:
        return False
    if t_clean.isdigit() or re.match(r'^\d+[\:\.\-\/]\d+$', t_clean):
        return False
    if re.search(r'\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b', t_clean):
        return False
    if t_clean in NOISE_TERMS:
        return False
    return True


def _normalize_semantic_concept(term: str) -> str:
    """Normalize acronyms, singularize nouns, and convert marketing slogans to clean generic semantic concepts."""
    if not term or not isinstance(term, str):
        return ""
    
    t_clean = term.strip()
    t_lower = t_clean.lower()
    
    if not _is_clean_semantic_term(t_lower):
        return ""

    if t_lower in SYNONYM_MAP:
        return SYNONYM_MAP[t_lower]
        
    t_clean = re.sub(r'^\d+\s+', '', t_clean).strip()
    t_clean = re.sub(r'^(the|a|an|our|my|their|best|good|five|free|top|#\d+|cut-edge|cutting-edge|ultimate|great)\s+', '', t_clean, flags=re.IGNORECASE).strip()
    t_lower_clean = t_clean.lower()

    if t_lower_clean in SYNONYM_MAP:
        return SYNONYM_MAP[t_lower_clean]

    for pat, replacement in MARKETING_SLOGAN_PATTERNS:
        if re.search(pat, t_lower_clean):
            return replacement

    if len(t_clean) > 2:
        return t_clean.title() if not t_clean.isupper() else t_clean
    return t_clean


def _extract_questions_from_pages(pages: List[Dict[str, Any]]) -> List[str]:
    """Extract question-like sentences from competitor body text."""
    questions: List[str] = []
    seen: set = set()
    question_re = re.compile(
        r'\b(what|how|why|when|where|which|who|can|should|is|are|does|do)\b[^.?!]{10,120}[?]',
        re.IGNORECASE,
    )
    for page in pages[:3]:
        body = page.get("body_content") or ""
        for match in question_re.finditer(body[:8000]):
            q = match.group(0).strip()
            q_lower = q.lower()
            if q_lower not in seen:
                seen.add(q_lower)
                questions.append(q)
            if len(questions) >= 20:
                break
    return questions


def _safe_json_loads(raw: str) -> Optional[dict]:
    """
    Multi-pass robust JSON parser:
      1. Strip markdown fences and leading/trailing text
      2. Clean unescaped control characters
      3. Direct json.loads with strict=False
      4. Outermost brace extraction { ... } + strict=False
      5. Trailing comma repair + strict=False
      6. Auto-close unclosed JSON structures
      7. ast.literal_eval fallback
    Returns None only if all passes fail.
    """
    if not raw or not raw.strip():
        return None

    cleaned = raw.strip()

    if "```" in cleaned:
        code_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', cleaned, re.IGNORECASE)
        if code_match:
            cleaned = code_match.group(1).strip()

    cleaned = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', cleaned)

    try:
        result = json.loads(cleaned, strict=False)
        if isinstance(result, dict):
            return result
    except Exception:
        pass

    start_idx = cleaned.find('{')
    end_idx = cleaned.rfind('}')

    if start_idx != -1:
        if end_idx <= start_idx:
            open_braces = cleaned.count('{') - cleaned.count('}')
            open_brackets = cleaned.count('[') - cleaned.count(']')
            json_str = cleaned[start_idx:] + (']' * max(0, open_brackets)) + ('}' * max(0, open_braces))
        else:
            json_str = cleaned[start_idx:end_idx + 1]

        try:
            result = json.loads(json_str, strict=False)
            if isinstance(result, dict):
                return result
        except Exception:
            pass

        fixed_commas = re.sub(r',\s*([}\]])', r'\1', json_str)
        try:
            result = json.loads(fixed_commas, strict=False)
            if isinstance(result, dict):
                return result
        except Exception:
            pass

        fixed_quotes = re.sub(r"'([^'\\]*(?:\\.[^'\\]*)*)'", r'"\1"', fixed_commas)
        try:
            result = json.loads(fixed_quotes, strict=False)
            if isinstance(result, dict):
                return result
        except Exception:
            pass

        try:
            py_str = re.sub(r'\btrue\b', 'True', fixed_commas, flags=re.IGNORECASE)
            py_str = re.sub(r'\bfalse\b', 'False', py_str, flags=re.IGNORECASE)
            py_str = re.sub(r'\bnull\b', 'None', py_str, flags=re.IGNORECASE)
            result = ast.literal_eval(py_str)
            if isinstance(result, dict):
                return result
        except Exception:
            pass

    return None


def _validate_response(response: dict) -> bool:
    """
    Verify the final response has the minimum required fields before returning.
    """
    required_top = {"keyword", "serp_results", "serp_analysis"}
    required_analysis = {"readability", "entities", "content_structure"}

    if not all(k in response for k in required_top):
        return False
    if not isinstance(response.get("serp_results"), list):
        return False
    analysis = response.get("serp_analysis", {})
    if not isinstance(analysis, dict):
        return False
    if not all(k in analysis for k in required_analysis):
        return False
    return True


def make_json_serializable(obj: Any) -> Any:
    """
    Recursively converts arbitrary Python objects (including sets, datetimes, dataclasses)
    to JSON-serializable primitives (lists, dicts, strings, ints, floats, bools, None).
    Converts sets to sorted lists for deterministic serialization.
    """
    if obj is None or isinstance(obj, (int, float, str, bool)):
        return obj
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, set):
        try:
            sorted_items = sorted(list(obj))
        except Exception:
            sorted_items = list(obj)
        return [make_json_serializable(item) for item in sorted_items]
    if isinstance(obj, (list, tuple)):
        return [make_json_serializable(item) for item in obj]
    if isinstance(obj, dict):
        return {str(k): make_json_serializable(v) for k, v in obj.items() if not str(k).startswith("_")}
    if hasattr(obj, "to_dict") and callable(getattr(obj, "to_dict")):
        return make_json_serializable(obj.to_dict())
    if hasattr(obj, "__dict__"):
        return {str(k): make_json_serializable(v) for k, v in obj.__dict__.items() if not str(k).startswith("_")}
    return str(obj)


sanitize_json_payload = make_json_serializable
