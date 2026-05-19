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
  ProviderCatalogResponse,
  ProviderSelection,
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
  providers?: ProviderSelection;
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

interface ExperimentRunParams {
  strategy?: string;
  symbol?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

interface PortfolioBacktestParams {
  symbols: string[];
  range: HistoryRange;
  interval: HistoryInterval;
  initialCapital?: number;
  providers?: ProviderSelection;
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

function serializeProviders(providers?: ProviderSelection) {
  if (!providers) return undefined;
  const value = Object.entries(providers)
    .filter(([, value]) => value)
    .map(([market, value]) => `${market}:${value}`)
    .join(',');
  return value || undefined;
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

export function getProviders(options?: ClientOptions) {
  return request<ProviderCatalogResponse>('/api/providers', options);
}

export function getHistory(params: HistoryParams, options?: ClientOptions) {
  return request<HistoryResponse>(`/api/history?${buildQuery([
    ['symbol', params.symbol],
    ['range', params.range],
    ['interval', params.interval],
    ['providers', serializeProviders(params.providers)]
  ])}`, options);
}

export function getQuote(symbol: string, providers?: ProviderSelection, options?: ClientOptions) {
  return request<Quote>(`/api/quote?${buildQuery([
    ['symbol', symbol],
    ['providers', serializeProviders(providers)]
  ])}`, options);
}

export function getStrategies(options?: ClientOptions) {
  return request<StrategyDefinition[]>('/api/strategies', options);
}

export function getIndicators(params: HistoryParams, options?: ClientOptions) {
  return request<IndicatorsResponse>(`/api/indicators?${buildQuery([
    ['symbol', params.symbol],
    ['range', params.range],
    ['interval', params.interval],
    ['providers', serializeProviders(params.providers)]
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
    ['slippagePct', params.slippagePct?.toString()],
    ['providers', serializeProviders(params.providers)]
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
    ['slippagePct', params.slippagePct?.toString()],
    ['providers', serializeProviders(params.providers)]
  ])}`, options);
}

export function getStrategyBacktest(params: StrategyBacktestParams, options?: ClientOptions) {
  return request<BacktestResponse>(`/api/backtest/run?${buildQuery([
    ['strategy', params.strategy],
    ['symbol', params.symbol],
    ['range', params.range],
    ['interval', params.interval],
    ['providers', serializeProviders(params.providers)],
    ...Object.entries(params.parameters).map(([key, value]) => [key, value.toString()] as [string, string])
  ])}`, options);
}

export function getExperimentRuns(params: ExperimentRunParams = {}, options?: ClientOptions) {
  const query = buildQuery([
    ['strategy', params.strategy],
    ['symbol', params.symbol],
    ['sortBy', params.sortBy],
    ['sortDir', params.sortDir]
  ]);
  return request<ExperimentRun[]>(`/api/experiments/runs${query ? `?${query}` : ''}`, options);
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
    ['initialCapital', params.initialCapital?.toString()],
    ['providers', serializeProviders(params.providers)]
  ])}`, options);
}

export function getPaperAccount(options?: ClientOptions) {
  return request<PaperAccountResponse>('/api/paper/account', options);
}

export function submitPaperOrder(order: PaperOrderRequest, providers?: ProviderSelection, options?: ClientOptions) {
  const query = buildQuery([
    ['providers', serializeProviders(providers)]
  ]);
  return request<PaperAccountResponse>(query ? `/api/paper/orders?${query}` : '/api/paper/orders', options, {
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
