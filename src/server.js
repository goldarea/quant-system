import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { handleApiRequest, sendJson, serveStatic } from './http.js';
import { createMarketDataService } from './marketData.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const publicDir = resolve(rootDir, 'public');

export function createApp({ service = createMarketDataService(), publicDirectory = publicDir } = {}) {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');

    if (url.pathname.startsWith('/api/')) {
      const response = await handleApiRequest({
        method: req.method,
        url,
        service
      });
      sendJson(res, response);
      return;
    }

    await serveStatic({
      req,
      res,
      publicDir: publicDirectory
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || '127.0.0.1';
  const server = createApp();

  server.listen(port, host, () => {
    console.log(`Quant System MVP running at http://${host}:${port}`);
  });

  process.on('SIGINT', () => {
    server.close(() => process.exit(0));
  });
}
