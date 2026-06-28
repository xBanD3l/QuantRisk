from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from .auth import get_user_id, require_user_id
from .core.config import get_settings
from .schemas import (
    AnalysisRequest,
    AnalysisResponse,
    AnalyticsEvent,
    CalibrationSummary,
    ExplainRequest,
    ExplainResponse,
    ModelMethodology,
    PortfolioRequest,
    PortfolioResponse,
    ResearchRequest,
    ResearchResponse,
    SavedItem,
    SaveItemRequest,
    UserWorkspace,
)
from .services.analytics import analytics_summary, track_event
from .services.calibration import calibrate_stored_forecasts, performance_summary
from .services.committee import answer_explainability_question
from .services.methodology import get_methodology, list_methodologies
from .services.pipeline import build_analysis_response, stream_analysis_events
from .services.portfolio import analyze_portfolio
from .services.report import build_pdf_report
from .services.research import run_research_scan
from .services.storage import get_analysis, list_analyses
from .services.user_storage import (
    add_recent_search,
    get_workspace,
    list_saved_items,
    save_item,
    toggle_favorite,
    upsert_user_profile,
)
from .services.watchlists import WATCHLISTS


settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://quant-risk.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name, "version": "0.2.0"}


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze(
    request: AnalysisRequest,
    user_id: str | None = Depends(get_user_id),
) -> AnalysisResponse:
    ticker = request.ticker.upper().strip()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required.")
    track_event("analysis_run", {"ticker": ticker, "user_id": user_id or "anonymous"})
    if user_id:
        upsert_user_profile(user_id, None, None, None)
        add_recent_search(user_id, ticker)
    return await build_analysis_response(request, user_id=user_id)


@app.post("/api/analyze/stream")
async def analyze_stream(
    request: AnalysisRequest,
    user_id: str | None = Depends(get_user_id),
) -> StreamingResponse:
    ticker = request.ticker.upper().strip()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required.")
    track_event("analysis_stream", {"ticker": ticker, "user_id": user_id or "anonymous"})
    if user_id:
        add_recent_search(user_id, ticker)
    return StreamingResponse(
        stream_analysis_events(request, user_id=user_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@app.post("/api/portfolio/analyze", response_model=PortfolioResponse)
def portfolio_analyze(
    request: PortfolioRequest,
    user_id: str | None = Depends(get_user_id),
) -> PortfolioResponse:
    track_event("portfolio_run", {"holdings": len(request.holdings), "user_id": user_id or "anonymous"})
    try:
        return analyze_portfolio(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/research/scan", response_model=ResearchResponse)
def research_scan(
    request: ResearchRequest,
    user_id: str | None = Depends(get_user_id),
) -> ResearchResponse:
    track_event("research_scan", {"watchlist": request.watchlist, "user_id": user_id or "anonymous"})
    try:
        return run_research_scan(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/research/watchlists")
def research_watchlists() -> dict[str, list[str] | dict[str, int]]:
    return {
        "watchlists": {key: len(value) for key, value in WATCHLISTS.items()},
        "labels": {"dow30": "Dow 30", "nasdaq100": "Nasdaq 100", "etfs": "Major ETFs"},
    }


@app.get("/api/methodology", response_model=list[ModelMethodology])
def methodologies() -> list[ModelMethodology]:
    return list_methodologies()


@app.get("/api/methodology/{model}", response_model=ModelMethodology)
def methodology(model: str) -> ModelMethodology:
    entry = get_methodology(model)
    if entry is None:
        raise HTTPException(status_code=404, detail="Model methodology not found.")
    return entry


@app.get("/api/forecasts")
def forecasts(user_id: str | None = Depends(get_user_id)) -> list[dict]:
    return list_analyses(user_id=user_id)


@app.post("/api/forecasts/calibrate", response_model=CalibrationSummary)
def calibrate_forecasts() -> CalibrationSummary:
    return calibrate_stored_forecasts()


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
    track_event("report_download", {"analysis_id": analysis_id, "ticker": analysis.ticker})
    try:
        path = build_pdf_report(analysis)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return FileResponse(path, media_type="application/pdf", filename=f"{analysis.ticker}_quant_committee_report.pdf")


@app.post("/api/analytics/event")
def analytics_event(
    event: AnalyticsEvent,
    user_id: str | None = Depends(get_user_id),
) -> dict[str, str]:
    metadata = {key: str(value) for key, value in event.metadata.items()}
    if user_id:
        metadata["user_id"] = user_id
    track_event(event.event, metadata)
    return {"status": "ok"}


@app.get("/api/analytics/summary")
def analytics() -> dict:
    return analytics_summary()


@app.get("/api/users/me", response_model=UserWorkspace)
def user_workspace(user_id: str = Depends(require_user_id)) -> UserWorkspace:
    return get_workspace(user_id)


@app.post("/api/users/profile", response_model=UserWorkspace)
def user_profile(
    name: str | None = None,
    email: str | None = None,
    image: str | None = None,
    user_id: str = Depends(require_user_id),
) -> UserWorkspace:
    return upsert_user_profile(user_id, name, email, image)


@app.post("/api/users/favorites/{ticker}", response_model=UserWorkspace)
def favorite_ticker(ticker: str, user_id: str = Depends(require_user_id)) -> UserWorkspace:
    return toggle_favorite(user_id, ticker)


@app.get("/api/users/saved", response_model=list[SavedItem])
def saved_items(
    item_type: str | None = None,
    user_id: str = Depends(require_user_id),
) -> list[SavedItem]:
    return list_saved_items(user_id, item_type)


@app.post("/api/users/saved", response_model=SavedItem)
def create_saved_item(
    body: SaveItemRequest,
    user_id: str = Depends(require_user_id),
) -> SavedItem:
    return save_item(user_id, body.item_type, body.title, body.payload)
