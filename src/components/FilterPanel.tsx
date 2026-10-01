'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Facet, JobFilters, JobSearchResult } from '@/lib/types';
import { CATEGORY_LABELS, EMPLOYMENT_LABELS, EXPERIENCE_LEVELS, EXPERIENCE_LABELS } from '@/lib/types';
import { countActiveFilters } from '@/lib/query';

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

/** Short province names: they sit in pills, where "British Columbia" wraps. */
const PROVINCE_SHORT: Record<string, string> = {
  ON: 'Ontario',
  BC: 'B.C.',
  QC: 'Quebec',
  AB: 'Alberta',
  other: 'Remote / other',
};

const ARRANGEMENT_NAMES: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
  unknown: 'Not specified',
};

const lookup =
  (map: Record<string, string>) =>
  (value: string): string =>
    map[value] ?? value;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={`h-4 w-4 shrink-0 text-muted transition-transform duration-150 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
    >
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CountBadge({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="rounded-full bg-brand/15 px-1.5 py-px text-[11px] font-semibold tabular-nums text-brand">{n}</span>
  );
}

/**
 * One filter group. Groups are separated by a hairline rather than each being
 * boxed: eighteen stacked boxes read as a wall, while one surface with quiet
 * dividers reads as a single control panel.
 */
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
  const [open, setOpen] = useState(defaultOpen || Boolean(count));
  // Open a collapsed group when something inside it gets selected from
  // elsewhere — clicking a tool tag on a job card ticks "Skills & tools", and a
  // collapsed group hid the very checkbox that undoes it.
  const hadSelection = useRef(Boolean(count));
  useEffect(() => {
    if (count && !hadSelection.current) setOpen(true);
    hadSelection.current = Boolean(count);
  }, [count]);
  const bodyId = useId();
  // A group with no options and nothing selected cannot be acted on, so it is
  // dropped entirely rather than rendered as a row of "No options".
  if (empty) return null;
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md py-3 text-left text-sm font-medium text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <span className="flex items-center gap-2">
          {title}
          <CountBadge n={count} />
        </span>
        <Chevron open={open} />
      </button>
      {open ? (
        <div id={bodyId} className="pb-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}

/** Facets plus any selected value missing from them, so it can be undone. */
function withSelected(facets: Facet[], selected: string[], label: (v: string) => string = (v) => v): Facet[] {
  const missing = selected.filter((v) => !facets.some((f) => f.value === v)).map((v) => ({ value: v, label: label(v), count: 0 }));
  return [...facets, ...missing];
}

/**
 * Multi-select pills, for short lists (experience, arrangement, province).
 * Each pill is a real checkbox laid over its label, so it keeps keyboard,
 * screen-reader and form semantics. Selected pills are tinted with a tick;
 * the solid fill is kept for single-choice pills (date posted), so the two
 * kinds never look alike.
 */
function PillChecks({
  name,
  facets,
  selected,
  onToggle,
  labelFor,
}: {
  name: string;
  facets: Facet[];
  selected: string[];
  onToggle: (value: string) => void;
  /** Label for a selected value that has no results (so no facet to read it from). */
  labelFor?: (value: string) => string;
}) {
  const all = withSelected(facets, selected, labelFor);
  if (all.length === 0) return <p className="text-xs text-muted">No options for the current results</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((f) => {
        const on = selected.includes(f.value);
        return (
          <label
            key={f.value}
            className={`relative inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-within:ring-2 focus-within:ring-accent ${
              on ? 'border-brand/60 bg-brand/15 text-ink' : 'border-line bg-surface2 text-muted hover:border-muted/50 hover:text-ink'
            }`}
          >
            <input
              type="checkbox"
              name={name}
              value={f.value}
              checked={on}
              onChange={() => onToggle(f.value)}
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full opacity-0"
            />
            {on ? (
              <svg aria-hidden viewBox="0 0 16 16" className="h-3 w-3 text-brand">
                <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
            <span>{f.label}</span>
            <span className="tabular-nums opacity-60">{f.count}</span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Groups the reader has expanded with "Show more". Kept outside component
 * state because a group unmounts while another filter leaves it empty, and on
 * return it used to snap back to the short list, hiding what they'd opened.
 */
const expandedGroups = new Set<string>();

/**
 * Checkbox list for longer facets. Shows the top few; a search field appears
 * once there are more than that, so a list of sixty employers is one short
 * list plus a box to type in rather than a scroll.
 */
function CheckList({
  name,
  facets,
  selected,
  onToggle,
  limit = 6,
  emptyLabel = 'No options for the current results',
  searchLabel,
  describe,
  labelFor,
}: {
  /** Form name of the group, e.g. "experience". */
  name: string;
  facets: Facet[];
  selected: string[];
  onToggle: (value: string) => void;
  limit?: number;
  emptyLabel?: string;
  /** Placeholder for the search box, e.g. "Search companies". */
  searchLabel?: string;
  /** Secondary text after a label, e.g. the province of a city. */
  describe?: (value: string) => string | undefined;
  /** Label for a selected value that has no results (so no facet to read it from). */
  labelFor?: (value: string) => string;
}) {
  const [expanded, setExpandedState] = useState(() => expandedGroups.has(name));
  const [query, setQuery] = useState('');
  const setExpanded = (fn: (e: boolean) => boolean) =>
    setExpandedState((e) => {
      const next = fn(e);
      if (next) expandedGroups.add(name);
      else expandedGroups.delete(name);
      return next;
    });

  // A ticked value must stay on screen even when the current results no longer
  // contain it — otherwise the only way to undo it is "Clear all filters".
  const all = withSelected(facets, selected, labelFor);
  if (all.length === 0) return <p className="text-xs text-muted">{emptyLabel}</p>;

  const q = query.trim().toLowerCase();
  const matching = q ? all.filter((f) => f.label.toLowerCase().includes(q) || selected.includes(f.value)) : all;
  const visible =
    expanded || q
      ? matching
      : [...all.filter((f) => selected.includes(f.value)), ...all.filter((f) => !selected.includes(f.value))]
          .slice(0, Math.max(limit, selected.length))
          .sort((a, b) => all.indexOf(a) - all.indexOf(b));
  const hiddenCount = q ? 0 : all.length - visible.length;
  const searchable = Boolean(searchLabel) && all.length > limit;

  return (
    <div className="space-y-1">
      {searchable ? (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchLabel}
          aria-label={searchLabel}
          className="input mb-1.5 py-1.5 text-xs"
        />
      ) : null}
      {visible.map((f) => {
        const extra = describe?.(f.value);
        return (
          <label
            key={f.value}
            className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 text-sm hover:bg-surface2"
          >
            <input
              type="checkbox"
              name={name}
              value={f.value}
              className="h-4 w-4 shrink-0 rounded border-line accent-[rgb(var(--brand))]"
              checked={selected.includes(f.value)}
              onChange={() => onToggle(f.value)}
            />
            <span className="min-w-0 flex-1 truncate" title={f.label}>
              {f.label}
              {extra ? <span className="ml-1.5 text-xs text-muted">{extra}</span> : null}
            </span>
            <span className="text-xs tabular-nums text-muted">{f.count}</span>
          </label>
        );
      })}
      {q && matching.length === 0 ? <p className="px-1 text-xs text-muted">No match for &ldquo;{query}&rdquo;</p> : null}
      {hiddenCount > 0 || (expanded && !q) ? (
        <button
          type="button"
          className="px-1 pt-1 text-xs font-medium text-brand hover:underline"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? 'Show less' : `Show ${hiddenCount} more`}
        </button>
      ) : null}
    </div>
  );
}

function OptionCheck({
  name,
  checked,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1 text-sm hover:bg-surface2">
      <input
        type="checkbox"
        name={name}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-[rgb(var(--brand))]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

/**
 * Minimum-salary box. It commits after typing pauses (or on Enter/blur) rather
 * than on every keystroke: typing "80000" used to push five URLs, filter on
 * $8, $80, $800… on the way, and write each into search history.
 */
function SalaryInput({ value, onCommit }: { value: number | undefined; onCommit: (v: number | undefined) => void }) {
  const [text, setText] = useState(value != null ? String(value) : '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setText(value != null ? String(value) : ''), [value]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const commit = (raw: string) => {
    if (timer.current) clearTimeout(timer.current);
    const n = raw.trim() === '' ? undefined : Number(raw);
    const next = n != null && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
    if (next !== value) onCommit(next);
  };

  return (
    <input
      type="number"
      min={0}
      step={5000}
      inputMode="numeric"
      placeholder="e.g. 80000"
      aria-label="Minimum annual salary (CAD)"
      className="input mt-1"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => commit(raw), 600);
      }}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
      }}
    />
  );
}

/** Filters that live under "More filters". */
function countSecondary(f: JobFilters): number {
  return (
    (f.employment?.length ?? 0) +
    (f.companies?.length ?? 0) +
    (f.certifications?.length ?? 0) +
    (f.skills?.length ?? 0) +
    (f.sources?.length ?? 0) +
    (f.salaryMin ? 1 : 0) +
    (f.hasSalary ? 1 : 0) +
    (f.onlyPathway ? 1 : 0) +
    (f.includePathway === false ? 1 : 0) +
    (f.includeExpired ? 1 : 0)
  );
}

export function FilterPanel({ filters, facets, onChange, onReset }: Props) {
  const toggler =
    (key: keyof JobFilters) =>
    (value: string): void => {
      const current = (filters[key] as string[] | undefined) ?? [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      onChange({ [key]: next.length ? next : undefined, page: 1 } as Partial<JobFilters>);
    };

  const activeCount = countActiveFilters(filters);
  const canReset = activeCount > 0 || Boolean(filters.q) || Boolean(filters.sort && filters.sort !== 'relevance');

  // Five groups cover nearly every search; the rest wait behind one toggle.
  // It opens by itself when one of its filters is set from elsewhere (a
  // certification tag on a card, a shared link), so a filter is never active
  // and out of sight.
  const secondaryCount = countSecondary(filters);
  const [moreOpen, setMoreOpen] = useState(secondaryCount > 0);
  const hadSecondary = useRef(secondaryCount > 0);
  useEffect(() => {
    if (secondaryCount > 0 && !hadSecondary.current) setMoreOpen(true);
    hadSecondary.current = secondaryCount > 0;
  }, [secondaryCount]);

  const customDates = Boolean(filters.postedFrom || filters.postedTo);
  const [showCustom, setShowCustom] = useState(customDates);
  useEffect(() => {
    if (customDates) setShowCustom(true);
  }, [customDates]);

  // 'unknown' is listed last rather than omitted: roughly a third of postings
  // state no seniority, and dropping the option meant anyone filtering for
  // junior work silently lost that third of the board.
  const experienceFacets: Facet[] = [...EXPERIENCE_LEVELS, 'unknown' as const]
    .map((level) => {
      const found = facets?.experience.find((f) => f.value === level);
      return { value: level, label: EXPERIENCE_LABELS[level], count: found?.count ?? 0 };
    })
    .filter((f) => f.count > 0 || (filters.experience ?? []).includes(f.value as never));

  const provinceFacets: Facet[] = (facets?.provinces ?? []).map((f) => ({ ...f, label: PROVINCE_SHORT[f.value] ?? f.label }));

  // One city list for every province, each city tagged with its province, in
  // place of five separate per-province sections.
  const cityProvince = new Map<string, string>();
  for (const [prov, group] of Object.entries(facets?.citiesByProvince ?? {})) {
    for (const f of group) if (!cityProvince.has(f.value)) cityProvince.set(f.value, prov);
  }
  const cityFacets: Facet[] = (facets?.cities ?? []).map((f) => ({
    ...f,
    label: f.value === 'Other' ? 'Other locations' : f.value,
  }));

  const anyTime = !filters.postedWithinDays && !customDates && !showCustom;
  const locationCount = (filters.provinces?.length ?? 0) + (filters.cities?.length ?? 0);

  return (
    <aside className="card px-4 pb-2 pt-3" aria-label="Filters">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          Filters
          <CountBadge n={activeCount} />
        </h2>
        {/* Always present, disabled when there is nothing to clear — a control
            that appears and disappears makes the panel jump as you filter. */}
        <button
          type="button"
          onClick={() => {
            setShowCustom(false);
            onReset();
          }}
          disabled={!canReset}
          className="rounded-md text-sm font-medium text-brand hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:text-muted/60 disabled:no-underline"
        >
          Clear all filters
        </button>
      </div>

      <div className="divide-y divide-line">
      <Section title="Date posted" count={filters.postedWithinDays || customDates ? 1 : undefined}>
        <div className="flex flex-wrap gap-1.5">
          {DATE_OPTIONS.map((o) => {
            const on = o.value === undefined ? anyTime : filters.postedWithinDays === o.value && !showCustom;
            return (
              <button
                key={o.label}
                type="button"
                onClick={() => {
                  setShowCustom(false);
                  onChange({ postedWithinDays: o.value, postedFrom: undefined, postedTo: undefined, page: 1 });
                }}
                className={`chip ${on ? 'chip-active' : ''}`}
                aria-pressed={on}
              >
                {o.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setShowCustom(true);
              if (filters.postedWithinDays) onChange({ postedWithinDays: undefined, page: 1 });
            }}
            className={`chip ${showCustom ? 'chip-active' : ''}`}
            aria-pressed={showCustom}
          >
            Custom
          </button>
        </div>
        {/* Stacked, not side by side: two date fields in a narrow column clip
            "mm/dd/yyyy" and its picker glyph in every browser we checked. */}
        {showCustom ? (
          <div className="mt-3 grid gap-2">
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
        ) : null}
      </Section>

      <Section
        title="Experience level"
        count={filters.experience?.length}
        empty={experienceFacets.length === 0 && !(filters.experience?.length ?? 0)}
      >
        <PillChecks name="experience" facets={experienceFacets} selected={filters.experience ?? []} onToggle={toggler('experience')} />
      </Section>

      <Section
        title="Work arrangement"
        count={filters.arrangement?.length}
        empty={(facets?.arrangement ?? []).length === 0 && !(filters.arrangement?.length ?? 0)}
      >
        <PillChecks
          name="arrangement"
          facets={facets?.arrangement ?? []}
          selected={filters.arrangement ?? []}
          onToggle={toggler('arrangement')}
          labelFor={lookup(ARRANGEMENT_NAMES)}
        />
      </Section>

      <Section
        title="Location"
        count={locationCount}
        empty={provinceFacets.length === 0 && cityFacets.length === 0 && locationCount === 0}
      >
        {provinceFacets.length > 1 || (filters.provinces?.length ?? 0) > 0 ? (
          <PillChecks
            name="provinces"
            facets={provinceFacets}
            selected={filters.provinces ?? []}
            onToggle={toggler('provinces')}
            labelFor={lookup(PROVINCE_SHORT)}
          />
        ) : null}
        <div className="mt-3">
          <CheckList
            name="cities"
            facets={cityFacets}
            selected={filters.cities ?? []}
            onToggle={toggler('cities')}
            limit={5}
            labelFor={(v) => (v === 'Other' ? 'Other locations' : v)}
            searchLabel="Search cities"
            describe={(city) => {
              const p = cityProvince.get(city);
              return p && p !== 'other' ? p : undefined;
            }}
          />
        </div>
      </Section>

      <Section
        title="Job category"
        count={filters.categories?.length}
        empty={(facets?.categories ?? []).length === 0 && !(filters.categories?.length ?? 0)}
      >
        <CheckList
          name="categories"
          facets={facets?.categories ?? []}
          selected={filters.categories ?? []}
          onToggle={toggler('categories')}
          limit={6}
          labelFor={lookup(CATEGORY_LABELS as Record<string, string>)}
        />
      </Section>

      <div>
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          aria-controls="more-filters"
          className="flex w-full items-center justify-between gap-2 rounded-md py-3 text-left text-sm font-medium text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="flex items-center gap-2">
            More filters
            <CountBadge n={secondaryCount} />
          </span>
          <Chevron open={moreOpen} />
        </button>
        <p className={`-mt-1 pb-3 text-xs text-muted ${moreOpen ? 'hidden' : ''}`}>
          Salary, employment type, company, certifications, skills, source
        </p>
      </div>

      {moreOpen ? (
        <div id="more-filters" className="divide-y divide-line">
          <Section title="Salary" defaultOpen={false} count={(filters.hasSalary ? 1 : 0) + (filters.salaryMin ? 1 : 0)}>
            <OptionCheck name="hasSalary" checked={Boolean(filters.hasSalary)} onChange={(c) => onChange({ hasSalary: c || undefined, page: 1 })}>
              Only jobs with a published salary
            </OptionCheck>
            <label className="mt-2 block px-1 text-xs text-muted">
              Minimum annual salary (CAD)
              <SalaryInput value={filters.salaryMin} onCommit={(v) => onChange({ salaryMin: v, page: 1 })} />
            </label>
          </Section>

          <Section
            title="Employment type"
            count={filters.employment?.length}
            defaultOpen={false}
            empty={(facets?.employment ?? []).length === 0 && !(filters.employment?.length ?? 0)}
          >
            <PillChecks
              name="employment"
              facets={facets?.employment ?? []}
              selected={filters.employment ?? []}
              onToggle={toggler('employment')}
              labelFor={lookup(EMPLOYMENT_LABELS as Record<string, string>)}
            />
          </Section>

          <Section
            title="Company"
            count={filters.companies?.length}
            defaultOpen={false}
            empty={(facets?.companies ?? []).length === 0 && !(filters.companies?.length ?? 0)}
          >
            <CheckList
              name="companies"
              facets={facets?.companies ?? []}
              selected={filters.companies ?? []}
              onToggle={toggler('companies')}
              searchLabel="Search companies"
            />
          </Section>

          <Section
            title="Certifications"
            count={filters.certifications?.length}
            defaultOpen={false}
            empty={(facets?.certifications ?? []).length === 0 && !(filters.certifications?.length ?? 0)}
          >
            <CheckList
              name="certifications"
              facets={facets?.certifications ?? []}
              selected={filters.certifications ?? []}
              onToggle={toggler('certifications')}
              searchLabel="Search certifications"
              emptyLabel="No certifications listed in the current results"
            />
          </Section>

          <Section
            title="Skills & tools"
            count={filters.skills?.length}
            defaultOpen={false}
            empty={(facets?.skills ?? []).length === 0 && !(filters.skills?.length ?? 0)}
          >
            <CheckList
              name="skills"
              facets={facets?.skills ?? []}
              selected={filters.skills ?? []}
              onToggle={toggler('skills')}
              searchLabel="Search skills and tools"
            />
          </Section>

          <Section
            title="Source"
            count={filters.sources?.length}
            defaultOpen={false}
            empty={(facets?.sources ?? []).length === 0 && !(filters.sources?.length ?? 0)}
          >
            <CheckList name="sources" facets={facets?.sources ?? []} selected={filters.sources ?? []} onToggle={toggler('sources')} limit={8} />
          </Section>

          <Section
            title="Options"
            defaultOpen={false}
            count={(filters.onlyPathway ? 1 : 0) + (filters.includePathway === false ? 1 : 0) + (filters.includeExpired ? 1 : 0)}
          >
            <OptionCheck name="onlyPathway" checked={Boolean(filters.onlyPathway)} onChange={(c) => onChange({ onlyPathway: c || undefined, page: 1 })}>
              Only roles that lead into security
            </OptionCheck>
            <OptionCheck
              name="hidePathway"
              checked={filters.includePathway === false}
              onChange={(c) => onChange({ includePathway: c ? false : undefined, page: 1 })}
            >
              Hide IT roles that lead into security
            </OptionCheck>
            <OptionCheck name="includeExpired" checked={Boolean(filters.includeExpired)} onChange={(c) => onChange({ includeExpired: c || undefined, page: 1 })}>
              Include postings that may have closed
            </OptionCheck>
          </Section>
        </div>
      ) : null}
      </div>
    </aside>
  );
}
