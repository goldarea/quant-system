import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../src/server.js';

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      resolve(server.address().port);
    });
    server.once('error', reject);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

test('createApp serves API responses over HTTP', async () => {
  const server = createApp({
    service: {
      search: () => [{ symbol: 'AAPL' }]
    }
  });
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/search?q=aapl`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.data[0].symbol, 'AAPL');
  } finally {
    await close(server);
  }
});
