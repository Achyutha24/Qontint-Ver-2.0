"""
Qontint ML Infrastructure — Model Persistence Utility
Handles saving, loading, versioning, and directory management for ML models.
"""

import os
import json
import joblib
from pathlib import Path
from typing import Any, Dict, Optional
from ml.utils.logger import ml_logger

DEFAULT_MODEL_DIR = Path(__file__).resolve().parent.parent / "saved_models"


def ensure_directory(path: Path) -> Path:
    """Ensure target directory exists."""
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_artifact(obj: Any, filename: str, model_dir: Optional[Path] = None) -> Path:
    """Save an arbitrary python object using joblib."""
    target_dir = ensure_directory(model_dir or DEFAULT_MODEL_DIR)
    file_path = target_dir / filename
    joblib.dump(obj, file_path)
    ml_logger.info("Saved ML artifact to %s", file_path)
    return file_path


def load_artifact(filename: str, model_dir: Optional[Path] = None) -> Optional[Any]:
    """Load a python object using joblib if exists."""
    target_dir = model_dir or DEFAULT_MODEL_DIR
    file_path = target_dir / filename
    if not file_path.exists():
        ml_logger.warning("Artifact file not found: %s", file_path)
        return None
    try:
        obj = joblib.load(file_path)
        ml_logger.info("Loaded ML artifact from %s", file_path)
        return obj
    except Exception as exc:
        ml_logger.error("Failed to load artifact %s: %s", file_path, exc)
        return None


def save_metadata(metadata: Dict[str, Any], filename: str = "metadata.json", model_dir: Optional[Path] = None) -> Path:
    """Save metadata JSON file."""
    target_dir = ensure_directory(model_dir or DEFAULT_MODEL_DIR)
    file_path = target_dir / filename
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    return file_path


def load_metadata(filename: str = "metadata.json", model_dir: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    """Load metadata JSON file."""
    target_dir = model_dir or DEFAULT_MODEL_DIR
    file_path = target_dir / filename
    if not file_path.exists():
        return None
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None
