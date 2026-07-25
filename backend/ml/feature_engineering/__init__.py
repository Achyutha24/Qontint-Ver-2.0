from ml.feature_engineering.extractor import (
    FeatureExtractor,
    calculate_advanced_readability_metrics,
    extract_named_entities_comprehensive,
    compute_semantic_embedding_features,
    count_syllables
)

# Alias for backward compatibility
calculate_readability_metrics = calculate_advanced_readability_metrics
extract_named_entities_lightweight = extract_named_entities_comprehensive
compute_semantic_similarity_lightweight = compute_semantic_embedding_features

__all__ = [
    "FeatureExtractor",
    "calculate_advanced_readability_metrics",
    "calculate_readability_metrics",
    "extract_named_entities_comprehensive",
    "extract_named_entities_lightweight",
    "compute_semantic_embedding_features",
    "compute_semantic_similarity_lightweight",
    "count_syllables"
]
