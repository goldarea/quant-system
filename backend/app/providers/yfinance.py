from collections.abc import Mapping
from datetime import date, datetime
from importlib import import_module
from typing import Any

from app.models import Bar, HistoryInterval, HistoryRange, Instrument, UpstreamApiError


def _is_missing(value: Any) -> bool:
    try:
        return value is None or value != value
    except Exception:
        return value is None


def _to_number(value: Any) -> float | None:
    if _is_missing(value) or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number else None


def _to_day(value: Any) -> str:
    if hasattr(value, "to_pydatetime"):
        value = value.to_pydatetime()
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)[:10]


def _row_value(row: Any, *keys: str) -> Any:
    for key in keys:
        if isinstance(row, Mapping) and key in row:
            return row[key]
        if hasattr(row, "get"):
            value = row.get(key)
            if value is not None:
                return value
        if hasattr(row, key):
            return getattr(row, key)
        try:
            return row[key]
        except Exception:
            pass
    return None


def normalize_yfinance_history(history: Any) -> list[Bar]:
    if history is None or (hasattr(history, "empty") and history.empty):
        raise UpstreamApiError("yfinance response did not contain usable bars")
    if not hasattr(history, "iterrows"):
        raise UpstreamApiError("yfinance response did not expose history rows")

    bars: list[Bar] = []
    for timestamp, row in history.iterrows():
        open_price = _to_number(_row_value(row, "Open", "open"))
        high = _to_number(_row_value(row, "High", "high"))
        low = _to_number(_row_value(row, "Low", "low"))
        close = _to_number(_row_value(row, "Close", "close"))
        volume = _to_number(_row_value(row, "Volume", "volume")) or 0

        if open_price is None or high is None or low is None or close is None:
            continue

        bars.append(Bar(
            time=_to_day(timestamp),
            open=open_price,
            high=high,
            low=low,
            close=close,
            volume=int(volume),
        ))

    if not bars:
        raise UpstreamApiError("yfinance response did not contain usable bars")

    return bars


def fetch_yfinance_history(instrument: Instrument, range_value: HistoryRange, interval: HistoryInterval) -> list[Bar]:
    try:
        yfinance = import_module("yfinance")
    except ModuleNotFoundError as error:
        raise UpstreamApiError(
            "yfinance is not installed. Install it with `pip install yfinance` "
            "to enable the open-source US provider."
        ) from error

    symbol = instrument.providerSymbol or instrument.symbol
    try:
        history = yfinance.Ticker(symbol).history(
            period=range_value,
            interval=interval,
            auto_adjust=False,
            actions=False,
        )
    except Exception as error:
        raise UpstreamApiError(f"yfinance history request failed: {error}") from error

    return normalize_yfinance_history(history)
