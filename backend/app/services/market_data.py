import os
from collections.abc import Callable
from importlib.util import find_spec

from app.cache import JsonCache
from app.demo_data import generate_demo_bars
from app.models import (
    Bar,
    MarketProviderConfig,
    HistoryInterval,
    HistoryRange,
    HistoryResponse,
    Instrument,
    NotFoundApiError,
    Quote,
    ProviderOption,
    UpstreamApiError,
    ValidationApiError,
    WarningPayload,
)
from app.providers.alpha_vantage import (
    ALPHA_VANTAGE_API_KEY_ENV,
    fetch_alpha_vantage_history,
    get_alpha_vantage_api_key,
)
from app.providers.akshare import fetch_akshare_history
from app.providers.eastmoney import fetch_eastmoney_history
from app.providers.yahoo import fetch_yahoo_history
from app.providers.yfinance import fetch_yfinance_history
from app.symbols import find_symbol, search_symbols
from app.services.data_quality import assess_history_quality
from app.storage import HistoryStore


SUPPORTED_RANGES = {"1mo", "3mo", "6mo", "1y", "5y", "max"}
SUPPORTED_INTERVALS = {"1d", "1wk", "1mo"}
HistoryProvider = Callable[[Instrument, HistoryRange, HistoryInterval], list[Bar]]
DEFAULT_PROVIDER_NAMES = {
    "US": "yahoo",
    "CN": "eastmoney",
}
HISTORY_PROVIDER_REGISTRY: dict[str, dict[str, HistoryProvider]] = {
    "US": {
        "yahoo": fetch_yahoo_history,
        "yfinance": fetch_yfinance_history,
        "alphavantage": fetch_alpha_vantage_history,
    },
    "CN": {
        "eastmoney": fetch_eastmoney_history,
        "akshare": fetch_akshare_history,
        "alphavantage": fetch_alpha_vantage_history,
    },
}
OPTIONAL_PROVIDER_DEPENDENCIES = {
    "yfinance": "yfinance",
    "akshare": "akshare",
}
OPTIONAL_PROVIDER_CREDENTIALS = {
    "alphavantage": ALPHA_VANTAGE_API_KEY_ENV,
}
PROVIDER_LABELS = {
    "yahoo": "Yahoo Finance",
    "yfinance": "yfinance",
    "alphavantage": "Alpha Vantage",
    "eastmoney": "Eastmoney",
    "akshare": "AkShare",
}
PROVIDER_DESCRIPTIONS = {
    "yahoo": "Public Yahoo chart endpoint",
    "yfinance": "Open-source Python wrapper around Yahoo Finance",
    "alphavantage": "Official Alpha Vantage market-data API",
    "eastmoney": "Public Eastmoney kline endpoint",
    "akshare": "Open-source data integration library for A-share history",
}
MARKET_LABELS = {
    "US": "US market",
    "CN": "CN market",
}


def _provider_name_from_env(market: str, default: str) -> str:
    value = os.getenv(f"QUANT_{market}_HISTORY_PROVIDER", default).strip().lower()
    if value in {"default", "public"}:
        return default
    return value


def build_default_provider_config() -> tuple[dict[str, HistoryProvider], dict[str, str]]:
    providers: dict[str, HistoryProvider] = {}
    provider_names: dict[str, str] = {}
    for market, default_provider_name in DEFAULT_PROVIDER_NAMES.items():
        provider_name = _provider_name_from_env(market, default_provider_name)
        registry = HISTORY_PROVIDER_REGISTRY[market]
        provider = registry.get(provider_name)
        if provider is None:
            supported = ", ".join(sorted(registry))
            raise RuntimeError(
                f"Unsupported {market} history provider '{provider_name}'. Supported values: {supported}"
            )

        dependency = OPTIONAL_PROVIDER_DEPENDENCIES.get(provider_name)
        if dependency and find_spec(dependency) is None:
            raise RuntimeError(
                f"Configured {market} history provider '{provider_name}' requires optional dependency "
                f"'{dependency}'. Install it with `pip install {dependency}`."
            )
        credential_env = OPTIONAL_PROVIDER_CREDENTIALS.get(provider_name)
        if credential_env and not get_alpha_vantage_api_key():
            raise RuntimeError(
                f"Configured {market} history provider '{provider_name}' requires {credential_env}. "
                f"Set {credential_env} to enable the official provider."
            )

        providers[market] = provider
        provider_names[market] = provider_name

    return providers, provider_names


def parse_provider_overrides(raw: str | None) -> dict[str, str]:
    if not raw:
        return {}

    overrides: dict[str, str] = {}
    for item in raw.split(","):
        token = item.strip()
        if not token:
            continue
        if ":" not in token:
            raise ValidationApiError("providers must use the format MARKET:provider,MARKET:provider")
        market, provider = token.split(":", 1)
        normalized_market = market.strip().upper()
        normalized_provider = provider.strip().lower()
        if not normalized_market or not normalized_provider:
            raise ValidationApiError("providers must use the format MARKET:provider,MARKET:provider")
        overrides[normalized_market] = normalized_provider
    return overrides


class MarketDataService:
    def __init__(
        self,
        providers: dict[str, HistoryProvider] | None = None,
        provider_names: dict[str, str] | None = None,
        use_demo_fallback: bool = True,
        cache: JsonCache | None = None,
        cache_ttl_seconds: int = 900,
        history_store: HistoryStore | None = None,
    ) -> None:
        if providers is None:
            providers, default_provider_names = build_default_provider_config()
            provider_names = provider_names or default_provider_names

        self.providers = providers
        self.provider_names = provider_names or {market: market for market in providers}
        self.use_demo_fallback = use_demo_fallback
        self.cache = cache or JsonCache()
        self.cache_ttl_seconds = cache_ttl_seconds
        self.history_store = history_store or HistoryStore()

    def describe_providers(self) -> list[MarketProviderConfig]:
        configs: list[MarketProviderConfig] = []
        for market, registry in HISTORY_PROVIDER_REGISTRY.items():
            options: list[ProviderOption] = []
            for provider_name in registry:
                dependency = OPTIONAL_PROVIDER_DEPENDENCIES.get(provider_name)
                credential_env = OPTIONAL_PROVIDER_CREDENTIALS.get(provider_name)
                dependency_available = dependency is None or find_spec(dependency) is not None
                credential_available = credential_env is None or get_alpha_vantage_api_key() is not None
                available = dependency_available and credential_available
                setup_hints: list[str] = []
                if dependency and not dependency_available:
                    setup_hints.append(f"Install with `pip install {dependency}`.")
                if credential_env and not credential_available:
                    setup_hints.append(f"Set {credential_env} to an Alpha Vantage API key.")
                options.append(ProviderOption(
                    id=provider_name,
                    label=PROVIDER_LABELS.get(provider_name, provider_name),
                    description=PROVIDER_DESCRIPTIONS.get(provider_name, provider_name),
                    available=available,
                    dependency=dependency,
                    installCommand=f"pip install {dependency}" if dependency else None,
                    credentialEnv=credential_env,
                    setupHint=" ".join(setup_hints) or None,
                ))
            configs.append(MarketProviderConfig(
                market=market,
                label=MARKET_LABELS.get(market, market),
                defaultProvider=DEFAULT_PROVIDER_NAMES[market],
                activeProvider=self.provider_names.get(market, DEFAULT_PROVIDER_NAMES[market]),
                options=options,
            ))
        return configs

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

    def resolve_provider_name(self, market: str, provider_overrides: dict[str, str] | None = None) -> str:
        default_provider = self.provider_names.get(market)
        if default_provider is None:
            raise ValidationApiError(f"No history provider configured for market: {market}")

        requested_provider = None
        if provider_overrides:
            requested_provider = provider_overrides.get(market)
        if not requested_provider:
            return default_provider

        normalized = requested_provider.strip().lower()
        if normalized in {"default", "public"}:
            return default_provider
        if normalized == default_provider.strip().lower():
            return default_provider

        registry = HISTORY_PROVIDER_REGISTRY.get(market)
        if registry is None or normalized not in registry:
            supported = ", ".join(sorted(registry)) if registry else ""
            raise ValidationApiError(
                f"Unsupported history provider for market {market}: {requested_provider}"
                + (f". Supported values: {supported}" if supported else "")
            )

        dependency = OPTIONAL_PROVIDER_DEPENDENCIES.get(normalized)
        if dependency and find_spec(dependency) is None:
            raise ValidationApiError(
                f"Configured history provider '{normalized}' requires optional dependency '{dependency}'"
            )
        credential_env = OPTIONAL_PROVIDER_CREDENTIALS.get(normalized)
        if credential_env and not get_alpha_vantage_api_key():
            raise ValidationApiError(
                f"Configured history provider '{normalized}' requires {credential_env}"
            )

        return normalized

    def get_history(
        self,
        symbol: str | None,
        range_value: str = "1y",
        interval: str = "1d",
        provider_overrides: dict[str, str] | None = None,
    ) -> HistoryResponse:
        instrument = self.resolve(symbol)
        range_value, interval = self.validate_history_options(range_value, interval)
        provider_name = self.resolve_provider_name(instrument.market, provider_overrides)
        provider = None
        if provider_name == self.provider_names.get(instrument.market):
            provider = self.providers.get(instrument.market)

        if provider is None:
            provider_registry = HISTORY_PROVIDER_REGISTRY.get(instrument.market)
            if provider_registry is None:
                raise ValidationApiError(f"No history provider configured for market: {instrument.market}")
            provider = provider_registry.get(provider_name)

        if provider is None:
            raise ValidationApiError(f"No history provider configured for market {instrument.market}: {provider_name}")

        stored_bars = self.history_store.get_history(instrument, range_value, interval, provider_key=provider_name)
        if stored_bars is not None:
            return HistoryResponse(
                instrument=instrument,
                range=range_value,
                interval=interval,
                bars=stored_bars,
                source="local",
                warning=None,
                quality=assess_history_quality(instrument, interval, stored_bars),
            )

        cache_key = {
            "provider": provider_name,
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
                quality=assess_history_quality(instrument, interval, bars),
            )

        source = "live"
        warning = None

        try:
            bars = provider(instrument, range_value, interval)
            self.cache.set(cache_key, [bar.model_dump() for bar in bars])
            self.history_store.set_history(instrument, range_value, interval, bars, "live", provider_key=provider_name)
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
            quality=assess_history_quality(instrument, interval, bars),
        )

    def get_quote(self, symbol: str | None, provider_overrides: dict[str, str] | None = None) -> Quote:
        history = self.get_history(symbol, "1mo", "1d", provider_overrides)
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
