export type Market = 'US' | 'CN' | string;

export interface Instrument {
  symbol: string;
  name: string;
  localName?: string;
  market: Market;
  exchange?: string;
  currency: string;
  providerSymbol?: string;
}

export interface Bar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ApiWarning {
  code: string;
  message: string;
}

export interface HistoryResponse {
  instrument: Instrument;
  range: HistoryRange;
  interval: HistoryInterval;
  bars: Bar[];
  source: 'live' | 'cache' | 'demo' | string;
  warning?: ApiWarning;
}

export interface BacktestEquityPoint {
  time: string;
  equity: number;
  cash: number;
  position: number;
  price: number;
}

export interface BacktestTrade {
  time: string;
  side: string;
  price: number;
  quantity: number;
  equity: number;
  fee: number;
  slippagePct: number;
}

export interface BacktestSummary {
  initialCapital: number;
  finalEquity: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  tradeCount: number;
  winRatePct: number;
  totalFees: number;
}

export interface BacktestResponse {
  instrument: Instrument;
  range: HistoryRange;
  interval: HistoryInterval;
  source: 'live' | 'cache' | 'demo' | 'local' | string;
  fastWindow: number;
  slowWindow: number;
  initialCapital: number;
  feeRatePct: number;
  slippagePct: number;
  summary: BacktestSummary;
  equityCurve: BacktestEquityPoint[];
  trades: BacktestTrade[];
}

export interface HistoryImportResponse {
  instrument: Instrument;
  range: HistoryRange;
  interval: HistoryInterval;
  imported: number;
  source: 'import' | string;
}

export interface Quote {
  instrument: Instrument;
  symbol: string;
  name: string;
  market: Market;
  currency: string;
  price: number;
  time: string;
  volume: number;
  source: 'live' | 'cache' | 'demo' | string;
}


export interface IndicatorPoint {
  time: string;
  value: number | null;
}

export interface MacdPoint {
  time: string;
  dif: number | null;
  dea: number | null;
  histogram: number | null;
}

export interface RsiPoint {
  time: string;
  value: number | null;
}

export interface IndicatorsResponse {
  instrument: Instrument;
  range: HistoryRange;
  interval: HistoryInterval;
  source: 'live' | 'cache' | 'demo' | string;
  ma5: IndicatorPoint[];
  ma20: IndicatorPoint[];
  ma60: IndicatorPoint[];
  macd: MacdPoint[];
  rsi14: RsiPoint[];
}

export interface HealthResponse {
  status: string;
  time: string;
}

export type HistoryRange = '1mo' | '3mo' | '6mo' | '1y' | '5y' | 'max';
export type HistoryInterval = '1d' | '1wk' | '1mo';

export interface ApiErrorPayload {
  code: string;
  message: string;
}

export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorPayload };
