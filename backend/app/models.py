from typing import Literal

from pydantic import BaseModel, Field


ValidationErrorCode = "VALIDATION_ERROR"
NotFoundErrorCode = "NOT_FOUND"
UpstreamErrorCode = "UPSTREAM_ERROR"

HistoryRange = Literal["1mo", "3mo", "6mo", "1y", "5y", "max"]
HistoryInterval = Literal["1d", "1wk", "1mo"]


class ApiError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class ValidationApiError(ApiError):
    def __init__(self, message: str) -> None:
        super().__init__(ValidationErrorCode, message, 400)


class NotFoundApiError(ApiError):
    def __init__(self, message: str) -> None:
        super().__init__(NotFoundErrorCode, message, 404)


class UpstreamApiError(ApiError):
    def __init__(self, message: str) -> None:
        super().__init__(UpstreamErrorCode, message, 502)


class Instrument(BaseModel):
    symbol: str
    name: str
    localName: str | None = None
    market: str
    exchange: str | None = None
    currency: str
    providerSymbol: str | None = None


class Bar(BaseModel):
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: int = Field(ge=0)


class WarningPayload(BaseModel):
    code: str
    message: str


class HistoryResponse(BaseModel):
    instrument: Instrument
    range: HistoryRange
    interval: HistoryInterval
    bars: list[Bar]
    source: str
    warning: WarningPayload | None = None


class HistoryImportResponse(BaseModel):
    instrument: Instrument
    range: HistoryRange
    interval: HistoryInterval
    imported: int
    source: str


class Quote(BaseModel):
    instrument: Instrument
    symbol: str
    name: str
    market: str
    currency: str
    price: float
    time: str
    volume: int
    source: str


class BacktestEquityPoint(BaseModel):
    time: str
    equity: float
    cash: float
    position: float
    price: float


class BacktestTrade(BaseModel):
    time: str
    side: str
    price: float
    quantity: float
    equity: float
    fee: float = 0
    slippagePct: float = 0


class BacktestReturnPoint(BaseModel):
    time: str
    returnPct: float


class BacktestDrawdownPeriod(BaseModel):
    start: str
    end: str
    durationBars: int
    maxDrawdownPct: float


class BacktestTradeMetrics(BaseModel):
    averageHoldingBars: float
    averageWin: float
    averageLoss: float
    profitFactor: float
    payoffRatio: float


class BacktestBenchmark(BaseModel):
    name: str
    finalEquity: float
    totalReturnPct: float
    excessReturnPct: float


class StrategyParameter(BaseModel):
    id: str
    label: str
    type: str
    default: float | str
    min: float | None = None
    max: float | None = None
    step: float | None = None


class StrategyDefinition(BaseModel):
    id: str
    name: str
    description: str
    parameters: list[StrategyParameter]


class BacktestSummary(BaseModel):
    initialCapital: float
    finalEquity: float
    totalReturnPct: float
    maxDrawdownPct: float
    tradeCount: int
    winRatePct: float
    totalFees: float = 0
    annualizedReturnPct: float = 0
    annualizedVolatilityPct: float = 0
    sharpeRatio: float = 0
    calmarRatio: float = 0
    maxDrawdownStart: str = ""
    maxDrawdownEnd: str = ""
    maxDrawdownDurationBars: int = 0


class BacktestResponse(BaseModel):
    instrument: Instrument
    range: HistoryRange
    interval: HistoryInterval
    source: str
    fastWindow: int
    slowWindow: int
    initialCapital: float
    feeRatePct: float
    slippagePct: float
    summary: BacktestSummary
    equityCurve: list[BacktestEquityPoint]
    trades: list[BacktestTrade]
    dailyReturns: list[BacktestReturnPoint]
    drawdown: BacktestDrawdownPeriod
    tradeMetrics: BacktestTradeMetrics
    benchmark: BacktestBenchmark


class PortfolioPosition(BaseModel):
    symbol: str
    name: str
    quantity: float
    price: float
    marketValue: float
    weightPct: float
    returnPct: float


class PortfolioEquityPoint(BaseModel):
    time: str
    equity: float


class PortfolioBacktestSummary(BaseModel):
    initialCapital: float
    finalEquity: float
    totalReturnPct: float
    symbolCount: int
    bestSymbol: str
    worstSymbol: str


class PortfolioBacktestResponse(BaseModel):
    symbols: list[str]
    range: HistoryRange
    interval: HistoryInterval
    allocation: str
    summary: PortfolioBacktestSummary
    equityCurve: list[PortfolioEquityPoint]
    positions: list[PortfolioPosition]


class IndicatorPoint(BaseModel):
    time: str
    value: float | None = None


class MacdPoint(BaseModel):
    time: str
    dif: float | None = None
    dea: float | None = None
    histogram: float | None = None


class RsiPoint(BaseModel):
    time: str
    value: float | None = None


class IndicatorsResponse(BaseModel):
    instrument: Instrument
    range: HistoryRange
    interval: HistoryInterval
    source: str
    ma5: list[IndicatorPoint]
    ma20: list[IndicatorPoint]
    ma60: list[IndicatorPoint]
    macd: list[MacdPoint]
    rsi14: list[RsiPoint]


class HealthResponse(BaseModel):
    status: str
    time: str
