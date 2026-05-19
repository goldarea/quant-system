from collections.abc import Mapping
from datetime import date, datetime, timedelta, timezone
from importlib import import_module
from typing import Any

from app.models import Bar, HistoryInterval, HistoryRange, Instrument, UpstreamApiError


AKSHARE_PERIODS: dict[HistoryInterval, str] = {
    "1d": "daily",
    "1wk": "weekly",
    "1mo": "monthly",
}
RANGE_DAYS: dict[HistoryRange, int] = {
    "1mo": 40,
    "3mo": 100,
    "6mo": 190,
    "1y": 370,
    "5y": 1865,
}


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


def range_to_dates(range_value: HistoryRange) -> tuple[str, str]:
    end = datetime.now(timezone.utc).date()
    if range_value == "max":
        return "19900101", end.strftime("%Y%m%d")

    days = RANGE_DAYS.get(range_value, 370)
    start = end - timedelta(days=days)
    return start.strftime("%Y%m%d"), end.strftime("%Y%m%d")


def normalize_akshare_history(table: Any) -> list[Bar]:
    if table is None or (hasattr(table, "empty") and table.empty):
        raise UpstreamApiError("AkShare response did not contain usable bars")
    if not hasattr(table, "iterrows"):
        raise UpstreamApiError("AkShare response did not expose history rows")

    bars: list[Bar] = []
    for _, row in table.iterrows():
        time_value = _row_value(row, "日期", "date", "Date", "time", "Time")
        open_price = _to_number(_row_value(row, "开盘", "open", "Open"))
        close = _to_number(_row_value(row, "收盘", "close", "Close"))
        high = _to_number(_row_value(row, "最高", "high", "High"))
        low = _to_number(_row_value(row, "最低", "low", "Low"))
        volume = _to_number(_row_value(row, "成交量", "volume", "Volume", "vol")) or 0

        if time_value is None or open_price is None or high is None or low is None or close is None:
            continue

        bars.append(Bar(
            time=_to_day(time_value),
            open=open_price,
            high=high,
            low=low,
            close=close,
            volume=int(volume),
        ))

    if not bars:
        raise UpstreamApiError("AkShare response did not contain usable bars")

    return bars


def fetch_akshare_history(instrument: Instrument, range_value: HistoryRange, interval: HistoryInterval) -> list[Bar]:
    try:
        akshare = import_module("akshare")
    except ModuleNotFoundError as error:
        raise UpstreamApiError(
            "akshare is not installed. Install it with `pip install akshare` "
            "to enable the open-source CN provider."
        ) from error

    start_date, end_date = range_to_dates(range_value)
    try:
        table = akshare.stock_zh_a_hist(
            symbol=instrument.symbol,
            period=AKSHARE_PERIODS[interval],
            start_date=start_date,
            end_date=end_date,
            adjust="",
        )
    except Exception as error:
        raise UpstreamApiError(f"AkShare history request failed: {error}") from error

    return normalize_akshare_history(table)
