from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from pathlib import Path

from ..core.config import get_settings
from ..schemas import AnalysisResponse, ForecastPerformance, ModelResult


def _store_path() -> Path:
    return get_settings().data_dir / "forecasts.json"


def _read_all() -> list[dict]:
    path = _store_path()
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []


def _write_all(records: list[dict]) -> None:
    path = _store_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(records, indent=2, default=str), encoding="utf-8")


def save_analysis(analysis: AnalysisResponse) -> None:
    records = _read_all()
    records.append(analysis.model_dump(mode="json"))
    _write_all(records)


def list_analyses(limit: int = 50) -> list[dict]:
    return list(reversed(_read_all()))[:limit]


def get_analysis(analysis_id: str) -> AnalysisResponse | None:
    for item in _read_all():
        if item.get("analysis_id") == analysis_id:
            return AnalysisResponse.model_validate(item)
    return None


def performance_summary() -> list[ForecastPerformance]:
    records = _read_all()
    buckets: dict[str, dict[str, list[float] | int]] = {}
    today = date.today()

    for record in records:
        analysis_date = datetime.fromisoformat(record["analysis_time"]).date()
        horizon = int(record["horizon_days"])
        is_realized = analysis_date + timedelta(days=horizon) <= today
        for raw_result in record.get("model_results", []):
            result = ModelResult.model_validate(raw_result)
            bucket = buckets.setdefault(
                result.model,
                {"forecasts": 0, "realized": 0, "errors": [], "var_hits": [], "interval_hits": []},
            )
            bucket["forecasts"] = int(bucket["forecasts"]) + 1
            if is_realized:
                bucket["realized"] = int(bucket["realized"]) + 1
                # Realized pricing is intentionally not backfilled here unless a data source confirms it.
                # These placeholders keep the tracker structure ready for scheduled calibration jobs.
            else:
                continue

    output: list[ForecastPerformance] = []
    for model, bucket in buckets.items():
        forecasts = int(bucket["forecasts"])
        realized = int(bucket["realized"])
        pending = forecasts - realized
        errors = bucket["errors"] if isinstance(bucket["errors"], list) else []
        var_hits = bucket["var_hits"] if isinstance(bucket["var_hits"], list) else []
        interval_hits = bucket["interval_hits"] if isinstance(bucket["interval_hits"], list) else []
        output.append(
            ForecastPerformance(
                model=model,
                forecasts=forecasts,
                realized=realized,
                pending=pending,
                var_exceedance_rate=(sum(var_hits) / len(var_hits)) if var_hits else None,
                interval_hit_rate=(sum(interval_hits) / len(interval_hits)) if interval_hits else None,
                average_error=(sum(errors) / len(errors)) if errors else None,
            )
        )
    return sorted(output, key=lambda item: item.model)

