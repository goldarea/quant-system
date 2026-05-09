from __future__ import annotations

import sqlite3
from pathlib import Path
from time import time

from app.models import Bar, HistoryInterval, HistoryRange, Instrument


class HistoryStore:
    def __init__(self, database_path: str | Path = ".cache/quant-system.sqlite3") -> None:
        self.database_path = Path(database_path)
        self._initialized = False

    def _connect(self) -> sqlite3.Connection:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        if not self._initialized:
            self._initialize(connection)
            self._initialized = True
        return connection

    def _initialize(self, connection: sqlite3.Connection) -> None:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS history_bars (
              provider_symbol TEXT NOT NULL,
              symbol TEXT NOT NULL,
              market TEXT NOT NULL,
              range_value TEXT NOT NULL,
              interval TEXT NOT NULL,
              time TEXT NOT NULL,
              open REAL NOT NULL,
              high REAL NOT NULL,
              low REAL NOT NULL,
              close REAL NOT NULL,
              volume INTEGER NOT NULL,
              source TEXT NOT NULL,
              saved_at REAL NOT NULL,
              PRIMARY KEY (provider_symbol, range_value, interval, time)
            )
            """
        )
        connection.commit()

    def _provider_symbol(self, instrument: Instrument) -> str:
        return instrument.providerSymbol or instrument.symbol

    def get_history(
        self,
        instrument: Instrument,
        range_value: HistoryRange,
        interval: HistoryInterval,
    ) -> list[Bar] | None:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT time, open, high, low, close, volume
                FROM history_bars
                WHERE provider_symbol = ? AND range_value = ? AND interval = ?
                ORDER BY time ASC
                """,
                (self._provider_symbol(instrument), range_value, interval),
            ).fetchall()

        if not rows:
            return None

        return [
            Bar(
                time=row["time"],
                open=row["open"],
                high=row["high"],
                low=row["low"],
                close=row["close"],
                volume=row["volume"],
            )
            for row in rows
        ]

    def set_history(
        self,
        instrument: Instrument,
        range_value: HistoryRange,
        interval: HistoryInterval,
        bars: list[Bar],
        source: str,
    ) -> None:
        if not bars:
            return

        provider_symbol = self._provider_symbol(instrument)
        saved_at = time()
        values = [
            (
                provider_symbol,
                instrument.symbol,
                instrument.market,
                range_value,
                interval,
                bar.time,
                bar.open,
                bar.high,
                bar.low,
                bar.close,
                bar.volume,
                source,
                saved_at,
            )
            for bar in bars
        ]

        with self._connect() as connection:
            connection.executemany(
                """
                INSERT INTO history_bars (
                  provider_symbol, symbol, market, range_value, interval, time,
                  open, high, low, close, volume, source, saved_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(provider_symbol, range_value, interval, time) DO UPDATE SET
                  symbol = excluded.symbol,
                  market = excluded.market,
                  open = excluded.open,
                  high = excluded.high,
                  low = excluded.low,
                  close = excluded.close,
                  volume = excluded.volume,
                  source = excluded.source,
                  saved_at = excluded.saved_at
                """,
                values,
            )
            connection.commit()
