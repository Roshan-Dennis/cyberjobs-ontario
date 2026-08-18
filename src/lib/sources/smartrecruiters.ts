import { config } from '@/lib/config';
import { fetchJson, mapLimit } from '@/lib/http';
import { SMARTRECRUITERS_BOARDS, boardsWithExtras } from '@/lib/sources/companies';
import type { JobSource, SourceContext } from '@/lib/sources/types';
import { dedupeRaw } from '@/lib/sources/types';
import type { RawJob } from '@/lib/types';

interface SRPosting {
  id: string;
  name: string;
  ref?: string;
  releasedDate?: string;
  location?: { city?: string; region?: string; country?: string; remote?: boolean };
  company?: { identifier?: string; name?: string };
  typeOfEmployment?: { label?: string };
  department?: { label?: string };
  customField?: { fieldLabel?: string; valueLabel?: string }[];
}

interface SRList {
  totalFound?: number;
  content?: SRPosting[];
}

interface SRDetail {
  jobAd?: { sections?: Record<string, { title?: string; text?: string }> };
  applyUrl?: string;
  postingUrl?: string;
}

/**
 * Disabled by default: api.smartrecruiters.com/robots.txt disallows crawling.
 * Enable only with ENABLE_SMARTRECRUITERS=true if you have permission.
 */
export const smartRecruitersSource: JobSource = {
  id: 'smartrecruiters',
  name: 'SmartRecruiters (company boards)',
  access: 'Opt-in only. SmartRecruiters robots.txt disallows automated access; enable only with permission.',
  homepage: 'https://www.smartrecruiters.com',
  isEnabled: () => config.optIn.smartrecruiters,
  disabledReason: () => 'Set ENABLE_SMARTRECRUITERS=true only if you have permission from SmartRecruiters.',
  async fetchJobs(ctx: SourceContext): Promise<RawJob[]> {
    const boards = boardsWithExtras(SMARTRECRUITERS_BOARDS, config.ingest.extraSmartRecruiters);
    const results: RawJob[] = [];

    await mapLimit(boards, 2, async (board) => {
      if (ctx.deadline.expired) return;
      try {
        const list = await fetchJson<SRList>(
          `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(board.token)}/postings?country=ca&limit=100`,
          { retries: 1 },
        );
        for (const p of list.content ?? []) {
          if (!p?.name) continue;
          const detailUrl = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(board.token)}/postings/${p.id}`;
          let description = '';
          let applyUrl = `https://jobs.smartrecruiters.com/${board.token}/${p.id}`;
          try {
            const detail = await fetchJson<SRDetail>(detailUrl, { retries: 0, timeoutMs: 12_000 });
            description = Object.values(detail.jobAd?.sections ?? {})
              .map((s) => `<h3>${s?.title ?? ''}</h3>${s?.text ?? ''}`)
              .join('\n');
            applyUrl = detail.applyUrl ?? detail.postingUrl ?? applyUrl;
          } catch {
            /* detail is best-effort */
          }
          results.push({
            sourceJobId: `${board.token}:${p.id}`,
            sourceId: 'smartrecruiters',
            sourceName: `SmartRecruiters · ${p.company?.name ?? board.label}`,
            sourceUrl: applyUrl,
            applyUrl,
            title: p.name,
            company: p.company?.name ?? board.label,
            locationRaw: [p.location?.city, p.location?.region, p.location?.country].filter(Boolean).join(', '),
            description,
            descriptionIsHtml: true,
            postedAt: p.releasedDate ?? null,
            employmentTypeRaw: p.typeOfEmployment?.label ?? null,
            departmentRaw: p.department?.label ?? null,
            remoteHint: p.location?.remote ?? null,
          });
        }
      } catch (err) {
        ctx.log(`smartrecruiters:${board.token} ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    return dedupeRaw(results);
  },
};
