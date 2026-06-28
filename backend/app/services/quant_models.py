from __future__ import annotations

import hashlib
import math
import random

from .data import MarketBar
from .math_utils import clamp, compound_return, mean, percentile, stdev, summarize_distribution
from ..schemas import ModelName, ModelResult


MODEL_LIBRARY: dict[str, dict[str, list[str]]] = {
    "Historical": {
        "assumptions": [
            "Historical return windows are representative of near-term risk.",
            "No parametric return distribution is imposed.",
        ],
        "strengths": [
            "Directly reflects realized market behavior.",
            "Naturally includes skew and fat-tail observations already present in the sample.",
        ],
        "weaknesses": [
            "Limited by the available historical sample.",
            "May understate risk when future regimes differ from the lookback period.",
        ],
    },
    "Monte Carlo": {
        "assumptions": [
            "Returns follow a geometric Brownian motion process.",
            "Drift and volatility remain constant over the forecast horizon.",
        ],
        "strengths": [
            "Produces a full forward distribution.",
            "Separates expected outcome from tail-risk outcomes.",
        ],
        "weaknesses": [
            "Sensitive to drift and volatility estimates.",
            "Does not explicitly model jumps or stochastic volatility in this version.",
        ],
    },
    "GARCH": {
        "assumptions": [
            "Volatility clusters over time.",
            "Recent shocks influence conditional volatility.",
        ],
        "strengths": [
            "Responsive to changing volatility regimes.",
            "Useful for downside risk and dynamic VaR estimates.",
        ],
        "weaknesses": [
            "May overreact after temporary volatility spikes.",
            "Mean return estimates remain difficult even with better volatility estimates.",
        ],
    },
    "EWMA": {
        "assumptions": [
            "Recent observations deserve more weight than older observations.",
            "Volatility decays exponentially with a fixed smoothing factor.",
        ],
        "strengths": [
            "Simple and responsive volatility estimate.",
            "Works well as a recent-risk monitor.",
        ],
        "weaknesses": [
            "Uses a fixed decay parameter.",
            "Does not model structural breaks directly.",
        ],
    },
    "Bootstrap": {
        "assumptions": [
            "Historical daily returns can be resampled to approximate future paths.",
            "The observed return sample contains relevant downside events.",
        ],
        "strengths": [
            "Non-parametric and robust to distributional shape.",
            "Highlights sampling variability across historical outcomes.",
        ],
        "weaknesses": [
            "Cannot generate events more extreme than the observed sample unless they are already present.",
            "Ignores time ordering unless block sampling is added later.",
        ],
    },
    "Bayesian": {
        "assumptions": [
            "Expected return is uncertain and should be shrunk toward a neutral prior.",
            "Posterior uncertainty matters alongside the point estimate.",
        ],
        "strengths": [
            "Reduces overconfidence in noisy return estimates.",
            "Makes uncertainty around expected return explicit.",
        ],
        "weaknesses": [
            "Results depend on prior strength and prior mean.",
            "Does not remove uncertainty in volatility or market regime.",
        ],
    },
}


def _seed(ticker: str, model: str, horizon_days: int) -> int:
    digest = hashlib.sha256(f"{ticker}:{model}:{horizon_days}".encode("utf-8")).hexdigest()
    return int(digest[:12], 16)


def _log_returns(prices: list[float]) -> list[float]:
    output: list[float] = []
    for previous, current in zip(prices, prices[1:]):
        if previous > 0 and current > 0:
            output.append(math.log(current / previous))
    return output


def _simple_returns(prices: list[float]) -> list[float]:
    output: list[float] = []
    for previous, current in zip(prices, prices[1:]):
        if previous > 0:
            output.append((current / previous) - 1.0)
    return output


def _confidence_from_sample(sample_size: int, penalty: float = 0.0) -> float:
    base = 1.0 - math.exp(-sample_size / 260)
    return round(clamp(0.42 + base * 0.46 - penalty), 2)


def _result(
    model: str,
    distribution: list[float],
    reasoning: str,
    confidence_score: float,
    paths: list[list[float]] | None = None,
    metadata: dict[str, float | int | str] | None = None,
) -> ModelResult:
    summary = summarize_distribution(distribution)
    spec = MODEL_LIBRARY[model]
    return ModelResult(
        model=model,
        expected_return=round(float(summary["expected_return"]), 6),
        var95=round(float(summary["var95"]), 6),
        expected_shortfall=round(float(summary["expected_shortfall"]), 6),
        prob_positive=round(float(summary["prob_positive"]), 6),
        confidence_interval=[round(value, 6) for value in summary["confidence_interval"]],  # type: ignore[index]
        assumptions=spec["assumptions"],
        strengths=spec["strengths"],
        weaknesses=spec["weaknesses"],
        confidence_score=confidence_score,
        reasoning=reasoning,
        distribution=[round(value, 6) for value in summary["sample"]],  # type: ignore[index]
        paths=paths or [],
        metadata=metadata or {},
    )


def historical_simulation(ticker: str, bars: list[MarketBar], horizon_days: int) -> ModelResult:
    prices = [bar.close for bar in bars]
    returns = _simple_returns(prices)
    if len(returns) >= horizon_days:
        distribution = [
            compound_return(returns[index:index + horizon_days])
            for index in range(0, len(returns) - horizon_days + 1)
        ]
    else:
        distribution = returns

    reasoning = (
        f"Historical simulation evaluated {len(distribution)} realized {horizon_days}-day windows "
        "from the available lookback period and used their empirical downside tail for VaR."
    )
    return _result(
        "Historical",
        distribution,
        reasoning,
        _confidence_from_sample(len(distribution), penalty=0.04 if len(distribution) < 100 else 0.0),
    )


def monte_carlo(ticker: str, bars: list[MarketBar], horizon_days: int) -> ModelResult:
    rng = random.Random(_seed(ticker, "Monte Carlo", horizon_days))
    prices = [bar.close for bar in bars]
    log_returns = _log_returns(prices)
    current_price = prices[-1]
    mu = mean(log_returns)
    sigma = stdev(log_returns)
    simulations = 100_000
    drift = (mu - 0.5 * sigma * sigma) * horizon_days
    horizon_sigma = sigma * math.sqrt(horizon_days)
    distribution = [math.exp(rng.gauss(drift, horizon_sigma)) - 1.0 for _ in range(simulations)]

    paths: list[list[float]] = []
    for _ in range(80):
        path = [round(current_price, 2)]
        price = current_price
        for _step in range(horizon_days):
            price *= math.exp(rng.gauss(mu - 0.5 * sigma * sigma, sigma))
            path.append(round(price, 2))
        paths.append(path)

    reasoning = (
        f"Monte Carlo generated {simulations:,} GBM terminal outcomes using the historical daily "
        "drift and volatility estimates, then measured the 5th percentile as VaR."
    )
    return _result(
        "Monte Carlo",
        distribution,
        reasoning,
        _confidence_from_sample(len(log_returns), penalty=0.07),
        paths=paths,
        metadata={"simulations": simulations, "daily_drift": round(mu, 8), "daily_volatility": round(sigma, 8)},
    )


def garch_model(ticker: str, bars: list[MarketBar], horizon_days: int) -> ModelResult:
    rng = random.Random(_seed(ticker, "GARCH", horizon_days))
    prices = [bar.close for bar in bars]
    log_returns = _log_returns(prices)
    mu = mean(log_returns)
    residuals = [value - mu for value in log_returns]
    unconditional_var = max(stdev(residuals) ** 2, 1e-10)
    alpha = 0.08
    beta = 0.90
    omega = unconditional_var * max(1.0 - alpha - beta, 0.001)
    conditional_var = unconditional_var

    for residual in residuals[-252:]:
        conditional_var = omega + alpha * residual * residual + beta * conditional_var

    future_vars: list[float] = []
    forecast_var = conditional_var
    for _ in range(horizon_days):
        forecast_var = omega + (alpha + beta) * forecast_var
        future_vars.append(max(forecast_var, 1e-10))

    horizon_sigma = math.sqrt(sum(future_vars))
    distribution = [
        math.exp(rng.gauss(mu * horizon_days, horizon_sigma)) - 1.0
        for _ in range(50_000)
    ]

    recent_vol = math.sqrt(conditional_var * 252)
    long_vol = math.sqrt(unconditional_var * 252)
    ratio = recent_vol / long_vol if long_vol else 1.0
    regime = "elevated volatility" if ratio > 1.2 else "subdued volatility" if ratio < 0.8 else "normal volatility"
    reasoning = (
        f"GARCH-style conditional volatility is {regime}; the forecast uses clustered volatility "
        "rather than assuming the long-run variance is immediately restored."
    )
    return _result(
        "GARCH",
        distribution,
        reasoning,
        _confidence_from_sample(len(log_returns), penalty=0.05),
        metadata={
            "forecast_volatility": round(recent_vol, 6),
            "long_run_volatility": round(long_vol, 6),
            "regime": regime,
        },
    )


def ewma_model(ticker: str, bars: list[MarketBar], horizon_days: int) -> ModelResult:
    rng = random.Random(_seed(ticker, "EWMA", horizon_days))
    prices = [bar.close for bar in bars]
    log_returns = _log_returns(prices)
    mu = mean(log_returns[-126:]) if len(log_returns) >= 126 else mean(log_returns)
    lam = 0.94
    variance = stdev(log_returns) ** 2
    for value in log_returns[-252:]:
        variance = lam * variance + (1 - lam) * value * value

    horizon_sigma = math.sqrt(max(variance, 1e-10) * horizon_days)
    distribution = [
        math.exp(rng.gauss(mu * horizon_days, horizon_sigma)) - 1.0
        for _ in range(50_000)
    ]

    reasoning = (
        "EWMA assigns greater weight to recent returns, so its VaR is driven by the latest volatility "
        "state rather than by an equally weighted full-history estimate."
    )
    return _result(
        "EWMA",
        distribution,
        reasoning,
        _confidence_from_sample(len(log_returns), penalty=0.06),
        metadata={"lambda": lam, "forecast_volatility": round(math.sqrt(variance * 252), 6)},
    )


def bootstrap_model(ticker: str, bars: list[MarketBar], horizon_days: int) -> ModelResult:
    rng = random.Random(_seed(ticker, "Bootstrap", horizon_days))
    prices = [bar.close for bar in bars]
    returns = _simple_returns(prices)
    simulations = 50_000
    distribution: list[float] = []
    for _ in range(simulations):
        sampled = [returns[rng.randrange(len(returns))] for _day in range(horizon_days)]
        distribution.append(compound_return(sampled))

    reasoning = (
        f"Bootstrap resampled {simulations:,} paths from observed daily returns, preserving the "
        "empirical return distribution while varying the sequence of future outcomes."
    )
    return _result(
        "Bootstrap",
        distribution,
        reasoning,
        _confidence_from_sample(len(returns), penalty=0.03),
        metadata={"simulations": simulations},
    )


def bayesian_model(ticker: str, bars: list[MarketBar], horizon_days: int) -> ModelResult:
    rng = random.Random(_seed(ticker, "Bayesian", horizon_days))
    prices = [bar.close for bar in bars]
    log_returns = _log_returns(prices)
    sample_mu = mean(log_returns)
    sigma = max(stdev(log_returns), 1e-6)
    prior_mu = 0.0
    prior_strength = 60
    n = len(log_returns)
    posterior_mu = ((n * sample_mu) + (prior_strength * prior_mu)) / max(n + prior_strength, 1)
    posterior_mu_sigma = sigma / math.sqrt(max(n + prior_strength, 1))
    distribution: list[float] = []
    for _ in range(50_000):
        sampled_mu = rng.gauss(posterior_mu, posterior_mu_sigma)
        terminal_log_return = rng.gauss(sampled_mu * horizon_days, sigma * math.sqrt(horizon_days))
        distribution.append(math.exp(terminal_log_return) - 1.0)

    reasoning = (
        "Bayesian estimation shrinks the noisy historical mean toward a neutral prior, so the result "
        "emphasizes uncertainty around expected return rather than treating the sample average as exact."
    )
    return _result(
        "Bayesian",
        distribution,
        reasoning,
        _confidence_from_sample(n, penalty=0.02),
        metadata={
            "prior_mean": prior_mu,
            "prior_strength_days": prior_strength,
            "posterior_daily_mean": round(posterior_mu, 8),
            "posterior_daily_uncertainty": round(posterior_mu_sigma, 8),
        },
    )


MODEL_RUNNERS = {
    "Historical": historical_simulation,
    "Monte Carlo": monte_carlo,
    "GARCH": garch_model,
    "EWMA": ewma_model,
    "Bootstrap": bootstrap_model,
    "Bayesian": bayesian_model,
}


def run_models(ticker: str, bars: list[MarketBar], horizon_days: int, selected: list[ModelName]) -> list[ModelResult]:
    output: list[ModelResult] = []
    for name in selected:
        runner = MODEL_RUNNERS[name]
        output.append(runner(ticker, bars, horizon_days))
    return output

