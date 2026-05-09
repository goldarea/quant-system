import test from 'node:test';
import assert from 'node:assert/strict';

import { handleApiRequest } from '../src/http.js';

async function request(path, service) {
  return handleApiRequest({
    method: 'GET',
    url: new URL(`http://127.0.0.1${path}`),
    service
  });
}

test('handleApiRequest returns health response', async () => {
  const response = await request('/api/health', {});

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.data.status, 'ok');
});

test('handleApiRequest delegates search query to service', async () => {
  const response = await request('/api/search?q=aapl', {
    search: (query) => [{ symbol: query.toUpperCase() }]
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, [{ symbol: 'AAPL' }]);
});

test('handleApiRequest maps thrown application errors to JSON errors', async () => {
  const response = await request('/api/history?symbol=BAD', {
    getHistory: async () => {
      throw new Error('boom');
    }
  });

  assert.equal(response.status, 500);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error.code, 'INTERNAL_ERROR');
});
