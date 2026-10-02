import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { readSnapshot } from '@/lib/snapshot';
import { CAREER_BY_SLUG, CAREERS, ENTRY_LABELS } from '@/lib/careers/catalog';
import { boardLink, careerStats } from '@/lib/careers/stats';

export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return CAREERS.map((c) => ({ slug: c.slug }));
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = CAREER_BY_SLUG.get((await params).slug);
  if (!c) return {};
  return { title: `${c.title}: career guide and open jobs in Canada`, description: c.summary };
}

const money = (n: number) => `$${Math.round(n / 1000)}k`;

function Chips({ items, tone = 'plain' }: { items: { name: string; count: number }[]; tone?: 'plain' | 'cert' }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <li key={i.name} className={tone === 'cert' ? 'tag-cert' : 'rounded-full border border-line bg-surface2 px-2.5 py-0.5 text-xs'}>
          {i.name} <span className="tabular-nums opacity-60">{i.count}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function CareerPage({ params }: Props) {
  const career = CAREER_BY_SLUG.get((await params).slug);
  if (!career) notFound();
  const { jobs } = await readSnapshot();
  const s = careerStats(career, jobs);

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <section className="card p-6">
          <p className="text-sm text-muted">
            <Link href="/start" className="link">Start here</Link> /{' '}
            <Link href="/careers" className="link">Career paths</Link>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{career.title}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${career.entry === 'first-job' ? 'bg-good/15 text-good' : 'bg-surface2 text-muted'}`}>
              {ENTRY_LABELS[career.entry]}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">{career.summary}</p>
        </section>

        <section className="card space-y-4 p-6">
          <div>
            <h2 className="font-semibold">What you would do</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {career.work.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-semibold">You might enjoy it if</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {career.enjoyIf.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-semibold">How people get in</h2>
            <p className="mt-2 text-sm leading-relaxed">{career.wayIn}</p>
          </div>
        </section>

        <section className="card p-6" aria-labelledby="learn">
          <h2 id="learn" className="font-semibold">
            Learning path
          </h2>
          <p className="mt-1 text-sm text-muted">Start at the top. Everything marked free costs nothing to begin.</p>
          <ol className="mt-3 space-y-2">
            {career.learn.map((r, i) => (
              <li key={r.url} className="flex gap-3 rounded-lg border border-line bg-surface2 p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">{i + 1}</span>
                <span className="min-w-0">
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-brand hover:underline">
                    {r.name} ↗
                  </a>
                  {r.free ? <span className="ml-2 rounded-full bg-good/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-good">Free</span> : null}
                  <span className="block text-sm text-muted">{r.note}</span>
                </span>
              </li>
            ))}
          </ol>
          <h3 className="mt-5 text-sm font-semibold">Certifications, in the usual order</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            {career.certs.map((c) => (
              <li key={c.name}>
                <span className="font-medium">{c.name}</span> <span className="text-muted">— {c.note}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted">Most certification exams are paid; check the provider for current prices and any discounts or free offers.</p>
        </section>

        {career.next.length ? (
          <section className="card p-6">
            <h2 className="font-semibold">Where this can lead</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {career.next.map((slug) => {
                const n = CAREER_BY_SLUG.get(slug);
                return n ? (
                  <li key={slug}>
                    <Link href={`/careers/${slug}`} className="btn px-3 py-1.5 text-sm">
                      {n.title} →
                    </Link>
                  </li>
                ) : null;
              })}
            </ul>
          </section>
        ) : null}
      </div>

      <aside className="space-y-4 lg:self-start" aria-label="Live job market for this path">
        <section className="card space-y-4 p-5">
          <div>
            <h2 className="text-sm font-semibold">On the board right now</h2>
            <p className="text-xs text-muted">From current postings, updated hourly</p>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              [s.open, 'open'],
              [s.entryLevel, 'entry-level'],
              [s.remote, 'remote'],
            ].map(([n, label]) => (
              <div key={label as string} className="rounded-lg border border-line bg-surface2 py-2">
                <dd className="text-xl font-bold tabular-nums">{n}</dd>
                <dt className="text-[11px] text-muted">{label}</dt>
              </div>
            ))}
          </dl>
          <div>
            <h3 className="label">Pay</h3>
            {s.pay ? (
              <p className="text-sm">
                <span className="font-semibold">{money(s.pay.median)}</span> typical
                <span className="text-muted">
                  {' '}
                  · {money(s.pay.low)}–{money(s.pay.high)} range, from {s.pay.sample} postings that list pay
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted">Too few current postings list pay to give a fair figure.</p>
            )}
          </div>
          {s.topSkills.length ? (
            <div>
              <h3 className="label">Most-requested skills &amp; tools</h3>
              <Chips items={s.topSkills} />
            </div>
          ) : null}
          {s.topCerts.length ? (
            <div>
              <h3 className="label">Most-requested certifications</h3>
              <Chips items={s.topCerts} tone="cert" />
            </div>
          ) : null}
          {s.topEmployers.length ? (
            <div>
              <h3 className="label">Hiring now</h3>
              <ul className="space-y-0.5 text-sm">
                {s.topEmployers.map((e) => (
                  <li key={e.name} className="flex justify-between gap-2">
                    <span className="truncate">{e.name}</span>
                    <span className="tabular-nums text-muted">{e.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="space-y-2">
            <Link href={boardLink(career)} className="btn btn-primary w-full">
              {s.open ? `See all ${s.open} open jobs` : 'Search this path'}
            </Link>
            {s.entryLevel ? (
              <Link href={boardLink(career, '&experience=internship,coop,entry,junior')} className="btn w-full">
                See {s.entryLevel} entry-level jobs
              </Link>
            ) : null}
          </div>
        </section>
      </aside>
    </div>
  );
}
