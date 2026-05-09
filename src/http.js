import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

import { toErrorResponse } from './errors.js';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon'
};

export function jsonResponse(data, status = 200) {
  return {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    },
    body: data
  };
}

function ok(data, status = 200) {
  return jsonResponse({ ok: true, data }, status);
}

export async function handleApiRequest({ method, url, service }) {
  if (method !== 'GET') {
    return jsonResponse({
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET is supported' }
    }, 405);
  }

  try {
    if (url.pathname === '/api/health') {
      return ok({
        status: 'ok',
        time: new Date().toISOString()
      });
    }

    if (url.pathname === '/api/search') {
      return ok(service.search(url.searchParams.get('q') || ''));
    }

    if (url.pathname === '/api/history') {
      return ok(await service.getHistory({
        symbol: url.searchParams.get('symbol'),
        range: url.searchParams.get('range') || '1y',
        interval: url.searchParams.get('interval') || '1d'
      }));
    }

    if (url.pathname === '/api/quote') {
      return ok(await service.getQuote({
        symbol: url.searchParams.get('symbol')
      }));
    }

    return jsonResponse({
      ok: false,
      error: { code: 'NOT_FOUND', message: `Unknown API route: ${url.pathname}` }
    }, 404);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export function sendJson(res, response) {
  res.writeHead(response.status, response.headers);
  res.end(JSON.stringify(response.body));
}

function safeStaticPath(publicDir, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const decoded = decodeURIComponent(requested.split('?')[0]);
  const normalizedPath = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const fullPath = resolve(join(publicDir, normalizedPath));
  const root = resolve(publicDir);

  if (!fullPath.startsWith(root)) {
    return null;
  }

  return fullPath;
}

export async function serveStatic({ req, res, publicDir }) {
  const url = new URL(req.url, 'http://127.0.0.1');
  const filePath = safeStaticPath(publicDir, url.pathname);
  if (!filePath) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw Object.assign(new Error('Not found'), { code: 'ENOENT' });

    res.writeHead(200, {
      'content-type': MIME_TYPES[extname(filePath)] || 'application/octet-stream',
      'cache-control': 'no-cache'
    });
    createReadStream(filePath).pipe(res);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Static file error');
  }
}
