import { config } from '@/lib/config';

/**
 * Minimal robots.txt client. We fetch and cache each origin's robots.txt and
 * refuse to request any path it disallows for our user-agent. Crawl-delay is
 * honoured by the caller via `setHostDelay`.
 *
 * This is intentionally strict: on a parse failure or fetch error for a host
 * we are about to crawl, we default to "not allowed" for HTML crawling
 * (see `allowOnError`).
 */

interface RobotsRule {
  allow: string[];
  disallow: string[];
  crawlDelayMs: number | null;
}

interface RobotsDoc {
  fetchedAt: number;
  rules: RobotsRule;
  error?: string;
}

const CACHE = new Map<string, RobotsDoc>();
const TTL_MS = 6 * 60 * 60 * 1000;

function parseRobots(text: string, agent: string): RobotsRule {
  const lines = text.split(/\r?\n/);
  const groups: { agents: string[]; rule: RobotsRule }[] = [];
  let current: { agents: string[]; rule: RobotsRule } | null = null;
  let lastWasAgent = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rule: { allow: [], disallow: [], crawlDelayMs: null } };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }

    lastWasAgent = false;
    if (!current) continue;
    if (field === 'allow') current.rule.allow.push(value);
    else if (field === 'disallow') current.rule.disallow.push(value);
    else if (field === 'crawl-delay') {
      const n = Number.parseFloat(value);
      if (Number.isFinite(n) && n >= 0) current.rule.crawlDelayMs = Math.round(n * 1000);
    }
  }

  const agentLower = agent.toLowerCase();
  const specific = groups.find((g) => g.agents.some((a) => a !== '*' && agentLower.includes(a)));
  const wildcard = groups.find((g) => g.agents.includes('*'));
  return specific?.rule ?? wildcard?.rule ?? { allow: [], disallow: [], crawlDelayMs: null };
}

function matchLength(pattern: string, path: string): number {
  if (pattern === '') return -1;
  // Support the * wildcard and $ anchor as per the de-facto standard.
  if (pattern.includes('*') || pattern.endsWith('$')) {
    const anchored = pattern.endsWith('$');
    const body = anchored ? pattern.slice(0, -1) : pattern;
    const re = new RegExp(
      `^${body.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}${anchored ? '$' : ''}`,
    );
    return re.test(path) ? body.length : -1;
  }
  return path.startsWith(pattern) ? pattern.length : -1;
}

async function loadRobots(origin: string): Promise<RobotsDoc> {
  const cached = CACHE.get(origin);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached;

  const doc: RobotsDoc = {
    fetchedAt: Date.now(),
    rules: { allow: [], disallow: [], crawlDelayMs: null },
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': config.userAgent },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (res.status === 404 || res.status === 410) {
      // No robots.txt means everything is allowed.
      CACHE.set(origin, doc);
      return doc;
    }
    if (!res.ok) {
      doc.error = `robots.txt HTTP ${res.status}`;
      CACHE.set(origin, doc);
      return doc;
    }
    doc.rules = parseRobots(await res.text(), config.userAgent);
  } catch (err) {
    doc.error = err instanceof Error ? err.message : 'robots.txt fetch failed';
  }

  CACHE.set(origin, doc);
  return doc;
}

export interface RobotsVerdict {
  allowed: boolean;
  crawlDelayMs: number | null;
  reason?: string;
}

/**
 * @param allowOnError when true (default for JSON APIs published by the
 *   vendor for this purpose), a failure to read robots.txt does not block
 *   the request. For HTML crawling we pass false.
 */
export async function isAllowed(url: string, allowOnError = true): Promise<RobotsVerdict> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { allowed: false, crawlDelayMs: null, reason: 'invalid url' };
  }

  const doc = await loadRobots(parsed.origin);
  if (doc.error) {
    return {
      allowed: allowOnError,
      crawlDelayMs: null,
      reason: allowOnError ? undefined : doc.error,
    };
  }

  const path = `${parsed.pathname}${parsed.search}`;
  let bestAllow = -1;
  let bestDisallow = -1;
  for (const p of doc.rules.allow) bestAllow = Math.max(bestAllow, matchLength(p, path));
  for (const p of doc.rules.disallow) bestDisallow = Math.max(bestDisallow, matchLength(p, path));

  const allowed = bestDisallow < 0 || bestAllow >= bestDisallow;
  return {
    allowed,
    crawlDelayMs: doc.rules.crawlDelayMs,
    reason: allowed ? undefined : `disallowed by ${parsed.origin}/robots.txt`,
  };
}

export function clearRobotsCache(): void {
  CACHE.clear();
}
