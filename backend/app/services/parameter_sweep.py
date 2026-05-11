from app.models import (
    Bar,
    HistoryInterval,
    HistoryRange,
    Instrument,
    ParameterSweepResponse,
    ParameterSweepResult,
    ValidationApiError,
)
from app.services.backtest import run_ma_crossover_backtest


def run_ma_parameter_sweep(
    instrument: Instrument,
    range_value: HistoryRange,
    interval: HistoryInterval,
    source: str,
    bars: list[Bar],
    fast_min: int = 3,
    fast_max: int = 10,
    slow_min: int = 15,
    slow_max: int = 30,
    initial_capital: float = 100000,
    fee_rate_pct: float = 0,
    slippage_pct: float = 0,
) -> ParameterSweepResponse:
    if fast_min < 2:
        raise ValidationApiError("fastMin must be at least 2")
    if fast_max < fast_min:
        raise ValidationApiError("fastMax must be greater than or equal to fastMin")
    if slow_min < 3:
        raise ValidationApiError("slowMin must be at least 3")
    if slow_max < slow_min:
        raise ValidationApiError("slowMax must be greater than or equal to slowMin")
    combinations = (fast_max - fast_min + 1) * (slow_max - slow_min + 1)
    if combinations > 200:
        raise ValidationApiError("Parameter sweep is limited to 200 combinations")

    results: list[ParameterSweepResult] = []
    for fast_window in range(fast_min, fast_max + 1):
        for slow_window in range(slow_min, slow_max + 1):
            if slow_window <= fast_window:
                continue
            response = run_ma_crossover_backtest(
                instrument,
                range_value,
                interval,
                source,
                bars,
                fast_window,
                slow_window,
                initial_capital,
                fee_rate_pct,
                slippage_pct,
            )
            results.append(ParameterSweepResult(
                rank=0,
                fastWindow=fast_window,
                slowWindow=slow_window,
                finalEquity=response.summary.finalEquity,
                totalReturnPct=response.summary.totalReturnPct,
                maxDrawdownPct=response.summary.maxDrawdownPct,
                sharpeRatio=response.summary.sharpeRatio,
                tradeCount=response.summary.tradeCount,
                winRatePct=response.summary.winRatePct,
            ))

    ranked = sorted(results, key=lambda result: (result.totalReturnPct, result.sharpeRatio, -result.maxDrawdownPct), reverse=True)
    ranked = [result.model_copy(update={"rank": index + 1}) for index, result in enumerate(ranked)]

    return ParameterSweepResponse(
        instrument=instrument,
        range=range_value,
        interval=interval,
        source=source,
        initialCapital=round(float(initial_capital), 4),
        feeRatePct=round(float(fee_rate_pct), 4),
        slippagePct=round(float(slippage_pct), 4),
        results=ranked,
    )
