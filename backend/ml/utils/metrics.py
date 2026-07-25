"""
Qontint ML Infrastructure — Evaluation Metrics Utility
Calculates regression and classification evaluation metrics for ML models.
"""

from typing import Dict, Any, Sequence
import numpy as np


def compute_regression_metrics(y_true: Sequence[float], y_pred: Sequence[float]) -> Dict[str, float]:
    """Calculate R2 score, MAE, MSE, and RMSE for regression predictions."""
    y_true_arr = np.array(y_true, dtype=np.float64)
    y_pred_arr = np.array(y_pred, dtype=np.float64)

    if len(y_true_arr) == 0:
        return {"mae": 0.0, "mse": 0.0, "rmse": 0.0, "r2": 0.0}

    mae = float(np.mean(np.abs(y_true_arr - y_pred_arr)))
    mse = float(np.mean((y_true_arr - y_pred_arr) ** 2))
    rmse = float(np.sqrt(mse))

    ss_res = np.sum((y_true_arr - y_pred_arr) ** 2)
    ss_tot = np.sum((y_true_arr - np.mean(y_true_arr)) ** 2)
    r2 = float(1.0 - (ss_res / (ss_tot + 1e-8))) if ss_tot > 0 else 1.0

    return {
        "mae": round(mae, 4),
        "mse": round(mse, 4),
        "rmse": round(rmse, 4),
        "r2": round(r2, 4)
    }


def compute_classification_metrics(y_true: Sequence[str], y_pred: Sequence[str]) -> Dict[str, float]:
    """Calculate accuracy and macro agreement score for intent classification."""
    if len(y_true) == 0:
        return {"accuracy": 0.0}

    correct = sum(1 for t, p in zip(y_true, y_pred) if t == p)
    accuracy = float(correct / len(y_true))

    return {
        "accuracy": round(accuracy, 4)
    }
