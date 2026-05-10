# Quant System FastAPI Backend

This backend serves the Quant System API used by the Vite frontend.

Success responses use:

```json
{ "ok": true, "data": {} }
```

Errors use:

```json
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

## Setup

From the repository root, the simplest option is:

```powershell
cd D:\self\quant-system
.\start-backend.bat
```

The script enters `backend/`, creates `.venv` if needed, installs
`requirements.txt`, and starts Uvicorn on `http://127.0.0.1:8000`.

Manual setup:

```powershell
cd D:\self\quant-system\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pytest tests
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

## Routes

- `GET /api/health`
- `GET /api/search?q=apple`
- `GET /api/history?symbol=AAPL&range=1mo&interval=1d`
- `POST /api/history/import?symbol=AAPL&range=1mo&interval=1d`
- `GET /api/quote?symbol=AAPL`
- `GET /api/strategies`
- `GET /api/backtest/run?strategy=ma_crossover&symbol=AAPL&range=1mo&interval=1d`
- `GET /api/backtest?symbol=AAPL&range=1mo&interval=1d&feeRatePct=0.1&slippagePct=0.2`
- `GET /api/backtest/portfolio?symbols=AAPL,MSFT&range=1mo&interval=1d`

## Backtesting

`GET /api/strategies` returns the registered strategy schema used by the
frontend to render dynamic parameter controls. `GET /api/backtest/run` executes
the selected strategy; registered strategies are `ma_crossover`, `rsi_reversal`,
`macd_trend`, and `buy_and_hold`. The original `GET /api/backtest` route remains
available as the compatibility endpoint for MA crossover.

`GET /api/backtest` runs a minimal long-only moving-average crossover backtest on
the same bars returned by `/api/history`. Query params include `fastWindow`,
`slowWindow`, `initialCapital`, `feeRatePct`, and `slippagePct`; defaults are
MA5/MA20, initial capital `100000`, and zero costs. Trades execute from the
current close with deterministic percentage fee/slippage accounting, no short
selling, and no persisted strategy run records. The response includes a
professional report with daily returns, annualized return/volatility, Sharpe,
Calmar, max drawdown period, trade-quality metrics, and a buy-and-hold benchmark.

## Data Quality

History responses include a `quality` report with total bars, duplicate bars,
missing US/CN weekday daily bars, invalid OHLC bars, stale-series status, and
issue details. The checks are intended to catch common local-cache/import and
provider anomalies before a strategy result is trusted.

## Data Providers

US-market history uses the Yahoo chart endpoint when available. CN-market
history uses the Eastmoney kline endpoint when available.

If an upstream request fails, the service returns deterministic demo bars with
`source: "demo"` and a warning payload so the UI remains usable. Successful live
history responses are persisted to `.cache/quant-system.sqlite3`; matching later
requests can return `source: "local"` without calling the upstream provider.

Historical CSV files can be imported with `POST /api/history/import` using a raw
`text/csv` body. Required headers are `time,open,high,low,close,volume`; `date`
is accepted as an alias for `time`. Imported bars are saved to the same SQLite
store and are returned by later history requests as local data.
