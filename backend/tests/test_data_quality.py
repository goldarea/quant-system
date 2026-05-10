from app.models import Bar, Instrument
from app.services.data_quality import assess_history_quality


def instrument(market: str = "US") -> Instrument:
    return Instrument(symbol="AAPL", name="Apple Inc.", market=market, currency="USD")


def bar(time: str, open_value: float = 10, high: float = 11, low: float = 9, close: float = 10) -> Bar:
    return Bar(time=time, open=open_value, high=high, low=low, close=close, volume=100)


def test_quality_report_detects_duplicate_missing_invalid_and_stale_bars():
    report = assess_history_quality(instrument(), "1d", [
        bar("2024-01-02"),
        bar("2024-01-02"),
        bar("2024-01-04", open_value=10, high=9, low=8, close=10),
    ])

    assert report.totalBars == 3
    assert report.duplicateBars == 1
    assert report.missingBars == 1
    assert report.invalidBars == 1
    assert report.stale is True
    assert [issue.code for issue in report.issues] == ["DUPLICATE_BAR", "INVALID_OHLC", "MISSING_BAR", "STALE_DATA"]


def test_quality_report_uses_weekday_calendar_for_us_and_cn_daily_data():
    report = assess_history_quality(instrument("CN"), "1d", [
        bar("2024-01-05"),
        bar("2024-01-08"),
    ])

    assert report.missingBars == 0


def test_quality_report_skips_missing_bar_scan_for_non_daily_intervals():
    report = assess_history_quality(instrument(), "1wk", [
        bar("2024-01-01"),
        bar("2024-02-01"),
    ])

    assert report.missingBars == 0
