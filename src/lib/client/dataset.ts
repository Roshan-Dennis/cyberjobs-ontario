'use client';

import type { Job } from '@/lib/types';

/**
 * The whole dataset, loaded once per page-load and cached in module scope.
 *
 * The file is baked into the site by the publish workflow, so there is no
 * server, no database and no per-request cost — searching, filtering and
 * faceting all happen in the browser against this array. Generate it locally
 * with `npm run data`.
 */

export interface Dataset {
  jobs: Job[];
  generatedAt: string | null;
  sources: { id: string; fetched: number; kept: number }[];
  truncatedDescriptions: boolean;
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

let cache: Dataset | null = null;
let inflight: Promise<Dataset> | null = null;

async function tryFetch(url: string): Promise<Dataset | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as Partial<Dataset>;
    if (!Array.isArray(json.jobs)) return null;
    return {
      jobs: json.jobs as Job[],
      generatedAt: json.generatedAt ?? null,
      sources: json.sources ?? [],
      truncatedDescriptions: json.truncatedDescriptions ?? false,
    };
  } catch {
    return null;
  }
}

export async function loadDataset(): Promise<Dataset> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const loaded = await tryFetch(`${BASE}/data/jobs.json`);
    const result: Dataset =
      loaded ?? { jobs: [], generatedAt: null, sources: [], truncatedDescriptions: false };
    cache = result;
    return result;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

export function clearDatasetCache(): void {
  cache = null;
}
