import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Job } from '@/lib/types';

/**
 * Server-side reader for the JSON snapshot that the publish workflow writes.
 *
 * Used at build time to prerender one page per job for the static export, so
 * every posting has a real, crawlable URL even though the deployed site has no
 * server behind it. Reads `data/jobs.full.json` (complete records) and falls
 * back to the trimmed client payload in `public/data/jobs.json`.
 */

export interface Snapshot {
  jobs: Job[];
  generatedAt: string | null;
}

let cache: Snapshot | null = null;

const CANDIDATES = [
  path.join(process.cwd(), 'data', 'jobs.full.json'),
  path.join(process.cwd(), 'public', 'data', 'jobs.json'),
  path.join(process.cwd(), 'data', 'jobs.json'),
];

export async function readSnapshot(): Promise<Snapshot> {
  if (cache) return cache;

  for (const file of CANDIDATES) {
    try {
      const parsed = JSON.parse(await fs.readFile(file, 'utf8')) as Record<string, unknown>;
      const jobs = (parsed.jobs ?? []) as Job[];
      if (!Array.isArray(jobs) || jobs.length === 0) continue;
      cache = { jobs, generatedAt: (parsed.generatedAt as string) ?? (parsed.meta as { lastIngestAt?: string })?.lastIngestAt ?? null };
      return cache;
    } catch {
      /* try the next candidate */
    }
  }

  cache = { jobs: [], generatedAt: null };
  return cache;
}

export async function findJob(id: string): Promise<Job | null> {
  const { jobs } = await readSnapshot();
  return jobs.find((j) => j.id === id) ?? null;
}
