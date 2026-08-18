import type { Metadata } from 'next';
import Link from 'next/link';
import { ALL_SOURCES } from '@/lib/sources/registry';
import { config } from '@/lib/config';

export const metadata: Metadata = { title: 'Sources & how this works' };
export const dynamic = 'force-dynamic';

const NOT_INDEXED = [
  {
    name: 'LinkedIn',
    reason:
      'LinkedIn retired its public job-search API and its User Agreement prohibits automated collection. Indexing it would breach those terms.',
  },
  {
    name: 'Indeed',
    reason:
      'The Indeed Publisher API is closed to new applicants and Indeed prohibits scraping of its search results.',
  },
  {
    name: 'Glassdoor',
    reason: 'No public job-search API is offered and scraping is prohibited by its terms of use.',
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="card p-6">
        <h1 className="text-xl font-semibold">How {config.appName} works</h1>
        <p className="mt-3 text-sm leading-relaxed">
          Every few hours a scheduled job calls each connector below, pulls the current postings, normalises them into a
          single schema, filters out anything that is not a cybersecurity or credible cyber-pathway role, removes
          duplicates across sources, extracts skills, certifications and salary, and ranks the result. The site reads
          from that store, so what you see is live data rather than a static snapshot.
        </p>
        <ul className="mt-4 space-y-1.5 text-sm">
          <li>
            <strong>Geography:</strong> every municipality in Ontario is matched against a built-in gazetteer, and
            remote roles open to anywhere in Canada are included.
          </li>
          <li>
            <strong>Deduplication:</strong> postings are fingerprinted on normalised title + employer + location, so the
            same job on three boards appears once with links to the others.
          </li>
          <li>
            <strong>Expiry:</strong> postings that stop appearing at their source, or that pass the age threshold, are
            marked as likely expired and hidden by default.
          </li>
          <li>
            <strong>Pathway roles:</strong> help desk, NOC, sysadmin, network and cloud roles with real security
            exposure are flagged separately so you can include or exclude them.
          </li>
        </ul>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Sources indexed</h2>
        <p className="mt-1 text-sm text-muted">
          Each connector uses an API the vendor publishes for public consumption, or a site whose robots.txt permits
          crawling — in which case the stated crawl delay is honoured.
        </p>
        <ul className="mt-4 space-y-3">
          {ALL_SOURCES.map((s) => (
            <li key={s.id} className="border-t border-line pt-3 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <a href={s.homepage} target="_blank" rel="noopener noreferrer" className="font-medium link">
                  {s.name}
                </a>
                <span className={`chip ${s.isEnabled() ? 'border-good/40 bg-good/10 text-good' : ''}`}>
                  {s.isEnabled() ? 'Enabled' : 'Not configured'}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{s.access}</p>
              {!s.isEnabled() && s.disabledReason ? (
                <p className="mt-1 text-xs text-muted">{s.disabledReason()}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Deliberately not indexed</h2>
        <ul className="mt-3 space-y-3">
          {NOT_INDEXED.map((n) => (
            <li key={n.name}>
              <p className="font-medium">{n.name}</p>
              <p className="text-sm text-muted">{n.reason}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm">
          Instead, every search page offers pre-filtered deep links that open those sites with your current keywords,
          location and date window applied.{' '}
          <Link href="/" className="link">
            Try a search
          </Link>
          .
        </p>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Accuracy</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Skills, certifications, seniority and salary are extracted automatically from the posting text and will
          occasionally be wrong. Every job page links to the original listing — treat that as the source of truth
          before applying. Nothing on this site is fabricated: if a field is unknown it is shown as unknown.
        </p>
      </section>
    </div>
  );
}
