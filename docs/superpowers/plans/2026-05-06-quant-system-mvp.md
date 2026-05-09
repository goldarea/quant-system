# Quant System MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local market-data MVP that the user can run from `D:\self\quant-system` and use in a browser.

**Architecture:** A zero-dependency Node.js HTTP service serves both JSON APIs and static UI. Market-data providers are isolated adapters behind a small use-case layer so licensed sources can replace public endpoints later.

**Tech Stack:** Node.js 22 standard library, built-in `node:test`, HTML/CSS/vanilla JavaScript, JSON disk cache.

---

### Task 1: Project Metadata And Documentation

**Files:**
- Create: `package.json`
- Create: `README.md`
- Create: `.gitignore`
- Create: `docs/superpowers/specs/2026-05-06-quant-system-mvp-design.md`
- Create: `docs/superpowers/plans/2026-05-06-quant-system-mvp.md`

- [ ] Add package scripts for `start` and `test`.
- [ ] Document how to start the service and open the local URL.
- [ ] Ignore cache, logs, coverage, and dependency directories.

### Task 2: Core Tests

**Files:**
- Create: `tests/symbols.test.js`
- Create: `tests/cache.test.js`
- Create: `tests/providers.test.js`
- Create: `tests/marketData.test.js`

- [ ] Write failing tests for symbol search.
- [ ] Write failing tests for cache TTL and key stability.
- [ ] Write failing tests for provider normalization.
- [ ] Write failing tests for market-data validation and provider routing.

### Task 3: Core Modules

**Files:**
- Create: `src/errors.js`
- Create: `src/symbols.js`
- Create: `src/cache.js`
- Create: `src/providers/yahoo.js`
- Create: `src/providers/eastmoney.js`
- Create: `src/marketData.js`

- [ ] Implement typed application errors.
- [ ] Implement starter symbol universe and fuzzy search.
- [ ] Implement JSON disk cache.
- [ ] Implement Yahoo chart response normalization.
- [ ] Implement Eastmoney response normalization.
- [ ] Implement market-data use cases with injected providers.

### Task 4: HTTP Server

**Files:**
- Create: `src/server.js`
- Create: `src/http.js`

- [ ] Add API routes: `/api/health`, `/api/search`, `/api/history`, `/api/quote`.
- [ ] Add static file serving from `public`.
- [ ] Add JSON success/error response helpers.
- [ ] Add graceful default port handling.

### Task 5: Browser UI

**Files:**
- Create: `public/index.html`
- Create: `public/styles.css`
- Create: `public/app.js`

- [ ] Build search input and symbol result list.
- [ ] Build range controls.
- [ ] Fetch and render latest quote summary.
- [ ] Render historical bars as an SVG chart and table.
- [ ] Show loading, empty, and error states.

### Task 6: Verification

**Files:**
- Modify: `README.md`

- [ ] Run `node --test`.
- [ ] Run `node src/server.js` long enough to verify startup.
- [ ] Fetch `/api/health`.
- [ ] Start the server for the user and report the URL.
