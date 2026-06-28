from __future__ import annotations

import pytest

from backend.app.services.calibration import evaluate_record, performance_summary, trading_days_between
from backend.app.services.data import _synthetic_history
from backend.app.services.portfolio import analyze_portfolio, realized_horizon_return
from backend.app.schemas import PortfolioHolding, PortfolioRequest


def test_analyze_portfolio_returns_risk_decomposition():
    request = PortfolioRequest(
        holdings=[
            PortfolioHolding(ticker="AAA", weight=0.6),
            PortfolioHolding(ticker="BBB", weight=0.4),
        ],
        horizon_days=30,
        confidence_level=0.95,
    )
    result = analyze_portfolio(request)
    assert len(result.holdings) == 2
    assert pytest.approx(sum(item.weight for item in result.holdings), rel=1e-6) == 1.0
    assert len(result.correlation_matrix) == 2
    assert len(result.components) == 2
    assert result.var95 <= 0 or result.expected_return >= -1
    assert result.diversification_benefit is not None


def test_realized_horizon_return_from_synthetic_history():
    bars = _synthetic_history("CAL", 400)
    start = bars[100].date
    realized = realized_horizon_return(bars, start, 30)
    assert realized is not None


def test_trading_days_between_weekdays():
    from datetime import date

    assert trading_days_between(date(2024, 1, 1), date(2024, 1, 8)) == 5


def test_evaluate_record_for_mature_forecast():
    bars = _synthetic_history("EVAL", 500)
    start = bars[200].date
    realized = realized_horizon_return(bars, start, 20)
    assert realized is not None
    record = {
        "analysis_time": f"{start.isoformat()}T12:00:00+00:00",
        "horizon_days": 20,
        "ticker": "EVAL",
        "model_results": [
            {
                "model": "Historical",
                "expected_return": realized,
                "var95": realized - 0.05,
                "expected_shortfall": realized - 0.08,
                "prob_positive": 0.5,
                "confidence_interval": [realized - 0.1, realized + 0.1],
                "assumptions": [],
                "strengths": [],
                "weaknesses": [],
                "confidence_score": 0.7,
                "reasoning": "test",
            }
        ],
    }
    evaluation = evaluate_record(record)
    assert evaluation is not None
    assert "Historical" in evaluation
    assert evaluation["Historical"]["interval_hit"] == 1
