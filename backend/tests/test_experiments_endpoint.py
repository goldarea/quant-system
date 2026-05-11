from fastapi.testclient import TestClient

import app.main as main_module
from app.cache import JsonCache
from app.main import app
from app.models import Bar
from app.services.experiments import ExperimentService
from app.services.market_data import MarketDataService
from app.storage import HistoryStore


def _provider(*_):
    closes = [10, 9, 8, 7, 8, 9, 10, 11, 12, 11, 10, 9]
    return [
        Bar(time=f"2024-01-{index + 1:02d}", open=close, high=close + 1, low=close - 1, close=close, volume=100)
        for index, close in enumerate(closes)
    ]


def test_strategy_backtest_records_experiment_run(tmp_path):
    previous_service = main_module.service
    previous_experiment_service = main_module.experiment_service
    main_module.service = MarketDataService(
        providers={"US": _provider},
        cache=JsonCache(tmp_path / "cache"),
        history_store=HistoryStore(tmp_path / "history.sqlite3"),
    )
    main_module.experiment_service = ExperimentService()
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
                "initialCapital": "50000",
            },
        )
        run_response = client.get("/api/experiments/runs")
        payload = response.json()
        run_payload = run_response.json()

        assert response.status_code == 200
        assert run_response.status_code == 200
        assert run_payload["ok"] is True
        assert len(run_payload["data"]) == 1
        run = run_payload["data"][0]
        assert run["strategy"] == "ma_crossover"
        assert run["symbol"] == "AAPL"
        assert run["range"] == "1mo"
        assert run["interval"] == "1d"
        assert run["parameters"]["fastWindow"] == 2
        assert run["parameters"]["slowWindow"] == 3
        assert run["parameters"]["initialCapital"] == 50000
        assert run["finalEquity"] == payload["data"]["summary"]["finalEquity"]
        assert run["totalReturnPct"] == payload["data"]["summary"]["totalReturnPct"]
        assert run["tradeCount"] == payload["data"]["summary"]["tradeCount"]
    finally:
        main_module.service = previous_service
        main_module.experiment_service = previous_experiment_service


def test_experiment_runs_are_returned_newest_first(tmp_path):
    previous_service = main_module.service
    previous_experiment_service = main_module.experiment_service
    main_module.service = MarketDataService(
        providers={"US": _provider},
        cache=JsonCache(tmp_path / "cache"),
        history_store=HistoryStore(tmp_path / "history.sqlite3"),
    )
    main_module.experiment_service = ExperimentService()
    client = TestClient(app)

    try:
        client.get("/api/backtest/run", params={"strategy": "buy_and_hold", "symbol": "AAPL", "range": "1mo", "interval": "1d"})
        client.get("/api/backtest/run", params={"strategy": "rsi_reversal", "symbol": "MSFT", "range": "1mo", "interval": "1d"})
        response = client.get("/api/experiments/runs")
        payload = response.json()

        assert response.status_code == 200
        assert [run["strategy"] for run in payload["data"]] == ["rsi_reversal", "buy_and_hold"]
        assert [run["symbol"] for run in payload["data"]] == ["MSFT", "AAPL"]
    finally:
        main_module.service = previous_service
        main_module.experiment_service = previous_experiment_service
