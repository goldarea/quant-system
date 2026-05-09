from fastapi.testclient import TestClient

import app.main as main_module
from app.cache import JsonCache
from app.main import app
from app.services.market_data import MarketDataService
from app.storage import HistoryStore


def test_history_import_endpoint_persists_local_bars(tmp_path):
    previous_service = main_module.service
    main_module.service = MarketDataService(
        cache=JsonCache(tmp_path / "cache"),
        history_store=HistoryStore(tmp_path / "history.sqlite3"),
    )
    client = TestClient(app)

    try:
        response = client.post(
            "/api/history/import",
            params={"symbol": "AAPL", "range": "1mo", "interval": "1d"},
            content="time,open,high,low,close,volume\n2024-05-01,1,2,0.5,1.5,100\n",
            headers={"content-type": "text/csv"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["ok"] is True
        assert payload["data"]["imported"] == 1
        assert payload["data"]["source"] == "import"

        history_response = client.get(
            "/api/history",
            params={"symbol": "AAPL", "range": "1mo", "interval": "1d"},
        )
        history_payload = history_response.json()
        assert history_response.status_code == 200
        assert history_payload["data"]["source"] == "local"
        assert history_payload["data"]["bars"][0]["close"] == 1.5
    finally:
        main_module.service = previous_service
