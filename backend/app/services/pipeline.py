from __future__ import annotations

import json
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from ..schemas import AnalysisRequest, AnalysisResponse
from .analogs import find_historical_analogs
from .committee import build_consensus, generate_committee
from .data import download_market_data
from .metrics import build_market_metrics
from .quant_models import MODEL_RUNNERS
from .regime import detect_market_regime
from .storage import save_analysis


def format_sse(event: str, payload: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, default=str)}\n\n"


async def build_analysis_response(request: AnalysisRequest, user_id: str | None = None) -> AnalysisResponse:
    ticker = request.ticker.upper().strip()
    bars = download_market_data(ticker)
    benchmark_bars = download_market_data(request.benchmark) if request.benchmark else None
    metrics = build_market_metrics(bars, benchmark_bars)
    market_regime = detect_market_regime(bars, benchmark_bars)
    historical_analogs = find_historical_analogs(bars, request.horizon_days)
    model_results = [
        MODEL_RUNNERS[name](ticker, bars, request.horizon_days, request.confidence_level)
        for name in request.models
    ]
    consensus = build_consensus(model_results, market_regime)
    committee = await generate_committee(request.ai_provider, request.api_key, model_results)

    analysis = AnalysisResponse(
        analysis_id=str(uuid4()),
        ticker=ticker,
        horizon_days=request.horizon_days,
        confidence_level=request.confidence_level,
        analysis_time=datetime.now(timezone.utc),
        current_price=metrics.current_price,
        metrics=metrics,
        market_regime=market_regime,
        historical_analogs=historical_analogs,
        model_results=model_results,
        committee=committee,
        consensus=consensus,
    )
    save_analysis(analysis, user_id=user_id)
    return analysis


async def stream_analysis_events(request: AnalysisRequest, user_id: str | None = None) -> AsyncIterator[str]:
    try:
        ticker = request.ticker.upper().strip()
        total_steps = 4 + len(request.models) + 3
        step_index = 0

        yield format_sse("pipeline", {"step": "Downloading Market Data...", "index": step_index, "total": total_steps})
        step_index += 1
        bars = download_market_data(ticker)
        benchmark_bars = download_market_data(request.benchmark) if request.benchmark else None

        yield format_sse("pipeline", {"step": "Calculating Returns...", "index": step_index, "total": total_steps})
        step_index += 1
        metrics = build_market_metrics(bars, benchmark_bars)
        yield format_sse("metrics", metrics.model_dump(mode="json"))

        yield format_sse("pipeline", {"step": "Detecting Market Regime...", "index": step_index, "total": total_steps})
        step_index += 1
        market_regime = detect_market_regime(bars, benchmark_bars)
        yield format_sse("regime", market_regime.model_dump(mode="json"))

        yield format_sse("pipeline", {"step": "Finding Historical Analogs...", "index": step_index, "total": total_steps})
        step_index += 1
        historical_analogs = find_historical_analogs(bars, request.horizon_days)
        yield format_sse("analogs", [item.model_dump(mode="json") for item in historical_analogs])

        model_results = []
        for model_name in request.models:
            yield format_sse(
                "pipeline",
                {"step": f"Running {model_name}...", "index": step_index, "total": total_steps, "model": model_name},
            )
            step_index += 1
            result = MODEL_RUNNERS[model_name](ticker, bars, request.horizon_days, request.confidence_level)
            model_results.append(result)
            yield format_sse("model", result.model_dump(mode="json"))

        yield format_sse("pipeline", {"step": "Comparing Results...", "index": step_index, "total": total_steps})
        step_index += 1
        consensus = build_consensus(model_results, market_regime)
        yield format_sse("consensus", consensus.model_dump(mode="json"))

        yield format_sse("pipeline", {"step": "Convening Quant Committee...", "index": step_index, "total": total_steps})
        step_index += 1
        committee = await generate_committee(request.ai_provider, request.api_key, model_results)
        for statement in committee:
            yield format_sse("committee", statement.model_dump(mode="json"))

        yield format_sse("pipeline", {"step": "Generating Research Report...", "index": step_index, "total": total_steps})

        analysis = AnalysisResponse(
            analysis_id=str(uuid4()),
            ticker=ticker,
            horizon_days=request.horizon_days,
            confidence_level=request.confidence_level,
            analysis_time=datetime.now(timezone.utc),
            current_price=metrics.current_price,
            metrics=metrics,
            market_regime=market_regime,
            historical_analogs=historical_analogs,
            model_results=model_results,
            committee=committee,
            consensus=consensus,
        )
        save_analysis(analysis, user_id=user_id)
        yield format_sse("complete", analysis.model_dump(mode="json"))
    except Exception as exc:
        yield format_sse("error", {"message": str(exc)})
