from __future__ import annotations

from backend.app.services.research import run_research_scan
from backend.app.schemas import ResearchRequest


def test_research_scan_dow30():
    result = run_research_scan(ResearchRequest(watchlist="dow30", horizon_days=30, max_tickers=5))
    assert result.completed >= 1
    assert len(result.rows) >= 1
    assert result.summary.top_opportunities
