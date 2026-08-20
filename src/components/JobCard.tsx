'use client';

import Link from 'next/link';
import { relativeTime } from '@/lib/normalize/dates';
import { formatSalary } from '@/lib/normalize/salary';
import { SaveButton } from '@/components/SaveButton';
import { CompanyAvatar } from '@/components/CompanyAvatar';
import {
  ArrangementBadge,
  CategoryBadge,
  EmploymentBadge,
  ExperienceBadge,
  ExpiredBadge,
  PathwayBadge,
  RepostBadge,
} from '@/components/Badges';
import type { Job } from '@/lib/types';

export function JobCard({ job, onTagClick }: { job: Job; onTagClick?: (tech: string) => void }) {
  const salary = formatSalary(job.salary);
  const location = [job.city, job.region].filter(Boolean).join(' · ') || job.locationRaw;
  const tech = job.requirements.technologies.slice(0, 6);
  const certs = job.requirements.certifications.slice(0, 4);

  return (
    <article className={`card-interactive p-4 ${job.isExpired ? 'opacity-70' : ''}`}>
      <div className="flex items-start gap-3">
        <CompanyAvatar company={job.company} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold leading-snug">
                {/* Stretched link: the whole card is the target, but nested
                    buttons stay clickable because they sit above it. */}
                <Link href={`/jobs/${job.id}`} className="hover:text-accent hover:underline">
                  {job.title}
                </Link>
              </h3>
              <p className="mt-0.5 text-sm text-muted">
                <span className="font-medium text-ink">{job.company}</span>
                {location ? <> · {location}</> : null}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
              <span className="text-xs text-muted">{relativeTime(job.postedAt)}</span>
              {salary ? <span className="text-sm font-semibold text-good">{salary}</span> : null}
            </div>
          </div>

          {/* Facts about the job. */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <ArrangementBadge job={job} />
            <ExperienceBadge job={job} />
            <EmploymentBadge job={job} />
            <CategoryBadge job={job} />
            <PathwayBadge job={job} />
            <RepostBadge job={job} />
            <ExpiredBadge job={job} />
          </div>

          {job.summary ? <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-muted">{job.summary}</p> : null}

          {/* What the posting asks for. */}
          {(tech.length > 0 || certs.length > 0) && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {certs.map((c) => (
                <button key={c} type="button" onClick={() => onTagClick?.(c)} className="tag-cert" title={`Filter by ${c}`}>
                  {c}
                </button>
              ))}
              {tech.map((t) => (
                <button key={t} type="button" onClick={() => onTagClick?.(t)} className="tag-button" title={`Filter by ${t}`}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs text-muted">
        <span title={`Indexed from ${job.sourceName}`} className="truncate">
          {job.sourceName}
        </span>
        {job.duplicateCount > 1 ? <span>· also on {job.duplicateCount - 1} other board(s)</span> : null}
        <span className="ml-auto flex items-center gap-2">
          <SaveButton job={job} compact />
          <Link href={`/jobs/${job.id}`} className="btn px-2.5 py-1 text-xs">
            Details
          </Link>
          <a
            href={job.applyUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="btn btn-primary px-2.5 py-1 text-xs"
          >
            Apply ↗
          </a>
        </span>
      </div>
    </article>
  );
}
