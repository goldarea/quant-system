from fastapi.testclient import TestClient

import app.main as main_module
from app.cache import JsonCache
from app.main import app
from app.models import Bar
from app.services.market_data import MarketDataService
from app.storage import HistoryStore


def test_backtest_endpoint_returns_envelope(tmp_path):
    previous_service = main_module.service

    def provider(*_):
        closes = [10, 9, 8, 7, 8, 9, 10, 11, 12, 11, 10, 9]
        return [
            Bar(time=f"2024-01-{index + 1:02d}", open=close, high=close + 1, low=close - 1, close=close, volume=100)
            for index, close in enumerate(closes)
        ]

    main_module.service = MarketDataService(
        providers={"US": provider},
        cache=JsonCache(tmp_path / "cache"),
        history_store=HistoryStore(tmp_path / "history.sqlite3"),
    )
    client = TestClient(app)

    try:
        response = client.get(
            "/api/backtest",
            params={
                "symbol": "AAPL",
                "range": "1mo",
                "interval": "1d",
                "fastWindow": "2",
                "slowWindow": "3",
                "feeRatePct": "0.1",
                "slippagePct": "0.2",
            },
        )
        payload = response.json()
        assert response.status_code == 200
        assert payload["ok"] is True
        assert payload["data"]["instrument"]["symbol"] == "AAPL"
        assert payload["data"]["summary"]["tradeCount"] == 2
        assert payload["data"]["summary"]["totalFees"] > 0
        assert payload["data"]["feeRatePct"] == 0.1
        assert payload["data"]["slippagePct"] == 0.2
        assert len(payload["data"]["equityCurve"]) == 12
        assert len(payload["data"]["dailyReturns"]) == 11
        assert payload["data"]["drawdown"]["maxDrawdownPct"] == payload["data"]["summary"]["maxDrawdownPct"]
        assert payload["data"]["tradeMetrics"]["averageHoldingBars"] > 0
        assert payload["data"]["benchmark"]["name"] == "buy_and_hold"
    finally:
        main_module.service = previous_service
