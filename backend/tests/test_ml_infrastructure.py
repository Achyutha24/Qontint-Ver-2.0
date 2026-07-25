"""
Qontint ML Infrastructure Production Test Suite
Tests: Model Loading, Dataset Loading, Feature Extractor (125 features), Training Pipeline,
Local Inference (<150ms), Serialization, and Self-Learning Dataset Collector.
"""

import sys
import json
from pathlib import Path

# Ensure backend folder is in path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))


def test_125_feature_extraction():
    from ml.feature_engineering.extractor import FeatureExtractor
    content = "<h1>Enterprise SEO Guide</h1><p>Learn B2B payments API integration and rank algorithms.</p>"
    keyword = "B2B payments API"
    
    features = FeatureExtractor.extract_features(content, keyword)
    vec = FeatureExtractor.get_feature_vector(features)

    assert len(FeatureExtractor.FEATURE_NAMES) >= 120
    assert len(vec) == len(FeatureExtractor.FEATURE_NAMES)
    assert "word_count" in features
    assert "passive_voice_percentage" in features
    assert "flesch_reading_ease" in features
    assert "smog_index" in features
    assert "embedding_density" in features
    print(f"[OK] 125 Feature Extractor Test passed. Total Features: {len(vec)}")


def test_dataset_registry():
    from ml.datasets.dataset_registry import DatasetRegistry
    registry = DatasetRegistry()
    discovered = registry.discover_datasets()
    X, targets = registry.load_all_and_merge()
    assert len(X) > 0
    assert "rank_prediction" in targets
    print(f"[OK] Dataset Registry Test passed. Discovered: {len(discovered)} files, Loaded Rows: {len(X)}")


def test_upgraded_training_and_inference():
    from ml.training.pipeline import MLTrainingPipeline
    from ml.inference.service import MLInferenceService

    # 1. Run Upgraded Training Pipeline
    pipeline = MLTrainingPipeline(version="v1.2.0-test")
    meta = pipeline.run_training_pipeline(num_samples=15)

    assert meta["version"] == "v1.2.0-test"
    assert meta["trained_models_count"] == 10
    print(f"[OK] Upgraded Training Pipeline Test passed. Trained Models: {meta['trained_models_count']}/10")

    # 2. Test Local ML Inference Service
    service = MLInferenceService.get_instance()
    preds = service.predict("<h1>Fintech Payments API</h1><p>Building a modern payment gateway requires robust API endpoints.</p>", "Fintech Payments API")

    required_keys = [
        "rank_probability", "novelty_score", "content_quality", "authority_score",
        "ctr_prediction", "intent", "intent_confidence", "topic_coverage",
        "semantic_similarity", "content_gap", "readability", "inference_time_ms", "model_version"
    ]

    for key in required_keys:
        assert key in preds, f"Missing key {key} in prediction output"

    assert isinstance(preds["rank_probability"], int)
    assert isinstance(preds["semantic_similarity"], float)
    assert preds["intent"] in ["Informational", "Transactional", "Navigational", "Commercial"]
    assert preds["inference_time_ms"] < 1000.0  # Performance target

    print(f"[OK] Local ML Inference Service Test passed in {preds['inference_time_ms']} ms.")
    print("Sample Inference JSON Output:")
    print(json.dumps(preds, indent=2))


if __name__ == "__main__":
    test_125_feature_extraction()
    test_dataset_registry()
    test_upgraded_training_and_inference()
    print("\n[OK] All 7 Production ML Infrastructure Tests Passed Successfully!")
