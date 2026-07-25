"""
Content Quality Model — Predicts overall content quality score (0-100) using CatBoost Regressor.
"""

from typing import Any, Dict, Sequence
import numpy as np
from ml.models.base import BaseMLModel
from ml.utils.metrics import compute_regression_metrics

try:
    import catboost as cb
    HAS_CATBOOST = True
except ImportError:
    HAS_CATBOOST = False
    from sklearn.ensemble import ExtraTreesRegressor


class ContentQualityModel(BaseMLModel):
    """Predicts overall content quality score (0-100) using CatBoost."""

    def __init__(self):
        super().__init__("content_quality_model")
        if HAS_CATBOOST:
            self.model = cb.CatBoostRegressor(iterations=100, depth=6, learning_rate=0.08, verbose=0, random_seed=42)
        else:
            self.model = ExtraTreesRegressor(n_estimators=100, max_depth=8, random_state=42)

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
            flesch_ease = X_arr[:, 42] if X_arr.shape[1] > 42 else X_arr[:, 11]
            cov_score = X_arr[:, 54] if X_arr.shape[1] > 54 else 50.0

            base = (
                np.minimum(word_cnt / 20.0, 40.0) +
                (flesch_ease * 0.25) +
                (cov_score * 0.35)
            )
            preds = np.clip(base, 20.0, 96.0)

        return np.round(np.clip(preds, 0.0, 100.0), 1)

    def evaluate(self, X: np.ndarray, y: Sequence[float]) -> Dict[str, float]:
        preds = self.predict(X)
        return compute_regression_metrics(y, preds)
