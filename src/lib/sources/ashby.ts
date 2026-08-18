import { config } from '@/lib/config';
import { fetchJson, mapLimit } from '@/lib/http';
import { ASHBY_BOARDS, boardsWithExtras } from '@/lib/sources/companies';
import type { JobSource, SourceContext } from '@/lib/sources/types';
import { dedupeRaw } from '@/lib/sources/types';
import type { RawJob } from '@/lib/types';

interface AshbyJob {
  id: string;
  title: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  publishedAt?: string;
  isListed?: boolean;
  isRemote?: boolean;
  workplaceType?: string;
  address?: unknown;
  jobUrl?: string;
  applyUrl?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  compensation?: {
    compensationTierSummary?: string | null;
    summaryComponents?: { compensationType?: string; minValue?: number; maxValue?: number; currencyCode?: string; interval?: string }[];
  } | null;
}

interface AshbyResponse {
  jobs?: AshbyJob[];
}

function compensationToText(job: AshbyJob): string | null {
  const summary = job.compensation?.compensationTierSummary;
  if (summary) return summary;
  const salary = job.compensation?.summaryComponents?.find((c) => /salary/i.test(c.compensationType ?? ''));
  if (salary?.minValue) {
    const cur = salary.currencyCode ?? 'CAD';
    const per = salary.interval?.replace(/^1\s*/i, '').toLowerCase() ?? 'year';
    return salary.maxValue
      ? `${cur} ${salary.minValue} - ${salary.maxValue} per ${per}`
      : `${cur} ${salary.minValue} per ${per}`;
  }
  return null;
}

export const ashbySource: JobSource = {
  id: 'ashby',
  name: 'Ashby (company boards)',
  access: 'Public job-board API published by Ashby for career-site embedding. No key required.',
  homepage: 'https://www.ashbyhq.com',
  isEnabled: () => true,
  async fetchJobs(ctx: SourceContext): Promise<RawJob[]> {
    const boards = boardsWithExtras(ASHBY_BOARDS, config.ingest.extraAshby);
    const results: RawJob[] = [];
    let dead = 0;

    await mapLimit(boards, config.ingest.concurrency, async (board) => {
      if (ctx.deadline.expired) return;
      const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board.token)}?includeCompensation=true`;
      try {
        const data = await fetchJson<AshbyResponse>(url, { retries: 1 });
        for (const job of data.jobs ?? []) {
          if (!job?.title || job.isListed === false) continue;
          const url2 = job.jobUrl || job.applyUrl;
          if (!url2) continue;
          const locations = [job.location, ...(job.secondaryLocations ?? []).map((l) => l.location)]
            .filter(Boolean)
            .join(' / ');
          results.push({
            sourceJobId: `${board.token}:${job.id}`,
            sourceId: 'ashby',
            sourceName: `Ashby · ${board.label}`,
            sourceUrl: url2,
            applyUrl: job.applyUrl || url2,
            title: job.title,
            company: board.label,
            locationRaw: locations,
            description: job.descriptionHtml ?? job.descriptionPlain ?? '',
            descriptionIsHtml: Boolean(job.descriptionHtml),
            postedAt: job.publishedAt ?? null,
            employmentTypeRaw: job.employmentType ?? null,
            departmentRaw: [job.department, job.team].filter(Boolean).join(', ') || null,
            salaryRaw: compensationToText(job),
            remoteHint: job.isRemote ?? /remote/i.test(`${job.workplaceType ?? ''} ${locations}`) ?? null,
          });
        }
      } catch (err) {
        dead += 1;
        const msg = err instanceof Error ? err.message : String(err);
        if (!/HTTP 404/.test(msg)) ctx.log(`ashby:${board.token} ${msg}`);
      }
    });

    if (dead) ctx.log(`ashby: ${dead}/${boards.length} boards unavailable`);
    return dedupeRaw(results);
  },
};
