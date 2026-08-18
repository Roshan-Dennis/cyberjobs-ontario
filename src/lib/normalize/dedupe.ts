import { createHash } from 'node:crypto';
import { titleKey } from '@/lib/taxonomy/titles';
import type { Job } from '@/lib/types';

export function slugify(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const COMPANY_SUFFIX =
  /-(inc|llc|ltd|limited|corp|corporation|co|company|group|holdings?|technologies|technology|solutions|services|canada|international|global|plc|gmbh|sa|nv|llp|lp|ulc|srl|pte|bv|ag)$/;

/**
 * Reduce an employer name to a comparable key. Legal suffixes are stripped
 * repeatedly, so "Acme Corp", "Acme Corp Inc." and "Acme Corporation Canada"
 * all collapse to "acme".
 */
export function companyKey(company: string): string {
  let key = slugify(company);
  for (let i = 0; i < 4; i += 1) {
    const next = key.replace(COMPANY_SUFFIX, '').replace(/-+$/, '');
    if (next === key || next === '') break;
    key = next;
  }
  return key;
}

export function locationKey(city: string | null, isRemote: boolean): string {
  if (isRemote && !city) return 'remote';
  return slugify(city ?? 'unknown');
}

/**
 * Content fingerprint: same role, same employer, same place.
 * Two postings sharing a fingerprint are treated as the same job.
 */
export function fingerprintOf(input: {
  title: string;
  company: string;
  city: string | null;
  isRemote: boolean;
}): string {
  const parts = [titleKey(input.title), companyKey(input.company), locationKey(input.city, input.isRemote)];
  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 20);
}

/** Deterministic public id, stable across ingests. */
export function jobIdOf(sourceId: string, sourceJobId: string): string {
  return createHash('sha1').update(`${sourceId}:${sourceJobId}`).digest('hex').slice(0, 16);
}

/** Cheap shingled-token similarity, used as a tie-breaker for near-duplicates. */
export function similarity(a: string, b: string): number {
  const norm = (s: string) => new Set((s.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).slice(0, 400));
  const A = norm(a);
  const B = norm(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  return inter / Math.min(A.size, B.size);
}

/** Source trust order — the winner of a duplicate group. */
const SOURCE_PRIORITY: Record<string, number> = {
  greenhouse: 100,
  lever: 98,
  ashby: 97,
  workable: 92,
  recruitee: 90,
  smartrecruiters: 88,
  jobbank: 80,
  adzuna: 60,
  jooble: 55,
  arbeitnow: 40,
  remotive: 40,
  jobicy: 35,
};

export function sourcePriority(sourceId: string): number {
  return SOURCE_PRIORITY[sourceId] ?? 50;
}

export interface DedupeResult {
  jobs: Job[];
  merged: number;
}

/**
 * Collapse duplicate postings. The surviving record keeps the richest
 * description, the earliest posting date, and records every other place the
 * same role appeared so the UI can show "also on Job Bank".
 */
export function dedupeJobs(jobs: Job[]): DedupeResult {
  const groups = new Map<string, Job[]>();
  for (const job of jobs) {
    const list = groups.get(job.fingerprint);
    if (list) list.push(job);
    else groups.set(job.fingerprint, [job]);
  }

  const out: Job[] = [];
  let merged = 0;

  for (const group of groups.values()) {
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }

    const sorted = [...group].sort((a, b) => {
      const p = sourcePriority(b.sourceId) - sourcePriority(a.sourceId);
      if (p !== 0) return p;
      const len = b.description.length - a.description.length;
      if (len !== 0) return len;
      return (Date.parse(b.postedAt ?? '0') || 0) - (Date.parse(a.postedAt ?? '0') || 0);
    });

    const winner = { ...sorted[0] };
    const others = sorted.slice(1);
    merged += others.length;

    // Earliest posting date across the group is the true "first posted".
    const dates = group.map((j) => j.postedAt).filter((d): d is string => Boolean(d)).sort();
    if (dates.length) winner.postedAt = dates[0];

    // Prefer a real salary from any member of the group.
    if (winner.salary.min == null) {
      const withSalary = group.find((j) => j.salary.min != null);
      if (withSalary) winner.salary = withSalary.salary;
    }

    // Union the extracted requirements.
    winner.requirements = {
      ...winner.requirements,
      requiredSkills: unionTop(group.map((j) => j.requirements.requiredSkills), 30),
      preferredSkills: unionTop(group.map((j) => j.requirements.preferredSkills), 25),
      technologies: unionTop(group.map((j) => j.requirements.technologies), 40),
      certifications: unionTop(group.map((j) => j.requirements.certifications), 20),
      education: unionTop(group.map((j) => j.requirements.education), 5),
      yearsExperience: winner.requirements.yearsExperience ?? group.find((j) => j.requirements.yearsExperience)?.requirements.yearsExperience ?? null,
    };

    winner.duplicateCount = group.length;
    winner.alsoPostedOn = others.map((j) => ({ sourceName: j.sourceName, url: j.applyUrl || j.sourceUrl }));
    winner.relevanceScore = Math.max(...group.map((j) => j.relevanceScore));

    out.push(winner);
  }

  return { jobs: out, merged };
}

function unionTop(lists: string[][], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const item of list) {
      if (seen.has(item)) continue;
      seen.add(item);
      out.push(item);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/**
 * Flag reposts: the same fingerprint seen previously with an older posting
 * date and a gap of more than 21 days.
 */
export function markReposts(fresh: Job[], existingByFingerprint: Map<string, { id: string; postedAt: string | null }>): void {
  for (const job of fresh) {
    const prior = existingByFingerprint.get(job.fingerprint);
    if (!prior || prior.id === job.id) continue;
    const priorTime = prior.postedAt ? Date.parse(prior.postedAt) : NaN;
    const nowTime = job.postedAt ? Date.parse(job.postedAt) : NaN;
    if (!Number.isFinite(priorTime) || !Number.isFinite(nowTime)) continue;
    if (nowTime - priorTime > 21 * 86_400_000) {
      job.isRepost = true;
      job.repostOf = prior.id;
    }
  }
}
