from datetime import date, timedelta
from math import sin

from app.models import Bar, HistoryRange, Instrument


def _hash_symbol(symbol: str) -> int:
    return sum(ord(char) for char in symbol)


def _count_for_range(range_value: HistoryRange) -> int:
    if range_value == "1mo":
        return 24
    if range_value == "3mo":
        return 66
    if range_value == "6mo":
        return 126
    if range_value == "1y":
        return 252
    if range_value == "5y":
        return 520
    return 720


def _previous_trading_days(count: int) -> list[str]:
    days: list[str] = []
    cursor = date(2026, 5, 6)

    while len(days) < count:
        if cursor.weekday() < 5:
            days.append(cursor.isoformat())
        cursor -= timedelta(days=1)

    return list(reversed(days))


def generate_demo_bars(instrument: Instrument, range_value: HistoryRange = "1mo") -> list[Bar]:
    seed = _hash_symbol(instrument.symbol)
    count = _count_for_range(range_value)
    close = 20 + (seed % 180) if instrument.market == "CN" else 80 + (seed % 220)
    bars: list[Bar] = []

    for index, time in enumerate(_previous_trading_days(count)):
      wave = sin((index + seed) / 7) * 0.018
      drift = 0.0008 if seed % 2 == 0 else -0.0002
      open_price = close
      close = max(1, close * (1 + wave + drift))
      high = max(open_price, close) * (1 + 0.008 + ((index + seed) % 5) * 0.001)
      low = min(open_price, close) * (1 - 0.008 - ((index + seed) % 4) * 0.001)
      volume = 500000 + ((seed * 97 + index * 7919) % 3000000)

      bars.append(Bar(
          time=time,
          open=round(open_price, 2),
          high=round(high, 2),
          low=round(low, 2),
          close=round(close, 2),
          volume=volume,
      ))

    return bars
