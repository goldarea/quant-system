import { JsonCache, stableCacheKey } from './cache.js';
import { NotFoundError, UpstreamError, ValidationError } from './errors.js';
import { generateDemoBars } from './demoData.js';
import { fetchEastmoneyHistory } from './providers/eastmoney.js';
import { fetchYahooHistory } from './providers/yahoo.js';
import { findSymbol, searchSymbols } from './symbols.js';

const SUPPORTED_RANGES = new Set(['1mo', '3mo', '6mo', '1y', '5y', 'max']);
const SUPPORTED_INTERVALS = new Set(['1d', '1wk', '1mo']);
const DEFAULT_HISTORY_TTL_MS = 15 * 60 * 1000;

function normalizeSymbol(symbol) {
  return String(symbol || '').trim().toUpperCase();
}

function defaultProviders() {
  return {
    US: { history: fetchYahooHistory },
    CN: { history: fetchEastmoneyHistory }
  };
}

export class MarketDataService {
  constructor({
    cache = new JsonCache({ directory: '.cache' }),
    providers = defaultProviders(),
    historyTtlMs = DEFAULT_HISTORY_TTL_MS,
    useDemoFallback = true
  } = {}) {
    this.cache = cache;
    this.providers = providers;
    this.historyTtlMs = historyTtlMs;
    this.useDemoFallback = useDemoFallback;
  }

  search(query) {
    return searchSymbols(query);
  }

  resolve(symbol) {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) throw new ValidationError('Symbol is required');

    const instrument = findSymbol(normalized);
    if (!instrument) throw new NotFoundError(`Unknown symbol: ${normalized}`);
    return instrument;
  }

  validateHistoryOptions({ range = '1y', interval = '1d' } = {}) {
    if (!SUPPORTED_RANGES.has(range)) {
      throw new ValidationError(`Unsupported range: ${range}`);
    }
    if (!SUPPORTED_INTERVALS.has(interval)) {
      throw new ValidationError(`Unsupported interval: ${interval}`);
    }
    return { range, interval };
  }

  async getHistory({ symbol, range = '1y', interval = '1d' }) {
    const instrument = this.resolve(symbol);
    const options = this.validateHistoryOptions({ range, interval });
    const provider = this.providers[instrument.market];
    if (!provider?.history) {
      throw new ValidationError(`No history provider configured for market: ${instrument.market}`);
    }

    const cacheKey = stableCacheKey({
      type: 'history',
      symbol: instrument.symbol,
      range: options.range,
      interval: options.interval
    });

    if (this.cache) {
      const cached = await this.cache.get(cacheKey, this.historyTtlMs);
      if (cached) {
        return { ...cached, source: 'cache' };
      }
    }

    let bars;
    let source = 'live';
    let warning;

    try {
      bars = await provider.history(instrument, options);
    } catch (error) {
      if (!this.useDemoFallback || !(error instanceof UpstreamError)) {
        throw error;
      }
      bars = generateDemoBars(instrument, options);
      source = 'demo';
      warning = {
        code: error.code,
        message: `Using demo data because live provider failed: ${error.message}`
      };
    }

    const payload = {
      instrument,
      range: options.range,
      interval: options.interval,
      bars,
      source,
      warning
    };

    if (this.cache) {
      await this.cache.set(cacheKey, payload);
    }

    return payload;
  }

  async getQuote({ symbol }) {
    const history = await this.getHistory({ symbol, range: '1mo', interval: '1d' });
    const last = history.bars.at(-1);
    if (!last) throw new NotFoundError(`No bars available for symbol: ${symbol}`);

    return {
      instrument: history.instrument,
      symbol: history.instrument.symbol,
      name: history.instrument.name,
      market: history.instrument.market,
      currency: history.instrument.currency,
      price: last.close,
      time: last.time,
      volume: last.volume,
      source: history.source
    };
  }
}

export function createMarketDataService(options = {}) {
  return new MarketDataService(options);
}
