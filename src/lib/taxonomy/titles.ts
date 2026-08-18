import type { EmploymentType, ExperienceLevel } from '@/lib/types';

/** Noise commonly appended to titles by ATS platforms and job boards. */
const TITLE_NOISE: RegExp[] = [
  /\s*[\-–—|/]\s*(remote|hybrid|on-?site|work from home)\b.*$/i,
  /\s*\((remote|hybrid|on-?site|work from home)[^)]*\)\s*/gi,
  /\s*\((canada|ontario|toronto|ottawa|mississauga|vancouver|usa|us|multiple locations?)[^)]*\)\s*/gi,
  /\s*[\-–—|]\s*(full[- ]?time|part[- ]?time|permanent|contract|temporary|casual)\b.*$/i,
  /\s*\((full[- ]?time|part[- ]?time|permanent|contract|temporary|casual|\d+\s*month[s]?)[^)]*\)\s*/gi,
  /\s*[\-–—|]\s*(req(uisition)?\s*#?\s*\d+|job\s*id\s*:?\s*\d+|#\s*\d{3,})\s*$/i,
  /\s*\(\s*(req|job)\s*#?\s*[\w-]+\s*\)\s*/gi,
  /\s*[\-–—|]\s*\d{4,}\s*$/,
  /\s*\(\s*\d{4,}\s*\)\s*$/,
  /\s*[\-–—|]\s*(new grad|university grad|campus)\b/i,
  /\s*\bF\/H\b\s*/g,
  /\s*\(H\/F\)\s*/g,
];

const ROMAN = /\b(i{1,3}|iv|v)\b/i;

const SENIORITY_RULES: { level: ExperienceLevel; re: RegExp }[] = [
  { level: 'internship', re: /\b(intern(ship)?|summer student|student placement|placement student|stagiaire|apprentice)\b/i },
  { level: 'coop', re: /\b(co-?op|coop|work term|internship\/co-?op|winter 20\d\d|fall 20\d\d|summer 20\d\d)\b/i },
  { level: 'executive', re: /\b(chief\b|ciso|ciso\b|cio\b|cto\b|c-level|chief information security|chief security|svp|senior vice president|evp|executive vice)\b/i },
  { level: 'director', re: /\b(director|head of|avp|vice president|vp\b)\b/i },
  { level: 'manager', re: /\b(manager|mgr\b|supervisor|team lead(er)?\s*,?\s*(soc|security)|people lead)\b/i },
  { level: 'lead', re: /\b(lead|principal|staff|distinguished|architect|specialist iv|iv\b)\b/i },
  { level: 'senior', re: /\b(senior|sr\.?|snr|expert|advanced|iii\b|level 3|l3|tier 3|t3)\b/i },
  { level: 'junior', re: /\b(junior|jr\.?|associate|i{1}\b(?!i)|level 1|l1|tier 1|t1)\b/i },
  { level: 'entry', re: /\b(entry[- ]?level|graduate|new grad|trainee|early career|no experience|0-2 years)\b/i },
  { level: 'mid', re: /\b(intermediate|ii\b|level 2|l2|tier 2|t2|mid[- ]?level)\b/i },
];

/**
 * Infer the seniority band. Title evidence wins; description text is a
 * secondary signal (years of experience).
 */
export function inferExperienceLevel(title: string, description = ''): ExperienceLevel {
  const t = title.toLowerCase();

  // Ordered checks — most specific / most senior first.
  for (const rule of SENIORITY_RULES) {
    if (rule.re.test(t)) return rule.level;
  }

  // Description fallbacks.
  const d = description.toLowerCase().slice(0, 6000);
  if (/\b(co-?op|work term)\b/.test(d) && /\bstudent\b/.test(d)) return 'coop';
  if (/\bintern(ship)?\b/.test(d) && /\bstudent\b/.test(d)) return 'internship';

  const years = extractYearsExperience(d);
  if (years != null) {
    if (years <= 0) return 'entry';
    if (years <= 2) return 'junior';
    if (years <= 5) return 'mid';
    if (years <= 8) return 'senior';
    return 'lead';
  }

  if (/\b(entry[- ]?level|no prior experience|new graduates?)\b/.test(d)) return 'entry';
  return 'unknown';
}

const YEARS_RE =
  /(\d{1,2})\s*(?:\+|plus)?\s*(?:-|–|to)?\s*(\d{1,2})?\s*(?:\+)?\s*years?(?:\s+of)?(?:\s+(?:relevant|related|progressive|professional|hands-on|practical|combined|direct))*\s+(?:work\s+)?experience/i;

export function extractYearsExperience(text: string): number | null {
  const m = YEARS_RE.exec(text);
  if (!m) return null;
  const a = Number.parseInt(m[1] ?? '', 10);
  if (!Number.isFinite(a) || a > 30) return null;
  return a;
}

export function extractYearsExperienceLabel(text: string): string | null {
  const m = YEARS_RE.exec(text);
  if (!m) return null;
  const a = m[1];
  const b = m[2];
  if (b) return `${a}–${b} years`;
  return `${a}+ years`;
}

/** Strip ATS noise and tidy whitespace/punctuation. */
export function cleanTitle(raw: string): string {
  let out = (raw ?? '').replace(/\s+/g, ' ').trim();
  for (const re of TITLE_NOISE) out = out.replace(re, ' ');
  out = out
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*[,\-–—|/]\s*$/, '')
    .replace(/^\s*[,\-–—|/]\s*/, '')
    .trim();
  return out || (raw ?? '').trim();
}

const CANONICAL_REPLACEMENTS: [RegExp, string][] = [
  [/\bcyber\s*-?\s*security\b/gi, 'Cybersecurity'],
  [/\binformation\s+security\b/gi, 'Information Security'],
  [/\binfosec\b/gi, 'Information Security'],
  [/\bit\s+security\b/gi, 'IT Security'],
  [/\bsoc\b/gi, 'SOC'],
  [/\bsiem\b/gi, 'SIEM'],
  [/\bgrc\b/gi, 'GRC'],
  [/\biam\b/gi, 'IAM'],
  [/\bpam\b/gi, 'PAM'],
  [/\bdfir\b/gi, 'DFIR'],
  [/\bappsec\b/gi, 'Application Security'],
  [/\bdevsecops\b/gi, 'DevSecOps'],
  [/\bsr\.?\b/gi, 'Senior'],
  [/\bjr\.?\b/gi, 'Junior'],
  [/\bmgr\.?\b/gi, 'Manager'],
  [/\beng\.?\b/gi, 'Engineer'],
  [/\banalyste?\b/gi, 'Analyst'],
];

/**
 * A canonical, comparable form of the title used for dedupe and for grouping
 * "same role posted in five places".
 */
export function normalizeTitle(raw: string): string {
  let out = cleanTitle(raw);
  for (const [re, to] of CANONICAL_REPLACEMENTS) out = out.replace(re, to);
  out = out.replace(/\s+/g, ' ').trim();
  return titleCase(out);
}

/** Aggressively-reduced key for fingerprinting. */
export function titleKey(raw: string): string {
  return normalizeTitle(raw)
    .toLowerCase()
    .replace(/\b(senior|junior|lead|principal|staff|intermediate|associate)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function titleCase(s: string): string {
  const small = new Set(['and', 'or', 'of', 'the', 'for', 'to', 'in', 'on', 'at', 'a', 'an', 'with', 'de', 'du']);
  return s
    .split(' ')
    .map((word, i) => {
      if (!word) return word;
      // Preserve tokens that are already all-caps acronyms or contain digits.
      if (/^[A-Z0-9&/+.\-]{2,}$/.test(word)) return word;
      const lower = word.toLowerCase();
      if (i > 0 && small.has(lower)) return lower;
      if (ROMAN.test(word) && word.length <= 3) return word.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

const EMPLOYMENT_RULES: { type: EmploymentType; re: RegExp }[] = [
  { type: 'internship', re: /\b(intern(ship)?|co-?op|student|stagiaire|apprentice|work term)\b/i },
  { type: 'contract', re: /\b(contract|contractor|fixed[- ]term|freelance|consultant\s+\(|b2b|1099|term position|\d+\s*month(s)?\s+(contract|term))\b/i },
  { type: 'temporary', re: /\b(temporary|temp\b|seasonal|casual|relief)\b/i },
  { type: 'part_time', re: /\b(part[- ]?time|parttime|pt\b)\b/i },
  { type: 'volunteer', re: /\b(volunteer|unpaid)\b/i },
  { type: 'full_time', re: /\b(full[- ]?time|fulltime|permanent|regular|ft\b|temps plein)\b/i },
];

export function inferEmploymentType(...texts: (string | null | undefined)[]): EmploymentType {
  const joined = texts.filter(Boolean).join(' | ');
  if (!joined) return 'unknown';
  for (const rule of EMPLOYMENT_RULES) {
    if (rule.re.test(joined)) return rule.type;
  }
  return 'unknown';
}
