from fastapi.testclient import TestClient

import app.main as main_module
from app.cache import JsonCache
from app.main import app
from app.models import Bar
from app.services.market_data import MarketDataService
from app.services.paper_trading import PaperTradingService
from app.storage import HistoryStore


def _provider(*_):
    return [Bar(time="2024-05-01", open=10, high=10, low=10, close=10, volume=100)]


def test_paper_account_endpoint_returns_initial_state():
    previous_paper_service = main_module.paper_service
    main_module.paper_service = PaperTradingService(initial_cash=1000)
    client = TestClient(app)

    try:
        response = client.get("/api/paper/account")
        payload = response.json()

        assert response.status_code == 200
        assert payload["ok"] is True
        assert payload["data"]["account"]["cash"] == 1000
        assert payload["data"]["risk"]["maxOrderValue"] == 250
        assert payload["data"]["risk"]["maxPositionValue"] == 500
        assert payload["data"]["positions"] == []
    finally:
        main_module.paper_service = previous_paper_service


def test_paper_order_fills_market_buy_and_sell(tmp_path):
    previous_service = main_module.service
    previous_paper_service = main_module.paper_service
    main_module.service = MarketDataService(
        providers={"US": _provider},
        cache=JsonCache(tmp_path / "cache"),
        history_store=HistoryStore(tmp_path / "history.sqlite3"),
    )
    main_module.paper_service = PaperTradingService(initial_cash=1000)
    client = TestClient(app)

    try:
        buy_response = client.post("/api/paper/orders", json={"symbol": "AAPL", "side": "buy", "quantity": 10})
        buy_payload = buy_response.json()

        assert buy_response.status_code == 200
        assert buy_payload["data"]["account"]["cash"] == 900
        assert buy_payload["data"]["positions"][0]["quantity"] == 10
        assert buy_payload["data"]["orders"][0]["status"] == "filled"
        assert buy_payload["data"]["fills"][0]["value"] == 100

        sell_response = client.post("/api/paper/orders", json={"symbol": "AAPL", "side": "sell", "quantity": 4})
        sell_payload = sell_response.json()

        assert sell_response.status_code == 200
        assert sell_payload["data"]["account"]["cash"] == 940
        assert sell_payload["data"]["positions"][0]["quantity"] == 6
        assert len(sell_payload["data"]["fills"]) == 2
    finally:
        main_module.service = previous_service
        main_module.paper_service = previous_paper_service


def test_paper_order_rejects_insufficient_buying_power(tmp_path):
    previous_service = main_module.service
    previous_paper_service = main_module.paper_service
    main_module.service = MarketDataService(
        providers={"US": _provider},
        cache=JsonCache(tmp_path / "cache"),
        history_store=HistoryStore(tmp_path / "history.sqlite3"),
    )
    main_module.paper_service = PaperTradingService(initial_cash=100)
    client = TestClient(app)

    try:
        response = client.post("/api/paper/orders", json={"symbol": "AAPL", "side": "buy", "quantity": 20})
        payload = response.json()

        assert response.status_code == 200
        assert payload["data"]["account"]["cash"] == 100
        assert payload["data"]["positions"] == []
        assert payload["data"]["orders"][0]["status"] == "rejected"
        assert payload["data"]["orders"][0]["message"] == "Insufficient buying power"
    finally:
        main_module.service = previous_service
        main_module.paper_service = previous_paper_service


def test_paper_order_rejects_order_risk_limit(tmp_path):
    previous_service = main_module.service
    previous_paper_service = main_module.paper_service
    main_module.service = MarketDataService(
        providers={"US": _provider},
        cache=JsonCache(tmp_path / "cache"),
        history_store=HistoryStore(tmp_path / "history.sqlite3"),
    )
    main_module.paper_service = PaperTradingService(initial_cash=1000)
    client = TestClient(app)

    try:
        response = client.post("/api/paper/orders", json={"symbol": "AAPL", "side": "buy", "quantity": 30})
        payload = response.json()

        assert response.status_code == 200
        assert payload["data"]["account"]["cash"] == 1000
        assert payload["data"]["orders"][0]["status"] == "rejected"
        assert payload["data"]["orders"][0]["message"] == "Order value exceeds risk limit"
    finally:
        main_module.service = previous_service
        main_module.paper_service = previous_paper_service


def test_paper_order_rejects_position_risk_limit(tmp_path):
    previous_service = main_module.service
    previous_paper_service = main_module.paper_service
    main_module.service = MarketDataService(
        providers={"US": _provider},
        cache=JsonCache(tmp_path / "cache"),
        history_store=HistoryStore(tmp_path / "history.sqlite3"),
    )
    main_module.paper_service = PaperTradingService(
        initial_cash=1000,
        max_order_value_pct=100,
        max_position_value_pct=50,
    )
    client = TestClient(app)

    try:
        first_response = client.post("/api/paper/orders", json={"symbol": "AAPL", "side": "buy", "quantity": 50})
        second_response = client.post("/api/paper/orders", json={"symbol": "AAPL", "side": "buy", "quantity": 1})
        first_payload = first_response.json()
        second_payload = second_response.json()

        assert first_response.status_code == 200
        assert first_payload["data"]["orders"][0]["status"] == "filled"
        assert second_response.status_code == 200
        assert second_payload["data"]["orders"][0]["status"] == "rejected"
        assert second_payload["data"]["orders"][0]["message"] == "Position value exceeds risk limit"
    finally:
        main_module.service = previous_service
        main_module.paper_service = previous_paper_service
