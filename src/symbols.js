export const INSTRUMENTS = [
  { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', exchange: 'NASDAQ', currency: 'USD', providerSymbol: 'AAPL' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', market: 'US', exchange: 'NASDAQ', currency: 'USD', providerSymbol: 'MSFT' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', market: 'US', exchange: 'NASDAQ', currency: 'USD', providerSymbol: 'NVDA' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. Class A', market: 'US', exchange: 'NASDAQ', currency: 'USD', providerSymbol: 'GOOGL' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', market: 'US', exchange: 'NASDAQ', currency: 'USD', providerSymbol: 'AMZN' },
  { symbol: 'META', name: 'Meta Platforms Inc.', market: 'US', exchange: 'NASDAQ', currency: 'USD', providerSymbol: 'META' },
  { symbol: 'TSLA', name: 'Tesla Inc.', market: 'US', exchange: 'NASDAQ', currency: 'USD', providerSymbol: 'TSLA' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', market: 'US', exchange: 'NYSEARCA', currency: 'USD', providerSymbol: 'SPY' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', market: 'US', exchange: 'NASDAQ', currency: 'USD', providerSymbol: 'QQQ' },
  { symbol: '600519', name: 'Kweichow Moutai Co., Ltd.', localName: '贵州茅台', market: 'CN', exchange: 'SH', currency: 'CNY', providerSymbol: '1.600519' },
  { symbol: '000001', name: 'Ping An Bank Co., Ltd.', localName: '平安银行', market: 'CN', exchange: 'SZ', currency: 'CNY', providerSymbol: '0.000001' },
  { symbol: '000858', name: 'Wuliangye Yibin Co., Ltd.', localName: '五粮液', market: 'CN', exchange: 'SZ', currency: 'CNY', providerSymbol: '0.000858' },
  { symbol: '300750', name: 'Contemporary Amperex Technology Co., Ltd.', localName: '宁德时代', market: 'CN', exchange: 'SZ', currency: 'CNY', providerSymbol: '0.300750' },
  { symbol: '601318', name: 'Ping An Insurance Group', localName: '中国平安', market: 'CN', exchange: 'SH', currency: 'CNY', providerSymbol: '1.601318' },
  { symbol: '510300', name: 'CSI 300 ETF', localName: '沪深300ETF', market: 'CN', exchange: 'SH', currency: 'CNY', providerSymbol: '1.510300' }
];

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function searchableText(instrument) {
  return [
    instrument.symbol,
    instrument.name,
    instrument.localName,
    instrument.exchange,
    instrument.market
  ].filter(Boolean).join(' ').toUpperCase();
}

function rankMatch(instrument, query) {
  const symbol = normalize(instrument.symbol);
  const text = searchableText(instrument);
  if (symbol === query) return 0;
  if (symbol.startsWith(query)) return 1;
  if (text.includes(query)) return 2;
  return 99;
}

export function searchSymbols(query, limit = 10) {
  const normalized = normalize(query);
  if (!normalized) return INSTRUMENTS.slice(0, limit);

  return INSTRUMENTS
    .map((instrument) => ({ instrument, rank: rankMatch(instrument, normalized) }))
    .filter((entry) => entry.rank < 99)
    .sort((a, b) => a.rank - b.rank || a.instrument.symbol.localeCompare(b.instrument.symbol))
    .slice(0, limit)
    .map((entry) => entry.instrument);
}

export function findSymbol(symbol) {
  const normalized = normalize(symbol);
  return INSTRUMENTS.find((instrument) => normalize(instrument.symbol) === normalized) || null;
}
