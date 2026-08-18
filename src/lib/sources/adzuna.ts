import { config } from '@/lib/config';
import { fetchJson } from '@/lib/http';
import { CYBER_QUERY_TERMS } from '@/lib/taxonomy/cyber';
import type { JobSource, SourceContext } from '@/lib/sources/types';
import { dedupeRaw } from '@/lib/sources/types';
import type { RawJob } from '@/lib/types';

interface AdzunaJob {
  id: string;
  title?: string;
  description?: string;
  created?: string;
  redirect_url?: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
  contract_time?: string;
  contract_type?: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  category?: { label?: string };
}

interface AdzunaResponse {
  count?: number;
  results?: AdzunaJob[];
}

const BASE = 'https://api.adzuna.com/v1/api/jobs/ca/search';

/**
 * Adzuna publishes a documented, licensed job search API with a free
 * developer tier. Adzuna aggregates many boards including some that do not
 * offer direct access, so this is the compliant way to widen coverage.
 */
export const adzunaSource: JobSource = {
  id: 'adzuna',
  name: 'Adzuna Canada',
  access: 'Official Adzuna developer API (free tier). Requires ADZUNA_APP_ID and ADZUNA_APP_KEY.',
  homepage: 'https://developer.adzuna.com',
  isEnabled: () => config.adzuna.enabled,
  disabledReason: () => 'Set ADZUNA_APP_ID and ADZUNA_APP_KEY (free at developer.adzuna.com).',
  async fetchJobs(ctx: SourceContext): Promise<RawJob[]> {
    const results: RawJob[] = [];
    const terms = CYBER_QUERY_TERMS.slice(0, 12);

    for (const term of terms) {
      if (ctx.deadline.expired) break;
      for (let page = 1; page <= config.adzuna.maxPages; page += 1) {
        if (ctx.deadline.expired) break;
        const params = new URLSearchParams({
          app_id: config.adzuna.appId,
          app_key: config.adzuna.appKey,
          results_per_page: '50',
          what_phrase: term,
          where: 'Ontario',
          max_days_old: '45',
          content_type: 'application/json',
          sort_by: 'date',
        });
        try {
          const data = await fetchJson<AdzunaResponse>(`${BASE}/${page}?${params.toString()}`, { retries: 1 });
          const rows = data.results ?? [];
          for (const j of rows) {
            if (!j.title || !j.redirect_url) continue;
            const predicted = j.salary_is_predicted === '1';
            const salaryRaw =
              !predicted && j.salary_min
                ? `$${Math.round(j.salary_min)}${j.salary_max ? ` - $${Math.round(j.salary_max)}` : ''} per year`
                : null;
            results.push({
              sourceJobId: String(j.id),
              sourceId: 'adzuna',
              sourceName: 'Adzuna',
              sourceUrl: j.redirect_url,
              applyUrl: j.redirect_url,
              title: j.title.replace(/<\/?[^>]+>/g, ''),
              company: j.company?.display_name ?? 'Employer not disclosed',
              locationRaw: j.location?.display_name ?? (j.location?.area ?? []).join(', '),
              description: j.description ?? '',
              descriptionIsHtml: false,
              postedAt: j.created ?? null,
              employmentTypeRaw: [j.contract_time, j.contract_type].filter(Boolean).join(' '),
              salaryRaw,
              departmentRaw: j.category?.label ?? null,
            });
          }
          if (rows.length < 50) break;
        } catch (err) {
          ctx.log(`adzuna "${term}" p${page}: ${err instanceof Error ? err.message : String(err)}`);
          break;
        }
      }
    }

    return dedupeRaw(results);
  },
};
