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
- `GET /api/backtest?symbol=AAPL&range=1y&interval=1d&feeRatePct=0.1&slippagePct=0.2`

Starter symbols include common US stocks, major ETFs, and common A-share
symbols. The dashboard also includes a browser-local watchlist stored in
`localStorage`, MA overlay controls, and MACD/RSI indicator summaries. Public
upstream endpoints are suitable for personal research and
prototyping, not licensed production real-time market data.

The dashboard also shows an adjustable long-only moving-average crossover
backtest. Users can tune fast/slow MA windows, initial capital, fee rate, and
slippage, inspect the equity curve, review recent trades, and see buy/sell
markers overlaid on the K-line chart. The backtest report includes annualized
return, annualized volatility, Sharpe, Calmar, drawdown period, trade-quality
metrics, and a buy-and-hold benchmark comparison. The backtest uses current
close prices, applies percentage fees and slippage deterministically, does not
short sell, and does not persist strategy runs; it is intended as a first local
analysis baseline.

If an upstream provider is unavailable, the backend can return deterministic
demo bars marked with `source: "demo"` so the UI remains usable. Successful live
history responses are also persisted to `.cache/quant-system.sqlite3`; later
requests for the same symbol/range/interval can return `source: "local"`.

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
3. Strategy framework so MA crossover becomes one registered strategy rather
   than hard-coded logic.
4. Data quality upgrades including market calendars, adjusted prices, missing-bar
   checks, and symbol universes.
5. Paper trading with simulated accounts, orders, fills, positions, and risk
   checks before any real broker integration.
