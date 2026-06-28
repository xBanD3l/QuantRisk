from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .core.config import get_settings
from .schemas import AnalysisRequest, AnalysisResponse, ExplainRequest, ExplainResponse
from .services.committee import answer_explainability_question, build_consensus, generate_committee
from .services.data import download_market_data
from .services.metrics import build_market_metrics
from .services.quant_models import run_models
from .services.report import build_pdf_report
from .services.storage import get_analysis, list_analyses, performance_summary, save_analysis


settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze(request: AnalysisRequest) -> AnalysisResponse:
    ticker = request.ticker.upper().strip()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required.")

    bars = download_market_data(ticker)
    benchmark_bars = download_market_data(request.benchmark) if request.benchmark else None
    metrics = build_market_metrics(bars, benchmark_bars)
    results = run_models(ticker, bars, request.horizon_days, request.models)
    committee = await generate_committee(request.ai_provider, request.api_key, results)
    consensus = build_consensus(results)

    analysis = AnalysisResponse(
        analysis_id=str(uuid4()),
        ticker=ticker,
        horizon_days=request.horizon_days,
        analysis_time=datetime.now(timezone.utc),
        current_price=metrics.current_price,
        metrics=metrics,
        model_results=results,
        committee=committee,
        consensus=consensus,
    )
    save_analysis(analysis)
    return analysis


@app.get("/api/forecasts")
def forecasts() -> list[dict]:
    return list_analyses()


@app.get("/api/forecasts/performance")
def forecast_performance():
    return performance_summary()


@app.post("/api/explain", response_model=ExplainResponse)
def explain(request: ExplainRequest) -> ExplainResponse:
    analysis = get_analysis(request.analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    answer, cited = answer_explainability_question(request.question, analysis.model_results)
    return ExplainResponse(answer=answer, cited_models=cited)


@app.get("/api/reports/{analysis_id}.pdf")
def report(analysis_id: str):
    analysis = get_analysis(analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    try:
        path = build_pdf_report(analysis)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return FileResponse(path, media_type="application/pdf", filename=f"{analysis.ticker}_quant_committee_report.pdf")

