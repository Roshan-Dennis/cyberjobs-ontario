'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Job, JobFilters } from '@/lib/types';
import { advise } from '@/lib/ats/advisor';
import { useResume } from '@/lib/client/resume-store';
import { LoadedResumeBar, ResumeInput } from '@/components/ResumeInput';

function scoreTone(score: number): string {
  if (score >= 75) return 'border-good/50 bg-good/15 text-good';
  if (score >= 60) return 'border-brand/50 bg-brand/15 text-brand';
  return 'border-line bg-surface2 text-muted';
}

export function MatchPill({ score, className = '' }: { score: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${scoreTone(score)} ${className}`}
      title="How well your resume covers this posting's keywords (see the job page for the breakdown)"
    >
      {score}% match
    </span>
  );
}

/**
 * Top of the search page: one resume, scored against every open posting with
 * the same checker each job page uses, summarised into what to apply for,
 * where the reader is strongest and what would open up more postings.
 */
export function ResumeAdvisor({ dataset, onApply }: { dataset: Job[] | null; onApply: (patch: Partial<JobFilters>) => void }) {
  const resume = useResume();
  const [open, setOpen] = useState(false);
  // "/#match" (linked from the Start here guide) opens the advisor directly.
  useEffect(() => {
    if (window.location.hash === '#match') {
      setOpen(true);
      document.getElementById('match')?.scrollIntoView({ block: 'start' });
    }
  }, []);
  const advice = useMemo(() => (resume && dataset ? advise(resume.profile, dataset) : null), [resume, dataset]);
  const expanded = open || Boolean(resume);

  return (
    <section id="match" className="card scroll-mt-20 p-4" aria-labelledby="advisor-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="advisor-heading" className="text-base font-semibold">
            {resume ? 'Your personalised job match' : 'Which of these jobs fit you?'}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {resume
              ? 'Every open posting, scored against your resume. Open any job for its full breakdown and suggestions.'
              : 'Add your resume to see your best matches, the roles and levels to target, and the skills that would open up more postings.'}
          </p>
        </div>
        {!expanded ? (
          <button type="button" className="btn btn-primary shrink-0" onClick={() => setOpen(true)}>
            Match my resume
          </button>
        ) : !resume ? (
          <button type="button" className="btn shrink-0" onClick={() => setOpen(false)}>
            Close
          </button>
        ) : null}
      </div>

      {expanded && !resume ? (
        <div className="mt-4 max-w-xl">
          <ResumeInput />
        </div>
      ) : null}

      {resume && !advice ? <p className="mt-4 text-sm text-muted">Loading postings…</p> : null}

      {resume && advice ? (
        <div className="mt-4 space-y-5">
          <LoadedResumeBar />

          <div className="flex flex-wrap gap-1.5 text-xs" aria-label="What was read from your resume">
            <span className="rounded-full border border-line bg-surface2 px-2.5 py-1">
              {resume.profile.years != null ? `About ${resume.profile.years} years of dated experience` : 'No dated roles found'}
            </span>
            {resume.profile.education.length ? (
              <span className="rounded-full border border-line bg-surface2 px-2.5 py-1">
                {resume.profile.education.slice().sort((a, b) => b.rank - a.rank)[0].label}
              </span>
            ) : null}
            <span className="rounded-full border border-line bg-surface2 px-2.5 py-1">
              {resume.profile.terms.size - resume.profile.certifications.length} skills &amp; tools recognised
            </span>
            {resume.profile.certifications.map((c) => (
              <span key={c.canonical} className="tag-cert">
                {c.canonical}
              </span>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-semibold">What to do next</h3>
            <ol className="mt-2 space-y-1.5 text-sm">
              {advice.guidance.map((g, i) => (
                <li key={g} className="flex gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand">
                    {i + 1}
                  </span>
                  <span className="text-muted">{g}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Your top matches at your level</h3>
                <button type="button" className="text-xs font-medium text-brand hover:underline" onClick={() => onApply({ sort: 'match', page: 1 })}>
                  Sort all jobs by match
                </button>
              </div>
              <ol className="mt-2 divide-y divide-line">
                {advice.matches.map((m) => (
                  <li key={m.job.id} className="flex items-center gap-3 py-2">
                    <MatchPill score={m.result.score} className="w-[6.25rem] shrink-0 justify-center" />
                    <span className="min-w-0 flex-1">
                      <Link href={`/jobs/${m.job.id}`} className="block truncate text-sm font-medium hover:text-brand hover:underline">
                        {m.job.title}
                      </Link>
                      <span className="block truncate text-xs text-muted">
                        {m.job.company} · {m.job.city ?? m.job.locationRaw}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="space-y-5">
              {advice.categories.length ? (
                <div>
                  <h3 className="text-sm font-semibold">Best-fit areas</h3>
                  <ul className="mt-2 space-y-2">
                    {advice.categories.map((c) => (
                      <li key={c.category} className="flex items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{c.label}</span>
                          <span className="block text-xs text-muted">
                            Top matches average {c.score}% · {c.openings} open
                          </span>
                        </span>
                        <button
                          type="button"
                          className="btn shrink-0 px-2.5 py-1 text-xs"
                          onClick={() => onApply({ categories: [c.category], sort: 'match', page: 1 })}
                        >
                          Show jobs
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div>
                <h3 className="text-sm font-semibold">Levels to target</h3>
                <p className="mt-1 text-xs text-muted">{advice.levelReason}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {advice.levels.map((l) => (
                    <span key={l.level} className="rounded-full border border-line bg-surface2 px-2.5 py-1 text-xs">
                      {l.label} <span className="tabular-nums text-muted">{l.openings}</span>
                    </span>
                  ))}
                  <button
                    type="button"
                    className="text-xs font-medium text-brand hover:underline"
                    onClick={() => onApply({ experience: advice.levels.map((l) => l.level), sort: 'match', page: 1 })}
                  >
                    Show these levels
                  </button>
                </div>
              </div>

              {advice.gaps.length ? (
                <div>
                  <h3 className="text-sm font-semibold">Skills that would open up more jobs</h3>
                  <p className="mt-1 text-xs text-muted">
                    Asked for by your near matches (scoring 40–74) but not found in your resume. Add any you genuinely have; the rest are
                    the most useful to learn next.
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {advice.gaps.map((g) => (
                      <li key={g.keyword} className="rounded-full border border-line bg-surface2 px-2.5 py-1 text-xs">
                        {g.keyword} <span className="tabular-nums text-muted">· {g.postings} jobs</span>
                      </li>
                    ))}
                    {advice.certGaps.map((g) => (
                      <li key={g.keyword} className="tag-cert">
                        {g.keyword} <span className="tabular-nums opacity-70">· {g.postings} jobs</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
