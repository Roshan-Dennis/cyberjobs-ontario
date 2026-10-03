/**
 * Pure decision logic for the continuous audit (scripts/audit.ts). Kept
 * separate from the script so it can be unit tested without a network: the
 * script does the fetching, this module decides what to do with the results.
 */
import type { Job } from '@/lib/types';

export interface LinkCheck {
  checkedAt: string;
  status: 'live' | 'dead' | 'inconclusive';
  httpStatus?: number;
}

export interface LinkAuditReport {
  generatedAt: string;
  /** job id -> last check. */
  checks: Record<string, LinkCheck>;
}

/**
 * Jobs ordered oldest-checked first, so link checks rotate through the whole
 * board across runs instead of always landing on the same early ids. A job
 * never checked before (no entry in `checks`) sorts first of all.
 */
export function orderByLastChecked(jobs: Job[], checks: Record<string, LinkCheck>): Job[] {
  return [...jobs].sort((a, b) => {
    const at = Date.parse(checks[a.id]?.checkedAt ?? '') || 0;
    const bt = Date.parse(checks[b.id]?.checkedAt ?? '') || 0;
    return at - bt;
  });
}

/** Mark every job whose link this run confirmed dead as expired. Nothing else about the job changes. */
export function applyDeadLinks(jobs: Job[], checks: Record<string, LinkCheck>): Job[] {
  return jobs.map((j) => (checks[j.id]?.status === 'dead' ? { ...j, isExpired: true } : j));
}

/** Drop audit entries for ids no longer on the board, so the file does not grow forever. */
export function pruneAuditChecks(checks: Record<string, LinkCheck>, liveIds: Set<string>): Record<string, LinkCheck> {
  const out: Record<string, LinkCheck> = {};
  for (const [id, check] of Object.entries(checks)) if (liveIds.has(id)) out[id] = check;
  return out;
}
