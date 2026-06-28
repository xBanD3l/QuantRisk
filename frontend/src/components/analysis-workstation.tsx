"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  Activity,
  BarChart3,
  BrainCircuit,
  ChevronDown,
  Download,
  FileText,
  Loader2,
  Play,
  RefreshCcw,
  ShieldCheck,
  SlidersHorizontal,
  TableProperties,
  Plus,
  Trash2
} from "lucide-react";
import { AnalysisCharts } from "@/components/analysis-charts";
import { PortfolioPanel } from "@/components/portfolio-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { askExplainability, calibrateForecasts, fetchPerformance, reportUrl, runPortfolioAnalysis, streamAnalysis, trackEvent } from "@/lib/api";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { saveAnalysis, savePortfolio, saveReport, trackUsage } from "@/lib/supabase/data";
import type {
  AIProvider,
  AnalysisResponse,
  ForecastPerformance,
  ModelName,
  ModelResult,
  PortfolioHolding,
  PortfolioResponse
} from "@/lib/types";
import { cn, compactDate, formatPct, formatPrice, formatProb } from "@/lib/utils";

const modelOptions: ModelName[] = ["Historical", "Monte Carlo", "GARCH", "Bayesian", "EWMA", "Bootstrap"];
const horizonOptions = [15, 30, 60, 90, 180, 365];
const confidenceOptions = [0.9, 0.95, 0.99];
type WorkstationMode = "single" | "portfolio";
type SortKey = "model" | "expected_return" | "var95" | "expected_shortfall" | "prob_positive" | "confidence_score";

export function AnalysisWorkstation() {
  const { user, accessToken } = useAuth();
  const supabase = useMemo(() => (isSupabaseConfigured() ? createClient() : null), []);
  const [mode, setMode] = useState<WorkstationMode>("single");
  const [ticker, setTicker] = useState("AAPL");
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([
    { ticker: "AAPL", weight: 0.5 },
    { ticker: "MSFT", weight: 0.5 }
  ]);
  const [horizon, setHorizon] = useState(30);
  const [confidenceLevel, setConfidenceLevel] = useState(0.95);
  const [selectedModels, setSelectedModels] = useState<ModelName[]>(modelOptions);
  const [provider, setProvider] = useState<AIProvider>("local");
  const [apiKey, setApiKey] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [performance, setPerformance] = useState<ForecastPerformance[]>([]);
  const [loading, setLoading] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pipelineStep, setPipelineStep] = useState<string | null>(null);
  const [pipelineIndex, setPipelineIndex] = useState(-1);
  const [streamingModels, setStreamingModels] = useState<ModelResult[]>([]);
  const [completedModels, setCompletedModels] = useState<string[]>([]);

  useEffect(() => {
    void refreshPerformance(setPerformance);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPortfolio(null);
    setAnalysis(null);
    setStreamingModels([]);
    setCompletedModels([]);
    setPipelineStep(null);
    setPipelineIndex(-1);

    if (mode === "portfolio") {
      const validHoldings = holdings.filter((holding) => holding.ticker.trim());
      if (validHoldings.length < 1) {
        setError("Add at least one portfolio holding.");
        return;
      }
      setLoading(true);
      try {
        const result = await runPortfolioAnalysis(
          {
            holdings: validHoldings.map((holding) => ({
              ticker: holding.ticker.trim().toUpperCase(),
              weight: holding.weight
            })),
            horizon_days: horizon,
            confidence_level: confidenceLevel
          },
          accessToken
        );
        setPortfolio(result);
        if (user && supabase) {
          const label = validHoldings.map((h) => h.ticker.trim().toUpperCase()).join(", ");
          void savePortfolio(supabase, user.id, `Portfolio · ${label}`, result);
          void trackUsage(supabase, user.id, "portfolio_created", { holdings: validHoldings.length });
          void trackEvent("portfolio_saved", { holdings: validHoldings.length }, accessToken);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Portfolio analysis failed.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!selectedModels.length) {
      setError("Select at least one quantitative model.");
      return;
    }
    setLoading(true);
    try {
      await streamAnalysis(
        {
          ticker: ticker.trim().toUpperCase(),
          horizon_days: horizon,
          confidence_level: confidenceLevel,
          models: selectedModels,
          ai_provider: provider,
          api_key: provider === "local" ? undefined : apiKey || undefined,
          benchmark: "SPY"
        },
        {
          onPipeline: ({ step, index }) => {
            setPipelineStep(step);
            setPipelineIndex(index);
          },
          onModel: (result) => {
            setStreamingModels((current) => [...current, result]);
            setCompletedModels((current) => [...current, result.model]);
          },
          onComplete: (result) => {
            setAnalysis(result);
            void refreshPerformance(setPerformance);
            if (user && supabase) {
              void saveAnalysis(supabase, user.id, result);
              void saveReport(supabase, user.id, result);
              void trackUsage(supabase, user.id, "analysis_run", { ticker: result.ticker, horizon: result.horizon_days });
              void trackEvent("analysis_saved", { ticker: result.ticker }, accessToken);
            }
          },
          onError: (message) => setError(message)
        },
        accessToken
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCalibrate() {
    setCalibrating(true);
    try {
      await calibrateForecasts();
      await refreshPerformance(setPerformance);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calibration failed.");
    } finally {
      setCalibrating(false);
    }
  }

  function toggleModel(model: ModelName) {
    setSelectedModels((current) =>
      current.includes(model) ? current.filter((item) => item !== model) : [...current, model]
    );
  }

  function updateHolding(index: number, field: keyof PortfolioHolding, value: string) {
    setHoldings((current) =>
      current.map((holding, holdingIndex) =>
        holdingIndex === index
          ? {
              ...holding,
              [field]: field === "weight" ? Number(value) : value
            }
          : holding
      )
    );
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      {!user ? (
        <div className="border-b border-line bg-teal/5 px-5 py-3 text-sm text-muted lg:px-6">
          Sign in to save your analyses and access them from any device.
        </div>
      ) : null}
      <div className="grid lg:grid-cols-[360px_1fr]">
        <aside className="border-b border-line bg-surface p-5 lg:min-h-[calc(100vh-57px)] lg:border-b-0 lg:border-r">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-2 rounded-md border border-line bg-panel p-1">
              <button
                type="button"
                className={cn(
                  "rounded px-3 py-2 text-xs font-semibold",
                  mode === "single" ? "bg-teal text-ink" : "text-muted hover:text-text"
                )}
                onClick={() => setMode("single")}
              >
                Single Asset
              </button>
              <button
                type="button"
                className={cn(
                  "rounded px-3 py-2 text-xs font-semibold",
                  mode === "portfolio" ? "bg-teal text-ink" : "text-muted hover:text-text"
                )}
                onClick={() => setMode("portfolio")}
              >
                Portfolio
              </button>
            </div>

            {mode === "single" ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted" htmlFor="ticker">
                  Ticker
                </label>
                <Input
                  id="ticker"
                  value={ticker}
                  onChange={(event) => setTicker(event.target.value)}
                  placeholder="AAPL"
                  autoCapitalize="characters"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase text-muted">Holdings</label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setHoldings((current) => [...current, { ticker: "", weight: 0.1 }])}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {holdings.map((holding, index) => (
                    <div key={`${index}-${holding.ticker}`} className="grid grid-cols-[1fr_88px_32px] gap-2">
                      <Input
                        value={holding.ticker}
                        onChange={(event) => updateHolding(index, "ticker", event.target.value)}
                        placeholder="Ticker"
                      />
                      <Input
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={holding.weight}
                        onChange={(event) => updateHolding(index, "weight", event.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setHoldings((current) => current.filter((_, holdingIndex) => holdingIndex !== index))}
                        disabled={holdings.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted" htmlFor="horizon">
                Forecast Horizon
              </label>
              <Select id="horizon" value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}>
                {horizonOptions.map((value) => (
                  <option key={value} value={value}>
                    {value} trading days
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted" htmlFor="confidence">
                Confidence Level
              </label>
              <Select
                id="confidence"
                value={confidenceLevel}
                onChange={(event) => setConfidenceLevel(Number(event.target.value))}
              >
                {confidenceOptions.map((value) => (
                  <option key={value} value={value}>
                    {Math.round(value * 100)}% VaR / interval
                  </option>
                ))}
              </Select>
            </div>

            {mode === "single" ? (
              <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase text-muted">Models</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedModels(selectedModels.length === modelOptions.length ? [] : modelOptions)}
                >
                  <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Toggle
                </Button>
              </div>
              <div className="grid gap-3 rounded-md border border-line bg-panel p-3">
                {modelOptions.map((model) => (
                  <Checkbox
                    key={model}
                    label={model}
                    checked={selectedModels.includes(model)}
                    onChange={() => toggleModel(model)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted" htmlFor="provider">
                AI Provider
              </label>
              <Select id="provider" value={provider} onChange={(event) => setProvider(event.target.value as AIProvider)}>
                <option value="local">Local deterministic committee</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Google Gemini</option>
              </Select>
            </div>

            {provider !== "local" ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted" htmlFor="api-key">
                  User API Key
                </label>
                <Input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="Stored only for this request"
                />
              </div>
            ) : null}
              </>
            ) : null}

            {error ? <div className="rounded-md border border-rose/50 bg-rose/10 p-3 text-sm text-rose">{error}</div> : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
              {mode === "portfolio" ? "Run Portfolio Analysis" : "Run Analysis"}
            </Button>
          </form>

          {mode === "single" ? (
            <PipelinePanel
              loading={loading}
              pipelineStep={pipelineStep}
              pipelineIndex={pipelineIndex}
              completedModels={completedModels}
              selectedModels={selectedModels}
            />
          ) : null}
        </aside>

        <section className="space-y-8 p-5 lg:p-7">
          {portfolio ? (
            <>
              <PortfolioPanel result={portfolio} />
              <PerformancePanel performance={performance} onCalibrate={handleCalibrate} calibrating={calibrating} />
            </>
          ) : analysis ? (
            <Dashboard analysis={analysis} performance={performance} onCalibrate={handleCalibrate} calibrating={calibrating} />
          ) : loading && streamingModels.length > 0 ? (
            <StreamingDashboard models={streamingModels} pipelineStep={pipelineStep} />
          ) : (
            <EmptyState loading={loading} mode={mode} />
          )}
        </section>
      </div>
    </div>
  );
}

function Dashboard({
  analysis,
  performance,
  onCalibrate,
  calibrating,
  showCommittee = true
}: {
  analysis: AnalysisResponse;
  performance: ForecastPerformance[];
  onCalibrate: () => void;
  calibrating: boolean;
  showCommittee?: boolean;
}) {
  return (
    <>
      <Overview analysis={analysis} />
      <RegimeView analysis={analysis} />
      <HistoricalAnalogsView analysis={analysis} />
      <ModelComparison results={analysis.model_results} />
      <ModelCards results={analysis.model_results} />
      <AnalysisCharts analysis={analysis} />
      {showCommittee ? (
        <>
          <CommitteeView analysis={analysis} />
          <ConsensusView analysis={analysis} />
          <ExplainabilityPanel analysis={analysis} />
        </>
      ) : null}
      <PerformancePanel performance={performance} onCalibrate={onCalibrate} calibrating={calibrating} />
    </>
  );
}

function StreamingDashboard({ models, pipelineStep }: { models: ModelResult[]; pipelineStep: string | null }) {
  return (
    <section className="space-y-6">
      <div className="rounded-md border border-line bg-panel p-5">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-teal" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold">Analysis in progress</h2>
            <p className="text-sm text-muted">{pipelineStep ?? "Running quantitative models..."}</p>
          </div>
        </div>
      </div>
      <ModelComparison results={models} />
      <ModelCards results={models} />
    </section>
  );
}

function Overview({ analysis }: { analysis: AnalysisResponse }) {
  return (
    <section className="border-b border-line pb-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-teal">Overview</p>
          <h2 className="mt-1 text-2xl font-semibold">{analysis.ticker} Quant Committee</h2>
        </div>
        <Button type="button" variant="secondary" onClick={() => window.open(reportUrl(analysis.analysis_id), "_blank", "noopener,noreferrer")}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Export Report
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Current Price" value={formatPrice(analysis.current_price)} />
        <MetricTile label="Forecast Horizon" value={`${analysis.horizon_days} trading days`} />
        <MetricTile label="Confidence Level" value={`${Math.round(analysis.confidence_level * 100)}%`} />
        <MetricTile label="Realized Volatility" value={formatPct(analysis.metrics.realized_volatility)} />
        <MetricTile label="Analysis Time" value={new Date(analysis.analysis_time).toLocaleString()} />
      </div>
    </section>
  );
}

function RegimeView({ analysis }: { analysis: AnalysisResponse }) {
  const regime = analysis.market_regime;
  if (!regime) {
    return null;
  }
  return (
    <section className="border-b border-line pb-6">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-teal" aria-hidden="true" />
        <h2 className="text-base font-semibold">Market Regime</h2>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-md border border-line bg-panel p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge className="border-teal/40 text-teal">{regime.label}</Badge>
            <Badge>{regime.volatility_regime}</Badge>
            <Badge>Score {formatProb(regime.score)}</Badge>
          </div>
          <p className="text-sm leading-6 text-[#d6dce3]">{regime.description}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <MetricTile label="Momentum" value={formatPct(regime.momentum)} compact />
          <MetricTile label="Vol Factor" value={regime.factors.volatility.toFixed(2)} compact />
          <MetricTile label="Correlation" value={regime.factors.correlation.toFixed(2)} compact />
        </div>
      </div>
    </section>
  );
}

function ConsensusView({ analysis }: { analysis: AnalysisResponse }) {
  const consensus = analysis.consensus;
  const metrics = consensus.metrics;
  return (
    <section className="border-b border-line pb-6">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-teal" aria-hidden="true" />
        <h2 className="text-base font-semibold">Lead Quant Consensus</h2>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-md border border-line bg-panel p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge className="border-teal/40 text-teal">{consensus.outlook}</Badge>
            <Badge>{consensus.agreement_level} Agreement</Badge>
            {metrics ? <Badge className="border-rose/40 text-rose">{metrics.tail_risk_rating} Tail Risk</Badge> : null}
          </div>
          <p className="text-sm leading-6 text-[#d6dce3]">{consensus.executive_summary}</p>
          {metrics ? (
            <div className="mt-4 grid gap-2 text-xs text-muted">
              <p>
                Most optimistic: <span className="text-text">{metrics.most_optimistic_model}</span> · Most conservative:{" "}
                <span className="text-text">{metrics.most_conservative_model}</span>
              </p>
              <p>Key disagreement: {metrics.most_influential_disagreement}</p>
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MetricTile label="Probability Positive" value={formatProb(consensus.estimated_prob_positive)} />
          <MetricTile label="VaR" value={formatPct(consensus.var95)} tone="risk" />
          <MetricTile label="Expected Shortfall" value={formatPct(consensus.expected_shortfall)} tone="risk" />
          <MetricTile label="Overall Confidence" value={formatProb(consensus.overall_confidence)} />
        </div>
      </div>
      {metrics ? <ConsensusMetricsPanel metrics={metrics} /> : null}
    </section>
  );
}

function ConsensusMetricsPanel({ metrics }: { metrics: NonNullable<AnalysisResponse["consensus"]["metrics"]> }) {
  const tiles = [
    ["Committee Agreement", formatProb(metrics.committee_agreement_score)],
    ["Forecast Confidence", formatProb(metrics.forecast_confidence)],
    ["Model Diversity", formatProb(metrics.model_diversity_score)],
    ["Prediction Stability", formatProb(metrics.prediction_stability)],
    ["Volatility Regime", metrics.volatility_regime],
    ["Tail Risk Rating", metrics.tail_risk_rating]
  ] as const;

  return (
    <div className="mt-4 rounded-md border border-line bg-panel p-4">
      <h3 className="mb-3 text-sm font-semibold">Consensus Metrics</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map(([label, value]) => (
          <MetricTile key={label} label={label} value={value} compact />
        ))}
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-semibold uppercase text-muted">How scores are computed</summary>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-[#d6dce3]">
          {Object.entries(metrics.computation_notes).map(([key, note]) => (
            <li key={key}>
              <span className="font-medium text-text">{key.replaceAll("_", " ")}:</span> {note}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function HistoricalAnalogsView({ analysis }: { analysis: AnalysisResponse }) {
  if (!analysis.historical_analogs.length) {
    return null;
  }

  return (
    <section className="border-b border-line pb-6">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-teal" aria-hidden="true" />
        <h2 className="text-base font-semibold">Historical Analog Engine</h2>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {analysis.historical_analogs.map((analog) => (
          <article key={`${analog.start_date}-${analog.end_date}`} className="rounded-md border border-line bg-panel p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="border-teal/40 text-teal">{formatProb(analog.similarity_score)} similar</Badge>
              <Badge>
                {compactDate(analog.start_date)} → {compactDate(analog.end_date)}
              </Badge>
            </div>
            <p className="text-sm leading-6 text-[#d6dce3]">{analog.narrative}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MetricTile label="Afterward Return" value={formatPct(analog.subsequent_return)} compact />
              <MetricTile label="Afterward Vol" value={formatPct(analog.subsequent_volatility)} compact />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ModelComparison({ results }: { results: ModelResult[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("confidence_score");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      const left = sortableValue(a, sortKey);
      const right = sortableValue(b, sortKey);
      if (typeof left === "string" && typeof right === "string") {
        return direction === "asc" ? left.localeCompare(right) : right.localeCompare(left);
      }
      return direction === "asc" ? Number(left) - Number(right) : Number(right) - Number(left);
    });
  }, [results, sortKey, direction]);

  function updateSort(key: SortKey) {
    if (sortKey === key) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDirection(key === "var95" || key === "expected_shortfall" ? "asc" : "desc");
    }
  }

  return (
    <section className="border-b border-line pb-6">
      <div className="mb-4 flex items-center gap-2">
        <TableProperties className="h-5 w-5 text-teal" aria-hidden="true" />
        <h2 className="text-base font-semibold">Model Comparison Table</h2>
      </div>
      <div className="overflow-hidden rounded-md border border-line bg-panel">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead className="bg-[#0d1014] text-xs uppercase text-muted">
              <tr>
                <SortableHeader label="Model" sortKey="model" active={sortKey} direction={direction} onClick={updateSort} />
                <SortableHeader label="Expected Return" sortKey="expected_return" active={sortKey} direction={direction} onClick={updateSort} />
                <SortableHeader label="VaR" sortKey="var95" active={sortKey} direction={direction} onClick={updateSort} />
                <SortableHeader label="Expected Shortfall" sortKey="expected_shortfall" active={sortKey} direction={direction} onClick={updateSort} />
                <SortableHeader label="Probability Positive" sortKey="prob_positive" active={sortKey} direction={direction} onClick={updateSort} />
                <SortableHeader label="Confidence" sortKey="confidence_score" active={sortKey} direction={direction} onClick={updateSort} />
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((result) => (
                <tr key={result.model} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{result.model}</td>
                  <MetricCell value={result.expected_return} />
                  <MetricCell value={result.var95} risk />
                  <MetricCell value={result.expected_shortfall} risk />
                  <td className="px-4 py-3">{formatProb(result.prob_positive)}</td>
                  <td className="px-4 py-3">{formatProb(result.confidence_score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ModelCards({ results }: { results: ModelResult[] }) {
  return (
    <section className="border-b border-line pb-6">
      <div className="mb-4 flex items-center gap-2">
        <SlidersHorizontal className="h-5 w-5 text-teal" aria-hidden="true" />
        <h2 className="text-base font-semibold">Individual Model Analyses</h2>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {results.map((result) => (
          <details key={result.model} className="group rounded-md border border-line bg-panel open:bg-panel2">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
              <div>
                <h3 className="font-semibold">{result.model}</h3>
                <p className="mt-1 text-sm text-muted">{result.reasoning}</p>
              </div>
              <ChevronDown className="h-5 w-5 shrink-0 text-muted transition group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="border-t border-line p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricTile label="Expected Return" value={formatPct(result.expected_return)} compact />
                <MetricTile label="VaR" value={formatPct(result.var95)} tone="risk" compact />
                <MetricTile label="Expected Shortfall" value={formatPct(result.expected_shortfall)} tone="risk" compact />
                <MetricTile label="Probability Positive" value={formatProb(result.prob_positive)} compact />
              </div>
              <ModelList title="Assumptions" items={result.assumptions} />
              <ModelList title="Strengths" items={result.strengths} />
              <ModelList title="Weaknesses" items={result.weaknesses} />
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function CommitteeView({ analysis }: { analysis: AnalysisResponse }) {
  const debate = analysis.consensus.committee_debate;
  return (
    <section className="border-t border-line pt-6">
      <div className="mb-4 flex items-center gap-2">
        <BrainCircuit className="h-5 w-5 text-teal" aria-hidden="true" />
        <h2 className="text-base font-semibold">Quant Committee</h2>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {analysis.committee.map((statement) => (
          <article key={`${statement.persona}-${statement.model}`} className="rounded-md border border-line bg-panel p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="border-teal/40 text-teal">{statement.persona}</Badge>
              <Badge>{statement.role}</Badge>
              <Badge>{statement.model}</Badge>
            </div>
            <p className="text-sm leading-6 text-[#d6dce3]">{statement.statement}</p>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <DebatePanel title="Agreements" items={debate.agreements} />
        <DebatePanel title="Disagreements" items={debate.disagreements} />
        <DebatePanel title="Assumption Conflicts" items={debate.assumption_conflicts} />
        <DebatePanel title="Uncertainty Sources" items={debate.uncertainty_sources} />
      </div>
    </section>
  );
}

function ExplainabilityPanel({ analysis }: { analysis: AnalysisResponse }) {
  const [question, setQuestion] = useState("Why is VaR high?");
  const [answer, setAnswer] = useState<string | null>(null);
  const [cited, setCited] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleAsk() {
    setLoading(true);
    try {
      const result = await askExplainability(analysis.analysis_id, question);
      setAnswer(result.answer);
      setCited(result.cited_models);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border-t border-line pt-6">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-teal" aria-hidden="true" />
        <h2 className="text-base font-semibold">AI Explainability</h2>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-md border border-line bg-panel p-4">
          <Textarea value={question} onChange={(event) => setQuestion(event.target.value)} />
          <Button type="button" className="mt-3 w-full" onClick={handleAsk} disabled={loading || !question.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <BrainCircuit className="h-4 w-4" aria-hidden="true" />}
            Ask Committee
          </Button>
        </div>
        <div className="rounded-md border border-line bg-panel p-4">
          {answer ? (
            <>
              <p className="text-sm leading-6 text-[#d6dce3]">{answer}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {cited.map((model) => (
                  <Badge key={model}>{model}</Badge>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Grounded answers appear here after a question is submitted.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function PerformancePanel({
  performance,
  onCalibrate,
  calibrating
}: {
  performance: ForecastPerformance[];
  onCalibrate: () => void;
  calibrating: boolean;
}) {
  return (
    <section className="border-t border-line pt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-teal" aria-hidden="true" />
          <h2 className="text-base font-semibold">Model Performance Tracker</h2>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={onCalibrate} disabled={calibrating}>
          {calibrating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCcw className="h-4 w-4" aria-hidden="true" />}
          Calibrate Forecasts
        </Button>
      </div>
      <div className="overflow-hidden rounded-md border border-line bg-panel">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead className="bg-[#0d1014] text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3 text-left">Model</th>
              <th className="px-4 py-3 text-left">Forecasts</th>
              <th className="px-4 py-3 text-left">Realized</th>
              <th className="px-4 py-3 text-left">Pending</th>
              <th className="px-4 py-3 text-left">VaR Exceedance</th>
              <th className="px-4 py-3 text-left">Interval Hit Rate</th>
              <th className="px-4 py-3 text-left">Avg Error</th>
            </tr>
          </thead>
          <tbody>
            {performance.length ? (
              performance.map((row) => (
                <tr key={row.model} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{row.model}</td>
                  <td className="px-4 py-3">{row.forecasts}</td>
                  <td className="px-4 py-3">{row.realized}</td>
                  <td className="px-4 py-3">{row.pending}</td>
                  <td className="px-4 py-3">{row.var_exceedance_rate === null ? "Pending" : formatProb(row.var_exceedance_rate)}</td>
                  <td className="px-4 py-3">{row.interval_hit_rate === null ? "Pending" : formatProb(row.interval_hit_rate)}</td>
                  <td className="px-4 py-3">{row.average_error === null ? "Pending" : formatPct(row.average_error)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-5 text-muted" colSpan={7}>
                  No stored forecasts yet. Run an analysis, wait for the horizon to mature, then calibrate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PipelinePanel({
  loading,
  pipelineStep,
  pipelineIndex,
  completedModels,
  selectedModels
}: {
  loading: boolean;
  pipelineStep: string | null;
  pipelineIndex: number;
  completedModels: string[];
  selectedModels: ModelName[];
}) {
  const modelSteps = selectedModels.map((model) => `Running ${model}...`);
  const steps = [
    "Downloading Market Data...",
    "Calculating Returns...",
    "Detecting Market Regime...",
    "Finding Historical Analogs...",
    ...modelSteps,
    "Comparing Results...",
    "Convening Quant Committee...",
    "Generating Research Report..."
  ];

  return (
    <div className="mt-6 rounded-md border border-line bg-panel p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <FileText className="h-4 w-4 text-teal" aria-hidden="true" />
        Analysis Pipeline
      </div>
      {pipelineStep ? <p className="mb-3 text-xs text-teal">{pipelineStep}</p> : null}
      <div className="space-y-3">
        {steps.map((step, index) => {
          const modelName = step.replace("Running ", "").replace("...", "");
          const isModelStep = step.startsWith("Running ");
          const isComplete =
            (!loading && pipelineIndex >= steps.length - 1) ||
            index < pipelineIndex ||
            (isModelStep && completedModels.includes(modelName));
          const isActive = loading && (pipelineStep === step || (pipelineStep?.includes(modelName) && isModelStep));

          return (
            <div key={step} className="flex items-center gap-3 text-sm">
              <span
                className={cn(
                  "grid h-6 w-6 place-items-center rounded border text-xs",
                  isComplete ? "border-teal bg-teal/10 text-teal" : isActive ? "border-teal/40 text-teal" : "border-line text-muted"
                )}
              >
                {isComplete ? "✓" : index + 1}
              </span>
              <span className={isComplete || isActive ? "text-text" : "text-muted"}>{step.replace("...", "")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ loading, mode }: { loading: boolean; mode: WorkstationMode }) {
  return (
    <section className="grid min-h-[620px] place-items-center rounded-md border border-line bg-panel p-8 text-center">
      <div className="max-w-xl">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-md border border-line bg-[#0d1014]">
          {loading ? <Loader2 className="h-7 w-7 animate-spin text-teal" aria-hidden="true" /> : <BrainCircuit className="h-7 w-7 text-teal" aria-hidden="true" />}
        </div>
        <h2 className="text-2xl font-semibold">Quantitative evidence before conclusions</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          {mode === "portfolio"
            ? "Enter weighted holdings to compute portfolio VaR, expected shortfall, marginal risk, and correlation structure."
            : "Run a ticker through the committee to populate model distributions, risk metrics, chart evidence, AI synthesis, and report export."}
        </p>
      </div>
    </section>
  );
}

function MetricTile({
  label,
  value,
  tone,
  compact
}: {
  label: string;
  value: string;
  tone?: "risk";
  compact?: boolean;
}) {
  return (
    <div className={cn("rounded-md border border-line bg-panel p-4", compact && "p-3")}>
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className={cn("mt-2 break-words font-semibold", compact ? "text-lg" : "text-xl", tone === "risk" ? "text-rose" : "text-text")}>
        {value}
      </p>
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  active,
  direction,
  onClick
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  direction: "asc" | "desc";
  onClick: (key: SortKey) => void;
}) {
  return (
    <th className="px-4 py-3 text-left">
      <button type="button" className="inline-flex items-center gap-1 hover:text-text" onClick={() => onClick(sortKey)}>
        {label}
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition", active === sortKey && direction === "asc" && "rotate-180")}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}

function MetricCell({ value, risk }: { value: number; risk?: boolean }) {
  return <td className={cn("px-4 py-3", risk ? "text-rose" : value > 0 ? "text-teal" : "text-text")}>{formatPct(value)}</td>;
}

function ModelList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-semibold uppercase text-muted">{title}</p>
      <ul className="space-y-2 text-sm text-[#d6dce3]">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DebatePanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-line bg-panel p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <ul className="space-y-2 text-sm leading-6 text-[#d6dce3]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function sortableValue(result: ModelResult, key: SortKey) {
  if (key === "model") {
    return result.model;
  }
  return result[key];
}

async function refreshPerformance(setter: (rows: ForecastPerformance[]) => void) {
  try {
    setter(await fetchPerformance());
  } catch {
    setter([]);
  }
}

