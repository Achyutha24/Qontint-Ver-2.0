"""
Novelty Score Model — Predicts content novelty/uniqueness score (0-100) using LightGBM Regressor.
"""

from typing import Any, Dict, Sequence
import numpy as np
from ml.models.base import BaseMLModel
from ml.utils.metrics import compute_regression_metrics

try:
    import lightgbm as lgb
    HAS_LGB = True
except ImportError:
    HAS_LGB = False
    from sklearn.ensemble import HistGradientBoostingRegressor


class NoveltyScoreModel(BaseMLModel):
    """Predicts content novelty and unique angles score (0-100) using LightGBM."""

    def __init__(self):
        super().__init__("novelty_score_model")
        if HAS_LGB:
            self.model = lgb.LGBMRegressor(n_estimators=100, learning_rate=0.05, max_depth=5, random_state=42)
        else:
            self.model = HistGradientBoostingRegressor(max_iter=100, max_depth=5, random_state=42)

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
            unique_words = X_arr[:, 8] if X_arr.shape[1] > 8 else X_arr[:, 0]
            entity_cnt = X_arr[:, 34] if X_arr.shape[1] > 34 else 5.0

            ratio = unique_words / np.maximum(1.0, word_cnt)
            base = (ratio * 65.0) + np.minimum(entity_cnt * 1.5, 25.0) + 10.0
            preds = np.clip(base, 15.0, 95.0)

        return np.round(np.clip(preds, 0.0, 100.0), 1)

    def evaluate(self, X: np.ndarray, y: Sequence[float]) -> Dict[str, float]:
        preds = self.predict(X)
        return compute_regression_metrics(y, preds)
