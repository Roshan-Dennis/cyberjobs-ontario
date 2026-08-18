import { CATEGORY_LABELS, EMPLOYMENT_LABELS, EXPERIENCE_LABELS } from '@/lib/types';
import type { Job } from '@/lib/types';

const ARRANGEMENT: Record<string, { label: string; className: string }> = {
  remote: { label: 'Remote', className: 'bg-good/15 text-good border-good/30' },
  hybrid: { label: 'Hybrid', className: 'bg-brand/15 text-brand border-brand/30' },
  onsite: { label: 'On-site', className: '' },
  unknown: { label: '', className: '' },
};

export function ArrangementBadge({ job }: { job: Job }) {
  const a = ARRANGEMENT[job.workArrangement];
  if (!a?.label) return null;
  return <span className={`chip ${a.className}`}>{a.label}</span>;
}

export function ExperienceBadge({ job }: { job: Job }) {
  if (job.experienceLevel === 'unknown') return null;
  return <span className="chip">{EXPERIENCE_LABELS[job.experienceLevel]}</span>;
}

export function EmploymentBadge({ job }: { job: Job }) {
  if (job.employmentType === 'unknown') return null;
  return <span className="chip">{EMPLOYMENT_LABELS[job.employmentType]}</span>;
}

export function CategoryBadge({ job }: { job: Job }) {
  return <span className="chip">{CATEGORY_LABELS[job.category]}</span>;
}

export function PathwayBadge({ job }: { job: Job }) {
  if (!job.isPathwayRole) return null;
  return (
    <span
      className="chip border-warn/40 bg-warn/15 text-warn"
      title="Not a security title, but a realistic stepping-stone role into cybersecurity"
    >
      Pathway into cyber
    </span>
  );
}

export function ExpiredBadge({ job }: { job: Job }) {
  if (!job.isExpired) return null;
  return <span className="chip border-line bg-surface2 text-muted">Likely expired</span>;
}

export function RepostBadge({ job }: { job: Job }) {
  if (!job.isRepost) return null;
  return (
    <span className="chip" title="This role was posted before and has been re-listed">
      Repost
    </span>
  );
}
