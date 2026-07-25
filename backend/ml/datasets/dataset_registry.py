"""
Qontint ML Infrastructure — Dataset Registry & Loader Framework
Scans backend/ml/datasets/ for CSV, JSON, and Parquet datasets, validates, cleans, and merges them automatically.
"""

import os
import json
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
import numpy as np

from ml.utils.logger import ml_logger
from ml.feature_engineering.extractor import FeatureExtractor

DATASETS_DIR = Path(__file__).resolve().parent

REQUIRED_METRIC_COLUMNS = [
    "rank_prediction",
    "novelty_score",
    "content_quality",
    "authority_score",
    "ctr_prediction",
    "search_intent",
    "topic_coverage",
    "semantic_similarity",
    "content_gap",
    "readability_score"
]


class DatasetRegistry:
    """
    Automatic Dataset Scanner & Validator for CSV, JSON, and Parquet files in backend/ml/datasets/
    """

    def __init__(self, datasets_dir: Optional[Path] = None):
        self.datasets_dir = datasets_dir or DATASETS_DIR

    def discover_datasets(self) -> Dict[str, Path]:
        """Scan datasets directory for .csv, .json, and .parquet files."""
        discovered = {}
        if not self.datasets_dir.exists():
            return discovered

        for file_path in self.datasets_dir.glob("*"):
            if file_path.suffix.lower() in [".csv", ".json", ".parquet"]:
                if file_path.name.startswith("self_learning"):
                    continue  # Self-learning dataset handled separately
                discovered[file_path.stem] = file_path

        ml_logger.info("Discovered %d real dataset file(s) in %s", len(discovered), self.datasets_dir)
        return discovered

    def load_dataset_file(self, file_path: Path) -> Optional[pd.DataFrame]:
        """Load a dataset file into pandas DataFrame based on file extension."""
        if not file_path.exists():
            return None

        ext = file_path.suffix.lower()
        try:
            if ext == ".csv":
                df = pd.read_csv(file_path)
            elif ext == ".json":
                df = pd.read_json(file_path)
            elif ext == ".parquet":
                df = pd.read_parquet(file_path)
            else:
                return None
            return df
        except Exception as exc:
            ml_logger.error("Failed to load dataset %s: %s", file_path, exc)
            return None

    def validate_and_clean_dataframe(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Validate DataFrame:
        - Check for required text/content or feature columns
        - Check missing target columns
        - Clean invalid / null rows
        """
        initial_rows = len(df)
        report = {
            "initial_rows": initial_rows,
            "missing_columns": [],
            "cleaned_rows": 0,
            "final_rows": 0
        }

        if df.empty:
            return df, report

        # Check required input columns (must have 'content' or 'article' or feature columns)
        text_col = None
        for col in ["content", "article", "text", "body"]:
            if col in df.columns:
                text_col = col
                break

        if text_col:
            # Clean empty text rows
            df = df.dropna(subset=[text_col])
            df = df[df[text_col].astype(str).str.strip() != ""]

        # Missing target columns check
        missing_targets = [c for c in REQUIRED_METRIC_COLUMNS if c not in df.columns]
        report["missing_columns"] = missing_targets

        if missing_targets:
            ml_logger.warning("Dataset missing target columns: %s (will use feature heuristics for missing targets)", missing_targets)

        report["final_rows"] = len(df)
        report["cleaned_rows"] = initial_rows - len(df)
        return df, report

    def load_all_and_merge(self) -> Tuple[np.ndarray, Dict[str, List[Any]]]:
        """
        Scans all dataset files, loads, cleans, merges, extracts feature vectors, and returns (X_matrix, targets_dict).
        Falls back to synthetic sample dataset generator if no real dataset files are placed in datasets_dir.
        """
        datasets = self.discover_datasets()
        dataframes = []

        for name, path in datasets.items():
            df = self.load_dataset_file(path)
            if df is not None and not df.empty:
                df_clean, report = self.validate_and_clean_dataframe(df)
                if not df_clean.empty:
                    dataframes.append(df_clean)

        if not dataframes:
            ml_logger.info("No real dataset files found in %s. Using sample_data testing generator.", self.datasets_dir)
            from ml.datasets.sample_data import generate_synthetic_dataset
            return generate_synthetic_dataset(num_samples=50)

        merged_df = pd.concat(dataframes, ignore_index=True)
        ml_logger.info("Merged %d dataset files with total %d rows.", len(dataframes), len(merged_df))

        X_list = []
        targets: Dict[str, List[Any]] = {k: [] for k in REQUIRED_METRIC_COLUMNS}

        text_col = next((c for c in ["content", "article", "text", "body"] if c in merged_df.columns), None)
        kw_col = next((c for c in ["keyword", "target_keyword", "query"] if c in merged_df.columns), None)

        for _, row in merged_df.iterrows():
            content_str = str(row[text_col]) if text_col and pd.notna(row[text_col]) else "<h1>Sample</h1><p>Sample content</p>"
            kw_str = str(row[kw_col]) if kw_col and pd.notna(row[kw_col]) else "SEO API"

            feats = FeatureExtractor.extract_features(content_str, kw_str)
            vec = FeatureExtractor.get_feature_vector(feats)
            X_list.append(vec)

            for target in REQUIRED_METRIC_COLUMNS:
                if target in merged_df.columns and pd.notna(row[target]):
                    val = row[target]
                    targets[target].append(val)
                else:
                    # Feature heuristic fallback target
                    if target == "search_intent":
                        targets[target].append("Informational")
                    elif target == "semantic_similarity":
                        targets[target].append(feats["semantic_similarity"])
                    elif target == "readability_score":
                        targets[target].append(feats["flesch_reading_ease"])
                    else:
                        targets[target].append(feats.get(target, 70.0))

        X_matrix = np.array(X_list, dtype=np.float32)
        return X_matrix, targets
