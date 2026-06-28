from __future__ import annotations

from .data import MarketBar
from .math_utils import annualize_volatility, correlation
from ..schemas import MarketMetrics, PricePoint, SeriesPoint


def calculate_returns(prices: list[float]) -> list[float]:
    returns: list[float] = []
    for previous, current in zip(prices, prices[1:]):
        if previous > 0:
            returns.append((current / previous) - 1.0)
    return returns


def rolling_volatility(bars: list[MarketBar], window: int = 30) -> list[SeriesPoint]:
    prices = [bar.close for bar in bars]
    returns = calculate_returns(prices)
    output: list[SeriesPoint] = []
    for index in range(window, len(returns) + 1):
        vol = annualize_volatility(returns[index - window:index])
        output.append(SeriesPoint(date=bars[index].date.isoformat(), value=vol))
    return output


def drawdown_series(bars: list[MarketBar]) -> list[SeriesPoint]:
    peak = bars[0].close if bars else 0.0
    output: list[SeriesPoint] = []
    for bar in bars:
        peak = max(peak, bar.close)
        drawdown = (bar.close / peak) - 1.0 if peak else 0.0
        output.append(SeriesPoint(date=bar.date.isoformat(), value=drawdown))
    return output


def build_market_metrics(bars: list[MarketBar], benchmark_bars: list[MarketBar] | None = None) -> MarketMetrics:
    prices = [bar.close for bar in bars]
    returns = calculate_returns(prices)
    correlations: dict[str, float] = {}

    if benchmark_bars:
        benchmark_returns = calculate_returns([bar.close for bar in benchmark_bars])
        correlations["benchmark"] = correlation(returns, benchmark_returns)

    return MarketMetrics(
        current_price=prices[-1] if prices else 0.0,
        returns=returns[-500:],
        rolling_volatility=rolling_volatility(bars)[-500:],
        realized_volatility=annualize_volatility(returns[-252:]),
        correlations=correlations,
        drawdowns=drawdown_series(bars)[-500:],
        price_history=[
            PricePoint(date=bar.date.isoformat(), close=bar.close, volume=bar.volume)
            for bar in bars[-500:]
        ],
    )

