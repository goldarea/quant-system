import { UpstreamError } from '../errors.js';

function toDay(timestampSeconds) {
  return new Date(timestampSeconds * 1000).toISOString().slice(0, 10);
}

function toNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function normalizeYahooChart(payload) {
  const error = payload?.chart?.error;
  if (error) {
    throw new UpstreamError(error.description || 'Yahoo chart API returned an error', error);
  }

  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};

  return timestamps
    .map((timestamp, index) => ({
      time: toDay(timestamp),
      open: toNumber(quote.open?.[index]),
      high: toNumber(quote.high?.[index]),
      low: toNumber(quote.low?.[index]),
      close: toNumber(quote.close?.[index]),
      volume: toNumber(quote.volume?.[index]) || 0
    }))
    .filter((bar) => [bar.open, bar.high, bar.low, bar.close].every((value) => value !== null));
}

export async function fetchYahooHistory(instrument, { range, interval }) {
  const symbol = encodeURIComponent(instrument.providerSymbol || instrument.symbol);
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
  url.searchParams.set('range', range);
  url.searchParams.set('interval', interval);
  url.searchParams.set('events', 'history');
  url.searchParams.set('includeAdjustedClose', 'true');

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'quant-system-mvp/0.1'
    }
  });

  if (!response.ok) {
    throw new UpstreamError(`Yahoo chart API returned HTTP ${response.status}`);
  }

  return normalizeYahooChart(await response.json());
}
