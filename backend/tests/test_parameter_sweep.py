from fastapi.testclient import TestClient
import pytest

import app.main as main_module
from app.cache import JsonCache
from app.main import app
from app.models import Bar, Instrument, ValidationApiError
from app.services.market_data import MarketDataService
from app.services.parameter_sweep import run_ma_parameter_sweep
from app.storage import HistoryStore


def instrument() -> Instrument:
    return Instrument(symbol="AAPL", name="Apple Inc.", market="US", currency="USD")


def bars_from_closes(closes: list[float]) -> list[Bar]:
    return [
        Bar(time=f"2024-01-{index + 1:02d}", open=close, high=close + 1, low=close - 1, close=close, volume=100)
        for index, close in enumerate(closes)
    ]


def test_parameter_sweep_returns_ranked_results():
    response = run_ma_parameter_sweep(
        instrument(),
        "1mo",
        "1d",
        "local",
        bars_from_closes([10, 9, 8, 7, 8, 9, 10, 11, 12, 11, 10, 9]),
        2,
        3,
        3,
        5,
        1000,
    )

    assert response.initialCapital == 1000
    assert len(response.results) == 5
    assert [result.rank for result in response.results] == [1, 2, 3, 4, 5]
    assert response.results[0].totalReturnPct >= response.results[-1].totalReturnPct


def test_parameter_sweep_rejects_large_combination_count():
    with pytest.raises(ValidationApiError, match="limited to 200"):
        run_ma_parameter_sweep(instrument(), "1mo", "1d", "local", bars_from_closes([1, 2, 3]), 2, 20, 3, 20)


def test_parameter_sweep_endpoint_returns_envelope(tmp_path):
    previous_service = main_module.service

    def provider(*_):
        return bars_from_closes([10, 9, 8, 7, 8, 9, 10, 11, 12, 11, 10, 9])

    main_module.service = MarketDataService(
        providers={"US": provider},
        cache=JsonCache(tmp_path / "cache"),
        history_store=HistoryStore(tmp_path / "history.sqlite3"),
    )
    client = TestClient(app)

    try:
        response = client.get(
            "/api/backtest/sweep",
            params={
                "symbol": "AAPL",
                "range": "1mo",
                "interval": "1d",
                "fastMin": "2",
                "fastMax": "3",
                "slowMin": "3",
                "slowMax": "5",
                "initialCapital": "1000",
            },
        )
        payload = response.json()

        assert response.status_code == 200
        assert payload["ok"] is True
        assert payload["data"]["instrument"]["symbol"] == "AAPL"
        assert len(payload["data"]["results"]) == 5
        assert payload["data"]["results"][0]["rank"] == 1
    finally:
        main_module.service = previous_service
