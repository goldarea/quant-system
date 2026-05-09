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
- Adjustable MA crossover backtest UI, equity curve chart, fee/slippage controls, K-line trade markers, professional report metrics, and `/api/backtest` endpoint added.

## Recommended Next Work

### Phase 7: Professional Backtest Report

Status: completed. The `/api/backtest` response now includes daily returns, annualized return, annualized volatility, Sharpe ratio, Calmar ratio, max drawdown start/end/duration, trade-quality metrics, and a buy-and-hold benchmark. The frontend renders these metrics in the strategy backtest panel.

### Phase 8: Multi-symbol Portfolio Backtesting

Goal: move from single-symbol signal inspection to portfolio-level research.

Scope:

- Allow a backtest request to include multiple symbols or a watchlist selection.
- Support simple portfolio allocation modes such as equal weight and signal-weighted exposure.
- Track cash, positions, daily portfolio equity, and per-symbol contribution.
- Show portfolio holdings, rebalance records, and combined equity curve in the frontend.
- Add tests for multi-symbol alignment, missing bars, and cash/position accounting.

Why next: mature quant systems evaluate strategies at portfolio level rather than isolated single-stock trades.

### Phase 9: Strategy Framework

Goal: stop hard-coding the MA crossover as the only strategy path.

Scope:

- Introduce a backend strategy interface with parameter schema, signal generation, and backtest execution hooks.
- Register initial strategies: MA crossover, RSI reversal, MACD trend, and buy-and-hold benchmark.
- Add routes such as `/api/strategies` and a generalized backtest run endpoint.
- Let the frontend select a strategy and render dynamic parameter controls from the strategy schema.
- Persist strategy run metadata only after the report and portfolio model are stable.

Why next: strategy extensibility is the difference between a demo backtest and a reusable research platform.

### Phase 10: Data Quality and Market Calendar

Goal: make historical data trustworthy enough for serious research.

Scope:

- Add trading calendar support for US and CN markets.
- Add adjusted-price handling for split/dividend effects where source data supports it.
- Detect missing bars, duplicate bars, invalid OHLC values, and stale local cache entries.
- Add index data, industry classification, and configurable symbol universes for A-share and US-market research.
- Add a background/manual data refresh command for local SQLite history.

Why next: poor data quality can invalidate otherwise correct strategy logic.

### Phase 11: Paper Trading Layer

Goal: prepare the architecture for live workflows without immediately connecting real broker execution.

Scope:

- Add simulated accounts, orders, fills, positions, and account equity snapshots.
- Convert strategy signals into paper orders through a risk-check layer.
- Track order status transitions and execution logs.
- Add frontend views for paper account state, open orders, fills, and positions.
- Keep real broker integration out of scope until paper trading and risk controls are reliable.

Why next: paper trading validates operational flow before introducing real capital or broker API complexity.

### Longer-term Gaps Versus Mature Quant Platforms

- Data depth: fundamentals, corporate actions, factor data, index constituents, and survivorship-bias handling.
- Research workflow: notebooks, parameter sweeps, batch backtests, result comparison, and experiment tracking.
- Execution: event-driven engine, live market data subscriptions, broker gateways, order routing, and recovery logic.
- Risk: portfolio limits, drawdown stops, symbol blacklists, exposure caps, and pre-trade checks.
- Operations: scheduled jobs, monitoring, alerting, audit logs, permissions, and deployment packaging.

Near-term priority order: Phase 7 first, then Phase 8, then Phase 9. Data quality work in Phase 10 can start earlier if backtest results become inconsistent or source data issues block research.

