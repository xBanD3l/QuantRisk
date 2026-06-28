import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AnalysisResponse, PortfolioResponse } from "@/lib/types";
import { reportUrl } from "@/lib/api";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_login: string | null;
};

export type SavedAnalysisRow = {
  id: string;
  user_id: string;
  ticker: string;
  horizon: number;
  created_at: string;
  committee_summary: unknown;
  model_outputs: unknown;
  consensus: unknown;
  analysis_id: string | null;
};

export type SavedPortfolioRow = {
  id: string;
  user_id: string;
  name: string;
  holdings: unknown;
  created_at: string;
};

export type SavedReportRow = {
  id: string;
  user_id: string;
  report_url: string;
  ticker: string | null;
  analysis_id: string | null;
  created_at: string;
};

export type DashboardData = {
  analyses: SavedAnalysisRow[];
  portfolios: SavedPortfolioRow[];
  reports: SavedReportRow[];
};

export async function fetchProfile(supabase: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) {
    console.error("fetchProfile", error.message);
    return null;
  }
  return data as Profile | null;
}

export async function touchLastLogin(supabase: SupabaseClient, user: User) {
  await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
        last_login: new Date().toISOString()
      },
      { onConflict: "id" }
    );
}

export async function fetchDashboardData(supabase: SupabaseClient, userId: string): Promise<DashboardData> {
  const [analysesRes, portfoliosRes, reportsRes] = await Promise.all([
    supabase.from("analyses").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(8),
    supabase.from("portfolios").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(6),
    supabase.from("reports").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(6)
  ]);

  return {
    analyses: (analysesRes.data ?? []) as SavedAnalysisRow[],
    portfolios: (portfoliosRes.data ?? []) as SavedPortfolioRow[],
    reports: (reportsRes.data ?? []) as SavedReportRow[]
  };
}

export async function saveAnalysis(supabase: SupabaseClient, userId: string, analysis: AnalysisResponse) {
  const { error } = await supabase.from("analyses").insert({
    user_id: userId,
    ticker: analysis.ticker,
    horizon: analysis.horizon_days,
    committee_summary: analysis.committee,
    model_outputs: analysis.model_results,
    consensus: analysis.consensus,
    analysis_id: analysis.analysis_id
  });
  if (error) {
    console.error("saveAnalysis", error.message);
  }
}

export async function savePortfolio(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  portfolio: PortfolioResponse
) {
  const { error } = await supabase.from("portfolios").insert({
    user_id: userId,
    name,
    holdings: {
      holdings: portfolio.holdings,
      expected_return: portfolio.expected_return,
      var95: portfolio.var95,
      expected_shortfall: portfolio.expected_shortfall,
      prob_positive: portfolio.prob_positive,
      horizon_days: portfolio.horizon_days,
      tickers: portfolio.tickers
    }
  });
  if (error) {
    console.error("savePortfolio", error.message);
  }
}

export async function saveReport(
  supabase: SupabaseClient,
  userId: string,
  analysis: AnalysisResponse
) {
  const { error } = await supabase.from("reports").insert({
    user_id: userId,
    report_url: reportUrl(analysis.analysis_id),
    ticker: analysis.ticker,
    analysis_id: analysis.analysis_id
  });
  if (error) {
    console.error("saveReport", error.message);
  }
}

export async function trackUsage(
  supabase: SupabaseClient,
  userId: string | null,
  eventName: string,
  metadata: Record<string, string | number> = {}
) {
  const { error } = await supabase.from("usage_events").insert({
    user_id: userId,
    event_name: eventName,
    metadata
  });
  if (error) {
    console.error("trackUsage", error.message);
  }
}
