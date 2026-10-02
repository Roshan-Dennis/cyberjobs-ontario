import { CATEGORY_LABELS, EMPLOYMENT_LABELS, EXPERIENCE_LABELS } from '@/lib/types';
import type { Facet, Job, JobFilters, JobSearchResult, SortKey } from '@/lib/types';

const ARRANGEMENT_LABELS: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
  unknown: 'Not specified',
};

/* ------------------------------------------------------------------ */
/* Query parsing                                                       */
/* ------------------------------------------------------------------ */

interface ParsedQuery {
  terms: string[];
  phrases: string[];
  excluded: string[];
}

export function parseQuery(q: string | undefined): ParsedQuery {
  const out: ParsedQuery = { terms: [], phrases: [], excluded: [] };
  if (!q) return out;
  const phraseRe = /"([^"]+)"/g;
  let rest = q;
  let m: RegExpExecArray | null;
  while ((m = phraseRe.exec(q)) !== null) {
    out.phrases.push(m[1].toLowerCase().trim());
    rest = rest.replace(m[0], ' ');
  }
  for (const token of rest.split(/\s+/)) {
    const t = token.trim();
    if (!t) continue;
    if (t.startsWith('-') && t.length > 1) out.excluded.push(t.slice(1).toLowerCase());
    else out.terms.push(t.toLowerCase());
  }
  return out;
}

function haystack(job: Job): string {
  return [
    job.title,
    job.company,
    job.city ?? '',
    job.region ?? '',
    job.locationRaw,
    job.summary,
    job.requirements.technologies.join(' '),
    job.requirements.certifications.join(' '),
    job.requirements.requiredSkills.join(' '),
    job.requirements.preferredSkills.join(' '),
    job.sourceName,
    job.description.slice(0, 4000),
  ]
    .join(' \n ')
    .toLowerCase();
}

const haystackCache = new WeakMap<Job, string>();
function cachedHaystack(job: Job): string {
  let h = haystackCache.get(job);
  if (h == null) {
    h = haystack(job);
    haystackCache.set(job, h);
  }
  return h;
}

function textScore(job: Job, parsed: ParsedQuery): number | null {
  if (parsed.terms.length === 0 && parsed.phrases.length === 0 && parsed.excluded.length === 0) return 0;
  const hay = cachedHaystack(job);
  const title = job.title.toLowerCase();

  for (const bad of parsed.excluded) {
    if (hay.includes(bad)) return null;
  }
  for (const phrase of parsed.phrases) {
    if (!hay.includes(phrase)) return null;
  }

  let score = 0;
  for (const term of parsed.terms) {
    if (!hay.includes(term)) return null;
    if (title.includes(term)) score += 12;
    if (job.company.toLowerCase().includes(term)) score += 6;
    if (job.requirements.technologies.some((t) => t.toLowerCase().includes(term))) score += 5;
    score += 2;
  }
  for (const phrase of parsed.phrases) {
    if (title.includes(phrase)) score += 18;
    score += 6;
  }
  return score;
}

/* ------------------------------------------------------------------ */
/* Filtering                                                           */
/* ------------------------------------------------------------------ */

function inList<T extends string>(value: T, list: T[] | undefined): boolean {
  if (!list || list.length === 0) return true;
  return list.includes(value);
}

export interface FilterOutcome {
  matched: { job: Job; score: number }[];
  /** Everything that passed all filters *except* the one being faceted. */
  all: Job[];
}

function passesNonTextFilters(job: Job, f: JobFilters, now: number): boolean {
  if (!f.includeExpired && job.isExpired) return false;
  if (f.onlyPathway && !job.isPathwayRole) return false;
  if (f.includePathway === false && job.isPathwayRole) return false;

  if (!inList(job.province ?? 'other', f.provinces)) return false;
  if (!inList(job.experienceLevel, f.experience)) return false;
  if (!inList(job.category, f.categories)) {
    // Allow a secondary-category match so a "Cloud Security Engineer" also
    // appears under Security Engineering.
    const secondaryHit = (f.categories ?? []).some((c) => job.secondaryCategories.includes(c));
    if (!secondaryHit) return false;
  }
  if (!inList(job.workArrangement, f.arrangement)) return false;
  if (!inList(job.employmentType, f.employment)) return false;
  if (!inList(job.sourceId, f.sources)) return false;

  if (f.cities && f.cities.length > 0) {
    const city = job.city ?? (job.workArrangement === 'remote' ? 'Remote' : 'Other');
    if (!f.cities.includes(city)) return false;
  }
  if (f.companies && f.companies.length > 0 && !f.companies.includes(job.company)) return false;

  if (f.skills && f.skills.length > 0) {
    const owned = new Set(
      [...job.requirements.requiredSkills, ...job.requirements.preferredSkills, ...job.requirements.technologies].map((s) =>
        s.toLowerCase(),
      ),
    );
    if (!f.skills.every((s) => owned.has(s.toLowerCase()))) return false;
  }
  if (f.certifications && f.certifications.length > 0) {
    const owned = new Set(job.requirements.certifications.map((s) => s.toLowerCase()));
    if (!f.certifications.some((s) => owned.has(s.toLowerCase()))) return false;
  }

  if (f.hasSalary && job.salary.min == null) return false;
  if (f.salaryMin != null && f.salaryMin > 0) {
    const annual = job.salary.annualMax ?? job.salary.annualMin;
    if (annual == null || annual < f.salaryMin) return false;
  }

  if (f.postedWithinDays != null && f.postedWithinDays > 0) {
    if (!job.postedAt) return false;
    const age = (now - Date.parse(job.postedAt)) / 86_400_000;
    if (!Number.isFinite(age) || age > f.postedWithinDays) return false;
  }
  if (f.postedFrom) {
    const from = Date.parse(f.postedFrom);
    if (Number.isFinite(from) && (!job.postedAt || Date.parse(job.postedAt) < from)) return false;
  }
  if (f.postedTo) {
    const to = Date.parse(f.postedTo) + 86_400_000;
    if (Number.isFinite(to) && (!job.postedAt || Date.parse(job.postedAt) > to)) return false;
  }

  return true;
}

function compare(
  sort: SortKey,
  matchScores?: Map<string, number>,
): (a: { job: Job; score: number }, b: { job: Job; score: number }) => number {
  // "Best match for my resume" needs a resume; without one it falls back to
  // the default order rather than an arbitrary one.
  if (sort === 'match' && !matchScores) sort = 'relevance';
  switch (sort) {
    case 'match':
      return (a, b) =>
        (matchScores?.get(b.job.id) ?? 0) - (matchScores?.get(a.job.id) ?? 0) || b.score * 3 + b.job.rankScore - (a.score * 3 + a.job.rankScore);
    case 'newest':
      return (a, b) => (Date.parse(b.job.postedAt ?? '') || 0) - (Date.parse(a.job.postedAt ?? '') || 0);
    case 'oldest':
      return (a, b) => (Date.parse(a.job.postedAt ?? '') || 0) - (Date.parse(b.job.postedAt ?? '') || 0);
    case 'salary':
      return (a, b) => (b.job.salary.annualMax ?? b.job.salary.annualMin ?? -1) - (a.job.salary.annualMax ?? a.job.salary.annualMin ?? -1);
    case 'company':
      return (a, b) => a.job.company.localeCompare(b.job.company) || b.job.rankScore - a.job.rankScore;
    case 'relevance':
    default:
      return (a, b) => b.score * 3 + b.job.rankScore - (a.score * 3 + a.job.rankScore);
  }
}

/** What a posting is filed under in the city facets. */
function cityLabel(job: Job): string {
  return job.city ?? (job.workArrangement === 'remote' ? 'Remote' : 'Other');
}

function facet(values: (string | null | undefined)[], labels?: Record<string, string>, limit = 40): Facet[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, label: labels?.[value] ?? value, count }));
}

export function searchJobs(
  jobs: Job[],
  filters: JobFilters,
  meta: { lastIngestAt: string | null; notes?: string[]; degraded?: boolean; matchScores?: Map<string, number> },
): JobSearchResult {
  const now = Date.now();
  const parsed = parseQuery(filters.q);

  const matched: { job: Job; score: number }[] = [];
  for (const job of jobs) {
    if (!job) continue;
    if (!passesNonTextFilters(job, filters, now)) continue;
    const score = textScore(job, parsed);
    if (score == null) continue;
    matched.push({ job, score });
  }

  matched.sort(compare(filters.sort ?? 'relevance', meta.matchScores));

  const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 1), 100);
  const totalPages = Math.max(1, Math.ceil(matched.length / pageSize));
  const page = Math.min(Math.max(filters.page ?? 1, 1), totalPages);
  const slice = matched.slice((page - 1) * pageSize, page * pageSize).map((m) => m.job);

  const pool = matched.map((m) => m.job);

  // Facets are disjunctive: each group is counted over everything that passes
  // every OTHER filter, but not its own. Counted over the final pool instead,
  // ticking "Junior" left Junior as the only experience option, so the
  // checkboxes behaved like radio buttons — Internship + Junior + Entry, the
  // combination an entry-level searcher most needs, could not be built.
  //
  // Skills are the exception. They combine with AND (a posting must ask for
  // every ticked tool), so the useful count is "how many of the current
  // results also mention this one", which is exactly the final pool.
  const textPool = jobs.filter((job) => job && textScore(job, parsed) != null);
  const poolWithout = (...keys: (keyof JobFilters)[]): Job[] => {
    if (keys.every((k) => {
      const v = filters[k];
      return v == null || (Array.isArray(v) && v.length === 0);
    })) return pool;
    const relaxed: JobFilters = { ...filters };
    for (const k of keys) delete relaxed[k];
    return textPool.filter((job) => passesNonTextFilters(job, relaxed, now));
  };

  // Province counts ignore both the province filter and the narrower city
  // filter. Province is the top-level cut, so picking Montreal should not make
  // the other three provinces disappear from the sidebar.
  const provincePool = poolWithout('provinces', 'cities');
  const cityPool = poolWithout('cities');

  return {
    jobs: slice,
    total: matched.length,
    page,
    pageSize,
    totalPages,
    facets: {
      categories: facet(poolWithout('categories').map((j) => j.category), CATEGORY_LABELS as Record<string, string>),
      experience: facet(poolWithout('experience').map((j) => j.experienceLevel), EXPERIENCE_LABELS as Record<string, string>, 12),
      arrangement: facet(poolWithout('arrangement').map((j) => j.workArrangement), ARRANGEMENT_LABELS, 6),
      employment: facet(poolWithout('employment').map((j) => j.employmentType), EMPLOYMENT_LABELS as Record<string, string>, 8),
      provinces: facet(
        provincePool.map((j) => j.province ?? 'other'),
        { ON: 'Ontario', AB: 'Alberta', BC: 'British Columbia', QC: 'Quebec', other: 'Remote / unspecified' },
        5,
      ),
      cities: facet(cityPool.map(cityLabel), undefined, 60),
      // Cities grouped by the province that owns them. With four provinces in
      // one list, Toronto, Calgary and Montreal sat side by side with nothing
      // saying which was which.
      citiesByProvince: (() => {
        const groups = new Map<string, string[]>();
        for (const job of cityPool) {
          const key = job.province ?? 'other';
          const list = groups.get(key);
          if (list) list.push(cityLabel(job));
          else groups.set(key, [cityLabel(job)]);
        }
        return Object.fromEntries([...groups.entries()].map(([k, v]) => [k, facet(v, undefined, 30)]));
      })(),
      companies: facet(poolWithout('companies').map((j) => j.company), undefined, 60),
      sources: facet(poolWithout('sources').map((j) => j.sourceId), undefined, 20),
      certifications: facet(poolWithout('certifications').flatMap((j) => j.requirements.certifications), undefined, 30),
      skills: facet(pool.flatMap((j) => [...j.requirements.technologies].slice(0, 12)), undefined, 40),
    },
    meta: {
      lastIngestAt: meta.lastIngestAt,
      generatedAt: new Date().toISOString(),
      degraded: meta.degraded ?? false,
      notes: meta.notes ?? [],
    },
  };
}

/** How many filters are narrowing the results (search text not included). */
export function countActiveFilters(f: JobFilters): number {
  return (
    (f.provinces?.length ?? 0) +
    (f.experience?.length ?? 0) +
    (f.categories?.length ?? 0) +
    (f.arrangement?.length ?? 0) +
    (f.employment?.length ?? 0) +
    (f.cities?.length ?? 0) +
    (f.companies?.length ?? 0) +
    (f.skills?.length ?? 0) +
    (f.certifications?.length ?? 0) +
    (f.sources?.length ?? 0) +
    (f.postedWithinDays ? 1 : 0) +
    // A custom date range used to go uncounted, which left "Clear all filters"
    // disabled while the range was quietly hiding most of the board.
    (f.postedFrom || f.postedTo ? 1 : 0) +
    (f.salaryMin ? 1 : 0) +
    (f.hasSalary ? 1 : 0) +
    (f.onlyPathway ? 1 : 0) +
    (f.includePathway === false ? 1 : 0) +
    (f.includeExpired ? 1 : 0)
  );
}

/* ------------------------------------------------------------------ */
/* URL <-> filter serialisation                                        */
/* ------------------------------------------------------------------ */

/**
 * Lists travel in the URL comma-joined (`city=Toronto,Ottawa`). Some values
 * contain a comma themselves — employers such as "Remarcable, Inc." — and a
 * plain split turned that into "Remarcable" and "Inc.", which match nothing.
 * Values are joined with a bare comma, while a comma inside a name is followed
 * by a space, so only a comma with no space after it separates items.
 */
export function splitList(v: string): string[] {
  return v.split(/,(?!\s)/).map((s) => s.trim()).filter(Boolean);
}

function csv(v: string | null): string[] | undefined {
  if (!v) return undefined;
  const list = splitList(v);
  return list.length ? list : undefined;
}

export function filtersFromSearchParams(params: URLSearchParams): JobFilters {
  const int = (k: string): number | undefined => {
    const n = Number.parseInt(params.get(k) ?? '', 10);
    return Number.isFinite(n) ? n : undefined;
  };
  const bool = (k: string): boolean | undefined => {
    const v = params.get(k);
    if (v == null) return undefined;
    return /^(1|true|yes)$/i.test(v);
  };

  return {
    q: params.get('q') ?? undefined,
    experience: csv(params.get('experience')) as JobFilters['experience'],
    categories: csv(params.get('category')) as JobFilters['categories'],
    arrangement: csv(params.get('arrangement')) as JobFilters['arrangement'],
    employment: csv(params.get('employment')) as JobFilters['employment'],
    provinces: csv(params.get('province')),
    cities: csv(params.get('city')),
    companies: csv(params.get('company')),
    skills: csv(params.get('skill')),
    certifications: csv(params.get('cert')),
    sources: csv(params.get('source')),
    postedWithinDays: int('within'),
    postedFrom: params.get('from') ?? undefined,
    postedTo: params.get('to') ?? undefined,
    salaryMin: int('salaryMin'),
    hasSalary: bool('hasSalary'),
    includeExpired: bool('includeExpired'),
    includePathway: bool('includePathway'),
    onlyPathway: bool('onlyPathway'),
    sort: (params.get('sort') as SortKey) ?? 'relevance',
    page: int('page') ?? 1,
    pageSize: int('pageSize') ?? 25,
  };
}

export function searchParamsFromFilters(f: JobFilters): URLSearchParams {
  const p = new URLSearchParams();
  const setList = (k: string, v?: string[]) => {
    if (v && v.length) p.set(k, v.join(','));
  };
  if (f.q) p.set('q', f.q);
  setList('province', f.provinces);
  setList('experience', f.experience);
  setList('category', f.categories);
  setList('arrangement', f.arrangement);
  setList('employment', f.employment);
  setList('city', f.cities);
  setList('company', f.companies);
  setList('skill', f.skills);
  setList('cert', f.certifications);
  setList('source', f.sources);
  if (f.postedWithinDays) p.set('within', String(f.postedWithinDays));
  if (f.postedFrom) p.set('from', f.postedFrom);
  if (f.postedTo) p.set('to', f.postedTo);
  if (f.salaryMin) p.set('salaryMin', String(f.salaryMin));
  if (f.hasSalary) p.set('hasSalary', '1');
  if (f.includeExpired) p.set('includeExpired', '1');
  if (f.onlyPathway) p.set('onlyPathway', '1');
  if (f.includePathway === false) p.set('includePathway', '0');
  if (f.sort && f.sort !== 'relevance') p.set('sort', f.sort);
  if (f.page && f.page > 1) p.set('page', String(f.page));
  if (f.pageSize && f.pageSize !== 25) p.set('pageSize', String(f.pageSize));
  return p;
}
