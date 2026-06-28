"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BrainCircuit, Download, FileText, FolderKanban, Star, TableProperties } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { EmptyStatePanel } from "@/components/empty-state-panel";
import { SectionReveal } from "@/components/section-reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchForecasts, fetchPerformance } from "@/lib/api";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchDashboardData, type DashboardData } from "@/lib/supabase/data";
import type { ForecastPerformance } from "@/lib/types";
import { cn, formatProb } from "@/lib/utils";

export function HomeDashboard() {
  const { user, profile, accessToken, loading: authLoading, signInWithGoogle } = useAuth();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const supabase = useMemo(() => (isSupabaseConfigured() ? createClient() : null), []);

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [forecasts, setForecasts] = useState<Array<{ analysis_id: string; ticker: string; analysis_time: string; horizon_days: number }>>([]);
  const [performance, setPerformance] = useState<ForecastPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  const firstName = (profile?.full_name ?? user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "")
    .split(" ")[0];

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (user && supabase) {
          const [dashboardData, forecastRows, perfRows] = await Promise.all([
            fetchDashboardData(supabase, user.id),
            fetchForecasts(accessToken),
            fetchPerformance()
          ]);
          setDashboard(dashboardData);
          setForecasts(forecastRows.slice(0, 6));
          setPerformance(perfRows);
        } else {
          const perfRows = await fetchPerformance();
          setDashboard(null);
          setForecasts([]);
          setPerformance(perfRows);
        }
      } finally {
        setLoading(false);
      }
    }
    if (!authLoading) {
      void load();
    }
  }, [user, accessToken, authLoading, supabase]);

  if (authLoading) {
    return (
      <div className="space-y-8 p-5 lg:p-8">
        <Skeleton className="h-48 rounded-2xl" />
        <div className="grid gap-6 xl:grid-cols-2">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <GuestLanding onSignIn={() => void signInWithGoogle()} performance={performance} loading={loading} />;
  }

  const showAnalyses = !tab || tab === "analyses";
  const showPortfolios = !tab || tab === "portfolios";
  const showReports = !tab || tab === "reports";

  return (
    <div className="space-y-8 p-5 lg:p-8">
      <SectionReveal>
        <div className="rounded-2xl border border-line bg-panel p-6 shadow-workstation lg:p-8">
          <Badge className="border-teal/40 text-teal">Your Workspace</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
            Your analyses, portfolios, and reports are synced to your account and available from any device.
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

      <div className="flex flex-wrap gap-2">
        {[
          { key: "analyses", label: "Analyses" },
          { key: "portfolios", label: "Portfolios" },
          { key: "reports", label: "Reports" }
        ].map((item) => (
          <Link
            key={item.key}
            href={item.key === "analyses" ? "/" : `/?tab=${item.key}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              (tab === item.key || (!tab && item.key === "analyses")) && item.key !== "all"
                ? "border-teal/40 bg-teal/10 text-teal"
                : tab === item.key
                  ? "border-teal/40 bg-teal/10 text-teal"
                  : "border-line text-muted hover:border-teal/30"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {showAnalyses ? (
          <SectionReveal delay={0.05}>
            <Panel title="Recent Analyses" icon={BrainCircuit}>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-14" />
                  <Skeleton className="h-14" />
                </div>
              ) : dashboard?.analyses.length ? (
                <ul className="space-y-2">
                  {dashboard.analyses.map((item) => (
                    <li key={item.id} className="flex items-center justify-between rounded-lg border border-line bg-panel2 px-4 py-3">
                      <div>
                        <p className="font-medium">{item.ticker}</p>
                        <p className="text-xs text-muted">
                          {item.horizon}d horizon · {new Date(item.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Link
                        href={item.analysis_id ? `/workstation?analysis=${item.analysis_id}` : "/workstation"}
                        className="text-xs text-teal hover:underline"
                      >
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyStatePanel
                  icon={BrainCircuit}
                  title="No saved analyses yet"
                  description="Run your first analysis to begin building your research history. Completed runs are saved automatically when you are signed in."
                  actionLabel="Run first analysis"
                  actionHref="/workstation"
                />
              )}
            </Panel>
          </SectionReveal>
        ) : null}

        {showPortfolios ? (
          <SectionReveal delay={0.08}>
            <Panel title="Saved Portfolios" icon={FolderKanban}>
              {loading ? (
                <Skeleton className="h-32" />
              ) : dashboard?.portfolios.length ? (
                <ul className="space-y-2">
                  {dashboard.portfolios.map((item) => (
                    <li key={item.id} className="rounded-lg border border-line bg-panel2 px-4 py-3">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted">{new Date(item.created_at).toLocaleString()}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyStatePanel
                  icon={FolderKanban}
                  title="No saved portfolios yet"
                  description="Portfolio analyses you run while signed in appear here automatically."
                  actionLabel="Analyze a portfolio"
                  actionHref="/workstation?mode=portfolio"
                />
              )}
            </Panel>
          </SectionReveal>
        ) : null}

        {showReports ? (
          <SectionReveal delay={0.1}>
            <Panel title="Recently Generated Reports" icon={FileText}>
              {loading ? (
                <Skeleton className="h-32" />
              ) : dashboard?.reports.length ? (
                <ul className="space-y-2">
                  {dashboard.reports.map((item) => (
                    <li key={item.id} className="flex items-center justify-between rounded-lg border border-line bg-panel2 px-4 py-3">
                      <div>
                        <p className="font-medium">{item.ticker ?? "Report"}</p>
                        <p className="text-xs text-muted">{new Date(item.created_at).toLocaleString()}</p>
                      </div>
                      <a href={item.report_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-teal hover:underline">
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        PDF
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyStatePanel
                  icon={FileText}
                  title="No reports yet"
                  description="Reports are saved automatically after each completed analysis when you are signed in."
                  actionLabel="Generate a report"
                  actionHref="/workstation"
                />
              )}
            </Panel>
          </SectionReveal>
        ) : null}

        {!tab || tab === "analyses" ? (
          <SectionReveal delay={0.12}>
            <Panel title="Forecast History" icon={Star}>
              {loading ? (
                <Skeleton className="h-32" />
              ) : forecasts.length ? (
                <ul className="space-y-2">
                  {forecasts.map((item) => (
                    <li key={item.analysis_id} className="flex items-center justify-between rounded-lg border border-line bg-panel2 px-4 py-3 text-sm">
                      <span className="font-medium">{item.ticker}</span>
                      <span className="text-muted">{item.horizon_days}d · {new Date(item.analysis_time).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Forecast history builds as you run analyses.</p>
              )}
            </Panel>
          </SectionReveal>
        ) : null}

        {!tab ? (
          <SectionReveal delay={0.15}>
            <Panel title="Quick Actions" icon={ArrowRight}>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button asChild variant="secondary" className="justify-start">
                  <Link href="/workstation">Run single-asset analysis</Link>
                </Button>
                <Button asChild variant="secondary" className="justify-start">
                  <Link href="/workstation?mode=portfolio">Analyze portfolio</Link>
                </Button>
                <Button asChild variant="secondary" className="justify-start">
                  <Link href="/research">Batch research scan</Link>
                </Button>
                <Button asChild variant="secondary" className="justify-start">
                  <Link href="/settings">Account settings</Link>
                </Button>
              </div>
            </Panel>
          </SectionReveal>
        ) : null}

        {!tab || tab === "analyses" ? (
          <SectionReveal delay={0.18}>
            <Panel title="Forecast Accuracy" icon={TableProperties}>
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
        ) : null}
      </div>
    </div>
  );
}

function GuestLanding({
  onSignIn,
  performance,
  loading
}: {
  onSignIn: () => void;
  performance: ForecastPerformance[];
  loading: boolean;
}) {
  return (
    <div className="space-y-8 p-5 lg:p-8">
      <SectionReveal>
        <div className="rounded-2xl border border-line bg-panel p-6 shadow-workstation lg:p-8">
          <Badge className="border-teal/40 text-teal">Institutional Quant Research</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Quant Committee AI</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
            Run independent quantitative models, convene the AI committee, compare risk metrics, and export institutional research — without fabricated numbers.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/workstation">
                <BrainCircuit className="h-4 w-4" aria-hidden="true" />
                Try Analysis
              </Link>
            </Button>
            <Button type="button" variant="secondary" onClick={onSignIn}>
              Sign in with Google
            </Button>
          </div>
        </div>
      </SectionReveal>

      <SectionReveal delay={0.05}>
        <Panel title="Forecast Accuracy" icon={TableProperties}>
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
            <p className="text-sm text-muted">Sign in to save analyses and access your workspace from any device.</p>
          )}
        </Panel>
      </SectionReveal>
    </div>
  );
}

function Panel({
  title,
  children,
  icon: Icon
}: {
  title: string;
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5 shadow-workstation">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-teal" aria-hidden="true" />
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />
      </div>
      {children}
    </section>
  );
}
