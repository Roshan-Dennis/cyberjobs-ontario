/**
 * Turns a score into advice. Every suggestion is tied to something concrete
 * in the resume or the posting, and none of them asks the reader to claim
 * anything new: missing keywords are to be added only where true, rewordings
 * keep the same facts, and numbers are to be added only when known.
 */
import type { ResumeProfile } from '@/lib/ats/resume';
import { scoreResume, type AtsJob, type AtsScore } from '@/lib/ats/score';

export interface KeywordGain {
  keyword: string;
  /** Exact rise in the score if this keyword were in the resume. */
  gain: number;
}

export interface Rewrite {
  before: string;
  after: string;
}

export interface Suggestion {
  id: string;
  title: string;
  body: string;
  keywords?: KeywordGain[];
  rewrites?: Rewrite[];
  examples?: string[];
}

export interface FormatCheck {
  ok: boolean;
  label: string;
  detail: string;
}

/** Re-scores with one keyword added: the honest answer to "how much would it help". */
export function gainFor(profile: ResumeProfile, job: AtsJob, base: AtsScore, keyword: string): number {
  const terms = new Map(profile.terms);
  terms.set(keyword.toLowerCase(), { canonical: keyword, found: keyword });
  return scoreResume({ ...profile, terms }, job).score - base.score;
}

/* ---------------- Rewording ---------------- */

const IRREGULAR: Record<string, string> = {
  writing: 'wrote', building: 'built', leading: 'led', running: 'ran', troubleshooting: 'troubleshot',
  setting: 'set', making: 'made', teaching: 'taught', giving: 'gave', getting: 'got', keeping: 'kept',
  meeting: 'met', selling: 'sold', driving: 'drove', speaking: 'spoke', doing: 'did', overseeing: 'oversaw',
  undertaking: 'undertook', bringing: 'brought', finding: 'found', holding: 'held', telling: 'told',
};

/**
 * "monitoring" -> "monitored". Dropping "-ing" and adding "-ed" is right for
 * nearly every regular verb, silent-e ones included (managing -> managed,
 * creating -> created, planning -> planned); consonant + y becomes -ied
 * (identifying -> identified); irregular verbs come from the list above.
 */
export function pastTense(gerund: string): string | null {
  const w = gerund.toLowerCase();
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (!w.endsWith('ing') || w.length < 6) return null;
  const stem = w.slice(0, -3);
  if (/[^aeiou]y$/.test(stem)) return `${stem.slice(0, -1)}ied`;
  return `${stem}ed`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function trimLine(s: string, max = 140): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

interface PhraseRule {
  re: RegExp;
  title: string;
  advice: string;
  rewrite?: (line: string) => string | null;
}

const PHRASES: PhraseRule[] = [
  {
    re: /\b(?:was )?responsible for (\w+ing)\b/i,
    title: '“Responsible for …” → the action itself',
    advice: 'Say what you did, in the past tense. The facts stay the same; the bullet just leads with the verb, which is what recruiters and ATS keyword searches read first.',
    rewrite: (line) => {
      const m = /(?:was )?responsible for (\w+ing)\b/i.exec(line);
      if (!m) return null;
      const past = pastTense(m[1]);
      if (!past) return null;
      const rest = line.slice(m.index + m[0].length);
      const before = line.slice(0, m.index);
      return capitalise(`${before}${past}${rest}`.trim());
    },
  },
  {
    re: /\b(?:duties|tasks|responsibilities) (?:included|include)\b/i,
    title: '“Duties included …” → what you did',
    advice: 'Turn each duty into its own bullet starting with the verb for what you actually did.',
  },
  {
    re: /\b(?:helped|assisted)(?: (?:with|in|to))?\b/i,
    title: '“Helped / assisted with …” → a precise verb',
    advice: '“Supported”, “Contributed to” or the specific task (“Triaged”, “Documented”) says the same thing more clearly. Only write “Led” or “Owned” if that is what happened.',
    rewrite: (line) => {
      const m = /\b(?:helped|assisted)(?: (?:with|in))?\s+/i.exec(line);
      if (!m) return null;
      const before = line.slice(0, m.index);
      const rest = line.slice(m.index + m[0].length);
      // "Helped with X" -> "Supported X"; "Helped to configure" -> leave to the reader.
      if (/^to\b/i.test(rest)) return null;
      return capitalise(`${before}Supported ${rest}`.trim());
    },
  },
  {
    re: /\bworked on\b/i,
    title: '“Worked on …” → name the action',
    advice: 'Replace it with what the work was: configured, built, reviewed, updated, tested — whichever is accurate.',
  },
  {
    re: /\binvolved in\b/i,
    title: '“Involved in …” → your part in it',
    advice: '“Participated in” or “Contributed to” keeps the meaning; naming your specific task is stronger still.',
    rewrite: (line) => {
      const m = /\b(?:was )?involved in\s+/i.exec(line);
      if (!m) return null;
      return capitalise(`${line.slice(0, m.index)}Participated in ${line.slice(m.index + m[0].length)}`.trim());
    },
  },
  {
    re: /\b(?:various|etc\.?|and more|and so on)\b/i,
    title: '“Various …” / “etc.” → the actual names',
    advice: 'An ATS can only match words that are on the page. List the real tools, systems or tasks instead of “various” or “etc.”.',
  },
];

/* ---------------- Advice ---------------- */

export function suggest(profile: ResumeProfile, job: AtsJob, result: AtsScore): Suggestion[] {
  const out: Suggestion[] = [];
  const comp = Object.fromEntries(result.components.map((c) => [c.key, c]));

  const gains = (list: string[]) =>
    list
      .map((k) => ({ keyword: k, gain: gainFor(profile, job, result, k) }))
      .sort((a, b) => b.gain - a.gain || a.keyword.localeCompare(b.keyword));

  if (/\b(co-?op|intern(ship)?|student|new grad(uate)?)\b/i.test(job.title) && profile.years != null && profile.years >= 2) {
    out.push({
      id: 'student-posting',
      title: 'This looks like a student or new-graduate posting',
      body: `Your resume shows about ${profile.years} years of experience. Co-op, internship and new-grad roles usually require current enrolment or recent graduation — check the eligibility section before applying; a junior or mid-level posting may suit you better.`,
    });
  }

  if (comp.required?.applicable && comp.required.missing.length) {
    out.push({
      id: 'missing-required',
      title: `${comp.required.missing.length} required keyword${comp.required.missing.length === 1 ? '' : 's'} not in your resume`,
      body:
        'If you have real experience with any of these, name it exactly as written here — in your Skills section and in the bullet where you used it. If you don’t, leave it out: claiming a skill you can’t discuss in an interview costs more than the points. The figure beside each is the exact rise in this score if it were present.',
      keywords: gains(comp.required.missing),
    });
  }

  const extra = [...(comp.tools?.missing ?? []), ...(comp.preferred?.missing ?? [])];
  if (extra.length) {
    out.push({
      id: 'missing-other',
      title: 'Other technologies and nice-to-haves from the posting',
      body: 'Worth adding only where true. Lab, coursework and personal-project use counts if you say that’s where it came from (e.g. “Splunk — home SOC lab”).',
      keywords: gains(extra).slice(0, 15),
    });
  }

  // Same skill, different name: align with the posting's wording.
  const jobWords = [
    ...(comp.required?.matched ?? []),
    ...(comp.tools?.matched ?? []),
    ...(comp.preferred?.matched ?? []),
    ...(comp.certifications?.matched ?? []),
  ];
  const renames = jobWords
    .map((k) => profile.terms.get(k.toLowerCase()))
    .filter((h): h is NonNullable<typeof h> => !!h && h.found.toLowerCase().replace(/[\s-]+/g, ' ') !== h.canonical.toLowerCase().replace(/[\s-]+/g, ' '));
  if (renames.length) {
    out.push({
      id: 'wording',
      title: 'Use the posting’s name for skills you already list',
      body: 'These are the same skill or tool under another name. Matching was given credit here, but many ATS searches look for the exact words, so write the posting’s term — keeping yours in brackets if you like.',
      rewrites: renames.slice(0, 10).map((h) => ({ before: h.found, after: `${h.canonical} (${h.found})` })),
    });
  }

  if (comp.certifications?.applicable && comp.certifications.points < comp.certifications.maxPoints) {
    out.push({
      id: 'certifications',
      title: 'Certifications the posting mentions',
      body: 'List any you hold with the full name and year. If you are studying for one, “CompTIA Security+ — in progress, exam booked Nov 2026” is accurate and searchable; don’t list one you haven’t started.',
      keywords: gains(comp.certifications.missing),
    });
  }

  if (comp.experience?.applicable && comp.experience.points < comp.experience.maxPoints) {
    out.push({
      id: 'experience',
      title: 'Experience requirement',
      body:
        profile.years == null
          ? 'No dated roles were found. Give every role a start and end date (e.g. “Jan 2023 – Present”) on the same line as the job title — most ATS calculate experience from these dates.'
          : `This posting asks for more years than your dated roles add up to (about ${profile.years}). Postings often flex on this, so it can still be worth applying. Make sure relevant experience — co-ops, IT support, labs with dates — is listed with dates so it is counted.`,
    });
  }

  if (comp.education?.applicable && comp.education.points < comp.education.maxPoints) {
    out.push({
      id: 'education',
      title: 'Education',
      body:
        profile.educationRank === 0
          ? 'No degree or diploma was recognised. Write the credential in full (“Bachelor of Engineering”, “Graduate Certificate, Cloud Computing”) under an “Education” heading.'
          : 'Your highest credential is below what this posting names. Keep it clearly listed; if the posting accepts equivalent experience, say so in your cover letter.',
    });
  }

  if (comp.title?.applicable && comp.title.missing.length) {
    out.push({
      id: 'title',
      title: 'Job title words',
      body: `Recruiters search by title. The posting’s title words not in your resume: ${comp.title.missing.join(', ')}. If they genuinely describe your work, use them in a one-line headline or summary at the top (e.g. “Security analyst with hands-on SIEM and cloud experience”). Don’t rename past job titles.`,
    });
  }

  // Phrasing: quote the real lines and show a same-facts rewrite where safe.
  for (const rule of PHRASES) {
    const lines = profile.bullets.filter((b) => rule.re.test(b)).slice(0, 3);
    if (!lines.length) continue;
    const rewrites = lines
      .map((l) => {
        const after = rule.rewrite?.(l);
        return after ? { before: trimLine(l), after: trimLine(after) } : null;
      })
      .filter((r): r is Rewrite => !!r);
    out.push({
      id: `phrase-${rule.title}`,
      title: rule.title,
      body: rule.advice,
      rewrites: rewrites.length ? rewrites : undefined,
      examples: rewrites.length ? undefined : lines.map((l) => trimLine(l)),
    });
  }

  const noNumbers = profile.bullets.filter((b) => !/\d/.test(b));
  if (profile.bullets.length >= 3 && noNumbers.length / profile.bullets.length > 0.6) {
    out.push({
      id: 'quantify',
      title: 'Add numbers you know to be true',
      body: `${noNumbers.length} of ${profile.bullets.length} bullets have no figures. Where you know a real number — tickets a week, endpoints managed, alerts triaged, time saved — add it. Don’t estimate figures you couldn’t explain.`,
      examples: noNumbers.slice(0, 3).map((l) => trimLine(l)),
    });
  }

  return out;
}

export function formatChecks(profile: ResumeProfile): FormatCheck[] {
  const checks: FormatCheck[] = [];
  const readable = profile.text.length >= 400;
  checks.push({
    ok: readable,
    label: 'Text can be read',
    detail: readable
      ? `${profile.wordCount} words read from your resume`
      : 'Very little text could be read. If this is a scanned or image-based PDF, an ATS can’t read it either — export it from Word or Google Docs as a text PDF.',
  });
  checks.push({ ok: profile.hasEmail, label: 'Email address', detail: profile.hasEmail ? 'Found' : 'Not found — put it in plain text at the top, not in a header image' });
  checks.push({ ok: profile.hasPhone, label: 'Phone number', detail: profile.hasPhone ? 'Found' : 'Not found' });
  checks.push({
    ok: profile.sections.experience,
    label: '“Experience” heading',
    detail: profile.sections.experience ? 'Found' : 'Not found — use a standard heading such as “Experience” or “Work Experience” so an ATS can find your roles',
  });
  checks.push({
    ok: profile.sections.education,
    label: '“Education” heading',
    detail: profile.sections.education ? 'Found' : 'Not found — use a standard “Education” heading',
  });
  checks.push({
    ok: profile.sections.skills,
    label: '“Skills” heading',
    detail: profile.sections.skills ? 'Found' : 'Not found — a “Skills” section is where ATS keyword matching works best',
  });
  checks.push({
    ok: profile.years != null,
    label: 'Dated roles',
    detail:
      profile.years != null
        ? `${profile.periods.length} date range${profile.periods.length === 1 ? '' : 's'} found, about ${profile.years} years in total${profile.yearsApproximate ? ' (no “Experience” heading, so every dated range was counted)' : ''}`
        : 'No date ranges found — add “Mon YYYY – Mon YYYY” to each role',
  });
  const lengthOk = profile.wordCount >= 250 && profile.wordCount <= 1100;
  checks.push({
    ok: lengthOk,
    label: 'Length',
    detail: lengthOk
      ? `${profile.wordCount} words`
      : profile.wordCount < 250
        ? `${profile.wordCount} words — likely too thin to match many keywords`
        : `${profile.wordCount} words — consider trimming to two pages`,
  });
  return checks;
}
