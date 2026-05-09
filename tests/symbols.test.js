import test from 'node:test';
import assert from 'node:assert/strict';

import { findSymbol, searchSymbols } from '../src/symbols.js';

test('searchSymbols finds symbols by code and company name', () => {
  const byCode = searchSymbols('aapl');
  const byName = searchSymbols('kweichow');

  assert.equal(byCode[0].symbol, 'AAPL');
  assert.equal(byName[0].symbol, '600519');
});

test('findSymbol resolves known symbols case-insensitively', () => {
  const instrument = findSymbol('msft');

  assert.equal(instrument.symbol, 'MSFT');
  assert.equal(instrument.market, 'US');
});

test('findSymbol returns null for unknown symbols', () => {
  assert.equal(findSymbol('NO_SUCH_SYMBOL'), null);
});
