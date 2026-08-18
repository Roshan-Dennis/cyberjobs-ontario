'use client';

import { useEffect, useState } from 'react';
import { onStorageChange, savedJobs } from '@/lib/client/storage';
import type { Job } from '@/lib/types';

export function SaveButton({ job, compact = false }: { job: Job; compact?: boolean }) {
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    setSaved(savedJobs.has(job.id));
    return onStorageChange(() => setSaved(savedJobs.has(job.id)));
  }, [job.id]);

  function toggle() {
    const next = savedJobs.toggle({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.city ?? job.locationRaw,
      applyUrl: job.applyUrl,
      savedAt: new Date().toISOString(),
      status: 'saved',
    });
    setSaved(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      className={`btn ${compact ? 'px-2 py-1 text-xs' : ''} ${saved ? 'border-brand text-brand' : ''}`}
      title={saved ? 'Remove from saved jobs' : 'Save this job'}
    >
      <span aria-hidden>{ready && saved ? '★' : '☆'}</span>
      <span className={compact ? 'sr-only' : ''}>{saved ? 'Saved' : 'Save'}</span>
    </button>
  );
}
