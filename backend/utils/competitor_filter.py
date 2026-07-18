import urllib.parse
from config import settings

def is_competitor_domain(url: str) -> bool:
    """
    Check if a domain is a legitimate competitor or an excluded domain.
    """
    if not url:
        return False
        
    try:
        domain = urllib.parse.urlparse(url).netloc.lower()
    except Exception:
        return False
        
    # Handle subdomains (e.g., www.example.com -> example.com)
    domain = domain.replace("www.", "")

    for excluded in settings.EXCLUDED_SERP_DOMAINS:
        # If the exclusion rule ends with '.', treat it as a subdomain/prefix rule
        if excluded.endswith("."):
            if domain.startswith(excluded) or f".{excluded}" in domain:
                return False
        # Otherwise, exact match or subdomain match
        elif domain == excluded or domain.endswith(f".{excluded}"):
            return False

    return True

def filter_and_renumber_competitors(serp_results: list) -> list:
    """
    Takes a list of raw SERP results (dicts or objects), filters out non-competitors,
    and assigns competitor_position and google_position (original position).
    Returns a new list of dicts.
    """
    valid_competitors = []
    competitor_pos = 1
    
    for doc in serp_results:
        # Support both dicts (from cache) and SQLAlchemy objects
        is_dict = isinstance(doc, dict)
        url = doc.get("url") if is_dict else getattr(doc, "url", None)
        
        if not is_competitor_domain(url):
            continue
            
        # Get the original google_position
        if is_dict:
            google_pos = doc.get("google_position") or doc.get("original_position") or doc.get("position")
        else:
            google_pos = getattr(doc, "google_position", None) or getattr(doc, "original_position", None) or getattr(doc, "position", None)
            
        if not google_pos:
            # Fallback if somehow missing
            google_pos = competitor_pos
            
        # Build the structured dict
        if is_dict:
            res = dict(doc)
        else:
            # Handle SQLAlchemy or other objects by converting known fields
            res = {
                "title": getattr(doc, "title", ""),
                "url": url,
                "meta_description": getattr(doc, "meta_description", ""),
                "body_content": getattr(doc, "body_content", ""),
                "word_count": getattr(doc, "word_count", 0),
                "domain_rating": getattr(doc, "domain_rating", 50),
            }
            
        res["google_position"] = google_pos
        res["competitor_position"] = competitor_pos
        res["position"] = competitor_pos  # For backward compatibility
        
        valid_competitors.append(res)
        competitor_pos += 1
        
    return valid_competitors
