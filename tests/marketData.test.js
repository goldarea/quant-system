import test from 'node:test';
import assert from 'node:assert/strict';

import { UpstreamError } from '../src/errors.js';
import { MarketDataService } from '../src/marketData.js';

test('getHistory routes US symbols to the US provider', async () => {
  const calls = [];
  const service = new MarketDataService({
    cache: null,
    providers: {
      US: {
        history: async (instrument, options) => {
          calls.push({ instrument, options });
          return [{ time: '2024-01-02', open: 1, high: 2, low: 1, close: 2, volume: 100 }];
        }
      }
    }
  });

  const result = await service.getHistory({ symbol: 'AAPL', range: '1mo', interval: '1d' });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].instrument.symbol, 'AAPL');
  assert.equal(result.bars.length, 1);
  assert.equal(result.source, 'live');
});

test('getHistory rejects unsupported intervals', async () => {
  const service = new MarketDataService({ cache: null, providers: {} });

  await assert.rejects(
    () => service.getHistory({ symbol: 'AAPL', range: '1mo', interval: '5m' }),
    /Unsupported interval/
  );
});

test('getQuote returns the last historical bar as a quote', async () => {
  const service = new MarketDataService({
    cache: null,
    providers: {
      US: {
        history: async () => [
          { time: '2024-01-02', open: 1, high: 2, low: 1, close: 2, volume: 100 },
          { time: '2024-01-03', open: 2, high: 3, low: 2, close: 3, volume: 120 }
        ]
      }
    }
  });

  const quote = await service.getQuote({ symbol: 'AAPL' });

  assert.equal(quote.symbol, 'AAPL');
  assert.equal(quote.price, 3);
  assert.equal(quote.time, '2024-01-03');
});

test('getHistory can fall back to demo bars when upstream is unavailable', async () => {
  const service = new MarketDataService({
    cache: null,
    useDemoFallback: true,
    providers: {
      US: {
        history: async () => {
          throw new UpstreamError('network unavailable');
        }
      }
    }
  });

  const result = await service.getHistory({ symbol: 'AAPL', range: '1mo', interval: '1d' });

  assert.equal(result.source, 'demo');
  assert.equal(result.instrument.symbol, 'AAPL');
  assert.ok(result.bars.length >= 20);
  assert.equal(result.warning.code, 'UPSTREAM_ERROR');
});
