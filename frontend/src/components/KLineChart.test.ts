import { describe, expect, it } from 'vitest';

import { buildKLineDataset, calculateMovingAverage } from './KLineChart';
import type { BacktestTrade, Bar } from '../api/types';

const bars: Bar[] = [
  { time: '2026-05-01', open: 10, high: 12, low: 9, close: 11, volume: 100 },
  { time: '2026-05-02', open: 11, high: 13, low: 10, close: 12, volume: 120 },
  { time: '2026-05-03', open: 12, high: 14, low: 11, close: 13, volume: 140 },
  { time: '2026-05-04', open: 13, high: 15, low: 12, close: 14, volume: 160 },
  { time: '2026-05-05', open: 14, high: 16, low: 13, close: 15, volume: 180 }
];

const trades: BacktestTrade[] = [
  { time: '2026-05-02', side: 'buy', price: 12, quantity: 10, equity: 120, fee: 0.12, slippagePct: 0.1 },
  { time: '2026-05-04', side: 'sell', price: 14, quantity: 10, equity: 140, fee: 0.14, slippagePct: 0.1 },
  { time: '2026-05-30', side: 'buy', price: 20, quantity: 10, equity: 200, fee: 0.2, slippagePct: 0.1 }
];

describe('KLineChart data helpers', () => {
  it('calculates moving averages only after enough bars exist', () => {
    expect(calculateMovingAverage(bars, 3)).toEqual(['-', '-', 12, 13, 14]);
  });

  it('builds category, candle, volume, and marker datasets for ECharts', () => {
    expect(buildKLineDataset(bars)).toEqual({
      categories: ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05'],
      candles: [
        [10, 11, 9, 12],
        [11, 12, 10, 13],
        [12, 13, 11, 14],
        [13, 14, 12, 15],
        [14, 15, 13, 16]
      ],
      volumes: [
        [0, 100, 1],
        [1, 120, 1],
        [2, 140, 1],
        [3, 160, 1],
        [4, 180, 1]
      ],
      ma5: [11, 11.5, 12, 12.5, 13],
      ma20: [11, 11.5, 12, 12.5, 13],
      ma60: [11, 11.5, 12, 12.5, 13],
      tradeMarkers: []
    });
  });

  it('maps backtest trades to chart markers by bar time', () => {
    expect(buildKLineDataset(bars, undefined, trades).tradeMarkers).toEqual([
      { name: 'buy', value: [1, 12], itemStyle: { color: '#f53f3f' } },
      { name: 'sell', value: [3, 14], itemStyle: { color: '#00b42a' } }
    ]);
  });
});
