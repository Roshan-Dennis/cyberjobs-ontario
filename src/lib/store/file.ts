import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { JobStore, StoreMeta } from '@/lib/store/index';
import type { Job } from '@/lib/types';

interface Snapshot {
  version: 1;
  meta: StoreMeta;
  jobs: Job[];
}

const EMPTY: Snapshot = {
  version: 1,
  meta: { lastIngestAt: null, lastIngestReport: null, jobCount: 0 },
  jobs: [],
};

/**
 * Zero-configuration fallback store.
 *
 * Keeps the job set in process memory and mirrors it to a JSON file so a warm
 * serverless instance or a local `next dev` session survives reloads. This is
 * what makes `git clone && npm run dev` work with no database, but it is NOT
 * durable across deployments — configure Supabase for production.
 */
export class FileStore implements JobStore {
  readonly kind = 'file' as const;

  private snapshot: Snapshot | null = null;
  private readonly file: string;
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(file?: string) {
    const dir = process.env.DATA_DIR ?? (process.env.VERCEL ? path.join(os.tmpdir(), 'cyberjobs') : path.join(process.cwd(), 'data'));
    this.file = file ?? path.join(dir, 'jobs.json');
  }

  private async load(): Promise<Snapshot> {
    if (this.snapshot) return this.snapshot;
    try {
      const text = await fs.readFile(this.file, 'utf8');
      const parsed = JSON.parse(text) as Snapshot;
      if (parsed?.version === 1 && Array.isArray(parsed.jobs)) {
        this.snapshot = parsed;
        return parsed;
      }
    } catch {
      /* first run */
    }
    this.snapshot = structuredClone(EMPTY);
    return this.snapshot;
  }

  private persist(): void {
    const snap = this.snapshot;
    if (!snap) return;
    this.writeChain = this.writeChain
      .then(async () => {
        await fs.mkdir(path.dirname(this.file), { recursive: true });
        await fs.writeFile(this.file, JSON.stringify(snap), 'utf8');
      })
      .catch(() => undefined);
  }

  async saveJobs(jobs: Job[]): Promise<{ inserted: number; updated: number }> {
    const snap = await this.load();
    const byId = new Map(snap.jobs.map((j) => [j.id, j]));
    let inserted = 0;
    let updated = 0;

    for (const job of jobs) {
      const existing = byId.get(job.id);
      if (existing) {
        byId.set(job.id, {
          ...job,
          firstSeenAt: existing.firstSeenAt ?? job.firstSeenAt,
          isRepost: job.isRepost || existing.isRepost,
          repostOf: job.repostOf ?? existing.repostOf,
        });
        updated += 1;
      } else {
        byId.set(job.id, job);
        inserted += 1;
      }
    }

    snap.jobs = [...byId.values()];
    snap.meta.jobCount = snap.jobs.length;
    this.persist();
    return { inserted, updated };
  }

  async allJobs(): Promise<Job[]> {
    return (await this.load()).jobs;
  }

  async getJob(id: string): Promise<Job | null> {
    const snap = await this.load();
    return snap.jobs.find((j) => j.id === id) ?? null;
  }

  async expireStale(seenIds: Set<string>, expiryDays: number): Promise<number> {
    const snap = await this.load();
    const cutoff = Date.now() - expiryDays * 86_400_000;
    let n = 0;
    for (const job of snap.jobs) {
      if (seenIds.has(job.id)) continue;
      const last = Date.parse(job.lastSeenAt);
      const posted = job.postedAt ? Date.parse(job.postedAt) : NaN;
      const stale = (Number.isFinite(last) && last < cutoff) || (Number.isFinite(posted) && posted < cutoff);
      if (stale && !job.isExpired) {
        job.isExpired = true;
        n += 1;
      }
    }
    this.persist();
    return n;
  }

  async purgeOlderThan(days: number): Promise<number> {
    const snap = await this.load();
    const cutoff = Date.now() - days * 86_400_000;
    const before = snap.jobs.length;
    snap.jobs = snap.jobs.filter((j) => {
      const last = Date.parse(j.lastSeenAt);
      return !Number.isFinite(last) || last >= cutoff;
    });
    snap.meta.jobCount = snap.jobs.length;
    this.persist();
    return before - snap.jobs.length;
  }

  async getMeta(): Promise<StoreMeta> {
    return (await this.load()).meta;
  }

  async setMeta(meta: Partial<StoreMeta>): Promise<void> {
    const snap = await this.load();
    snap.meta = { ...snap.meta, ...meta };
    this.persist();
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    const snap = await this.load();
    return {
      ok: true,
      detail: `file store (${snap.jobs.length} jobs) at ${this.file} — configure Supabase for durable storage`,
    };
  }
}
