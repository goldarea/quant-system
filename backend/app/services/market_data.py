from collections.abc import Callable

from app.cache import JsonCache
from app.demo_data import generate_demo_bars
from app.models import (
    Bar,
    HistoryInterval,
    HistoryRange,
    HistoryResponse,
    Instrument,
    NotFoundApiError,
    Quote,
    UpstreamApiError,
    ValidationApiError,
    WarningPayload,
)
from app.providers.eastmoney import fetch_eastmoney_history
from app.providers.yahoo import fetch_yahoo_history
from app.symbols import find_symbol, search_symbols
from app.storage import HistoryStore


SUPPORTED_RANGES = {"1mo", "3mo", "6mo", "1y", "5y", "max"}
SUPPORTED_INTERVALS = {"1d", "1wk", "1mo"}
HistoryProvider = Callable[[Instrument, HistoryRange, HistoryInterval], list[Bar]]


class MarketDataService:
    def __init__(
        self,
        providers: dict[str, HistoryProvider] | None = None,
        use_demo_fallback: bool = True,
        cache: JsonCache | None = None,
        cache_ttl_seconds: int = 900,
        history_store: HistoryStore | None = None,
    ) -> None:
        self.providers = providers or {
            "US": fetch_yahoo_history,
            "CN": fetch_eastmoney_history,
        }
        self.use_demo_fallback = use_demo_fallback
        self.cache = cache or JsonCache()
        self.cache_ttl_seconds = cache_ttl_seconds
        self.history_store = history_store or HistoryStore()

    def search(self, query: str | None) -> list[Instrument]:
        return search_symbols(query)

    def resolve(self, symbol: str | None) -> Instrument:
        normalized = str(symbol or "").strip().upper()
        if not normalized:
            raise ValidationApiError("Symbol is required")

        instrument = find_symbol(normalized)
        if not instrument:
            raise NotFoundApiError(f"Unknown symbol: {normalized}")
        return instrument

    def validate_history_options(self, range_value: str, interval: str) -> tuple[HistoryRange, HistoryInterval]:
        if range_value not in SUPPORTED_RANGES:
            raise ValidationApiError(f"Unsupported range: {range_value}")
        if interval not in SUPPORTED_INTERVALS:
            raise ValidationApiError(f"Unsupported interval: {interval}")
        return range_value, interval  # type: ignore[return-value]

    def get_history(self, symbol: str | None, range_value: str = "1y", interval: str = "1d") -> HistoryResponse:
        instrument = self.resolve(symbol)
        range_value, interval = self.validate_history_options(range_value, interval)
        provider = self.providers.get(instrument.market)
        if provider is None:
            raise ValidationApiError(f"No history provider configured for market: {instrument.market}")

        stored_bars = self.history_store.get_history(instrument, range_value, interval)
        if stored_bars is not None:
            return HistoryResponse(
                instrument=instrument,
                range=range_value,
                interval=interval,
                bars=stored_bars,
                source="local",
                warning=None,
            )

        cache_key = {
            "provider": instrument.market,
            "symbol": instrument.providerSymbol or instrument.symbol,
            "range": range_value,
            "interval": interval,
        }
        cached_bars = self.cache.get(cache_key, self.cache_ttl_seconds)
        if cached_bars is not None:
            bars = [Bar(**bar) for bar in cached_bars]
            return HistoryResponse(
                instrument=instrument,
                range=range_value,
                interval=interval,
                bars=bars,
                source="cache",
                warning=None,
            )

        source = "live"
        warning = None

        try:
            bars = provider(instrument, range_value, interval)
            self.cache.set(cache_key, [bar.model_dump() for bar in bars])
            self.history_store.set_history(instrument, range_value, interval, bars, "live")
        except UpstreamApiError as error:
            if not self.use_demo_fallback:
                raise
            bars = generate_demo_bars(instrument, range_value)
            source = "demo"
            warning = WarningPayload(
                code=error.code,
                message=f"Using demo data because live provider failed: {error.message}",
            )

        return HistoryResponse(
            instrument=instrument,
            range=range_value,
            interval=interval,
            bars=bars,
            source=source,
            warning=warning,
        )

    def get_quote(self, symbol: str | None) -> Quote:
        history = self.get_history(symbol, "1mo", "1d")
        if not history.bars:
            raise NotFoundApiError(f"No bars available for symbol: {symbol}")

        last = history.bars[-1]
        return Quote(
            instrument=history.instrument,
            symbol=history.instrument.symbol,
            name=history.instrument.name,
            market=history.instrument.market,
            currency=history.instrument.currency,
            price=last.close,
            time=last.time,
            volume=last.volume,
            source=history.source,
        )
