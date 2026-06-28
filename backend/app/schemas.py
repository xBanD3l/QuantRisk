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
    confidence_level: float = Field(0.95, ge=0.90, le=0.99)
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


class MarketRegime(BaseModel):
    label: str
    score: float
    volatility_regime: str
    momentum: float
    description: str
    factors: dict[str, float]


class HistoricalAnalog(BaseModel):
    start_date: str
    end_date: str
    similarity_score: float
    volatility: float
    momentum: float
    subsequent_return: float
    subsequent_volatility: float
    price_history: list[PricePoint]
    narrative: str


class ModelMethodology(BaseModel):
    model: str
    purpose: str
    assumptions: list[str]
    equations: list[str]
    strengths: list[str]
    weaknesses: list[str]
    complexity: str
    references: list[str]


class ConsensusMetrics(BaseModel):
    committee_agreement_score: float
    forecast_confidence: float
    tail_risk_rating: str
    model_diversity_score: float
    volatility_regime: str
    prediction_stability: float
    most_optimistic_model: str
    most_conservative_model: str
    most_influential_disagreement: str
    computation_notes: dict[str, str]


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
    metrics: ConsensusMetrics | None = None


class AnalysisResponse(BaseModel):
    analysis_id: str
    ticker: str
    horizon_days: int
    confidence_level: float = 0.95
    analysis_time: datetime
    current_price: float
    metrics: MarketMetrics
    market_regime: MarketRegime | None = None
    historical_analogs: list[HistoricalAnalog] = Field(default_factory=list)
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


class PortfolioHolding(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=16)
    weight: float = Field(..., ge=0.0, le=1.0)


class PortfolioRequest(BaseModel):
    holdings: list[PortfolioHolding] = Field(..., min_length=1, max_length=12)
    horizon_days: int = Field(30, ge=1, le=365)
    confidence_level: float = Field(0.95, ge=0.90, le=0.99)


class PortfolioRiskComponent(BaseModel):
    ticker: str
    weight: float
    marginal_var: float
    component_var: float
    risk_contribution: float


class PortfolioResponse(BaseModel):
    holdings: list[PortfolioHolding]
    horizon_days: int
    confidence_level: float
    expected_return: float
    var95: float
    expected_shortfall: float
    prob_positive: float
    confidence_interval: list[float]
    correlation_matrix: list[list[float]]
    tickers: list[str]
    components: list[PortfolioRiskComponent]
    diversification_benefit: float
    distribution: list[float] = Field(default_factory=list)


class CalibrationSummary(BaseModel):
    records: int
    evaluated: int
    updated: int
    pending: int


class ResearchRow(BaseModel):
    ticker: str
    expected_return: float
    var95: float
    expected_shortfall: float
    prob_positive: float
    agreement_score: float
    confidence: float
    outlook: str
    dispersion: float


class ResearchSummary(BaseModel):
    top_opportunities: list[str]
    highest_risk: list[str]
    largest_disagreements: list[str]
    most_stable: list[str]


class ResearchRequest(BaseModel):
    watchlist: Literal["dow30", "nasdaq100", "etfs", "custom"] = "dow30"
    custom_tickers: list[str] = Field(default_factory=list)
    horizon_days: int = Field(30, ge=1, le=365)
    confidence_level: float = Field(0.95, ge=0.90, le=0.99)
    models: list[ModelName] | None = None
    max_tickers: int | None = Field(None, ge=1, le=200)


class ResearchResponse(BaseModel):
    watchlist: str
    horizon_days: int
    scanned: int
    completed: int
    models: list[ModelName]
    rows: list[ResearchRow]
    summary: ResearchSummary


class AnalyticsEvent(BaseModel):
    event: str
    metadata: dict[str, str | int | float] = Field(default_factory=dict)


class SavedItem(BaseModel):
    item_id: str
    item_type: Literal["analysis", "portfolio", "research", "favorite"]
    title: str
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class UserWorkspace(BaseModel):
    user_id: str
    name: str | None = None
    email: str | None = None
    image: str | None = None
    recent_searches: list[str] = Field(default_factory=list)
    favorites: list[str] = Field(default_factory=list)
    saved_items: list[SavedItem] = Field(default_factory=list)


class SaveItemRequest(BaseModel):
    item_type: Literal["analysis", "portfolio", "research", "favorite"]
    title: str = Field(..., min_length=1, max_length=200)
    payload: dict[str, Any] = Field(default_factory=dict)

