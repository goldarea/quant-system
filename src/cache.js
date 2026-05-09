import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function sortForJson(value) {
  if (Array.isArray(value)) {
    return value.map(sortForJson);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = sortForJson(value[key]);
        return sorted;
      }, {});
  }

  return value;
}

export function stableCacheKey(value) {
  const serialized = JSON.stringify(sortForJson(value));
  return createHash('sha256').update(serialized).digest('hex');
}

export class JsonCache {
  constructor({ directory = '.cache', now = () => Date.now() } = {}) {
    this.directory = directory;
    this.now = now;
  }

  pathFor(key) {
    const file = /^[a-f0-9]{64}$/.test(key) ? key : stableCacheKey(key);
    return join(this.directory, `${file}.json`);
  }

  async get(key, ttlMs) {
    try {
      const raw = await readFile(this.pathFor(key), 'utf8');
      const entry = JSON.parse(raw);
      if (!entry || typeof entry.createdAt !== 'number') return null;
      if (this.now() - entry.createdAt > ttlMs) return null;
      return entry.value;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      return null;
    }
  }

  async set(key, value) {
    await mkdir(this.directory, { recursive: true });
    const entry = {
      createdAt: this.now(),
      value
    };
    await writeFile(this.pathFor(key), JSON.stringify(entry), 'utf8');
  }
}
