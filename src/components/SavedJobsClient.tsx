'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { onStorageChange, savedJobs, searchHistory, type SavedJob, type SearchHistoryEntry } from '@/lib/client/storage';

const STATUSES: SavedJob['status'][] = ['saved', 'applied', 'interviewing', 'rejected', 'offer'];

const STATUS_STYLE: Record<string, string> = {
  saved: '',
  applied: 'border-brand/40 bg-brand/10 text-brand',
  interviewing: 'border-warn/40 bg-warn/10 text-warn',
  rejected: 'border-line bg-surface2 text-muted',
  offer: 'border-good/40 bg-good/10 text-good',
};

export function SavedJobsClient() {
  const [jobs, setJobs] = useState<SavedJob[]>([]);
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const refresh = () => {
      setJobs(savedJobs.all());
      setHistory(searchHistory.all());
    };
    refresh();
    return onStorageChange(refresh);
  }, []);

  const visible = useMemo(
    () => (filter === 'all' ? jobs : jobs.filter((j) => (j.status ?? 'saved') === filter)),
    [jobs, filter],
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: jobs.length };
    for (const s of STATUSES) map[s as string] = jobs.filter((j) => (j.status ?? 'saved') === s).length;
    return map;
  }, [jobs]);

  if (!mounted) return <div className="card h-64 animate-pulse bg-surface2" />;

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h1 className="text-lg font-semibold">Saved jobs</h1>
        <p className="mt-0.5 text-sm text-muted">
          Stored in this browser only — nothing is sent to a server. Track where each application stands.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            className={`chip ${filter === 'all' ? 'chip-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({counts.all})
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={`chip capitalize ${filter === s ? 'chip-active' : ''}`}
              onClick={() => setFilter(s as string)}
            >
              {s} ({counts[s as string] ?? 0})
            </button>
          ))}
          {jobs.length > 0 ? (
            <button
              type="button"
              className="ml-auto text-xs text-brand hover:underline"
              onClick={() => {
                if (window.confirm('Remove all saved jobs?')) savedJobs.clear();
              }}
            >
              Clear all
            </button>
          ) : null}
        </div>
      </section>

      {visible.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm font-medium">Nothing saved yet.</p>
          <p className="mt-1 text-sm text-muted">Use the ☆ button on any job card to keep track of it.</p>
          <Link href="/" className="btn btn-primary mt-4">
            Browse jobs
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((job) => (
            <li key={job.id} className="card p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">
                    <Link href={`/jobs/${job.id}`} className="hover:text-brand hover:underline">
                      {job.title}
                    </Link>
                  </h2>
                  <p className="text-sm text-muted">
                    {job.company} · {job.location}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Saved {new Date(job.savedAt).toLocaleDateString('en-CA')}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={`input w-auto py-1 text-xs capitalize ${STATUS_STYLE[job.status ?? 'saved']}`}
                    value={job.status ?? 'saved'}
                    onChange={(e) => savedJobs.update(job.id, { status: e.target.value as SavedJob['status'] })}
                    aria-label={`Application status for ${job.title}`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <a
                    href={job.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="btn px-2.5 py-1 text-xs"
                  >
                    Apply ↗
                  </a>
                  <button
                    type="button"
                    className="btn px-2.5 py-1 text-xs"
                    onClick={() => savedJobs.remove(job.id)}
                    aria-label={`Remove ${job.title}`}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <textarea
                className="input mt-3 min-h-[60px] text-sm"
                placeholder="Notes — contacts, application date, follow-ups…"
                defaultValue={job.note ?? ''}
                onBlur={(e) => savedJobs.update(job.id, { note: e.target.value })}
              />
            </li>
          ))}
        </ul>
      )}

      {history.length > 0 ? (
        <section className="card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Search history</h2>
            <button type="button" className="text-xs text-brand hover:underline" onClick={() => searchHistory.clear()}>
              Clear
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            {history.map((h) => (
              <li key={h.params + h.at} className="flex items-center gap-2 text-sm">
                <Link href={h.params ? `/?${h.params}` : '/'} className="min-w-0 flex-1 truncate link">
                  {h.query || '(all jobs, filtered)'}
                </Link>
                <span className="shrink-0 text-xs text-muted">
                  {h.resultCount} hits · {new Date(h.at).toLocaleDateString('en-CA')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
