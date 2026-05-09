# Quant System MVP Design

## Goal

Build a local, usable quantitative market-data system under `D:\self\quant-system`.
The MVP lets the user search common A-share and US stock symbols, fetch historical
price bars from public web endpoints, cache responses on disk, and view the result
in a browser.

## Scope

The first version is a data platform, not an automated trading system. It focuses
on discoverability, historical bars, latest available prices, and a clean extension
point for licensed real-time data later.

Included:

- Local HTTP API.
- Static browser UI.
- Symbol search from a curated starter universe.
- Historical daily bars for US stocks via Yahoo chart endpoints.
- Historical daily bars for A-shares via Eastmoney push2his endpoint.
- Disk cache to reduce repeated upstream calls.
- Clear error responses when an upstream source is unavailable.

Not included in MVP:

- Real-money trading.
- Broker integration.
- Full exchange-level real-time authorization.
- PostgreSQL, TimescaleDB, Kafka, or Docker.
- Authentication.

## Architecture

The MVP uses Node.js standard-library modules only. This avoids npm installation
and PowerShell execution-policy issues on the current machine.

The service exposes API routes and static files from one process:

- `src/server.js` starts the HTTP server and routes requests.
- `src/marketData.js` contains market-data use cases.
- `src/providers/` contains upstream source adapters.
- `src/cache.js` handles JSON disk cache files.
- `src/symbols.js` contains the starter instrument universe and matching logic.
- `public/` contains the browser UI.

## Data Flow

1. User opens the local web page.
2. Browser calls `/api/search?q=...` to find symbols.
3. Browser calls `/api/history?symbol=...&range=...&interval=1d`.
4. Server checks the cache.
5. On cache miss, server calls the correct provider.
6. Provider normalizes bars to `{ time, open, high, low, close, volume }`.
7. Server returns JSON to the browser.
8. Browser draws a simple SVG candlestick/line chart and a data table.

## Error Handling

API responses use predictable JSON:

- Success: `{ "ok": true, "data": ... }`
- Failure: `{ "ok": false, "error": { "code": "...", "message": "..." } }`

Upstream, validation, and not-found errors are separated so the UI can show useful
messages instead of failing silently.

## Testing

Node's built-in `node:test` runner covers:

- Symbol search behavior.
- Query validation.
- Yahoo response normalization.
- Eastmoney response normalization.
- Cache key stability and TTL behavior.
- API handler behavior with injected fake providers.

## Upgrade Path

After the MVP works locally, upgrade in this order:

1. Add persistent PostgreSQL or TimescaleDB storage.
2. Replace starter symbols with exchange symbol sync jobs.
3. Add licensed real-time providers such as Polygon, Finnhub, Twelve Data, or
   a China-market vendor.
4. Add backtesting with vectorbt/backtrader-style modules.
5. Add broker integration only after data quality, logging, and risk controls
   are in place.
