"""
Authority Score Model — Predicts topical and domain authority score (0-100) using XGBoost Regressor.
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


class AuthorityScoreModel(BaseMLModel):
    """Predicts topical authority score (0-100) using XGBoost."""

    def __init__(self):
        super().__init__("authority_score_model")
        if HAS_XGB:
            self.model = xgb.XGBRegressor(n_estimators=100, max_depth=5, learning_rate=0.08, random_state=42)
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
            entity_cnt = X_arr[:, 34] if X_arr.shape[1] > 34 else 10.0
            ext_links = X_arr[:, 57] if X_arr.shape[1] > 57 else 2.0
            outbound_proxy = X_arr[:, 118] if X_arr.shape[1] > 118 else 20.0

            base = (outbound_proxy * 0.5) + np.minimum(entity_cnt * 2.0, 30.0) + np.minimum(ext_links * 4.0, 20.0)
            preds = np.clip(base, 10.0, 95.0)

        return np.round(np.clip(preds, 0.0, 100.0), 1)

    def evaluate(self, X: np.ndarray, y: Sequence[float]) -> Dict[str, float]:
        preds = self.predict(X)
        return compute_regression_metrics(y, preds)
