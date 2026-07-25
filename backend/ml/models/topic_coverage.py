"""
Topic Coverage Model — Predicts topic depth & coverage (0-100) using Sentence Transformers + XGBoost Regressor.
"""

from typing import Any, Dict, Sequence
import numpy as np
from ml.models.base import BaseMLModel
from ml.utils.metrics import compute_regression_metrics

try:
    import xgboost as xgb
    HAS_XGB = True
except ImportError:
    HAS_XGB = False
    from sklearn.ensemble import HistGradientBoostingRegressor


class TopicCoverageModel(BaseMLModel):
    """Predicts topic depth & entity coverage score (0-100) combining Sentence Transformers & XGBoost."""

    def __init__(self):
        super().__init__("topic_coverage_model")
        if HAS_XGB:
            self.model = xgb.XGBRegressor(n_estimators=100, max_depth=6, learning_rate=0.07, random_state=42)
        else:
            self.model = HistGradientBoostingRegressor(max_iter=100, max_depth=6, random_state=42)

    def train(self, X: np.ndarray, y: Sequence[float]) -> Dict[str, Any]:
        X_arr = np.atleast_2d(X)
        y_arr = np.array(y, dtype=np.float32)
        self.model.fit(X_arr, y_arr)
        self.is_trained = True
        preds = self.model.predict(X_arr)
        return compute_regression_metrics(y_arr, preds)

    def predict(self, X: np.ndarray) -> np.ndarray:
        X_arr = np.atleast_2d(X)
        if self.is_trained and self.model is not None:
            preds = self.model.predict(X_arr)
        else:
            word_cnt = X_arr[:, 0]
            heading_cnt = X_arr[:, 2] if X_arr.shape[1] > 2 else 5.0
            entity_cnt = X_arr[:, 34] if X_arr.shape[1] > 34 else 10.0
            cov_score = X_arr[:, 54] if X_arr.shape[1] > 54 else 50.0

            base = (cov_score * 0.5) + np.minimum(word_cnt / 25.0, 30.0) + np.minimum(entity_cnt * 1.5, 20.0)
            preds = np.clip(base, 15.0, 98.0)

        return np.round(np.clip(preds, 0.0, 100.0), 1)

    def evaluate(self, X: np.ndarray, y: Sequence[float]) -> Dict[str, float]:
        preds = self.predict(X)
        return compute_regression_metrics(y, preds)
