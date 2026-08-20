/**
 * Produce the JSON snapshot the static site is built from.
 *
 *   npm run data            # run every connector, write both snapshots
 *   npm run data -- --only greenhouse,lever
 *
 * Writes two files:
 *
 *   data/jobs.full.json    complete records, read at build time to prerender
 *                          one page per posting. Never shipped to the browser.
 *   public/data/jobs.json  the payload the browser downloads. Descriptions are
 *                          truncated here because the list view only needs
 *                          enough text to search against — the full text lives
 *                          on the prerendered detail page. On a 100-job set
 *                          this is the difference between ~1 MB and ~200 KB.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { runIngest } from '../src/lib/ingest';
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

  const full = { generatedAt, sources, jobs, truncatedDescriptions: false };
  const client = {
    generatedAt,
    sources,
    jobs: jobs.map(trimForClient),
    truncatedDescriptions: true,
  };

  await fs.mkdir(path.join(process.cwd(), 'data'), { recursive: true });
  await fs.mkdir(path.join(process.cwd(), 'public', 'data'), { recursive: true });

  const fullPath = path.join(process.cwd(), 'data', 'jobs.full.json');
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
  console.log(`${jobs.length} unique postings (${report.duplicatesMerged} duplicates merged)`);
  console.log(`  data/jobs.full.json    ${await kb(fullPath)} KB  (build-time only)`);
  console.log(`  public/data/jobs.json  ${await kb(clientPath)} KB  (downloaded by the browser)`);

  if (jobs.length === 0) {
    console.error('\nNo postings collected — refusing to publish an empty site.');
    console.error(logs.slice(-15).join('\n'));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
