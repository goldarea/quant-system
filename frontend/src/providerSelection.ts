import type { MarketProviderConfig, ProviderCatalogResponse } from './api/types';

export type ProviderSelection = Record<string, string>;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const providerStorageKey = 'quant-system.providers';

function resolveStorage(storage?: StorageLike) {
  if (storage) return storage;
  if (typeof globalThis.localStorage !== 'undefined') return globalThis.localStorage;
  return undefined;
}

function normalizeSelection(selection: unknown): ProviderSelection {
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) return {};

  return Object.fromEntries(
    Object.entries(selection).filter(([, provider]) => typeof provider === 'string')
  );
}

function resolveProvider(market: MarketProviderConfig, preferredProvider?: string) {
  const preferred = market.options.find((option) => option.id === preferredProvider && option.available);
  if (preferred) return preferred.id;

  const active = market.options.find((option) => option.id === market.activeProvider && option.available);
  if (active) return active.id;

  const available = market.options.find((option) => option.available);
  if (available) return available.id;

  return market.activeProvider || market.defaultProvider;
}

export function providerSelectionFromCatalog(
  catalog: ProviderCatalogResponse,
  preferredSelection: ProviderSelection = {}
): ProviderSelection {
  return Object.fromEntries(
    catalog.markets.map((market) => [market.market, resolveProvider(market, preferredSelection[market.market])])
  );
}

export function loadProviderSelection(storage?: StorageLike): ProviderSelection {
  const resolvedStorage = resolveStorage(storage);
  if (!resolvedStorage) return {};

  try {
    const raw = resolvedStorage.getItem(providerStorageKey);
    if (!raw) return {};
    return normalizeSelection(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveProviderSelection(selection: ProviderSelection, storage?: StorageLike) {
  const resolvedStorage = resolveStorage(storage);
  if (!resolvedStorage) return;

  try {
    resolvedStorage.setItem(providerStorageKey, JSON.stringify(selection));
  } catch {
    // Ignore storage failures so provider selection never blocks the app.
  }
}
