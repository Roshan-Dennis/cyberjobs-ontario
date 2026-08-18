/**
 * CLI entry point for the ingestion pipeline.
 *
 *   npm run ingest            # fetch, normalise, dedupe and persist
 *   npm run ingest:dry        # everything except persistence
 *   npm run ingest -- --only greenhouse,lever
 */
import { runIngest } from '../src/lib/ingest';

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) return process.argv[idx + 1];
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`));
  return inline?.split('=').slice(1).join('=');
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const only = arg('only');
  if (only) process.env.INGEST_SOURCES = only;
  const budget = Number.parseInt(arg('budget') ?? '', 10);

  console.log(`Starting ingest${dryRun ? ' (dry run)' : ''}…`);
  const { report } = await runIngest({
    dryRun,
    budgetMs: Number.isFinite(budget) ? budget : 600_000,
    onLog: (line) => console.log(`  ${line}`),
  });

  console.log('\nSource results');
  console.log('-'.repeat(78));
  for (const s of report.sources) {
    const status = s.skipped ? 'skip' : s.ok ? 'ok' : 'FAIL';
    console.log(
      `${status.padEnd(5)} ${s.sourceId.padEnd(16)} fetched ${String(s.fetched).padStart(5)}  kept ${String(s.kept).padStart(5)}  ${(s.durationMs / 1000).toFixed(1)}s  ${s.error ?? s.skipped ?? ''}`,
    );
  }
  console.log('-'.repeat(78));
  console.log(
    `Fetched ${report.totalFetched} - kept ${report.totalKept} - merged ${report.duplicatesMerged} duplicates - ` +
      `inserted ${report.inserted} - updated ${report.updated} - expired ${report.expired} - ${(report.durationMs / 1000).toFixed(1)}s`,
  );

  if (report.sources.every((s) => s.fetched === 0)) {
    console.error('\nNo postings were fetched from any source. Check network access and API keys.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
