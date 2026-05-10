from fastapi.testclient import TestClient

import app.main as main_module
from app.cache import JsonCache
from app.main import app
from app.models import Bar
from app.services.market_data import MarketDataService
from app.storage import HistoryStore


def _provider(*_):
    closes = [10, 9, 8, 7, 8, 9, 10, 11, 12, 11, 10, 9]
    return [
        Bar(time=f"2024-01-{index + 1:02d}", open=close, high=close + 1, low=close - 1, close=close, volume=100)
        for index, close in enumerate(closes)
    ]


def test_strategies_endpoint_returns_registered_strategies():
    client = TestClient(app)

    response = client.get("/api/strategies")
    payload = response.json()

    assert response.status_code == 200
    assert payload["ok"] is True
    assert payload["data"][0]["id"] == "ma_crossover"
    assert payload["data"][0]["parameters"][0]["id"] == "fastWindow"
    assert [strategy["id"] for strategy in payload["data"]] == ["ma_crossover", "rsi_reversal", "macd_trend", "buy_and_hold"]


def test_strategy_backtest_endpoint_runs_ma_crossover(tmp_path):
    previous_service = main_module.service
    main_module.service = MarketDataService(
        providers={"US": _provider},
        cache=JsonCache(tmp_path / "cache"),
        history_store=HistoryStore(tmp_path / "history.sqlite3"),
    )
    client = TestClient(app)

    try:
        response = client.get(
            "/api/backtest/run",
            params={
                "strategy": "ma_crossover",
                "symbol": "AAPL",
                "range": "1mo",
                "interval": "1d",
                "fastWindow": "2",
                "slowWindow": "3",
            },
        )
        payload = response.json()

        assert response.status_code == 200
        assert payload["ok"] is True
        assert payload["data"]["summary"]["tradeCount"] == 2
        assert payload["data"]["fastWindow"] == 2
        assert payload["data"]["slowWindow"] == 3
    finally:
        main_module.service = previous_service



def test_strategy_backtest_endpoint_runs_buy_and_hold(tmp_path):
    previous_service = main_module.service
    main_module.service = MarketDataService(
        providers={"US": _provider},
        cache=JsonCache(tmp_path / "cache"),
        history_store=HistoryStore(tmp_path / "history.sqlite3"),
    )
    client = TestClient(app)

    try:
        response = client.get(
            "/api/backtest/run",
            params={"strategy": "buy_and_hold", "symbol": "AAPL", "range": "1mo", "interval": "1d"},
        )
        payload = response.json()

        assert response.status_code == 200
        assert payload["ok"] is True
        assert payload["data"]["summary"]["tradeCount"] == 1
        assert payload["data"]["summary"]["finalEquity"] == 90000
    finally:
        main_module.service = previous_service

    previous_service = main_module.service
    main_module.service = MarketDataService(
        providers={"US": _provider},
        cache=JsonCache(tmp_path / "cache"),
        history_store=HistoryStore(tmp_path / "history.sqlite3"),
    )
    client = TestClient(app)

    try:
        response = client.get(
            "/api/backtest/run",
            params={"strategy": "missing", "symbol": "AAPL", "range": "1mo", "interval": "1d"},
        )
        payload = response.json()

        assert response.status_code == 400
        assert payload["ok"] is False
        assert payload["error"]["code"] == "VALIDATION_ERROR"
        assert "Unknown strategy" in payload["error"]["message"]
    finally:
        main_module.service = previous_service
