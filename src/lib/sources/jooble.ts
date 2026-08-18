import { config } from '@/lib/config';
import { fetchJson } from '@/lib/http';
import { CYBER_QUERY_TERMS } from '@/lib/taxonomy/cyber';
import type { JobSource, SourceContext } from '@/lib/sources/types';
import { dedupeRaw } from '@/lib/sources/types';
import type { RawJob } from '@/lib/types';

interface JoobleJob {
  id?: number | string;
  title?: string;
  location?: string;
  snippet?: string;
  salary?: string;
  source?: string;
  type?: string;
  link?: string;
  company?: string;
  updated?: string;
}

interface JoobleResponse {
  totalCount?: number;
  jobs?: JoobleJob[];
}

/** Jooble's partner API — free key on request. */
export const joobleSource: JobSource = {
  id: 'jooble',
  name: 'Jooble',
  access: 'Official Jooble partner API. Requires JOOBLE_API_KEY (free on request).',
  homepage: 'https://jooble.org/api/about',
  isEnabled: () => config.jooble.enabled,
  disabledReason: () => 'Set JOOBLE_API_KEY to enable (free key at jooble.org/api/about).',
  async fetchJobs(ctx: SourceContext): Promise<RawJob[]> {
    const results: RawJob[] = [];
    const url = `https://ca.jooble.org/api/${config.jooble.apiKey}`;

    for (const term of CYBER_QUERY_TERMS.slice(0, 10)) {
      if (ctx.deadline.expired) break;
      for (let page = 1; page <= 2; page += 1) {
        if (ctx.deadline.expired) break;
        try {
          const data = await fetchJson<JoobleResponse>(url, {
            method: 'POST',
            retries: 1,
            body: JSON.stringify({ keywords: term, location: 'Ontario, Canada', page: String(page) }),
          });
          const rows = data.jobs ?? [];
          for (const j of rows) {
            if (!j.title || !j.link) continue;
            results.push({
              sourceJobId: String(j.id ?? j.link),
              sourceId: 'jooble',
              sourceName: `Jooble${j.source ? ` · ${j.source}` : ''}`,
              sourceUrl: j.link,
              applyUrl: j.link,
              title: j.title,
              company: j.company || 'Employer not disclosed',
              locationRaw: j.location ?? 'Ontario, Canada',
              description: j.snippet ?? '',
              descriptionIsHtml: true,
              postedAt: j.updated ?? null,
              salaryRaw: j.salary || null,
              employmentTypeRaw: j.type ?? null,
            });
          }
          if (rows.length === 0) break;
        } catch (err) {
          ctx.log(`jooble "${term}" p${page}: ${err instanceof Error ? err.message : String(err)}`);
          break;
        }
      }
    }

    return dedupeRaw(results);
  },
};
