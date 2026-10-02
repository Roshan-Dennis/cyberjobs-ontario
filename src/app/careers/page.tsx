import type { Metadata } from 'next';
import Link from 'next/link';
import { readSnapshot } from '@/lib/snapshot';
import { CAREER_BY_SLUG, CAREER_MAP, CAREERS, ENTRY_LABELS } from '@/lib/careers/catalog';
import { careerStats } from '@/lib/careers/stats';

export const metadata: Metadata = {
  title: 'Cybersecurity career paths in Canada',
  description: 'The main cybersecurity jobs explained in plain language, with live job counts, skills and pay from current Canadian postings.',
};

export const dynamic = 'force-static';

export default async function CareersPage() {
  const { jobs } = await readSnapshot();
  const stats = new Map(CAREERS.map((c) => [c.slug, careerStats(c, jobs)]));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="card p-6">
        <p className="text-sm text-muted">
          <Link href="/start" className="link">Start here</Link> / Career paths
        </p>
        <h1 className="mt-1 text-2xl font-bold">Cybersecurity career paths</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          What each job involves, who it suits and how people get in. Job counts, skills and pay come from the postings on this
          board and update every hour.
        </p>
      </section>

      <section className="card p-5" aria-labelledby="map-heading">
        <h2 id="map-heading" className="text-lg font-semibold">
          How careers usually progress
        </h2>
        <p className="mt-1 text-sm text-muted">There is no single route — but most people start in one of the first column’s roles.</p>
        <ol className="mt-4 grid gap-3 md:grid-cols-3">
          {CAREER_MAP.map((stage, i) => (
            <li key={stage.stage} className="relative rounded-lg border border-line bg-surface2 p-3">
              <p className="text-sm font-semibold">
                {i + 1}. {stage.stage}
                <span className="ml-2 text-xs font-normal text-muted">{stage.note}</span>
              </p>
              <ul className="mt-2 space-y-1.5">
                {stage.slugs.map((slug) => {
                  const c = CAREER_BY_SLUG.get(slug);
                  if (!c) return null;
                  return (
                    <li key={slug}>
                      <Link
                        href={`/careers/${slug}`}
                        className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm hover:border-brand/60"
                      >
                        <span>{c.title}</span>
                        <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted">{stats.get(slug)?.open ?? 0} open</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {i < CAREER_MAP.length - 1 ? (
                <span aria-hidden className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-lg text-muted md:block">
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <ul className="grid gap-4 sm:grid-cols-2">
        {CAREERS.map((c) => {
          const s = stats.get(c.slug)!;
          return (
            <li key={c.slug}>
              <Link href={`/careers/${c.slug}`} className="card card-interactive flex h-full flex-col gap-2 p-5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{c.title}</h2>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${c.entry === 'first-job' ? 'bg-good/15 text-good' : 'bg-surface2 text-muted'}`}>
                    {ENTRY_LABELS[c.entry]}
                  </span>
                </div>
                <p className="text-sm text-muted">{c.summary}</p>
                <p className="mt-auto pt-1 text-xs text-muted">
                  <span className="font-semibold tabular-nums text-ink">{s.open}</span> open
                  {s.entryLevel ? (
                    <>
                      {' '}· <span className="font-semibold tabular-nums text-ink">{s.entryLevel}</span> entry-level
                    </>
                  ) : null}
                  {s.pay ? <> · typical pay ${Math.round(s.pay.median / 1000)}k</> : null}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
