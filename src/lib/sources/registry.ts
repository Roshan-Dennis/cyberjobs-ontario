import { config } from '@/lib/config';
import { adzunaSource } from '@/lib/sources/adzuna';
import { arbeitnowSource } from '@/lib/sources/arbeitnow';
import { ashbySource } from '@/lib/sources/ashby';
import { greenhouseSource } from '@/lib/sources/greenhouse';
import { jobBankSource } from '@/lib/sources/jobbank';
import { joobleSource } from '@/lib/sources/jooble';
import { leverSource } from '@/lib/sources/lever';
import { recruiteeSource } from '@/lib/sources/recruitee';
import { remotiveSource } from '@/lib/sources/remotive';
import { smartRecruitersSource } from '@/lib/sources/smartrecruiters';
import { workableSource } from '@/lib/sources/workable';
import { workdaySource } from '@/lib/sources/workday';
import type { JobSource } from '@/lib/sources/types';

export const ALL_SOURCES: JobSource[] = [
  greenhouseSource,
  leverSource,
  ashbySource,
  workableSource,
  recruiteeSource,
  workdaySource,
  jobBankSource,
  adzunaSource,
  joobleSource,
  arbeitnowSource,
  smartRecruitersSource,
  remotiveSource,
];

export function activeSources(): JobSource[] {
  const only = config.ingest.only.map((s) => s.toLowerCase());
  const disabled = new Set(config.ingest.disabled.map((s) => s.toLowerCase()));
  return ALL_SOURCES.filter((s) => {
    if (disabled.has(s.id)) return false;
    if (only.length > 0) return only.includes(s.id);
    return true;
  });
}

export function sourceById(id: string): JobSource | undefined {
  return ALL_SOURCES.find((s) => s.id === id);
}
