from collections.abc import Callable
from dataclasses import dataclass

from app.models import (
    BacktestResponse,
    Bar,
    HistoryInterval,
    HistoryRange,
    Instrument,
    StrategyDefinition,
    StrategyParameter,
    ValidationApiError,
)
from app.services.backtest import run_long_only_signal_backtest, run_ma_crossover_backtest
from app.services.indicators import macd, rsi

StrategyParams = dict[str, float | str]
StrategyRunner = Callable[[Instrument, HistoryRange, HistoryInterval, str, list[Bar], StrategyParams], BacktestResponse]


@dataclass(frozen=True)
class RegisteredStrategy:
    definition: StrategyDefinition
    run: StrategyRunner


def _number(params: StrategyParams, key: str, default: float) -> float:
    value = params.get(key, default)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError as exc:
            raise ValidationApiError(f"{key} must be numeric") from exc
    return float(value)


def _integer(params: StrategyParams, key: str, default: int) -> int:
    value = _number(params, key, default)
    if not value.is_integer():
        raise ValidationApiError(f"{key} must be an integer")
    return int(value)


def _validate_costs(params: StrategyParams) -> tuple[float, float, float]:
    return (
        _number(params, "initialCapital", 100000),
        _number(params, "feeRatePct", 0),
        _number(params, "slippagePct", 0),
    )


def _run_ma_crossover(
    instrument: Instrument,
    range_value: HistoryRange,
    interval: HistoryInterval,
    source: str,
    bars: list[Bar],
    params: StrategyParams,
) -> BacktestResponse:
    initial_capital, fee_rate_pct, slippage_pct = _validate_costs(params)
    return run_ma_crossover_backtest(
        instrument,
        range_value,
        interval,
        source,
        bars,
        _integer(params, "fastWindow", 5),
        _integer(params, "slowWindow", 20),
        initial_capital,
        fee_rate_pct,
        slippage_pct,
    )


def _run_rsi_reversal(
    instrument: Instrument,
    range_value: HistoryRange,
    interval: HistoryInterval,
    source: str,
    bars: list[Bar],
    params: StrategyParams,
) -> BacktestResponse:
    period = _integer(params, "rsiPeriod", 14)
    oversold = _number(params, "oversold", 30)
    overbought = _number(params, "overbought", 70)
    if period < 2:
        raise ValidationApiError("rsiPeriod must be at least 2")
    if oversold >= overbought:
        raise ValidationApiError("oversold must be less than overbought")

    points = rsi(bars, period)
    buy_signals = [False for _ in bars]
    sell_signals = [False for _ in bars]
    for index in range(1, len(points)):
        previous = points[index - 1].value
        current = points[index].value
        if previous is None or current is None:
            continue
        buy_signals[index] = previous < oversold <= current
        sell_signals[index] = previous > overbought >= current

    initial_capital, fee_rate_pct, slippage_pct = _validate_costs(params)
    return run_long_only_signal_backtest(
        instrument,
        range_value,
        interval,
        source,
        bars,
        buy_signals,
        sell_signals,
        0,
        0,
        initial_capital,
        fee_rate_pct,
        slippage_pct,
    )


def _run_macd_trend(
    instrument: Instrument,
    range_value: HistoryRange,
    interval: HistoryInterval,
    source: str,
    bars: list[Bar],
    params: StrategyParams,
) -> BacktestResponse:
    fast = _integer(params, "macdFast", 12)
    slow = _integer(params, "macdSlow", 26)
    signal = _integer(params, "macdSignal", 9)
    if fast < 2:
        raise ValidationApiError("macdFast must be at least 2")
    if slow <= fast:
        raise ValidationApiError("macdSlow must be greater than macdFast")
    if signal < 2:
        raise ValidationApiError("macdSignal must be at least 2")

    points = macd(bars, fast, slow, signal)
    buy_signals = [False for _ in bars]
    sell_signals = [False for _ in bars]
    for index in range(1, len(points)):
        previous_dif = points[index - 1].dif
        previous_dea = points[index - 1].dea
        current_dif = points[index].dif
        current_dea = points[index].dea
        if None in (previous_dif, previous_dea, current_dif, current_dea):
            continue
        buy_signals[index] = previous_dif <= previous_dea and current_dif > current_dea  # type: ignore[operator]
        sell_signals[index] = previous_dif >= previous_dea and current_dif < current_dea  # type: ignore[operator]

    initial_capital, fee_rate_pct, slippage_pct = _validate_costs(params)
    return run_long_only_signal_backtest(
        instrument,
        range_value,
        interval,
        source,
        bars,
        buy_signals,
        sell_signals,
        0,
        0,
        initial_capital,
        fee_rate_pct,
        slippage_pct,
    )


def _run_buy_and_hold(
    instrument: Instrument,
    range_value: HistoryRange,
    interval: HistoryInterval,
    source: str,
    bars: list[Bar],
    params: StrategyParams,
) -> BacktestResponse:
    buy_signals = [index == 0 for index, _ in enumerate(bars)]
    sell_signals = [False for _ in bars]
    initial_capital, fee_rate_pct, slippage_pct = _validate_costs(params)
    return run_long_only_signal_backtest(
        instrument,
        range_value,
        interval,
        source,
        bars,
        buy_signals,
        sell_signals,
        0,
        0,
        initial_capital,
        fee_rate_pct,
        slippage_pct,
    )


_COST_PARAMETERS = [
    StrategyParameter(id="initialCapital", label="初始资金", type="number", default=100000, min=1, step=1000),
    StrategyParameter(id="feeRatePct", label="费率 %", type="number", default=0, min=0, step=0.01),
    StrategyParameter(id="slippagePct", label="滑点 %", type="number", default=0, min=0, step=0.01),
]

_STRATEGIES = {
    "ma_crossover": RegisteredStrategy(
        definition=StrategyDefinition(
            id="ma_crossover",
            name="MA Crossover",
            description="Long-only moving-average crossover strategy with fee and slippage controls.",
            parameters=[
                StrategyParameter(id="fastWindow", label="快线", type="number", default=5, min=2, step=1),
                StrategyParameter(id="slowWindow", label="慢线", type="number", default=20, min=3, step=1),
                *_COST_PARAMETERS,
            ],
        ),
        run=_run_ma_crossover,
    ),
    "rsi_reversal": RegisteredStrategy(
        definition=StrategyDefinition(
            id="rsi_reversal",
            name="RSI Reversal",
            description="Buy when RSI recovers from oversold and exit when it falls from overbought.",
            parameters=[
                StrategyParameter(id="rsiPeriod", label="RSI周期", type="number", default=14, min=2, step=1),
                StrategyParameter(id="oversold", label="超卖线", type="number", default=30, min=1, max=99, step=1),
                StrategyParameter(id="overbought", label="超买线", type="number", default=70, min=1, max=99, step=1),
                *_COST_PARAMETERS,
            ],
        ),
        run=_run_rsi_reversal,
    ),
    "macd_trend": RegisteredStrategy(
        definition=StrategyDefinition(
            id="macd_trend",
            name="MACD Trend",
            description="Trade long-only DIF/DEA trend crossovers.",
            parameters=[
                StrategyParameter(id="macdFast", label="MACD快线", type="number", default=12, min=2, step=1),
                StrategyParameter(id="macdSlow", label="MACD慢线", type="number", default=26, min=3, step=1),
                StrategyParameter(id="macdSignal", label="信号线", type="number", default=9, min=2, step=1),
                *_COST_PARAMETERS,
            ],
        ),
        run=_run_macd_trend,
    ),
    "buy_and_hold": RegisteredStrategy(
        definition=StrategyDefinition(
            id="buy_and_hold",
            name="Buy and Hold",
            description="Invest from the first available close and hold through the full range.",
            parameters=[*_COST_PARAMETERS],
        ),
        run=_run_buy_and_hold,
    ),
}


def list_strategies() -> list[StrategyDefinition]:
    return [strategy.definition for strategy in _STRATEGIES.values()]


def run_strategy_backtest(
    strategy_id: str,
    instrument: Instrument,
    range_value: HistoryRange,
    interval: HistoryInterval,
    source: str,
    bars: list[Bar],
    params: StrategyParams,
) -> BacktestResponse:
    strategy = _STRATEGIES.get(strategy_id)
    if strategy is None:
        raise ValidationApiError(f"Unknown strategy: {strategy_id}")
    return strategy.run(instrument, range_value, interval, source, bars, params)
