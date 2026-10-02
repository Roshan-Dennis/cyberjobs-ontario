'use client';

import { useState } from 'react';
import Link from 'next/link';
import { QUIZ, scoreQuiz } from '@/lib/careers/quiz';

export interface QuizCareer {
  slug: string;
  title: string;
  summary: string;
  entryLabel: string;
  open: number;
  entryLevel: number;
  jobsHref: string;
}

/**
 * Five questions, one at a time, then three suggested paths with the reasons
 * and live job counts. Nothing is saved; answers live only in this component.
 */
export function CareerQuiz({ careers }: { careers: QuizCareer[] }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const done = step >= QUIZ.length;
  const bySlug = new Map(careers.map((c) => [c.slug, c]));

  if (done) {
    const results = scoreQuiz(answers);
    return (
      <div className="space-y-3" aria-live="polite">
        <p className="text-sm font-medium">Paths that fit your answers</p>
        <ol className="space-y-2">
          {results.map((r, i) => {
            const c = bySlug.get(r.slug);
            if (!c) return null;
            return (
              <li key={r.slug} className="rounded-lg border border-line bg-surface2 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    <span className="mr-2 text-brand">{i + 1}.</span>
                    {c.title}
                  </p>
                  <span className="text-xs text-muted">{c.entryLabel}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{c.summary}</p>
                <p className="mt-1 text-xs text-muted">Suggested because {[...new Set(r.reasons)].join(', ')}.</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <Link href={`/careers/${c.slug}`} className="link">
                    Learn about this path
                  </Link>
                  {c.open > 0 ? (
                    <Link href={c.jobsHref} className="link">
                      See {c.open} open job{c.open === 1 ? '' : 's'}
                      {c.entryLevel ? ` (${c.entryLevel} entry-level)` : ''}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted">No open postings right now</span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          className="text-sm font-medium text-brand hover:underline"
          onClick={() => {
            setAnswers({});
            setStep(0);
          }}
        >
          Take the quiz again
        </button>
      </div>
    );
  }

  const q = QUIZ[step];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>
          Question {step + 1} of {QUIZ.length}
        </span>
        {step > 0 ? (
          <button type="button" className="font-medium text-brand hover:underline" onClick={() => setStep((s) => s - 1)}>
            ← Back
          </button>
        ) : null}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface2" aria-hidden>
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(step / QUIZ.length) * 100}%` }} />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{q.question}</legend>
        <div className="grid gap-2">
          {q.options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setAnswers((a) => ({ ...a, [q.id]: o.id }));
                setStep((s) => s + 1);
              }}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors hover:border-brand/60 hover:bg-brand/10 ${
                answers[q.id] === o.id ? 'border-brand/60 bg-brand/10' : 'border-line bg-surface2'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
