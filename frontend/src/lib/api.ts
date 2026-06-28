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

export const STREAM_FALLBACK_MESSAGE = "Live progress unavailable, using standard analysis.";

const STREAM_FIRST_EVENT_TIMEOUT_MS = 5000;

function authHeaders(accessToken?: string | null): HeadersInit {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
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

export async function runAnalysis(payload: AnalysisRequest, accessToken?: string | null) {
  const response = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(accessToken) },
    body: JSON.stringify(payload)
  });
  return parseResponse<AnalysisResponse>(response);
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  if (error instanceof Error) {
    return error.name === "AbortError" || /aborted|NS_BINDING_ABORTED/i.test(error.message);
  }
  return false;
}

function splitSseBlocks(buffer: string): { blocks: string[]; remainder: string } {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const blocks: string[] = [];
  let start = 0;

  while (true) {
    const boundary = normalized.indexOf("\n\n", start);
    if (boundary === -1) {
      return { blocks, remainder: normalized.slice(start) };
    }
    const block = normalized.slice(start, boundary);
    if (block.trim()) {
      blocks.push(block);
    }
    start = boundary + 2;
  }
}

/** Parse one SSE event block per the WHATWG SSE specification. */
function parseSseBlock(block: string, handlers: StreamHandlers): "complete" | "error" | "event" | "skip" {
  let eventType = "message";
  const dataLines: string[] = [];

  for (const rawLine of block.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (!line || line.startsWith(":")) {
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }

    const field = line.slice(0, colonIndex);
    let value = line.slice(colonIndex + 1);
    if (value.startsWith(" ")) {
      value = value.slice(1);
    }

    if (field === "event") {
      eventType = value;
    } else if (field === "data") {
      dataLines.push(value);
    }
  }

  if (!dataLines.length) {
    return "skip";
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
  } catch {
    return "skip";
  }

  if (eventType === "pipeline") {
    handlers.onPipeline?.(payload as { step: string; index: number; total?: number; model?: string });
  } else if (eventType === "model") {
    handlers.onModel?.(payload as unknown as ModelResult);
  } else if (eventType === "metrics") {
    handlers.onMetrics?.(payload as unknown as AnalysisResponse["metrics"]);
  } else if (eventType === "regime") {
    handlers.onRegime?.(payload as unknown as NonNullable<AnalysisResponse["market_regime"]>);
  } else if (eventType === "analogs") {
    handlers.onAnalogs?.(payload as unknown as AnalysisResponse["historical_analogs"]);
  } else if (eventType === "consensus") {
    handlers.onConsensus?.(payload as unknown as AnalysisResponse["consensus"]);
  } else if (eventType === "committee") {
    handlers.onCommittee?.(payload as unknown as AnalysisResponse["committee"][number]);
  } else if (eventType === "complete") {
    handlers.onComplete?.(payload as unknown as AnalysisResponse);
    return "complete";
  } else if (eventType === "error") {
    handlers.onError?.(String(payload.message ?? "Stream failed."));
    return "error";
  }

  return "event";
}

function processSseBuffer(
  buffer: string,
  handlers: StreamHandlers
): { remainder: string; receivedEvent: boolean; finished: boolean } {
  const { blocks, remainder } = splitSseBlocks(buffer);
  let receivedEvent = false;
  let finished = false;

  for (const block of blocks) {
    const outcome = parseSseBlock(block, handlers);
    if (outcome === "skip") {
      continue;
    }
    receivedEvent = true;
    if (outcome === "complete" || outcome === "error") {
      finished = true;
      break;
    }
  }

  return { remainder, receivedEvent, finished };
}

async function fallbackToSyncAnalysis(
  payload: AnalysisRequest,
  handlers: StreamHandlers,
  accessToken?: string | null
) {
  handlers.onFallback?.(STREAM_FALLBACK_MESSAGE);
  const analysis = await runAnalysis(payload, accessToken);
  handlers.onComplete?.(analysis);
}

export async function streamAnalysis(payload: AnalysisRequest, handlers: StreamHandlers, accessToken?: string | null) {
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let finished = false;
  let fallingBack = false;
  let receivedEvent = false;

  const firstEventTimer = setTimeout(() => {
    if (!receivedEvent && !finished && !fallingBack) {
      controller.abort();
    }
  }, STREAM_FIRST_EVENT_TIMEOUT_MS);

  async function fallback() {
    if (finished || fallingBack) {
      return;
    }
    fallingBack = true;
    controller.abort();
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        // Ignore cancellation errors while switching to sync analysis.
      }
    }
    await fallbackToSyncAnalysis(payload, handlers, accessToken);
    finished = true;
  }

  try {
    const response = await fetch(`${API_BASE}/api/analyze/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
        ...authHeaders(accessToken)
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store"
    });

    if (response.status === 404) {
      clearTimeout(firstEventTimer);
      await fallbackToSyncAnalysis(payload, handlers, accessToken);
      return;
    }

    if (!response.ok) {
      clearTimeout(firstEventTimer);
      await fallback();
      return;
    }

    if (!response.body) {
      clearTimeout(firstEventTimer);
      await fallback();
      return;
    }

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (readError) {
        clearTimeout(firstEventTimer);
        if (!finished) {
          await fallback();
        }
        return;
      }

      if (chunk.done) {
        break;
      }

      buffer += decoder.decode(chunk.value, { stream: true });
      const parsed = processSseBuffer(buffer, handlers);
      buffer = parsed.remainder;

      if (parsed.receivedEvent) {
        receivedEvent = true;
        clearTimeout(firstEventTimer);
      }
      if (parsed.finished) {
        finished = true;
        return;
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      const parsed = processSseBuffer(`${buffer}\n\n`, handlers);
      if (parsed.receivedEvent) {
        receivedEvent = true;
        clearTimeout(firstEventTimer);
      }
      if (parsed.finished) {
        finished = true;
        return;
      }
    }

    clearTimeout(firstEventTimer);
    if (!finished) {
      await fallback();
    }
  } catch (error) {
    clearTimeout(firstEventTimer);
    if (finished || fallingBack) {
      return;
    }
    if (isAbortError(error) || !receivedEvent) {
      await fallback();
      return;
    }
    if (!finished) {
      await fallback();
    }
  } finally {
    clearTimeout(firstEventTimer);
    reader?.releaseLock();
  }
}

export async function runPortfolioAnalysis(payload: PortfolioRequest, accessToken?: string | null) {
  const response = await fetch(`${API_BASE}/api/portfolio/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(accessToken) },
    body: JSON.stringify(payload)
  });
  return parseResponse<PortfolioResponse>(response);
}

export async function calibrateForecasts(accessToken?: string | null) {
  const response = await fetch(`${API_BASE}/api/forecasts/calibrate`, {
    method: "POST",
    headers: authHeaders(accessToken)
  });
  return parseResponse<CalibrationSummary>(response);
}

export async function askExplainability(analysisId: string, question: string, accessToken?: string | null) {
  const response = await fetch(`${API_BASE}/api/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(accessToken) },
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

export async function fetchForecasts(accessToken?: string | null) {
  const response = await fetch(`${API_BASE}/api/forecasts`, { headers: authHeaders(accessToken) });
  return parseResponse<Array<{ analysis_id: string; ticker: string; analysis_time: string; horizon_days: number }>>(response);
}

export async function fetchWorkspace(accessToken: string) {
  const response = await fetch(`${API_BASE}/api/users/me`, { headers: authHeaders(accessToken) });
  return parseResponse<UserWorkspace>(response);
}

export async function runResearchScan(payload: ResearchRequest, accessToken?: string | null) {
  const response = await fetch(`${API_BASE}/api/research/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(accessToken) },
    body: JSON.stringify(payload)
  });
  return parseResponse<ResearchResponse>(response);
}

export async function trackEvent(
  event: string,
  metadata: Record<string, string | number> = {},
  accessToken?: string | null
) {
  await fetch(`${API_BASE}/api/analytics/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(accessToken) },
    body: JSON.stringify({ event, metadata })
  }).catch(() => undefined);
}
