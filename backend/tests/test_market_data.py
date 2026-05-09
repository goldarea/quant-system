from fastapi.testclient import TestClient
import pytest

from app.cache import JsonCache
from app.main import app
from app.models import Bar, NotFoundApiError, UpstreamApiError, ValidationErrorCode
from app.services.market_data import MarketDataService
from app.storage import HistoryStore


client = TestClient(app)


def test_search_returns_matching_symbols():
    response = client.get("/api/search", params={"q": "apple"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["data"][0]["symbol"] == "AAPL"


def test_history_uses_deterministic_demo_fallback(tmp_path):
    def provider(*_):
        raise UpstreamApiError("provider unavailable")

    service = MarketDataService(
        providers={"US": provider},
        cache=JsonCache(tmp_path / "cache"),
        history_store=HistoryStore(tmp_path / "history.sqlite3"),
    )
    first = service.get_history("AAPL", "1mo", "1d")
    second = service.get_history("AAPL", "1mo", "1d")

    assert first.source == "demo"
    assert first.bars == second.bars
    assert len(first.bars) == 24


def test_invalid_history_range_returns_existing_error_envelope():
    response = client.get("/api/history", params={"symbol": "AAPL", "range": "bad", "interval": "1d"})

    assert response.status_code == 400
    assert response.json() == {
        "ok": False,
        "error": {
            "code": ValidationErrorCode,
            "message": "Unsupported range: bad",
        },
    }


def test_quote_uses_last_history_bar(tmp_path):
    def provider(*_):
        return [Bar(time="2024-05-01", open=1, high=2, low=0.5, close=1.5, volume=100)]

    service = MarketDataService(
        providers={"US": provider},
        cache=JsonCache(tmp_path / "cache"),
        history_store=HistoryStore(tmp_path / "history.sqlite3"),
    )
    quote = service.get_quote("AAPL")
    history = service.get_history("AAPL", "1mo", "1d")

    assert quote.price == history.bars[-1].close
    assert quote.symbol == "AAPL"
    assert quote.source == "live"


def test_unknown_symbol_raises_not_found():
    with pytest.raises(NotFoundApiError, match="Unknown symbol"):
        MarketDataService().resolve("NOPE")



def test_history_caches_live_provider_response(tmp_path):
    calls = 0

    def provider(*_):
        nonlocal calls
        calls += 1
        return [Bar(time="2024-05-01", open=1, high=2, low=0.5, close=1.5, volume=100)]

    cache = JsonCache(tmp_path / "cache")
    service = MarketDataService(
        providers={"US": provider},
        cache=cache,
        history_store=HistoryStore(tmp_path / "history.sqlite3"),
    )

    first = service.get_history("AAPL", "1mo", "1d")
    second = service.get_history("AAPL", "1mo", "1d")

    assert calls == 1
    assert first.source == "live"
    assert second.source == "local"
    assert second.bars[0].close == 1.5


def test_indicators_endpoint_returns_envelope():
    response = client.get("/api/indicators", params={"symbol": "AAPL", "range": "1mo", "interval": "1d"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["data"]["instrument"]["symbol"] == "AAPL"
    assert len(payload["data"]["ma5"]) > 0


def test_history_reuses_persisted_local_bars_across_services(tmp_path):
    database_path = tmp_path / "history.sqlite3"
    store = HistoryStore(database_path)

    def provider(*_):
        return [Bar(time="2024-05-01", open=1, high=2, low=0.5, close=1.5, volume=100)]

    first_service = MarketDataService(providers={"US": provider}, cache=JsonCache(tmp_path / "cache-a"), history_store=store)
    first = first_service.get_history("AAPL", "1mo", "1d")

    def failing_provider(*_):
        raise AssertionError("provider should not be called when local data exists")

    second_service = MarketDataService(
        providers={"US": failing_provider},
        cache=JsonCache(tmp_path / "cache-b"),
        history_store=HistoryStore(database_path),
    )
    second = second_service.get_history("AAPL", "1mo", "1d")

    assert first.source == "live"
    assert second.source == "local"
    assert second.bars[0].close == 1.5
