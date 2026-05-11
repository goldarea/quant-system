# Quant System

Local market-data dashboard for searching instruments, viewing quotes, and
rendering K-line history. The project now uses a Vite React frontend with a
FastAPI backend as the default local runtime.

## Current Architecture

```text
quant-system/
  frontend/      Vite + React + TypeScript dashboard
  backend/       FastAPI market-data API
  src/           Legacy Node API and static MVP, kept as reference
  tests/         Legacy Node API tests
  docs/          Design and implementation plans
```

The frontend proxies `/api/*` to the FastAPI backend on
`http://127.0.0.1:8000`.

## Requirements

- Node.js 22 or newer.
- npm for the Vite frontend.
- Python 3.12 or newer.
- Internet access for live upstream market-data requests.

## Start Everything

From the project root:

```powershell
cd D:\self\quant-system
.\start-all.bat
```

This opens separate windows for:

- FastAPI backend: `http://127.0.0.1:8000`
- Vite frontend: `http://127.0.0.1:5173`

Open:

```text
http://127.0.0.1:5173/
```

## Start Services Separately

Backend:

```powershell
cd D:\self\quant-system
.\start-backend.bat
```

Frontend:

```powershell
cd D:\self\quant-system
.\start-frontend.bat
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

## Tests And Build

FastAPI backend tests:

```powershell
cd D:\self\quant-system\backend
.\.venv\Scripts\python.exe -m pytest tests
```

Frontend tests and production build:

```powershell
cd D:\self\quant-system\frontend
npm test
npm run build
```

Legacy Node API tests:

```powershell
cd D:\self\quant-system
npm test
```

`npm run build` may print a Vite chunk-size warning because Arco Design and
ECharts are bundled together. That warning does not block the current milestone.

## API

All API responses use an envelope.

Success:

```json
{ "ok": true, "data": {} }
```

Error:

```json
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

Routes:

- `GET /api/health`
- `GET /api/search?q=apple`
- `GET /api/history?symbol=AAPL&range=1y&interval=1d`
- `POST /api/history/import?symbol=AAPL&range=1y&interval=1d`
- `GET /api/quote?symbol=AAPL`
- `GET /api/indicators?symbol=AAPL&range=1y&interval=1d`
- `GET /api/strategies`
- `GET /api/backtest/run?strategy=ma_crossover&symbol=AAPL&range=1y&interval=1d`
- `GET /api/experiments/runs`
- `DELETE /api/experiments/runs/{id}`
- `DELETE /api/experiments/runs`
- `GET /api/backtest?symbol=AAPL&range=1y&interval=1d&feeRatePct=0.1&slippagePct=0.2`
- `GET /api/backtest/sweep?symbol=AAPL&range=1y&interval=1d&fastMin=3&fastMax=10&slowMin=15&slowMax=30`
- `GET /api/backtest/portfolio?symbols=AAPL,MSFT&range=1y&interval=1d`
- `GET /api/paper/account`
- `POST /api/paper/orders`
- `POST /api/paper/risk`
- `POST /api/paper/reset`

Starter symbols include common US stocks, major ETFs, and common A-share
symbols. The dashboard also includes a browser-local watchlist stored in
`localStorage`, MA overlay controls, and MACD/RSI indicator summaries. Public
upstream endpoints are suitable for personal research and
prototyping, not licensed production real-time market data.

The dashboard now selects backtest strategies from `/api/strategies` and renders
parameter controls from the returned schema. Registered strategies include MA
crossover, RSI reversal, MACD trend, and buy-and-hold; `/api/backtest/run`
executes the selected strategy while the original `/api/backtest` route remains
available for MA crossover compatibility. Successful strategy runs are also kept
in a local SQLite-backed experiment ledger exposed by `/api/experiments/runs`, and
the dashboard renders recent runs with strategy, symbol, parameters, key
performance metrics, filter controls, and local delete/clear actions. The dashboard can also run MA crossover
parameter sweeps across fast/slow window ranges, ranking combinations by return,
Sharpe, and drawdown so batch results can be compared without manual retuning.
The backtest report includes annualized
return, annualized volatility, Sharpe, Calmar, drawdown period, trade-quality
metrics, and a buy-and-hold benchmark comparison. The dashboard also runs an
equal-weight portfolio backtest for browser-local watchlist symbols, showing
combined equity, final positions, weights, and per-symbol returns. The backtest
uses current close prices, applies percentage fees and slippage deterministically,
does not short sell, and stores experiment summaries in the local SQLite cache so
they survive backend restarts; it is intended as a first local analysis baseline.

If an upstream provider is unavailable, the backend can return deterministic
demo bars marked with `source: "demo"` so the UI remains usable. Successful live
history responses are also persisted to `.cache/quant-system.sqlite3`; later
requests for the same symbol/range/interval can return `source: "local"`. Each
history response includes a data-quality report that checks duplicate bars,
missing weekday trading bars for US/CN daily data, invalid OHLC values, and stale
series; the dashboard renders these checks in a data-quality panel.

The dashboard also includes a local paper-trading panel backed by simulated
cash, positions, orders, and fills. Market paper orders execute against the
latest quote, apply configurable buying-power, single-order value,
single-position value, and position-quantity checks, and append audit events for
submissions, fills, rejections, risk updates, and resets. All state remains local
to the FastAPI process; no real broker integration is performed.

CSV imports can be sent from the dashboard or posted as `text/csv` to
`/api/history/import`. Required headers are `time,open,high,low,close,volume`;
`date` is also accepted instead of `time`. Imported bars are stored in the same
SQLite database and are later served through `/api/history` as `source: "local"`.

## Roadmap

The next execution plan is tracked in `docs/PROJECT_HANDOFF.md`. Near-term
priority is:

1. Professional backtest report with annualized return, volatility, Sharpe,
   drawdown periods, trade metrics, and benchmark comparison.
2. Multi-symbol portfolio backtesting with positions, rebalances, and portfolio
   equity attribution.
3. Strategy framework is in place for MA crossover, RSI reversal, MACD trend,
   and buy-and-hold with schema-driven frontend parameters.
4. Data quality checks are in place for duplicate bars, missing US/CN weekday
   daily bars, invalid OHLC values, and stale history series.
5. Paper trading is in place with simulated cash, market orders, fills,
   positions, buying-power checks, pre-trade risk limits, and a dashboard account
   panel.
6. Parameter sweep is in place for MA crossover fast/slow window result
   comparison.
7. Experiment tracking is in place for recent persisted strategy run summaries.
