from datetime import date
from typing import Any

import httpx

from app.models import Bar, HistoryInterval, HistoryRange, Instrument, UpstreamApiError


KLINE_INTERVALS: dict[HistoryInterval, str] = {
    "1d": "101",
    "1wk": "102",
    "1mo": "103",
}


def _number_at(parts: list[str], index: int) -> float | None:
    try:
        return float(parts[index])
    except (IndexError, ValueError):
        return None


def range_to_begin_date(range_value: HistoryRange) -> str:
    today = date.today()
    if range_value == "1mo":
        month = today.month - 1
        year = today.year
        if month == 0:
            month = 12
            year -= 1
        return f"{year}{month:02d}01"
    if range_value in {"3mo", "6mo", "1y"}:
        return f"{today.year - 1}0101"
    if range_value == "5y":
        return f"{today.year - 5}0101"
    return "19900101"


def normalize_eastmoney_klines(payload: dict[str, Any]) -> list[Bar]:
    klines = (payload.get("data") or {}).get("klines")
    if not isinstance(klines, list):
        raise UpstreamApiError("Eastmoney response did not contain kline data")

    bars: list[Bar] = []
    for line in klines:
        parts = str(line).split(",")
        open_price = _number_at(parts, 1)
        close = _number_at(parts, 2)
        high = _number_at(parts, 3)
        low = _number_at(parts, 4)
        volume = _number_at(parts, 5) or 0

        if open_price is None or high is None or low is None or close is None:
            continue

        bars.append(Bar(
            time=parts[0],
            open=open_price,
            high=high,
            low=low,
            close=close,
            volume=int(volume),
        ))

    if not bars:
        raise UpstreamApiError("Eastmoney response did not contain usable bars")

    return bars


def fetch_eastmoney_history(instrument: Instrument, range_value: HistoryRange, interval: HistoryInterval) -> list[Bar]:
    if not instrument.providerSymbol:
        raise UpstreamApiError(f"Eastmoney provider symbol is missing for {instrument.symbol}")

    try:
        response = httpx.get(
            "https://push2his.eastmoney.com/api/qt/stock/kline/get",
            params={
                "secid": instrument.providerSymbol,
                "fields1": "f1,f2,f3,f4,f5,f6",
                "fields2": "f51,f52,f53,f54,f55,f56,f57,f58",
                "klt": KLINE_INTERVALS[interval],
                "fqt": "1",
                "beg": range_to_begin_date(range_value),
                "end": "20500101",
            },
            headers={"User-Agent": "quant-system/0.1"},
            timeout=10,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as error:
        raise UpstreamApiError(f"Eastmoney kline API returned HTTP {error.response.status_code}") from error
    except httpx.HTTPError as error:
        raise UpstreamApiError(f"Eastmoney kline API request failed: {error}") from error

    return normalize_eastmoney_klines(response.json())
