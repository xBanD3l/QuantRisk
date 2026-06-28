from __future__ import annotations

from .ai import PERSONAS, LocalCommitteeAdapter, compact_model_evidence, make_adapter, pct, prob
from .math_utils import clamp, mean, stdev
from ..schemas import CommitteeDebate, CommitteeStatement, ConsensusMetrics, ConsensusReport, MarketRegime, ModelResult


async def generate_committee(provider: str, api_key: str | None, results: list[ModelResult]) -> list[CommitteeStatement]:
    adapter = make_adapter(provider, api_key)
    fallback = LocalCommitteeAdapter(None)
    statements: list[CommitteeStatement] = []

    for result in results:
        persona = PERSONAS.get(result.model)
        if persona is None:
            continue
        statement = await adapter.generate_statement(persona, result, [peer for peer in results if peer.model != result.model])
        if not statement:
            statement = await fallback.generate_statement(
                persona,
                result,
                [peer for peer in results if peer.model != result.model],
            )
        statements.append(
            CommitteeStatement(
                persona=persona.name,
                role=persona.role,
                model=result.model,
                statement=statement or "",
                evidence=compact_model_evidence(result),
            )
        )

    return statements


def weighted_average(results: list[ModelResult], attr: str) -> float:
    weights = [max(result.confidence_score, 0.05) for result in results]
    total = sum(weights)
    return sum(getattr(result, attr) * weight for result, weight in zip(results, weights)) / total


def build_consensus(results: list[ModelResult], market_regime: MarketRegime | None = None) -> ConsensusReport:
    expected = [result.expected_return for result in results]
    probabilities = [result.prob_positive for result in results]
    weighted_expected = weighted_average(results, "expected_return")
    weighted_prob = weighted_average(results, "prob_positive")
    weighted_var = weighted_average(results, "var95")
    weighted_es = weighted_average(results, "expected_shortfall")

    dispersion_return = stdev(expected)
    dispersion_prob = stdev(probabilities)
    agreement_score = clamp(1.0 - min(dispersion_return / 0.10, 1.0) * 0.62 - min(dispersion_prob / 0.28, 1.0) * 0.38)
    overall_confidence = clamp(mean([result.confidence_score for result in results]) * 0.68 + agreement_score * 0.32)

    if agreement_score >= 0.74:
        agreement_level = "High"
    elif agreement_score >= 0.52:
        agreement_level = "Moderate"
    else:
        agreement_level = "Low"

    if weighted_expected > 0.035 and weighted_prob > 0.58:
        outlook = "Bullish"
        direction = "Positive"
    elif weighted_expected > 0.01 and weighted_prob > 0.52:
        outlook = "Moderately Bullish"
        direction = "Positive"
    elif weighted_expected < -0.035 and weighted_prob < 0.42:
        outlook = "Bearish"
        direction = "Negative"
    elif weighted_expected < -0.01 and weighted_prob < 0.48:
        outlook = "Moderately Bearish"
        direction = "Negative"
    else:
        outlook = "Neutral"
        direction = "Mixed"

    debate = _build_debate(results, agreement_level)
    risks = _build_risks(results, weighted_var, weighted_es, agreement_level)
    assumptions = sorted({assumption for result in results for assumption in result.assumptions})[:7]

    most_optimistic = max(results, key=lambda result: result.expected_return)
    most_conservative = min(results, key=lambda result: result.var95)
    disagreement = _most_influential_disagreement(results)

    metrics = _build_consensus_metrics(
        results=results,
        agreement_score=agreement_score,
        overall_confidence=overall_confidence,
        weighted_var=weighted_var,
        market_regime=market_regime,
        most_optimistic=most_optimistic.model,
        most_conservative=most_conservative.model,
        disagreement=disagreement,
    )

    executive_summary = (
        f"The Quant Committee consensus is {outlook.lower()} with {agreement_level.lower()} model agreement. "
        f"Across selected models, the confidence-weighted probability of a positive return is {prob(weighted_prob)}, "
        f"while the weighted VaR is {pct(weighted_var)} and expected shortfall is {pct(weighted_es)}. "
        f"The most optimistic model is {most_optimistic.model}; the most conservative downside estimate comes from "
        f"{most_conservative.model}. Overall confidence is {prob(overall_confidence)} because model-level confidence "
        f"({prob(mean([result.confidence_score for result in results]))}) is combined with cross-model agreement "
        f"({prob(agreement_score)}). The dominant risk remains tail exposure at {pct(weighted_es)} expected shortfall. "
        "All figures are model-produced; the moderator adds synthesis only."
    )

    return ConsensusReport(
        outlook=outlook,
        consensus_direction=direction,
        agreement_level=agreement_level,
        estimated_prob_positive=round(weighted_prob, 6),
        var95=round(weighted_var, 6),
        expected_shortfall=round(weighted_es, 6),
        model_agreement_score=round(agreement_score, 6),
        overall_confidence=round(overall_confidence, 6),
        key_risks=risks,
        key_assumptions=assumptions,
        executive_summary=executive_summary,
        committee_debate=debate,
        metrics=metrics,
    )


def _most_influential_disagreement(results: list[ModelResult]) -> str:
    if len(results) < 2:
        return "Insufficient models selected to identify a meaningful disagreement."
    highest_return = max(results, key=lambda result: result.expected_return)
    lowest_return = min(results, key=lambda result: result.expected_return)
    highest_risk = min(results, key=lambda result: result.var95)
    spread = highest_return.expected_return - lowest_return.expected_return
    if spread >= abs(highest_risk.var95 - max(results, key=lambda result: result.var95).var95):
        return (
            f"{highest_return.model} vs {lowest_return.model} on expected return "
            f"({pct(highest_return.expected_return)} vs {pct(lowest_return.expected_return)})."
        )
    return (
        f"{highest_risk.model} vs other models on downside tail risk "
        f"(VaR {pct(highest_risk.var95)})."
    )


def _build_consensus_metrics(
    results: list[ModelResult],
    agreement_score: float,
    overall_confidence: float,
    weighted_var: float,
    market_regime: MarketRegime | None,
    most_optimistic: str,
    most_conservative: str,
    disagreement: str,
) -> ConsensusMetrics:
    expected_values = [result.expected_return for result in results]
    var_values = [result.var95 for result in results]
    prob_values = [result.prob_positive for result in results]
    diversity = clamp(stdev(expected_values) / 0.12 + stdev(prob_values) / 0.22)
    stability = clamp(1.0 - diversity * 0.72)

    if weighted_var <= -0.12:
        tail_risk = "Severe"
    elif weighted_var <= -0.08:
        tail_risk = "Elevated"
    elif weighted_var <= -0.04:
        tail_risk = "Moderate"
    else:
        tail_risk = "Low"

    volatility_regime = market_regime.volatility_regime if market_regime else "Unknown"

    return ConsensusMetrics(
        committee_agreement_score=round(agreement_score, 6),
        forecast_confidence=round(overall_confidence, 6),
        tail_risk_rating=tail_risk,
        model_diversity_score=round(diversity, 6),
        volatility_regime=volatility_regime,
        prediction_stability=round(stability, 6),
        most_optimistic_model=most_optimistic,
        most_conservative_model=most_conservative,
        most_influential_disagreement=disagreement,
        computation_notes={
            "committee_agreement_score": (
                "1 minus weighted dispersion of expected returns (62%) and probability-positive estimates (38%), "
                "normalized against 10% return spread and 28% probability spread."
            ),
            "forecast_confidence": (
                "68% average model confidence score plus 32% committee agreement score."
            ),
            "tail_risk_rating": (
                "Bucketed from confidence-weighted VaR: Low (> -4%), Moderate (-4% to -8%), "
                "Elevated (-8% to -12%), Severe (< -12%)."
            ),
            "model_diversity_score": (
                "Normalized cross-model dispersion of expected return and probability-positive outputs; "
                "higher values indicate more methodological disagreement."
            ),
            "prediction_stability": (
                "Inverse of model diversity after scaling; higher values indicate tighter cross-model alignment."
            ),
            "volatility_regime": (
                "Taken from market regime detection using the short-to-long realized volatility ratio."
            ),
        },
    )


def _build_debate(results: list[ModelResult], agreement_level: str) -> CommitteeDebate:
    highest_return = max(results, key=lambda result: result.expected_return)
    lowest_return = min(results, key=lambda result: result.expected_return)
    highest_risk = min(results, key=lambda result: result.var95)
    highest_confidence = max(results, key=lambda result: result.confidence_score)
    positive_count = sum(1 for result in results if result.prob_positive >= 0.5)
    negative_count = len(results) - positive_count

    agreements = [
        f"{positive_count} of {len(results)} models assign at least a 50% probability to a positive return.",
        f"The committee agreement level is {agreement_level.lower()} after comparing expected-return and probability dispersion.",
    ]
    disagreements = [
        f"{highest_return.model} has the highest expected return at {pct(highest_return.expected_return)}, while "
        f"{lowest_return.model} is lowest at {pct(lowest_return.expected_return)}.",
        f"{highest_risk.model} is the most conservative VaR contributor with a 95% VaR of {pct(highest_risk.var95)}.",
    ]
    assumption_conflicts = [
        "Parametric models impose distributional structure, while Historical and Bootstrap rely directly on observed returns.",
        "GARCH and EWMA emphasize recent volatility conditions more than Historical Simulation.",
    ]
    outliers = _outliers(results)
    uncertainty_sources = [
        "Expected return is statistically noisy relative to volatility.",
        "Future volatility regime may differ from the historical lookback window.",
        "Tail risk estimates depend on whether recent or long-run volatility receives more weight.",
        f"{highest_confidence.model} carries the highest model confidence score at {prob(highest_confidence.confidence_score)}.",
    ]
    if negative_count and positive_count:
        uncertainty_sources.append("The committee is split on direction, increasing interpretation risk.")

    return CommitteeDebate(
        agreements=agreements,
        disagreements=disagreements,
        assumption_conflicts=assumption_conflicts,
        outliers=outliers,
        uncertainty_sources=uncertainty_sources,
    )


def _outliers(results: list[ModelResult]) -> list[str]:
    expected_values = [result.expected_return for result in results]
    center = mean(expected_values)
    spread = stdev(expected_values)
    output: list[str] = []
    if spread <= 0:
        return ["No model is a clear expected-return outlier."]
    for result in results:
        if abs(result.expected_return - center) > 1.25 * spread:
            output.append(f"{result.model} is an expected-return outlier at {pct(result.expected_return)}.")
    return output or ["No model is a clear expected-return outlier."]


def _build_risks(results: list[ModelResult], weighted_var: float, weighted_es: float, agreement_level: str) -> list[str]:
    risks = [
        f"Weighted 95% VaR is {pct(weighted_var)}, with weighted expected shortfall of {pct(weighted_es)}.",
        "Model risk remains material because each method encodes different assumptions about volatility and sampling.",
    ]
    risk_model = min(results, key=lambda result: result.expected_shortfall)
    risks.append(f"{risk_model.model} contributes the most severe expected shortfall at {pct(risk_model.expected_shortfall)}.")
    if agreement_level == "Low":
        risks.append("Low committee agreement means directional conviction should be treated cautiously.")
    for result in results:
        regime = result.metadata.get("regime")
        if isinstance(regime, str) and "elevated" in regime:
            risks.append(f"{result.model} identifies an elevated volatility regime.")
            break
    return risks[:5]


def answer_explainability_question(question: str, results: list[ModelResult]) -> tuple[str, list[str]]:
    lower = question.lower()
    cited: list[str] = []

    if "var" in lower or "risk" in lower:
        risk_model = min(results, key=lambda result: result.var95)
        cited.append(risk_model.model)
        return (
            f"VaR is driven by the lower tail of the model distributions. {risk_model.model} is the most conservative "
            f"selected model with 95% VaR of {pct(risk_model.var95)} and expected shortfall of "
            f"{pct(risk_model.expected_shortfall)}, so the dashboard flags downside exposure through that tail estimate.",
            cited,
        )

    if "garch" in lower:
        match = next((result for result in results if result.model == "GARCH"), None)
        if match:
            cited.append("GARCH")
            regime = match.metadata.get("regime", "its conditional-volatility estimate")
            return (
                f"GARCH differs when recent shocks change conditional volatility. In this run it reports {regime}, "
                f"with 95% VaR of {pct(match.var95)} and probability positive of {prob(match.prob_positive)}.",
                cited,
            )

    if "weight" in lower or "carry more" in lower:
        leader = max(results, key=lambda result: result.confidence_score)
        cited.append(leader.model)
        return (
            f"The strongest single-model weight belongs to {leader.model}, which has the highest confidence score "
            f"at {prob(leader.confidence_score)}. That does not make it automatically correct; it means the model's "
            "sample support and assumptions are comparatively stronger in this run.",
            cited,
        )

    if "confidence" in lower:
        consensus = build_consensus(results)
        cited = [result.model for result in results]
        return (
            f"Overall confidence reflects both individual model confidence and cross-model agreement. Here the model "
            f"agreement score is {prob(consensus.model_agreement_score)} and overall confidence is "
            f"{prob(consensus.overall_confidence)}, so disagreement or metric dispersion directly lowers conviction.",
            cited,
        )

    cited = [result.model for result in results[:3]]
    consensus = build_consensus(results)
    return (
        f"The most relevant committee summary is {consensus.outlook.lower()}: probability positive is "
        f"{prob(consensus.estimated_prob_positive)}, 95% VaR is {pct(consensus.var95)}, and expected shortfall is "
        f"{pct(consensus.expected_shortfall)}. This answer is synthesized from the selected model outputs only.",
        cited,
    )

