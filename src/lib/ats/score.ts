/**
 * Scores a resume against one posting, and explains every point.
 *
 * The score is deterministic: the same resume and posting always give the
 * same number, and each point traces to a keyword or rule listed in the
 * result. It measures how well the resume covers what this posting asks for,
 * in the posting's own vocabulary — which is what keyword-based applicant
 * tracking systems screen on. It is not, and does not claim to be, any
 * particular vendor's score: Workday, Greenhouse, Taleo and the rest each
 * rank differently, and many leave ranking to a recruiter's search.
 */
import type { Job } from '@/lib/types';
import { EDUCATION_RANK, type ResumeProfile } from '@/lib/ats/resume';

export type AtsJob = Pick<Job, 'title' | 'requirements'>;

export type ComponentKey = 'required' | 'tools' | 'preferred' | 'certifications' | 'experience' | 'education' | 'title';

export interface ScoreComponent {
  key: ComponentKey;
  label: string;
  /** Points this component can contribute after re-weighting (sums to 100). */
  maxPoints: number;
  /** Points earned. */
  points: number;
  /** False when the posting says nothing on this (its weight goes to the rest). */
  applicable: boolean;
  matched: string[];
  missing: string[];
  /** One line on how the points were worked out. */
  detail: string;
}

export interface AtsScore {
  score: number;
  band: 'strong' | 'good' | 'partial' | 'low';
  components: ScoreComponent[];
}

/** Base weights. Components a posting doesn't specify hand their share to the rest. */
export const WEIGHTS: Record<ComponentKey, number> = {
  required: 40,
  tools: 15,
  preferred: 10,
  certifications: 10,
  experience: 10,
  education: 10,
  title: 5,
};

const LABELS: Record<ComponentKey, string> = {
  required: 'Required skills & tools',
  tools: 'Other technologies in the posting',
  preferred: 'Preferred skills',
  certifications: 'Certifications',
  experience: 'Years of experience',
  education: 'Education',
  title: 'Job title keywords',
};

const TITLE_STOP = new Set([
  'senior', 'sr', 'junior', 'jr', 'lead', 'principal', 'staff', 'intermediate', 'associate', 'entry', 'level',
  'i', 'ii', 'iii', 'iv', '1', '2', '3', 'of', 'and', 'the', 'for', 'to', 'in', 'a', 'an', 'with', 'remote',
  'hybrid', 'onsite', 'canada', 'contract', 'temporary', 'permanent', 'full', 'part', 'time', 'co', 'op',
  'intern', 'internship', 'student', 'new', 'grad', 'graduate', 'team', 'north', 'america', 'americas', 'en', 'de',
  'la', 'le', 'des', 'et', 'talent', 'program', 'programme',
]);

function uniq(list: string[]): string[] {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = x.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Significant words of a job title ("Product Security Lead" -> product,
 * security). Anything after a spaced dash or a pipe is dropped: postings
 * append the employer or programme there ("SOC Analyst — Arctic Wolf Networks
 * Talent Program"), and those words are not the role.
 */
export function titleTokens(title: string): string[] {
  const role = title.split(/\s+[—–|-]\s+|\s*\|\s*/)[0] ?? title;
  return uniq(
    role
      .replace(/\([^)]*\)/g, ' ')
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter((w) => w.length > 1 && !TITLE_STOP.has(w)),
  );
}

function hasWord(text: string, word: string): boolean {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z0-9])${esc}(?:s|es)?(?![a-z0-9])`, 'i').test(text);
}

/** The keyword lists a posting is scored on, with no keyword counted twice. */
export function keywordSets(job: AtsJob): { required: string[]; tools: string[]; preferred: string[]; certifications: string[] } {
  const r = job.requirements;
  const required = uniq(r.requiredSkills);
  const reqSet = new Set(required.map((s) => s.toLowerCase()));
  const tools = uniq(r.technologies).filter((s) => !reqSet.has(s.toLowerCase()));
  const toolSet = new Set(tools.map((s) => s.toLowerCase()));
  const preferred = uniq(r.preferredSkills).filter((s) => !reqSet.has(s.toLowerCase()) && !toolSet.has(s.toLowerCase()));
  return { required, tools, preferred, certifications: uniq(r.certifications) };
}

export function scoreResume(profile: ResumeProfile, job: AtsJob): AtsScore {
  const sets = keywordSets(job);
  const has = (k: string) => profile.terms.has(k.toLowerCase());
  const raw: Omit<ScoreComponent, 'maxPoints' | 'points'>[] = [];
  const ratios: Partial<Record<ComponentKey, number>> = {};

  for (const key of ['required', 'tools', 'preferred'] as const) {
    const list = sets[key];
    const matched = list.filter(has);
    const missing = list.filter((k) => !has(k));
    ratios[key] = list.length ? matched.length / list.length : 0;
    raw.push({
      key,
      label: LABELS[key],
      applicable: list.length > 0,
      matched,
      missing,
      detail: list.length ? `${matched.length} of ${list.length} found in your resume` : 'This posting lists none',
    });
  }

  // Certifications are usually alternatives ("CISSP, CISM or CISA"), so one
  // listed certification is worth half and two or more are worth full marks
  // (or all of them, when the posting names only one).
  {
    const list = sets.certifications;
    const matched = list.filter(has);
    const need = Math.min(2, list.length);
    ratios.certifications = need ? Math.min(matched.length, need) / need : 0;
    raw.push({
      key: 'certifications',
      label: LABELS.certifications,
      applicable: list.length > 0,
      matched,
      missing: list.filter((k) => !has(k)),
      detail: list.length
        ? `${matched.length} of ${list.length} held — postings usually accept any of these, so ${need === 1 ? 'the one listed' : 'two'} earn${need === 1 ? 's' : ''} full marks`
        : 'This posting lists none',
    });
  }

  // Years of experience: proportional up to the posting's minimum.
  {
    const min = job.requirements.yearsExperienceMin;
    const yrs = profile.years;
    const applicable = min != null && min > 0;
    ratios.experience = applicable ? (yrs == null ? 0 : Math.min(1, yrs / (min as number))) : 0;
    raw.push({
      key: 'experience',
      label: LABELS.experience,
      applicable,
      matched: applicable && yrs != null && yrs >= (min as number) ? [`${yrs} years`] : [],
      missing: applicable && (yrs == null || yrs < (min as number)) ? [`${min}+ years asked`] : [],
      detail: !applicable
        ? 'This posting states no minimum'
        : yrs == null
          ? `Asks for ${min}+ years; no dated roles found in your resume`
          : `Asks for ${min}+ years; your dated roles add up to about ${yrs}`,
    });
  }

  // Education: meets the lowest level the posting names. One level short earns
  // half; "or equivalent experience" counts the requirement as met when the
  // experience requirement is met.
  {
    const levels = job.requirements.education.map((l) => EDUCATION_RANK[l]).filter((n): n is number => n != null);
    const equivalent = job.requirements.education.includes('Equivalent experience accepted');
    const applicable = levels.length > 0;
    const needed = applicable ? Math.min(...levels) : 0;
    const have = profile.educationRank;
    let ratio = 0;
    let detail = 'This posting states no education requirement';
    if (applicable) {
      const neededLabel = Object.keys(EDUCATION_RANK).find((k) => EDUCATION_RANK[k] === needed && k !== 'Post-graduate certificate') ?? '';
      const highest = profile.education.slice().sort((a, b) => b.rank - a.rank)[0]?.label;
      if (have >= needed) {
        ratio = 1;
        detail = `Asks for ${neededLabel.toLowerCase()}; you list ${highest?.toLowerCase()}`;
      } else if (equivalent && (ratios.experience ?? 0) >= 1) {
        ratio = 1;
        detail = `Asks for ${neededLabel.toLowerCase()} or equivalent experience; your experience meets it`;
      } else if (have > 0 && have === needed - 1) {
        ratio = 0.5;
        detail = `Asks for ${neededLabel.toLowerCase()}; you list ${highest?.toLowerCase()}, one level below`;
      } else {
        detail = have ? `Asks for ${neededLabel.toLowerCase()}; you list ${highest?.toLowerCase()}` : `Asks for ${neededLabel.toLowerCase()}; no qualification found in your resume`;
      }
    }
    ratios.education = ratio;
    raw.push({
      key: 'education',
      label: LABELS.education,
      applicable,
      matched: ratio > 0 ? profile.education.map((e) => e.label) : [],
      missing: applicable && ratio < 1 ? job.requirements.education.filter((l) => l in EDUCATION_RANK) : [],
      detail,
    });
  }

  // Title words: recruiters search by title, so the posting's own role words
  // appearing anywhere in the resume count.
  {
    const tokens = titleTokens(job.title);
    const matched = tokens.filter((w) => hasWord(profile.text, w));
    ratios.title = tokens.length ? matched.length / tokens.length : 0;
    raw.push({
      key: 'title',
      label: LABELS.title,
      applicable: tokens.length > 0,
      matched,
      missing: tokens.filter((w) => !matched.includes(w)),
      detail: tokens.length ? `${matched.length} of ${tokens.length} title words appear in your resume` : 'No title keywords',
    });
  }

  const totalWeight = raw.filter((c) => c.applicable).reduce((s, c) => s + WEIGHTS[c.key], 0) || 1;
  const components: ScoreComponent[] = raw.map((c) => {
    const maxPoints = c.applicable ? (WEIGHTS[c.key] * 100) / totalWeight : 0;
    return { ...c, maxPoints: round1(maxPoints), points: round1(maxPoints * (ratios[c.key] ?? 0)) };
  });
  const exact = raw.reduce((s, c) => s + (c.applicable ? ((WEIGHTS[c.key] * 100) / totalWeight) * (ratios[c.key] ?? 0) : 0), 0);
  const score = Math.round(exact);
  const band = score >= 75 ? 'strong' : score >= 60 ? 'good' : score >= 40 ? 'partial' : 'low';
  return { score, band, components };
}

/** Points the score would rise by if one more keyword of a component were present. */
export function pointsPerKeyword(c: ScoreComponent): number {
  const total = c.matched.length + c.missing.length;
  return total ? round1(c.maxPoints / total) : 0;
}
