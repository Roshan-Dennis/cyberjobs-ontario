/**
 * The resume being checked, held in memory only.
 *
 * Deliberately not localStorage, sessionStorage, IndexedDB or a cookie: the
 * resume lives in a module variable, so it survives moving between the search
 * page and job pages within this tab and disappears when the tab is closed or
 * reloaded. Nothing is written anywhere.
 */
import { useSyncExternalStore } from 'react';
import { parseResume, type ResumeProfile } from '@/lib/ats/resume';

export interface LoadedResume {
  /** File name, or "Pasted text". */
  name: string;
  profile: ResumeProfile;
}

let current: LoadedResume | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const resumeStore = {
  get: (): LoadedResume | null => current,
  set(text: string, name: string): LoadedResume {
    current = { name, profile: parseResume(text) };
    emit();
    return current;
  },
  clear() {
    current = null;
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useResume(): LoadedResume | null {
  return useSyncExternalStore(resumeStore.subscribe, resumeStore.get, () => null);
}
