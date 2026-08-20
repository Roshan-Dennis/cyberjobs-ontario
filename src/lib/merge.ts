import type { Job } from '@/lib/types';

/**
 * Carry postings forward between publishes.
 *
 * The site has no database: each run rebuilds from whatever the connectors
 * return right then. That makes a bad run visible to users — Greenhouse alone
 * is half the dataset, so one timeout would halve the site for an hour.
 *
 * The fix needs no new infrastructure, because the previously published JSON is
 * itself the state. Each run fetches its own last output, merges the fresh
 * results over it, and republishes. Retention then becomes an explicit choice
 * ("keep everything seen in the last N days") instead of an accident of how far
 * back each source's feed happens to reach.
 */

export interface MergeOptions {
  /** Drop a posting this many days after the last time a source returned it. */
  retentionDays: number;
  /**
   * Mark a posting expired once no source has returned it for this many days.
   * Shorter than retention on purpose: a vanished posting is probably filled,
   * so it should grey out quickly but stay searchable for a while.
   */
  staleDays: number;
  now?: Date;
}

export interface MergeResult {
  jobs: Job[];
  /** Seen this run and not in the previous snapshot. */
  added: number;
  /** Seen this run and already known. */
  refreshed: number;
  /** Not seen this run, kept because they are inside the retention window. */
  carried: number;
  /** Carried forward and newly marked expired. */
  newlyExpired: number;
  /** Outside the retention window, dropped entirely. */
  dropped: number;
}

const DAY_MS = 86_400_000;

function ageDays(iso: string | null | undefined, now: number): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? (now - t) / DAY_MS : Number.POSITIVE_INFINITY;
}

/**
 * @param previous the last published snapshot (empty array on the first run)
 * @param current  what the connectors returned this run
 */
export function mergeSnapshots(previous: Job[], current: Job[], options: MergeOptions): MergeResult {
  const now = (options.now ?? new Date()).getTime();
  const nowIso = new Date(now).toISOString();

  const prior = new Map<string, Job>();
  for (const job of previous) {
    if (job?.id) prior.set(job.id, job);
  }

  const out: Job[] = [];
  let added = 0;
  let refreshed = 0;

  // Everything seen this run wins: fresher description, salary, ranking.
  for (const job of current) {
    const before = prior.get(job.id);
    out.push({
      ...job,
      // Preserve original discovery time so "new today" stays meaningful.
      firstSeenAt: before?.firstSeenAt ?? job.firstSeenAt ?? nowIso,
      lastSeenAt: nowIso,
      // A posting that reappears after being marked expired is live again.
      isExpired: job.isExpired,
      isRepost: job.isRepost || (before?.isRepost ?? false),
      repostOf: job.repostOf ?? before?.repostOf ?? null,
    });
    if (before) refreshed += 1;
    else added += 1;
    prior.delete(job.id);
  }

  // Whatever is left was not returned this run.
  let carried = 0;
  let newlyExpired = 0;
  let dropped = 0;

  for (const job of prior.values()) {
    const unseenFor = ageDays(job.lastSeenAt, now);

    if (unseenFor > options.retentionDays) {
      dropped += 1;
      continue;
    }

    const shouldExpire = unseenFor > options.staleDays;
    if (shouldExpire && !job.isExpired) newlyExpired += 1;

    out.push({ ...job, isExpired: job.isExpired || shouldExpire });
    carried += 1;
  }

  return { jobs: out, added, refreshed, carried, newlyExpired, dropped };
}

/**
 * Guard against publishing a snapshot that is drastically worse than the last
 * one. A merge already protects against a source returning nothing, but not
 * against a bug that mangles the data — this is the second line of defence.
 *
 * Returns null when the result looks sane, or a reason to abort.
 */
export function sanityCheck(previousCount: number, mergedCount: number): string | null {
  if (mergedCount === 0) return 'merged snapshot is empty';
  if (previousCount >= 20 && mergedCount < previousCount * 0.5) {
    return `merged snapshot has ${mergedCount} postings, down from ${previousCount} — more than half vanished`;
  }
  return null;
}
