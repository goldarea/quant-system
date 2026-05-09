import { UpstreamError } from '../errors.js';

function numberAt(parts, index) {
  const value = Number(parts[index]);
  return Number.isFinite(value) ? value : null;
}

export function normalizeEastmoneyKlines(payload) {
  const klines = payload?.data?.klines;
  if (!Array.isArray(klines)) {
    throw new UpstreamError('Eastmoney response did not contain kline data');
  }

  return klines
    .map((line) => {
      const parts = String(line).split(',');
      return {
        time: parts[0],
        open: numberAt(parts, 1),
        close: numberAt(parts, 2),
        high: numberAt(parts, 3),
        low: numberAt(parts, 4),
        volume: numberAt(parts, 5) || 0
      };
    })
    .filter((bar) => [bar.open, bar.high, bar.low, bar.close].every((value) => value !== null));
}

function rangeToBeg(range) {
  const now = new Date();
  const year = now.getUTCFullYear();
  if (range === '1mo') return `${year}${String(now.getUTCMonth()).padStart(2, '0')}01`;
  if (range === '3mo') return `${year - 1}0101`;
  if (range === '6mo') return `${year - 1}0101`;
  if (range === '1y') return `${year - 1}0101`;
  if (range === '5y') return `${year - 5}0101`;
  return '19900101';
}

export async function fetchEastmoneyHistory(instrument, { range }) {
  const url = new URL('https://push2his.eastmoney.com/api/qt/stock/kline/get');
  url.searchParams.set('secid', instrument.providerSymbol);
  url.searchParams.set('fields1', 'f1,f2,f3,f4,f5,f6');
  url.searchParams.set('fields2', 'f51,f52,f53,f54,f55,f56,f57,f58');
  url.searchParams.set('klt', '101');
  url.searchParams.set('fqt', '1');
  url.searchParams.set('beg', rangeToBeg(range));
  url.searchParams.set('end', '20500101');

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'quant-system-mvp/0.1'
    }
  });

  if (!response.ok) {
    throw new UpstreamError(`Eastmoney kline API returned HTTP ${response.status}`);
  }

  return normalizeEastmoneyKlines(await response.json());
}
