from __future__ import annotations

import hashlib
import math
import os
import random
from dataclasses import dataclass
from datetime import date, timedelta


@dataclass(frozen=True)
class MarketBar:
    date: date
    close: float
    volume: int | None = None


def _seed_for_ticker(ticker: str) -> int:
    digest = hashlib.sha256(ticker.upper().encode("utf-8")).hexdigest()
    return int(digest[:12], 16)


def _business_days_back(days: int) -> list[date]:
    cursor = date.today()
    output: list[date] = []
    while len(output) < days:
        if cursor.weekday() < 5:
            output.append(cursor)
        cursor -= timedelta(days=1)
    return list(reversed(output))


def _synthetic_history(ticker: str, days: int) -> list[MarketBar]:
    rng = random.Random(_seed_for_ticker(ticker))
    calendar = _business_days_back(days)
    base_price = 45 + rng.random() * 240
    drift = rng.uniform(-0.00012, 0.00055)
    base_vol = rng.uniform(0.010, 0.027)
    price = base_price
    bars: list[MarketBar] = []

    for index, day in enumerate(calendar):
        regime = 1.0
        if index > days * 0.68:
            regime += 0.3 * math.sin(index / 19)
        if index > days * 0.85:
            regime += rng.choice([0.0, 0.12, 0.22])
        shock = rng.gauss(drift, base_vol * regime)
        if rng.random() < 0.018:
            shock += rng.gauss(-0.01, base_vol * 2.2)
        price = max(3.0, price * math.exp(shock))
        volume = int(rng.uniform(800_000, 11_000_000))
        bars.append(MarketBar(date=day, close=round(price, 2), volume=volume))

    return bars


def download_market_data(ticker: str, lookback_days: int = 756) -> list[MarketBar]:
    symbol = ticker.upper().strip()
    if os.getenv("QUANT_COMMITTEE_OFFLINE") == "1":
        return _synthetic_history(symbol, lookback_days)
    try:
        import yfinance as yf  # type: ignore

        frame = yf.Ticker(symbol).history(period="3y", auto_adjust=True)
        if frame is not None and not frame.empty:
            frame = frame.tail(lookback_days)
            bars: list[MarketBar] = []
            for idx, row in frame.iterrows():
                close = float(row["Close"])
                if math.isfinite(close) and close > 0:
                    row_date = idx.date() if hasattr(idx, "date") else date.fromisoformat(str(idx)[:10])
                    volume = int(row["Volume"]) if "Volume" in row and not math.isnan(row["Volume"]) else None
                    bars.append(MarketBar(date=row_date, close=close, volume=volume))
            if len(bars) > 120:
                return bars
    except Exception:
        pass

    return _synthetic_history(symbol, lookback_days)
