'use client';

import { useEffect, useRef, useState } from 'react';
import { onStorageChange, searchHistory, type SearchHistoryEntry } from '@/lib/client/storage';

const SUGGESTIONS = [
  'SOC analyst',
  'security analyst',
  'incident response',
  'GRC',
  'penetration tester',
  'cloud security',
  'IAM',
  'DevSecOps',
  'co-op',
  'entry level',
  'threat intelligence',
  'vulnerability management',
];

export function SearchBar({
  value,
  onSubmit,
  onApplyHistory,
}: {
  value: string;
  onSubmit: (q: string) => void;
  onApplyHistory: (params: string) => void;
}) {
  const [text, setText] = useState(value);
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setText(value), [value]);

  useEffect(() => {
    setHistory(searchHistory.all());
    return onStorageChange(() => setHistory(searchHistory.all()));
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setFocused(false);
          onSubmit(text.trim());
        }}
        className="flex gap-2"
        role="search"
      >
        <div className="input input-search relative flex flex-1 items-center gap-2 p-0 pl-3">
          <span aria-hidden className="pointer-events-none text-base leading-none text-muted">
            ⌕
          </span>
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder='Search titles, companies, skills — try "SOC analyst" or splunk -senior'
            aria-label="Search cybersecurity jobs"
            className="w-full bg-transparent py-2.5 pr-3 text-sm text-ink outline-none placeholder:text-muted"
          />
        </div>
        <button type="submit" className="btn btn-primary px-5">
          Search
        </button>
      </form>

      {focused ? (
        <div className="absolute z-30 mt-1 w-full card p-3">
          {history.length > 0 ? (
            <>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="label">Recent searches</span>
                <button
                  type="button"
                  className="text-xs text-brand hover:underline"
                  onClick={() => {
                    searchHistory.clear();
                    setHistory([]);
                  }}
                >
                  Clear
                </button>
              </div>
              <ul className="mb-3 space-y-0.5">
                {history.slice(0, 6).map((h) => (
                  <li key={h.params + h.at}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-surface2"
                      onClick={() => {
                        setFocused(false);
                        onApplyHistory(h.params);
                      }}
                    >
                      <span aria-hidden className="text-muted">
                        ↺
                      </span>
                      <span className="min-w-0 flex-1 truncate">{h.query || '(all jobs, filtered)'}</span>
                      <span className="shrink-0 text-xs text-muted">{h.resultCount} hits</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <span className="label">Try</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="tag-button"
                onClick={() => {
                  setText(s);
                  setFocused(false);
                  onSubmit(s);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
