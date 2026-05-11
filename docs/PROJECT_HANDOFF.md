# Quant System Project Handoff

This document is written for future agent sessions. Read it first when resuming
work on `D:\self\quant-system`.

## Project Goal

Build a local quant dashboard that can search instruments, fetch quote and
historical OHLCV data, render K-line/volume charts, and support a Python
quant-data backend.

The current architecture is:

- Vite + React + TypeScript frontend
- Arco Design operational dashboard UI
- ECharts K-line, volume, MA5, and MA20 chart
- FastAPI backend as the default local API runtime
- Legacy Node API retained as implementation reference

## Current Runtime Architecture

```text
Browser
  -> Vite dev server, normally http://127.0.0.1:5173/
  -> Vite proxy for /api/*
  -> FastAPI backend on http://127.0.0.1:8000
```

## Repository Layout

```text
quant-system/
  README.md
  start-all.bat             Root helper for both services
  start-backend.bat         FastAPI startup helper
  start-frontend.bat        Vite startup helper
  package.json
  src/                      Legacy Node API/static MVP reference
  tests/                    Legacy Node API tests
  public/                   Old static MVP page
  frontend/
    package.json
    vite.config.ts          Vite config, /api proxy target is :8000
    src/App.tsx             Main Arco dashboard shell
    src/api/                Typed frontend API client
    src/components/         Search, quote, K-line chart, history table
  backend/
    README.md
    requirements.txt
    app/main.py             FastAPI entrypoint
    app/models.py           Pydantic models and API errors
    app/services/           Market data service
    app/providers/          Market-data provider adapters
    tests/                  pytest tests
  docs/superpowers/
    specs/                  Design specs
    plans/                  Implementation plans and verified status
```

## API Contract

All APIs use the same envelope.

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
- `GET /api/search?q=AAPL`
- `GET /api/history?symbol=AAPL&range=1mo&interval=1d`
- `POST /api/history/import?symbol=AAPL&range=1mo&interval=1d`
- `GET /api/quote?symbol=AAPL`
- `GET /api/indicators?symbol=AAPL&range=1mo&interval=1d`
- `GET /api/backtest?symbol=AAPL&range=1mo&interval=1d&feeRatePct=0.1&slippagePct=0.2`
- `GET /api/backtest/sweep?symbol=AAPL&range=1mo&interval=1d&fastMin=3&fastMax=10&slowMin=15&slowMax=30`
- `GET /api/experiments/runs`
- `GET /api/paper/account`
- `POST /api/paper/orders`
- `POST /api/paper/risk`
- `POST /api/paper/reset`

Supported history ranges are `1mo`, `3mo`, `6mo`, `1y`, `5y`, and `max`.
Supported intervals are `1d`, `1wk`, and `1mo`.

## How To Run Now

Start both services:

```powershell
cd D:\self\quant-system
.\start-all.bat
```

Or start them separately:

```powershell
cd D:\self\quant-system
.\start-backend.bat
```

```powershell
cd D:\self\quant-system
.\start-frontend.bat
```

Open:

```text
http://127.0.0.1:5173/
```

## Verification Commands

Backend tests:

```powershell
cd D:\self\quant-system\backend
.\.venv\Scripts\python.exe -m pytest tests
```

Frontend tests:

```powershell
cd D:\self\quant-system\frontend
npm test
```

Frontend build:

```powershell
cd D:\self\quant-system\frontend
npm run build
```

Runtime checks:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/api/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:5173/ -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:5173/api/search?q=AAPL -UseBasicParsing
Invoke-WebRequest "http://127.0.0.1:5173/api/history?symbol=AAPL&range=1mo&interval=1d" -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:5173/api/quote?symbol=AAPL -UseBasicParsing
```

## Current Known Constraints

- `D:\self\quant-system` is not a Git repository in this environment.
- Vite production build may emit a chunk-size warning because Arco Design and
  ECharts are bundled together. It does not block the current milestone.
- Public web endpoints are suitable for personal research/prototyping, not
  licensed production real-time market data.
- If live upstreams fail, deterministic demo data can be returned with
  `source: "demo"`.
- Successful live history responses are persisted to `.cache/quant-system.sqlite3`
  and can later be served with `source: "local"`.
- Backtesting uses adjustable fast/slow MA windows, initial capital, fee rate,
  and slippage; it renders an equity curve and K-line buy/sell markers, but does
  not support short selling.
- CN-market history uses Eastmoney when available and otherwise falls back to demo data.

## Completed

- Frontend scaffolded under `frontend/`.
- API types and client implemented.
- Arco dashboard UI implemented.
- ECharts K-line, volume, MA5, and MA20 chart implemented.
- FastAPI backend source and pytest files prepared and verified.
- Vite frontend proxy switched to FastAPI `http://127.0.0.1:8000`.
- Root startup scripts added for backend and frontend.
- Browser-local watchlist added in the frontend.
- Yahoo and Eastmoney provider adapters implemented with demo fallback.
- Backend `/api/indicators` and frontend MA/MACD/RSI indicator UI added.
- Adjustable strategy backtest UI, equity curve chart, fee/slippage controls, K-line trade markers, professional report metrics, and `/api/backtest` endpoint added.
- Strategy framework added with `/api/strategies`, `/api/backtest/run`, MA crossover, RSI reversal, MACD trend, buy-and-hold, and schema-driven frontend parameter controls.
- Data-quality reporting added for duplicate, missing, invalid, and stale history bars.
- Paper-trading layer added with simulated account, positions, orders, fills, and dashboard controls.
- Backend `/api/backtest/sweep` and frontend parameter-sweep panel added for MA crossover fast/slow batch comparison.
- Backend `/api/experiments/runs` and frontend experiment-record panel added for recent in-memory strategy run summaries.

## Recommended Next Work

### Phase 7: Professional Backtest Report

Status: completed. The `/api/backtest` response now includes daily returns, annualized return, annualized volatility, Sharpe ratio, Calmar ratio, max drawdown start/end/duration, trade-quality metrics, and a buy-and-hold benchmark. The frontend renders these metrics in the strategy backtest panel.

### Phase 8: Multi-symbol Portfolio Backtesting

Status: completed. The backend now exposes `/api/backtest/portfolio` for equal-weight multi-symbol backtests over aligned bar times. The response includes combined equity, final positions, weights, per-symbol returns, best/worst symbols, and portfolio summary metrics. The frontend runs this against the browser-local watchlist when at least two symbols are present and renders the combined equity curve plus final holdings.

### Phase 9: Strategy Framework

Status: completed. The backend now exposes `/api/strategies` and `/api/backtest/run`, with registered MA crossover, RSI reversal, MACD trend, and buy-and-hold strategies. Strategy definitions include parameter schemas, and the frontend renders a strategy selector plus dynamic parameter controls from that schema. The legacy `/api/backtest` MA crossover endpoint remains available for compatibility.

### Phase 10: Data Quality and Market Calendar

Status: completed. `HistoryResponse` now includes a `quality` report with duplicate-bar, missing US/CN weekday daily-bar, invalid OHLC, and stale-series checks. The frontend renders a data-quality panel beside the chart workflow so backtest inputs can be reviewed before trusting strategy results. Remaining deeper data work includes adjusted-price/corporate-action handling, symbol universes, and scheduled refresh jobs.

### Phase 11: Paper Trading Layer

Status: completed. The backend now exposes `/api/paper/account`, `/api/paper/orders`, `/api/paper/risk`, and `/api/paper/reset` for one in-memory simulated account. Market orders execute against the latest quote, update cash/positions/fills/orders, and reject insufficient buying power, insufficient sell quantity, oversized single orders, and oversized single-symbol positions. The frontend renders a paper-trading panel with account metrics, configurable risk exposure/limits, order entry, positions, recent order status, and audit events for submissions/fills/rejections/risk updates/resets. Real broker integration remains out of scope.

### Phase 12: Experiment Tracking

Status: completed. Strategy backtests run through `/api/backtest/run` now append an in-memory experiment summary containing strategy id, symbol, range, interval, source, parameters, and headline metrics. The backend exposes recent summaries through `/api/experiments/runs`, and the frontend renders an experiment-record panel so recent parameter/strategy runs can be compared without copying the current result manually.

### Longer-term Gaps Versus Mature Quant Platforms

- Data depth: fundamentals, corporate actions, factor data, index constituents, and survivorship-bias handling.
- Research workflow: notebooks, parameter sweeps, batch backtests, result comparison, and experiment tracking.
- Execution: event-driven engine, live market data subscriptions, broker gateways, order routing, and recovery logic.
- Risk: portfolio limits, drawdown stops, symbol blacklists, exposure caps, and pre-trade checks.
- Operations: scheduled jobs, monitoring, alerting, audit logs, permissions, and deployment packaging.

Near-term priority order: Phase 7 first, then Phase 8, then Phase 9. Data quality work in Phase 10 can start earlier if backtest results become inconsistent or source data issues block research.

