import { describe, expect, it, vi } from 'vitest';

import { ApiError, getBacktest, getHistory, getPaperAccount, getPortfolioBacktest, getStrategies, getStrategyBacktest, searchSymbols, submitPaperOrder } from './client';

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

  it('fetches strategy definitions', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: [{ id: 'ma_crossover', name: 'MA Crossover', description: '', parameters: [] }]
    })));

    const result = await getStrategies({ fetcher });

    expect(fetcher).toHaveBeenCalledWith('/api/strategies');
    expect(result[0].id).toBe('ma_crossover');
  });

  it('includes generalized strategy backtest parameters', async () => {
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
        summary: {},
        equityCurve: [],
        trades: [],
        dailyReturns: [],
        drawdown: {},
        tradeMetrics: {},
        benchmark: {}
      }
    })));

    await getStrategyBacktest({
      strategy: 'ma_crossover',
      symbol: 'AAPL',
      range: '1y',
      interval: '1d',
      parameters: { fastWindow: 8, slowWindow: 21, initialCapital: 50000 }
    }, { fetcher });

    expect(fetcher).toHaveBeenCalledWith('/api/backtest/run?strategy=ma_crossover&symbol=AAPL&range=1y&interval=1d&fastWindow=8&slowWindow=21&initialCapital=50000');
  });
  it('calls paper trading account and order endpoints', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: {
        account: { accountId: 'paper-default', cash: 1000, equity: 1000, buyingPower: 1000, realizedPnl: 0, unrealizedPnl: 0 },
        positions: [],
        orders: [],
        fills: []
      }
    })));

    await getPaperAccount({ fetcher });
    await submitPaperOrder({ symbol: 'AAPL', side: 'buy', quantity: 10, type: 'market' }, { fetcher });

    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/paper/account');
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/paper/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ symbol: 'AAPL', side: 'buy', quantity: 10, type: 'market' })
    });
  });

  it('includes portfolio backtest parameters', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: {
        symbols: ['AAPL', 'MSFT'],
        range: '1y',
        interval: '1d',
        allocation: 'equal_weight',
        summary: {
          initialCapital: 100000,
          finalEquity: 110000,
          totalReturnPct: 10,
          symbolCount: 2,
          bestSymbol: 'AAPL',
          worstSymbol: 'MSFT'
        },
        equityCurve: [],
        positions: []
      }
    })));

    await getPortfolioBacktest({
      symbols: ['AAPL', 'MSFT'],
      range: '1y',
      interval: '1d',
      initialCapital: 100000
    }, { fetcher });

    expect(fetcher).toHaveBeenCalledWith('/api/backtest/portfolio?symbols=AAPL%2CMSFT&range=1y&interval=1d&initialCapital=100000');
  });
});
