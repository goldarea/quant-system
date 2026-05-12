import { describe, expect, it } from 'vitest';

import { experimentRunsToCsv, formatExperimentParameters } from './experiments';
import type { ExperimentRun } from './api/types';

const runs: ExperimentRun[] = [{
  id: 'run-1',
  time: '2024-01-01T00:00:00Z',
  strategy: 'ma_crossover',
  symbol: 'AAPL',
  range: '1y',
  interval: '1d',
  source: 'local',
  parameters: { fastWindow: 8, slowWindow: 21, note: 'fast,slow' },
  finalEquity: 51000,
  totalReturnPct: 2,
  maxDrawdownPct: 1,
  sharpeRatio: 1.2,
  tradeCount: 2,
  winRatePct: 50
}];

describe('experiment helpers', () => {
  it('formats experiment parameters for compact display', () => {
    expect(formatExperimentParameters(runs[0].parameters)).toBe('fastWindow=8, slowWindow=21, note=fast,slow');
    expect(formatExperimentParameters({})).toBe('-');
  });

  it('exports experiment runs with escaped parameters', () => {
    const csv = experimentRunsToCsv(runs);

    expect(csv).toContain('id,time,strategy,symbol,range,interval,source,parameters,finalEquity,totalReturnPct,maxDrawdownPct,sharpeRatio,tradeCount,winRatePct');
    expect(csv).toContain('run-1,2024-01-01T00:00:00Z,ma_crossover,AAPL,1y,1d,local');
    expect(csv).toContain('"{""fastWindow"":8,""slowWindow"":21,""note"":""fast,slow""}"');
  });
});
