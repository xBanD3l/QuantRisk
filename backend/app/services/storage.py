from __future__ import annotations

import json
from pathlib import Path

from ..core.config import get_settings
from ..schemas import AnalysisResponse


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


def save_analysis(analysis: AnalysisResponse, user_id: str | None = None) -> None:
    record = analysis.model_dump(mode="json")
    if user_id:
        record["user_id"] = user_id
    records = _read_all()
    records.append(record)
    _write_all(records)
    if user_id:
        user_path = get_settings().data_dir / "users" / user_id / "forecasts.json"
        user_path.parent.mkdir(parents=True, exist_ok=True)
        user_records: list[dict] = []
        if user_path.exists():
            try:
                user_records = json.loads(user_path.read_text(encoding="utf-8"))
            except Exception:
                user_records = []
        user_records.append(record)
        user_path.write_text(json.dumps(user_records, indent=2, default=str), encoding="utf-8")


def list_analyses(limit: int = 50, user_id: str | None = None) -> list[dict]:
    if user_id:
        user_path = get_settings().data_dir / "users" / user_id / "forecasts.json"
        if user_path.exists():
            try:
                records = json.loads(user_path.read_text(encoding="utf-8"))
                return list(reversed(records))[:limit]
            except Exception:
                pass
    return list(reversed(_read_all()))[:limit]


def get_analysis(analysis_id: str) -> AnalysisResponse | None:
    for item in _read_all():
        if item.get("analysis_id") == analysis_id:
            return AnalysisResponse.model_validate(item)
    return None

