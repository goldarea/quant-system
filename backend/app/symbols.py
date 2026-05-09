from app.models import Instrument


INSTRUMENTS = [
    Instrument(symbol="AAPL", name="Apple Inc.", market="US", exchange="NASDAQ", currency="USD", providerSymbol="AAPL"),
    Instrument(symbol="MSFT", name="Microsoft Corporation", market="US", exchange="NASDAQ", currency="USD", providerSymbol="MSFT"),
    Instrument(symbol="NVDA", name="NVIDIA Corporation", market="US", exchange="NASDAQ", currency="USD", providerSymbol="NVDA"),
    Instrument(symbol="GOOGL", name="Alphabet Inc. Class A", market="US", exchange="NASDAQ", currency="USD", providerSymbol="GOOGL"),
    Instrument(symbol="AMZN", name="Amazon.com Inc.", market="US", exchange="NASDAQ", currency="USD", providerSymbol="AMZN"),
    Instrument(symbol="META", name="Meta Platforms Inc.", market="US", exchange="NASDAQ", currency="USD", providerSymbol="META"),
    Instrument(symbol="TSLA", name="Tesla Inc.", market="US", exchange="NASDAQ", currency="USD", providerSymbol="TSLA"),
    Instrument(symbol="SPY", name="SPDR S&P 500 ETF Trust", market="US", exchange="NYSEARCA", currency="USD", providerSymbol="SPY"),
    Instrument(symbol="QQQ", name="Invesco QQQ Trust", market="US", exchange="NASDAQ", currency="USD", providerSymbol="QQQ"),
    Instrument(symbol="600519", name="Kweichow Moutai Co., Ltd.", localName="贵州茅台", market="CN", exchange="SH", currency="CNY", providerSymbol="1.600519"),
    Instrument(symbol="000001", name="Ping An Bank Co., Ltd.", localName="平安银行", market="CN", exchange="SZ", currency="CNY", providerSymbol="0.000001"),
    Instrument(symbol="000858", name="Wuliangye Yibin Co., Ltd.", localName="五粮液", market="CN", exchange="SZ", currency="CNY", providerSymbol="0.000858"),
    Instrument(symbol="300750", name="Contemporary Amperex Technology Co., Ltd.", localName="宁德时代", market="CN", exchange="SZ", currency="CNY", providerSymbol="0.300750"),
    Instrument(symbol="601318", name="Ping An Insurance Group", localName="中国平安", market="CN", exchange="SH", currency="CNY", providerSymbol="1.601318"),
    Instrument(symbol="510300", name="CSI 300 ETF", localName="沪深300ETF", market="CN", exchange="SH", currency="CNY", providerSymbol="1.510300"),
]


def _normalize(value: str | None) -> str:
    return str(value or "").strip().upper()


def _searchable_text(instrument: Instrument) -> str:
    parts = [
        instrument.symbol,
        instrument.name,
        instrument.localName,
        instrument.exchange,
        instrument.market,
    ]
    return " ".join(part for part in parts if part).upper()


def _rank(instrument: Instrument, query: str) -> int:
    symbol = _normalize(instrument.symbol)
    text = _searchable_text(instrument)
    if symbol == query:
        return 0
    if symbol.startswith(query):
        return 1
    if query in text:
        return 2
    return 99


def search_symbols(query: str | None, limit: int = 10) -> list[Instrument]:
    normalized = _normalize(query)
    if not normalized:
        return INSTRUMENTS[:limit]

    ranked = [
        (instrument, _rank(instrument, normalized))
        for instrument in INSTRUMENTS
    ]
    return [
        instrument
        for instrument, rank in sorted(ranked, key=lambda entry: (entry[1], entry[0].symbol))
        if rank < 99
    ][:limit]


def find_symbol(symbol: str | None) -> Instrument | None:
    normalized = _normalize(symbol)
    return next((instrument for instrument in INSTRUMENTS if _normalize(instrument.symbol) == normalized), None)
