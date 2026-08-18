'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FilterPanel } from '@/components/FilterPanel';
import { JobCard } from '@/components/JobCard';
import { Pagination } from '@/components/Pagination';
import { SearchBar } from '@/components/SearchBar';
import { DeepLinks, type DeepLinkItem } from '@/components/DeepLinks';
import { searchHistory } from '@/lib/client/storage';
import { filtersFromSearchParams, searchParamsFromFilters } from '@/lib/query';
import type { JobFilters, JobSearchResult, SortKey } from '@/lib/types';

type ApiResult = JobSearchResult & { deepLinks: DeepLinkItem[] };

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'relevance', label: 'Best match' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'salary', label: 'Highest salary' },
  { value: 'company', label: 'Company A–Z' },
];

export function JobBrowser() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => filtersFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const [data, setData] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [infinite, setInfinite] = useState(false);
  const [extraPages, setExtraPages] = useState<ApiResult['jobs']>([]);
  const abortRef = useRef<AbortController | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const queryString = searchParams.toString();

  const load = useCallback(
    async (qs: string, append = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (!append) setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/jobs?${qs}`, { signal: controller.signal, cache: 'no-store' });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const json = (await res.json()) as ApiResult;
        if (append) setExtraPages((prev) => [...prev, ...json.jobs]);
        else {
          setData(json);
          setExtraPages([]);
        }
        return json;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return null;
        setError(err instanceof Error ? err.message : 'Search failed');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(queryString);
  }, [queryString, load]);

  // Record the search in local history once results arrive.
  useEffect(() => {
    if (!data) return;
    searchHistory.push({
      query: filters.q ?? '',
      params: queryString,
      at: new Date().toISOString(),
      resultCount: data.total,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.total, queryString]);

  const update = useCallback(
    (patch: Partial<JobFilters>) => {
      const next = { ...filters, ...patch };
      const qs = searchParamsFromFilters(next).toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [filters, pathname, router],
  );

  const reset = useCallback(() => router.push(pathname, { scroll: false }), [pathname, router]);

  // Infinite scroll.
  useEffect(() => {
    if (!infinite || !data) return;
    const el = sentinelRef.current;
    if (!el) return;
    const loadedPages = 1 + Math.ceil(extraPages.length / data.pageSize);
    if (loadedPages >= data.totalPages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || loading) return;
        const params = new URLSearchParams(queryString);
        params.set('page', String((filters.page ?? 1) + loadedPages));
        void load(params.toString(), true);
      },
      { rootMargin: '400px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [infinite, data, extraPages.length, loading, queryString, filters.page, load]);

  const jobs = useMemo(() => [...(data?.jobs ?? []), ...extraPages], [data, extraPages]);

  const lastUpdated = data?.meta.lastIngestAt
    ? new Date(data.meta.lastIngestAt).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h1 className="text-lg font-semibold">Cybersecurity jobs across Ontario &amp; remote Canada</h1>
        <p className="mt-0.5 text-sm text-muted">
          Live postings pulled from company career-site APIs, the federal Job Bank and licensed job APIs — deduplicated,
          categorised and ranked.
        </p>
        <div className="mt-3">
          <SearchBar
            value={filters.q ?? ''}
            onSubmit={(q) => update({ q: q || undefined, page: 1 })}
            onApplyHistory={(params) => router.push(params ? `${pathname}?${params}` : pathname, { scroll: false })}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          {lastUpdated ? <span>Last refreshed {lastUpdated}</span> : <span>Waiting for the first data refresh…</span>}
          {data?.meta.notes.map((n) => (
            <span key={n} className="chip border-warn/40 bg-warn/10 text-warn">
              {n}
            </span>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className={`${showFilters ? 'block' : 'hidden'} lg:block`}>
          <FilterPanel
            filters={filters}
            facets={data?.facets ?? null}
            total={data?.total ?? 0}
            onChange={update}
            onReset={reset}
          />
        </div>

        <div className="min-w-0 space-y-4">
          <div className="card flex flex-wrap items-center gap-2 p-3">
            <button type="button" className="btn lg:hidden" onClick={() => setShowFilters((s) => !s)}>
              {showFilters ? 'Hide filters' : 'Filters'}
            </button>

            <span className="text-sm text-muted">
              {loading && !data ? 'Searching…' : `${(data?.total ?? 0).toLocaleString('en-CA')} jobs`}
            </span>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted">
                Sort
                <select
                  className="input w-auto py-1.5 text-sm"
                  value={filters.sort ?? 'relevance'}
                  onChange={(e) => update({ sort: e.target.value as SortKey, page: 1 })}
                >
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted">
                Per page
                <select
                  className="input w-auto py-1.5 text-sm"
                  value={filters.pageSize ?? 25}
                  onChange={(e) => update({ pageSize: Number(e.target.value), page: 1 })}
                >
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-line accent-[rgb(var(--brand))]"
                  checked={infinite}
                  onChange={(e) => {
                    setInfinite(e.target.checked);
                    setExtraPages([]);
                  }}
                />
                Infinite scroll
              </label>
            </div>
          </div>

          {error ? (
            <div className="card border-warn/40 p-4 text-sm text-warn">
              {error}
              <button type="button" className="btn ml-3" onClick={() => void load(queryString)}>
                Retry
              </button>
            </div>
          ) : null}

          {loading && !data ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={i} className="card h-36 animate-pulse bg-surface2" />
              ))}
            </div>
          ) : null}

          {!loading && jobs.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-sm font-medium">No postings match these filters.</p>
              <p className="mt-1 text-sm text-muted">
                Try widening the date range, clearing a filter, or including pathway roles.
              </p>
              <button type="button" className="btn btn-primary mt-4" onClick={reset}>
                Clear all filters
              </button>
            </div>
          ) : null}

          <div className="space-y-3">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onTagClick={(tech) =>
                  update({
                    skills: [...new Set([...(filters.skills ?? []), tech])],
                    page: 1,
                  })
                }
              />
            ))}
          </div>

          {infinite ? <div ref={sentinelRef} className="h-8" aria-hidden /> : null}

          {!infinite && data ? (
            <Pagination page={data.page} totalPages={data.totalPages} onChange={(p) => update({ page: p })} />
          ) : null}

          {data ? <DeepLinks links={data.deepLinks} /> : null}
        </div>
      </div>
    </div>
  );
}
