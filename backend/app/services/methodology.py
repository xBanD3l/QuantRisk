from __future__ import annotations

from ..schemas import ModelMethodology


METHODOLOGY: dict[str, ModelMethodology] = {
    "Historical": ModelMethodology(
        model="Historical",
        purpose=(
            "Estimate the distribution of horizon returns by replaying every contiguous historical "
            "window of equal length and measuring empirical tail outcomes."
        ),
        assumptions=[
            "Past realized return sequences contain information about future outcomes.",
            "No parametric distributional form is imposed on returns.",
            "The available sample is representative of near-term market conditions.",
        ],
        equations=[
            r"R_{t,T} = \prod_{i=1}^{T}(1 + r_{t+i}) - 1",
            r"\text{VaR}_\alpha = \text{Quantile}_\alpha(R_{t,T})",
            r"\text{ES}_\alpha = E[R_{t,T} \mid R_{t,T} \le \text{VaR}_\alpha]",
        ],
        strengths=[
            "Captures realized skew and fat tails already present in the sample.",
            "Transparent and easy to audit.",
        ],
        weaknesses=[
            "Cannot extrapolate beyond observed extremes.",
            "Sensitive to regime shifts not represented in the lookback.",
        ],
        complexity="O(n·T) where n is the number of return observations and T is the forecast horizon.",
        references=[
            "Morgan, J. P. (1996). RiskMetrics Technical Document.",
            "Dowd, K. (2005). Measuring Market Risk.",
        ],
    ),
    "Monte Carlo": ModelMethodology(
        model="Monte Carlo",
        purpose=(
            "Simulate many forward price paths under geometric Brownian motion to produce a full "
            "terminal return distribution and fan of possible paths."
        ),
        assumptions=[
            r"Log returns follow a Brownian motion with constant drift and volatility.",
            "Parameters are estimated from historical daily log returns.",
            "Paths are independent and identically distributed.",
        ],
        equations=[
            r"S_{t+1} = S_t \exp\left((\mu - \frac{1}{2}\sigma^2)\Delta t + \sigma \sqrt{\Delta t}\,\varepsilon\right)",
            r"R_T = \frac{S_T}{S_0} - 1",
        ],
        strengths=[
            "Produces a complete forward distribution rather than a single point estimate.",
            "Separates central tendency from tail risk.",
        ],
        weaknesses=[
            "Constant volatility ignores clustering and jumps.",
            "Drift estimates are noisy in short samples.",
        ],
        complexity="O(N·T) for N simulated paths over T forecast days.",
        references=[
            "Glasserman, P. (2003). Monte Carlo Methods in Financial Engineering.",
            "Hull, J. C. (2018). Options, Futures, and Other Derivatives.",
        ],
    ),
    "GARCH": ModelMethodology(
        model="GARCH",
        purpose=(
            "Forecast horizon risk by propagating conditional volatility forward when recent shocks "
            "indicate volatility clustering."
        ),
        assumptions=[
            "Conditional variance depends on past squared residuals.",
            "Volatility mean-reverts to a long-run level.",
            "Return shocks are drawn from a parametric distribution after scaling by forecast variance.",
        ],
        equations=[
            r"\sigma_t^2 = \omega + \alpha \varepsilon_{t-1}^2 + \beta \sigma_{t-1}^2",
            r"\sigma_{t+h}^2 = \omega + (\alpha + \beta)\sigma_{t+h-1}^2",
        ],
        strengths=[
            "Responsive to recent volatility shocks.",
            "Useful for dynamic VaR and regime-sensitive downside estimates.",
        ],
        weaknesses=[
            "Mean return remains difficult to estimate reliably.",
            "Can overreact after temporary volatility spikes.",
        ],
        complexity="O(T + N) for T forecast steps and N Monte Carlo draws.",
        references=[
            "Bollerslev, T. (1986). Generalized Autoregressive Conditional Heteroskedasticity.",
            "Engle, R. F. (1982). Autoregressive Conditional Heteroskedasticity.",
        ],
    ),
    "EWMA": ModelMethodology(
        model="EWMA",
        purpose=(
            "Estimate near-term volatility by exponentially weighting recent squared returns, then "
            "scale horizon risk from the latest volatility state."
        ),
        assumptions=[
            "Recent observations carry more information than distant observations.",
            "A fixed decay parameter governs memory of past shocks.",
        ],
        equations=[
            r"\sigma_t^2 = \lambda \sigma_{t-1}^2 + (1-\lambda) r_{t-1}^2",
            r"\sigma_T = \sqrt{T \cdot \sigma_t^2}",
        ],
        strengths=[
            "Simple, fast, and responsive risk monitor.",
            "Works well when recent volatility is the primary concern.",
        ],
        weaknesses=[
            "Fixed decay parameter may not fit all assets or regimes.",
            "Does not model structural breaks explicitly.",
        ],
        complexity="O(n + N) for n return observations and N simulation draws.",
        references=[
            "RiskMetrics (1996). Technical Document.",
            "JP Morgan/Reuters (1996). RiskMetrics Methodology.",
        ],
    ),
    "Bootstrap": ModelMethodology(
        model="Bootstrap",
        purpose=(
            "Construct a non-parametric horizon return distribution by resampling historical daily "
            "returns with replacement."
        ),
        assumptions=[
            "Observed daily returns are exchangeable for resampling purposes.",
            "The empirical return sample contains relevant downside events.",
        ],
        equations=[
            r"R_T^{(b)} = \prod_{i=1}^{T}(1 + r_i^{*}) - 1, \quad r_i^{*} \sim \text{Empirical}(r)",
        ],
        strengths=[
            "Robust to unknown return distribution shape.",
            "Highlights sampling variability in historical outcomes.",
        ],
        weaknesses=[
            "Cannot create more extreme events than those already observed.",
            "Ignores time ordering unless block bootstrap is used.",
        ],
        complexity="O(B·T) for B bootstrap replications over horizon T.",
        references=[
            "Efron, B. (1979). Bootstrap Methods: Another Look at the Jackknife.",
            "Politis, D. N., & Romano, J. P. (1994). The Stationary Bootstrap.",
        ],
    ),
    "Bayesian": ModelMethodology(
        model="Bayesian",
        purpose=(
            "Shrink noisy historical mean estimates toward a neutral prior and propagate posterior "
            "uncertainty into the horizon return distribution."
        ),
        assumptions=[
            "Expected return is uncertain and should not be treated as exact.",
            "A conjugate-style prior shrinks the sample mean toward a neutral benchmark.",
        ],
        equations=[
            r"\mu_{\text{post}} = \frac{n\bar{r} + \kappa \mu_0}{n + \kappa}",
            r"\sigma_{\mu,\text{post}} = \frac{\sigma}{\sqrt{n + \kappa}}",
        ],
        strengths=[
            "Reduces overconfidence in short-sample mean estimates.",
            "Makes uncertainty around expected return explicit.",
        ],
        weaknesses=[
            "Results depend on prior mean and prior strength.",
            "Does not resolve volatility or regime uncertainty by itself.",
        ],
        complexity="O(N) for N posterior simulation draws.",
        references=[
            "Black, F., & Litterman, R. (1992). Global Portfolio Optimization.",
            "Gelman, A., et al. (2013). Bayesian Data Analysis.",
        ],
    ),
}


def list_methodologies() -> list[ModelMethodology]:
    return list(METHODOLOGY.values())


def get_methodology(model: str) -> ModelMethodology | None:
    return METHODOLOGY.get(model)
