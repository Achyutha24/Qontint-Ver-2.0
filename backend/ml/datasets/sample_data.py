"""
Qontint ML Infrastructure — Sample Dataset Generator & Loader
Generates structured training samples for all 10 local ML models.
"""

import random
from typing import List, Dict, Any, Tuple
import numpy as np

from ml.feature_engineering.extractor import FeatureExtractor

SAMPLE_KEYWORDS = [
    "fintech payments API",
    "b2b content marketing strategy",
    "machine learning ranking algorithms",
    "enterprise SEO audit software",
    "crypto wallet security best practices",
    "cloud infrastructure cost optimization",
    "open banking PSD2 compliance",
    "saas churn rate reduction",
    "headless CMS content modeling",
    "AI content generation workflow"
]

SAMPLE_ARTICLES = [
    """<h1>Ultimate Guide to Fintech Payments API</h1>
    <p>Building a modern payment gateway requires robust API endpoints, PCI-DSS compliance, and sub-second latency.</p>
    <h2>Key Technical Requirements</h2>
    <p>Financial technology platforms like Stripe, Adyen, and Plaid utilize Webhooks, OAuth 2.0, and idempotent keys.</p>
    <h2>Security and Encryption</h2>
    <p>Data must be encrypted in transit using TLS 1.3 and at rest with AES-256 keys. Learn more at <a href="https://pci.org">PCI Security Standards</a>.</p>""",

    """<h1>B2B Content Marketing Strategy in 2026</h1>
    <p>Content marketing for enterprise SaaS requires semantic authority, topical coverage, and intent mapping.</p>
    <h2>1. Identifying Search Intent</h2>
    <p>Aligning blog posts with user intent increases conversion rates by 45%. Check our <a href="/internal/intent-guide">Internal Intent Guide</a>.</p>
    <h2>2. Measuring Topical Depth</h2>
    <p>Using entity extraction and graph metrics uncovers content gaps before publishing.</p>""",

    """<h1>Machine Learning Ranking Algorithms Explained</h1>
    <p>Search engines leverage Gradient Boosted Decision Trees (GBDT) and transformer models like BERT to rank documents.</p>
    <h2>Core Features in Search Ranking</h2>
    <p>PageRank, BM25 TF-IDF, entity embeddings, and click-through rates drive SERP positions.</p>
    <p>Reference: <a href="https://arxiv.org/abs/2104.00001">Arxiv Paper on Neural IR</a>.</p>"""
]


def generate_synthetic_dataset(num_samples: int = 50) -> Tuple[np.ndarray, Dict[str, List[Any]]]:
    """
    Generate synthetic dataset feature matrix X and target dict matching all 10 model keys:
    - rank_prediction
    - novelty_score
    - content_quality
    - authority_score
    - ctr_prediction
    - search_intent
    - topic_coverage
    - semantic_similarity
    - content_gap
    - readability_score
    """
    X_list = []
    targets: Dict[str, List[Any]] = {
        "rank_prediction": [],
        "novelty_score": [],
        "content_quality": [],
        "authority_score": [],
        "ctr_prediction": [],
        "search_intent": [],
        "topic_coverage": [],
        "semantic_similarity": [],
        "content_gap": [],
        "readability_score": []
    }

    random.seed(42)

    for i in range(num_samples):
        kw = random.choice(SAMPLE_KEYWORDS)
        base_article = random.choice(SAMPLE_ARTICLES)
        extended_content = base_article + f"<p>Additional section {i} covering detailed technical specs, statistics, and industry standards.</p>" * random.randint(1, 4)

        feats = FeatureExtractor.extract_features(extended_content, kw)
        vec = FeatureExtractor.get_feature_vector(feats)
        X_list.append(vec)

        word_cnt = feats["word_count"]
        sem_sim = feats["semantic_similarity"]
        entity_cnt = feats["named_entity_count"]
        fre = feats["flesch_reading_ease"]

        rank_prob = min(98.0, max(15.0, (word_cnt / 20.0) + (sem_sim * 30.0) + random.uniform(-5, 5)))
        novelty = min(95.0, max(20.0, (feats.get("novelty_ratio", 0.8) * 70.0) + random.uniform(-8, 8)))
        quality = min(96.0, max(25.0, (word_cnt / 25.0) + (fre * 0.3) + random.uniform(-5, 5)))
        authority = min(95.0, max(10.0, (entity_cnt * 3.0) + (feats["external_links"] * 5.0) + random.uniform(-5, 5)))
        ctr = min(92.0, max(10.0, (sem_sim * 50.0) + random.uniform(-10, 10)))
        
        intents = ["Informational", "Transactional", "Navigational", "Commercial"]
        intent_val = intents[i % len(intents)]

        topic_cov = min(98.0, max(15.0, feats["coverage_score"] + random.uniform(-5, 5)))
        sem_sim_val = round(min(0.99, max(0.1, sem_sim + random.uniform(-0.05, 0.05))), 3)
        gap_val = round(min(90.0, max(5.0, 100.0 - topic_cov + random.uniform(-5, 5))), 1)
        readability_val = round(min(98.0, max(10.0, fre + random.uniform(-5, 5))), 1)

        targets["rank_prediction"].append(round(rank_prob, 1))
        targets["novelty_score"].append(round(novelty, 1))
        targets["content_quality"].append(round(quality, 1))
        targets["authority_score"].append(round(authority, 1))
        targets["ctr_prediction"].append(round(ctr, 1))
        targets["search_intent"].append(intent_val)
        targets["topic_coverage"].append(round(topic_cov, 1))
        targets["semantic_similarity"].append(sem_sim_val)
        targets["content_gap"].append(gap_val)
        targets["readability_score"].append(readability_val)

    X_matrix = np.array(X_list, dtype=np.float32)
    return X_matrix, targets
