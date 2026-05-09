import { describe, expect, it, vi } from 'vitest';

import { ApiError, getBacktest, getHistory, searchSymbols } from './client';

describe('api client', () => {
  it('unwraps successful API envelopes', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: [{ symbol: 'AAPL', name: 'Apple Inc.', market: 'US', currency: 'USD' }]
    })));

    const result = await searchSymbols('apple', { fetcher });

    expect(fetcher).toHaveBeenCalledWith('/api/search?q=apple');
    expect(result).toEqual([
      { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', currency: 'USD' }
    ]);
  });

  it('throws ApiError for failed API envelopes', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Symbol is required' }
    }), { status: 400 }));

    await expect(getHistory({ symbol: '', range: '1mo', interval: '1d' }, { fetcher }))
      .rejects.toMatchObject(new ApiError('VALIDATION_ERROR', 'Symbol is required'));
  });

  it('includes optional backtest parameters when provided', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: {
        instrument: { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', currency: 'USD' },
        range: '1y',
        interval: '1d',
        source: 'local',
        fastWindow: 8,
        slowWindow: 21,
        initialCapital: 50000,
        feeRatePct: 0.1,
        slippagePct: 0.2,
        summary: {
          initialCapital: 50000,
          finalEquity: 51000,
          totalReturnPct: 2,
          maxDrawdownPct: 1,
          tradeCount: 2,
          winRatePct: 100,
          totalFees: 12.5
        },
        equityCurve: [],
        trades: []
      }
    })));

    await getBacktest({
      symbol: 'AAPL',
      range: '1y',
      interval: '1d',
      fastWindow: 8,
      slowWindow: 21,
      initialCapital: 50000,
      feeRatePct: 0.1,
      slippagePct: 0.2
    }, { fetcher });

    expect(fetcher).toHaveBeenCalledWith('/api/backtest?symbol=AAPL&range=1y&interval=1d&fastWindow=8&slowWindow=21&initialCapital=50000&feeRatePct=0.1&slippagePct=0.2');
  });
});
