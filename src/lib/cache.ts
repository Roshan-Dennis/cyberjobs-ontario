import { config } from '@/lib/config';
import { runIngest } from '@/lib/ingest';
import { getStore } from '@/lib/store';
import type { Job } from '@/lib/types';

interface CacheEntry {
  jobs: Job[];
  lastIngestAt: string | null;
  loadedAt: number;
  notes: string[];
  degraded: boolean;
}

let entry: CacheEntry | null = null;
let inflight: Promise<CacheEntry> | null = null;
let bootstrapping: Promise<unknown> | null = null;

/**
 * Read-through cache in front of the store.
 *
 * When no database is configured and the store is empty, the first request
 * kicks off an ingestion run so a freshly cloned repo shows real data without
 * any setup. Subsequent requests are served from the cache and refreshed in
 * the background.
 */
export async function getJobs(force = false): Promise<CacheEntry> {
  const ttlMs = config.cache.searchTtl * 1000;
  if (!force && entry && Date.now() - entry.loadedAt < ttlMs) return entry;
  if (inflight) return inflight;

  inflight = (async (): Promise<CacheEntry> => {
    const store = getStore();
    const notes: string[] = [];
    let degraded = false;
    let jobs: Job[] = [];
    let lastIngestAt: string | null = null;

    try {
      jobs = await store.allJobs();
      lastIngestAt = (await store.getMeta()).lastIngestAt;
    } catch (err) {
      degraded = true;
      notes.push(`Storage unavailable: ${err instanceof Error ? err.message : String(err)}`);
    }

    const stale =
      lastIngestAt == null || Date.now() - Date.parse(lastIngestAt) > config.cache.memoryRefreshTtl * 1000;

    if (jobs.length === 0 || (store.kind === 'file' && stale)) {
      if (!bootstrapping) {
        notes.push(
          jobs.length === 0
            ? 'No jobs stored yet — fetching live postings now. Refresh in a few seconds.'
            : 'Refreshing postings in the background.',
        );
        bootstrapping = runIngest({ budgetMs: Math.min(config.ingest.maxDurationMs, 120_000) })
          .catch(() => undefined)
          .finally(() => {
            bootstrapping = null;
            entry = null;
          });
      } else {
        notes.push('A refresh is currently running.');
      }
      if (jobs.length === 0) degraded = true;
    }

    const next: CacheEntry = { jobs, lastIngestAt, loadedAt: Date.now(), notes, degraded };
    entry = next;
    return next;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

export function invalidateJobsCache(): void {
  entry = null;
}
