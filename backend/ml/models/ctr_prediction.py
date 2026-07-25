"""
CTR Prediction Model — Predicts Click-Through Rate score (0-100) using LightGBM Regressor.
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


class CTRPredictionModel(BaseMLModel):
    """Predicts expected organic search Click-Through Rate score (0-100) using LightGBM."""

    def __init__(self):
        super().__init__("ctr_prediction_model")
        if HAS_LGB:
            self.model = lgb.LGBMRegressor(n_estimators=100, learning_rate=0.06, max_depth=5, random_state=42)
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
            kw_placement = X_arr[:, 27] if X_arr.shape[1] > 27 else 50.0
            sem_sim = X_arr[:, 55] if X_arr.shape[1] > 55 else 0.8
            title_len = X_arr[:, 59] if X_arr.shape[1] > 59 else 55.0

            title_score = 30.0 if (40.0 <= title_len <= 65.0) else 15.0
            base = (sem_sim * 40.0) + (kw_placement * 0.3) + title_score
            preds = np.clip(base, 10.0, 92.0)

        return np.round(np.clip(preds, 0.0, 100.0), 1)

    def evaluate(self, X: np.ndarray, y: Sequence[float]) -> Dict[str, float]:
        preds = self.predict(X)
        return compute_regression_metrics(y, preds)
