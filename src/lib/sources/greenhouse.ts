import { config } from '@/lib/config';
import { fetchJson, mapLimit } from '@/lib/http';
import { GREENHOUSE_BOARDS, boardsWithExtras } from '@/lib/sources/companies';
import type { JobSource, SourceContext } from '@/lib/sources/types';
import { dedupeRaw } from '@/lib/sources/types';
import type { RawJob } from '@/lib/types';

interface GreenhouseJob {
  id: number;
  internal_job_id?: number;
  title: string;
  updated_at?: string;
  first_published?: string;
  absolute_url: string;
  location?: { name?: string } | null;
  content?: string;
  company_name?: string;
  departments?: { name?: string }[];
  offices?: { name?: string; location?: string }[];
  metadata?: { name?: string; value?: unknown }[];
}

interface GreenhouseResponse {
  jobs?: GreenhouseJob[];
}

const BASE = 'https://boards-api.greenhouse.io/v1/boards';

export const greenhouseSource: JobSource = {
  id: 'greenhouse',
  name: 'Greenhouse (company boards)',
  access: 'Public JSON board API published by Greenhouse for embedding careers pages. No key required.',
  homepage: 'https://boards.greenhouse.io',
  isEnabled: () => true,
  async fetchJobs(ctx: SourceContext): Promise<RawJob[]> {
    const boards = boardsWithExtras(GREENHOUSE_BOARDS, config.ingest.extraGreenhouse);
    const results: RawJob[] = [];
    let dead = 0;

    await mapLimit(boards, config.ingest.concurrency, async (board) => {
      if (ctx.deadline.expired) return;
      const url = `${BASE}/${encodeURIComponent(board.token)}/jobs?content=true`;
      try {
        const data = await fetchJson<GreenhouseResponse>(url, { retries: 1, timeoutMs: 20_000 });
        for (const job of data.jobs ?? []) {
          if (!job?.title || !job.absolute_url) continue;
          const location =
            job.location?.name ??
            job.offices?.map((o) => o.name ?? o.location).filter(Boolean).join(' / ') ??
            '';
          results.push({
            sourceJobId: `${board.token}:${job.id}`,
            sourceId: 'greenhouse',
            sourceName: `Greenhouse · ${board.label}`,
            sourceUrl: job.absolute_url,
            applyUrl: job.absolute_url,
            title: job.title,
            company: job.company_name || board.label,
            locationRaw: location,
            description: job.content ?? '',
            descriptionIsHtml: true,
            postedAt: job.first_published ?? job.updated_at ?? null,
            departmentRaw: job.departments?.map((d) => d.name).filter(Boolean).join(', ') ?? null,
            remoteHint: /remote/i.test(location) || null,
          });
        }
      } catch (err) {
        dead += 1;
        const msg = err instanceof Error ? err.message : String(err);
        if (!/HTTP 404/.test(msg)) ctx.log(`greenhouse:${board.token} ${msg}`);
      }
    });

    if (dead) ctx.log(`greenhouse: ${dead}/${boards.length} boards unavailable`);
    return dedupeRaw(results);
  },
};
