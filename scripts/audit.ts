/**
 * The continuous audit: a second, independent pipeline from the hourly
 * collector in build-data.ts.
 *
 *   npm run audit            # check a rotating batch of live postings
 *   npm run audit -- --budget 360000 --max 250
 *
 * It does two things the collector doesn't:
 *
 *   1. Confirms the apply link is still real. The collector trusts whatever a
 *      source returns; this script actually requests each posting's apply URL
 *      and marks it expired when the employer's own site says 404/410 — a
 *      closed requisition, not a guess from an age threshold.
 *   2. Re-runs relevance and geography on every live posting (the same
 *      revalidate() the collector already applies to carried-forward records),
 *      so a rule fix reaches the board well before the next time each posting
 *      happens to be re-collected.
 *
 * It owns no data of its own: it fetches the live snapshot, the same way the
 * next hourly run would, so it never disagrees with what the board actually
 * shows. Checking every posting every run would blow the time budget once the
 * board is a few hundred postings, so link checks rotate through the board —
 * each run picks the postings checked longest ago (or never), tracked in
 * link-audit.json, which is published and read back like the snapshot itself.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from '../src/lib/config';
import { revalidate } from '../src/lib/merge';
import { isAllowed } from '../src/lib/robots';
import { fetchWithRetry, withHostLimit, mapLimit, HttpError } from '../src/lib/http';
import { applyDeadLinks, orderByLastChecked, pruneAuditChecks, type LinkAuditReport, type LinkCheck } from '../src/lib/audit';
import type { Job } from '../src/lib/types';

const CLIENT_DESCRIPTION_CHARS = 1200;
const DEFAULT_BUDGET_MS = 360_000;
const DEFAULT_MAX_CHECKS = 250;
const CONCURRENCY = 8;

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) return process.argv[idx + 1];
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
}

function trimForClient(job: Job): Job {
  return { ...job, description: job.description.slice(0, CLIENT_DESCRIPTION_CHARS), descriptionHtml: null };
}

async function fetchJsonOrEmpty<T>(url: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Does this posting's own apply link still work? Tries HEAD first (cheaper —
 * no body downloaded); a 405 from a site that doesn't support HEAD falls back
 * to GET. 404/410 is treated as confirmed dead. Everything else (403 from a
 * bot wall, a timeout, DNS trouble) is left alone: those happen to perfectly
 * live postings too, and this project's whole discipline is not to guess.
 */
async function checkLink(url: string): Promise<LinkCheck> {
  const now = new Date().toISOString();
  let allowed: boolean;
  try {
    allowed = (await isAllowed(url, true)).allowed;
  } catch {
    allowed = true;
  }
  if (!allowed) return { checkedAt: now, status: 'inconclusive' };

  const attempt = async (method: 'HEAD' | 'GET'): Promise<Response> =>
    withHostLimit(url, () => fetchWithRetry(url, { method, retries: 1, timeoutMs: 15_000, softFailStatuses: [405] }));

  try {
    let res = await attempt('HEAD');
    if (res.status === 405) res = await attempt('GET');
    return { checkedAt: now, status: 'live', httpStatus: res.status };
  } catch (err) {
    if (err instanceof HttpError && (err.status === 404 || err.status === 410)) {
      return { checkedAt: now, status: 'dead', httpStatus: err.status };
    }
    return { checkedAt: now, status: 'inconclusive', httpStatus: err instanceof HttpError ? err.status : undefined };
  }
}

async function main(): Promise<void> {
  const budgetMs = Number.parseInt(arg('budget') ?? '', 10) || DEFAULT_BUDGET_MS;
  const maxChecks = Number.parseInt(arg('max') ?? '', 10) || DEFAULT_MAX_CHECKS;
  const deadline = Date.now() + budgetMs;

  const base = config.ingest.previousSnapshotUrl;
  if (!base) {
    console.error('PREVIOUS_SNAPSHOT_URL is required — the audit has nothing of its own to check.');
    process.exitCode = 1;
    return;
  }
  const snapshotUrl = base;
  const auditUrl = base.replace(/[^/]+$/, 'link-audit.json');

  console.log(`Loading live snapshot from ${snapshotUrl}`);
  const snapshot = await fetchJsonOrEmpty<{ jobs?: Job[] }>(snapshotUrl);
  const jobs = Array.isArray(snapshot?.jobs) ? snapshot.jobs.filter((j) => j && typeof j.id === 'string') : [];
  if (jobs.length === 0) {
    console.error('No live snapshot to audit (empty or unreachable) — nothing to do.');
    process.exitCode = 1;
    return;
  }
  console.log(`  ${jobs.length} postings`);

  const prevAudit = (await fetchJsonOrEmpty<LinkAuditReport>(auditUrl)) ?? { generatedAt: '', checks: {} };
  console.log(`Loaded ${Object.keys(prevAudit.checks).length} previous link checks`);

  // Re-run relevance, geography, salary and title healing on every live
  // posting — in-memory, no network, so there is no reason to ration it the
  // way link checks have to be rationed.
  const live = jobs.filter((j) => !j.isExpired);
  const { jobs: revalidated, dropped } = revalidate(live);
  const expiredAlready = jobs.filter((j) => j.isExpired);
  console.log(`Revalidated ${live.length} live postings: ${dropped} no longer pass today's rules`);

  const byAge = orderByLastChecked(revalidated, prevAudit.checks);

  const checks: Record<string, LinkCheck> = { ...prevAudit.checks };
  let deadCount = 0;
  let checkedCount = 0;
  const toCheck = byAge.slice(0, maxChecks);
  await mapLimit(toCheck, CONCURRENCY, async (job) => {
    if (Date.now() > deadline) return;
    const result = await checkLink(job.applyUrl || job.sourceUrl);
    checks[job.id] = result;
    checkedCount += 1;
    if (result.status === 'dead') deadCount += 1;
  });

  const final = [...applyDeadLinks(revalidated, checks), ...expiredAlready];

  // Prune audit entries for postings no longer on the board at all, so the
  // file does not grow forever.
  const liveIds = new Set(final.map((j) => j.id));
  const prunedChecks = pruneAuditChecks(checks, liveIds);

  const generatedAt = new Date().toISOString();
  const sources = snapshot && 'sources' in snapshot ? (snapshot as { sources?: unknown }).sources : [];
  const full = { generatedAt, sources, jobs: final, truncatedDescriptions: false };
  const client = { generatedAt, sources, jobs: final.map(trimForClient), truncatedDescriptions: true };
  const auditReport: LinkAuditReport = { generatedAt, checks: prunedChecks };

  const outDir = path.join(process.cwd(), 'public', 'data');
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'jobs.full.json'), JSON.stringify(full), 'utf8');
  await fs.writeFile(path.join(outDir, 'jobs.json'), JSON.stringify(client), 'utf8');
  await fs.writeFile(path.join(outDir, 'link-audit.json'), JSON.stringify(auditReport), 'utf8');

  console.log('-'.repeat(72));
  console.log(`checked ${checkedCount} link(s) this run (of ${maxChecks} targeted, ${revalidated.length} live overall)`);
  console.log(`  dead (expired): ${deadCount}`);
  console.log(`  revalidation dropped: ${dropped}`);
  console.log(`publishing ${final.length} postings (${jobs.length - final.length} dropped by revalidation, 0 added — this run collects nothing new)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
