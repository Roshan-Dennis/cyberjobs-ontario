import { CERTIFICATIONS, SKILLS, TECHNOLOGIES, type Term } from '@/lib/taxonomy/cyber';
import { extractYearsExperience, extractYearsExperienceLabel } from '@/lib/taxonomy/titles';
import type { JobRequirements } from '@/lib/types';

interface CompiledTerm {
  canonical: string;
  re: RegExp;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compile(terms: Term[]): CompiledTerm[] {
  return terms.map((term) => {
    const forms = [term.canonical, ...term.aliases].map(escapeRe);
    // Allow flexible whitespace/hyphenation between words.
    const body = forms.map((f) => f.replace(/\\?\s+/g, '[\\s\\-_]+')).join('|');
    const flags = 'i';
    // Word boundaries only work for alphanumeric edges; handle "C#", "C++", "Security+".
    const re = new RegExp(`(?<![A-Za-z0-9])(?:${body})(?![A-Za-z0-9])`, flags);
    return { canonical: term.canonical, re };
  });
}

const COMPILED_CERTS = compile(CERTIFICATIONS);
const COMPILED_TECH = compile(TECHNOLOGIES);
const COMPILED_SKILLS = compile(SKILLS);

function findAll(text: string, compiled: CompiledTerm[], limit = 40): string[] {
  const found: string[] = [];
  for (const c of compiled) {
    if (c.re.test(text)) {
      found.push(c.canonical);
      if (found.length >= limit) break;
    }
  }
  return found;
}

/* ---------------- Section splitting ---------------- */

const REQUIRED_HEADINGS =
  /(^|\n)\s*(?:[#*•\-\d.)\s]*)?(what you(?:'| wi)?ll need|requirements?|required (?:skills|qualifications|experience)|must[- ]haves?|minimum (?:qualifications|requirements)|qualifications?|basic qualifications|who you are|what we(?:'|)re looking for|essential (?:skills|qualifications)|you have|skills? (?:and|&) (?:experience|qualifications)|exigences|compétences requises)\b[:\s]*/i;

const PREFERRED_HEADINGS =
  /(^|\n)\s*(?:[#*•\-\d.)\s]*)?(nice[- ]to[- ]haves?|preferred (?:skills|qualifications|experience)?|bonus (?:points|skills)?|assets?|desirable|it would be (?:great|nice)|additional (?:skills|qualifications)|advantageous|considered an asset|atouts?)\b[:\s]*/i;

const STOP_HEADINGS =
  /(^|\n)\s*(?:[#*•\-\d.)\s]*)?(what we offer|benefits?|perks?|about (?:us|the (?:company|team|role))|compensation|salary|equal opportunit|accommodation|how to apply|why join|our (?:culture|values)|diversity|next steps|responsibilities|what you(?:'| wi)?ll do|the role|duties|avantages)\b/i;

function sliceSection(text: string, start: RegExp): string | null {
  const m = start.exec(text);
  if (!m) return null;
  const from = m.index + m[0].length;
  const rest = text.slice(from);
  const stopCandidates = [STOP_HEADINGS, PREFERRED_HEADINGS, REQUIRED_HEADINGS]
    .map((re) => {
      const mm = re.exec(rest);
      return mm ? mm.index : -1;
    })
    .filter((i) => i > 40);
  const end = stopCandidates.length ? Math.min(...stopCandidates) : Math.min(rest.length, 4000);
  return rest.slice(0, end);
}

const EDUCATION_RULES: { label: string; re: RegExp }[] = [
  { label: "Bachelor's degree", re: /\b(bachelor'?s?|b\.?sc\.?|b\.?a\.?\b|undergraduate degree|baccalaur[ée]at)\b/i },
  { label: "Master's degree", re: /\b(master'?s?|m\.?sc\.?|mba|m\.?eng\.?|maîtrise)\b/i },
  { label: 'PhD', re: /\b(ph\.?d\.?|doctorate|doctoral)\b/i },
  { label: 'College diploma', re: /\b(college diploma|diploma in|advanced diploma|dipl[oô]me|2-?year diploma|3-?year diploma)\b/i },
  { label: 'Post-secondary education', re: /\b(post[- ]secondary|university degree|degree in (?:computer|information|cyber|engineering))\b/i },
  { label: 'High school', re: /\b(high school|secondary school diploma|dec\b)\b/i },
  { label: 'Equivalent experience accepted', re: /\b(or equivalent (?:work )?experience|equivalent combination of education|in lieu of a degree)\b/i },
];

export function extractRequirements(text: string): JobRequirements {
  const body = text.slice(0, 30000);

  const requiredSection = sliceSection(body, REQUIRED_HEADINGS);
  const preferredSection = sliceSection(body, PREFERRED_HEADINGS);

  const allTech = findAll(body, COMPILED_TECH, 60);
  const allCerts = findAll(body, COMPILED_CERTS, 30);
  const allSkills = findAll(body, COMPILED_SKILLS, 40);

  const pool = [...new Set([...allSkills, ...allTech])];

  let requiredSkills: string[];
  let preferredSkills: string[];

  if (requiredSection || preferredSection) {
    const inReq = new Set(
      requiredSection ? [...findAll(requiredSection, COMPILED_SKILLS, 40), ...findAll(requiredSection, COMPILED_TECH, 40)] : [],
    );
    const inPref = new Set(
      preferredSection ? [...findAll(preferredSection, COMPILED_SKILLS, 40), ...findAll(preferredSection, COMPILED_TECH, 40)] : [],
    );
    requiredSkills = pool.filter((s) => inReq.has(s));
    preferredSkills = pool.filter((s) => inPref.has(s) && !inReq.has(s));
    // Anything mentioned but unclassified defaults to required-ish.
    const classified = new Set([...requiredSkills, ...preferredSkills]);
    const leftovers = pool.filter((s) => !classified.has(s));
    if (requiredSkills.length === 0) requiredSkills = leftovers;
    else preferredSkills = [...preferredSkills, ...leftovers.filter((s) => !preferredSkills.includes(s))].slice(0, 30);
  } else {
    requiredSkills = pool;
    preferredSkills = [];
  }

  const education = EDUCATION_RULES.filter((r) => r.re.test(body)).map((r) => r.label);

  return {
    requiredSkills: requiredSkills.slice(0, 30),
    preferredSkills: preferredSkills.slice(0, 25),
    technologies: allTech.slice(0, 40),
    certifications: allCerts.slice(0, 20),
    education: education.slice(0, 4),
    yearsExperience: extractYearsExperienceLabel(body),
    yearsExperienceMin: extractYearsExperience(body),
  };
}

/** Keywords used for the free-text search index. */
export function buildKeywords(...parts: (string | null | undefined)[]): string[] {
  const text = parts.filter(Boolean).join(' ').toLowerCase();
  const words = text.match(/[a-z][a-z0-9+#.\-]{2,}/g) ?? [];
  const stop = new Set([
    'the', 'and', 'for', 'with', 'you', 'our', 'are', 'will', 'that', 'this', 'have', 'from', 'your', 'all',
    'not', 'can', 'has', 'been', 'they', 'their', 'who', 'what', 'when', 'work', 'team', 'role', 'job',
    'about', 'more', 'other', 'than', 'into', 'also', 'were', 'each', 'such', 'any', 'may', 'per', 'out',
  ]);
  const counts = new Map<string, number>();
  for (const w of words) {
    if (stop.has(w) || w.length > 30) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 120)
    .map(([w]) => w);
}
