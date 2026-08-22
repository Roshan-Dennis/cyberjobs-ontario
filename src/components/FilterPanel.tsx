'use client';

import { useState } from 'react';
import type { Facet, JobFilters, JobSearchResult } from '@/lib/types';
import { EXPERIENCE_LEVELS, EXPERIENCE_LABELS } from '@/lib/types';

interface Props {
  filters: JobFilters;
  facets: JobSearchResult['facets'] | null;
  total: number;
  onChange: (patch: Partial<JobFilters>) => void;
  onReset: () => void;
}

const DATE_OPTIONS: { label: string; value: number | undefined }[] = [
  { label: 'Any time', value: undefined },
  { label: 'Today', value: 1 },
  { label: '3 days', value: 3 },
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
];

function Section({
  title,
  children,
  defaultOpen = true,
  count,
  empty = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
  empty?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // A group with no options and nothing selected cannot be acted on, so it is
  // dropped entirely rather than rendered as a row of "No options".
  if (empty) return null;
  // Each filter group is its own bordered card. Grouping by outline rather than
  // by divider line means a long sidebar still parses as discrete choices
  // instead of one continuous wall of checkboxes.
  return (
    <section className="rounded-lg border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface2"
        aria-expanded={open}
      >
        <span className="label">
          {title}
          {count ? <span className="ml-1 normal-case text-accent">({count})</span> : null}
        </span>
        <span aria-hidden className="text-sm leading-none text-muted">
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? <div className="space-y-1.5 border-t border-line px-3 py-3">{children}</div> : null}
    </section>
  );
}

function CheckList({
  facets,
  selected,
  onToggle,
  limit = 8,
  emptyLabel = 'No options',
}: {
  facets: Facet[];
  selected: string[];
  onToggle: (value: string) => void;
  limit?: number;
  emptyLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (facets.length === 0) return <p className="text-xs text-muted">{emptyLabel}</p>;
  const visible = expanded ? facets : facets.slice(0, limit);

  return (
    <>
      {visible.map((f) => (
        <label key={f.value} className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 rounded border-line accent-[rgb(var(--accent))]"
            checked={selected.includes(f.value)}
            onChange={() => onToggle(f.value)}
          />
          <span className="min-w-0 flex-1 truncate" title={f.label}>
            {f.label}
          </span>
          <span className="shrink-0 text-xs text-muted">{f.count}</span>
        </label>
      ))}
      {facets.length > limit ? (
        <button type="button" className="text-xs text-brand hover:underline" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less' : `Show ${facets.length - limit} more`}
        </button>
      ) : null}
    </>
  );
}

export function FilterPanel({ filters, facets, total, onChange, onReset }: Props) {
  const toggler =
    (key: keyof JobFilters) =>
    (value: string): void => {
      const current = (filters[key] as string[] | undefined) ?? [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      onChange({ [key]: next.length ? next : undefined, page: 1 } as Partial<JobFilters>);
    };

  const activeCount =
    (filters.experience?.length ?? 0) +
    (filters.categories?.length ?? 0) +
    (filters.arrangement?.length ?? 0) +
    (filters.employment?.length ?? 0) +
    (filters.cities?.length ?? 0) +
    (filters.companies?.length ?? 0) +
    (filters.skills?.length ?? 0) +
    (filters.certifications?.length ?? 0) +
    (filters.sources?.length ?? 0) +
    (filters.postedWithinDays ? 1 : 0) +
    (filters.salaryMin ? 1 : 0) +
    (filters.hasSalary ? 1 : 0) +
    (filters.onlyPathway ? 1 : 0) +
    (filters.includeExpired ? 1 : 0);

  const experienceFacets: Facet[] = EXPERIENCE_LEVELS.map((level) => {
    const found = facets?.experience.find((f) => f.value === level);
    return { value: level, label: EXPERIENCE_LABELS[level], count: found?.count ?? 0 };
  }).filter((f) => f.count > 0 || (filters.experience ?? []).includes(f.value as never));

  return (
    <aside className="card p-3" aria-label="Filters">
      <div className="mb-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">
            Filters{' '}
            {activeCount > 0 ? (
              <span className="ml-0.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-xs font-semibold text-accent">
                {activeCount}
              </span>
            ) : null}
          </h2>
          <span className="text-xs tabular-nums text-muted">{total.toLocaleString('en-CA')} jobs</span>
        </div>
        {/* Always present, disabled when there is nothing to clear — a control
            that appears and disappears makes the panel jump as you filter. */}
        <button
          type="button"
          onClick={onReset}
          disabled={activeCount === 0}
          className="btn mt-2.5 w-full py-1.5 text-xs"
        >
          Clear all filters
        </button>
      </div>

      <div className="space-y-2">

      <Section title="Date posted">
        <div className="flex flex-wrap gap-1.5">
          {DATE_OPTIONS.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => onChange({ postedWithinDays: o.value, postedFrom: undefined, postedTo: undefined, page: 1 })}
              className={`chip ${filters.postedWithinDays === o.value ? 'chip-active' : ''}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {/* Stacked, not side by side: two date fields in a 118px column clip
            "mm/dd/yyyy" and its picker glyph in every browser we checked. */}
        <div className="mt-2 grid gap-2">
          <label className="block text-xs text-muted">
            From
            <input
              type="date"
              className="input mt-1"
              value={filters.postedFrom ?? ''}
              onChange={(e) => onChange({ postedFrom: e.target.value || undefined, postedWithinDays: undefined, page: 1 })}
            />
          </label>
          <label className="block text-xs text-muted">
            To
            <input
              type="date"
              className="input mt-1"
              value={filters.postedTo ?? ''}
              onChange={(e) => onChange({ postedTo: e.target.value || undefined, postedWithinDays: undefined, page: 1 })}
            />
          </label>
        </div>
      </Section>

      <Section title="Experience level" count={filters.experience?.length} empty={experienceFacets.length === 0}>
        <CheckList
          facets={experienceFacets}
          selected={filters.experience ?? []}
          onToggle={toggler('experience')}
          limit={12}
        />
      </Section>

      <Section title="Work arrangement" count={filters.arrangement?.length} empty={(facets?.arrangement ?? []).length === 0}>
        <CheckList facets={facets?.arrangement ?? []} selected={filters.arrangement ?? []} onToggle={toggler('arrangement')} limit={6} />
      </Section>

      <Section title="Job category" count={filters.categories?.length} empty={(facets?.categories ?? []).length === 0}>
        <CheckList facets={facets?.categories ?? []} selected={filters.categories ?? []} onToggle={toggler('categories')} limit={10} />
      </Section>

      <Section title="Location" count={filters.cities?.length} empty={(facets?.cities ?? []).length === 0}>
        <CheckList facets={facets?.cities ?? []} selected={filters.cities ?? []} onToggle={toggler('cities')} limit={10} />
      </Section>

      <Section title="Employment type" count={filters.employment?.length} defaultOpen={false} empty={(facets?.employment ?? []).length === 0}>
        <CheckList facets={facets?.employment ?? []} selected={filters.employment ?? []} onToggle={toggler('employment')} limit={8} />
      </Section>

      <Section title="Company" count={filters.companies?.length} defaultOpen={false} empty={(facets?.companies ?? []).length === 0}>
        <CheckList facets={facets?.companies ?? []} selected={filters.companies ?? []} onToggle={toggler('companies')} limit={10} />
      </Section>

      <Section title="Certifications" count={filters.certifications?.length} defaultOpen={false} empty={(facets?.certifications ?? []).length === 0}>
        <CheckList
          facets={facets?.certifications ?? []}
          selected={filters.certifications ?? []}
          onToggle={toggler('certifications')}
          limit={10}
          emptyLabel="No certifications extracted for the current results"
        />
      </Section>

      <Section title="Skills & tools" count={filters.skills?.length} defaultOpen={false} empty={(facets?.skills ?? []).length === 0}>
        <CheckList facets={facets?.skills ?? []} selected={filters.skills ?? []} onToggle={toggler('skills')} limit={12} />
      </Section>

      <Section title="Salary" defaultOpen={false}>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-line accent-[rgb(var(--accent))]"
            checked={Boolean(filters.hasSalary)}
            onChange={(e) => onChange({ hasSalary: e.target.checked || undefined, page: 1 })}
          />
          Only jobs with a published salary
        </label>
        <label className="mt-2 block text-xs text-muted">
          Minimum annual salary (CAD)
          <input
            type="number"
            min={0}
            step={5000}
            placeholder="e.g. 80000"
            className="input mt-1"
            value={filters.salaryMin ?? ''}
            onChange={(e) => onChange({ salaryMin: e.target.value ? Number(e.target.value) : undefined, page: 1 })}
          />
        </label>
      </Section>

      <Section title="Source" count={filters.sources?.length} defaultOpen={false} empty={(facets?.sources ?? []).length === 0}>
        <CheckList facets={facets?.sources ?? []} selected={filters.sources ?? []} onToggle={toggler('sources')} limit={12} />
      </Section>

      <Section title="Options" defaultOpen={false}>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-line accent-[rgb(var(--accent))]"
            checked={Boolean(filters.onlyPathway)}
            onChange={(e) => onChange({ onlyPathway: e.target.checked || undefined, page: 1 })}
          />
          Only &ldquo;pathway into cyber&rdquo; roles
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-line accent-[rgb(var(--accent))]"
            checked={filters.includePathway === false}
            onChange={(e) => onChange({ includePathway: e.target.checked ? false : undefined, page: 1 })}
          />
          Hide pathway / adjacent IT roles
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-line accent-[rgb(var(--accent))]"
            checked={Boolean(filters.includeExpired)}
            onChange={(e) => onChange({ includeExpired: e.target.checked || undefined, page: 1 })}
          />
          Include likely-expired postings
        </label>
      </Section>
      </div>
    </aside>
  );
}
