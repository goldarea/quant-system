import sys
from datetime import datetime
from types import SimpleNamespace

from app.models import Instrument
from app.providers.akshare import fetch_akshare_history, normalize_akshare_history
from app.providers.yfinance import fetch_yfinance_history, normalize_yfinance_history
from app.services.market_data import MarketDataService


class FakeFrame:
    def __init__(self, rows):
        self.rows = rows

    @property
    def empty(self):
        return len(self.rows) == 0

    def iterrows(self):
        return iter(self.rows)


def us_instrument() -> Instrument:
    return Instrument(
        symbol="AAPL",
        name="Apple Inc.",
        market="US",
        exchange="NASDAQ",
        currency="USD",
        providerSymbol="AAPL",
    )


def cn_instrument() -> Instrument:
    return Instrument(
        symbol="000001",
        name="Ping An Bank Co., Ltd.",
        market="CN",
        exchange="SZ",
        currency="CNY",
        providerSymbol="0.000001",
    )


def test_normalize_yfinance_history_converts_dataframe_like_rows():
    frame = FakeFrame([
        (
            datetime(2024, 5, 1),
            {"Open": 170.0, "High": 172.0, "Low": 169.0, "Close": 171.5, "Volume": 1000},
        )
    ])

    bars = normalize_yfinance_history(frame)

    assert bars[0].time == "2024-05-01"
    assert bars[0].open == 170.0
    assert bars[0].close == 171.5
    assert bars[0].volume == 1000


def test_fetch_yfinance_history_uses_lazy_optional_dependency(monkeypatch):
    calls = {}

    class FakeTicker:
        def __init__(self, symbol):
            calls["symbol"] = symbol

        def history(self, **kwargs):
            calls["kwargs"] = kwargs
            return FakeFrame([
                (
                    "2024-05-01",
                    {"Open": 170.0, "High": 172.0, "Low": 169.0, "Close": 171.5, "Volume": 1000},
                )
            ])

    monkeypatch.setitem(sys.modules, "yfinance", SimpleNamespace(Ticker=FakeTicker))

    bars = fetch_yfinance_history(us_instrument(), "1mo", "1d")

    assert calls["symbol"] == "AAPL"
    assert calls["kwargs"]["period"] == "1mo"
    assert calls["kwargs"]["interval"] == "1d"
    assert bars[0].close == 171.5


def test_normalize_akshare_history_converts_chinese_columns():
    frame = FakeFrame([
        (
            0,
            {"日期": "2024-05-06", "开盘": 18.10, "最高": 18.40, "最低": 18.00, "收盘": 18.30, "成交量": 123456},
        )
    ])

    bars = normalize_akshare_history(frame)

    assert bars[0].time == "2024-05-06"
    assert bars[0].open == 18.10
    assert bars[0].close == 18.30
    assert bars[0].volume == 123456


def test_fetch_akshare_history_uses_lazy_optional_dependency(monkeypatch):
    calls = {}

    def stock_zh_a_hist(**kwargs):
        calls.update(kwargs)
        return FakeFrame([
            (
                0,
                {"日期": "2024-05-06", "开盘": 18.10, "最高": 18.40, "最低": 18.00, "收盘": 18.30, "成交量": 123456},
            )
        ])

    monkeypatch.setitem(sys.modules, "akshare", SimpleNamespace(stock_zh_a_hist=stock_zh_a_hist))

    bars = fetch_akshare_history(cn_instrument(), "1mo", "1d")

    assert calls["symbol"] == "000001"
    assert calls["period"] == "daily"
    assert calls["adjust"] == ""
    assert bars[0].close == 18.30


def test_market_data_service_can_select_open_source_providers(monkeypatch):
    monkeypatch.setenv("QUANT_US_HISTORY_PROVIDER", "yfinance")
    monkeypatch.setenv("QUANT_CN_HISTORY_PROVIDER", "akshare")
    monkeypatch.setattr("app.services.market_data.find_spec", lambda _: object())

    service = MarketDataService()

    assert service.provider_names["US"] == "yfinance"
    assert service.provider_names["CN"] == "akshare"
    assert service.providers["US"].__name__ == "fetch_yfinance_history"
    assert service.providers["CN"].__name__ == "fetch_akshare_history"


def test_market_data_service_can_select_official_alpha_vantage_provider(monkeypatch):
    monkeypatch.setenv("QUANT_US_HISTORY_PROVIDER", "alphavantage")
    monkeypatch.setenv("QUANT_CN_HISTORY_PROVIDER", "alphavantage")
    monkeypatch.setenv("ALPHAVANTAGE_API_KEY", "test-key")

    service = MarketDataService()

    assert service.provider_names["US"] == "alphavantage"
    assert service.provider_names["CN"] == "alphavantage"
    assert service.providers["US"].__name__ == "fetch_alpha_vantage_history"
    assert service.providers["CN"].__name__ == "fetch_alpha_vantage_history"
