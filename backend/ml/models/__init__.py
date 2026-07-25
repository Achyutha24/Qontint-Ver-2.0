from ml.models.base import BaseMLModel
from ml.models.rank_prediction import RankPredictionModel
from ml.models.novelty_score import NoveltyScoreModel
from ml.models.content_quality import ContentQualityModel
from ml.models.authority_score import AuthorityScoreModel
from ml.models.ctr_prediction import CTRPredictionModel
from ml.models.search_intent import SearchIntentModel
from ml.models.topic_coverage import TopicCoverageModel
from ml.models.semantic_similarity import SemanticSimilarityModel
from ml.models.content_gap import ContentGapModel
from ml.models.readability_score import ReadabilityScoreModel

ALL_MODELS = {
    "rank_prediction": RankPredictionModel,
    "novelty_score": NoveltyScoreModel,
    "content_quality": ContentQualityModel,
    "authority_score": AuthorityScoreModel,
    "ctr_prediction": CTRPredictionModel,
    "search_intent": SearchIntentModel,
    "topic_coverage": TopicCoverageModel,
    "semantic_similarity": SemanticSimilarityModel,
    "content_gap": ContentGapModel,
    "readability_score": ReadabilityScoreModel,
}

__all__ = [
    "BaseMLModel",
    "RankPredictionModel",
    "NoveltyScoreModel",
    "ContentQualityModel",
    "AuthorityScoreModel",
    "CTRPredictionModel",
    "SearchIntentModel",
    "TopicCoverageModel",
    "SemanticSimilarityModel",
    "ContentGapModel",
    "ReadabilityScoreModel",
    "ALL_MODELS",
]
