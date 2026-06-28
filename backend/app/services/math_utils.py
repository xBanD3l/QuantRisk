from __future__ import annotations

import math
from statistics import NormalDist


NORMAL = NormalDist()


def clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
    return max(lower, min(upper, value))


def mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def stdev(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    avg = mean(values)
    variance = sum((value - avg) ** 2 for value in values) / (len(values) - 1)
    return math.sqrt(max(variance, 0.0))


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    rank = (len(ordered) - 1) * pct
    low = math.floor(rank)
    high = math.ceil(rank)
    if low == high:
        return ordered[low]
    weight = rank - low
    return ordered[low] * (1 - weight) + ordered[high] * weight


def correlation(left: list[float], right: list[float]) -> float:
    n = min(len(left), len(right))
    if n < 3:
        return 0.0
    a = left[-n:]
    b = right[-n:]
    mean_a = mean(a)
    mean_b = mean(b)
    numerator = sum((x - mean_a) * (y - mean_b) for x, y in zip(a, b))
    denom_a = math.sqrt(sum((x - mean_a) ** 2 for x in a))
    denom_b = math.sqrt(sum((y - mean_b) ** 2 for y in b))
    if denom_a == 0 or denom_b == 0:
        return 0.0
    return numerator / (denom_a * denom_b)


def annualize_volatility(daily_returns: list[float]) -> float:
    return stdev(daily_returns) * math.sqrt(252)


def compound_return(returns: list[float]) -> float:
    value = 1.0
    for item in returns:
        value *= 1.0 + item
    return value - 1.0


def summarize_distribution(distribution: list[float], sample_limit: int = 2500) -> dict[str, float | list[float]]:
    if not distribution:
        return {
            "expected_return": 0.0,
            "var95": 0.0,
            "expected_shortfall": 0.0,
            "prob_positive": 0.0,
            "confidence_interval": [0.0, 0.0],
            "sample": [],
        }

    var95 = percentile(distribution, 0.05)
    tail = [value for value in distribution if value <= var95]
    stride = max(1, len(distribution) // sample_limit)
    return {
        "expected_return": mean(distribution),
        "var95": var95,
        "expected_shortfall": mean(tail) if tail else var95,
        "prob_positive": sum(1 for value in distribution if value > 0) / len(distribution),
        "confidence_interval": [percentile(distribution, 0.025), percentile(distribution, 0.975)],
        "sample": distribution[::stride][:sample_limit],
    }


def normal_cdf(value: float, mu: float, sigma: float) -> float:
    if sigma <= 0:
        return 1.0 if value >= mu else 0.0
    return NORMAL.cdf((value - mu) / sigma)


def normal_quantile(probability: float, mu: float, sigma: float) -> float:
    if sigma <= 0:
        return mu
    return mu + sigma * NORMAL.inv_cdf(probability)

