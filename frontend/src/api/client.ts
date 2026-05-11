import type {
  ApiEnvelope,
  BacktestResponse,
  ExperimentRun,
  HealthResponse,
  HistoryImportResponse,
  HistoryInterval,
  HistoryRange,
  HistoryResponse,
  IndicatorsResponse,
  PaperAccountResponse,
  PaperOrderRequest,
  PaperRiskLimitsRequest,
  ParameterSweepResponse,
  PortfolioBacktestResponse,
  Quote,
  StrategyDefinition,
  Instrument
} from './types';

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

interface ClientOptions {
  fetcher?: Fetcher;
}

interface HistoryParams {
  symbol: string;
  range: HistoryRange;
  interval: HistoryInterval;
}

interface BacktestParams extends HistoryParams {
  fastWindow?: number;
  slowWindow?: number;
  initialCapital?: number;
  feeRatePct?: number;
  slippagePct?: number;
}

interface ParameterSweepParams extends HistoryParams {
  fastMin?: number;
  fastMax?: number;
  slowMin?: number;
  slowMax?: number;
  initialCapital?: number;
  feeRatePct?: number;
  slippagePct?: number;
}

interface StrategyBacktestParams extends HistoryParams {
  strategy: string;
  parameters: Record<string, number | string>;
}

interface PortfolioBacktestParams {
  symbols: string[];
  range: HistoryRange;
  interval: HistoryInterval;
  initialCapital?: number;
}

export class ApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

function buildQuery(params: Iterable<[string, string | undefined]>) {
  const query = new URLSearchParams();
  Array.from(params).forEach(([key, value]) => {
    if (value !== undefined) query.set(key, value);
  });
  return query.toString();
}

async function request<T>(path: string, options: ClientOptions = {}, init?: RequestInit): Promise<T> {
  const fetcher = options.fetcher ?? ((input: string, requestInit?: RequestInit) => fetch(input, requestInit));
  const response = init === undefined ? await fetcher(path) : await fetcher(path, init);
  const envelope = await response.json() as ApiEnvelope<T>;

  if (!envelope.ok) {
    throw new ApiError(envelope.error.code, envelope.error.message);
  }

  return envelope.data;
}

export function getHealth(options?: ClientOptions) {
  return request<HealthResponse>('/api/health', options);
}

export function searchSymbols(query: string, options?: ClientOptions) {
  return request<Instrument[]>(`/api/search?${buildQuery([['q', query]])}`, options);
}

export function getHistory(params: HistoryParams, options?: ClientOptions) {
  return request<HistoryResponse>(`/api/history?${buildQuery([
    ['symbol', params.symbol],
    ['range', params.range],
    ['interval', params.interval]
  ])}`, options);
}

export function getQuote(symbol: string, options?: ClientOptions) {
  return request<Quote>(`/api/quote?${buildQuery([['symbol', symbol]])}`, options);
}

export function getStrategies(options?: ClientOptions) {
  return request<StrategyDefinition[]>('/api/strategies', options);
}

export function getIndicators(params: HistoryParams, options?: ClientOptions) {
  return request<IndicatorsResponse>(`/api/indicators?${buildQuery([
    ['symbol', params.symbol],
    ['range', params.range],
    ['interval', params.interval]
  ])}`, options);
}

export function getBacktest(params: BacktestParams, options?: ClientOptions) {
  return request<BacktestResponse>(`/api/backtest?${buildQuery([
    ['symbol', params.symbol],
    ['range', params.range],
    ['interval', params.interval],
    ['fastWindow', params.fastWindow?.toString()],
    ['slowWindow', params.slowWindow?.toString()],
    ['initialCapital', params.initialCapital?.toString()],
    ['feeRatePct', params.feeRatePct?.toString()],
    ['slippagePct', params.slippagePct?.toString()]
  ])}`, options);
}

export function getParameterSweep(params: ParameterSweepParams, options?: ClientOptions) {
  return request<ParameterSweepResponse>(`/api/backtest/sweep?${buildQuery([
    ['symbol', params.symbol],
    ['range', params.range],
    ['interval', params.interval],
    ['fastMin', params.fastMin?.toString()],
    ['fastMax', params.fastMax?.toString()],
    ['slowMin', params.slowMin?.toString()],
    ['slowMax', params.slowMax?.toString()],
    ['initialCapital', params.initialCapital?.toString()],
    ['feeRatePct', params.feeRatePct?.toString()],
    ['slippagePct', params.slippagePct?.toString()]
  ])}`, options);
}

export function getStrategyBacktest(params: StrategyBacktestParams, options?: ClientOptions) {
  return request<BacktestResponse>(`/api/backtest/run?${buildQuery([
    ['strategy', params.strategy],
    ['symbol', params.symbol],
    ['range', params.range],
    ['interval', params.interval],
    ...Object.entries(params.parameters).map(([key, value]) => [key, value.toString()] as [string, string])
  ])}`, options);
}

export function getExperimentRuns(options?: ClientOptions) {
  return request<ExperimentRun[]>('/api/experiments/runs', options);
}

export function deleteExperimentRun(id: string, options?: ClientOptions) {
  return request<ExperimentRun[]>(`/api/experiments/runs/${encodeURIComponent(id)}`, options, { method: 'DELETE' });
}

export function clearExperimentRuns(options?: ClientOptions) {
  return request<ExperimentRun[]>('/api/experiments/runs', options, { method: 'DELETE' });
}

export function getPortfolioBacktest(params: PortfolioBacktestParams, options?: ClientOptions) {
  return request<PortfolioBacktestResponse>(`/api/backtest/portfolio?${buildQuery([
    ['symbols', params.symbols.join(',')],
    ['range', params.range],
    ['interval', params.interval],
    ['initialCapital', params.initialCapital?.toString()]
  ])}`, options);
}

export function getPaperAccount(options?: ClientOptions) {
  return request<PaperAccountResponse>('/api/paper/account', options);
}

export function submitPaperOrder(order: PaperOrderRequest, options?: ClientOptions) {
  return request<PaperAccountResponse>('/api/paper/orders', options, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(order)
  });
}

export function updatePaperRiskLimits(limits: PaperRiskLimitsRequest, options?: ClientOptions) {
  return request<PaperAccountResponse>('/api/paper/risk', options, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(limits)
  });
}

export function resetPaperAccount(options?: ClientOptions) {
  return request<PaperAccountResponse>('/api/paper/reset', options, { method: 'POST' });
}

export function importHistoryCsv(params: HistoryParams, csvText: string, options?: ClientOptions) {
  return request<HistoryImportResponse>(`/api/history/import?${buildQuery([
    ['symbol', params.symbol],
    ['range', params.range],
    ['interval', params.interval]
  ])}`, options, {
    method: 'POST',
    headers: { 'content-type': 'text/csv; charset=utf-8' },
    body: csvText
  });
}
