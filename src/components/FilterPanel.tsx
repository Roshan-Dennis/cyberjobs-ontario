'use client';

import { useEffect, useRef, useState } from 'react';
import type { Facet, JobFilters, JobSearchResult } from '@/lib/types';
import { EXPERIENCE_LEVELS, EXPERIENCE_LABELS } from '@/lib/types';
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

/**
 * City sections, in the order they appear in the sidebar. Ontario leads because
 * it carries most of the postings; 'other' collects remote and unplaced roles.
 */
const CITY_GROUPS: { key: string; title: string }[] = [
  { key: 'ON', title: 'Ontario cities' },
  { key: 'QC', title: 'Quebec cities' },
  { key: 'BC', title: 'B.C. cities' },
  { key: 'AB', title: 'Alberta cities' },
  { key: 'other', title: 'Remote & unplaced' },
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
  const [open, setOpen] = useState(defaultOpen || Boolean(count));
  // Open a collapsed group when something inside it gets selected from
  // elsewhere — clicking a tool tag on a job card ticks "Skills & tools", and a
  // collapsed group hid the very checkbox that undoes it.
  const hadSelection = useRef(Boolean(count));
  useEffect(() => {
    if (count && !hadSelection.current) setOpen(true);
    hadSelection.current = Boolean(count);
  }, [count]);
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

/**
 * Groups the reader has expanded with "Show more". Kept outside component
 * state because a group unmounts while another filter leaves it empty, and on
 * return it used to snap back to the short list, hiding what they'd opened.
 */
const expandedGroups = new Set<string>();

function CheckList({
  name,
  facets,
  selected,
  onToggle,
  limit = 8,
  emptyLabel = 'No options',
}: {
  /** Form name of the group, e.g. "experience". */
  name: string;
  facets: Facet[];
  selected: string[];
  onToggle: (value: string) => void;
  limit?: number;
  emptyLabel?: string;
}) {
  const [expanded, setExpandedState] = useState(() => expandedGroups.has(name));
  const setExpanded = (fn: (e: boolean) => boolean) =>
    setExpandedState((e) => {
      const next = fn(e);
      if (next) expandedGroups.add(name);
      else expandedGroups.delete(name);
      return next;
    });
  // A ticked value must stay on screen even when the current results no longer
  // contain it — otherwise the only way to undo it is "Clear all filters".
  // Selected entries missing from the facet list are added back with a zero
  // count, and selected entries always sort into the visible slice.
  const missing = selected
    .filter((v) => !facets.some((f) => f.value === v))
    .map((v) => ({ value: v, label: v, count: 0 }));
  const all = [...facets, ...missing];
  if (all.length === 0) return <p className="text-xs text-muted">{emptyLabel}</p>;
  const ordered = expanded
    ? all
    : [...all.filter((f) => selected.includes(f.value)), ...all.filter((f) => !selected.includes(f.value))]
        .slice(0, Math.max(limit, selected.length))
        .sort((a, b) => all.indexOf(a) - all.indexOf(b));
  const visible = ordered;
  const hiddenCount = all.length - visible.length;

  return (
    <>
      {visible.map((f) => (
        <label key={f.value} className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={name}
            value={f.value}
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
      {hiddenCount > 0 || expanded ? (
        <button type="button" className="text-xs text-brand hover:underline" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less' : `Show ${hiddenCount} more`}
        </button>
      ) : null}
    </>
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

export function FilterPanel({ filters, facets, total, onChange, onReset }: Props) {
  const toggler =
    (key: keyof JobFilters) =>
    (value: string): void => {
      const current = (filters[key] as string[] | undefined) ?? [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      onChange({ [key]: next.length ? next : undefined, page: 1 } as Partial<JobFilters>);
    };

  const activeCount = countActiveFilters(filters);
  const canReset = activeCount > 0 || Boolean(filters.q) || Boolean(filters.sort && filters.sort !== 'relevance');

  // 'unknown' is listed last rather than omitted: roughly a third of postings
  // state no seniority, and dropping the option meant anyone filtering for
  // junior work silently lost that third of the board.
  const experienceFacets: Facet[] = [...EXPERIENCE_LEVELS, 'unknown' as const]
    .map((level) => {
      const found = facets?.experience.find((f) => f.value === level);
      return { value: level, label: EXPERIENCE_LABELS[level], count: found?.count ?? 0 };
    })
    .filter((f) => f.count > 0 || (filters.experience ?? []).includes(f.value as never));

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
          disabled={!canReset}
          className="btn mt-2.5 w-full py-1.5 text-xs"
        >
          Clear all filters
        </button>
      </div>

      <div className="space-y-2">

      {/* Province leads the sidebar: with four provinces covered it is the
          first cut most people make, and it is the one filter whose absence
          would make the board look wrong to someone outside Ontario. */}
      <Section title="Province" count={filters.provinces?.length} empty={(facets?.provinces ?? []).length <= 1 && !(filters.provinces?.length ?? 0) && !(filters.cities?.length ?? 0)}>
        <CheckList
          name="provinces"
          facets={facets?.provinces ?? []}
          selected={filters.provinces ?? []}
          onToggle={toggler('provinces')}
          limit={6}
        />
      </Section>

      <Section title="Date posted">
        <div className="flex flex-wrap gap-1.5">
          {DATE_OPTIONS.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => onChange({ postedWithinDays: o.value, postedFrom: undefined, postedTo: undefined, page: 1 })}
              className={`chip ${
                (o.value === undefined
                  ? !filters.postedWithinDays && !filters.postedFrom && !filters.postedTo
                  : filters.postedWithinDays === o.value)
                  ? 'chip-active'
                  : ''
              }`}
              aria-pressed={
                o.value === undefined
                  ? !filters.postedWithinDays && !filters.postedFrom && !filters.postedTo
                  : filters.postedWithinDays === o.value
              }
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

      <Section title="Experience level" count={filters.experience?.length} empty={experienceFacets.length === 0 && !(filters.experience?.length ?? 0)}>
        <CheckList
          name="experience"
          facets={experienceFacets}
          selected={filters.experience ?? []}
          onToggle={toggler('experience')}
          limit={12}
        />
      </Section>

      <Section title="Work arrangement" count={filters.arrangement?.length} empty={(facets?.arrangement ?? []).length === 0 && !(filters.arrangement?.length ?? 0)}>
        <CheckList name="arrangement" facets={facets?.arrangement ?? []} selected={filters.arrangement ?? []} onToggle={toggler('arrangement')} limit={6} />
      </Section>

      <Section title="Job category" count={filters.categories?.length} empty={(facets?.categories ?? []).length === 0 && !(filters.categories?.length ?? 0)}>
        <CheckList name="categories" facets={facets?.categories ?? []} selected={filters.categories ?? []} onToggle={toggler('categories')} limit={10} />
      </Section>

      {/* One city section per province rather than a single mixed list. With
          four provinces covered, Toronto, Calgary and Montreal appeared side by
          side with nothing saying which province each belonged to. */}
      {CITY_GROUPS.map(({ key, title }) => {
        const group = facets?.citiesByProvince?.[key] ?? [];
        const selectedHere = (filters.cities ?? []).filter((c) => group.some((f) => f.value === c));
        // A selected city that has dropped out of every group (its postings
        // were filtered away) is shown under "Remote & unplaced" so it can
        // still be unticked.
        const orphaned =
          key === 'other'
            ? (filters.cities ?? []).filter(
                (c) => !Object.values(facets?.citiesByProvince ?? {}).some((g) => g.some((f) => f.value === c)),
              )
            : [];
        return (
          <Section
            key={key}
            title={title}
            count={selectedHere.length}
            defaultOpen={key === 'ON'}
            empty={group.length === 0 && orphaned.length === 0}
          >
            <CheckList
              name="cities"
              facets={group}
              selected={[...selectedHere, ...orphaned]}
              onToggle={toggler('cities')}
              limit={10}
            />
          </Section>
        );
      })}

      <Section title="Employment type" count={filters.employment?.length} defaultOpen={false} empty={(facets?.employment ?? []).length === 0 && !(filters.employment?.length ?? 0)}>
        <CheckList name="employment" facets={facets?.employment ?? []} selected={filters.employment ?? []} onToggle={toggler('employment')} limit={8} />
      </Section>

      <Section title="Company" count={filters.companies?.length} defaultOpen={false} empty={(facets?.companies ?? []).length === 0 && !(filters.companies?.length ?? 0)}>
        <CheckList name="companies" facets={facets?.companies ?? []} selected={filters.companies ?? []} onToggle={toggler('companies')} limit={10} />
      </Section>

      <Section title="Certifications" count={filters.certifications?.length} defaultOpen={false} empty={(facets?.certifications ?? []).length === 0 && !(filters.certifications?.length ?? 0)}>
        <CheckList
          name="certifications"
          facets={facets?.certifications ?? []}
          selected={filters.certifications ?? []}
          onToggle={toggler('certifications')}
          limit={10}
          emptyLabel="No certifications extracted for the current results"
        />
      </Section>

      <Section title="Skills & tools" count={filters.skills?.length} defaultOpen={false} empty={(facets?.skills ?? []).length === 0 && !(filters.skills?.length ?? 0)}>
        <CheckList name="skills" facets={facets?.skills ?? []} selected={filters.skills ?? []} onToggle={toggler('skills')} limit={12} />
      </Section>

      <Section title="Salary" defaultOpen={false}>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-line accent-[rgb(var(--accent))]"
            name="hasSalary"
            checked={Boolean(filters.hasSalary)}
            onChange={(e) => onChange({ hasSalary: e.target.checked || undefined, page: 1 })}
          />
          Only jobs with a published salary
        </label>
        <label className="mt-2 block text-xs text-muted">
          Minimum annual salary (CAD)
          <SalaryInput value={filters.salaryMin} onCommit={(v) => onChange({ salaryMin: v, page: 1 })} />
        </label>
      </Section>

      <Section title="Source" count={filters.sources?.length} defaultOpen={false} empty={(facets?.sources ?? []).length === 0 && !(filters.sources?.length ?? 0)}>
        <CheckList name="sources" facets={facets?.sources ?? []} selected={filters.sources ?? []} onToggle={toggler('sources')} limit={12} />
      </Section>

      <Section title="Options" defaultOpen={false}>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-line accent-[rgb(var(--accent))]"
            name="onlyPathway"
            checked={Boolean(filters.onlyPathway)}
            onChange={(e) => onChange({ onlyPathway: e.target.checked || undefined, page: 1 })}
          />
          Only &ldquo;pathway into cyber&rdquo; roles
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-line accent-[rgb(var(--accent))]"
            name="hidePathway"
            checked={filters.includePathway === false}
            onChange={(e) => onChange({ includePathway: e.target.checked ? false : undefined, page: 1 })}
          />
          Hide pathway / adjacent IT roles
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-line accent-[rgb(var(--accent))]"
            name="includeExpired"
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
