import sqlite3

from app.models import Bar, Instrument
from app.storage import HistoryStore


def instrument() -> Instrument:
    return Instrument(symbol="AAPL", name="Apple Inc.", market="US", currency="USD", providerSymbol="AAPL")


def bars(close: float = 1.5) -> list[Bar]:
    return [
        Bar(time="2024-05-01", open=1, high=2, low=0.5, close=close, volume=100),
        Bar(time="2024-05-02", open=2, high=3, low=1.5, close=2.5, volume=200),
    ]


def test_history_store_roundtrip(tmp_path):
    store = HistoryStore(tmp_path / "history.sqlite3")

    store.set_history(instrument(), "1mo", "1d", bars(), "live")

    loaded = store.get_history(instrument(), "1mo", "1d")
    assert loaded == bars()


def test_history_store_returns_none_for_mismatch(tmp_path):
    store = HistoryStore(tmp_path / "history.sqlite3")
    store.set_history(instrument(), "1mo", "1d", bars(), "live")

    assert store.get_history(instrument(), "3mo", "1d") is None


def test_history_store_upserts_without_duplicates(tmp_path):
    database_path = tmp_path / "history.sqlite3"
    store = HistoryStore(database_path)

    store.set_history(instrument(), "1mo", "1d", bars(1.5), "live")
    store.set_history(instrument(), "1mo", "1d", bars(9.5), "live")

    loaded = store.get_history(instrument(), "1mo", "1d")
    assert loaded is not None
    assert loaded[0].close == 9.5

    with sqlite3.connect(database_path) as connection:
        count = connection.execute("SELECT COUNT(*) FROM history_bars").fetchone()[0]
    assert count == 2
