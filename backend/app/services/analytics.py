from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from ..core.config import get_settings


def _analytics_path() -> Path:
    path = get_settings().data_dir / "analytics.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _read_events() -> list[dict]:
    path = _analytics_path()
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []


def _write_events(events: list[dict]) -> None:
    _analytics_path().write_text(json.dumps(events[-5000:], indent=2, default=str), encoding="utf-8")


def track_event(event: str, metadata: dict | None = None) -> None:
    events = _read_events()
    events.append(
        {
            "event": event,
            "metadata": metadata or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )
    _write_events(events)


def analytics_summary() -> dict:
    events = _read_events()
    counts: dict[str, int] = {}
    tickers: dict[str, int] = {}
    for item in events:
        name = str(item.get("event", "unknown"))
        counts[name] = counts.get(name, 0) + 1
        meta = item.get("metadata") or {}
        ticker = meta.get("ticker")
        if isinstance(ticker, str):
            tickers[ticker.upper()] = tickers.get(ticker.upper(), 0) + 1
    top_tickers = sorted(tickers.items(), key=lambda pair: pair[1], reverse=True)[:10]
    return {
        "total_events": len(events),
        "event_counts": counts,
        "top_tickers": [{"ticker": ticker, "count": count} for ticker, count in top_tickers],
    }
