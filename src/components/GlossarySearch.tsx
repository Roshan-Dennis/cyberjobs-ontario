'use client';

import { useState } from 'react';
import type { GlossaryTerm } from '@/lib/careers/glossary';

export function GlossarySearch({ terms }: { terms: GlossaryTerm[] }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? terms.filter((t) => `${t.term} ${t.full ?? ''} ${t.definition}`.toLowerCase().includes(needle))
    : terms;
  return (
    <div className="space-y-4">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search terms, e.g. SIEM or clearance"
        aria-label="Search the glossary"
        className="input"
      />
      {shown.length ? (
        <dl className="divide-y divide-line">
          {shown.map((t) => (
            <div key={t.term} className="py-3">
              <dt className="font-semibold">
                {t.term}
                {t.full ? <span className="ml-2 text-sm font-normal text-muted">{t.full}</span> : null}
              </dt>
              <dd className="mt-0.5 text-sm text-muted">{t.definition}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted">No term matches “{q}”.</p>
      )}
    </div>
  );
}
