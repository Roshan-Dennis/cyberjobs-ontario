import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '@/lib/config';
import type { JobStore, StoreMeta } from '@/lib/store/index';
import type { Job } from '@/lib/types';

interface JobRow {
  id: string;
  fingerprint: string;
  payload: Job;
  posted_at: string | null;
  last_seen_at: string;
  first_seen_at: string;
  is_expired: boolean;
  rank_score: number;
}

const TABLE = 'jobs';
const META_TABLE = 'ingest_meta';
const META_ID = 'singleton';
const PAGE = 1000;

export class SupabaseStore implements JobStore {
  readonly kind = 'supabase' as const;
  private client: SupabaseClient;

  constructor() {
    const key = config.supabase.serviceKey || config.supabase.anonKey;
    this.client = createClient(config.supabase.url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-application-name': 'cyberjobs-ontario' } },
    });
  }

  private toRow(job: Job): JobRow {
    return {
      id: job.id,
      fingerprint: job.fingerprint,
      payload: job,
      posted_at: job.postedAt,
      last_seen_at: job.lastSeenAt,
      first_seen_at: job.firstSeenAt,
      is_expired: job.isExpired,
      rank_score: job.rankScore,
    };
  }

  async saveJobs(jobs: Job[]): Promise<{ inserted: number; updated: number }> {
    if (jobs.length === 0) return { inserted: 0, updated: 0 };

    const ids = jobs.map((j) => j.id);
    const existing = new Set<string>();
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const { data, error } = await this.client.from(TABLE).select('id, first_seen_at').in('id', chunk);
      if (error) throw new Error(`supabase select: ${error.message}`);
      for (const row of data ?? []) existing.add((row as { id: string }).id);
    }

    const rows = jobs.map((job) => {
      const row = this.toRow(job);
      if (existing.has(job.id)) {
        // Preserve the original discovery timestamp.
        return { ...row, first_seen_at: undefined as unknown as string };
      }
      return row;
    });

    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200).map((r) => {
        const copy: Record<string, unknown> = { ...r };
        if (copy.first_seen_at === undefined) delete copy.first_seen_at;
        return copy;
      });
      const { error } = await this.client.from(TABLE).upsert(chunk, { onConflict: 'id' });
      if (error) throw new Error(`supabase upsert: ${error.message}`);
    }

    const inserted = jobs.filter((j) => !existing.has(j.id)).length;
    return { inserted, updated: jobs.length - inserted };
  }

  async allJobs(): Promise<Job[]> {
    const out: Job[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.client
        .from(TABLE)
        .select('payload, is_expired, first_seen_at')
        .order('rank_score', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`supabase select: ${error.message}`);
      const rows = (data ?? []) as { payload: Job; is_expired: boolean; first_seen_at: string }[];
      for (const row of rows) {
        if (!row.payload) continue;
        out.push({ ...row.payload, isExpired: row.is_expired, firstSeenAt: row.first_seen_at ?? row.payload.firstSeenAt });
      }
      if (rows.length < PAGE) break;
      if (out.length > 100_000) break;
    }
    return out;
  }

  async getJob(id: string): Promise<Job | null> {
    const { data, error } = await this.client.from(TABLE).select('payload, is_expired').eq('id', id).maybeSingle();
    if (error) throw new Error(`supabase select: ${error.message}`);
    if (!data) return null;
    const row = data as { payload: Job; is_expired: boolean };
    return { ...row.payload, isExpired: row.is_expired };
  }

  async expireStale(seenIds: Set<string>, expiryDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - expiryDays * 86_400_000).toISOString();
    const { data, error } = await this.client
      .from(TABLE)
      .update({ is_expired: true })
      .lt('last_seen_at', cutoff)
      .eq('is_expired', false)
      .select('id');
    if (error) throw new Error(`supabase expire: ${error.message}`);
    return (data ?? []).length;
  }

  async purgeOlderThan(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data, error } = await this.client.from(TABLE).delete().lt('last_seen_at', cutoff).select('id');
    if (error) throw new Error(`supabase purge: ${error.message}`);
    return (data ?? []).length;
  }

  async getMeta(): Promise<StoreMeta> {
    const { data, error } = await this.client.from(META_TABLE).select('*').eq('id', META_ID).maybeSingle();
    if (error) return { lastIngestAt: null, lastIngestReport: null, jobCount: 0 };
    const row = data as { last_ingest_at?: string; last_report?: unknown; job_count?: number } | null;
    return {
      lastIngestAt: row?.last_ingest_at ?? null,
      lastIngestReport: row?.last_report ?? null,
      jobCount: row?.job_count ?? 0,
    };
  }

  async setMeta(meta: Partial<StoreMeta>): Promise<void> {
    const { error } = await this.client.from(META_TABLE).upsert(
      {
        id: META_ID,
        last_ingest_at: meta.lastIngestAt ?? new Date().toISOString(),
        last_report: meta.lastIngestReport ?? null,
        job_count: meta.jobCount ?? 0,
      },
      { onConflict: 'id' },
    );
    if (error) throw new Error(`supabase meta: ${error.message}`);
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    const { count, error } = await this.client.from(TABLE).select('id', { count: 'exact', head: true });
    if (error) return { ok: false, detail: `supabase error: ${error.message}` };
    return { ok: true, detail: `supabase store (${count ?? 0} jobs)` };
  }
}
