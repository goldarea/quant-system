from datetime import UTC, datetime
from uuid import uuid4

from app.models import BacktestResponse, ExperimentRun, HistoryInterval, HistoryRange
from app.storage import HistoryStore


class ExperimentService:
    def __init__(self, store: HistoryStore | None = None, max_runs: int = 50) -> None:
        self.store = store or HistoryStore()
        self.max_runs = max_runs

    def record(
        self,
        strategy: str,
        symbol: str,
        range_value: HistoryRange,
        interval: HistoryInterval,
        source: str,
        parameters: dict[str, float | str],
        response: BacktestResponse,
    ) -> ExperimentRun:
        summary = response.summary
        run = ExperimentRun(
            id=str(uuid4()),
            time=datetime.now(UTC).isoformat(),
            strategy=strategy,
            symbol=symbol,
            range=range_value,
            interval=interval,
            source=source,
            parameters=parameters,
            finalEquity=summary.finalEquity,
            totalReturnPct=summary.totalReturnPct,
            maxDrawdownPct=summary.maxDrawdownPct,
            sharpeRatio=summary.sharpeRatio,
            tradeCount=summary.tradeCount,
            winRatePct=summary.winRatePct,
        )
        self.store.add_experiment_run(run)
        return run

    def list_runs(self) -> list[ExperimentRun]:
        return self.store.list_experiment_runs(self.max_runs)
