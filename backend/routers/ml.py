"""
Qontint ML API Router — Standalone Endpoints for Local Machine Learning Models.
Do NOT modify existing endpoints. All ML prediction endpoints are hosted here independently.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

from ml.inference.service import MLInferenceService
from ml.training.pipeline import MLTrainingPipeline
from ml.feature_engineering.extractor import FeatureExtractor

router = APIRouter(prefix="/api/v1/ml", tags=["Local Machine Learning Models"])


# ── Request / Response Schemas ────────────────────────────────────────────────

class MLPredictRequest(BaseModel):
    keyword: str = Field(..., example="b2b content marketing strategy", description="Target search keyword")
    content: str = Field(..., example="<h1>B2B Content Strategy</h1><p>Detailed guide...</p>", description="Content text or HTML")


class MLTrainRequest(BaseModel):
    num_samples: Optional[int] = Field(60, ge=10, le=500, description="Number of synthetic/training samples to train on")
    version: Optional[str] = Field("v1.0.0-local", description="Model version tag")


# ── API Endpoints ─────────────────────────────────────────────────────────────

@router.post(
    "/predict",
    summary="Run Local ML Predictions",
    description="Runs predictions across 10 local ML models (Rank, Novelty, Quality, Authority, CTR, Intent, Topic Coverage, Semantic Similarity, Content Gap, Readability) without calling external Gemini APIs."
)
async def predict_ml(req: MLPredictRequest):
    try:
        service = MLInferenceService.get_instance()
        predictions = service.predict(content=req.content, keyword=req.keyword)
        return predictions
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"ML Prediction failed: {str(exc)}")


@router.post(
    "/train",
    summary="Train Local ML Models",
    description="Triggers training pipeline to train all 10 local ML models on feature vectors and save artifacts to disk."
)
async def train_ml(req: MLTrainRequest, background_tasks: BackgroundTasks):
    try:
        def run_train():
            pipeline = MLTrainingPipeline(version=req.version or "v1.0.0-local")
            pipeline.run_training_pipeline(num_samples=req.num_samples or 60)

        background_tasks.add_task(run_train)

        return {
            "status": "training_started",
            "message": f"Training pipeline scheduled for {req.num_samples} samples.",
            "version": req.version
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"ML Training initiation failed: {str(exc)}")


@router.get(
    "/status",
    summary="ML System Status",
    description="Returns status of loaded local ML models and model version."
)
async def status_ml():
    try:
        service = MLInferenceService.get_instance()
        return {
            "status": "ready" if service.is_initialized else "uninitialized",
            "model_version": service.version,
            "models_loaded": {
                name: model.is_trained for name, model in service.models.items()
            },
            "total_models": len(service.models)
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"ML Status check failed: {str(exc)}")


@router.post(
    "/extract-features",
    summary="Extract Content Feature Vector",
    description="Returns raw numerical features and entity breakdown extracted from content."
)
async def extract_features_ml(req: MLPredictRequest):
    try:
        features = FeatureExtractor.extract_features(req.content, req.keyword)
        return {
            "keyword": req.keyword,
            "features": features
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Feature extraction failed: {str(exc)}")
