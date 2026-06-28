from __future__ import annotations

import hashlib
import math
import random
from datetime import date, timedelta

from .data import MarketBar, download_market_data
from .math_utils import compound_return, mean, percentile, stdev, summarize_distribution
from ..schemas import PortfolioHolding, PortfolioRequest, PortfolioResponse, PortfolioRiskComponent


def _seed(key: str) -> int:
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return int(digest[:12], 16)


def _returns(prices: list[float]) -> list[float]:
    output: list[float] = []
    for previous, current in zip(prices, prices[1:]):
        if previous > 0:
            output.append((current / previous) - 1.0)
    return output


def _align_returns(holdings: list[tuple[str, list[MarketBar], float]]) -> tuple[list[str], list[list[float]], list[float]]:
    tickers = [item[0] for item in holdings]
    weights = [item[2] for item in holdings]
    date_sets = [set(bar.date for bar in item[1]) for item in holdings]
    common_dates = sorted(set.intersection(*date_sets)) if date_sets else []
    if len(common_dates) < 30:
        raise ValueError("Insufficient overlapping history across portfolio holdings.")

    aligned: list[list[float]] = []
    for ticker, bars, _weight in holdings:
        price_by_date = {bar.date: bar.close for bar in bars}
        prices = [price_by_date[day] for day in common_dates]
        aligned.append(_returns(prices))

    min_len = min(len(series) for series in aligned)
    aligned = [series[-min_len:] for series in aligned]
    return tickers, aligned, weights


def _correlation_matrix(series: list[list[float]]) -> list[list[float]]:
    n = len(series)
    matrix = [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            left = series[i]
            right = series[j]
            m = min(len(left), len(right))
            if m < 3:
                continue
            a = left[-m:]
            b = right[-m:]
            avg_a = mean(a)
            avg_b = mean(b)
            num = sum((x - avg_a) * (y - avg_b) for x, y in zip(a, b))
            den_a = math.sqrt(sum((x - avg_a) ** 2 for x in a))
            den_b = math.sqrt(sum((y - avg_b) ** 2 for y in b))
            value = num / (den_a * den_b) if den_a and den_b else 0.0
            matrix[i][j] = round(value, 6)
            matrix[j][i] = round(value, 6)
    return matrix


def _cholesky(matrix: list[list[float]]) -> list[list[float]]:
    n = len(matrix)
    lower = [[0.0 for _ in range(n)] for _ in range(n)]
    for i in range(n):
        for j in range(i + 1):
            total = sum(lower[i][k] * lower[j][k] for k in range(j))
            if i == j:
                value = matrix[i][i] - total
                lower[i][j] = math.sqrt(max(value, 1e-10))
            else:
                lower[i][j] = (matrix[i][j] - total) / lower[j][j]
    return lower


def _simulate_portfolio_distribution(
    tickers: list[str],
    returns: list[list[float]],
    weights: list[float],
    horizon_days: int,
    confidence_level: float,
    simulations: int = 40_000,
) -> tuple[list[float], list[list[float]]]:
    n = len(tickers)
    corr = _correlation_matrix(returns)
    cholesky = _cholesky(corr)
    mus = [mean(series[-252:]) if len(series) >= 252 else mean(series) for series in returns]
    sigmas = [max(stdev(series[-252:]) if len(series) >= 252 else stdev(series), 1e-6) for series in returns]
    rng = random.Random(_seed(":".join(tickers) + str(horizon_days)))

    distribution: list[float] = []
    for _ in range(simulations):
        horizon_returns = [0.0 for _ in range(n)]
        for _day in range(horizon_days):
            shocks = [rng.gauss(0.0, 1.0) for _ in range(n)]
            correlated = [sum(cholesky[i][j] * shocks[j] for j in range(i + 1)) for i in range(n)]
            for index in range(n):
                horizon_returns[index] += mus[index] + sigmas[index] * correlated[index]
        terminal_wealth = sum(weight * math.exp(log_return) for weight, log_return in zip(weights, horizon_returns))
        distribution.append(terminal_wealth - 1.0)

    return distribution, corr


def _marginal_var(
    tickers: list[str],
    returns: list[list[float]],
    weights: list[float],
    horizon_days: int,
    confidence_level: float,
    bump: float = 0.01,
) -> list[float]:
    base_dist, _ = _simulate_portfolio_distribution(
        tickers, returns, weights, horizon_days, confidence_level, simulations=12_000
    )
    base_var = percentile(base_dist, 1.0 - confidence_level)
    marginals: list[float] = []
    for index in range(len(weights)):
        bumped = weights.copy()
        bumped[index] += bump
        total = sum(bumped)
        bumped = [value / total for value in bumped]
        bumped_dist, _ = _simulate_portfolio_distribution(
            tickers, returns, bumped, horizon_days, confidence_level, simulations=12_000
        )
        marginals.append((percentile(bumped_dist, 1.0 - confidence_level) - base_var) / bump)
    return marginals


def analyze_portfolio(request: PortfolioRequest) -> PortfolioResponse:
    if not request.holdings:
        raise ValueError("At least one holding is required.")

    raw_weights = [max(holding.weight, 0.0) for holding in request.holdings]
    total_weight = sum(raw_weights)
    if total_weight <= 0:
        raise ValueError("Portfolio weights must sum to a positive value.")

    normalized = [
        PortfolioHolding(ticker=holding.ticker.upper().strip(), weight=weight / total_weight)
        for holding, weight in zip(request.holdings, raw_weights)
    ]

    loaded: list[tuple[str, list[MarketBar], float]] = []
    for holding in normalized:
        bars = download_market_data(holding.ticker)
        loaded.append((holding.ticker, bars, holding.weight))

    tickers, aligned_returns, weights = _align_returns(loaded)
    distribution, correlation = _simulate_portfolio_distribution(
        tickers,
        aligned_returns,
        weights,
        request.horizon_days,
        request.confidence_level,
    )
    summary = summarize_distribution(distribution, confidence_level=request.confidence_level)
    marginals = _marginal_var(tickers, aligned_returns, weights, request.horizon_days, request.confidence_level)

    components: list[PortfolioRiskComponent] = []
    portfolio_var = float(summary["var95"])
    for ticker, weight, marginal in zip(tickers, weights, marginals):
        component_var = marginal * weight
        risk_contribution = component_var / portfolio_var if portfolio_var else 0.0
        components.append(
            PortfolioRiskComponent(
                ticker=ticker,
                weight=round(weight, 6),
                marginal_var=round(marginal, 6),
                component_var=round(component_var, 6),
                risk_contribution=round(risk_contribution, 6),
            )
        )

    standalone_vars: list[float] = []
    for index, ticker in enumerate(tickers):
        solo_dist, _ = _simulate_portfolio_distribution(
            [ticker],
            [aligned_returns[index]],
            [1.0],
            request.horizon_days,
            request.confidence_level,
            simulations=8_000,
        )
        standalone_vars.append(percentile(solo_dist, 1.0 - request.confidence_level))

    undiversified_var = sum(weight * var for weight, var in zip(weights, standalone_vars))
    diversification_benefit = round(undiversified_var - portfolio_var, 6)

    return PortfolioResponse(
        holdings=normalized,
        horizon_days=request.horizon_days,
        confidence_level=request.confidence_level,
        expected_return=round(float(summary["expected_return"]), 6),
        var95=round(float(summary["var95"]), 6),
        expected_shortfall=round(float(summary["expected_shortfall"]), 6),
        prob_positive=round(float(summary["prob_positive"]), 6),
        confidence_interval=[round(value, 6) for value in summary["confidence_interval"]],  # type: ignore[index]
        correlation_matrix=correlation,
        tickers=tickers,
        components=components,
        diversification_benefit=diversification_benefit,
        distribution=[round(value, 6) for value in summary["sample"]],  # type: ignore[index]
    )


def realized_horizon_return(bars: list[MarketBar], start: date, horizon_days: int) -> float | None:
    if not bars:
        return None
    dates = [bar.date for bar in bars]
    if start not in dates:
        later = [bar for bar in bars if bar.date >= start]
        if not later:
            return None
        start_index = dates.index(later[0].date)
    else:
        start_index = dates.index(start)

    end_index = start_index + horizon_days
    if end_index >= len(bars):
        return None

    start_price = bars[start_index].close
    end_price = bars[end_index].close
    if start_price <= 0:
        return None
    return (end_price / start_price) - 1.0


def trading_days_between(start: date, end: date) -> int:
    if end <= start:
        return 0
    cursor = start
    count = 0
    while cursor < end:
        cursor += timedelta(days=1)
        if cursor.weekday() < 5:
            count += 1
    return count
