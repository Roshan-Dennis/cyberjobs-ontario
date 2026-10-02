'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FilterPanel } from '@/components/FilterPanel';
import { ActiveFilters } from '@/components/ActiveFilters';
import { ResumeAdvisor } from '@/components/ResumeAdvisor';
import { useResume } from '@/lib/client/resume-store';
import { scoreResume } from '@/lib/ats/score';
import { JobCard } from '@/components/JobCard';
import { Pagination } from '@/components/Pagination';
import { SearchBar } from '@/components/SearchBar';
import { DeepLinks, type DeepLinkItem } from '@/components/DeepLinks';
import { rememberLastSearch, searchHistory } from '@/lib/client/storage';
import { loadDataset } from '@/lib/client/dataset';
import { buildDeepLinks } from '@/lib/deeplinks';
import { countActiveFilters, filtersFromSearchParams, searchJobs, searchParamsFromFilters } from '@/lib/query';
import type { Job, JobFilters, JobSearchResult, SortKey } from '@/lib/types';

type ApiResult = JobSearchResult & { deepLinks: DeepLinkItem[] };

/** Province name of a single selected city, so deep links search the right place. */
function provinceForCity(jobs: Job[], cities: string[] | undefined): string | undefined {
  if (!cities || cities.length !== 1) return undefined;
  return jobs.find((j) => j.city === cities[0])?.provinceName ?? undefined;
}

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'relevance', label: 'Best match' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'salary', label: 'Highest salary' },
  { value: 'company', label: 'Company A–Z' },
];

/** Offered only while a resume is loaded. */
const MATCH_SORT: { value: SortKey; label: string } = { value: 'match', label: 'Best match for my resume' };

/** Stable empty object, so the pre-hydration render keeps a stable identity. */
const EMPTY_FILTERS: JobFilters = {};

export function JobBrowser() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The export is prerendered with no query string, so the server HTML always
  // reflects "no filters". Reading the real parameters on the very first client
  // render therefore produces different markup — a different filter badge, and
  // sidebar sections that appear or vanish — and React throws away the server
  // HTML and re-renders. Hold the parameters back for one tick so the first
  // client render matches, then apply them. Nothing is visible either way,
  // because the dataset has not arrived yet.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Once hydrated, the browser's own URL is the source of truth. On a static
  // export, useSearchParams can report an empty query for a render or two
  // after load, which briefly showed the whole board (and its count) before
  // a shared filtered link applied. It still drives re-renders: every filter
  // change and back/forward step updates it.
  const urlFilters = useMemo(
    () =>
      filtersFromSearchParams(
        new URLSearchParams(hydrated && typeof window !== 'undefined' ? window.location.search : searchParams.toString()),
      ),
    [searchParams, hydrated],
  );
  const filters = hydrated ? urlFilters : EMPTY_FILTERS;

  const [dataset, setDataset] = useState<Job[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [data, setData] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [infinite, setInfinite] = useState(false);
  const [visiblePages, setVisiblePages] = useState(1);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const queryString = searchParams.toString();

  // The dataset is fetched once. Everything after this — filtering, sorting,
  // faceting, pagination — runs in the browser against that array, so changing
  // a filter is instant and costs no network round-trip.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadDataset()
      .then((d) => {
        if (cancelled) return;
        setDataset(d.jobs);
        setGeneratedAt(d.generatedAt);
        if (d.jobs.length === 0) {
          setError('No job data found. If you are running locally, run `npm run data` first.');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load job data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // With a resume loaded, every posting gets its match score, for the card
  // badges and the "Best match for my resume" sort. Computed here in the
  // browser from the in-memory resume; nothing is sent anywhere.
  const resume = useResume();
  const matchScores = useMemo(() => {
    if (!resume || !dataset) return undefined;
    return new Map(dataset.map((j) => [j.id, scoreResume(resume.profile, j).score]));
  }, [resume, dataset]);

  useEffect(() => {
    if (!dataset) return;
    const result = searchJobs(dataset, filters, { lastIngestAt: generatedAt, notes: [], degraded: false, matchScores });
    setData({ ...result, deepLinks: buildDeepLinks(filters, provinceForCity(dataset, filters.cities)) });
    setVisiblePages(1);
  }, [dataset, filters, generatedAt, matchScores]);

  // Remember where the reader was, so "Back to search" on a job page returns
  // to these results instead of an unfiltered board.
  useEffect(() => {
    if (!hydrated) return;
    rememberLastSearch(queryString);
  }, [hydrated, queryString]);

  // Record the search in local history once results settle.
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

  // Filters live in the query string, but every result is computed in the
  // browser, so changing them needs no server round-trip. router.push fetched
  // a fresh page payload (index.txt?…&_rsc=…) on every click — a network hop
  // on GitHub Pages during which a ticked checkbox snapped back to unticked.
  // A plain pushState updates the URL (and useSearchParams) instantly while
  // keeping the back button and shareable links working.
  const navigate = useCallback(
    (qs: string) => {
      if (typeof window === 'undefined' || !window.history?.pushState) {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        return;
      }
      const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      window.history.pushState(null, '', url);
    },
    [pathname, router],
  );

  const update = useCallback(
    (patch: Partial<JobFilters>) => navigate(searchParamsFromFilters({ ...filters, ...patch }).toString()),
    [filters, navigate],
  );

  const reset = useCallback(() => navigate(''), [navigate]);

  // Infinite scroll simply reveals more of the already-computed result set.
  useEffect(() => {
    if (!infinite || !data) return;
    const el = sentinelRef.current;
    if (!el) return;
    if (visiblePages >= data.totalPages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisiblePages((p) => p + 1);
      },
      { rootMargin: '400px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [infinite, data, visiblePages]);

  const jobs = useMemo(() => {
    if (!data || !dataset) return [];
    if (!infinite) return data.jobs;
    const extended = searchJobs(
      dataset,
      { ...filters, page: 1, pageSize: (filters.pageSize ?? 25) * visiblePages },
      { lastIngestAt: generatedAt },
    );
    return extended.jobs;
  }, [data, dataset, infinite, filters, visiblePages, generatedAt]);

  const lastUpdated = generatedAt
    ? new Date(generatedAt).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h1 className="text-lg font-semibold tracking-tight">Cybersecurity jobs across Ontario, Alberta, BC &amp; Quebec</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted/80">
          Postings collected hourly from company career-site APIs, the federal Job Bank and licensed job APIs —
          deduplicated, categorised and ranked.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/start" className="font-medium text-brand hover:underline">
            New to cybersecurity? Start here →
          </Link>
        </p>
        <div className="mt-3">
          <SearchBar
            value={filters.q ?? ''}
            onSubmit={(q) => update({ q: q || undefined, page: 1 })}
            onApplyHistory={(params) => navigate(params)}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          {lastUpdated ? <span>Last refreshed {lastUpdated}</span> : <span>Waiting for the first data refresh…</span>}
          {data?.meta.notes.map((n) => (
            <span key={n} className="badge badge-alert">
              {n}
            </span>
          ))}
        </div>
      </section>

      <ResumeAdvisor dataset={dataset} onApply={update} />

      {/* items-start keeps both columns anchored to the same top edge, so the
          filter card and the results toolbar line up across the gutter. */}
      <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className={`${showFilters ? 'block' : 'hidden'} lg:block`}>
          <FilterPanel
            filters={filters}
            facets={data?.facets ?? null}
            total={data?.total ?? 0}
            onChange={update}
            onReset={reset}
          />
        </div>

        <div ref={resultsRef} className="min-w-0 space-y-4">
          <div className="card flex min-h-[3.25rem] flex-wrap items-center gap-2 px-3 py-2.5">
            <button
              type="button"
              className="btn lg:hidden"
              onClick={() => setShowFilters((s) => !s)}
              aria-expanded={showFilters}
              aria-label={showFilters ? 'Hide filters' : 'Filters'}
            >
              {showFilters ? 'Hide filters' : 'Filters'}
              {!showFilters && countActiveFilters(filters) > 0 ? (
                <span className="rounded-full bg-brand/15 px-1.5 text-[11px] font-semibold tabular-nums text-brand">
                  {countActiveFilters(filters)}
                </span>
              ) : null}
            </button>

            <span className="text-sm font-medium" data-testid="result-count" aria-live="polite">
              {!data && !error ? (
                <span className="text-muted">Loading…</span>
              ) : (
                <>
                  {(data?.total ?? 0).toLocaleString('en-CA')}{' '}
                  <span className="font-normal text-muted">{data?.total === 1 ? 'job' : 'jobs'}</span>
                </>
              )}
            </span>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted">
                Sort
                <select
                  className="input w-auto py-1.5 text-sm"
                  value={filters.sort === 'match' && !matchScores ? 'relevance' : (filters.sort ?? 'relevance')}
                  onChange={(e) => update({ sort: e.target.value as SortKey, page: 1 })}
                >
                  {(matchScores ? [MATCH_SORT, ...SORTS] : SORTS).map((s) => (
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
                    setVisiblePages(1);
                  }}
                />
                Infinite scroll
              </label>
            </div>

            <ActiveFilters filters={filters} facets={data?.facets ?? null} onChange={update} onReset={reset} />
          </div>

          {error ? (
            <div className="card border-warn/40 p-4 text-sm text-warn">
              {error}
              <button type="button" className="btn ml-3" onClick={() => window.location.reload()}>
                Retry
              </button>
            </div>
          ) : null}

          {/* Skeleton until results exist, not merely until the data file has
              loaded: in the frame between the two, the count read "0 jobs" and
              the empty state flashed "No postings match these filters." */}
          {!data && !error ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={i} className="card h-36 animate-pulse bg-surface2" />
              ))}
            </div>
          ) : null}

          {data && jobs.length === 0 ? (
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
                matchScore={matchScores?.get(job.id)}
                onTagClick={(kind, value) =>
                  // Certifications live in their own list on each posting, so
                  // a CISSP tag filtered as a skill used to match nothing.
                  kind === 'cert'
                    ? update({ certifications: [...new Set([...(filters.certifications ?? []), value])], page: 1 })
                    : update({ skills: [...new Set([...(filters.skills ?? []), value])], page: 1 })
                }
              />
            ))}
          </div>

          {infinite ? <div ref={sentinelRef} className="h-8" aria-hidden /> : null}

          {!infinite && data ? (
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              onChange={(p) => {
                update({ page: p });
                // The pager sits under the last card; without this the new
                // page opened scrolled to its bottom.
                const top = resultsRef.current;
                if (top) window.scrollTo({ top: top.getBoundingClientRect().top + window.scrollY - 88, behavior: 'smooth' });
              }}
            />
          ) : null}

          {data ? <DeepLinks links={data.deepLinks} /> : null}
        </div>
      </div>
    </div>
  );
}
