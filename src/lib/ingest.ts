import { config } from '@/lib/config';
import { Deadline } from '@/lib/http';
import { DEFAULT_NORMALIZE_OPTIONS, normalizeJob } from '@/lib/normalize';
import { dedupeJobs, markReposts } from '@/lib/normalize/dedupe';
import { activeSources } from '@/lib/sources/registry';
import { getStore } from '@/lib/store';
import type { IngestReport, Job, RawJob, SourceRunReport } from '@/lib/types';

export interface IngestOptions {
  dryRun?: boolean;
  budgetMs?: number;
  onLog?: (line: string) => void;
}

export interface IngestOutcome {
  report: IngestReport;
  jobs: Job[];
  logs: string[];
}

/**
 * Run every enabled source, normalise and deduplicate the results, then
 * persist. Designed to be safe to call from a serverless cron: it respects a
 * wall-clock budget and always returns a report, even partially.
 */
export async function runIngest(options: IngestOptions = {}): Promise<IngestOutcome> {
  const startedAt = new Date();
  const budget = options.budgetMs ?? config.ingest.maxDurationMs;
  const deadline = new Deadline(budget);
  const logs: string[] = [];
  const log = (line: string) => {
    logs.push(line);
    options.onLog?.(line);
  };

  const sources = activeSources();
  const reports: SourceRunReport[] = [];
  const raw: RawJob[] = [];

  for (const source of sources) {
    const t0 = Date.now();

    if (!source.isEnabled()) {
      reports.push({
        sourceId: source.id,
        sourceName: source.name,
        ok: true,
        fetched: 0,
        kept: 0,
        durationMs: 0,
        skipped: source.disabledReason?.() ?? 'disabled',
      });
      continue;
    }

    if (deadline.expired) {
      reports.push({
        sourceId: source.id,
        sourceName: source.name,
        ok: false,
        fetched: 0,
        kept: 0,
        durationMs: 0,
        skipped: 'time budget exhausted',
      });
      continue;
    }

    try {
      const jobs = await source.fetchJobs({ deadline, log });
      raw.push(...jobs);
      reports.push({
        sourceId: source.id,
        sourceName: source.name,
        ok: true,
        fetched: jobs.length,
        kept: 0,
        durationMs: Date.now() - t0,
      });
      log(`${source.id}: fetched ${jobs.length} raw postings in ${Date.now() - t0}ms`);
    } catch (err) {
      reports.push({
        sourceId: source.id,
        sourceName: source.name,
        ok: false,
        fetched: 0,
        kept: 0,
        durationMs: Date.now() - t0,
        error: err instanceof Error ? err.message : String(err),
      });
      log(`${source.id}: FAILED ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ---- Normalise -----------------------------------------------------
  const normalizeOptions = {
    ...DEFAULT_NORMALIZE_OPTIONS,
    minRelevance: config.ingest.minRelevance,
    includePathway: config.ingest.includePathway,
    allowRemoteCanada: config.ingest.allowRemoteCanada,
  };

  const keptBySource = new Map<string, number>();
  const normalized: Job[] = [];
  const rejectReasons = new Map<string, number>();

  for (const item of raw) {
    const { job, reason } = normalizeJob(item, normalizeOptions);
    if (!job) {
      const key = reason ?? 'unknown';
      rejectReasons.set(key, (rejectReasons.get(key) ?? 0) + 1);
      continue;
    }
    normalized.push(job);
    keptBySource.set(job.sourceId, (keptBySource.get(job.sourceId) ?? 0) + 1);
  }

  for (const r of reports) r.kept = keptBySource.get(r.sourceId) ?? 0;

  const topRejects = [...rejectReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  for (const [reason, count] of topRejects) log(`filtered ${count}× ${reason}`);

  // ---- Deduplicate ---------------------------------------------------
  const { jobs: deduped, merged } = dedupeJobs(normalized);
  log(`normalised ${normalized.length} → ${deduped.length} unique (${merged} duplicates merged)`);

  // ---- Persist -------------------------------------------------------
  let inserted = 0;
  let updated = 0;
  let expired = 0;

  if (!options.dryRun) {
    const store = getStore();
    try {
      const existing = await store.allJobs();
      const byFingerprint = new Map(existing.map((j) => [j.fingerprint, { id: j.id, postedAt: j.postedAt }]));
      markReposts(deduped, byFingerprint);

      const saved = await store.saveJobs(deduped);
      inserted = saved.inserted;
      updated = saved.updated;

      expired = await store.expireStale(new Set(deduped.map((j) => j.id)), config.ingest.expiryDays);

      await store.setMeta({
        lastIngestAt: new Date().toISOString(),
        jobCount: existing.length + inserted,
      });
      log(`stored via ${store.kind}: ${inserted} new, ${updated} updated, ${expired} expired`);
    } catch (err) {
      log(`store error: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  const finishedAt = new Date();
  const report: IngestReport = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    sources: reports,
    totalFetched: raw.length,
    totalKept: normalized.length,
    inserted,
    updated,
    expired,
    duplicatesMerged: merged,
  };

  return { report, jobs: deduped, logs };
}
