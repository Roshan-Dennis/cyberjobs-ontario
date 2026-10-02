/**
 * Reads a resume's plain text into the same vocabulary the job postings use.
 *
 * Every posting on the board was reduced to canonical keywords by the
 * taxonomy in `taxonomy/cyber.ts` ("Microsoft Sentinel" also matches "Azure
 * Sentinel"). The resume goes through the very same matchers, so a keyword
 * either appears on both sides or it does not, and the match is something a
 * reader can check by eye — no model, no randomness, no hidden weighting.
 *
 * Pure functions only: this runs in the browser and nothing here touches the
 * network or storage.
 */
import { COMPILED_CERTS, COMPILED_SKILLS, COMPILED_TECH, EDUCATION_RULES, type CompiledTerm } from '@/lib/normalize/extract';

export interface TermHit {
  /** The name the job postings use. */
  canonical: string;
  /** The words as written in the resume, e.g. "Azure Sentinel". */
  found: string;
}

export interface WorkPeriod {
  /** The date range as written, e.g. "Jan 2022 – Present". */
  text: string;
  start: Date;
  end: Date;
}

export interface EducationHit {
  label: string;
  /** 1 high school … 5 PhD; used to compare against a posting's minimum. */
  rank: number;
}

export interface ResumeProfile {
  text: string;
  wordCount: number;
  /** Canonical keyword (lower-case) → how it appeared in the resume. */
  terms: Map<string, TermHit>;
  certifications: TermHit[];
  education: EducationHit[];
  /** Highest education rank found, 0 if none. */
  educationRank: number;
  /** Total work experience in years from dated roles, or null if none were found. */
  years: number | null;
  /** The periods that were counted, so the reader can check the total. */
  periods: WorkPeriod[];
  /** True when no "Experience" heading was found, so every dated range counted. */
  yearsApproximate: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  sections: { experience: boolean; education: boolean; skills: boolean };
  /** Lines that read as achievement bullets in the experience section. */
  bullets: string[];
}

/** Education labels the job extractor emits, ranked so levels can be compared. */
export const EDUCATION_RANK: Record<string, number> = {
  'High school': 1,
  'College diploma': 2,
  'Post-secondary education': 2,
  'Post-graduate certificate': 2,
  "Bachelor's degree": 3,
  "Master's degree": 4,
  PhD: 5,
};

/**
 * Ontario college graduate certificates are post-secondary credentials the job
 * extractor never needs to recognise (postings rarely ask for one), so the
 * resume side adds it.
 */
const RESUME_EDUCATION_RULES = [
  ...EDUCATION_RULES.filter((r) => r.label in EDUCATION_RANK),
  { label: 'Post-graduate certificate', re: /\b(graduate certificate|post-?graduate (certificate|diploma))\b/i },
];

function scan(text: string, compiled: CompiledTerm[], into: Map<string, TermHit>): TermHit[] {
  const hits: TermHit[] = [];
  for (const c of compiled) {
    const m = c.re.exec(text);
    if (!m) continue;
    const hit = { canonical: c.canonical, found: m[0].replace(/\s+/g, ' ').trim() };
    hits.push(hit);
    if (!into.has(c.canonical.toLowerCase())) into.set(c.canonical.toLowerCase(), hit);
  }
  return hits;
}

/* ---------------- Sections ---------------- */

const HEADING = {
  experience: /^(?:professional |work |relevant |employment |career )?(?:experience|employment(?: history)?|work history|career history|experience summary)s?\s*:?$/i,
  education: /^(?:education(?:al background)?|academic (?:background|qualifications)|education (?:&|and) (?:training|certifications?))\s*:?$/i,
  skills: /^(?:(?:technical |core |key )?skills(?: (?:&|and) (?:tools|technologies|abilities))?|technical proficienc(?:y|ies)|core competencies|competencies|technologies|tools)\s*:?$/i,
  other: /^(?:summary|profile|professional summary|objective|projects?|certifications?(?: (?:&|and) training)?|licenses|volunteer(?:ing| experience| work)?|awards|interests|references|publications|languages|achievements|courses|training)\s*:?$/i,
};

type SectionName = 'experience' | 'education' | 'skills' | 'other' | 'none';

function headingOf(line: string): Exclude<SectionName, 'none'> | null {
  const l = line.replace(/[•▪●■◆*#|_=-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!l || l.length > 45) return null;
  if (HEADING.experience.test(l)) return 'experience';
  if (HEADING.education.test(l)) return 'education';
  if (HEADING.skills.test(l)) return 'skills';
  if (HEADING.other.test(l)) return 'other';
  return null;
}

/* ---------------- Dates ---------------- */

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

const DATE = String.raw`(?:(?:(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?,?\s*)|(?:(\d{1,2})\s*[/.\-]\s*))?((?:19|20)\d{2})`;
const RANGE_RE = new RegExp(
  `${DATE}\\s*(?:–|—|-|to|until|through|thru)\\s*(?:${DATE}|(present|current|now|today|ongoing|date))`,
  'gi',
);

function toDate(monName: string | undefined, monNum: string | undefined, year: string, endOfPeriod: boolean): Date {
  let month = endOfPeriod ? 11 : 0;
  if (monName) month = MONTHS[monName.toLowerCase().slice(0, 4) === 'sept' ? 'sept' : monName.toLowerCase().slice(0, 3)] ?? month;
  else if (monNum) {
    const n = Number(monNum);
    if (n >= 1 && n <= 12) month = n - 1;
  }
  return new Date(Date.UTC(Number(year), month, 1));
}

function findPeriods(text: string, now: Date): WorkPeriod[] {
  const out: WorkPeriod[] = [];
  for (const m of text.matchAll(RANGE_RE)) {
    const start = toDate(m[1], m[2], m[3], false);
    const end = m[7] ? now : m[6] ? toDate(m[4], m[5], m[6], !m[4] && !m[5]) : null;
    if (!end) continue;
    const endCapped = end > now ? now : end;
    if (start.getUTCFullYear() < 1970 || endCapped < start) continue;
    out.push({ text: m[0].replace(/\s+/g, ' ').trim(), start, end: endCapped });
  }
  return out;
}

/** Months covered by the periods, counting overlapping roles once. */
export function coveredMonths(periods: WorkPeriod[]): number {
  const spans = periods
    .map((p) => [p.start.getUTCFullYear() * 12 + p.start.getUTCMonth(), p.end.getUTCFullYear() * 12 + p.end.getUTCMonth() + 1])
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const [s, e] of spans) {
    if (s > curEnd) {
      if (curEnd > curStart) total += curEnd - curStart;
      curStart = s;
      curEnd = e;
    } else curEnd = Math.max(curEnd, e);
  }
  if (curEnd > curStart) total += curEnd - curStart;
  return total;
}

/* ---------------- Profile ---------------- */

const BULLET_RE = /^\s*(?:[•▪●■◆◦‣*–-]|\d+[.)])\s+/;

export function parseResume(rawText: string, now: Date = new Date()): ResumeProfile {
  const text = (rawText ?? '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
  const lines = text.split('\n').map((l) => l.trim());

  // Split into sections by heading lines.
  const sectionText: Record<SectionName, string[]> = { experience: [], education: [], skills: [], other: [], none: [] };
  let current: SectionName = 'none';
  const seen = { experience: false, education: false, skills: false };
  for (const line of lines) {
    const h = headingOf(line);
    if (h) {
      current = h;
      if (h !== 'other') seen[h] = true;
      continue;
    }
    sectionText[current].push(line);
  }

  // Keywords, in the posting vocabulary.
  const terms = new Map<string, TermHit>();
  scan(text, COMPILED_SKILLS, terms);
  scan(text, COMPILED_TECH, terms);
  const certifications = scan(text, COMPILED_CERTS, terms);

  // Education.
  const education = RESUME_EDUCATION_RULES.filter((r) => r.re.test(text)).map((r) => ({ label: r.label, rank: EDUCATION_RANK[r.label] ?? 0 }));
  const educationRank = education.reduce((m, e) => Math.max(m, e.rank), 0);

  // Experience: dated ranges under an Experience heading; without one, every
  // dated range outside an Education section, flagged as approximate.
  const expText = seen.experience ? sectionText.experience.join('\n') : [...sectionText.none, ...sectionText.other, ...sectionText.experience].join('\n');
  const periods = findPeriods(expText, now);
  const months = coveredMonths(periods);
  const years = periods.length ? Math.round((months / 12) * 10) / 10 : null;

  const bulletSource = seen.experience ? sectionText.experience : lines;
  const bullets = bulletSource
    .filter((l) => BULLET_RE.test(l) || (/^[A-Z][a-z]+(ed|ing)\b/.test(l) && l.split(' ').length >= 6))
    .map((l) => l.replace(BULLET_RE, '').trim())
    .filter((l) => l.split(' ').length >= 4);

  return {
    text,
    wordCount: text ? text.split(/\s+/).length : 0,
    terms,
    certifications,
    education,
    educationRank,
    years,
    periods,
    yearsApproximate: !seen.experience,
    hasEmail: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(text),
    hasPhone: /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/.test(text),
    sections: seen,
    bullets,
  };
}
