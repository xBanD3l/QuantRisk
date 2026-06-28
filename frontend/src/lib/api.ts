import type { AnalysisRequest, AnalysisResponse, ExplainResponse, ForecastPerformance } from "@/lib/types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      message = body.detail || message;
    } catch {
      // Keep HTTP status text when the body is not JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function runAnalysis(payload: AnalysisRequest) {
  const response = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse<AnalysisResponse>(response);
}

export async function askExplainability(analysisId: string, question: string) {
  const response = await fetch(`${API_BASE}/api/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis_id: analysisId, question })
  });
  return parseResponse<ExplainResponse>(response);
}

export async function fetchPerformance() {
  const response = await fetch(`${API_BASE}/api/forecasts/performance`);
  return parseResponse<ForecastPerformance[]>(response);
}

export function reportUrl(analysisId: string) {
  return `${API_BASE}/api/reports/${analysisId}.pdf`;
}

