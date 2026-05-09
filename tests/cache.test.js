import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { JsonCache, stableCacheKey } from '../src/cache.js';

test('stableCacheKey is deterministic for equivalent objects', () => {
  const one = stableCacheKey({ symbol: 'AAPL', range: '1y', interval: '1d' });
  const two = stableCacheKey({ interval: '1d', range: '1y', symbol: 'AAPL' });

  assert.equal(one, two);
});

test('JsonCache returns stored values while fresh and misses after ttl', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'quant-cache-'));
  try {
    const cache = new JsonCache({ directory: dir, now: () => 1_000 });
    await cache.set('quote:AAPL', { price: 100 });

    assert.deepEqual(await cache.get('quote:AAPL', 10_000), { price: 100 });

    const expired = new JsonCache({ directory: dir, now: () => 20_000 });
    assert.equal(await expired.get('quote:AAPL', 10_000), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
