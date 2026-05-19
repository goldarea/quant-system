import { describe, expect, it, vi } from 'vitest';

import type { ProviderCatalogResponse } from './api/types';
import {
  loadProviderSelection,
  providerSelectionFromCatalog,
  providerStorageKey,
  saveProviderSelection,
  type StorageLike
} from './providerSelection';

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    })
  } satisfies StorageLike;
}

const catalog: ProviderCatalogResponse = {
  markets: [
    {
      market: 'US',
      label: 'US market',
      defaultProvider: 'yahoo',
      activeProvider: 'yahoo',
      options: [
        { id: 'yahoo', label: 'Yahoo Finance', description: 'Public Yahoo chart endpoint', available: true },
        { id: 'yfinance', label: 'yfinance', description: 'Open-source Python wrapper around Yahoo Finance', available: true }
      ]
    },
    {
      market: 'CN',
      label: 'CN market',
      defaultProvider: 'eastmoney',
      activeProvider: 'eastmoney',
      options: [
        { id: 'eastmoney', label: 'Eastmoney', description: 'Public Eastmoney kline endpoint', available: true },
        { id: 'akshare', label: 'AkShare', description: 'Open-source data integration library for A-share history', available: false }
      ]
    }
  ]
};

describe('provider selection persistence', () => {
  it('keeps available saved providers and falls back when a provider is unavailable', () => {
    expect(providerSelectionFromCatalog(catalog, { US: 'yfinance', CN: 'akshare' })).toEqual({
      US: 'yfinance',
      CN: 'eastmoney'
    });
  });

  it('loads and saves provider selections from storage', () => {
    const storage = createStorage();

    saveProviderSelection({ US: 'yfinance', CN: 'eastmoney' }, storage);

    expect(storage.setItem).toHaveBeenCalledWith(providerStorageKey, JSON.stringify({
      US: 'yfinance',
      CN: 'eastmoney'
    }));
    expect(loadProviderSelection(storage)).toEqual({
      US: 'yfinance',
      CN: 'eastmoney'
    });
  });

  it('ignores malformed saved provider selections', () => {
    const storage = createStorage({
      [providerStorageKey]: JSON.stringify({ US: 'yfinance', CN: 12, extra: null })
    });
    const malformedStorage = createStorage({ [providerStorageKey]: '{not-json' });

    expect(loadProviderSelection(storage)).toEqual({ US: 'yfinance' });
    expect(loadProviderSelection(malformedStorage)).toEqual({});
  });
});
