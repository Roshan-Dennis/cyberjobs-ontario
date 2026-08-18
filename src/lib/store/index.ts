import { config } from '@/lib/config';
import { FileStore } from '@/lib/store/file';
import { SupabaseStore } from '@/lib/store/supabase';
import type { Job } from '@/lib/types';

export interface StoreMeta {
  lastIngestAt: string | null;
  lastIngestReport: unknown | null;
  jobCount: number;
}

export interface JobStore {
  readonly kind: 'supabase' | 'file';
  /** Upsert by id. Returns counts. */
  saveJobs: (jobs: Job[]) => Promise<{ inserted: number; updated: number }>;
  /** Every non-purged job. */
  allJobs: () => Promise<Job[]>;
  getJob: (id: string) => Promise<Job | null>;
  /** Mark jobs not seen in this run and older than the expiry window. */
  expireStale: (seenIds: Set<string>, expiryDays: number) => Promise<number>;
  purgeOlderThan: (days: number) => Promise<number>;
  getMeta: () => Promise<StoreMeta>;
  setMeta: (meta: Partial<StoreMeta>) => Promise<void>;
  health: () => Promise<{ ok: boolean; detail: string }>;
}

let cached: JobStore | null = null;

export function getStore(): JobStore {
  if (cached) return cached;
  cached = config.supabase.enabled ? new SupabaseStore() : new FileStore();
  return cached;
}

export function resetStore(): void {
  cached = null;
}
