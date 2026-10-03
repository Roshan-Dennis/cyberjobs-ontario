/**
 * Finds Workday career sites from each employer's own robots.txt.
 *
 * A Workday tenant is reached at https://{tenant}.wd{N}.myworkdayjobs.com/{site},
 * and both the shard (wd1, wd3, …) and the site name are arbitrary. Guessing
 * them fails silently (the API answers 422), so instead each tenant's public
 * robots.txt is read: its Sitemap lines name every public career site. A site
 * is only used after its job API answers, and only if robots.txt allows it.
 *
 * Results are published (workday-discovery.json) and reused by the next run:
 * found tenants are re-checked on their known host only, and tenants that
 * were not found are re-probed at most once a day.
 */

export interface WorkdayCandidate {
  tenant: string;
  label: string;
  hint?: string;
}

export interface DiscoveredSite {
  site: string;
  /** Open postings the site reported when verified. */
  total: number;
}

export interface DiscoveryEntry {
  tenant: string;
  label: string;
  status: 'found' | 'not-found' | 'error';
  host: string | null;
  sites: DiscoveredSite[];
  checkedAt: string;
  note?: string;
}

export interface DiscoveryReport {
  generatedAt: string;
  entries: DiscoveryEntry[];
}

export interface DiscoveryDeps {
  fetchText: (url: string) => Promise<string>;
  /** POST JSON; resolves with the parsed body, rejects on HTTP errors. */
  postJson: (url: string, body: unknown) => Promise<unknown>;
  /** robots.txt verdict for a URL. */
  allowed: (url: string) => Promise<boolean>;
  now: Date;
  previous?: DiscoveryReport | null;
  /** Stop starting new work when this returns true. */
  expired?: () => boolean;
}

/** Shards Canadian tenants are usually on, most common first. */
export const WORKDAY_SHARDS = ['wd3', 'wd10', 'wd1', 'wd5', 'wd12'];

/** At most this many career sites are used per employer. */
export const MAX_SITES_PER_TENANT = 4;

const RETRY_MISSES_AFTER_MS = 24 * 3_600_000;
const LOCALE_RE = /^[a-z]{2}-[A-Z]{2}$/;
const NOT_A_SITE = new Set(['wday', 'robots.txt', 'sitemap.xml', '*', '']);

/**
 * Career-site names from a Workday robots.txt. Sitemap lines are the reliable
 * signal ("Sitemap: https://td.wd3.myworkdayjobs.com/TD_Bank_Careers/siteMap.xml",
 * sometimes with a locale segment first); "Allow: /Site/" lines are the
 * fallback. Only paths on the tenant's own host count.
 */
export function parseWorkdaySites(robots: string, host: string): string[] {
  const sites: string[] = [];
  const add = (path: string) => {
    const segs = path.split('/').filter(Boolean);
    const first = segs[0] && LOCALE_RE.test(segs[0]) ? segs[1] : segs[0];
    if (!first || NOT_A_SITE.has(first) || first.includes('*') || first.includes('?')) return;
    if (!sites.includes(first)) sites.push(first);
  };
  for (const m of robots.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)) {
    try {
      const u = new URL(m[1]);
      if (u.host.toLowerCase() === host.toLowerCase()) add(u.pathname);
    } catch {
      /* not a URL */
    }
  }
  if (sites.length === 0) {
    for (const m of robots.matchAll(/^\s*allow\s*:\s*(\/\S+)/gim)) add(m[1]);
  }
  return sites;
}

async function verifySite(host: string, tenant: string, site: string, deps: DiscoveryDeps): Promise<DiscoveredSite | null> {
  const url = `https://${host}/wday/cxs/${tenant}/${site}/jobs`;
  if (!(await deps.allowed(url))) return null;
  try {
    const body = (await deps.postJson(url, { appliedFacets: {}, limit: 1, offset: 0, searchText: '' })) as { total?: unknown };
    return typeof body?.total === 'number' ? { site, total: body.total } : null;
  } catch {
    return null;
  }
}

async function probeHost(host: string, c: WorkdayCandidate, deps: DiscoveryDeps): Promise<DiscoveredSite[]> {
  let robots: string;
  try {
    robots = await deps.fetchText(`https://${host}/robots.txt`);
  } catch {
    return [];
  }
  const found: DiscoveredSite[] = [];
  for (const site of parseWorkdaySites(robots, host)) {
    if (found.length >= MAX_SITES_PER_TENANT || deps.expired?.()) break;
    const ok = await verifySite(host, c.tenant, site, deps);
    if (ok) found.push(ok);
  }
  return found;
}

/** Discover one employer, reusing the previous run's answer where it can. */
export async function discoverTenant(c: WorkdayCandidate, deps: DiscoveryDeps): Promise<DiscoveryEntry> {
  const prev = deps.previous?.entries.find((e) => e.tenant === c.tenant);
  const base = { tenant: c.tenant, label: c.label };

  // A recent miss is not re-probed every hour.
  if (prev && prev.status !== 'found' && deps.now.getTime() - Date.parse(prev.checkedAt) < RETRY_MISSES_AFTER_MS) {
    return { ...prev, label: c.label };
  }
  const hosts = prev?.status === 'found' && prev.host ? [prev.host] : WORKDAY_SHARDS.map((s) => `${c.tenant}.${s}.myworkdayjobs.com`);
  for (const host of hosts) {
    // Running out of time is not a miss. A tenant found before keeps its sites
    // for this run; one never checked is retried next run rather than being
    // recorded as absent for a day.
    if (deps.expired?.()) {
      if (prev?.status === 'found') return { ...prev, label: c.label };
      return { ...base, status: 'error', host: null, sites: [], checkedAt: new Date(0).toISOString(), note: 'not checked: time ran out' };
    }
    const sites = await probeHost(host, c, deps);
    if (sites.length) return { ...base, status: 'found', host, sites, checkedAt: deps.now.toISOString() };
  }
  // A tenant found last time but silent now gets a full probe next time.
  return { ...base, status: 'not-found', host: null, sites: [], checkedAt: deps.now.toISOString() };
}
