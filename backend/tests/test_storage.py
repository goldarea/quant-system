import sqlite3

from app.models import Bar, ExperimentRun, Instrument
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


def test_experiment_runs_roundtrip(tmp_path):
    store = HistoryStore(tmp_path / "history.sqlite3")
    run = ExperimentRun(
        id="run-1",
        time="2024-01-01T00:00:00Z",
        strategy="ma_crossover",
        symbol="AAPL",
        range="1y",
        interval="1d",
        source="local",
        parameters={"fastWindow": 5, "slowWindow": 20, "label": "baseline"},
        finalEquity=101000,
        totalReturnPct=1,
        maxDrawdownPct=2,
        sharpeRatio=1.5,
        tradeCount=3,
        winRatePct=66.67,
    )

    store.add_experiment_run(run)

    loaded = store.list_experiment_runs()
    assert loaded == [run]


def test_experiment_runs_respect_limit_and_newest_first(tmp_path):
    store = HistoryStore(tmp_path / "history.sqlite3")
    for index in range(3):
        store.add_experiment_run(ExperimentRun(
            id=f"run-{index}",
            time=f"2024-01-0{index + 1}T00:00:00Z",
            strategy="buy_and_hold",
            symbol="AAPL",
            range="1mo",
            interval="1d",
            source="local",
            parameters={"initialCapital": 100000 + index},
            finalEquity=100000 + index,
            totalReturnPct=index,
            maxDrawdownPct=0,
            sharpeRatio=0,
            tradeCount=1,
            winRatePct=100,
        ))

    loaded = store.list_experiment_runs(limit=2)
    assert [run.id for run in loaded] == ["run-2", "run-1"]


def test_experiment_runs_delete_one_and_clear_all(tmp_path):
    store = HistoryStore(tmp_path / "history.sqlite3")
    for index in range(2):
        store.add_experiment_run(ExperimentRun(
            id=f"run-{index}",
            time=f"2024-01-0{index + 1}T00:00:00Z",
            strategy="buy_and_hold",
            symbol="AAPL",
            range="1mo",
            interval="1d",
            source="local",
            parameters={},
            finalEquity=100000,
            totalReturnPct=0,
            maxDrawdownPct=0,
            sharpeRatio=0,
            tradeCount=1,
            winRatePct=100,
        ))

    assert store.delete_experiment_run("run-0") == 1
    assert [run.id for run in store.list_experiment_runs()] == ["run-1"]
    assert store.delete_experiment_run("missing") == 0
    assert store.clear_experiment_runs() == 1
    assert store.list_experiment_runs() == []
