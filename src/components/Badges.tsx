import { CATEGORY_LABELS, EMPLOYMENT_LABELS, EXPERIENCE_LABELS } from '@/lib/types';
import type { Job } from '@/lib/types';

/**
 * Two visual families, and the split is deliberate:
 *
 *   badge (solid fill)  — a fact about the job: where, what level, what kind.
 *   tag   (outlined)    — something the posting *asks for*: a skill or cert.
 *
 * Solid reads as attribute, outline reads as requirement. Once the eye learns
 * the difference it can skip whichever half it does not care about, which
 * matters on a card carrying a dozen labels.
 */

const ARRANGEMENT: Record<string, { label: string; className: string }> = {
  remote: { label: 'Remote', className: 'badge-remote' },
  hybrid: { label: 'Hybrid', className: 'badge-hybrid' },
  onsite: { label: 'On-site', className: '' },
  unknown: { label: '', className: '' },
};

export function ArrangementBadge({ job }: { job: Job }) {
  const a = ARRANGEMENT[job.workArrangement];
  if (!a?.label) return null;
  return <span className={`badge ${a.className}`}>{a.label}</span>;
}

export function ExperienceBadge({ job }: { job: Job }) {
  if (job.experienceLevel === 'unknown') return null;
  return <span className="badge">{EXPERIENCE_LABELS[job.experienceLevel]}</span>;
}

export function EmploymentBadge({ job }: { job: Job }) {
  if (job.employmentType === 'unknown') return null;
  return <span className="badge">{EMPLOYMENT_LABELS[job.employmentType]}</span>;
}

export function CategoryBadge({ job }: { job: Job }) {
  return <span className="badge">{CATEGORY_LABELS[job.category]}</span>;
}

export function PathwayBadge({ job }: { job: Job }) {
  if (!job.isPathwayRole) return null;
  return (
    <span
      className="badge badge-alert"
      title="Not a security title, but a realistic stepping-stone role into cybersecurity"
    >
      Pathway into cyber
    </span>
  );
}

export function ExpiredBadge({ job }: { job: Job }) {
  if (!job.isExpired) return null;
  return (
    <span className="badge text-muted" title="No source has listed this recently — it may be filled">
      Likely expired
    </span>
  );
}

export function RepostBadge({ job }: { job: Job }) {
  if (!job.isRepost) return null;
  return (
    <span className="badge text-muted" title="This role was posted before and has been re-listed">
      Repost
    </span>
  );
}
