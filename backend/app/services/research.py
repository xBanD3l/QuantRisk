from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed

from .committee import build_consensus
from .data import download_market_data
from .math_utils import stdev
from .quant_models import run_models
from .regime import detect_market_regime
from .watchlists import resolve_watchlist
from ..schemas import ModelName, ResearchRequest, ResearchResponse, ResearchRow, ResearchSummary


FAST_MODELS: list[ModelName] = ["Historical", "EWMA", "Monte Carlo"]


def _scan_ticker(ticker: str, horizon_days: int, confidence_level: float, models: list[ModelName]) -> ResearchRow | None:
    try:
        bars = download_market_data(ticker)
        if len(bars) < 120:
            return None
        results = run_models(ticker, bars, horizon_days, models, confidence_level)
        consensus = build_consensus(results, detect_market_regime(bars))
        dispersion = stdev([result.expected_return for result in results])
        weighted_return = sum(r.expected_return for r in results) / len(results)
        return ResearchRow(
            ticker=ticker,
            expected_return=round(weighted_return, 6),
            var95=consensus.var95,
            expected_shortfall=consensus.expected_shortfall,
            prob_positive=consensus.estimated_prob_positive,
            agreement_score=consensus.model_agreement_score,
            confidence=consensus.overall_confidence,
            outlook=consensus.outlook,
            dispersion=round(dispersion, 6),
        )
    except Exception:
        return None


def run_research_scan(request: ResearchRequest) -> ResearchResponse:
    tickers = resolve_watchlist(request.watchlist, request.custom_tickers)
    if request.max_tickers:
        tickers = tickers[: request.max_tickers]

    models = request.models or FAST_MODELS
    rows: list[ResearchRow] = []

    workers = min(8, max(len(tickers), 1))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(_scan_ticker, ticker, request.horizon_days, request.confidence_level, models): ticker
            for ticker in tickers
        }
        for future in as_completed(futures):
            row = future.result()
            if row is not None:
                rows.append(row)

    rows.sort(key=lambda item: item.expected_return, reverse=True)
    summary = _build_summary(rows)
    return ResearchResponse(
        watchlist=request.watchlist,
        horizon_days=request.horizon_days,
        scanned=len(tickers),
        completed=len(rows),
        models=models,
        rows=rows,
        summary=summary,
    )


def _build_summary(rows: list[ResearchRow]) -> ResearchSummary:
    if not rows:
        return ResearchSummary(
            top_opportunities=[],
            highest_risk=[],
            largest_disagreements=[],
            most_stable=[],
        )

    by_return = sorted(rows, key=lambda item: item.expected_return, reverse=True)
    by_risk = sorted(rows, key=lambda item: item.var95)
    by_dispersion = sorted(rows, key=lambda item: item.dispersion, reverse=True)
    by_stability = sorted(rows, key=lambda item: item.agreement_score * item.confidence, reverse=True)

    return ResearchSummary(
        top_opportunities=[row.ticker for row in by_return[:5]],
        highest_risk=[row.ticker for row in by_risk[:5]],
        largest_disagreements=[row.ticker for row in by_dispersion[:5]],
        most_stable=[row.ticker for row in by_stability[:5]],
    )
