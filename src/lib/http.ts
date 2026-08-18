import { config } from '@/lib/config';

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
  body?: string;
  /** Treat these statuses as "empty result" rather than an error. */
  softFailStatuses?: number[];
}

const DEFAULTS: Required<Pick<FetchOptions, 'timeoutMs' | 'retries'>> = {
  timeoutMs: 20_000,
  retries: 2,
};

/** Per-host serialised rate limiter. */
const hostQueues = new Map<string, Promise<unknown>>();
const hostDelays = new Map<string, number>();

export function setHostDelay(host: string, ms: number): void {
  hostDelays.set(host, ms);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Run `fn` serialised per host, honouring the configured crawl delay.
 * This is what keeps us inside each site's stated rate limits.
 */
export function withHostLimit<T>(url: string, fn: () => Promise<T>): Promise<T> {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return fn();
  }
  const delay = hostDelays.get(host) ?? 0;
  const prev = hostQueues.get(host) ?? Promise.resolve();
  const next = prev.then(async () => {
    const result = await fn();
    if (delay > 0) await sleep(delay);
    return result;
  });
  hostQueues.set(
    host,
    next.catch(() => undefined),
  );
  return next as Promise<T>;
}

export async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeoutMs, retries } = { ...DEFAULTS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: options.method ?? 'GET',
        headers: {
          'User-Agent': config.userAgent,
          Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
          'Accept-Language': 'en-CA,en;q=0.9,fr-CA;q=0.6',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
        },
        body: options.body,
        signal: controller.signal,
        cache: 'no-store',
        redirect: 'follow',
      });

      if (res.ok) return res;

      if (options.softFailStatuses?.includes(res.status)) return res;

      // Do not hammer on client errors that will not change.
      if (res.status === 404 || res.status === 401 || res.status === 403 || res.status === 410) {
        throw new HttpError(`HTTP ${res.status}`, res.status, url);
      }

      if (res.status === 429) {
        const retryAfter = Number.parseInt(res.headers.get('retry-after') ?? '', 10);
        await sleep(Number.isFinite(retryAfter) ? Math.min(retryAfter * 1000, 30_000) : 5000 * (attempt + 1));
        lastError = new HttpError('HTTP 429 rate limited', 429, url);
        continue;
      }

      lastError = new HttpError(`HTTP ${res.status}`, res.status, url);
    } catch (err) {
      lastError = err;
      if (err instanceof HttpError && [401, 403, 404, 410].includes(err.status)) throw err;
    } finally {
      clearTimeout(timer);
    }

    if (attempt < retries) await sleep(600 * 2 ** attempt + Math.random() * 400);
  }

  throw lastError instanceof Error ? lastError : new Error(`Request failed: ${url}`);
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const res = await withHostLimit(url, () => fetchWithRetry(url, options));
  const text = await res.text();
  if (!text.trim()) return [] as unknown as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON from ${url} (${text.slice(0, 120)})`);
  }
}

export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const res = await withHostLimit(url, () => fetchWithRetry(url, options));
  return res.text();
}

/** Bounded-concurrency map. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const i = cursor;
      cursor += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export class Deadline {
  private readonly end: number;
  constructor(budgetMs: number) {
    this.end = Date.now() + budgetMs;
  }
  get remaining(): number {
    return Math.max(0, this.end - Date.now());
  }
  get expired(): boolean {
    return this.remaining <= 0;
  }
}
