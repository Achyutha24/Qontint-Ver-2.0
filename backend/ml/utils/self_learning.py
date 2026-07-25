"""
Qontint ML Infrastructure — Self Learning Dataset Collector
Optionally saves every completed analysis into a continuously growing dataset for future model retraining.
Disabled by default.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
from ml.utils.logger import ml_logger

DEFAULT_SELF_LEARNING_PATH = Path(__file__).resolve().parent.parent / "datasets" / "self_learning_dataset.json"


class SelfLearningDatasetCollector:
    """
    Self-Learning Dataset Recorder.
    Appends analysis results & extracted features to self_learning_dataset.json when enabled.
    """

    def __init__(self, dataset_file: Optional[Path] = None, enabled: bool = False):
        self.dataset_file = dataset_file or DEFAULT_SELF_LEARNING_PATH
        self.enabled = enabled

    def record_analysis(
        self,
        keyword: str,
        article: str,
        feature_vector: list,
        prediction_scores: Dict[str, Any],
        serp_features: Optional[Dict[str, Any]] = None,
        entity_statistics: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Record a completed analysis entry into the dataset.
        """
        if not self.enabled:
            return False

        entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "keyword": keyword,
            "article": article[:2000],  # Store truncated content sample
            "feature_vector": feature_vector if isinstance(feature_vector, list) else list(feature_vector),
            "prediction_scores": prediction_scores,
            "serp_features": serp_features or {},
            "entity_statistics": entity_statistics or {},
            "coverage": prediction_scores.get("topic_coverage", 50),
            "readability": prediction_scores.get("readability", 50),
            "authority": prediction_scores.get("authority_score", 50),
            "ctr": prediction_scores.get("ctr_prediction", 50)
        }

        try:
            records = []
            if self.dataset_file.exists():
                with open(self.dataset_file, "r", encoding="utf-8") as f:
                    try:
                        records = json.load(f)
                    except Exception:
                        records = []

            records.append(entry)

            with open(self.dataset_file, "w", encoding="utf-8") as f:
                json.dump(records, f, indent=2)

            ml_logger.info("Recorded analysis entry into self-learning dataset (%d total records).", len(records))
            return True
        except Exception as exc:
            ml_logger.error("Failed to record self-learning dataset entry: %s", exc)
            return False
