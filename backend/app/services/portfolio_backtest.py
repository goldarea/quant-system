from app.models import (
    Bar,
    HistoryInterval,
    HistoryRange,
    HistoryResponse,
    PortfolioBacktestResponse,
    PortfolioBacktestSummary,
    PortfolioEquityPoint,
    PortfolioPosition,
    ValidationApiError,
)


def _round(value: float) -> float:
    return round(value, 4)


def run_equal_weight_portfolio_backtest(
    histories: list[HistoryResponse],
    range_value: HistoryRange,
    interval: HistoryInterval,
    initial_capital: float = 100000,
) -> PortfolioBacktestResponse:
    if initial_capital <= 0:
        raise ValidationApiError("initialCapital must be greater than 0")
    if len(histories) < 2:
        raise ValidationApiError("At least two symbols are required for portfolio backtest")

    aligned_times = _common_times(histories)
    if not aligned_times:
        raise ValidationApiError("No overlapping bars for portfolio backtest")

    capital_per_symbol = initial_capital / len(histories)
    positions: list[PortfolioPosition] = []
    equity_curve: list[PortfolioEquityPoint] = []
    series_by_symbol = [{bar.time: bar for bar in history.bars} for history in histories]

    first_time = aligned_times[0]
    quantities = []
    for history, series in zip(histories, series_by_symbol):
        first_bar = series[first_time]
        if first_bar.close <= 0:
            raise ValidationApiError(f"Invalid first close for symbol: {history.instrument.symbol}")
        quantities.append(capital_per_symbol / first_bar.close)

    for time in aligned_times:
        equity = sum(quantity * series[time].close for quantity, series in zip(quantities, series_by_symbol))
        equity_curve.append(PortfolioEquityPoint(time=time, equity=_round(equity)))

    final_equity = equity_curve[-1].equity
    for history, quantity, series in zip(histories, quantities, series_by_symbol):
        first_bar = series[first_time]
        last_bar = series[aligned_times[-1]]
        market_value = quantity * last_bar.close
        positions.append(PortfolioPosition(
            symbol=history.instrument.symbol,
            name=history.instrument.localName or history.instrument.name,
            quantity=_round(quantity),
            price=_round(last_bar.close),
            marketValue=_round(market_value),
            weightPct=_round(0 if final_equity == 0 else market_value / final_equity * 100),
            returnPct=_round((last_bar.close - first_bar.close) / first_bar.close * 100),
        ))

    sorted_positions = sorted(positions, key=lambda position: position.returnPct)
    return PortfolioBacktestResponse(
        symbols=[history.instrument.symbol for history in histories],
        range=range_value,
        interval=interval,
        allocation="equal_weight",
        summary=PortfolioBacktestSummary(
            initialCapital=_round(initial_capital),
            finalEquity=_round(final_equity),
            totalReturnPct=_round((final_equity - initial_capital) / initial_capital * 100),
            symbolCount=len(histories),
            bestSymbol=sorted_positions[-1].symbol,
            worstSymbol=sorted_positions[0].symbol,
        ),
        equityCurve=equity_curve,
        positions=positions,
    )


def _common_times(histories: list[HistoryResponse]) -> list[str]:
    common = {bar.time for bar in histories[0].bars}
    for history in histories[1:]:
        common &= {bar.time for bar in history.bars}
    return sorted(common)
