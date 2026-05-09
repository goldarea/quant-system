import pytest

from app.models import UpstreamApiError
from app.providers.yahoo import normalize_yahoo_chart


SAMPLE_PAYLOAD = {
    "chart": {
        "result": [
            {
                "timestamp": [1714521600, 1714608000],
                "indicators": {
                    "quote": [
                        {
                            "open": [170.0, 171.0],
                            "high": [172.0, 173.0],
                            "low": [169.0, 170.0],
                            "close": [171.5, 172.5],
                            "volume": [1000, 2000],
                        }
                    ]
                },
            }
        ],
        "error": None,
    }
}


def test_normalize_yahoo_chart_returns_bars():
    bars = normalize_yahoo_chart(SAMPLE_PAYLOAD)

    assert len(bars) == 2
    assert bars[0].time == "2024-05-01"
    assert bars[0].open == 170.0
    assert bars[0].close == 171.5
    assert bars[0].volume == 1000


def test_normalize_yahoo_chart_filters_incomplete_bars():
    payload = SAMPLE_PAYLOAD.copy()
    payload["chart"]["result"][0]["indicators"]["quote"][0]["open"] = [None, 171.0]

    bars = normalize_yahoo_chart(payload)

    assert len(bars) == 1
    assert bars[0].open == 171.0


def test_normalize_yahoo_chart_raises_chart_error():
    with pytest.raises(UpstreamApiError, match="bad symbol"):
        normalize_yahoo_chart({"chart": {"result": None, "error": {"description": "bad symbol"}}})


def test_normalize_yahoo_chart_raises_when_no_usable_bars():
    with pytest.raises(UpstreamApiError, match="usable bars"):
        normalize_yahoo_chart({"chart": {"result": [{"timestamp": [], "indicators": {"quote": [{}]}}], "error": None}})
