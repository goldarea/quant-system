from math import sqrt

from app.models import (
    BacktestBenchmark,
    BacktestDrawdownPeriod,
    BacktestEquityPoint,
    BacktestResponse,
    BacktestReturnPoint,
    BacktestSummary,
    BacktestTrade,
    BacktestTradeMetrics,
    Bar,
    HistoryInterval,
    HistoryRange,
    Instrument,
    ValidationApiError,
)
from app.services.indicators import moving_average


def _round(value: float) -> float:
    return round(value, 4)


def run_ma_crossover_backtest(
    instrument: Instrument,
    range_value: HistoryRange,
    interval: HistoryInterval,
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
    if len(bars) < slow_window:
        raise ValidationApiError("Not enough bars for backtest windows")

    fast_ma = moving_average(bars, fast_window)
    slow_ma = moving_average(bars, slow_window)
    buy_signals = [False for _ in bars]
    sell_signals = [False for _ in bars]

    for index in range(1, len(bars)):
        fast_value = fast_ma[index].value
        slow_value = slow_ma[index].value
        previous_fast = fast_ma[index - 1].value
        previous_slow = slow_ma[index - 1].value
        if None in (fast_value, slow_value, previous_fast, previous_slow):
            continue
        buy_signals[index] = previous_fast <= previous_slow and fast_value > slow_value  # type: ignore[operator]
        sell_signals[index] = previous_fast >= previous_slow and fast_value < slow_value  # type: ignore[operator]

    return run_long_only_signal_backtest(
        instrument,
        range_value,
        interval,
        source,
        bars,
        buy_signals,
        sell_signals,
        fast_window,
        slow_window,
        initial_capital,
        fee_rate_pct,
        slippage_pct,
    )


def run_long_only_signal_backtest(
    instrument: Instrument,
    range_value: HistoryRange,
    interval: HistoryInterval,
    source: str,
    bars: list[Bar],
    buy_signals: list[bool],
    sell_signals: list[bool],
    fast_window: int = 0,
    slow_window: int = 0,
    initial_capital: float = 100000,
    fee_rate_pct: float = 0,
    slippage_pct: float = 0,
) -> BacktestResponse:
    if initial_capital <= 0:
        raise ValidationApiError("initialCapital must be greater than 0")
    if fee_rate_pct < 0:
        raise ValidationApiError("feeRatePct must be non-negative")
    if slippage_pct < 0:
        raise ValidationApiError("slippagePct must be non-negative")
    if not bars:
        raise ValidationApiError("Not enough bars for backtest")
    if len(buy_signals) != len(bars) or len(sell_signals) != len(bars):
        raise ValidationApiError("Signal length must match bars")

    fee_rate = fee_rate_pct / 100
    slippage_rate = slippage_pct / 100
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
        if buy_signals[index] and position == 0:
            execution_price = bar.close * (1 + slippage_rate)
            position = cash / (execution_price * (1 + fee_rate))
            trade_value = position * execution_price
            fee = trade_value * fee_rate
            cash -= trade_value + fee
            total_fees += fee
            entry_cost = trade_value + fee
            trades.append(_trade(bar, "buy", execution_price, position, cash + position * bar.close, fee, slippage_pct))
        elif sell_signals[index] and position > 0:
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
    daily_returns = _return_points(equity_curve)
    drawdown = _drawdown_period(equity_curve)
    annualized_return_pct = _annualized_return_pct(float(initial_capital), final_equity, len(equity_curve), interval)
    annualized_volatility_pct = _annualized_volatility_pct(daily_returns, interval)
    sharpe_ratio = 0.0 if annualized_volatility_pct == 0 else annualized_return_pct / annualized_volatility_pct
    calmar_ratio = 0.0 if drawdown.maxDrawdownPct == 0 else annualized_return_pct / drawdown.maxDrawdownPct
    benchmark = _buy_and_hold_benchmark(bars, float(initial_capital), (final_equity - initial_capital) / initial_capital * 100)

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
            maxDrawdownPct=_round(drawdown.maxDrawdownPct),
            tradeCount=len(trades),
            winRatePct=_round(win_rate),
            totalFees=_round(total_fees),
            annualizedReturnPct=_round(annualized_return_pct),
            annualizedVolatilityPct=_round(annualized_volatility_pct),
            sharpeRatio=_round(sharpe_ratio),
            calmarRatio=_round(calmar_ratio),
            maxDrawdownStart=drawdown.start,
            maxDrawdownEnd=drawdown.end,
            maxDrawdownDurationBars=drawdown.durationBars,
        ),
        equityCurve=equity_curve,
        trades=trades,
        dailyReturns=daily_returns,
        drawdown=drawdown,
        tradeMetrics=_trade_metrics(trades, closed_results, bars),
        benchmark=benchmark,
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


def _periods_per_year(interval: HistoryInterval) -> int:
    if interval == "1wk":
        return 52
    if interval == "1mo":
        return 12
    return 252


def _return_points(equity_curve: list[BacktestEquityPoint]) -> list[BacktestReturnPoint]:
    points: list[BacktestReturnPoint] = []
    for index in range(1, len(equity_curve)):
        previous = equity_curve[index - 1].equity
        current = equity_curve[index].equity
        return_pct = 0.0 if previous == 0 else (current - previous) / previous * 100
        points.append(BacktestReturnPoint(time=equity_curve[index].time, returnPct=_round(return_pct)))
    return points


def _annualized_return_pct(initial_capital: float, final_equity: float, periods: int, interval: HistoryInterval) -> float:
    if initial_capital <= 0 or periods <= 1 or final_equity <= 0:
        return 0.0
    years = (periods - 1) / _periods_per_year(interval)
    if years <= 0:
        return 0.0
    return ((final_equity / initial_capital) ** (1 / years) - 1) * 100


def _annualized_volatility_pct(return_points: list[BacktestReturnPoint], interval: HistoryInterval) -> float:
    if len(return_points) < 2:
        return 0.0
    returns = [point.returnPct / 100 for point in return_points]
    mean_return = sum(returns) / len(returns)
    variance = sum((value - mean_return) ** 2 for value in returns) / (len(returns) - 1)
    return sqrt(variance) * sqrt(_periods_per_year(interval)) * 100


def _drawdown_period(equity_curve: list[BacktestEquityPoint]) -> BacktestDrawdownPeriod:
    if not equity_curve:
        return BacktestDrawdownPeriod(start="", end="", durationBars=0, maxDrawdownPct=0)

    peak_index = 0
    best_start = 0
    best_end = 0
    max_drawdown_pct = 0.0
    for index, point in enumerate(equity_curve):
        if point.equity > equity_curve[peak_index].equity:
            peak_index = index
        peak_equity = equity_curve[peak_index].equity
        drawdown_pct = 0.0 if peak_equity == 0 else (peak_equity - point.equity) / peak_equity * 100
        if drawdown_pct > max_drawdown_pct:
            max_drawdown_pct = drawdown_pct
            best_start = peak_index
            best_end = index

    return BacktestDrawdownPeriod(
        start=equity_curve[best_start].time if max_drawdown_pct > 0 else "",
        end=equity_curve[best_end].time if max_drawdown_pct > 0 else "",
        durationBars=best_end - best_start if max_drawdown_pct > 0 else 0,
        maxDrawdownPct=_round(max_drawdown_pct),
    )


def _trade_metrics(trades: list[BacktestTrade], closed_results: list[float], bars: list[Bar]) -> BacktestTradeMetrics:
    wins = [result for result in closed_results if result > 0]
    losses = [result for result in closed_results if result < 0]
    gross_profit = sum(wins)
    gross_loss = abs(sum(losses))
    time_index = {bar.time: index for index, bar in enumerate(bars)}
    holding_bars: list[int] = []
    open_trade: BacktestTrade | None = None

    for trade in trades:
        if trade.side == "buy":
            open_trade = trade
        elif trade.side == "sell" and open_trade is not None:
            buy_index = time_index.get(open_trade.time)
            sell_index = time_index.get(trade.time)
            if buy_index is not None and sell_index is not None:
                holding_bars.append(sell_index - buy_index)
            open_trade = None

    average_holding = 0.0 if not holding_bars else sum(holding_bars) / len(holding_bars)
    average_win = 0.0 if not wins else sum(wins) / len(wins)
    average_loss = 0.0 if not losses else gross_loss / len(losses)
    profit_factor = 0.0 if gross_loss == 0 else gross_profit / gross_loss
    payoff_ratio = 0.0 if average_loss == 0 else average_win / average_loss

    return BacktestTradeMetrics(
        averageHoldingBars=_round(average_holding),
        averageWin=_round(average_win),
        averageLoss=_round(average_loss),
        profitFactor=_round(profit_factor),
        payoffRatio=_round(payoff_ratio),
    )


def _buy_and_hold_benchmark(bars: list[Bar], initial_capital: float, strategy_return_pct: float) -> BacktestBenchmark:
    if not bars or bars[0].close <= 0:
        return BacktestBenchmark(name="buy_and_hold", finalEquity=_round(initial_capital), totalReturnPct=0, excessReturnPct=_round(strategy_return_pct))
    quantity = initial_capital / bars[0].close
    final_equity = quantity * bars[-1].close
    total_return_pct = (final_equity - initial_capital) / initial_capital * 100
    return BacktestBenchmark(
        name="buy_and_hold",
        finalEquity=_round(final_equity),
        totalReturnPct=_round(total_return_pct),
        excessReturnPct=_round(strategy_return_pct - total_return_pct),
    )
