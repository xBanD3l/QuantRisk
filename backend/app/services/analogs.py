from __future__ import annotations

from .data import MarketBar
from .math_utils import annualize_volatility, clamp, compound_return, mean
from .regime import regime_factor_vector
from ..schemas import HistoricalAnalog, PricePoint


def _returns(prices: list[float]) -> list[float]:
    output: list[float] = []
    for previous, current in zip(prices, prices[1:]):
        if previous > 0:
            output.append((current / previous) - 1.0)
    return output


def _window_distance(current: tuple[float, float, float], candidate: tuple[float, float, float]) -> float:
    weights = (0.45, 0.35, 0.20)
    return sum(weight * (left - right) ** 2 for weight, left, right in zip(weights, current, candidate)) ** 0.5


def find_historical_analogs(
    bars: list[MarketBar],
    horizon_days: int,
    top_k: int = 5,
    window_days: int = 63,
    forward_days: int = 63,
) -> list[HistoricalAnalog]:
    if len(bars) < window_days + forward_days + 30:
        return []

    prices = [bar.close for bar in bars]
    current_window = bars[-window_days:]
    current_vector = regime_factor_vector(current_window)

    candidates: list[tuple[float, int]] = []
    last_start = len(bars) - window_days - forward_days - 21
    for start in range(window_days, max(window_days, last_start)):
        end = start + window_days
        if end >= len(bars) - forward_days:
            break
        window_bars = bars[start:end]
        vector = regime_factor_vector(window_bars)
        distance = _window_distance(current_vector, vector)
        similarity = clamp(1.0 - distance / 0.35)
        if similarity >= 0.35:
            candidates.append((similarity, start))

    candidates.sort(key=lambda item: item[0], reverse=True)
    selected: list[HistoricalAnalog] = []
    used_ranges: list[tuple[int, int]] = []

    for similarity, start in candidates:
        end = start + window_days
        if any(not (end <= left or start >= right) for left, right in used_ranges):
            continue

        window_bars = bars[start:end]
        forward_bars = bars[end : end + forward_days]
        if len(forward_bars) < forward_days:
            continue

        window_returns = _returns([bar.close for bar in window_bars])
        forward_returns = _returns([bar.close for bar in forward_bars])
        subsequent_return = compound_return(forward_returns)
        subsequent_vol = annualize_volatility(forward_returns)
        momentum = mean(window_returns)

        narrative = (
            f"This {window_days}-day window ended on {window_bars[-1].date.isoformat()} with "
            f"{momentum * 100:+.1f}% average daily drift. Over the next {forward_days} trading days, "
            f"the asset returned {subsequent_return * 100:+.1f}% with {subsequent_vol * 100:.1f}% "
            "annualized realized volatility."
        )

        selected.append(
            HistoricalAnalog(
                start_date=window_bars[0].date.isoformat(),
                end_date=window_bars[-1].date.isoformat(),
                similarity_score=round(similarity, 4),
                volatility=round(annualize_volatility(window_returns), 6),
                momentum=round(momentum, 6),
                subsequent_return=round(subsequent_return, 6),
                subsequent_volatility=round(subsequent_vol, 6),
                price_history=[
                    PricePoint(date=bar.date.isoformat(), close=bar.close, volume=bar.volume)
                    for bar in window_bars
                ],
                narrative=narrative,
            )
        )
        used_ranges.append((start, end))
        if len(selected) >= top_k:
            break

    return selected
