from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, Query, Request
from fastapi.responses import JSONResponse

from app.models import ApiError, HealthResponse, HistoryImportResponse
from app.services.backtest import run_ma_crossover_backtest
from app.services.csv_import import parse_history_csv
from app.services.indicators import build_indicators
from app.services.portfolio_backtest import run_equal_weight_portfolio_backtest
from app.services.market_data import MarketDataService


app = FastAPI(title="Quant System API", version="0.1.0")
service = MarketDataService()


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
