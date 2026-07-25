"""
Qontint ML Infrastructure — Base Model Interface
Defines the required abstract interface (train, predict, save, load, evaluate) for all 10 local ML models.
"""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, Optional, Sequence, Union, List
import numpy as np

from ml.utils.logger import ml_logger
from ml.utils.persistence import save_artifact, load_artifact


class BaseMLModel(ABC):
    """
    Abstract Base Class for all Qontint Local ML Models.
    Exposes train(), predict(), save(), load(), and evaluate().
    """

    def __init__(self, name: str):
        self.name = name
        self.is_trained = False
        self.model: Optional[Any] = None

    @abstractmethod
    def train(self, X: np.ndarray, y: Sequence[Any]) -> Dict[str, Any]:
        """Train model on feature matrix X and target y. Return training metrics."""
        pass

    @abstractmethod
    def predict(self, X: np.ndarray) -> Union[np.ndarray, List[Any]]:
        """Predict target output for feature matrix X."""
        pass

    @abstractmethod
    def evaluate(self, X: np.ndarray, y: Sequence[Any]) -> Dict[str, float]:
        """Evaluate model against test dataset X, y."""
        pass

    def save(self, model_dir: Optional[Path] = None) -> Optional[Path]:
        """Save model object to disk."""
        if not self.model or not self.is_trained:
            ml_logger.warning("Model %s is not trained, skipping save.", self.name)
            return None
        filename = f"{self.name}.joblib"
        return save_artifact(self.model, filename, model_dir)

    def load(self, model_dir: Optional[Path] = None) -> bool:
        """Load model object from disk."""
        filename = f"{self.name}.joblib"
        loaded = load_artifact(filename, model_dir)
        if loaded is not None:
            self.model = loaded
            self.is_trained = True
            ml_logger.info("Successfully loaded model %s from disk.", self.name)
            return True
        return False
