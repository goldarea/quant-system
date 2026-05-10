from datetime import UTC, date, datetime

from app.models import Bar, DataQualityIssue, DataQualityReport, HistoryInterval, Instrument


def assess_history_quality(instrument: Instrument, interval: HistoryInterval, bars: list[Bar]) -> DataQualityReport:
    issues: list[DataQualityIssue] = []
    duplicate_bars = _duplicate_count(bars, issues)
    invalid_bars = _invalid_count(bars, issues)
    missing_bars = _missing_count(instrument, interval, bars, issues)
    stale = _is_stale(interval, bars)
    if stale and bars:
        issues.append(DataQualityIssue(
            code="STALE_DATA",
            severity="warning",
            message="Last bar is older than expected for the selected interval",
            time=bars[-1].time,
        ))

    return DataQualityReport(
        market=instrument.market,
        expectedInterval=interval,
        totalBars=len(bars),
        duplicateBars=duplicate_bars,
        missingBars=missing_bars,
        invalidBars=invalid_bars,
        stale=stale,
        issues=issues,
    )


def _parse_date(value: str) -> date | None:
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _duplicate_count(bars: list[Bar], issues: list[DataQualityIssue]) -> int:
    seen: set[str] = set()
    duplicates = 0
    for bar in bars:
        if bar.time in seen:
            duplicates += 1
            issues.append(DataQualityIssue(
                code="DUPLICATE_BAR",
                severity="error",
                message="Duplicate bar timestamp detected",
                time=bar.time,
            ))
        seen.add(bar.time)
    return duplicates


def _invalid_count(bars: list[Bar], issues: list[DataQualityIssue]) -> int:
    invalid = 0
    for bar in bars:
        if bar.high < max(bar.open, bar.close) or bar.low > min(bar.open, bar.close) or bar.high < bar.low:
            invalid += 1
            issues.append(DataQualityIssue(
                code="INVALID_OHLC",
                severity="error",
                message="OHLC values are internally inconsistent",
                time=bar.time,
            ))
    return invalid


def _missing_count(instrument: Instrument, interval: HistoryInterval, bars: list[Bar], issues: list[DataQualityIssue]) -> int:
    if interval != "1d" or len(bars) < 2:
        return 0

    parsed_dates = [_parse_date(bar.time) for bar in bars]
    dated_bars = [value for value in parsed_dates if value is not None]
    if len(dated_bars) < 2:
        return 0

    observed = set(dated_bars)
    missing = 0
    current = min(dated_bars)
    end = max(dated_bars)
    while current <= end:
        if _is_trading_day(instrument.market, current) and current not in observed:
            missing += 1
            issues.append(DataQualityIssue(
                code="MISSING_BAR",
                severity="warning",
                message="Expected trading-day bar is missing",
                time=current.isoformat(),
            ))
        current = date.fromordinal(current.toordinal() + 1)
    return missing


def _is_trading_day(market: str, value: date) -> bool:
    if market in {"US", "CN"}:
        return value.weekday() < 5
    return True


def _is_stale(interval: HistoryInterval, bars: list[Bar]) -> bool:
    if not bars:
        return False
    last_date = _parse_date(bars[-1].time)
    if last_date is None:
        return False

    days_old = (datetime.now(UTC).date() - last_date).days
    if interval == "1d":
        return days_old > 7
    if interval == "1wk":
        return days_old > 21
    return days_old > 62
