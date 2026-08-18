import { fetchJson } from '@/lib/http';
import type { JobSource, SourceContext } from '@/lib/sources/types';
import { dedupeRaw } from '@/lib/sources/types';
import type { RawJob } from '@/lib/types';

interface ArbeitnowJob {
  slug: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
}

interface ArbeitnowResponse {
  data?: ArbeitnowJob[];
  links?: { next?: string | null };
}

/** Free, openly documented job-board API. Mostly EU but includes remote roles. */
export const arbeitnowSource: JobSource = {
  id: 'arbeitnow',
  name: 'Arbeitnow',
  access: 'Free public job-board API, no key required.',
  homepage: 'https://www.arbeitnow.com/api',
  isEnabled: () => true,
  async fetchJobs(ctx: SourceContext): Promise<RawJob[]> {
    const results: RawJob[] = [];
    let url: string | null | undefined = 'https://www.arbeitnow.com/api/job-board-api';

    for (let page = 0; page < 3 && url; page += 1) {
      if (ctx.deadline.expired) break;
      try {
        const data: ArbeitnowResponse = await fetchJson<ArbeitnowResponse>(url, { retries: 1 });
        for (const j of data.data ?? []) {
          if (!j.title || !j.slug) continue;
          results.push({
            sourceJobId: j.slug,
            sourceId: 'arbeitnow',
            sourceName: 'Arbeitnow',
            sourceUrl: `https://www.arbeitnow.com/view/${j.slug}`,
            applyUrl: j.url || `https://www.arbeitnow.com/view/${j.slug}`,
            title: j.title,
            company: j.company_name ?? 'Employer not disclosed',
            locationRaw: j.location ?? (j.remote ? 'Remote' : ''),
            description: j.description ?? '',
            descriptionIsHtml: true,
            postedAt: j.created_at ?? null,
            employmentTypeRaw: (j.job_types ?? []).join(', '),
            remoteHint: j.remote ?? null,
            departmentRaw: (j.tags ?? []).join(', '),
          });
        }
        url = data.links?.next ?? null;
      } catch (err) {
        ctx.log(`arbeitnow: ${err instanceof Error ? err.message : String(err)}`);
        break;
      }
    }

    return dedupeRaw(results);
  },
};
