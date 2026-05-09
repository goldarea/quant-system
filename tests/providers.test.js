import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeYahooChart } from '../src/providers/yahoo.js';
import { normalizeEastmoneyKlines } from '../src/providers/eastmoney.js';

test('normalizeYahooChart converts chart payload to bars', () => {
  const payload = {
    chart: {
      result: [{
        timestamp: [1_700_000_000, 1_700_086_400],
        indicators: {
          quote: [{
            open: [10, 11],
            high: [12, 13],
            low: [9, 10],
            close: [11, 12],
            volume: [1000, 1200]
          }]
        }
      }],
      error: null
    }
  };

  const bars = normalizeYahooChart(payload);

  assert.equal(bars.length, 2);
  assert.deepEqual(bars[0], {
    time: '2023-11-14',
    open: 10,
    high: 12,
    low: 9,
    close: 11,
    volume: 1000
  });
});

test('normalizeEastmoneyKlines converts comma-separated klines to bars', () => {
  const payload = {
    data: {
      klines: [
        '2024-01-02,10,11,12,9,1000,11000,3.2',
        '2024-01-03,11,12,13,10,1200,14000,2.9'
      ]
    }
  };

  const bars = normalizeEastmoneyKlines(payload);

  assert.deepEqual(bars[1], {
    time: '2024-01-03',
    open: 11,
    high: 13,
    low: 10,
    close: 12,
    volume: 1200
  });
});
