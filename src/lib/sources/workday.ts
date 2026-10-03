import { config } from '@/lib/config';
import { fetchJson, fetchText, mapLimit, setHostDelay } from '@/lib/http';
import { isAllowed } from '@/lib/robots';
import { WORKDAY_DISCOVER, WORKDAY_TENANTS, type WorkdayEntry } from '@/lib/sources/companies';
import { discoverTenant, type DiscoveryReport } from '@/lib/sources/workday-discovery';
import { CYBER_QUERY_TERMS } from '@/lib/taxonomy/cyber';

/** "R260024652", "JREQ203319", "2617970" — an identifier, not a place. */
const REQUISITION_ID_RE = /^[A-Z]{0,6}[-_]?\d{4,}$/i;
import type { JobSource, SourceContext } from '@/lib/sources/types';
import { dedupeRaw } from '@/lib/sources/types';
import type { RawJob } from '@/lib/types';

interface WorkdayPosting {
  title?: string;
  externalPath?: string;
  locationsText?: string;
  postedOn?: string;
  startDate?: string;
  bulletFields?: string[];
}

interface WorkdaySearchResponse {
  total?: number;
  jobPostings?: WorkdayPosting[];
}

interface WorkdayDetail {
  jobPostingInfo?: {
    id?: string;
    title?: string;
    jobDescription?: string;
    location?: string;
    additionalLocations?: string[];
    postedOn?: string;
    startDate?: string;
    timeType?: string;
    jobRequisitionId?: string;
    externalUrl?: string;
    remoteType?: string;
  };
}

/** Workday reports "Posted Today" / "Posted 5 Days Ago" rather than a date. */
function postedOnToDate(value: string | undefined): string | null {
  if (!value) return null;
  const m = /(\d+)\+?\s*(day|month|hour)s?\s*ago/i.exec(value);
  if (m) {
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    const ms = unit === 'hour' ? 3_600_000 : unit === 'day' ? 86_400_000 : 30 * 86_400_000;
    return new Date(Date.now() - n * ms).toISOString();
  }
  if (/today/i.test(value)) return new Date().toISOString();
  if (/yesterday/i.test(value)) return new Date(Date.now() - 86_400_000).toISOString();
  const d = Date.parse(value);
  return Number.isNaN(d) ? null : new Date(d).toISOString();
}

/**
 * Kept deliberately short. Workday tenants are slow (one POST per page, per
 * term, per tenant) and in the first live run this source alone consumed 231s
 * of a 300s budget. The per-source deadline now caps it, but fewer terms means
 * the cap is less likely to truncate a tenant mid-way.
 */
const SEARCH_TERMS = ['security', 'cyber', 'risk'];

/** The latest run's discovery results, published by the build script. */
let lastDiscovery: DiscoveryReport | null = null;
export function getWorkdayDiscoveryReport(): DiscoveryReport | null {
  return lastDiscovery;
}

/** The previous run's discovery report, from beside the previous snapshot. */
async function loadPreviousDiscovery(): Promise<DiscoveryReport | null> {
  const snap = config.ingest.previousSnapshotUrl;
  if (!snap) return null;
  try {
    const url = snap.replace(/[^/]+$/, 'workday-discovery.json');
    return JSON.parse(await fetchText(url, { retries: 0, timeoutMs: 10_000 })) as DiscoveryReport;
  } catch {
    return null;
  }
}

/**
 * Curated tenants plus any sites discovered from robots.txt (see
 * workday-discovery.ts). Curated ones come first so they are crawled first if
 * the time budget runs short; a site already listed is never added twice.
 */
async function resolveTenants(ctx: SourceContext): Promise<WorkdayEntry[]> {
  const previous = await loadPreviousDiscovery();
  const now = new Date();
  // Discovery gets at most a third of this source's time; the rest is crawling.
  const discoveryEnds = Date.now() + Math.min(60_000, ctx.deadline.remaining / 3);
  const expired = () => ctx.deadline.expired || Date.now() > discoveryEnds;

  const entries = await mapLimit(WORKDAY_DISCOVER, 6, (c) =>
    discoverTenant(c, {
      now,
      previous,
      expired,
      fetchText: (url) => fetchText(url, { retries: 0, timeoutMs: 8_000 }),
      postJson: (url, body) =>
        fetchJson(url, {
          method: 'POST',
          retries: 0,
          timeoutMs: 15_000,
          headers: { Accept: 'application/json' },
          body: JSON.stringify(body),
        }),
      allowed: async (url) => (await isAllowed(url, false)).allowed,
    }),
  );
  lastDiscovery = { generatedAt: now.toISOString(), entries };

  const found = entries.filter((e) => e.status === 'found');
  ctx.log(
    `workday discovery: ${found.length}/${entries.length} employers found, ${found.reduce((n, e) => n + e.sites.length, 0)} sites`,
  );

  const key = (host: string, site: string) => `${host.toLowerCase()}/${site.toLowerCase()}`;
  const seen = new Set(WORKDAY_TENANTS.map((t) => key(t.host, t.site)));
  const extra: WorkdayEntry[] = [];
  for (const e of found) {
    for (const s of e.sites) {
      if (!e.host || seen.has(key(e.host, s.site)) || s.total === 0) continue;
      seen.add(key(e.host, s.site));
      extra.push({ label: e.label, host: e.host, tenant: e.tenant, site: s.site });
    }
  }
  return [...WORKDAY_TENANTS, ...extra];
}

export const workdaySource: JobSource = {
  id: 'workday',
  name: 'Workday career sites',
  access:
    "Each tenant's own careers page reads this unauthenticated JSON endpoint. We fetch and honour every tenant's robots.txt before requesting, and skip tenants that disallow it.",
  homepage: 'https://www.myworkdayjobs.com',
  isEnabled: () => true,
  // Discovery adds dozens of career sites; the default 90s cap was sized for
  // the 31 hand-listed ones.
  maxDurationMs: 200_000,
  async fetchJobs(ctx: SourceContext): Promise<RawJob[]> {
    const results: RawJob[] = [];
    let blocked = 0;
    const tenants = await resolveTenants(ctx);

    await mapLimit(tenants, 4, async (tenant) => {
      if (ctx.deadline.expired) return;
      const base = `https://${tenant.host}/wday/cxs/${tenant.tenant}/${tenant.site}`;
      const searchUrl = `${base}/jobs`;

      const verdict = await isAllowed(searchUrl, false);
      if (!verdict.allowed) {
        blocked += 1;
        ctx.log(`workday:${tenant.tenant} skipped — ${verdict.reason ?? 'robots.txt'}`);
        return;
      }
      setHostDelay(tenant.host, Math.max(1000, verdict.crawlDelayMs ?? 1000));

      const seen = new Set<string>();

      for (const term of SEARCH_TERMS) {
        if (ctx.deadline.expired) break;
        for (let offset = 0; offset < 40; offset += 20) {
          if (ctx.deadline.expired) break;
          let page: WorkdaySearchResponse;
          try {
            page = await fetchJson<WorkdaySearchResponse>(searchUrl, {
              method: 'POST',
              retries: 1,
              timeoutMs: 20_000,
              headers: { Accept: 'application/json' },
              body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText: term }),
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!/HTTP 40[0-9]/.test(msg)) ctx.log(`workday:${tenant.tenant} ${msg}`);
            break;
          }

          const postings = page.jobPostings ?? [];
          if (postings.length === 0) break;

          for (const p of postings) {
            if (!p.title || !p.externalPath) continue;
            if (seen.has(p.externalPath)) continue;
            seen.add(p.externalPath);

            const publicUrl = `https://${tenant.host}/${tenant.site}${p.externalPath}`;
            // bulletFields carry location metadata, not prose: typically
            // [city, region, requisition id]. Stored as the description they
            // published cards reading "R260024652".
            const bullets = (p.bulletFields ?? []).filter(Boolean);
            const bulletLocation = bullets.filter((b) => !REQUISITION_ID_RE.test(b)).join(', ');
            // Never fall back to the tenant hint. It is a rough note about where
            // an employer is based, and using it as the location published
            // Thomson Reuters roles in Bangalore, Manila and Zug as Toronto.
            const locationRaw = p.locationsText || bulletLocation || '';
            results.push({
              sourceJobId: `${tenant.tenant}:${p.externalPath}`,
              sourceId: 'workday',
              sourceName: `Workday · ${tenant.label}`,
              sourceUrl: publicUrl,
              applyUrl: publicUrl,
              title: p.title,
              company: tenant.label.replace(/\s*\(.*\)$/, ''),
              locationRaw,
              // Left empty on purpose; the detail pass below fills it with real
              // text, and an empty description beats a requisition number.
              description: '',
              descriptionIsHtml: false,
              postedAt: postedOnToDate(p.postedOn ?? p.startDate),
              remoteHint: /remote/i.test(locationRaw) || null,
              extra: { detailPath: `${base}${p.externalPath}` },
            });
          }

          if (postings.length < 20) break;
        }
      }
    });

    if (blocked) ctx.log(`workday: ${blocked}/${tenants.length} tenants disallow crawling`);

    // Fetch full descriptions. Every result already came back from a
    // security-term search, so the extra title filter only served to leave more
    // postings with no description at all. Likely-relevant titles are ordered
    // first so they win if the deadline bites.
    const looksRelevant = (r: { title: string }) =>
      CYBER_QUERY_TERMS.some((term) => r.title.toLowerCase().includes(term.split(' ')[0]));
    const targets = [...results]
      .sort((a, b) => Number(looksRelevant(b)) - Number(looksRelevant(a)))
      .slice(0, 120);

    await mapLimit(targets, 3, async (job) => {
      if (ctx.deadline.expired) return;
      const detailPath = job.extra?.detailPath;
      if (typeof detailPath !== 'string') return;
      try {
        const detail = await fetchJson<WorkdayDetail>(detailPath, { retries: 0, timeoutMs: 15_000 });
        const info = detail.jobPostingInfo;
        if (!info) return;
        if (info.jobDescription) {
          job.description = info.jobDescription;
          job.descriptionIsHtml = true;
        }
        if (info.location) {
          job.locationRaw = [info.location, ...(info.additionalLocations ?? [])].filter(Boolean).join(' / ');
        }
        job.postedAt = postedOnToDate(info.postedOn ?? info.startDate) ?? job.postedAt;
        job.employmentTypeRaw = info.timeType ?? job.employmentTypeRaw ?? null;
        if (info.remoteType) job.remoteHint = /remote/i.test(info.remoteType);
        if (info.externalUrl) job.applyUrl = info.externalUrl;
      } catch {
        /* description is best-effort */
      }
    });

    for (const r of results) delete r.extra;
    return dedupeRaw(results);
  },
};
