'use client';

import type { JobFilters, JobSearchResult } from '@/lib/types';
import { CATEGORY_LABELS, EMPLOYMENT_LABELS, EXPERIENCE_LABELS } from '@/lib/types';
import { COUNTRY_LABELS } from '@/lib/query';
import { PROVINCE_NAMES as CA_PROVINCE_NAMES, US_STATE_NAMES } from '@/lib/taxonomy/canada';

const REGION_NAMES: Record<string, string> = {
  ...CA_PROVINCE_NAMES,
  ...US_STATE_NAMES,
  other: 'Remote / other',
};

const ARRANGEMENT_NAMES: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
  unknown: 'Arrangement not specified',
};

interface Pill {
  key: string;
  label: string;
  remove: Partial<JobFilters>;
}

type ListKey = 'countries' | 'provinces' | 'experience' | 'arrangement' | 'categories' | 'employment' | 'cities' | 'companies' | 'skills' | 'certifications' | 'sources';

/**
 * Everything currently narrowing the results, as removable pills above the
 * list. With most filters folded away in the sidebar, this is where a reader
 * sees what is applied and undoes any one of them in a click.
 */
export function ActiveFilters({
  filters,
  facets,
  onChange,
  onReset,
}: {
  filters: JobFilters;
  facets: JobSearchResult['facets'] | null;
  onChange: (patch: Partial<JobFilters>) => void;
  onReset: () => void;
}) {
  const pills: Pill[] = [];

  const list = (key: ListKey, label: (v: string) => string) => {
    const values = (filters[key] as string[] | undefined) ?? [];
    for (const v of values) {
      const rest = values.filter((x) => x !== v);
      pills.push({ key: `${key}:${v}`, label: label(v), remove: { [key]: rest.length ? rest : undefined, page: 1 } });
    }
  };
  const sourceName = (v: string) => facets?.sources.find((f) => f.value === v)?.label ?? v;

  if (filters.postedWithinDays) {
    pills.push({
      key: 'within',
      label: filters.postedWithinDays === 1 ? 'Posted today' : `Last ${filters.postedWithinDays} days`,
      remove: { postedWithinDays: undefined, page: 1 },
    });
  }
  if (filters.postedFrom) pills.push({ key: 'from', label: `From ${filters.postedFrom}`, remove: { postedFrom: undefined, page: 1 } });
  if (filters.postedTo) pills.push({ key: 'to', label: `To ${filters.postedTo}`, remove: { postedTo: undefined, page: 1 } });
  list('experience', (v) => EXPERIENCE_LABELS[v as keyof typeof EXPERIENCE_LABELS] ?? v);
  list('arrangement', (v) => ARRANGEMENT_NAMES[v] ?? v);
  list('countries', (v) => COUNTRY_LABELS[v] ?? v);
  list('provinces', (v) => REGION_NAMES[v] ?? v);
  list('cities', (v) => (v === 'Other' ? 'Other locations' : v));
  list('categories', (v) => CATEGORY_LABELS[v as keyof typeof CATEGORY_LABELS] ?? v);
  list('employment', (v) => EMPLOYMENT_LABELS[v as keyof typeof EMPLOYMENT_LABELS] ?? v);
  list('companies', (v) => v);
  list('certifications', (v) => v);
  list('skills', (v) => v);
  list('sources', sourceName);
  if (filters.salaryMin) {
    pills.push({ key: 'salaryMin', label: `$${filters.salaryMin.toLocaleString('en-CA')}+`, remove: { salaryMin: undefined, page: 1 } });
  }
  if (filters.hasSalary) pills.push({ key: 'hasSalary', label: 'Salary listed', remove: { hasSalary: undefined, page: 1 } });
  if (filters.onlyPathway) pills.push({ key: 'onlyPathway', label: 'Roles that lead into security', remove: { onlyPathway: undefined, page: 1 } });
  if (filters.includePathway === false) {
    pills.push({ key: 'hidePathway', label: 'IT pathway roles hidden', remove: { includePathway: undefined, page: 1 } });
  }
  if (filters.includeExpired) pills.push({ key: 'includeExpired', label: 'Including closed postings', remove: { includeExpired: undefined, page: 1 } });

  if (pills.length === 0) return null;

  return (
    <div className="flex basis-full flex-wrap items-center gap-1.5 border-t border-line pt-2.5" aria-label="Active filters">
      {pills.map((p) => (
        <span
          key={p.key}
          className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 py-0.5 pl-2.5 pr-1 text-xs font-medium text-ink"
        >
          {p.label}
          <button
            type="button"
            onClick={() => onChange(p.remove)}
            aria-label={`Remove filter: ${p.label}`}
            className="grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-brand/20 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <svg aria-hidden viewBox="0 0 16 16" className="h-3 w-3">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </span>
      ))}
      {pills.length > 1 ? (
        <button type="button" onClick={onReset} className="ml-1 text-xs font-medium text-brand hover:underline">
          Clear all
        </button>
      ) : null}
    </div>
  );
}
