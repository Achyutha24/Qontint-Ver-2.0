"""
Readability Score Model — Predicts standardized readability score (0-100) using Random Forest Regressor on readability metrics.
"""

from typing import Any, Dict, Sequence
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from ml.models.base import BaseMLModel
from ml.utils.metrics import compute_regression_metrics


class ReadabilityScoreModel(BaseMLModel):
    """Predicts standardized readability score (0-100) using Random Forest on Flesch, FKGL, Gunning Fog, SMOG, Coleman-Liau, and ARI."""

    def __init__(self):
        super().__init__("readability_score_model")
        self.model = RandomForestRegressor(n_estimators=100, max_depth=8, random_state=42)

    def train(self, X: np.ndarray, y: Sequence[float]) -> Dict[str, Any]:
        X_arr = np.atleast_2d(X)
        y_arr = np.array(y, dtype=np.float32)
        # Extract 6 readability features: indices 42 to 47
        if X_arr.shape[1] >= 48:
            X_read = X_arr[:, 42:48]
        else:
            X_read = X_arr
        self.model.fit(X_read, y_arr)
        self.is_trained = True
        preds = self.model.predict(X_read)
        return compute_regression_metrics(y_arr, preds)

    def predict(self, X: np.ndarray) -> np.ndarray:
        X_arr = np.atleast_2d(X)
        if X_arr.shape[1] >= 48:
            X_read = X_arr[:, 42:48]
        else:
            X_read = X_arr

        if self.is_trained and self.model is not None:
            preds = self.model.predict(X_read)
        else:
            fre = X_arr[:, 42] if X_arr.shape[1] > 42 else X_arr[:, 11] if X_arr.shape[1] > 11 else 50.0
            fkgl = X_arr[:, 43] if X_arr.shape[1] > 43 else 9.0
            ari = X_arr[:, 47] if X_arr.shape[1] > 47 else 9.0

            score = (fre * 0.6) + (max(0.0, 15.0 - fkgl) * 1.5) + (max(0.0, 15.0 - ari) * 1.0)
            preds = np.clip(score, 10.0, 98.0)

        return np.round(np.clip(preds, 0.0, 100.0), 1)

    def evaluate(self, X: np.ndarray, y: Sequence[float]) -> Dict[str, float]:
        preds = self.predict(X)
        return compute_regression_metrics(y, preds)
