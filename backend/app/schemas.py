from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


ModelName = Literal[
    "Historical",
    "Monte Carlo",
    "GARCH",
    "Bayesian",
    "EWMA",
    "Bootstrap",
]


class AnalysisRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=16)
    horizon_days: int = Field(30, ge=1, le=365)
    models: list[ModelName] = Field(default_factory=lambda: [
        "Historical",
        "Monte Carlo",
        "GARCH",
        "Bayesian",
        "EWMA",
        "Bootstrap",
    ])
    ai_provider: Literal["local", "openai", "anthropic", "gemini"] = "local"
    api_key: str | None = None
    benchmark: str = "SPY"


class PricePoint(BaseModel):
    date: str
    close: float
    volume: int | None = None


class SeriesPoint(BaseModel):
    date: str
    value: float


class MarketMetrics(BaseModel):
    current_price: float
    returns: list[float]
    rolling_volatility: list[SeriesPoint]
    realized_volatility: float
    correlations: dict[str, float]
    drawdowns: list[SeriesPoint]
    price_history: list[PricePoint]


class ModelResult(BaseModel):
    model: str
    expected_return: float
    var95: float
    expected_shortfall: float
    prob_positive: float
    confidence_interval: list[float]
    assumptions: list[str]
    strengths: list[str]
    weaknesses: list[str]
    confidence_score: float
    reasoning: str
    distribution: list[float] = Field(default_factory=list)
    paths: list[list[float]] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CommitteeStatement(BaseModel):
    persona: str
    role: str
    model: str
    statement: str
    evidence: list[str]


class CommitteeDebate(BaseModel):
    agreements: list[str]
    disagreements: list[str]
    assumption_conflicts: list[str]
    outliers: list[str]
    uncertainty_sources: list[str]


class ConsensusReport(BaseModel):
    outlook: str
    consensus_direction: str
    agreement_level: str
    estimated_prob_positive: float
    var95: float
    expected_shortfall: float
    model_agreement_score: float
    overall_confidence: float
    key_risks: list[str]
    key_assumptions: list[str]
    executive_summary: str
    committee_debate: CommitteeDebate


class AnalysisResponse(BaseModel):
    analysis_id: str
    ticker: str
    horizon_days: int
    analysis_time: datetime
    current_price: float
    metrics: MarketMetrics
    model_results: list[ModelResult]
    committee: list[CommitteeStatement]
    consensus: ConsensusReport


class ExplainRequest(BaseModel):
    analysis_id: str
    question: str = Field(..., min_length=3, max_length=500)


class ExplainResponse(BaseModel):
    answer: str
    cited_models: list[str]


class ForecastPerformance(BaseModel):
    model: str
    forecasts: int
    realized: int
    pending: int
    var_exceedance_rate: float | None
    interval_hit_rate: float | None
    average_error: float | None

