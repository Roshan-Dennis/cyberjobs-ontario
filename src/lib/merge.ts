import { classify } from '@/lib/normalize/relevance';
import { matchLocation, regionForCity } from '@/lib/taxonomy/canada';
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

/**
 * Re-check carried-forward postings against the current rules.
 *
 * Carry-forward has a sharp edge: a posting admitted under yesterday's rules
 * keeps its place for the whole retention window, so a classification fix does
 * not reach the postings already published. That is how "London, UK" survived
 * the geo fix — the records came from the previous snapshot, not from the
 * connectors, so nothing re-examined them.
 *
 * Re-running the geo match on the stored `locationRaw` heals those records in
 * place: the fix applies on the next run instead of waiting out expiry.
 *
 * The same argument applies to relevance, and it bit twice: tightening the
 * guard-title rule would not have removed the "security officer" postings
 * already on the board. So the classifier runs again here too.
 */
export function revalidate(jobs: Job[]): { jobs: Job[]; dropped: number } {
  const kept: Job[] = [];
  let dropped = 0;
  for (const job of jobs) {
    const geo = matchLocation(job.locationRaw);
    // Same gate the ingest applies: in Ontario, or genuinely remote-Canada, and
    // never a location field that names somewhere outside Canada.
    const remoteCanada = job.workArrangement === 'remote' && geo.isCanada;
    if (geo.isForeign || !(geo.isInScope || remoteCanada)) {
      dropped += 1;
      continue;
    }

    // Relevance is re-judged as well, so a classifier fix reaches the postings
    // already published rather than only the next batch.
    if (classify(job.titleRaw || job.title, job.description ?? '').rejected) {
      dropped += 1;
      continue;
    }
    // Heal city/region too, so a gazetteer correction shows up immediately.
    kept.push(
      geo.city === job.city && geo.region === job.region && geo.province === job.province
        ? job
        : {
            ...job,
            city: geo.city,
            region: geo.region ?? regionForCity(geo.city),
            province: geo.province,
            provinceName: geo.provinceName,
            isOntario: geo.isOntario,
            isCanada: geo.isCanada,
          },
    );
  }
  return { jobs: kept, dropped };
}

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
  /** Records folded into another because they shared a fingerprint. */
  collapsed: number;
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
    // …with one exception. Some sources only carry a description on a separate
    // page, fetched a few at a time under a crawl delay, so a posting arrives
    // bare on most runs and enriched on one. Letting the bare record win would
    // throw that away every hour and the description would never stick.
    const keepText = Boolean(before?.description) && !job.description;
    out.push({
      ...job,
      description: keepText ? before!.description : job.description,
      descriptionHtml: keepText ? before!.descriptionHtml : job.descriptionHtml,
      summary: keepText ? before!.summary : job.summary,
      requirements: keepText ? before!.requirements : job.requirements,
      // Seniority is read out of the description, so it travels with it.
      experienceLevel:
        keepText && job.experienceLevel === 'unknown' ? before!.experienceLevel : job.experienceLevel,
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

  const { jobs, collapsed } = collapseDuplicates(out);
  return { jobs, added, refreshed, carried, newlyExpired, dropped, collapsed };
}

/**
 * Collapse records that describe the same posting.
 *
 * Deduplication runs inside a single ingest, but the merge keys on `id`, and an
 * id is not as stable as it looks: a source can renumber a posting, and Job
 * Bank issues a fresh job number when an employer reposts. The board then shows
 * the same role twice — once from today's run, once carried forward from the
 * older id — which is exactly what deduplication is supposed to prevent.
 *
 * The fingerprint (normalised title + employer + location) is the stable
 * identity, so the merged set is collapsed on it. The most recently seen record
 * wins, keeps the earliest discovery date in the group, and reports how many
 * distinct sources the role was seen on.
 */
function collapseDuplicates(jobs: Job[]): { jobs: Job[]; collapsed: number } {
  const groups = new Map<string, Job[]>();
  const noFingerprint: Job[] = [];
  for (const job of jobs) {
    if (!job.fingerprint) {
      noFingerprint.push(job);
      continue;
    }
    const list = groups.get(job.fingerprint);
    if (list) list.push(job);
    else groups.set(job.fingerprint, [job]);
  }

  const out: Job[] = [...noFingerprint];
  let collapsed = 0;

  for (const group of groups.values()) {
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    collapsed += group.length - 1;

    // Prefer the live record over an expired one, then the most recently seen.
    const winner = [...group].sort((a, b) => {
      if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;
      return Date.parse(b.lastSeenAt ?? '') - Date.parse(a.lastSeenAt ?? '');
    })[0];

    const earliest = group
      .map((j) => j.firstSeenAt)
      .filter(Boolean)
      .sort()[0];
    const sources = new Set(group.map((j) => j.sourceId).filter(Boolean));

    out.push({
      ...winner,
      firstSeenAt: earliest ?? winner.firstSeenAt,
      duplicateCount: Math.max(winner.duplicateCount ?? 1, sources.size),
    });
  }

  return { jobs: out, collapsed };
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
