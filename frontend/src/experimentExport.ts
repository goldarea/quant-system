import type { ExperimentRun } from './api/types';

const experimentCsvColumns = [
  'id',
  'time',
  'strategy',
  'symbol',
  'range',
  'interval',
  'source',
  'parameters',
  'finalEquity',
  'totalReturnPct',
  'maxDrawdownPct',
  'sharpeRatio',
  'tradeCount',
  'winRatePct'
];

function csvValue(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function experimentRunsToCsv(runs: ExperimentRun[]) {
  const rows = runs.map((run) => [
    run.id,
    run.time,
    run.strategy,
    run.symbol,
    run.range,
    run.interval,
    run.source,
    JSON.stringify(run.parameters),
    run.finalEquity,
    run.totalReturnPct,
    run.maxDrawdownPct,
    run.sharpeRatio,
    run.tradeCount,
    run.winRatePct
  ].map(csvValue).join(','));

  return [experimentCsvColumns.join(','), ...rows].join('\n');
}
