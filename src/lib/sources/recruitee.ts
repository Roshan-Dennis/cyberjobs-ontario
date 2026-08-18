import { config } from '@/lib/config';
import { fetchJson, mapLimit } from '@/lib/http';
import { RECRUITEE_BOARDS, boardsWithExtras } from '@/lib/sources/companies';
import type { JobSource, SourceContext } from '@/lib/sources/types';
import { dedupeRaw } from '@/lib/sources/types';
import type { RawJob } from '@/lib/types';

interface RecruiteeOffer {
  id: number;
  slug?: string;
  title: string;
  description?: string;
  requirements?: string;
  city?: string;
  state_name?: string;
  country_code?: string;
  location?: string;
  remote?: boolean;
  employment_type_code?: string;
  department?: string;
  published_at?: string;
  created_at?: string;
  careers_url?: string;
  careers_apply_url?: string;
}

interface RecruiteeResponse {
  offers?: RecruiteeOffer[];
}

export const recruiteeSource: JobSource = {
  id: 'recruitee',
  name: 'Recruitee (company boards)',
  access: 'Public offers API published by Recruitee for career-site embedding. No key required.',
  homepage: 'https://recruitee.com',
  isEnabled: () => true,
  async fetchJobs(ctx: SourceContext): Promise<RawJob[]> {
    const boards = boardsWithExtras(RECRUITEE_BOARDS, config.ingest.extraRecruitee);
    const results: RawJob[] = [];

    await mapLimit(boards, config.ingest.concurrency, async (board) => {
      if (ctx.deadline.expired) return;
      const url = `https://${encodeURIComponent(board.token)}.recruitee.com/api/offers/`;
      try {
        const data = await fetchJson<RecruiteeResponse>(url, { retries: 1 });
        for (const o of data.offers ?? []) {
          const link = o.careers_url ?? o.careers_apply_url;
          if (!o?.title || !link) continue;
          results.push({
            sourceJobId: `${board.token}:${o.id}`,
            sourceId: 'recruitee',
            sourceName: `Recruitee · ${board.label}`,
            sourceUrl: link,
            applyUrl: o.careers_apply_url ?? link,
            title: o.title,
            company: board.label,
            locationRaw: o.location ?? [o.city, o.state_name, o.country_code].filter(Boolean).join(', '),
            description: [o.description, o.requirements].filter(Boolean).join('\n'),
            descriptionIsHtml: true,
            postedAt: o.published_at ?? o.created_at ?? null,
            employmentTypeRaw: o.employment_type_code ?? null,
            departmentRaw: o.department ?? null,
            remoteHint: o.remote ?? null,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!/HTTP 404/.test(msg)) ctx.log(`recruitee:${board.token} ${msg}`);
      }
    });

    return dedupeRaw(results);
  },
};
