from app.models import Bar, Instrument
from app.services.indicators import build_indicators, exponential_moving_average, macd, moving_average, rsi


def make_bars(count: int) -> list[Bar]:
    return [
        Bar(time=f"2024-01-{index + 1:02d}", open=index + 1, high=index + 2, low=index, close=float(index + 1), volume=100)
        for index in range(count)
    ]


def test_moving_average_returns_none_until_window_ready():
    points = moving_average(make_bars(5), 3)

    assert [point.value for point in points] == [None, None, 2.0, 3.0, 4.0]


def test_exponential_moving_average_aligns_initial_period():
    values = exponential_moving_average([1, 2, 3, 4], 3)

    assert values[0] is None
    assert values[1] is None
    assert values[2] == 2.0
    assert values[3] == 3.0


def test_macd_returns_aligned_points():
    points = macd(make_bars(40))

    assert len(points) == 40
    assert points[0].dif is None
    assert points[-1].dif is not None
    assert points[-1].dea is not None
    assert points[-1].histogram is not None


def test_rsi_bounds_and_insufficient_data():
    points = rsi(make_bars(20), 14)

    assert points[0].value is None
    assert points[13].value is None
    assert points[-1].value == 100.0


def test_build_indicators_response_shape():
    instrument = Instrument(symbol="AAPL", name="Apple Inc.", market="US", currency="USD")
    response = build_indicators(instrument, "1mo", "1d", "demo", make_bars(20))

    assert response.instrument.symbol == "AAPL"
    assert response.source == "demo"
    assert len(response.ma5) == 20
    assert len(response.ma20) == 20
    assert len(response.ma60) == 20
    assert len(response.macd) == 20
    assert len(response.rsi14) == 20
