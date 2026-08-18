import { config } from '@/lib/config';
import { fetchJson } from '@/lib/http';
import type { JobSource, SourceContext } from '@/lib/sources/types';
import { dedupeRaw } from '@/lib/sources/types';
import type { RawJob } from '@/lib/types';

interface RemotiveJob {
  id: number;
  url?: string;
  title?: string;
  company_name?: string;
  category?: string;
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

interface RemotiveResponse {
  jobs?: RemotiveJob[];
}

/**
 * Disabled by default: remotive.com/robots.txt disallows automated access at
 * the time of writing. Enable only if that changes or you have permission.
 */
export const remotiveSource: JobSource = {
  id: 'remotive',
  name: 'Remotive',
  access: 'Opt-in only. Remotive robots.txt currently disallows automated access.',
  homepage: 'https://remotive.com/api-documentation',
  isEnabled: () => config.optIn.remotive,
  disabledReason: () => 'Set ENABLE_REMOTIVE=true only if permitted.',
  async fetchJobs(ctx: SourceContext): Promise<RawJob[]> {
    const results: RawJob[] = [];
    for (const search of ['security', 'cybersecurity', 'devsecops']) {
      if (ctx.deadline.expired) break;
      try {
        const data = await fetchJson<RemotiveResponse>(
          `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(search)}&limit=100`,
          { retries: 1 },
        );
        for (const j of data.jobs ?? []) {
          if (!j.title || !j.url) continue;
          results.push({
            sourceJobId: String(j.id),
            sourceId: 'remotive',
            sourceName: 'Remotive',
            sourceUrl: j.url,
            applyUrl: j.url,
            title: j.title,
            company: j.company_name ?? 'Employer not disclosed',
            locationRaw: j.candidate_required_location ?? 'Remote',
            description: j.description ?? '',
            descriptionIsHtml: true,
            postedAt: j.publication_date ?? null,
            employmentTypeRaw: j.job_type ?? null,
            salaryRaw: j.salary || null,
            departmentRaw: j.category ?? null,
            remoteHint: true,
          });
        }
      } catch (err) {
        ctx.log(`remotive "${search}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return dedupeRaw(results);
  },
};
