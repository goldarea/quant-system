# Vite Arco ECharts Python Upgrade Design

## Historical Note

This design document is a snapshot from the initial migration. The current runtime has moved to FastAPI on `8000`; see `README.md` and `docs/PROJECT_HANDOFF.md` for up-to-date startup details.

## Goal

Upgrade the local quant-system MVP from a zero-dependency Node page into an
engineered front-end application using Vite, React, TypeScript, Arco Design, and
ECharts, with a Python FastAPI backend prepared for real quant-data workflows.

## Current State

The current system is a single Node.js standard-library server. It serves static
HTML/CSS/JS and JSON APIs from one process. It is useful as a bootstrap MVP but
too limited for a serious quant dashboard.

The service is currently running on port `18889`.

## Target Architecture

Use a split structure:

```text
quant-system/
  frontend/      Vite React application
  backend/       Python FastAPI API service
  src/           Legacy Node MVP kept as reference during migration
  docs/
```

Frontend responsibilities:

- Search symbols.
- Display quote summary cards.
- Render professional K-line and volume charts with ECharts.
- Use Arco Design for forms, tables, layout, buttons, tabs, alerts, and loading
  states.
- Talk to `/api/*` through Vite proxy during local development.

Backend responsibilities:

- Serve market-data APIs.
- Isolate data-source adapters.
- Normalize historical bars and quote data.
- Cache upstream responses.
- Provide deterministic demo fallback when public upstreams are unavailable.
- Later integrate Tushare, AkShare, yfinance, paid real-time vendors, database
  storage, and backtesting.

## Initial Runtime Constraint

The machine currently has Node.js and npm available through `cmd /c npm`, but no
working Python runtime. `python.exe` points to the WindowsApps placeholder and
fails to execute. Therefore the first upgrade milestone will make the Vite
frontend usable against the existing Node API while preparing Python backend
files and instructions. Once Python is installed, the frontend proxy can point to
FastAPI instead.

## API Contract

Keep the existing JSON envelope:

```json
{ "ok": true, "data": {} }
```

Error:

```json
{ "ok": false, "error": { "code": "UPSTREAM_ERROR", "message": "..." } }
```

Routes:

- `GET /api/health`
- `GET /api/search?q=`
- `GET /api/history?symbol=AAPL&range=1mo&interval=1d`
- `GET /api/quote?symbol=AAPL`

## Frontend Design

The frontend is a dense dashboard, not a marketing page:

- App shell with a compact header and data-source status.
- Left search panel with market filters and result list.
- Main panel with quote summary metrics.
- Range selector using segmented radio buttons.
- ECharts candlestick chart overlaid with moving averages.
- ECharts volume bar chart sharing the same data zoom.
- Historical bars table using Arco Table.
- Clear `demo` warning when live providers fail.

## Backend Design

The Python backend mirrors the existing Node service:

- `backend/app/main.py` FastAPI entrypoint.
- `backend/app/models.py` Pydantic models.
- `backend/app/symbols.py` starter instrument universe.
- `backend/app/demo_data.py` deterministic fallback bars.
- `backend/app/services/market_data.py` use-case layer.
- `backend/app/providers/yahoo.py` and `eastmoney.py` provider adapters.

The backend can be tested with `pytest` after Python is installed.

## Migration Strategy

1. Keep the current Node API available during frontend development.
2. Build the new Vite frontend in `frontend/`.
3. Proxy Vite `/api/*` requests to the running Node API on `18889`.
4. Prepare Python backend with equivalent API semantics.
5. After Python installation, switch proxy target to FastAPI on `8000`.
6. Remove or archive Node API only after Python reaches parity.

## Verification

- `cmd /c npm run build` in `frontend/`.
- `cmd /c npm run test` in `frontend/` if test dependencies are installed.
- Existing Node tests continue to pass with `node --test --experimental-test-isolation=none`.
- Python backend tests run once a real Python runtime is installed.
