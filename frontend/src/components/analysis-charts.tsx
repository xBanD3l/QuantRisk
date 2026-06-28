"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { AnalysisResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const tabs = [
  "Price",
  "Returns",
  "Monte Carlo",
  "VaR",
  "Volatility",
  "Drawdown",
  "Intervals",
  "Comparison",
  "Agreement"
] as const;

type ChartTab = (typeof tabs)[number];

export function AnalysisCharts({ analysis }: { analysis: AnalysisResponse }) {
  const [active, setActive] = useState<ChartTab>("Price");
  const chart = useMemo(() => buildChart(active, analysis), [active, analysis]);

  return (
    <section className="border-t border-line pt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text">Interactive Charts</h2>
          <p className="mt-1 text-sm text-muted">Model evidence and market context</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActive(tab)}
              className={cn(
                "h-8 rounded border border-line px-3 text-xs font-medium transition",
                active === tab ? "bg-teal text-ink" : "bg-panel text-muted hover:bg-panel2 hover:text-text"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-[420px] rounded-md border border-line bg-panel p-2 shadow-workstation">
        <Plot
          data={chart.data}
          layout={chart.layout}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%", height: "420px" }}
          useResizeHandler
        />
      </div>
    </section>
  );
}

function baseLayout(title: string) {
  return {
    title: { text: title, font: { color: "#f3f5f7", size: 14 } },
    paper_bgcolor: "#111418",
    plot_bgcolor: "#111418",
    font: { color: "#d6dce3", family: "Arial, sans-serif" },
    margin: { l: 54, r: 24, t: 54, b: 54 },
    hovermode: "x unified",
    xaxis: { gridcolor: "#242a31", zerolinecolor: "#303740" },
    yaxis: { gridcolor: "#242a31", zerolinecolor: "#303740" },
    legend: { orientation: "h", y: -0.18 },
    autosize: true
  };
}

function buildChart(active: ChartTab, analysis: AnalysisResponse) {
  const prices = analysis.metrics.price_history;
  const dates = prices.map((point) => point.date);

  if (active === "Price") {
    return {
      data: [
        {
          type: "scatter",
          mode: "lines",
          name: analysis.ticker,
          x: dates,
          y: prices.map((point) => point.close),
          line: { color: "#39d0b2", width: 2 }
        }
      ],
      layout: { ...baseLayout(`${analysis.ticker} price history`), yaxis: { ...baseLayout("").yaxis, tickprefix: "$" } }
    };
  }

  if (active === "Returns") {
    return {
      data: [
        {
          type: "histogram",
          name: "Daily returns",
          x: analysis.metrics.returns.map((value) => value * 100),
          marker: { color: "#39d0b2", line: { color: "#0d1014", width: 1 } },
          nbinsx: 60
        }
      ],
      layout: { ...baseLayout("Daily return distribution"), xaxis: { title: "Return (%)", gridcolor: "#242a31" } }
    };
  }

  if (active === "Monte Carlo") {
    const result = analysis.model_results.find((item) => item.model === "Monte Carlo");
    const pathData =
      result?.paths.slice(0, 45).map((path, index) => ({
        type: "scatter",
        mode: "lines",
        name: index === 0 ? "Simulated path" : "",
        showlegend: index === 0,
        x: path.map((_value, step) => step),
        y: path,
        line: { color: "rgba(57, 208, 178, 0.22)", width: 1 }
      })) ?? [];
    return {
      data: pathData,
      layout: { ...baseLayout("Monte Carlo simulated price paths"), xaxis: { title: "Forecast day", gridcolor: "#242a31" } }
    };
  }

  if (active === "VaR") {
    return {
      data: [
        {
          type: "bar",
          name: "95% VaR",
          x: analysis.model_results.map((item) => item.model),
          y: analysis.model_results.map((item) => item.var95 * 100),
          marker: { color: "#f16d7a" }
        },
        {
          type: "bar",
          name: "Expected Shortfall",
          x: analysis.model_results.map((item) => item.model),
          y: analysis.model_results.map((item) => item.expected_shortfall * 100),
          marker: { color: "#f4b860" }
        }
      ],
      layout: { ...baseLayout("Downside risk comparison"), barmode: "group", yaxis: { title: "Return (%)", gridcolor: "#242a31" } }
    };
  }

  if (active === "Volatility") {
    const vol = analysis.metrics.rolling_volatility;
    return {
      data: [
        {
          type: "scatter",
          mode: "lines",
          name: "30D realized volatility",
          x: vol.map((point) => point.date),
          y: vol.map((point) => point.value * 100),
          line: { color: "#f4b860", width: 2 }
        }
      ],
      layout: { ...baseLayout("Rolling volatility"), yaxis: { title: "Annualized volatility (%)", gridcolor: "#242a31" } }
    };
  }

  if (active === "Drawdown") {
    const drawdowns = analysis.metrics.drawdowns;
    return {
      data: [
        {
          type: "scatter",
          mode: "lines",
          fill: "tozeroy",
          name: "Drawdown",
          x: drawdowns.map((point) => point.date),
          y: drawdowns.map((point) => point.value * 100),
          line: { color: "#f16d7a", width: 2 },
          fillcolor: "rgba(241, 109, 122, 0.16)"
        }
      ],
      layout: { ...baseLayout("Drawdown history"), yaxis: { title: "Drawdown (%)", gridcolor: "#242a31" } }
    };
  }

  if (active === "Comparison") {
    return {
      data: [
        {
          type: "bar",
          name: "Expected Return",
          x: analysis.model_results.map((item) => item.model),
          y: analysis.model_results.map((item) => item.expected_return * 100),
          marker: { color: "#39d0b2" }
        },
        {
          type: "bar",
          name: "Probability Positive",
          x: analysis.model_results.map((item) => item.model),
          y: analysis.model_results.map((item) => item.prob_positive * 100),
          marker: { color: "#8f98a6" }
        }
      ],
      layout: { ...baseLayout("Model comparison"), barmode: "group", yaxis: { title: "Percent", gridcolor: "#242a31" } }
    };
  }

  if (active === "Agreement") {
    const metrics = analysis.consensus.metrics;
    const agreement = metrics?.committee_agreement_score ?? analysis.consensus.model_agreement_score;
    const confidence = metrics?.forecast_confidence ?? analysis.consensus.overall_confidence;
    const diversity = metrics?.model_diversity_score ?? 0;
    const stability = metrics?.prediction_stability ?? 0;
    return {
      data: [
        {
          type: "scatterpolar",
          r: [agreement * 100, confidence * 100, (1 - diversity) * 100, stability * 100],
          theta: ["Agreement", "Confidence", "Cohesion", "Stability"],
          fill: "toself",
          name: "Committee",
          marker: { color: "#39d0b2" },
          line: { color: "#39d0b2" }
        }
      ],
      layout: {
        ...baseLayout("Committee agreement radar"),
        polar: {
          bgcolor: "#111418",
          radialaxis: { visible: true, range: [0, 100], gridcolor: "#242a31", linecolor: "#303740" },
          angularaxis: { gridcolor: "#242a31", linecolor: "#303740" }
        }
      }
    };
  }

  return {
    data: [
      {
        type: "scatter",
        mode: "markers",
        name: "Expected return with 95% interval",
        x: analysis.model_results.map((item) => item.model),
        y: analysis.model_results.map((item) => item.expected_return * 100),
        marker: { color: "#39d0b2", size: 10 },
        error_y: {
          type: "data",
          symmetric: false,
          array: analysis.model_results.map((item) => (item.confidence_interval[1] - item.expected_return) * 100),
          arrayminus: analysis.model_results.map((item) => (item.expected_return - item.confidence_interval[0]) * 100),
          color: "#8f98a6",
          thickness: 1.4
        }
      }
    ],
    layout: { ...baseLayout("Model confidence intervals"), yaxis: { title: "Return (%)", gridcolor: "#242a31" } }
  };
}

