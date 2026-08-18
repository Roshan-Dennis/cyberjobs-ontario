import { config } from '@/lib/config';
import { fetchJson, mapLimit } from '@/lib/http';
import { WORKABLE_BOARDS, boardsWithExtras } from '@/lib/sources/companies';
import type { JobSource, SourceContext } from '@/lib/sources/types';
import { dedupeRaw } from '@/lib/sources/types';
import type { RawJob } from '@/lib/types';

interface WorkableJob {
  id?: string;
  shortcode?: string;
  title: string;
  description?: string;
  requirements?: string;
  benefits?: string;
  city?: string;
  state?: string;
  country?: string;
  location?: { city?: string; region?: string; country?: string; workplaceType?: string };
  telecommuting?: boolean;
  employment_type?: string;
  department?: string;
  published_on?: string;
  created_at?: string;
  application_url?: string;
  url?: string;
  shortlink?: string;
}

interface WorkableWidget {
  name?: string;
  description?: string;
  jobs?: WorkableJob[];
}

export const workableSource: JobSource = {
  id: 'workable',
  name: 'Workable (company boards)',
  access: 'Public careers-widget JSON published by Workable for embedding. No key required.',
  homepage: 'https://www.workable.com',
  isEnabled: () => true,
  async fetchJobs(ctx: SourceContext): Promise<RawJob[]> {
    const boards = boardsWithExtras(WORKABLE_BOARDS, config.ingest.extraWorkable);
    const results: RawJob[] = [];
    let dead = 0;

    await mapLimit(boards, config.ingest.concurrency, async (board) => {
      if (ctx.deadline.expired) return;
      const url = `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(board.token)}`;
      try {
        const data = await fetchJson<WorkableWidget>(url, { retries: 1 });
        for (const job of data.jobs ?? []) {
          const code = job.shortcode ?? job.id;
          const link = job.url ?? job.shortlink ?? job.application_url;
          if (!job?.title || !code || !link) continue;
          const loc = [job.city ?? job.location?.city, job.state ?? job.location?.region, job.country ?? job.location?.country]
            .filter(Boolean)
            .join(', ');
          results.push({
            sourceJobId: `${board.token}:${code}`,
            sourceId: 'workable',
            sourceName: `Workable · ${data.name || board.label}`,
            sourceUrl: link,
            applyUrl: job.application_url ?? link,
            title: job.title,
            company: data.name || board.label,
            locationRaw: loc,
            description: [job.description, job.requirements, job.benefits].filter(Boolean).join('\n'),
            descriptionIsHtml: true,
            postedAt: job.published_on ?? job.created_at ?? null,
            employmentTypeRaw: job.employment_type ?? null,
            departmentRaw: job.department ?? null,
            remoteHint: job.telecommuting ?? /remote/i.test(job.location?.workplaceType ?? '') ?? null,
          });
        }
      } catch (err) {
        dead += 1;
        const msg = err instanceof Error ? err.message : String(err);
        if (!/HTTP 404/.test(msg)) ctx.log(`workable:${board.token} ${msg}`);
      }
    });

    if (dead) ctx.log(`workable: ${dead}/${boards.length} boards unavailable`);
    return dedupeRaw(results);
  },
};
