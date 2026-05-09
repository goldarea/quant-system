# Vite Arco ECharts Python Upgrade Implementation Plan

> Historical snapshot: this plan records the initial migration milestone. The current runtime has moved to FastAPI on `8000`; see `README.md` and `docs/PROJECT_HANDOFF.md` for current startup details.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the quant-system MVP into a Vite React dashboard using Arco Design and ECharts, while preparing a Python FastAPI backend for quant data APIs.

**Architecture:** The project becomes a split frontend/backend repo. The frontend runs through Vite and proxies `/api/*` to an API server. The Python backend mirrors the existing Node API contract, but the existing Node API remains usable as a temporary API target because the current machine lacks a working Python runtime.

**Tech Stack:** Vite, React, TypeScript, Arco Design, ECharts, FastAPI, Pydantic, pytest.

---

### Task 1: Frontend Scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/index.html`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

- [x] Install Vite/React/TypeScript dependencies.
- [x] Add proxy from `/api` to `http://127.0.0.1:18889`.
- [x] Render an initial dashboard shell.
- [x] Run `cmd /c npm run build`.

### Task 2: Frontend API And Types

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/types.ts`

- [x] Define `Instrument`, `Bar`, `HistoryResponse`, and `Quote` types.
- [x] Implement API envelope parsing and error handling.
- [x] Add functions for health, search, history, and quote.

### Task 3: Arco Dashboard UI

**Files:**
- Create: `frontend/src/components/SymbolSearch.tsx`
- Create: `frontend/src/components/QuoteSummary.tsx`
- Create: `frontend/src/components/HistoryTable.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/styles.css`

- [x] Use Arco Layout, Input/Search, List, Card, Statistic, Radio, Alert, Spin, and Table.
- [x] Show loading, empty, error, and demo-warning states.
- [x] Keep the layout dense and operational.

### Task 4: ECharts K-Line

**Files:**
- Create: `frontend/src/components/KLineChart.tsx`

- [x] Use ECharts candlestick series for OHLC.
- [x] Add volume bars.
- [x] Add MA5 and MA20 lines.
- [x] Add tooltip, axis pointer, and data zoom.

### Task 5: Python Backend Preparation

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/app/main.py`
- Create: `backend/app/models.py`
- Create: `backend/app/symbols.py`
- Create: `backend/app/demo_data.py`
- Create: `backend/app/services/market_data.py`
- Create: `backend/app/providers/yahoo.py`
- Create: `backend/app/providers/eastmoney.py`
- Create: `backend/tests/test_market_data.py`
- Create: `backend/README.md`

- [x] Mirror the existing Node API contract.
- [x] Implement deterministic demo fallback.
- [x] Document Python installation requirement.
- [x] Add pytest tests for search, history fallback, and validation.

### Task 6: Runtime Verification

**Files:**
- Modify: `README.md`

- [x] Keep the Node API on `18889` as the proxy target.
- [x] Run Node API health check.
- [x] Run `cmd /c npm run build` inside `frontend`.
- [x] Start Vite dev server on a free port.
- [x] Verify frontend page loads and can query the API.
- [x] Document Python backend startup commands for after Python is installed.

## Current Verified Runtime

- Temporary Node API: `http://127.0.0.1:18889`
- Vite frontend: `http://127.0.0.1:5174/`
- Verified through Vite proxy:
  - `GET http://127.0.0.1:5174/api/health`
  - `GET http://127.0.0.1:5174/api/search?q=AAPL`
  - `GET http://127.0.0.1:5174/api/history?symbol=AAPL&range=1mo&interval=1d`
  - `GET http://127.0.0.1:5174/api/quote?symbol=AAPL`

Python backend runtime verification remains pending until a real Python runtime
is installed. The backend code and pytest files are present under `backend/`.
