export type ModelName =
  | "Historical"
  | "Monte Carlo"
  | "GARCH"
  | "Bayesian"
  | "EWMA"
  | "Bootstrap";

export type AIProvider = "local" | "openai" | "anthropic" | "gemini";

export interface AnalysisRequest {
  ticker: string;
  horizon_days: number;
  confidence_level?: number;
  models: ModelName[];
  ai_provider: AIProvider;
  api_key?: string;
  benchmark?: string;
}

export interface PricePoint {
  date: string;
  close: number;
  volume?: number | null;
}

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface MarketRegime {
  label: string;
  score: number;
  volatility_regime: string;
  momentum: number;
  description: string;
  factors: Record<string, number>;
}

export interface HistoricalAnalog {
  start_date: string;
  end_date: string;
  similarity_score: number;
  volatility: number;
  momentum: number;
  subsequent_return: number;
  subsequent_volatility: number;
  price_history: PricePoint[];
  narrative: string;
}

export interface ConsensusMetrics {
  committee_agreement_score: number;
  forecast_confidence: number;
  tail_risk_rating: string;
  model_diversity_score: number;
  volatility_regime: string;
  prediction_stability: number;
  most_optimistic_model: string;
  most_conservative_model: string;
  most_influential_disagreement: string;
  computation_notes: Record<string, string>;
}

export interface ModelMethodology {
  model: string;
  purpose: string;
  assumptions: string[];
  equations: string[];
  strengths: string[];
  weaknesses: string[];
  complexity: string;
  references: string[];
}

export interface MarketMetrics {
  current_price: number;
  returns: number[];
  rolling_volatility: SeriesPoint[];
  realized_volatility: number;
  correlations: Record<string, number>;
  drawdowns: SeriesPoint[];
  price_history: PricePoint[];
}

export interface ModelResult {
  model: ModelName | string;
  expected_return: number;
  var95: number;
  expected_shortfall: number;
  prob_positive: number;
  confidence_interval: number[];
  assumptions: string[];
  strengths: string[];
  weaknesses: string[];
  confidence_score: number;
  reasoning: string;
  distribution: number[];
  paths: number[][];
  metadata: Record<string, number | string>;
}

export interface CommitteeStatement {
  persona: string;
  role: string;
  model: string;
  statement: string;
  evidence: string[];
}

export interface CommitteeDebate {
  agreements: string[];
  disagreements: string[];
  assumption_conflicts: string[];
  outliers: string[];
  uncertainty_sources: string[];
}

export interface ConsensusReport {
  outlook: string;
  consensus_direction: string;
  agreement_level: string;
  estimated_prob_positive: number;
  var95: number;
  expected_shortfall: number;
  model_agreement_score: number;
  overall_confidence: number;
  key_risks: string[];
  key_assumptions: string[];
  executive_summary: string;
  committee_debate: CommitteeDebate;
  metrics?: ConsensusMetrics;
}

export interface AnalysisResponse {
  analysis_id: string;
  ticker: string;
  horizon_days: number;
  confidence_level: number;
  analysis_time: string;
  current_price: number;
  metrics: MarketMetrics;
  market_regime: MarketRegime | null;
  historical_analogs: HistoricalAnalog[];
  model_results: ModelResult[];
  committee: CommitteeStatement[];
  consensus: ConsensusReport;
}

export interface ExplainResponse {
  answer: string;
  cited_models: string[];
}

export interface ForecastPerformance {
  model: string;
  forecasts: number;
  realized: number;
  pending: number;
  var_exceedance_rate: number | null;
  interval_hit_rate: number | null;
  average_error: number | null;
}

export interface PortfolioHolding {
  ticker: string;
  weight: number;
}

export interface PortfolioRequest {
  holdings: PortfolioHolding[];
  horizon_days: number;
  confidence_level?: number;
}

export interface PortfolioRiskComponent {
  ticker: string;
  weight: number;
  marginal_var: number;
  component_var: number;
  risk_contribution: number;
}

export interface PortfolioResponse {
  holdings: PortfolioHolding[];
  horizon_days: number;
  confidence_level: number;
  expected_return: number;
  var95: number;
  expected_shortfall: number;
  prob_positive: number;
  confidence_interval: number[];
  correlation_matrix: number[][];
  tickers: string[];
  components: PortfolioRiskComponent[];
  diversification_benefit: number;
  distribution: number[];
}

export interface CalibrationSummary {
  records: number;
  evaluated: number;
  updated: number;
  pending: number;
}

export interface ResearchRow {
  ticker: string;
  expected_return: number;
  var95: number;
  expected_shortfall: number;
  prob_positive: number;
  agreement_score: number;
  confidence: number;
  outlook: string;
  dispersion: number;
}

export interface ResearchSummary {
  top_opportunities: string[];
  highest_risk: string[];
  largest_disagreements: string[];
  most_stable: string[];
}

export interface ResearchRequest {
  watchlist: "dow30" | "nasdaq100" | "etfs" | "custom";
  custom_tickers?: string[];
  horizon_days: number;
  confidence_level?: number;
  max_tickers?: number;
}

export interface ResearchResponse {
  watchlist: string;
  horizon_days: number;
  scanned: number;
  completed: number;
  models: ModelName[];
  rows: ResearchRow[];
  summary: ResearchSummary;
}

export interface SavedItem {
  item_id: string;
  item_type: "analysis" | "portfolio" | "research" | "favorite";
  title: string;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserWorkspace {
  user_id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  recent_searches: string[];
  favorites: string[];
  saved_items: SavedItem[];
}

export type StreamHandlers = {
  onPipeline?: (payload: { step: string; index: number; total?: number; model?: string }) => void;
  onModel?: (result: ModelResult) => void;
  onMetrics?: (metrics: MarketMetrics) => void;
  onRegime?: (regime: MarketRegime) => void;
  onAnalogs?: (analogs: HistoricalAnalog[]) => void;
  onConsensus?: (consensus: ConsensusReport) => void;
  onCommittee?: (statement: CommitteeStatement) => void;
  onComplete?: (analysis: AnalysisResponse) => void;
  onError?: (message: string) => void;
};

