"""
Qontint ML Infrastructure — Production Inference Service
Loads trained local models once during startup, extracts 125 features, and runs structured predictions under 150ms.
Do NOT call Gemini during inference.
"""

import time
from pathlib import Path
from typing import Dict, Any, Optional
import numpy as np

from ml.feature_engineering.extractor import FeatureExtractor
from ml.models.rank_prediction import RankPredictionModel
from ml.models.novelty_score import NoveltyScoreModel
from ml.models.content_quality import ContentQualityModel
from ml.models.authority_score import AuthorityScoreModel
from ml.models.ctr_prediction import CTRPredictionModel
from ml.models.search_intent import SearchIntentModel
from ml.models.topic_coverage import TopicCoverageModel
from ml.models.semantic_similarity import SemanticSimilarityModel
from ml.models.content_gap import ContentGapModel
from ml.models.readability_score import ReadabilityScoreModel

from ml.utils.logger import ml_logger
from ml.utils.persistence import load_metadata, load_artifact, DEFAULT_MODEL_DIR
from ml.utils.self_learning import SelfLearningDatasetCollector


class MLInferenceService:
    """
    Singleton / Cached Local ML Inference Service.
    Loads all 10 local ML models once at startup and performs local predictions (<150ms).
    """

    _instance: Optional["MLInferenceService"] = None

    def __init__(self, model_dir: Optional[Path] = None):
        self.model_dir = model_dir or DEFAULT_MODEL_DIR
        self.models = {
            "rank_prediction": RankPredictionModel(),
            "novelty_score": NoveltyScoreModel(),
            "content_quality": ContentQualityModel(),
            "authority_score": AuthorityScoreModel(),
            "ctr_prediction": CTRPredictionModel(),
            "search_intent": SearchIntentModel(),
            "topic_coverage": TopicCoverageModel(),
            "semantic_similarity": SemanticSimilarityModel(),
            "content_gap": ContentGapModel(),
            "readability_score": ReadabilityScoreModel(),
        }
        self.scaler = None
        self.self_learning_collector = SelfLearningDatasetCollector(enabled=False)
        self.is_initialized = False
        self.version = "v1.2.0-local"

    @classmethod
    def get_instance(cls, model_dir: Optional[Path] = None) -> "MLInferenceService":
        """Get or initialize singleton instance of MLInferenceService."""
        if cls._instance is None:
            cls._instance = cls(model_dir=model_dir)
            cls._instance.initialize_models()
        return cls._instance

    def initialize_models(self) -> None:
        """Load trained models and scaler once from disk if available."""
        if self.is_initialized:
            return

        ml_logger.info("Initializing MLInferenceService from %s...", self.model_dir)
        loaded_count = 0

        for key, model_inst in self.models.items():
            try:
                success = model_inst.load(self.model_dir)
                if success:
                    loaded_count += 1
            except Exception as exc:
                ml_logger.warning("Could not load model %s: %s (using baseline predictor)", key, exc)

        # Load scaler if exists
        try:
            scaler_obj = load_artifact("feature_scaler.joblib", self.model_dir)
            if scaler_obj is not None:
                self.scaler = scaler_obj
        except Exception:
            pass

        meta = load_metadata(filename="pipeline_metadata.json", model_dir=self.model_dir)
        if meta and "version" in meta:
            self.version = meta["version"]

        self.is_initialized = True
        ml_logger.info("MLInferenceService ready. Loaded %d/%d trained model artifacts.", loaded_count, len(self.models))

    def predict(self, content: str, keyword: str = "") -> Dict[str, Any]:
        """
        Run inference across all 10 local ML models for input content and keyword under 150ms.
        Returns structured prediction JSON.
        """
        start_time = time.perf_counter()

        try:
            # 1. Feature Extraction (125 features)
            features_dict = FeatureExtractor.extract_features(content, keyword)
            X_vec = FeatureExtractor.get_feature_vector(features_dict)
            X_2d = np.atleast_2d(X_vec)

            # Apply scaler if loaded
            if self.scaler is not None:
                try:
                    X_2d_scaled = self.scaler.transform(X_2d)
                except Exception:
                    X_2d_scaled = X_2d
            else:
                X_2d_scaled = X_2d

            # 2. Run 10 local model predictions
            rank_prob = float(self.models["rank_prediction"].predict(X_2d_scaled)[0])
            novelty = float(self.models["novelty_score"].predict(X_2d_scaled)[0])
            quality = float(self.models["content_quality"].predict(X_2d_scaled)[0])
            authority = float(self.models["authority_score"].predict(X_2d_scaled)[0])
            ctr = float(self.models["ctr_prediction"].predict(X_2d_scaled)[0])
            
            intent_res = self.models["search_intent"].predict(X_2d_scaled)[0]
            intent_label, intent_conf = intent_res if isinstance(intent_res, tuple) else (str(intent_res), 85.0)
            
            topic_cov = float(self.models["topic_coverage"].predict(X_2d_scaled)[0])
            sem_sim = float(self.models["semantic_similarity"].predict(X_2d_scaled)[0])
            content_gap = float(self.models["content_gap"].predict(X_2d_scaled)[0])
            readability_val = float(self.models["readability_score"].predict(X_2d_scaled)[0])

            elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
            ml_logger.info("Local ML Inference completed in %.2f ms (keyword='%s')", elapsed_ms, keyword)

            prediction_result = {
                "rank_probability": int(round(rank_prob)),
                "novelty_score": int(round(novelty)),
                "content_quality": int(round(quality)),
                "authority_score": int(round(authority)),
                "ctr_prediction": int(round(ctr)),
                "intent": intent_label,
                "intent_confidence": intent_conf,
                "topic_coverage": int(round(topic_cov)),
                "semantic_similarity": round(sem_sim, 2),
                "content_gap": int(round(content_gap)),
                "readability": int(round(readability_val)),
                "features_summary": {
                    "word_count": int(features_dict["word_count"]),
                    "heading_count": int(features_dict["h1_count"] + features_dict["h2_count"] + features_dict["h3_count"]),
                    "entity_count": int(features_dict["named_entity_count"]),
                    "flesch_reading_ease": features_dict["flesch_reading_ease"],
                    "passive_voice_percentage": features_dict["passive_voice_percentage"]
                },
                "inference_time_ms": elapsed_ms,
                "model_version": self.version
            }

            # Optional self-learning record
            self.self_learning_collector.record_analysis(
                keyword=keyword,
                article=content,
                feature_vector=X_vec.tolist(),
                prediction_scores=prediction_result
            )

            return prediction_result

        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
            ml_logger.exception("Local ML Inference fallback executed after %.2f ms: %s", elapsed_ms, exc)
            return {
                "rank_probability": 50,
                "novelty_score": 50,
                "content_quality": 50,
                "authority_score": 50,
                "ctr_prediction": 50,
                "intent": "Informational",
                "intent_confidence": 50.0,
                "topic_coverage": 50,
                "semantic_similarity": 0.5,
                "content_gap": 50,
                "readability": 50,
                "error": str(exc),
                "inference_time_ms": elapsed_ms,
                "model_version": self.version
            }
