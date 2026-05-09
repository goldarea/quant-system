from datetime import datetime, timezone
from typing import Any

import httpx

from app.models import Bar, HistoryInterval, HistoryRange, Instrument, UpstreamApiError


def _to_day(timestamp_seconds: int | float) -> str:
    return datetime.fromtimestamp(timestamp_seconds, timezone.utc).date().isoformat()


def _to_number(value: Any) -> float | None:
    return value if isinstance(value, int | float) and not isinstance(value, bool) else None


def normalize_yahoo_chart(payload: dict[str, Any]) -> list[Bar]:
    error = payload.get("chart", {}).get("error")
    if error:
        raise UpstreamApiError(error.get("description") or "Yahoo chart API returned an error")

    result = (payload.get("chart", {}).get("result") or [None])[0]
    if not isinstance(result, dict):
        raise UpstreamApiError("Yahoo response did not contain chart data")

    timestamps = result.get("timestamp") or []
    quote = ((result.get("indicators") or {}).get("quote") or [{}])[0]
    if not isinstance(timestamps, list) or not isinstance(quote, dict):
        raise UpstreamApiError("Yahoo response did not contain quote data")

    bars: list[Bar] = []
    for index, timestamp in enumerate(timestamps):
        open_price = _to_number((quote.get("open") or [None])[index] if index < len(quote.get("open") or []) else None)
        high = _to_number((quote.get("high") or [None])[index] if index < len(quote.get("high") or []) else None)
        low = _to_number((quote.get("low") or [None])[index] if index < len(quote.get("low") or []) else None)
        close = _to_number((quote.get("close") or [None])[index] if index < len(quote.get("close") or []) else None)
        volume = _to_number((quote.get("volume") or [None])[index] if index < len(quote.get("volume") or []) else None) or 0

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
        raise UpstreamApiError("Yahoo response did not contain usable bars")

    return bars


def fetch_yahoo_history(instrument: Instrument, range_value: HistoryRange, interval: HistoryInterval) -> list[Bar]:
    symbol = instrument.providerSymbol or instrument.symbol
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"

    try:
        response = httpx.get(
            url,
            params={
                "range": range_value,
                "interval": interval,
                "events": "history",
                "includeAdjustedClose": "true",
            },
            headers={"User-Agent": "quant-system/0.1"},
            timeout=10,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as error:
        raise UpstreamApiError(f"Yahoo chart API returned HTTP {error.response.status_code}") from error
    except httpx.HTTPError as error:
        raise UpstreamApiError(f"Yahoo chart API request failed: {error}") from error

    return normalize_yahoo_chart(response.json())
