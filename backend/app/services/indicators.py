from app.models import Bar, IndicatorPoint, IndicatorsResponse, Instrument, MacdPoint, RsiPoint


def _round(value: float) -> float:
    return round(value, 4)


def moving_average(bars: list[Bar], window_size: int) -> list[IndicatorPoint]:
    points: list[IndicatorPoint] = []
    for index, bar in enumerate(bars):
        if index < window_size - 1:
            points.append(IndicatorPoint(time=bar.time, value=None))
            continue
        window = bars[index - window_size + 1:index + 1]
        average = sum(item.close for item in window) / window_size
        points.append(IndicatorPoint(time=bar.time, value=_round(average)))
    return points


def exponential_moving_average(values: list[float], period: int) -> list[float | None]:
    if not values:
        return []

    multiplier = 2 / (period + 1)
    ema: list[float | None] = []
    previous: float | None = None

    for index, value in enumerate(values):
        if index < period - 1:
            ema.append(None)
            continue
        if index == period - 1:
            previous = sum(values[:period]) / period
        else:
            previous = (value - previous) * multiplier + previous  # type: ignore[operator]
        ema.append(previous)

    return ema


def macd(bars: list[Bar], fast: int = 12, slow: int = 26, signal: int = 9) -> list[MacdPoint]:
    closes = [bar.close for bar in bars]
    fast_ema = exponential_moving_average(closes, fast)
    slow_ema = exponential_moving_average(closes, slow)
    dif_values: list[float | None] = []

    for fast_value, slow_value in zip(fast_ema, slow_ema):
        dif_values.append(None if fast_value is None or slow_value is None else fast_value - slow_value)

    compact_dif = [value for value in dif_values if value is not None]
    compact_dea = exponential_moving_average(compact_dif, signal)
    dea_values: list[float | None] = []
    compact_index = 0
    for dif_value in dif_values:
        if dif_value is None:
            dea_values.append(None)
            continue
        dea_values.append(compact_dea[compact_index])
        compact_index += 1

    points: list[MacdPoint] = []
    for bar, dif_value, dea_value in zip(bars, dif_values, dea_values):
        histogram = None if dif_value is None or dea_value is None else (dif_value - dea_value) * 2
        points.append(MacdPoint(
            time=bar.time,
            dif=None if dif_value is None else _round(dif_value),
            dea=None if dea_value is None else _round(dea_value),
            histogram=None if histogram is None else _round(histogram),
        ))
    return points


def rsi(bars: list[Bar], period: int = 14) -> list[RsiPoint]:
    points: list[RsiPoint] = []
    gains: list[float] = []
    losses: list[float] = []

    for index, bar in enumerate(bars):
        if index == 0:
            points.append(RsiPoint(time=bar.time, value=None))
            continue

        change = bar.close - bars[index - 1].close
        gains.append(max(change, 0))
        losses.append(max(-change, 0))

        if index < period:
            points.append(RsiPoint(time=bar.time, value=None))
            continue

        window_gains = gains[index - period:index]
        window_losses = losses[index - period:index]
        average_gain = sum(window_gains) / period
        average_loss = sum(window_losses) / period
        if average_loss == 0:
            value = 100.0
        else:
            relative_strength = average_gain / average_loss
            value = 100 - (100 / (1 + relative_strength))
        points.append(RsiPoint(time=bar.time, value=_round(value)))

    return points


def build_indicators(instrument: Instrument, range_value, interval, source: str, bars: list[Bar]) -> IndicatorsResponse:
    return IndicatorsResponse(
        instrument=instrument,
        range=range_value,
        interval=interval,
        source=source,
        ma5=moving_average(bars, 5),
        ma20=moving_average(bars, 20),
        ma60=moving_average(bars, 60),
        macd=macd(bars),
        rsi14=rsi(bars, 14),
    )
