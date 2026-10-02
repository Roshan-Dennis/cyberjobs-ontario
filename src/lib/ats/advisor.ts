/**
 * The search-page advisor: one resume scored against every open posting, then
 * summarised into what to apply for and what would widen the field. Built
 * only from the per-posting scores, so its advice is as checkable as they are.
 */
import type { ExperienceLevel, Job, JobCategory } from '@/lib/types';
import { CATEGORY_LABELS, EXPERIENCE_LABELS } from '@/lib/types';
import type { ResumeProfile } from '@/lib/ats/resume';
import { keywordSets, scoreResume, type AtsScore } from '@/lib/ats/score';

export interface JobMatch {
  job: Job;
  result: AtsScore;
}

export interface CategoryFit {
  category: JobCategory;
  label: string;
  /** Average of the best three scores in the category. */
  score: number;
  openings: number;
  /** Postings in the category scoring 60 or more. */
  goodMatches: number;
}

export interface SkillGap {
  keyword: string;
  /** Near-match postings (scored 40–74) that ask for it. */
  postings: number;
}

export interface Advice {
  matches: JobMatch[];
  levels: { level: ExperienceLevel; label: string; openings: number }[];
  levelReason: string;
  categories: CategoryFit[];
  gaps: SkillGap[];
  certGaps: SkillGap[];
  strongCount: number;
  goodCount: number;
  guidance: string[];
}

/** Experience levels a resume with this many years can credibly target. */
export function levelsForYears(years: number | null): { levels: ExperienceLevel[]; reason: string } {
  if (years == null) {
    return {
      levels: ['internship', 'coop', 'entry', 'junior'],
      reason: 'No dated roles were found, so entry-level postings are the safe target. Add dates to your roles for a sharper answer.',
    };
  }
  if (years < 1) return { levels: ['internship', 'coop', 'entry', 'junior'], reason: `About ${years} years of dated experience fits internship, co-op, entry and junior postings.` };
  if (years < 3) return { levels: ['entry', 'junior', 'mid'], reason: `About ${years} years fits entry and junior postings, with mid-level as a stretch.` };
  if (years < 6) return { levels: ['junior', 'mid', 'senior'], reason: `About ${years} years fits mid-level postings, with senior as a stretch.` };
  return { levels: ['mid', 'senior', 'lead', 'manager'], reason: `About ${years} years fits senior and lead postings.` };
}

export function advise(profile: ResumeProfile, jobs: Job[]): Advice {
  const live = jobs.filter((j) => !j.isExpired);
  const scored: JobMatch[] = live
    .map((job) => ({ job, result: scoreResume(profile, job) }))
    .sort((a, b) => b.result.score - a.result.score || (Date.parse(b.job.postedAt ?? '') || 0) - (Date.parse(a.job.postedAt ?? '') || 0));

  const { levels, reason } = levelsForYears(profile.years);
  // Top matches are limited to postings at a level that suits the resume (or
  // that state none): a co-op posting can cover every keyword of an
  // experienced resume, but it is usually open only to enrolled students.
  const fitsLevel = (j: Job) => j.experienceLevel === 'unknown' || levels.includes(j.experienceLevel);
  const suitable = scored.filter((m) => fitsLevel(m.job));
  const levelRows = levels.map((level) => ({
    level,
    label: EXPERIENCE_LABELS[level],
    openings: live.filter((j) => j.experienceLevel === level).length,
  }));

  // Category fit: the best three scores in each category, so one strong
  // posting doesn't crown a category and many weak ones don't sink it.
  const byCat = new Map<JobCategory, number[]>();
  for (const m of scored) {
    const list = byCat.get(m.job.category) ?? [];
    list.push(m.result.score);
    byCat.set(m.job.category, list);
  }
  const categories: CategoryFit[] = [...byCat.entries()]
    .filter(([cat, list]) => cat !== 'other' && list.length >= 2)
    .map(([cat, list]) => {
      const top = list.slice(0, 3);
      return {
        category: cat,
        label: CATEGORY_LABELS[cat],
        score: Math.round(top.reduce((a, b) => a + b, 0) / top.length),
        openings: list.length,
        goodMatches: list.filter((s) => s >= 60).length,
      };
    })
    .sort((a, b) => b.score - a.score || b.openings - a.openings)
    .slice(0, 4);

  // Gaps: what the near misses ask for that the resume doesn't show.
  const near = suitable.filter((m) => m.result.score >= 40 && m.result.score < 75);
  const tally = (pick: (m: JobMatch) => string[]) => {
    const counts = new Map<string, number>();
    for (const m of near) for (const k of new Set(pick(m))) if (!profile.terms.has(k.toLowerCase())) counts.set(k, (counts.get(k) ?? 0) + 1);
    return [...counts.entries()]
      .map(([keyword, postings]) => ({ keyword, postings }))
      .filter((g) => g.postings >= 2)
      .sort((a, b) => b.postings - a.postings || a.keyword.localeCompare(b.keyword));
  };
  const gaps = tally((m) => {
    const s = keywordSets(m.job);
    return [...s.required, ...s.tools];
  }).slice(0, 8);
  const certGaps = tally((m) => keywordSets(m.job).certifications).slice(0, 4);

  const strongCount = suitable.filter((m) => m.result.score >= 75).length;
  const goodCount = suitable.filter((m) => m.result.score >= 60 && m.result.score < 75).length;

  const guidance: string[] = [];
  if (strongCount + goodCount > 0) {
    guidance.push(
      `${strongCount + goodCount} open posting${strongCount + goodCount === 1 ? '' : 's'} at your level score 60 or more against your resume — start with those, tailoring each with its own checker on the job page.`,
    );
  } else {
    guidance.push('No posting at your level scores 60 or more yet. The skills below are what your closest matches ask for most — if you have them, make them visible; if not, they are the most useful to learn next.');
  }
  if (categories[0]) {
    guidance.push(`Your strongest area is ${categories[0].label} (top matches average ${categories[0].score}%, ${categories[0].openings} open postings).`);
  }
  guidance.push(reason);
  if (gaps[0]) {
    guidance.push(
      `${gaps[0].keyword} is the keyword your near matches ask for most (${gaps[0].postings} postings). If you have used it, name it; if not, a home-lab project with it is a direct way to close the gap.`,
    );
  }
  if (!profile.sections.skills) guidance.push('Add a “Skills” section: it is where keyword matching works best.');

  return { matches: suitable.slice(0, 10), levels: levelRows, levelReason: reason, categories, gaps, certGaps, strongCount, goodCount, guidance };
}
