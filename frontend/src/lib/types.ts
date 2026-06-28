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
}

export interface AnalysisResponse {
  analysis_id: string;
  ticker: string;
  horizon_days: number;
  analysis_time: string;
  current_price: number;
  metrics: MarketMetrics;
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

