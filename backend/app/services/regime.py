from __future__ import annotations

from .data import MarketBar
from .math_utils import annualize_volatility, clamp, correlation, mean
from ..schemas import MarketRegime


def _returns(prices: list[float]) -> list[float]:
    output: list[float] = []
    for previous, current in zip(prices, prices[1:]):
        if previous > 0:
            output.append((current / previous) - 1.0)
    return output


def detect_market_regime(
    bars: list[MarketBar],
    benchmark_bars: list[MarketBar] | None = None,
) -> MarketRegime:
    prices = [bar.close for bar in bars]
    returns = _returns(prices)
    if len(returns) < 63:
        return MarketRegime(
            label="Insufficient History",
            score=0.0,
            volatility_regime="Unknown",
            momentum=0.0,
            description="Not enough history to classify the current market regime reliably.",
            factors={"volatility": 0.0, "momentum": 0.0, "correlation": 0.0},
        )

    short_returns = returns[-21:]
    medium_returns = returns[-63:]
    long_returns = returns[-252:] if len(returns) >= 252 else returns

    short_vol = annualize_volatility(short_returns)
    long_vol = max(annualize_volatility(long_returns), 1e-6)
    vol_ratio = short_vol / long_vol
    momentum = sum(medium_returns)

    benchmark_corr = 0.0
    if benchmark_bars:
        benchmark_returns = _returns([bar.close for bar in benchmark_bars])
        benchmark_corr = correlation(medium_returns, benchmark_returns)

    if vol_ratio > 1.35:
        volatility_regime = "High Volatility"
    elif vol_ratio < 0.75:
        volatility_regime = "Low Volatility"
    else:
        volatility_regime = "Normal Volatility"

    risk_off = vol_ratio > 1.2 and momentum < 0
    risk_on = vol_ratio < 0.95 and momentum > 0

    if momentum > 0.08 and vol_ratio < 1.1:
        label = "Bull"
        score = clamp(0.55 + momentum * 1.8 + (1.1 - vol_ratio) * 0.25)
    elif momentum < -0.08 and vol_ratio > 1.05:
        label = "Bear"
        score = clamp(0.55 + abs(momentum) * 1.6 + (vol_ratio - 1.0) * 0.35)
    elif momentum > 0.03 and vol_ratio > 1.15:
        label = "Recovery"
        score = clamp(0.48 + momentum * 1.2 + (vol_ratio - 1.0) * 0.2)
    elif risk_off:
        label = "Risk-Off"
        score = clamp(0.5 + (vol_ratio - 1.0) * 0.45 + abs(min(momentum, 0.0)) * 1.5)
    elif risk_on:
        label = "Risk-On"
        score = clamp(0.5 + momentum * 1.4 + (1.0 - vol_ratio) * 0.35)
    elif vol_ratio > 1.25:
        label = "High Volatility"
        score = clamp(0.45 + (vol_ratio - 1.0) * 0.5)
    elif vol_ratio < 0.8:
        label = "Low Volatility"
        score = clamp(0.45 + (0.9 - vol_ratio) * 0.6)
    else:
        label = "Neutral"
        score = clamp(0.42 + (1.0 - abs(momentum) * 4.0) * 0.25)

    description = (
        f"The current window shows {momentum * 100:+.1f}% momentum over 63 trading days with "
        f"{volatility_regime.lower()} conditions (short/long vol ratio {vol_ratio:.2f})."
    )
    if benchmark_bars:
        description += f" Benchmark correlation over the same window is {benchmark_corr:+.2f}."

    return MarketRegime(
        label=label,
        score=round(score, 4),
        volatility_regime=volatility_regime,
        momentum=round(momentum, 6),
        description=description,
        factors={
            "volatility": round(vol_ratio, 4),
            "momentum": round(momentum, 4),
            "correlation": round(benchmark_corr, 4),
        },
    )


def regime_factor_vector(bars: list[MarketBar]) -> tuple[float, float, float]:
    prices = [bar.close for bar in bars]
    returns = _returns(prices)
    if len(returns) < 21:
        return 0.0, 0.0, 0.0

    short = returns[-21:]
    medium = returns[-min(63, len(returns)) :]
    long = returns[-min(252, len(returns)) :]
    vol_ratio = annualize_volatility(short) / max(annualize_volatility(long), 1e-6)
    momentum = mean(medium)
    tail = sorted(medium)
    skew_proxy = mean(tail[: max(1, len(tail) // 5)]) - mean(tail[-max(1, len(tail) // 5) :])
    return round(vol_ratio, 6), round(momentum, 6), round(skew_proxy, 6)
