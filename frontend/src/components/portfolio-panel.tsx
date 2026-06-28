"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { PortfolioResponse } from "@/lib/types";
import { formatPct, formatProb } from "@/lib/utils";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export function PortfolioPanel({ result }: { result: PortfolioResponse }) {
  const heatmap = useMemo(
    () => ({
      data: [
        {
          type: "heatmap",
          z: result.correlation_matrix,
          x: result.tickers,
          y: result.tickers,
          colorscale: [[0, "#111418"], [0.5, "#39d0b2"], [1, "#f4b860"]],
          showscale: true
        }
      ],
      layout: {
        title: { text: "Portfolio correlation matrix", font: { color: "#f3f5f7", size: 14 } },
        paper_bgcolor: "#111418",
        plot_bgcolor: "#111418",
        font: { color: "#d6dce3" },
        margin: { l: 70, r: 24, t: 54, b: 70 },
        autosize: true
      }
    }),
    [result]
  );

  return (
    <div className="space-y-8">
      <section className="border-b border-line pb-6">
        <h2 className="text-2xl font-semibold">Portfolio Risk Analysis</h2>
        <p className="mt-2 text-sm text-muted">
          {result.holdings.map((holding) => `${holding.ticker} ${(holding.weight * 100).toFixed(0)}%`).join(" · ")} over{" "}
          {result.horizon_days} trading days at {Math.round(result.confidence_level * 100)}% confidence.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Expected Return" value={formatPct(result.expected_return)} />
          <MetricTile label="Portfolio VaR" value={formatPct(result.var95)} risk />
          <MetricTile label="Expected Shortfall" value={formatPct(result.expected_shortfall)} risk />
          <MetricTile label="Probability Positive" value={formatProb(result.prob_positive)} />
          <MetricTile label="Diversification Benefit" value={formatPct(result.diversification_benefit)} />
        </div>
      </section>

      <section className="border-b border-line pb-6">
        <h3 className="mb-4 text-base font-semibold">Risk Decomposition</h3>
        <div className="overflow-hidden rounded-md border border-line bg-panel">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-[#0d1014] text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3 text-left">Ticker</th>
                <th className="px-4 py-3 text-left">Weight</th>
                <th className="px-4 py-3 text-left">Marginal VaR</th>
                <th className="px-4 py-3 text-left">Component VaR</th>
                <th className="px-4 py-3 text-left">Risk Contribution</th>
              </tr>
            </thead>
            <tbody>
              {result.components.map((row) => (
                <tr key={row.ticker} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{row.ticker}</td>
                  <td className="px-4 py-3">{formatProb(row.weight)}</td>
                  <td className="px-4 py-3 text-rose">{formatPct(row.marginal_var)}</td>
                  <td className="px-4 py-3 text-rose">{formatPct(row.component_var)}</td>
                  <td className="px-4 py-3">{formatProb(row.risk_contribution)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="min-h-[380px] rounded-md border border-line bg-panel p-2">
          <Plot
            data={heatmap.data}
            layout={heatmap.layout}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%", height: "380px" }}
            useResizeHandler
          />
        </div>
      </section>
    </div>
  );
}

function MetricTile({ label, value, risk }: { label: string; value: string; risk?: boolean }) {
  return (
    <div className="rounded-md border border-line bg-panel p-4">
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${risk ? "text-rose" : "text-text"}`}>{value}</p>
    </div>
  );
}
