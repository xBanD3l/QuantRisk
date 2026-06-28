from __future__ import annotations

from backend.app.services.analogs import find_historical_analogs
from backend.app.services.data import _synthetic_history
from backend.app.services.regime import detect_market_regime


def test_detect_market_regime_returns_label():
    bars = _synthetic_history("REGIME", 500)
    regime = detect_market_regime(bars)
    assert regime.label
    assert 0 <= regime.score <= 1
    assert regime.volatility_regime
    assert regime.description


def test_find_historical_analogs_returns_ranked_windows():
    bars = _synthetic_history("ANALOG", 600)
    analogs = find_historical_analogs(bars, horizon_days=30, top_k=3)
    assert len(analogs) >= 1
    scores = [item.similarity_score for item in analogs]
    assert scores == sorted(scores, reverse=True)
    for analog in analogs:
        assert analog.start_date <= analog.end_date
        assert analog.price_history
        assert analog.narrative
