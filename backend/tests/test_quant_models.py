from __future__ import annotations

import pytest

from backend.app.services.data import MarketBar, _synthetic_history
from backend.app.services.math_utils import compound_return, percentile, summarize_distribution
from backend.app.services.quant_models import run_models


def test_percentile_interpolates():
    values = [1.0, 2.0, 3.0, 4.0, 5.0]
    assert percentile(values, 0.0) == 1.0
    assert percentile(values, 1.0) == 5.0
    assert 2.0 <= percentile(values, 0.5) <= 3.0


def test_compound_return():
    assert compound_return([0.01, 0.02, -0.01]) == pytest.approx(0.019898, rel=1e-4)


def test_summarize_distribution_respects_confidence_level():
    distribution = [-0.2, -0.1, -0.05, 0.0, 0.05, 0.1, 0.2]
    summary_95 = summarize_distribution(distribution, confidence_level=0.95)
    summary_99 = summarize_distribution(distribution, confidence_level=0.99)
    assert summary_99["var95"] <= summary_95["var95"]


def test_run_models_returns_standardized_outputs():
    bars = _synthetic_history("TEST", 400)
    results = run_models("TEST", bars, 30, ["Historical", "Monte Carlo"], confidence_level=0.95)
    assert len(results) == 2
    for result in results:
        assert result.expected_return is not None
        assert result.var95 <= 0 or result.expected_return >= -1
        assert 0 <= result.prob_positive <= 1
        assert len(result.confidence_interval) == 2
        assert result.assumptions
        assert result.strengths
        assert result.weaknesses
        assert 0 <= result.confidence_score <= 1
