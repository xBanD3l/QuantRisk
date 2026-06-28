from __future__ import annotations

WATCHLISTS: dict[str, list[str]] = {
    "dow30": [
        "AAPL", "AMGN", "AXP", "BA", "CAT", "CRM", "CSCO", "CVX", "DIS", "DOW",
        "GS", "HD", "HON", "IBM", "INTC", "JNJ", "JPM", "KO", "MCD", "MMM",
        "MRK", "MSFT", "NKE", "PG", "TRV", "UNH", "V", "VZ", "WMT", "AMZN",
    ],
    "nasdaq100": [
        "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "AVGO", "TSLA", "COST", "NFLX",
        "AMD", "PEP", "ADBE", "CSCO", "LIN", "TMUS", "CMCSA", "INTU", "QCOM", "TXN",
        "AMGN", "HON", "AMAT", "BKNG", "PANW", "SBUX", "ISRG", "GILD", "ADP", "MU",
        "LRCX", "REGN", "MDLZ", "SNPS", "CDNS", "KLAC", "MELI", "PYPL", "CRWD", "MAR",
    ],
    "etfs": ["SPY", "QQQ", "IWM", "DIA", "VTI", "XLF", "XLK", "XLE", "HYG", "TLT", "EFA", "EEM"],
}


def resolve_watchlist(name: str, custom: list[str] | None = None) -> list[str]:
    key = name.lower().strip()
    if key == "custom" and custom:
        return [ticker.upper().strip() for ticker in custom if ticker.strip()]
    tickers = WATCHLISTS.get(key)
    if tickers is None:
        raise ValueError(f"Unknown watchlist '{name}'.")
    return tickers.copy()
