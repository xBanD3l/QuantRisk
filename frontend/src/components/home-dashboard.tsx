"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowRight, BrainCircuit, Star, TableProperties } from "lucide-react";
import { SectionReveal } from "@/components/section-reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchForecasts, fetchPerformance, fetchWorkspace } from "@/lib/api";
import type { ForecastPerformance, UserWorkspace } from "@/lib/types";
import { compactDate, formatProb } from "@/lib/utils";

export function HomeDashboard() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [forecasts, setForecasts] = useState<Array<{ analysis_id: string; ticker: string; analysis_time: string; horizon_days: number }>>([]);
  const [performance, setPerformance] = useState<ForecastPerformance[]>([]);
  const [workspace, setWorkspace] = useState<UserWorkspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [forecastRows, perfRows, workspaceData] = await Promise.all([
          fetchForecasts(userId),
          fetchPerformance(),
          userId ? fetchWorkspace(userId) : Promise.resolve(null)
        ]);
        setForecasts(forecastRows.slice(0, 6));
        setPerformance(perfRows);
        setWorkspace(workspaceData);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [userId]);

  return (
    <div className="space-y-8 p-5 lg:p-8">
      <SectionReveal>
        <div className="rounded-2xl border border-line bg-panel p-6 shadow-workstation lg:p-8">
          <Badge className="border-teal/40 text-teal">Phase 2 Research Workspace</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            {session?.user?.name ? `Welcome back, ${session.user.name.split(" ")[0]}` : "Quant Committee AI"}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
            Run independent quantitative models, convene the AI committee, compare risk metrics, and export institutional research — without fabricated numbers.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/workstation">
                <BrainCircuit className="h-4 w-4" aria-hidden="true" />
                New Analysis
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/research">
                <TableProperties className="h-4 w-4" aria-hidden="true" />
                Research Mode
              </Link>
            </Button>
          </div>
        </div>
      </SectionReveal>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionReveal delay={0.05}>
          <Panel title="Recent Analyses">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : forecasts.length ? (
              <ul className="space-y-2">
                {forecasts.map((item) => (
                  <li key={item.analysis_id} className="flex items-center justify-between rounded-lg border border-line bg-panel2 px-4 py-3">
                    <div>
                      <p className="font-medium">{item.ticker}</p>
                      <p className="text-xs text-muted">
                        {item.horizon_days}d horizon · {new Date(item.analysis_time).toLocaleString()}
                      </p>
                    </div>
                    <Link href={`/workstation?analysis=${item.analysis_id}`} className="text-xs text-teal hover:underline">
                      Continue
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No saved analyses yet. Run your first committee review from the workstation.</p>
            )}
          </Panel>
        </SectionReveal>

        <SectionReveal delay={0.1}>
          <Panel title="Forecast Accuracy">
            {loading ? (
              <Skeleton className="h-32" />
            ) : performance.length ? (
              <div className="space-y-2">
                {performance.slice(0, 4).map((row) => (
                  <div key={row.model} className="flex items-center justify-between rounded-lg border border-line bg-panel2 px-4 py-3 text-sm">
                    <span className="font-medium">{row.model}</span>
                    <span className="text-muted">
                      {row.realized}/{row.forecasts} realized · hit {row.interval_hit_rate === null ? "—" : formatProb(row.interval_hit_rate)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Performance metrics appear after forecasts mature and are calibrated.</p>
            )}
          </Panel>
        </SectionReveal>
      </div>

      {workspace?.favorites?.length ? (
        <SectionReveal delay={0.15}>
          <Panel title="Favorite Tickers">
            <div className="flex flex-wrap gap-2">
              {workspace.favorites.map((ticker) => (
                <Link key={ticker} href={`/workstation?ticker=${ticker}`} className="inline-flex items-center gap-1 rounded-full border border-line bg-panel2 px-3 py-1 text-sm">
                  <Star className="h-3.5 w-3.5 text-amber" aria-hidden="true" />
                  {ticker}
                </Link>
              ))}
            </div>
          </Panel>
        </SectionReveal>
      ) : null}

      {workspace?.recent_searches?.length ? (
        <SectionReveal delay={0.18}>
          <Panel title="Recent Searches">
            <div className="flex flex-wrap gap-2">
              {workspace.recent_searches.map((ticker) => (
                <Link key={ticker} href={`/workstation?ticker=${ticker}`} className="rounded-md border border-line bg-panel2 px-3 py-1.5 text-sm hover:border-teal/40">
                  {ticker}
                </Link>
              ))}
            </div>
          </Panel>
        </SectionReveal>
      ) : null}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5 shadow-workstation">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />
      </div>
      {children}
    </section>
  );
}
