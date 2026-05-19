import pytest

from app.models import Instrument, UpstreamApiError
from app.providers import alpha_vantage
from app.providers.alpha_vantage import (
    alpha_vantage_symbol,
    fetch_alpha_vantage_history,
    normalize_alpha_vantage_history,
)


SAMPLE_PAYLOAD = {
    "Time Series (Daily)": {
        "2024-05-02": {
            "1. open": "171.00",
            "2. high": "173.00",
            "3. low": "170.00",
            "4. close": "172.50",
            "5. volume": "2000",
        },
        "2024-05-01": {
            "1. open": "170.00",
            "2. high": "172.00",
            "3. low": "169.00",
            "4. close": "171.50",
            "5. volume": "1000",
        },
    }
}


def us_instrument() -> Instrument:
    return Instrument(
        symbol="AAPL",
        name="Apple Inc.",
        market="US",
        exchange="NASDAQ",
        currency="USD",
        providerSymbol="AAPL",
    )


def cn_instrument(symbol: str = "600519", exchange: str = "SH") -> Instrument:
    return Instrument(
        symbol=symbol,
        name="CN Stock",
        market="CN",
        exchange=exchange,
        currency="CNY",
        providerSymbol=f"1.{symbol}",
    )


def test_normalize_alpha_vantage_history_returns_ascending_bars():
    bars = normalize_alpha_vantage_history(SAMPLE_PAYLOAD, "1d")

    assert [bar.time for bar in bars] == ["2024-05-01", "2024-05-02"]
    assert bars[0].open == 170
    assert bars[0].close == 171.5
    assert bars[0].volume == 1000


def test_normalize_alpha_vantage_history_raises_api_messages():
    with pytest.raises(UpstreamApiError, match="Invalid API call"):
        normalize_alpha_vantage_history({"Error Message": "Invalid API call"}, "1d")


def test_alpha_vantage_symbol_maps_global_market_suffixes():
    assert alpha_vantage_symbol(us_instrument()) == "AAPL"
    assert alpha_vantage_symbol(cn_instrument("600519", "SH")) == "600519.SHH"
    assert alpha_vantage_symbol(cn_instrument("000001", "SZ")) == "000001.SHZ"


def test_fetch_alpha_vantage_history_uses_official_query(monkeypatch):
    calls = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return SAMPLE_PAYLOAD

    def fake_get(url, **kwargs):
        calls["url"] = url
        calls["kwargs"] = kwargs
        return FakeResponse()

    monkeypatch.setenv("ALPHAVANTAGE_API_KEY", "test-key")
    monkeypatch.setattr(alpha_vantage.httpx, "get", fake_get)

    bars = fetch_alpha_vantage_history(us_instrument(), "max", "1d")

    assert calls["url"] == "https://www.alphavantage.co/query"
    assert calls["kwargs"]["params"]["function"] == "TIME_SERIES_DAILY"
    assert calls["kwargs"]["params"]["symbol"] == "AAPL"
    assert calls["kwargs"]["params"]["apikey"] == "test-key"
    assert calls["kwargs"]["params"]["outputsize"] == "full"
    assert bars[0].time == "2024-05-01"


def test_fetch_alpha_vantage_history_requires_api_key(monkeypatch):
    for env_name in alpha_vantage.ALPHA_VANTAGE_API_KEY_ALIASES:
        monkeypatch.delenv(env_name, raising=False)

    with pytest.raises(UpstreamApiError, match="API key is not configured"):
        fetch_alpha_vantage_history(us_instrument(), "1mo", "1d")
