from app.models import (
    BacktestEquityPoint,
    BacktestResponse,
    BacktestSummary,
    BacktestTrade,
    Bar,
    Instrument,
    ValidationApiError,
)
from app.services.indicators import moving_average


def _round(value: float) -> float:
    return round(value, 4)


def run_ma_crossover_backtest(
    instrument: Instrument,
    range_value,
    interval,
    source: str,
    bars: list[Bar],
    fast_window: int = 5,
    slow_window: int = 20,
    initial_capital: float = 100000,
    fee_rate_pct: float = 0,
    slippage_pct: float = 0,
) -> BacktestResponse:
    if fast_window < 2:
        raise ValidationApiError("fastWindow must be at least 2")
    if slow_window <= fast_window:
        raise ValidationApiError("slowWindow must be greater than fastWindow")
    if initial_capital <= 0:
        raise ValidationApiError("initialCapital must be greater than 0")
    if fee_rate_pct < 0:
        raise ValidationApiError("feeRatePct must be non-negative")
    if slippage_pct < 0:
        raise ValidationApiError("slippagePct must be non-negative")
    if len(bars) < slow_window:
        raise ValidationApiError("Not enough bars for backtest windows")

    fee_rate = fee_rate_pct / 100
    slippage_rate = slippage_pct / 100
    fast_ma = moving_average(bars, fast_window)
    slow_ma = moving_average(bars, slow_window)
    cash = float(initial_capital)
    position = 0.0
    entry_cost: float | None = None
    closed_results: list[float] = []
    trades: list[BacktestTrade] = []
    equity_curve: list[BacktestEquityPoint] = []
    peak_equity = float(initial_capital)
    max_drawdown_pct = 0.0
    total_fees = 0.0

    for index, bar in enumerate(bars):
        fast_value = fast_ma[index].value
        slow_value = slow_ma[index].value
        previous_fast = fast_ma[index - 1].value if index > 0 else None
        previous_slow = slow_ma[index - 1].value if index > 0 else None

        if None not in (fast_value, slow_value, previous_fast, previous_slow):
            crossed_above = previous_fast <= previous_slow and fast_value > slow_value  # type: ignore[operator]
            crossed_below = previous_fast >= previous_slow and fast_value < slow_value  # type: ignore[operator]

            if crossed_above and position == 0:
                execution_price = bar.close * (1 + slippage_rate)
                position = cash / (execution_price * (1 + fee_rate))
                trade_value = position * execution_price
                fee = trade_value * fee_rate
                cash -= trade_value + fee
                total_fees += fee
                entry_cost = trade_value + fee
                trades.append(_trade(bar, "buy", execution_price, position, cash + position * bar.close, fee, slippage_pct))
            elif crossed_below and position > 0:
                execution_price = bar.close * (1 - slippage_rate)
                trade_value = position * execution_price
                fee = trade_value * fee_rate
                cash = trade_value - fee
                total_fees += fee
                if entry_cost is not None:
                    closed_results.append(cash - entry_cost)
                trades.append(_trade(bar, "sell", execution_price, position, cash, fee, slippage_pct))
                position = 0.0
                entry_cost = None

        equity = cash + position * bar.close
        peak_equity = max(peak_equity, equity)
        if peak_equity > 0:
            max_drawdown_pct = max(max_drawdown_pct, (peak_equity - equity) / peak_equity * 100)
        equity_curve.append(BacktestEquityPoint(
            time=bar.time,
            equity=_round(equity),
            cash=_round(cash),
            position=_round(position),
            price=_round(bar.close),
        ))

    final_equity = equity_curve[-1].equity
    sell_count = len(closed_results)
    win_rate = 0.0 if sell_count == 0 else sum(1 for result in closed_results if result > 0) / sell_count * 100

    return BacktestResponse(
        instrument=instrument,
        range=range_value,
        interval=interval,
        source=source,
        fastWindow=fast_window,
        slowWindow=slow_window,
        initialCapital=_round(float(initial_capital)),
        feeRatePct=_round(fee_rate_pct),
        slippagePct=_round(slippage_pct),
        summary=BacktestSummary(
            initialCapital=_round(float(initial_capital)),
            finalEquity=_round(final_equity),
            totalReturnPct=_round((final_equity - initial_capital) / initial_capital * 100),
            maxDrawdownPct=_round(max_drawdown_pct),
            tradeCount=len(trades),
            winRatePct=_round(win_rate),
            totalFees=_round(total_fees),
        ),
        equityCurve=equity_curve,
        trades=trades,
    )


def _trade(bar: Bar, side: str, price: float, quantity: float, equity: float, fee: float, slippage_pct: float) -> BacktestTrade:
    return BacktestTrade(
        time=bar.time,
        side=side,
        price=_round(price),
        quantity=_round(quantity),
        equity=_round(equity),
        fee=_round(fee),
        slippagePct=_round(slippage_pct),
    )
