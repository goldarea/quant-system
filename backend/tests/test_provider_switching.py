from fastapi.testclient import TestClient

import app.main as main_module
from app.cache import JsonCache
from app.main import app
from app.models import Bar
from app.services import market_data as market_data_module
from app.services.market_data import MarketDataService
from app.storage import HistoryStore


client = TestClient(app)


def test_provider_catalog_endpoint_reports_active_and_available_options():
    response = client.get("/api/providers")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True

    markets = {item["market"]: item for item in payload["data"]["markets"]}
    assert markets["US"]["activeProvider"] == "yahoo"
    assert markets["CN"]["activeProvider"] == "eastmoney"
    us_options = {option["id"]: option for option in markets["US"]["options"]}
    cn_options = {option["id"]: option for option in markets["CN"]["options"]}
    assert us_options["yfinance"]["dependency"] == "yfinance"
    assert us_options["yfinance"]["installCommand"] == "pip install yfinance"
    assert us_options["alphavantage"]["credentialEnv"] == "ALPHAVANTAGE_API_KEY"
    assert us_options["alphavantage"]["setupHint"] == "Set ALPHAVANTAGE_API_KEY to an Alpha Vantage API key."
    assert cn_options["akshare"]["dependency"] == "akshare"
    assert cn_options["akshare"]["installCommand"] == "pip install akshare"
    assert cn_options["alphavantage"]["credentialEnv"] == "ALPHAVANTAGE_API_KEY"


def test_history_can_switch_provider_via_query_override(tmp_path, monkeypatch):
    calls = 0

    def fake_yfinance_provider(*_):
        nonlocal calls
        calls += 1
        return [Bar(time="2024-05-01", open=1, high=2, low=0.5, close=1.5, volume=100)]

    monkeypatch.setattr(market_data_module, "find_spec", lambda _: object())
    monkeypatch.setitem(market_data_module.HISTORY_PROVIDER_REGISTRY["US"], "yfinance", fake_yfinance_provider)

    service = MarketDataService(
        cache=JsonCache(tmp_path / "cache"),
        history_store=HistoryStore(tmp_path / "history.sqlite3"),
    )

    first = service.get_history("AAPL", "1mo", "1d", {"US": "yfinance"})
    second = service.get_history("AAPL", "1mo", "1d", {"US": "yfinance"})

    assert calls == 1
    assert first.source == "live"
    assert second.source == "local"
    assert second.bars[0].close == 1.5


def test_history_import_remains_available_after_provider_switch(tmp_path, monkeypatch):
    previous_service = main_module.service
    main_module.service = MarketDataService(
        cache=JsonCache(tmp_path / "cache"),
        history_store=HistoryStore(tmp_path / "history.sqlite3"),
    )
    client = TestClient(app)
    monkeypatch.setattr(market_data_module, "find_spec", lambda _: object())

    try:
        response = client.post(
            "/api/history/import",
            params={"symbol": "AAPL", "range": "1mo", "interval": "1d"},
            content="time,open,high,low,close,volume\n2024-05-01,1,2,0.5,1.5,100\n",
            headers={"content-type": "text/csv"},
        )
        assert response.status_code == 200

        history_response = client.get(
            "/api/history",
            params={"symbol": "AAPL", "range": "1mo", "interval": "1d", "providers": "US:yfinance"},
        )
        assert history_response.status_code == 200
        assert history_response.json()["data"]["source"] == "local"
    finally:
        main_module.service = previous_service
