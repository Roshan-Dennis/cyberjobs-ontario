'use client';

/** Small typed wrapper around localStorage with graceful degradation. */

const PREFIX = 'cjo-';

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(`${PREFIX}change`, { detail: key }));
  } catch {
    /* quota or private mode */
  }
}

export interface SavedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  applyUrl: string;
  savedAt: string;
  note?: string;
  status?: 'saved' | 'applied' | 'interviewing' | 'rejected' | 'offer';
}

export const savedJobs = {
  all: (): SavedJob[] => read<SavedJob[]>('saved', []),
  has: (id: string): boolean => read<SavedJob[]>('saved', []).some((j) => j.id === id),
  toggle: (job: SavedJob): boolean => {
    const list = read<SavedJob[]>('saved', []);
    const idx = list.findIndex((j) => j.id === job.id);
    if (idx >= 0) {
      list.splice(idx, 1);
      write('saved', list);
      return false;
    }
    list.unshift(job);
    write('saved', list.slice(0, 500));
    return true;
  },
  update: (id: string, patch: Partial<SavedJob>): void => {
    const list = read<SavedJob[]>('saved', []);
    const idx = list.findIndex((j) => j.id === id);
    if (idx < 0) return;
    list[idx] = { ...list[idx], ...patch };
    write('saved', list);
  },
  remove: (id: string): void => {
    write('saved', read<SavedJob[]>('saved', []).filter((j) => j.id !== id));
  },
  clear: (): void => write('saved', []),
};

export interface SearchHistoryEntry {
  query: string;
  params: string;
  at: string;
  resultCount: number;
}

export const searchHistory = {
  all: (): SearchHistoryEntry[] => read<SearchHistoryEntry[]>('history', []),
  push: (entry: SearchHistoryEntry): void => {
    if (!entry.query && !entry.params) return;
    const list = read<SearchHistoryEntry[]>('history', []).filter((e) => e.params !== entry.params);
    list.unshift(entry);
    write('history', list.slice(0, 30));
  },
  clear: (): void => write('history', []),
};

export const viewedJobs = {
  all: (): string[] => read<string[]>('viewed', []),
  add: (id: string): void => {
    const list = read<string[]>('viewed', []).filter((x) => x !== id);
    list.unshift(id);
    write('viewed', list.slice(0, 400));
  },
};

export function onStorageChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const listener = () => handler();
  window.addEventListener(`${PREFIX}change`, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(`${PREFIX}change`, listener);
    window.removeEventListener('storage', listener);
  };
}
