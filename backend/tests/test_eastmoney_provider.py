import pytest

from app.models import UpstreamApiError
from app.providers.eastmoney import normalize_eastmoney_klines, range_to_begin_date


SAMPLE_PAYLOAD = {
    "data": {
        "klines": [
            "2024-05-06,18.10,18.30,18.40,18.00,123456,0,0",
            "2024-05-07,18.30,18.25,18.50,18.20,234567,0,0",
        ]
    }
}


def test_normalize_eastmoney_klines_returns_bars():
    bars = normalize_eastmoney_klines(SAMPLE_PAYLOAD)

    assert len(bars) == 2
    assert bars[0].time == "2024-05-06"
    assert bars[0].open == 18.10
    assert bars[0].close == 18.30
    assert bars[0].volume == 123456


def test_normalize_eastmoney_klines_filters_incomplete_bars():
    payload = {"data": {"klines": ["2024-05-06,bad,18.30,18.40,18.00,123456", "2024-05-07,18.30,18.25,18.50,18.20,234567"]}}

    bars = normalize_eastmoney_klines(payload)

    assert len(bars) == 1
    assert bars[0].time == "2024-05-07"


def test_normalize_eastmoney_klines_raises_missing_data():
    with pytest.raises(UpstreamApiError, match="kline data"):
        normalize_eastmoney_klines({"data": {}})


def test_normalize_eastmoney_klines_raises_no_usable_bars():
    with pytest.raises(UpstreamApiError, match="usable bars"):
        normalize_eastmoney_klines({"data": {"klines": ["2024-05-06,bad,bad,bad,bad,0"]}})


def test_range_to_begin_date_handles_max():
    assert range_to_begin_date("max") == "19900101"
