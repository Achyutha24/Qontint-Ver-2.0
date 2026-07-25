"""
Qontint ML Infrastructure — Advanced Preprocessing Module
Provides HTML parsing, structure extraction, tokenization, sentence splitting, and linguistic metrics.
"""

import re
from typing import List, Dict, Any, Tuple
from bs4 import BeautifulSoup

ENGLISH_STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can't",
    "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during",
    "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he",
    "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's",
    "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's",
    "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or",
    "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll",
    "she's", "should", "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them",
    "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this",
    "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're",
    "we've", "were", "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "while", "who",
    "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've",
    "your", "yours", "yourself", "yourselves"
}

# Passive voice auxiliary verbs + past participle indicator patterns
PASSIVE_VOICE_PATTERN = re.compile(r"\b(am|is|are|was|were|be|been|being)\s+([a-z]+ed|[a-z]+en|built|made|given|taken|done|seen|written|known|found)\b", re.IGNORECASE)


def clean_html(html_or_text: str) -> Tuple[str, Dict[str, Any]]:
    """
    Strips HTML tags while extracting rich structural metadata.
    """
    if not html_or_text or not isinstance(html_or_text, str):
        return "", {
            "title": "", "meta_description": "", "h1": [], "h2": [], "h3": [], "h4": [],
            "paragraphs": [], "bullets_count": 0, "numbered_count": 0, "code_count": 0,
            "table_count": 0, "image_count": 0, "faq_count": 0, "toc_present": False,
            "internal_links": 0, "external_links": 0, "canonical_present": False, "schema_present": False
        }

    is_html = "<" in html_or_text and ">" in html_or_text
    if not is_html:
        lines = [line.strip() for line in html_or_text.splitlines() if line.strip()]
        faq_cnt = sum(1 for line in lines if line.endswith("?") or "faq" in line.lower())
        toc_found = any("table of contents" in line.lower() or "toc" in line.lower() for line in lines[:5])
        return html_or_text.strip(), {
            "title": "",
            "meta_description": "",
            "h1": [],
            "h2": [],
            "h3": [],
            "h4": [],
            "paragraphs": lines,
            "bullets_count": sum(1 for line in lines if line.startswith(("-", "*", "•"))),
            "numbered_count": sum(1 for line in lines if re.match(r"^\d+[\.\)]", line)),
            "code_count": 0,
            "table_count": 0,
            "image_count": 0,
            "faq_count": faq_cnt,
            "toc_present": toc_found,
            "internal_links": 0,
            "external_links": 0,
            "canonical_present": False,
            "schema_present": False
        }

    soup = BeautifulSoup(html_or_text, "html.parser")
    
    title_tag = soup.find("title")
    title_text = title_tag.get_text().strip() if title_tag else ""

    meta_desc_tag = soup.find("meta", attrs={"name": re.compile(r"description", re.I)})
    meta_desc_text = meta_desc_tag["content"].strip() if meta_desc_tag and meta_desc_tag.has_attr("content") else ""

    h1_tags = [h.get_text().strip() for h in soup.find_all("h1") if h.get_text().strip()]
    h2_tags = [h.get_text().strip() for h in soup.find_all("h2") if h.get_text().strip()]
    h3_tags = [h.get_text().strip() for h in soup.find_all("h3") if h.get_text().strip()]
    h4_tags = [h.get_text().strip() for h in soup.find_all("h4") if h.get_text().strip()]
    
    p_tags = [p.get_text().strip() for p in soup.find_all(["p", "div", "section"]) if p.get_text().strip()]

    bullets_count = len(soup.find_all("li"))
    numbered_count = len(soup.find_all("ol"))
    code_count = len(soup.find_all(["code", "pre"]))
    table_count = len(soup.find_all("table"))
    image_count = len(soup.find_all("img"))
    
    # FAQ and TOC detection
    faq_count = len(soup.find_all(class_=re.compile(r"faq", re.I))) + sum(1 for h in h2_tags + h3_tags if "?" in h or "faq" in h.lower())
    toc_present = bool(soup.find(id=re.compile(r"toc|table-of-contents", re.I)) or soup.find(class_=re.compile(r"toc|table-of-contents", re.I)))

    # Canonical and Schema presence
    canonical_present = bool(soup.find("link", rel=re.compile(r"canonical", re.I)))
    schema_present = bool(soup.find("script", type="application/ld+json"))

    internal_links = 0
    external_links = 0
    for a in soup.find_all("a", href=True):
        href = a["href"].lower()
        if href.startswith("http://") or href.startswith("https://"):
            external_links += 1
        elif href.startswith("/") or href.startswith("#") or href.startswith("mailto:"):
            internal_links += 1

    plain_text = soup.get_text(separator=" ", strip=True)

    return plain_text, {
        "title": title_text,
        "meta_description": meta_desc_text,
        "h1": h1_tags,
        "h2": h2_tags,
        "h3": h3_tags,
        "h4": h4_tags,
        "paragraphs": p_tags,
        "bullets_count": bullets_count,
        "numbered_count": numbered_count,
        "code_count": code_count,
        "table_count": table_count,
        "image_count": image_count,
        "faq_count": faq_count,
        "toc_present": toc_present,
        "internal_links": internal_links,
        "external_links": external_links,
        "canonical_present": canonical_present,
        "schema_present": schema_present
    }


def tokenize(text: str, remove_stopwords: bool = True) -> List[str]:
    """Tokenize raw text into lowercase words."""
    if not text:
        return []
    words = re.findall(r"\b[a-zA-Z0-9]+\b", text.lower())
    if remove_stopwords:
        words = [w for w in words if w not in ENGLISH_STOPWORDS and len(w) > 1]
    return words


def split_sentences(text: str) -> List[str]:
    """Split text into sentences using regex."""
    if not text:
        return []
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    return [s.strip() for s in sentences if s.strip()]


def calculate_passive_voice_ratio(text: str, num_sentences: int) -> float:
    """Estimate percentage of sentences written in passive voice."""
    if not text or num_sentences <= 0:
        return 0.0
    matches = len(PASSIVE_VOICE_PATTERN.findall(text))
    return float(min(100.0, round((matches / max(1, num_sentences)) * 100.0, 2)))
