import type {
  AnalysisRequest,
  AnalysisResponse,
  CalibrationSummary,
  ExplainResponse,
  ForecastPerformance,
  ModelMethodology,
  PortfolioRequest,
  PortfolioResponse,
  ResearchRequest,
  ResearchResponse,
  StreamHandlers,
  ModelResult,
  UserWorkspace
} from "@/lib/types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

function userHeaders(userId?: string | null): HeadersInit {
  return userId ? { "X-User-Id": userId } : {};
}

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

export async function runAnalysis(payload: AnalysisRequest, userId?: string | null) {
  const response = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...userHeaders(userId) },
    body: JSON.stringify(payload)
  });
  return parseResponse<AnalysisResponse>(response);
}

function parseSseChunk(chunk: string, handlers: StreamHandlers) {
  let event = "message";
  let data = "";
  for (const line of chunk.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      data += line.slice(5).trim();
    }
  }
  if (!data) {
    return;
  }
  const payload = JSON.parse(data) as Record<string, unknown>;
  if (event === "pipeline") {
    handlers.onPipeline?.(payload as { step: string; index: number; total?: number; model?: string });
  } else if (event === "model") {
    handlers.onModel?.(payload as unknown as ModelResult);
  } else if (event === "metrics") {
    handlers.onMetrics?.(payload as unknown as AnalysisResponse["metrics"]);
  } else if (event === "regime") {
    handlers.onRegime?.(payload as unknown as NonNullable<AnalysisResponse["market_regime"]>);
  } else if (event === "analogs") {
    handlers.onAnalogs?.(payload as unknown as AnalysisResponse["historical_analogs"]);
  } else if (event === "consensus") {
    handlers.onConsensus?.(payload as unknown as AnalysisResponse["consensus"]);
  } else if (event === "committee") {
    handlers.onCommittee?.(payload as unknown as AnalysisResponse["committee"][number]);
  } else if (event === "complete") {
    handlers.onComplete?.(payload as unknown as AnalysisResponse);
  } else if (event === "error") {
    handlers.onError?.(String(payload.message ?? "Stream failed."));
  }
}

export async function streamAnalysis(payload: AnalysisRequest, handlers: StreamHandlers, userId?: string | null) {
  const response = await fetch(`${API_BASE}/api/analyze/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...userHeaders(userId) },
    body: JSON.stringify(payload)
  });

  if (response.status === 404) {
    const analysis = await runAnalysis(payload, userId);
    handlers.onComplete?.(analysis);
    return;
  }

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { detail?: string };
      message = body.detail || message;
    } catch {
      message = (await response.text()) || message;
    }
    throw new Error(message);
  }
  if (!response.body) {
    throw new Error("Streaming response unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      if (part.trim()) {
        parseSseChunk(part, handlers);
      }
    }
  }
  if (buffer.trim()) {
    parseSseChunk(buffer, handlers);
  }
}

export async function runPortfolioAnalysis(payload: PortfolioRequest) {
  const response = await fetch(`${API_BASE}/api/portfolio/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse<PortfolioResponse>(response);
}

export async function calibrateForecasts() {
  const response = await fetch(`${API_BASE}/api/forecasts/calibrate`, { method: "POST" });
  return parseResponse<CalibrationSummary>(response);
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

export async function fetchMethodologies() {
  const response = await fetch(`${API_BASE}/api/methodology`);
  return parseResponse<ModelMethodology[]>(response);
}

export async function fetchMethodology(model: string) {
  const response = await fetch(`${API_BASE}/api/methodology/${encodeURIComponent(model)}`);
  return parseResponse<ModelMethodology>(response);
}

export async function fetchForecasts(userId?: string | null) {
  const response = await fetch(`${API_BASE}/api/forecasts`, { headers: userHeaders(userId) });
  return parseResponse<Array<{ analysis_id: string; ticker: string; analysis_time: string; horizon_days: number }>>(response);
}

export async function fetchWorkspace(userId: string) {
  const response = await fetch(`${API_BASE}/api/users/me`, { headers: userHeaders(userId) });
  return parseResponse<UserWorkspace>(response);
}

export async function runResearchScan(payload: ResearchRequest, userId?: string | null) {
  const response = await fetch(`${API_BASE}/api/research/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...userHeaders(userId) },
    body: JSON.stringify(payload)
  });
  return parseResponse<ResearchResponse>(response);
}

export async function trackEvent(event: string, metadata: Record<string, string | number> = {}) {
  await fetch(`${API_BASE}/api/analytics/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, metadata })
  }).catch(() => undefined);
}

