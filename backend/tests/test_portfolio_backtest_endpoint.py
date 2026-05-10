from fastapi.testclient import TestClient

import app.main as main_module
from app.cache import JsonCache
from app.main import app
from app.models import Bar
from app.services.market_data import MarketDataService
from app.storage import HistoryStore


def test_portfolio_backtest_endpoint_returns_envelope(tmp_path):
    previous_service = main_module.service

    def provider(instrument, *_):
        closes_by_symbol = {
            "AAPL": [10, 11, 12],
            "MSFT": [20, 18, 22],
        }
        return [
            Bar(time=f"2024-01-{index + 1:02d}", open=close, high=close, low=close, close=close, volume=100)
            for index, close in enumerate(closes_by_symbol[instrument.symbol])
        ]

    main_module.service = MarketDataService(
        providers={"US": provider},
        cache=JsonCache(tmp_path / "cache"),
        history_store=HistoryStore(tmp_path / "history.sqlite3"),
    )
    client = TestClient(app)

    try:
        response = client.get(
            "/api/backtest/portfolio",
            params={"symbols": "AAPL,MSFT", "range": "1mo", "interval": "1d", "initialCapital": "1000"},
        )
        payload = response.json()
        assert response.status_code == 200
        assert payload["ok"] is True
        assert payload["data"]["symbols"] == ["AAPL", "MSFT"]
        assert payload["data"]["summary"]["finalEquity"] == 1150
        assert payload["data"]["summary"]["totalReturnPct"] == 15
        assert len(payload["data"]["equityCurve"]) == 3
        assert len(payload["data"]["positions"]) == 2
    finally:
        main_module.service = previous_service
