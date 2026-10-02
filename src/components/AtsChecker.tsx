'use client';

import { useMemo, useState } from 'react';
import type { JobRequirements } from '@/lib/types';
import { scoreResume, WEIGHTS, type AtsScore, type ScoreComponent } from '@/lib/ats/score';
import { formatChecks, suggest, type Suggestion } from '@/lib/ats/suggest';
import { useResume } from '@/lib/client/resume-store';
import { LoadedResumeBar, PrivacyNote, ResumeInput } from '@/components/ResumeInput';

const BAND: Record<AtsScore['band'], { label: string; tone: string; bar: string }> = {
  strong: { label: 'Strong match', tone: 'text-good', bar: 'bg-good' },
  good: { label: 'Good match', tone: 'text-brand', bar: 'bg-brand' },
  partial: { label: 'Partial match', tone: 'text-warn', bar: 'bg-warn' },
  low: { label: 'Low match', tone: 'text-warn', bar: 'bg-warn' },
};

function KeywordChips({ items, tone }: { items: string[]; tone: 'have' | 'missing' }) {
  if (!items.length) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1">
      {items.map((k) => (
        <li
          key={k}
          className={`rounded-full border px-2 py-0.5 text-[11px] ${
            tone === 'have' ? 'border-good/40 bg-good/10 text-ink' : 'border-line bg-surface2 text-muted line-through decoration-muted/40'
          }`}
        >
          {tone === 'have' ? '✓ ' : ''}
          {k}
        </li>
      ))}
    </ul>
  );
}

function ComponentRow({ c }: { c: ScoreComponent }) {
  const [open, setOpen] = useState(false);
  const pct = c.maxPoints ? (c.points / c.maxPoints) * 100 : 0;
  const expandable = c.matched.length + c.missing.length > 0;
  return (
    <li className="py-2">
      <button
        type="button"
        onClick={() => expandable && setOpen((o) => !o)}
        aria-expanded={expandable ? open : undefined}
        className="w-full text-left"
        disabled={!expandable}
      >
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium">{c.label}</span>
          <span className="shrink-0 tabular-nums text-muted">
            <span className="font-semibold text-ink">{c.points}</span> / {c.maxPoints}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface2">
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted">
          {c.detail}
          {expandable ? <span className="ml-1 text-brand">{open ? 'Hide' : 'Show'} keywords</span> : null}
        </p>
      </button>
      {open ? (
        <div className="mt-1">
          <KeywordChips items={c.matched} tone="have" />
          <KeywordChips items={c.missing} tone="missing" />
        </div>
      ) : null}
    </li>
  );
}

function SuggestionItem({ s }: { s: Suggestion }) {
  return (
    <li className="space-y-1.5 py-3">
      <p className="text-sm font-medium">{s.title}</p>
      <p className="text-xs leading-relaxed text-muted">{s.body}</p>
      {s.keywords?.length ? (
        <ul className="flex flex-wrap gap-1">
          {s.keywords.map((k) => (
            <li key={k.keyword} className="rounded-full border border-line bg-surface2 px-2 py-0.5 text-[11px]">
              {k.keyword}
              {k.gain > 0 ? <span className="ml-1 font-semibold tabular-nums text-good">+{k.gain}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {s.rewrites?.length ? (
        <ul className="space-y-1.5">
          {s.rewrites.map((r) => (
            <li key={r.before} className="rounded-md border border-line bg-surface2 p-2 text-xs">
              <p className="text-muted">
                <span className="font-medium text-ink/70">Now: </span>
                {r.before}
              </p>
              <p className="mt-0.5">
                <span className="font-medium text-good">Try: </span>
                {r.after}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {s.examples?.length ? (
        <ul className="space-y-1">
          {s.examples.map((e) => (
            <li key={e} className="rounded-md border border-line bg-surface2 px-2 py-1 text-xs text-muted">
              “{e}”
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Below the Apply button on each job page: scores the reader's resume against
 * this posting's requirements and explains the result. Each posting is scored
 * on its own keywords, so the same resume gets a different, specific result
 * on every job page.
 */
export function AtsChecker({ title, requirements }: { title: string; requirements: JobRequirements }) {
  const resume = useResume();
  const [started, setStarted] = useState(false);
  const job = useMemo(() => ({ title, requirements }), [title, requirements]);

  const result = useMemo(() => {
    if (!resume) return null;
    const score = scoreResume(resume.profile, job);
    return { score, suggestions: suggest(resume.profile, job, score), checks: formatChecks(resume.profile) };
  }, [resume, job]);

  const nothingToMatch =
    requirements.requiredSkills.length + requirements.technologies.length + requirements.preferredSkills.length + requirements.certifications.length === 0;

  return (
    <section className="card p-4" aria-labelledby="ats-heading">
      <h2 id="ats-heading" className="text-sm font-semibold">
        ATS match check
      </h2>
      <p className="mt-1 text-xs text-muted">See how your resume matches this posting, keyword by keyword, and what to improve.</p>

      {!resume && !started ? (
        <div className="mt-3 space-y-2">
          <button type="button" className="btn w-full" onClick={() => setStarted(true)}>
            Check my resume against this job
          </button>
          <p className="text-[11px] text-muted">PDF or Word (.docx), or paste the text. Nothing is stored or sent.</p>
        </div>
      ) : null}

      {!resume && started ? (
        <div className="mt-3">
          <ResumeInput compact />
        </div>
      ) : null}

      {resume && result ? (
        <div className="mt-3 space-y-4">
          <LoadedResumeBar />

          {nothingToMatch ? (
            <p className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
              This posting names no specific skills, tools or certifications, so the score below rests only on title, experience
              and education. Read the full posting for what they want.
            </p>
          ) : null}

          <div aria-live="polite">
            <div className="flex items-end gap-3">
              <p className="text-4xl font-bold tabular-nums leading-none" data-testid="ats-score">
                {result.score.score}
                <span className="text-base font-medium text-muted">/100</span>
              </p>
              <p className={`pb-0.5 text-sm font-semibold ${BAND[result.score.band].tone}`}>{BAND[result.score.band].label}</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface2">
              <div className={`h-full rounded-full ${BAND[result.score.band].bar}`} style={{ width: `${result.score.score}%` }} />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Where the points come from</h3>
            <ul className="divide-y divide-line">
              {result.score.components
                .filter((c) => c.applicable)
                .map((c) => (
                  <ComponentRow key={c.key} c={c} />
                ))}
            </ul>
          </div>

          {result.suggestions.length ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">How to improve it — honestly</h3>
              <ul className="divide-y divide-line">
                {result.suggestions.map((s) => (
                  <SuggestionItem key={s.id} s={s} />
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Can an ATS read it?</h3>
            <ul className="mt-1 space-y-1">
              {result.checks.map((c) => (
                <li key={c.label} className="flex gap-2 text-xs">
                  <span aria-hidden className={c.ok ? 'text-good' : 'text-warn'}>
                    {c.ok ? '✓' : '!'}
                  </span>
                  <span>
                    <span className="font-medium">{c.label}</span>
                    <span className="text-muted"> — {c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <details className="rounded-md border border-line bg-surface2 px-3 py-2 text-xs text-muted">
            <summary className="cursor-pointer font-medium text-ink">How this score is calculated</summary>
            <div className="mt-2 space-y-2 leading-relaxed">
              <p>
                Your resume is matched against the keywords extracted from this posting, using the same skill and tool dictionary
                for both, so “Azure Sentinel” and “Microsoft Sentinel” count as the same tool. Each part has a fixed weight:
                required skills {WEIGHTS.required}, other technologies {WEIGHTS.tools}, preferred skills {WEIGHTS.preferred},
                certifications {WEIGHTS.certifications}, years of experience {WEIGHTS.experience}, education {WEIGHTS.education}{' '}
                and job-title words {WEIGHTS.title}. Parts the posting doesn’t mention are left out and the rest scaled to 100.
              </p>
              <p>
                The same resume and posting always give the same score, and every point is listed above. It is a guide to keyword
                coverage, not a prediction: each employer’s ATS ranks differently, and a person reads the shortlist.
              </p>
            </div>
          </details>

          <PrivacyNote />
        </div>
      ) : null}
    </section>
  );
}
