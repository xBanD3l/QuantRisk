from __future__ import annotations

from datetime import date, datetime, timedelta

from .data import download_market_data
from .portfolio import realized_horizon_return, trading_days_between
from ..schemas import CalibrationSummary, ForecastPerformance, ModelResult
from .storage import _read_all, _write_all


def _analysis_start_date(record: dict) -> date:
    return datetime.fromisoformat(record["analysis_time"]).date()


def _is_mature(record: dict, today: date | None = None) -> bool:
    today = today or date.today()
    start = _analysis_start_date(record)
    horizon = int(record["horizon_days"])
    return trading_days_between(start, today) >= horizon


def evaluate_record(record: dict, today: date | None = None) -> dict[str, dict[str, float | int | bool]] | None:
    if not _is_mature(record, today):
        return None

    ticker = str(record["ticker"]).upper()
    start = _analysis_start_date(record)
    horizon = int(record["horizon_days"])
    bars = download_market_data(ticker)
    realized = realized_horizon_return(bars, start, horizon)
    if realized is None:
        return None

    output: dict[str, dict[str, float | int | bool]] = {}
    for raw_result in record.get("model_results", []):
        result = ModelResult.model_validate(raw_result)
        interval = result.confidence_interval
        output[result.model] = {
            "realized_return": round(realized, 6),
            "expected_return": result.expected_return,
            "error": round(abs(realized - result.expected_return), 6),
            "var_exceeded": int(realized <= result.var95),
            "interval_hit": int(interval[0] <= realized <= interval[1]),
        }
    return output


def calibrate_stored_forecasts(today: date | None = None) -> CalibrationSummary:
    today = today or date.today()
    records = _read_all()
    updated = 0
    evaluated = 0
    pending = 0

    for record in records:
        if _is_mature(record, today):
            evaluation = evaluate_record(record, today)
            if evaluation is None:
                pending += 1
                continue
            record["calibration"] = {
                "evaluated_at": today.isoformat(),
                "models": evaluation,
            }
            updated += 1
            evaluated += 1
        else:
            pending += 1

    _write_all(records)
    return CalibrationSummary(
        records=len(records),
        evaluated=evaluated,
        updated=updated,
        pending=pending,
    )


def performance_summary() -> list[ForecastPerformance]:
    records = _read_all()
    buckets: dict[str, dict[str, list[float] | int]] = {}
    today = date.today()

    for record in records:
        horizon = int(record["horizon_days"])
        mature = _is_mature(record, today)
        calibration = record.get("calibration")
        evaluation = None
        if isinstance(calibration, dict) and calibration.get("models"):
            evaluation = calibration["models"]
        elif mature:
            evaluation = evaluate_record(record, today)

        for raw_result in record.get("model_results", []):
            result = ModelResult.model_validate(raw_result)
            bucket = buckets.setdefault(
                result.model,
                {"forecasts": 0, "realized": 0, "errors": [], "var_hits": [], "interval_hits": []},
            )
            bucket["forecasts"] = int(bucket["forecasts"]) + 1
            if not mature:
                continue
            if not evaluation or result.model not in evaluation:
                continue

            stats = evaluation[result.model]
            bucket["realized"] = int(bucket["realized"]) + 1
            if isinstance(stats, dict):
                if "error" in stats:
                    bucket["errors"].append(float(stats["error"]))
                if "var_exceeded" in stats:
                    bucket["var_hits"].append(float(stats["var_exceeded"]))
                if "interval_hit" in stats:
                    bucket["interval_hits"].append(float(stats["interval_hit"]))

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
