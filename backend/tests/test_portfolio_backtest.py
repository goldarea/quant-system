import pytest

from app.models import Bar, HistoryResponse, Instrument, ValidationApiError
from app.services.portfolio_backtest import run_equal_weight_portfolio_backtest


def instrument(symbol: str) -> Instrument:
    return Instrument(symbol=symbol, name=f"{symbol} Inc.", market="US", currency="USD")


def history(symbol: str, closes: list[float]) -> HistoryResponse:
    return HistoryResponse(
        instrument=instrument(symbol),
        range="1mo",
        interval="1d",
        source="local",
        bars=[
            Bar(time=f"2024-01-{index + 1:02d}", open=close, high=close, low=close, close=close, volume=100)
            for index, close in enumerate(closes)
        ],
    )


def test_equal_weight_portfolio_backtest_combines_symbol_equity():
    response = run_equal_weight_portfolio_backtest([
        history("AAPL", [10, 11, 12]),
        history("MSFT", [20, 18, 22]),
    ], "1mo", "1d", 1000)

    assert response.symbols == ["AAPL", "MSFT"]
    assert response.allocation == "equal_weight"
    assert response.summary.initialCapital == 1000
    assert response.summary.finalEquity == 1150
    assert response.summary.totalReturnPct == 15
    assert response.summary.symbolCount == 2
    assert response.summary.bestSymbol == "AAPL"
    assert response.summary.worstSymbol == "MSFT"
    assert [point.equity for point in response.equityCurve] == [1000, 1000, 1150]
    assert response.positions[0].weightPct == 52.1739
    assert response.positions[1].weightPct == 47.8261


def test_equal_weight_portfolio_backtest_requires_multiple_symbols():
    with pytest.raises(ValidationApiError, match="At least two symbols"):
        run_equal_weight_portfolio_backtest([history("AAPL", [10, 11])], "1mo", "1d", 1000)


def test_equal_weight_portfolio_backtest_requires_overlap():
    first = history("AAPL", [10, 11])
    second = history("MSFT", [20, 22])
    second.bars[0].time = "2024-02-01"
    second.bars[1].time = "2024-02-02"

    with pytest.raises(ValidationApiError, match="No overlapping bars"):
        run_equal_weight_portfolio_backtest([first, second], "1mo", "1d", 1000)
