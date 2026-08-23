/**
 * Produce the JSON snapshot the static site is built from.
 *
 *   npm run data            # run every connector, write both snapshots
 *   npm run data -- --only greenhouse,lever
 *
 * Writes two files:
 *
 *   public/data/jobs.full.json  complete records. Read at build time to
 *                          prerender one page per posting, and fetched by the
 *                          NEXT run as the carry-forward baseline — the
 *                          previous publish is this project's database.
 *   public/data/jobs.json  the payload the browser downloads. Descriptions are
 *                          truncated here because the list view only needs
 *                          enough text to search against — the full text lives
 *                          on the prerendered detail page. On a 100-job set
 *                          this is the difference between ~1 MB and ~200 KB.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { runIngest } from '../src/lib/ingest';
import { config } from '../src/lib/config';
import { mergeSnapshots, revalidate, sanityCheck } from '../src/lib/merge';
import type { Job } from '../src/lib/types';

/** How much description text to ship to the browser, per job. */
const CLIENT_DESCRIPTION_CHARS = 1200;

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) return process.argv[idx + 1];
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
}

function trimForClient(job: Job): Job {
  return {
    ...job,
    // The detail page is prerendered from the full record, so the browser
    // never needs the whole description — only enough to match searches.
    description: job.description.slice(0, CLIENT_DESCRIPTION_CHARS),
    descriptionHtml: null,
  };
}

/**
 * Load the previously published snapshot. Best-effort by design: if this fails
 * for any reason the run continues with only what the connectors just returned,
 * which is exactly the old behaviour. A missing baseline must never turn into a
 * failed publish.
 */
async function loadPrevious(url: string): Promise<Job[]> {
  if (!url) return [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) {
      console.log(`  previous snapshot: HTTP ${res.status} (first run?) — starting fresh`);
      return [];
    }
    const parsed = (await res.json()) as { jobs?: Job[] };
    const jobs = Array.isArray(parsed.jobs) ? parsed.jobs.filter((j) => j && typeof j.id === 'string') : [];
    console.log(`  previous snapshot: ${jobs.length} postings`);
    return jobs;
  } catch (err) {
    console.log(`  previous snapshot unavailable (${err instanceof Error ? err.message : String(err)}) — starting fresh`);
    return [];
  }
}

async function main(): Promise<void> {
  const only = arg('only');
  if (only) process.env.INGEST_SOURCES = only;

  const budget = Number.parseInt(arg('budget') ?? '', 10);

  console.log('Collecting job data…');
  const { report, jobs, logs } = await runIngest({
    dryRun: true, // no database involved; this script owns persistence
    budgetMs: Number.isFinite(budget) ? budget : 600_000,
    onLog: (line) => console.log(`  ${line}`),
  });

  const generatedAt = new Date().toISOString();
  const sources = report.sources.map((s) => ({ id: s.sourceId, fetched: s.fetched, kept: s.kept }));

  // Carry forward. Without this a single failing connector removes its share of
  // the site until the next hour — Greenhouse alone is half the dataset.
  const previousUrl = arg('previous') ?? config.ingest.previousSnapshotUrl;
  const loaded = await loadPrevious(previousUrl);
  // Re-check the baseline against today's rules before merging, so a
  // classification fix reaches postings that are only being carried forward.
  const revalidated = revalidate(loaded);
  if (revalidated.dropped > 0) {
    console.log(`  revalidated baseline: dropped ${revalidated.dropped} no longer passing the geo filter`);
  }
  const previous = revalidated.jobs;
  const merge = mergeSnapshots(previous, jobs, {
    retentionDays: config.ingest.retentionDays,
    staleDays: config.ingest.staleDays,
  });

  const abort = sanityCheck(previous.length, merge.jobs.length);
  if (abort) {
    console.error(`\nRefusing to publish: ${abort}`);
    process.exitCode = 1;
    return;
  }

  const merged = merge.jobs;
  const full = { generatedAt, sources, jobs: merged, truncatedDescriptions: false };
  const client = {
    generatedAt,
    sources,
    jobs: merged.map(trimForClient),
    truncatedDescriptions: true,
  };

  await fs.mkdir(path.join(process.cwd(), 'data'), { recursive: true });
  await fs.mkdir(path.join(process.cwd(), 'public', 'data'), { recursive: true });

  // Written under public/ so the next run can fetch it back from the live site.
  const fullPath = path.join(process.cwd(), 'public', 'data', 'jobs.full.json');
  const clientPath = path.join(process.cwd(), 'public', 'data', 'jobs.json');
  await fs.writeFile(fullPath, JSON.stringify(full), 'utf8');
  await fs.writeFile(clientPath, JSON.stringify(client), 'utf8');

  const kb = async (p: string) => Math.round((await fs.stat(p)).size / 1024);

  console.log('\nSource results');
  console.log('-'.repeat(72));
  for (const s of report.sources) {
    const status = s.skipped ? 'skip' : s.ok ? 'ok' : 'FAIL';
    console.log(
      `${status.padEnd(5)} ${s.sourceId.padEnd(16)} fetched ${String(s.fetched).padStart(5)}  kept ${String(s.kept).padStart(5)}  ${(s.durationMs / 1000).toFixed(1)}s  ${s.error ?? s.skipped ?? ''}`,
    );
  }
  console.log('-'.repeat(72));
  console.log(`this run: ${jobs.length} unique postings (${report.duplicatesMerged} duplicates merged)`);
  console.log(
    `merge:    ${merge.added} new, ${merge.refreshed} refreshed, ${merge.carried} carried forward ` +
      `(${merge.newlyExpired} newly expired), ${merge.dropped} dropped past ${config.ingest.retentionDays}d`,
  );
  console.log(`publishing ${merged.length} postings`);
  console.log(`  public/data/jobs.full.json  ${await kb(fullPath)} KB  (build + next run's baseline)`);
  console.log(`  public/data/jobs.json       ${await kb(clientPath)} KB  (downloaded by the browser)`);

  if (jobs.length === 0 && previous.length === 0) {
    console.error('\nNo postings collected and no baseline to fall back on.');
    console.error(logs.slice(-15).join('\n'));
    process.exitCode = 1;
  } else if (jobs.length === 0) {
    console.warn('\nWARNING: every connector returned nothing. Republishing the carried-forward set.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
