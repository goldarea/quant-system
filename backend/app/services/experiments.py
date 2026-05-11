from datetime import UTC, datetime
from uuid import uuid4

from app.models import BacktestResponse, ExperimentRun, HistoryInterval, HistoryRange


class ExperimentService:
    def __init__(self, max_runs: int = 50) -> None:
        self.max_runs = max_runs
        self.runs: list[ExperimentRun] = []

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
        self.runs.append(run)
        self.runs = self.runs[-self.max_runs:]
        return run

    def list_runs(self) -> list[ExperimentRun]:
        return self.runs[::-1]
