import { describe, expect, it } from 'vitest';

import { buildEquityCurveDataset } from './EquityCurveChart';

describe('EquityCurveChart', () => {
  it('maps equity points to categories and values', () => {
    const dataset = buildEquityCurveDataset([
      { time: '2024-01-01', equity: 1000 },
      { time: '2024-01-02', equity: 1010 }
    ]);

    expect(dataset.categories).toEqual(['2024-01-01', '2024-01-02']);
    expect(dataset.equity).toEqual([1000, 1010]);
  });

  it('returns empty dataset for empty input', () => {
    expect(buildEquityCurveDataset([])).toEqual({ categories: [], equity: [] });
  });
});
