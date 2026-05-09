import pytest

from app.models import Bar, Instrument, ValidationApiError
from app.services.backtest import run_ma_crossover_backtest


def instrument() -> Instrument:
    return Instrument(symbol="AAPL", name="Apple Inc.", market="US", currency="USD")


def bars_from_closes(closes: list[float]) -> list[Bar]:
    return [
        Bar(time=f"2024-01-{index + 1:02d}", open=close, high=close + 1, low=close - 1, close=close, volume=100)
        for index, close in enumerate(closes)
    ]


def test_ma_crossover_backtest_trades_and_returns_positive():
    bars = bars_from_closes([10, 9, 8, 7, 8, 9, 10, 11, 12, 11, 10, 9])

    response = run_ma_crossover_backtest(instrument(), "1mo", "1d", "local", bars, 2, 3, 1000)

    assert [trade.side for trade in response.trades] == ["buy", "sell"]
    assert response.summary.tradeCount == 2
    assert response.summary.finalEquity > 1000
    assert response.summary.totalReturnPct > 0
    assert len(response.equityCurve) == len(bars)


def test_ma_crossover_backtest_no_signal_returns_flat_equity():
    bars = bars_from_closes([10, 10, 10, 10, 10])

    response = run_ma_crossover_backtest(instrument(), "1mo", "1d", "local", bars, 2, 3, 1000)

    assert response.trades == []
    assert response.summary.finalEquity == 1000
    assert response.summary.tradeCount == 0
    assert response.summary.winRatePct == 0


def test_ma_crossover_backtest_rejects_invalid_windows():
    with pytest.raises(ValidationApiError, match="fastWindow"):
        run_ma_crossover_backtest(instrument(), "1mo", "1d", "local", bars_from_closes([1, 2, 3]), 1, 3, 1000)

    with pytest.raises(ValidationApiError, match="slowWindow"):
        run_ma_crossover_backtest(instrument(), "1mo", "1d", "local", bars_from_closes([1, 2, 3]), 3, 3, 1000)


def test_ma_crossover_backtest_rejects_insufficient_bars():
    with pytest.raises(ValidationApiError, match="Not enough bars"):
        run_ma_crossover_backtest(instrument(), "1mo", "1d", "local", bars_from_closes([1, 2]), 2, 3, 1000)


def test_ma_crossover_backtest_tracks_drawdown():
    bars = bars_from_closes([10, 9, 8, 7, 8, 9, 10, 6])

    response = run_ma_crossover_backtest(instrument(), "1mo", "1d", "local", bars, 2, 3, 1000)

    assert response.summary.maxDrawdownPct > 0


def test_ma_crossover_backtest_costs_reduce_final_equity():
    bars = bars_from_closes([10, 9, 8, 7, 8, 9, 10, 11, 12, 11, 10, 9])

    zero_cost = run_ma_crossover_backtest(instrument(), "1mo", "1d", "local", bars, 2, 3, 1000)
    with_costs = run_ma_crossover_backtest(instrument(), "1mo", "1d", "local", bars, 2, 3, 1000, 0.1, 0.2)

    assert with_costs.summary.finalEquity < zero_cost.summary.finalEquity
    assert with_costs.summary.totalFees > 0
    assert with_costs.trades[0].fee > 0
    assert with_costs.trades[0].slippagePct == 0.2


def test_ma_crossover_backtest_rejects_negative_costs():
    bars = bars_from_closes([1, 2, 3])

    with pytest.raises(ValidationApiError, match="feeRatePct"):
        run_ma_crossover_backtest(instrument(), "1mo", "1d", "local", bars, 2, 3, 1000, -0.1, 0)

    with pytest.raises(ValidationApiError, match="slippagePct"):
        run_ma_crossover_backtest(instrument(), "1mo", "1d", "local", bars, 2, 3, 1000, 0, -0.1)


def test_ma_crossover_backtest_reports_professional_metrics():
    bars = bars_from_closes([10, 9, 8, 7, 8, 9, 10, 11, 12, 11, 10, 9])

    response = run_ma_crossover_backtest(instrument(), "1mo", "1d", "local", bars, 2, 3, 1000)

    assert len(response.dailyReturns) == len(bars) - 1
    assert response.summary.annualizedReturnPct > 0
    assert response.summary.annualizedVolatilityPct > 0
    assert response.summary.sharpeRatio > 0
    assert response.summary.calmarRatio > 0
    assert response.drawdown.maxDrawdownPct == response.summary.maxDrawdownPct
    assert response.summary.maxDrawdownStart == response.drawdown.start
    assert response.summary.maxDrawdownEnd == response.drawdown.end
    assert response.summary.maxDrawdownDurationBars == response.drawdown.durationBars
    assert response.tradeMetrics.averageHoldingBars == 5
    assert response.tradeMetrics.averageWin > 0
    assert response.tradeMetrics.profitFactor == 0
    assert response.benchmark.name == "buy_and_hold"
    assert response.benchmark.finalEquity == 900
    assert response.benchmark.excessReturnPct > 0


def test_ma_crossover_backtest_report_handles_flat_no_trade_case():
    bars = bars_from_closes([10, 10, 10, 10, 10])

    response = run_ma_crossover_backtest(instrument(), "1mo", "1d", "local", bars, 2, 3, 1000)

    assert response.summary.annualizedReturnPct == 0
    assert response.summary.annualizedVolatilityPct == 0
    assert response.summary.sharpeRatio == 0
    assert response.summary.calmarRatio == 0
    assert response.drawdown.start == ""
    assert response.drawdown.end == ""
    assert response.drawdown.durationBars == 0
    assert response.tradeMetrics.averageHoldingBars == 0
    assert response.tradeMetrics.averageWin == 0
    assert response.tradeMetrics.averageLoss == 0
    assert response.benchmark.totalReturnPct == 0
