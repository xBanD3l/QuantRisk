export function formatUserError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Something went wrong.";
  const message = raw.trim();

  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Network error — check your connection and try again. If the backend is sleeping, wait a moment and retry.";
  }

  if (/timeout|timed out/i.test(message)) {
    return "The request timed out. The analysis may still be running on the server; try again in a few seconds.";
  }

  if (/429|rate limit|too many requests/i.test(message)) {
    return "Rate limit exceeded — please wait a minute before running another scan or analysis.";
  }

  if (/404|not found/i.test(message) && /ticker|symbol|analysis/i.test(message)) {
    return "Market data or analysis not found — verify the ticker symbol and try again.";
  }

  if (/invalid ticker|unknown ticker|no data|delisted/i.test(message)) {
    return "Invalid or unavailable ticker — confirm the symbol is listed and spelled correctly.";
  }

  if (/market data|download|yfinance|price history/i.test(message)) {
    return "Market data is temporarily unavailable for this symbol. Try another ticker or retry shortly.";
  }

  if (/401|403|authentication|session/i.test(message)) {
    return "Your session expired — sign in again to continue saving work to your account.";
  }

  if (/500|internal server/i.test(message)) {
    return "The analysis service encountered an error. Retry the request; if it persists, try fewer models or a shorter horizon.";
  }

  return message.length > 240 ? `${message.slice(0, 240)}…` : message;
}
