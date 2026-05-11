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

export interface DataQualityIssue {
  code: string;
  severity: 'warning' | 'error' | string;
  message: string;
  time?: string | null;
}

export interface DataQualityReport {
  market: string;
  expectedInterval: HistoryInterval;
  totalBars: number;
  duplicateBars: number;
  missingBars: number;
  invalidBars: number;
  stale: boolean;
  issues: DataQualityIssue[];
}

export interface HistoryResponse {
  instrument: Instrument;
  range: HistoryRange;
  interval: HistoryInterval;
  bars: Bar[];
  source: 'live' | 'cache' | 'demo' | string;
  warning?: ApiWarning;
  quality?: DataQualityReport;
}

export interface StrategyParameter {
  id: string;
  label: string;
  type: string;
  default: number | string;
  min?: number;
  max?: number;
  step?: number;
}

export interface StrategyDefinition {
  id: string;
  name: string;
  description: string;
  parameters: StrategyParameter[];
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

export interface BacktestReturnPoint {
  time: string;
  returnPct: number;
}

export interface BacktestDrawdownPeriod {
  start: string;
  end: string;
  durationBars: number;
  maxDrawdownPct: number;
}

export interface BacktestTradeMetrics {
  averageHoldingBars: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  payoffRatio: number;
}

export interface BacktestBenchmark {
  name: string;
  finalEquity: number;
  totalReturnPct: number;
  excessReturnPct: number;
}

export interface BacktestSummary {
  initialCapital: number;
  finalEquity: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  tradeCount: number;
  winRatePct: number;
  totalFees: number;
  annualizedReturnPct: number;
  annualizedVolatilityPct: number;
  sharpeRatio: number;
  calmarRatio: number;
  maxDrawdownStart: string;
  maxDrawdownEnd: string;
  maxDrawdownDurationBars: number;
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
  dailyReturns: BacktestReturnPoint[];
  drawdown: BacktestDrawdownPeriod;
  tradeMetrics: BacktestTradeMetrics;
  benchmark: BacktestBenchmark;
}

export interface ParameterSweepResult {
  rank: number;
  fastWindow: number;
  slowWindow: number;
  finalEquity: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  tradeCount: number;
  winRatePct: number;
}

export interface ParameterSweepResponse {
  instrument: Instrument;
  range: HistoryRange;
  interval: HistoryInterval;
  source: 'live' | 'cache' | 'demo' | 'local' | string;
  initialCapital: number;
  feeRatePct: number;
  slippagePct: number;
  results: ParameterSweepResult[];
}

export interface PortfolioPosition {
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  marketValue: number;
  weightPct: number;
  returnPct: number;
}

export interface PortfolioEquityPoint {
  time: string;
  equity: number;
}

export interface PortfolioBacktestSummary {
  initialCapital: number;
  finalEquity: number;
  totalReturnPct: number;
  symbolCount: number;
  bestSymbol: string;
  worstSymbol: string;
}

export interface PortfolioBacktestResponse {
  symbols: string[];
  range: HistoryRange;
  interval: HistoryInterval;
  allocation: string;
  summary: PortfolioBacktestSummary;
  equityCurve: PortfolioEquityPoint[];
  positions: PortfolioPosition[];
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

export interface PaperAccountSummary {
  accountId: string;
  cash: number;
  equity: number;
  buyingPower: number;
  realizedPnl: number;
  unrealizedPnl: number;
}

export interface PaperPosition {
  symbol: string;
  quantity: number;
  averageCost: number;
  lastPrice: number;
  marketValue: number;
  unrealizedPnl: number;
}

export interface PaperOrder {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  type: string;
  status: string;
  submittedAt: string;
  filledAt?: string | null;
  fillPrice?: number | null;
  message?: string | null;
}

export interface PaperFill {
  id: string;
  orderId: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  value: number;
  time: string;
}

export interface PaperAccountResponse {
  account: PaperAccountSummary;
  positions: PaperPosition[];
  orders: PaperOrder[];
  fills: PaperFill[];
}

export interface PaperOrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  type?: 'market';
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
