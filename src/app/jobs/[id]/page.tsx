import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { findJob, readSnapshot } from '@/lib/snapshot';
import { relativeTime } from '@/lib/normalize/dates';
import { formatSalary } from '@/lib/normalize/salary';
import { CATEGORY_LABELS, EMPLOYMENT_LABELS, EXPERIENCE_LABELS } from '@/lib/types';
import { SaveButton } from '@/components/SaveButton';
import { MarkViewed } from '@/components/MarkViewed';

// Prerender one page per posting. `dynamicParams = false` makes an unknown id
// render the 404 page instead of attempting a server render, which is what the
// static export needs — there is no server to fall back to.
export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ id: string }[]> {
  const { jobs } = await readSnapshot();
  return jobs.map((job) => ({ id: job.id }));
}

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const job = await findJob(id);
    if (!job) return { title: 'Job not found' };
    return {
      title: `${job.title} — ${job.company}`,
      description: job.summary || `${job.title} at ${job.company}, ${job.city ?? job.locationRaw}.`,
    };
  } catch {
    return { title: 'Job' };
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

function TagList({ items, tone = 'default' }: { items: string[]; tone?: 'default' | 'brand' }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span key={i} className={tone === 'brand' ? 'tag-cert' : 'tag'}>
          {i}
        </span>
      ))}
    </div>
  );
}

export default async function JobPage({ params }: Props) {
  const { id } = await params;
  const job = await findJob(id);
  if (!job) notFound();

  const salary = formatSalary(job.salary);
  const r = job.requirements;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <MarkViewed id={job.id} />

      <article className="card p-6">
        <Link href="/" className="text-sm text-brand hover:underline">
          ← Back to search
        </Link>

        <h1 className="mt-3 text-2xl font-semibold leading-tight">{job.title}</h1>
        <p className="mt-1 text-base text-muted">
          <span className="font-medium text-ink">{job.company}</span>
          {job.city ? ` · ${job.city}` : ''}
          {job.region ? ` (${job.region})` : ''}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="badge">{CATEGORY_LABELS[job.category]}</span>
          {job.secondaryCategories.map((c) => (
            <span key={c} className="badge">
              {CATEGORY_LABELS[c]}
            </span>
          ))}
          {job.workArrangement !== 'unknown' ? (
            <span className="badge capitalize">{job.workArrangement}</span>
          ) : null}
          {job.experienceLevel !== 'unknown' ? <span className="badge">{EXPERIENCE_LABELS[job.experienceLevel]}</span> : null}
          {job.employmentType !== 'unknown' ? <span className="badge">{EMPLOYMENT_LABELS[job.employmentType]}</span> : null}
          {job.isPathwayRole ? (
            <span className="badge badge-alert">Pathway into cyber</span>
          ) : null}
          {job.isExpired ? <span className="badge text-muted">Likely expired</span> : null}
        </div>

        <div className="mt-5 border-t border-line pt-5">
          {job.descriptionHtml ? (
            // Sanitised at ingest time by lib/normalize/html.ts.
            // eslint-disable-next-line react/no-danger
            <div className="prose-job" dangerouslySetInnerHTML={{ __html: job.descriptionHtml }} />
          ) : (
            <div className="prose-job whitespace-pre-wrap">{job.description || 'No description provided by the source.'}</div>
          )}
        </div>

        <p className="mt-6 border-t border-line pt-4 text-xs text-muted">
          Indexed from {job.sourceName}. This summary is generated automatically from the source posting; always read
          the original listing before applying.
        </p>
      </article>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="card p-4">
          <a
            href={job.applyUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="btn btn-primary w-full py-2.5"
          >
            Apply on {job.sourceName.split('·')[0].trim()} ↗
          </a>
          <div className="mt-2">
            <SaveButton job={job} />
          </div>
          {job.alsoPostedOn.length > 0 ? (
            <div className="mt-3 border-t border-line pt-3">
              <p className="label">Also posted on</p>
              <ul className="mt-1 space-y-1 text-sm">
                {job.alsoPostedOn.map((a) => (
                  <li key={a.url}>
                    <a href={a.url} target="_blank" rel="noopener noreferrer nofollow" className="link">
                      {a.sourceName} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="card space-y-3 p-4">
          <h2 className="text-sm font-semibold">At a glance</h2>
          <dl className="space-y-3">
            <Field label="Posted">
              {relativeTime(job.postedAt)}
              {job.postedAt ? (
                <span className="text-muted"> · {new Date(job.postedAt).toLocaleDateString('en-CA')}</span>
              ) : null}
            </Field>
            <Field label="Location">{job.locationRaw}</Field>
            <Field label="Salary">{salary ?? <span className="text-muted">Not disclosed</span>}</Field>
            <Field label="Experience required">{r.yearsExperience ?? EXPERIENCE_LABELS[job.experienceLevel]}</Field>
            <Field label="Education">{r.education.length ? r.education.join(', ') : <span className="text-muted">Not specified</span>}</Field>
            <Field label="Relevance score">
              <span title="How strongly this posting matches cybersecurity criteria">{job.relevanceScore}/100</span>
            </Field>
          </dl>
        </div>

        {r.certifications.length ? (
          <div className="card p-4">
            <h2 className="mb-2 text-sm font-semibold">Certifications mentioned</h2>
            <TagList items={r.certifications} tone="brand" />
          </div>
        ) : null}

        {r.requiredSkills.length ? (
          <div className="card p-4">
            <h2 className="mb-2 text-sm font-semibold">Required skills &amp; tools</h2>
            <TagList items={r.requiredSkills} />
          </div>
        ) : null}

        {r.preferredSkills.length ? (
          <div className="card p-4">
            <h2 className="mb-2 text-sm font-semibold">Preferred / nice-to-have</h2>
            <TagList items={r.preferredSkills} />
          </div>
        ) : null}

        {r.technologies.length ? (
          <div className="card p-4">
            <h2 className="mb-2 text-sm font-semibold">Technologies</h2>
            <TagList items={r.technologies} />
          </div>
        ) : null}
      </aside>
    </div>
  );
}
