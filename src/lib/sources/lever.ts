import { config } from '@/lib/config';
import { fetchJson, mapLimit } from '@/lib/http';
import { LEVER_BOARDS, boardsWithExtras } from '@/lib/sources/companies';
import type { JobSource, SourceContext } from '@/lib/sources/types';
import { dedupeRaw } from '@/lib/sources/types';
import type { RawJob } from '@/lib/types';

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
  descriptionPlain?: string;
  description?: string;
  additional?: string;
  additionalPlain?: string;
  workplaceType?: string;
  country?: string;
  categories?: {
    commitment?: string | null;
    location?: string | null;
    team?: string | null;
    department?: string | null;
    allLocations?: string[] | null;
  } | null;
}

export const leverSource: JobSource = {
  id: 'lever',
  name: 'Lever (company boards)',
  access: 'Public postings API documented by Lever for career-site embedding. No key required.',
  homepage: 'https://www.lever.co',
  isEnabled: () => true,
  async fetchJobs(ctx: SourceContext): Promise<RawJob[]> {
    const boards = boardsWithExtras(LEVER_BOARDS, config.ingest.extraLever);
    const results: RawJob[] = [];
    let dead = 0;

    await mapLimit(boards, config.ingest.concurrency, async (board) => {
      if (ctx.deadline.expired) return;
      const url = `https://api.lever.co/v0/postings/${encodeURIComponent(board.token)}?mode=json`;
      try {
        const data = await fetchJson<LeverPosting[]>(url, { retries: 1 });
        if (!Array.isArray(data)) return;
        for (const p of data) {
          if (!p?.text || !p.hostedUrl) continue;
          const locations = [p.categories?.location, ...(p.categories?.allLocations ?? [])]
            .filter(Boolean)
            .join(' / ');
          const html = [p.description, p.additional].filter(Boolean).join('\n');
          results.push({
            sourceJobId: `${board.token}:${p.id}`,
            sourceId: 'lever',
            sourceName: `Lever · ${board.label}`,
            sourceUrl: p.hostedUrl,
            applyUrl: p.applyUrl || p.hostedUrl,
            title: p.text,
            company: board.label,
            locationRaw: locations || p.country || '',
            description: html || p.descriptionPlain || '',
            descriptionIsHtml: Boolean(html),
            postedAt: p.createdAt ?? null,
            employmentTypeRaw: p.categories?.commitment ?? null,
            departmentRaw: [p.categories?.team, p.categories?.department].filter(Boolean).join(', ') || null,
            remoteHint: /remote/i.test(`${p.workplaceType ?? ''} ${locations}`) || null,
          });
        }
      } catch (err) {
        dead += 1;
        const msg = err instanceof Error ? err.message : String(err);
        if (!/HTTP 404/.test(msg)) ctx.log(`lever:${board.token} ${msg}`);
      }
    });

    if (dead) ctx.log(`lever: ${dead}/${boards.length} boards unavailable`);
    return dedupeRaw(results);
  },
};
