import type { Deadline } from '@/lib/http';
import type { RawJob } from '@/lib/types';

export interface SourceContext {
  deadline: Deadline;
  /** Emit a diagnostic line into the ingest report. */
  log: (message: string) => void;
}

export interface JobSource {
  id: string;
  name: string;
  /** Human-readable note about legality/terms, shown in the UI and README. */
  access: string;
  homepage: string;
  /** Returns false when the source is not configured (missing API key, opted out). */
  isEnabled: () => boolean;
  /** Reason shown when disabled. */
  disabledReason?: () => string;
  fetchJobs: (ctx: SourceContext) => Promise<RawJob[]>;
}

export function dedupeRaw(jobs: RawJob[]): RawJob[] {
  const seen = new Set<string>();
  const out: RawJob[] = [];
  for (const j of jobs) {
    const key = `${j.sourceId}:${j.sourceJobId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(j);
  }
  return out;
}
