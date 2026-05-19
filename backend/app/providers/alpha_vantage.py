from datetime import date, timedelta
import os
from typing import Any

import httpx

from app.models import Bar, HistoryInterval, HistoryRange, Instrument, UpstreamApiError


ALPHA_VANTAGE_API_KEY_ENV = "ALPHAVANTAGE_API_KEY"
ALPHA_VANTAGE_API_KEY_ALIASES = (
    ALPHA_VANTAGE_API_KEY_ENV,
    "ALPHA_VANTAGE_API_KEY",
    "QUANT_ALPHA_VANTAGE_API_KEY",
)
ALPHA_VANTAGE_FUNCTIONS: dict[HistoryInterval, tuple[str, str]] = {
    "1d": ("TIME_SERIES_DAILY", "Time Series (Daily)"),
    "1wk": ("TIME_SERIES_WEEKLY", "Weekly Time Series"),
    "1mo": ("TIME_SERIES_MONTHLY", "Monthly Time Series"),
}
RANGE_DAYS: dict[HistoryRange, int] = {
    "1mo": 31,
    "3mo": 93,
    "6mo": 186,
    "1y": 366,
    "5y": 366 * 5 + 2,
}


def get_alpha_vantage_api_key() -> str | None:
    for env_name in ALPHA_VANTAGE_API_KEY_ALIASES:
        value = os.getenv(env_name, "").strip()
        if value:
            return value
    return None


def alpha_vantage_symbol(instrument: Instrument) -> str:
    if instrument.market == "CN":
        exchange = (instrument.exchange or "").upper()
        if exchange == "SH" or instrument.symbol.startswith("6"):
            return f"{instrument.symbol}.SHH"
        if exchange == "SZ" or instrument.symbol.startswith(("0", "3")):
            return f"{instrument.symbol}.SHZ"
        raise UpstreamApiError(f"Alpha Vantage exchange suffix is unknown for {instrument.symbol}")

    return instrument.providerSymbol or instrument.symbol


def _to_number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number else None


def _series_key(payload: dict[str, Any], expected_key: str) -> str:
    if expected_key in payload:
        return expected_key
    for key in payload:
        if "Time Series" in key:
            return key
    raise UpstreamApiError("Alpha Vantage response did not contain time series data")


def normalize_alpha_vantage_history(payload: dict[str, Any], interval: HistoryInterval) -> list[Bar]:
    for key in ("Error Message", "Information", "Note"):
        message = payload.get(key)
        if message:
            raise UpstreamApiError(f"Alpha Vantage API returned {key}: {message}")

    _, expected_key = ALPHA_VANTAGE_FUNCTIONS[interval]
    series = payload.get(_series_key(payload, expected_key))
    if not isinstance(series, dict):
        raise UpstreamApiError("Alpha Vantage response did not contain time series data")

    bars: list[Bar] = []
    for day, row in sorted(series.items()):
        if not isinstance(row, dict):
            continue

        open_price = _to_number(row.get("1. open"))
        high = _to_number(row.get("2. high"))
        low = _to_number(row.get("3. low"))
        close = _to_number(row.get("4. close"))
        volume = _to_number(row.get("5. volume")) or 0

        if open_price is None or high is None or low is None or close is None:
            continue

        bars.append(Bar(
            time=str(day),
            open=open_price,
            high=high,
            low=low,
            close=close,
            volume=int(volume),
        ))

    if not bars:
        raise UpstreamApiError("Alpha Vantage response did not contain usable bars")

    return bars


def filter_bars_for_range(bars: list[Bar], range_value: HistoryRange) -> list[Bar]:
    if range_value == "max":
        return bars

    days = RANGE_DAYS[range_value]
    start = date.today() - timedelta(days=days)
    return [bar for bar in bars if date.fromisoformat(bar.time) >= start]


def fetch_alpha_vantage_history(
    instrument: Instrument,
    range_value: HistoryRange,
    interval: HistoryInterval,
) -> list[Bar]:
    api_key = get_alpha_vantage_api_key()
    if not api_key:
        raise UpstreamApiError(
            f"Alpha Vantage API key is not configured. Set {ALPHA_VANTAGE_API_KEY_ENV} "
            "to enable the official market-data provider."
        )

    function_name, _ = ALPHA_VANTAGE_FUNCTIONS[interval]
    params = {
        "function": function_name,
        "symbol": alpha_vantage_symbol(instrument),
        "apikey": api_key,
    }
    if interval == "1d" and range_value in {"6mo", "1y", "5y", "max"}:
        params["outputsize"] = "full"

    try:
        response = httpx.get(
            "https://www.alphavantage.co/query",
            params=params,
            headers={"User-Agent": "quant-system/0.1"},
            timeout=10,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as error:
        raise UpstreamApiError(f"Alpha Vantage API returned HTTP {error.response.status_code}") from error
    except httpx.HTTPError as error:
        raise UpstreamApiError(f"Alpha Vantage API request failed: {error}") from error

    return filter_bars_for_range(normalize_alpha_vantage_history(response.json(), interval), range_value)
