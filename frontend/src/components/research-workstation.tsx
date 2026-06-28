"use client";

import { useMemo, useState } from "react";
import { Download, Loader2, Play, Search, TableProperties } from "lucide-react";
import dynamic from "next/dynamic";
import { useAuth } from "@/components/auth-provider";
import { EmptyStatePanel } from "@/components/empty-state-panel";
import { SectionReveal } from "@/components/section-reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { runResearchScan, API_BASE, trackEvent } from "@/lib/api";
import { formatUserError } from "@/lib/error-messages";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { trackUsage } from "@/lib/supabase/data";
import type { ResearchResponse } from "@/lib/types";
import { cn, formatPct, formatProb } from "@/lib/utils";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type SortKey = "expected_return" | "var95" | "prob_positive" | "agreement_score" | "confidence";

export function ResearchWorkstation() {
  const { user, accessToken } = useAuth();
  const supabase = useMemo(() => (isSupabaseConfigured() ? createClient() : null), []);
  const [watchlist, setWatchlist] = useState("dow30");
  const [horizon, setHorizon] = useState(30);
  const [customTickers, setCustomTickers] = useState("AAPL, MSFT, NVDA");
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("expected_return");
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    if (!result) return [];
    const query = filter.trim().toUpperCase();
    const rows = query ? result.rows.filter((row) => row.ticker.includes(query)) : result.rows;
    return [...rows].sort((a, b) => Number(b[sortKey]) - Number(a[sortKey]));
  }, [result, filter, sortKey]);

  async function handleScan() {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        watchlist: watchlist as "dow30" | "nasdaq100" | "etfs" | "custom",
        custom_tickers: watchlist === "custom" ? customTickers.split(",").map((item) => item.trim()).filter(Boolean) : [],
        horizon_days: horizon,
        confidence_level: 0.95
      };
      setResult(await runResearchScan(payload, accessToken));
      if (user && supabase) {
        void trackUsage(supabase, user.id, "research_scan", { watchlist });
        void trackEvent("research_scan", { watchlist }, accessToken);
      }
    } catch (err) {
      setError(formatUserError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 p-5 lg:p-8">
      <SectionReveal>
        <div className="rounded-2xl border border-line bg-panel p-6 shadow-workstation">
          <Badge className="border-teal/40 text-teal">Research Mode</Badge>
          <h1 className="mt-3 text-2xl font-semibold">Cross-sectional quant screening</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">
            Scan a watchlist with fast committee models, rank securities by return and risk, and identify disagreement and stability leaders.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[180px_180px_1fr_auto]">
            <Select value={watchlist} onChange={(event) => setWatchlist(event.target.value)}>
              <option value="dow30">Dow 30</option>
              <option value="nasdaq100">Nasdaq 100</option>
              <option value="etfs">Major ETFs</option>
              <option value="custom">Custom watchlist</option>
            </Select>
            <Select value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}>
              {[15, 30, 60, 90].map((value) => (
                <option key={value} value={value}>
                  {value} day horizon
                </option>
              ))}
            </Select>
            {watchlist === "custom" ? (
              <Input value={customTickers} onChange={(event) => setCustomTickers(event.target.value)} placeholder="AAPL, MSFT, NVDA" />
            ) : (
              <div className="flex items-center rounded-md border border-line bg-panel2 px-3 text-sm text-muted">
                Prebuilt institutional watchlist
              </div>
            )}
            <Button type="button" className="min-h-[44px] sm:col-span-2 xl:col-span-1" onClick={handleScan} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run Scan
            </Button>
          </div>
          {error ? <p className="mt-3 text-sm text-rose">{error}</p> : null}
        </div>
      </SectionReveal>

      {loading && !result ? (
        <SectionReveal delay={0.05}>
          <div className="rounded-2xl border border-line bg-panel p-6 shadow-workstation">
            <Skeleton className="mb-4 h-10 w-48" />
            <div className="space-y-3">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
            <p className="mt-4 text-sm text-muted">Scanning watchlist and ranking committee metrics…</p>
          </div>
        </SectionReveal>
      ) : null}

      {!loading && !result ? (
        <SectionReveal delay={0.05}>
          <EmptyStatePanel
            icon={TableProperties}
            title="Run a research scan"
            description="Choose a watchlist and horizon, then run a batch scan to rank expected return, VaR, agreement, and confidence across securities."
          />
        </SectionReveal>
      ) : null}

      {result ? (
        <>
          <SectionReveal delay={0.05}>
            <div className="grid gap-3 md:grid-cols-4">
              <SummaryCard label="Scanned" value={`${result.completed}/${result.scanned}`} />
              <SummaryCard label="Top Opportunities" value={result.summary.top_opportunities.slice(0, 3).join(", ") || "—"} />
              <SummaryCard label="Highest Risk" value={result.summary.highest_risk.slice(0, 3).join(", ") || "—"} />
              <SummaryCard label="Most Stable" value={result.summary.most_stable.slice(0, 3).join(", ") || "—"} />
            </div>
          </SectionReveal>

          <SectionReveal delay={0.1}>
            <div className="rounded-2xl border border-line bg-panel p-4 shadow-workstation">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
                  <Input className="pl-9" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter ticker" />
                </div>
                <Select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
                  <option value="expected_return">Sort by Expected Return</option>
                  <option value="var95">Sort by VaR</option>
                  <option value="prob_positive">Sort by Probability Positive</option>
                  <option value="agreement_score">Sort by Agreement</option>
                  <option value="confidence">Sort by Confidence</option>
                </Select>
                <Button type="button" variant="secondary" onClick={() => window.open(`${API_BASE}/api/research/scan`, "_blank")}>
                  <Download className="h-4 w-4" />
                  Export API
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-sm">
                  <thead className="bg-table-head text-xs uppercase text-muted">
                    <tr>
                      <th className="px-4 py-3 text-left">Ticker</th>
                      <th className="px-4 py-3 text-left">Expected Return</th>
                      <th className="px-4 py-3 text-left">VaR</th>
                      <th className="px-4 py-3 text-left">Expected Shortfall</th>
                      <th className="px-4 py-3 text-left">Prob Positive</th>
                      <th className="px-4 py-3 text-left">Agreement</th>
                      <th className="px-4 py-3 text-left">Confidence</th>
                      <th className="px-4 py-3 text-left">Outlook</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.ticker} className="border-t border-line">
                        <td className="px-4 py-3 font-medium">{row.ticker}</td>
                        <td className={cn("px-4 py-3", row.expected_return > 0 ? "text-teal" : "text-text")}>{formatPct(row.expected_return)}</td>
                        <td className="px-4 py-3 text-rose">{formatPct(row.var95)}</td>
                        <td className="px-4 py-3 text-rose">{formatPct(row.expected_shortfall)}</td>
                        <td className="px-4 py-3">{formatProb(row.prob_positive)}</td>
                        <td className="px-4 py-3">{formatProb(row.agreement_score)}</td>
                        <td className="px-4 py-3">{formatProb(row.confidence)}</td>
                        <td className="px-4 py-3">{row.outlook}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </SectionReveal>

          <SectionReveal delay={0.15}>
            <div className="rounded-2xl border border-line bg-panel p-3 shadow-workstation">
              <Plot
                data={[
                  {
                    type: "bar",
                    x: filteredRows.slice(0, 15).map((row) => row.ticker),
                    y: filteredRows.slice(0, 15).map((row) => row.expected_return * 100),
                    marker: { color: "#39d0b2" },
                    name: "Expected Return"
                  }
                ]}
                layout={{
                  title: { text: "Top expected returns", font: { color: "#f3f5f7", size: 14 } },
                  paper_bgcolor: "#111418",
                  plot_bgcolor: "#111418",
                  font: { color: "#d6dce3" },
                  margin: { l: 50, r: 20, t: 50, b: 50 },
                  yaxis: { title: "Return (%)" }
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%", height: "360px" }}
                useResizeHandler
              />
            </div>
          </SectionReveal>
        </>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}
