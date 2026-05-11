from datetime import UTC, datetime
from uuid import uuid4

from app.models import BacktestResponse, ExperimentRun, HistoryInterval, HistoryRange, ValidationApiError
from app.storage import HistoryStore


_SORT_FIELDS = {"time", "totalReturnPct", "sharpeRatio", "maxDrawdownPct", "finalEquity", "tradeCount", "winRatePct"}
_SORT_DIRECTIONS = {"asc", "desc"}


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

    def list_runs(
        self,
        strategy: str | None = None,
        symbol: str | None = None,
        sort_by: str = "time",
        sort_dir: str = "desc",
    ) -> list[ExperimentRun]:
        if sort_by not in _SORT_FIELDS:
            raise ValidationApiError(f"Unsupported experiment sort field: {sort_by}")
        if sort_dir not in _SORT_DIRECTIONS:
            raise ValidationApiError(f"Unsupported experiment sort direction: {sort_dir}")
        return self.store.list_experiment_runs(self.max_runs, strategy, symbol, sort_by, sort_dir)

    def delete_run(self, run_id: str) -> list[ExperimentRun]:
        self.store.delete_experiment_run(run_id)
        return self.list_runs()

    def clear_runs(self) -> list[ExperimentRun]:
        self.store.clear_experiment_runs()
        return self.list_runs()
