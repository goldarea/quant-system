import type {
  ApiEnvelope,
  BacktestResponse,
  HealthResponse,
  HistoryImportResponse,
  HistoryInterval,
  HistoryRange,
  HistoryResponse,
  IndicatorsResponse,
  Instrument,
  PortfolioBacktestResponse,
  Quote
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

export function getPortfolioBacktest(params: PortfolioBacktestParams, options?: ClientOptions) {
  return request<PortfolioBacktestResponse>(`/api/backtest/portfolio?${buildQuery([
    ['symbols', params.symbols.join(',')],
    ['range', params.range],
    ['interval', params.interval],
    ['initialCapital', params.initialCapital?.toString()]
  ])}`, options);
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
