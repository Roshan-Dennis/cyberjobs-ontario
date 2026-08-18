import { config } from '@/lib/config';
import { fetchJson, mapLimit, setHostDelay } from '@/lib/http';
import { isAllowed } from '@/lib/robots';
import { WORKDAY_TENANTS } from '@/lib/sources/companies';
import { CYBER_QUERY_TERMS } from '@/lib/taxonomy/cyber';
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

const SEARCH_TERMS = ['security', 'cyber', 'information security', 'risk', 'identity'];

export const workdaySource: JobSource = {
  id: 'workday',
  name: 'Workday career sites',
  access:
    "Each tenant's own careers page reads this unauthenticated JSON endpoint. We fetch and honour every tenant's robots.txt before requesting, and skip tenants that disallow it.",
  homepage: 'https://www.myworkdayjobs.com',
  isEnabled: () => true,
  async fetchJobs(ctx: SourceContext): Promise<RawJob[]> {
    const results: RawJob[] = [];
    let blocked = 0;

    await mapLimit(WORKDAY_TENANTS, 3, async (tenant) => {
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
        for (let offset = 0; offset < 60; offset += 20) {
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
            results.push({
              sourceJobId: `${tenant.tenant}:${p.externalPath}`,
              sourceId: 'workday',
              sourceName: `Workday · ${tenant.label}`,
              sourceUrl: publicUrl,
              applyUrl: publicUrl,
              title: p.title,
              company: tenant.label.replace(/\s*\(.*\)$/, ''),
              locationRaw: p.locationsText ?? tenant.hint ?? '',
              description: (p.bulletFields ?? []).join(' · '),
              descriptionIsHtml: false,
              postedAt: postedOnToDate(p.postedOn ?? p.startDate),
              remoteHint: /remote/i.test(p.locationsText ?? '') || null,
              extra: { detailPath: `${base}${p.externalPath}` },
            });
          }

          if (postings.length < 20) break;
        }
      }
    });

    if (blocked) ctx.log(`workday: ${blocked}/${WORKDAY_TENANTS.length} tenants disallow crawling`);

    // Fetch full descriptions for the postings that look security-relevant.
    const interesting = results.filter((r) =>
      CYBER_QUERY_TERMS.some((term) => r.title.toLowerCase().includes(term.split(' ')[0])),
    );
    const targets = interesting.slice(0, 150);

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
