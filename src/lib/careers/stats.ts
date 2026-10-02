/**
 * Live numbers for a career path, from the postings on the board right now.
 * Computed at build time, so they refresh with every hourly update.
 */
import type { Job } from '@/lib/types';
import type { Career } from '@/lib/careers/catalog';

export interface CareerStats {
  open: number;
  /** Postings at internship, co-op, entry or junior level. */
  entryLevel: number;
  remote: number;
  topSkills: { name: string; count: number }[];
  topCerts: { name: string; count: number }[];
  topEmployers: { name: string; count: number }[];
  /** Annual pay across postings that publish it; null below three postings. */
  pay: { low: number; median: number; high: number; sample: number } | null;
}

const ENTRY = new Set(['internship', 'coop', 'entry', 'junior']);

function top(values: string[], n: number): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

/** Middle value of a sorted list (mean of the two middle values when even). */
function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Postings that belong to a path. */
export function jobsFor(career: Career, jobs: Job[]): Job[] {
  const cats = new Set<string>(career.categories);
  return jobs.filter((j) => !j.isExpired && cats.has(j.category));
}

export function careerStats(career: Career, jobs: Job[]): CareerStats {
  const mine = jobsFor(career, jobs);
  // One point per posting: a pay range counts at its midpoint. Implausible
  // figures (hourly rates misread as annual, or the reverse) are left out.
  const pay = mine
    .map((j) => {
      const lo = j.salary?.annualMin ?? j.salary?.annualMax;
      const hi = j.salary?.annualMax ?? j.salary?.annualMin;
      return lo != null && hi != null ? (lo + hi) / 2 : null;
    })
    .filter((v): v is number => v != null && v >= 25_000 && v <= 500_000)
    .sort((a, b) => a - b);

  return {
    open: mine.length,
    entryLevel: mine.filter((j) => ENTRY.has(j.experienceLevel)).length,
    remote: mine.filter((j) => j.workArrangement === 'remote').length,
    topSkills: top(mine.flatMap((j) => [...new Set([...j.requirements.requiredSkills, ...j.requirements.technologies])]), 10),
    topCerts: top(mine.flatMap((j) => [...new Set(j.requirements.certifications)]), 6),
    topEmployers: top(mine.map((j) => j.company), 6),
    pay: pay.length >= 3 ? { low: pay[0], median: Math.round(median(pay)), high: pay[pay.length - 1], sample: pay.length } : null,
  };
}

/** Link to the board filtered to a path's postings. */
export function boardLink(career: Career, extra = ''): string {
  return `/?category=${career.categories.join(',')}${extra}`;
}
