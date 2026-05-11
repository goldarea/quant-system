from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, Query, Request
from fastapi.responses import JSONResponse

from app.models import ApiError, HealthResponse, HistoryImportResponse, PaperOrderRequest, PaperRiskLimitsRequest
from app.services.backtest import run_ma_crossover_backtest
from app.services.csv_import import parse_history_csv
from app.services.indicators import build_indicators
from app.services.paper_trading import PaperTradingService
from app.services.parameter_sweep import run_ma_parameter_sweep
from app.services.portfolio_backtest import run_equal_weight_portfolio_backtest
from app.services.strategies import list_strategies, run_strategy_backtest
from app.services.market_data import MarketDataService


app = FastAPI(title="Quant System API", version="0.1.0")
service = MarketDataService()
paper_service = PaperTradingService()


def ok(data: Any) -> dict[str, Any]:
    if hasattr(data, "model_dump"):
        data = data.model_dump()
    elif isinstance(data, list):
        data = [item.model_dump() if hasattr(item, "model_dump") else item for item in data]
    return {"ok": True, "data": data}


@app.exception_handler(ApiError)
async def api_error_handler(_, exc: ApiError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"ok": False, "error": {"code": exc.code, "message": exc.message}},
    )


@app.get("/api/health")
def health():
    return ok(HealthResponse(status="ok", time=datetime.now(timezone.utc).isoformat()))


@app.get("/api/search")
def search(q: str = ""):
    return ok(service.search(q))


@app.get("/api/history")
def history(
    symbol: str | None = Query(default=None),
    range: str = Query(default="1y"),
    interval: str = Query(default="1d"),
):
    return ok(service.get_history(symbol, range, interval))


@app.post("/api/history/import")
async def import_history(
    request: Request,
    symbol: str | None = Query(default=None),
    range: str = Query(default="1y"),
    interval: str = Query(default="1d"),
):
    instrument = service.resolve(symbol)
    range_value, interval_value = service.validate_history_options(range, interval)
    content = (await request.body()).decode("utf-8-sig")
    bars = parse_history_csv(content)
    service.history_store.set_history(instrument, range_value, interval_value, bars, "import")
    return ok(HistoryImportResponse(
        instrument=instrument,
        range=range_value,
        interval=interval_value,
        imported=len(bars),
        source="import",
    ))


@app.get("/api/strategies")
def strategies():
    return ok(list_strategies())


@app.get("/api/backtest/run")
def strategy_backtest(
    strategy: str = Query(default="ma_crossover"),
    symbol: str | None = Query(default=None),
    range: str = Query(default="1y"),
    interval: str = Query(default="1d"),
    fastWindow: int = Query(default=5),
    slowWindow: int = Query(default=20),
    rsiPeriod: int = Query(default=14),
    oversold: float = Query(default=30),
    overbought: float = Query(default=70),
    macdFast: int = Query(default=12),
    macdSlow: int = Query(default=26),
    macdSignal: int = Query(default=9),
    initialCapital: float = Query(default=100000),
    feeRatePct: float = Query(default=0),
    slippagePct: float = Query(default=0),
):
    history_response = service.get_history(symbol, range, interval)
    return ok(run_strategy_backtest(
        strategy,
        history_response.instrument,
        history_response.range,
        history_response.interval,
        history_response.source,
        history_response.bars,
        {
            "fastWindow": fastWindow,
            "slowWindow": slowWindow,
            "rsiPeriod": rsiPeriod,
            "oversold": oversold,
            "overbought": overbought,
            "macdFast": macdFast,
            "macdSlow": macdSlow,
            "macdSignal": macdSignal,
            "initialCapital": initialCapital,
            "feeRatePct": feeRatePct,
            "slippagePct": slippagePct,
        },
    ))


@app.get("/api/backtest")
def backtest(
    symbol: str | None = Query(default=None),
    range: str = Query(default="1y"),
    interval: str = Query(default="1d"),
    fastWindow: int = Query(default=5),
    slowWindow: int = Query(default=20),
    initialCapital: float = Query(default=100000),
    feeRatePct: float = Query(default=0),
    slippagePct: float = Query(default=0),
):
    history_response = service.get_history(symbol, range, interval)
    return ok(run_ma_crossover_backtest(
        history_response.instrument,
        history_response.range,
        history_response.interval,
        history_response.source,
        history_response.bars,
        fastWindow,
        slowWindow,
        initialCapital,
        feeRatePct,
        slippagePct,
    ))


@app.get("/api/backtest/sweep")
def parameter_sweep(
    symbol: str | None = Query(default=None),
    range: str = Query(default="1y"),
    interval: str = Query(default="1d"),
    fastMin: int = Query(default=3),
    fastMax: int = Query(default=10),
    slowMin: int = Query(default=15),
    slowMax: int = Query(default=30),
    initialCapital: float = Query(default=100000),
    feeRatePct: float = Query(default=0),
    slippagePct: float = Query(default=0),
):
    history_response = service.get_history(symbol, range, interval)
    return ok(run_ma_parameter_sweep(
        history_response.instrument,
        history_response.range,
        history_response.interval,
        history_response.source,
        history_response.bars,
        fastMin,
        fastMax,
        slowMin,
        slowMax,
        initialCapital,
        feeRatePct,
        slippagePct,
    ))


@app.get("/api/backtest/portfolio")
def portfolio_backtest(
    symbols: str = Query(default=""),
    range: str = Query(default="1y"),
    interval: str = Query(default="1d"),
    initialCapital: float = Query(default=100000),
):
    symbol_list = [symbol.strip().upper() for symbol in symbols.split(",") if symbol.strip()]
    histories = [service.get_history(symbol, range, interval) for symbol in symbol_list]
    range_value, interval_value = service.validate_history_options(range, interval)
    return ok(run_equal_weight_portfolio_backtest(histories, range_value, interval_value, initialCapital))


@app.get("/api/paper/account")
def paper_account():
    return ok(paper_service.snapshot())


@app.post("/api/paper/orders")
def paper_order(request: PaperOrderRequest):
    instrument = service.resolve(request.symbol)
    quote_response = service.get_quote(instrument.symbol)
    return ok(paper_service.submit_order(request, instrument, quote_response))


@app.post("/api/paper/risk")
def paper_risk(request: PaperRiskLimitsRequest):
    return ok(paper_service.update_risk_limits(request.maxOrderValuePct, request.maxPositionValuePct))


@app.post("/api/paper/reset")
def paper_reset():
    return ok(paper_service.reset())


@app.get("/api/quote")
def quote(symbol: str | None = Query(default=None)):
    return ok(service.get_quote(symbol))


@app.get("/api/indicators")
def indicators(
    symbol: str | None = Query(default=None),
    range: str = Query(default="1y"),
    interval: str = Query(default="1d"),
):
    history_response = service.get_history(symbol, range, interval)
    return ok(build_indicators(
        history_response.instrument,
        history_response.range,
        history_response.interval,
        history_response.source,
        history_response.bars,
    ))
