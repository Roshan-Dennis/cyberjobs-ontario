import {
  CATEGORY_RULES,
  NON_TECHNICAL_EXCLUSIONS,
  PHYSICAL_SECURITY_EXCLUSIONS,
  SECURITY_TITLE_SIGNALS,
} from '@/lib/taxonomy/cyber';
import type { JobCategory } from '@/lib/types';

export interface Classification {
  category: JobCategory;
  secondary: JobCategory[];
  relevanceScore: number;
  isPathwayRole: boolean;
  rejected: boolean;
  rejectReason?: string;
}

const CORE_TITLE_RE =
  /\b(cyber\s*-?\s*security|cybersecurity|information security|infosec|security (analyst|engineer|architect|specialist|consultant|administrator|manager|director|operations|advisor|officer|developer|researcher|lead|technician|coordinator)|soc analyst|soc engineer|siem|grc|iam|identity and access|pam|privileged access|dfir|forensic|penetration test(er|ers|ing|s)?|pentest(er|ers|ing|s)?|red team|blue team|purple team|threat (intel|hunt|research)|vulnerability (management|analyst|engineer)|appsec|application security|product security|devsecops|cloud security|network security|ciso|incident (response|responder|handler)|malware (analyst|researcher)|security operations|detection (engineer|engineering)|trust (and|&) safety engineer|cryptograph(er|y) engineer|iso\s*27001|security assurance)\b/i;

const SUPPORTING_BODY_RE =
  /\b(siem|soc\b|edr\b|xdr\b|soar\b|mitre att&ck|nist|iso 27001|soc 2|threat|vulnerabilit(y|ies)|penetration test(er|ers|ing|s)?|incident(s| response| handling)|phishing|malware|firewall|zero trust|security (controls|posture|operations|team|tooling|patches|awareness)|risk assessment|encryption|iam\b|identity and access|sigma rules|detection engineering|cyber|forensic|pen test(er|ers|ing|s)?|red team|blue team|hardening|least privilege|mfa\b|multi-factor)\b/gi;

const PATHWAY_TITLE_RE =
  /\b(help\s*desk|service\s*desk|desktop support|technical support|it support|noc\b|network operations|system(s)? (administrator|analyst|engineer)|sysadmin|network (administrator|analyst|engineer|technician)|cloud (engineer|administrator|analyst|support)|infrastructure (analyst|engineer|specialist|administrator)|it (analyst|technician|specialist|generalist|operations)|devops engineer|site reliability engineer|sre\b|database administrator|endpoint (administrator|engineer)|m365 administrator|microsoft 365 administrator|systems support)\b/i;

/**
 * Floor applied to adjacent-IT roles that show real security exposure, so they
 * clear the default relevance cutoff without inflating true security roles.
 */
const PATHWAY_BASE_SCORE = 28;

/**
 * Score a posting 0-100 for cybersecurity relevance and assign a category.
 *
 * The scoring is deliberately conservative: physical-security and unrelated
 * postings are rejected outright rather than shown with a low score, because
 * a job board full of security-guard listings is worse than a smaller one.
 */
export function classify(title: string, description: string, department = ''): Classification {
  const t = title ?? '';
  const body = `${t}\n${department}\n${description ?? ''}`.slice(0, 20000);

  // --- Hard rejections -------------------------------------------------
  if (PHYSICAL_SECURITY_EXCLUSIONS.test(t)) {
    return reject('Physical security / guard role');
  }
  if (/\bsecurity\b/i.test(t) && !CORE_TITLE_RE.test(t) && PHYSICAL_SECURITY_EXCLUSIONS.test(body.slice(0, 3000))) {
    return reject('Physical security role (body evidence)');
  }
  if (NON_TECHNICAL_EXCLUSIONS.test(t) && !CORE_TITLE_RE.test(t)) {
    return reject('Non-technical role');
  }

  // --- Signals ---------------------------------------------------------
  const coreTitleHit = CORE_TITLE_RE.test(t);
  const weakTitleHit = SECURITY_TITLE_SIGNALS.test(t);
  const pathwayTitleHit = PATHWAY_TITLE_RE.test(t);
  const bodyHits = (body.match(SUPPORTING_BODY_RE) ?? []).length;

  let score = 0;
  if (coreTitleHit) score += 62;
  else if (weakTitleHit) score += 28;

  score += Math.min(26, bodyHits * 2.2);

  // Security mentioned in the department/team name.
  if (/\b(security|cyber|trust and safety|risk|compliance|infosec)\b/i.test(department)) score += 8;

  const isPathwayRole = !coreTitleHit && pathwayTitleHit;

  // Pathway roles are scored on a separate footing: their titles carry no
  // security signal by definition, so a raw score would always fall below the
  // cutoff. They get a base once there is at least one security signal in the
  // body, and are pushed back down by `computeRankScore` when ranking.
  if (isPathwayRole && bodyHits >= 1) {
    score = Math.max(score, PATHWAY_BASE_SCORE + Math.min(18, bodyHits * 2.5));
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  // Reject: neither a security title nor a pathway title nor enough body signal.
  if (!coreTitleHit && !pathwayTitleHit && !(weakTitleHit && bodyHits >= 6) && bodyHits < 10) {
    return reject('Not cybersecurity-related');
  }
  // Pathway roles need at least a little security context to be worth showing.
  if (isPathwayRole && bodyHits < 1) {
    return reject('Adjacent IT role with no security signal');
  }

  const { category, secondary } = categorize(t, body, isPathwayRole);

  return { category, secondary, relevanceScore: score, isPathwayRole, rejected: false };
}

function reject(reason: string): Classification {
  return {
    category: 'other',
    secondary: [],
    relevanceScore: 0,
    isPathwayRole: false,
    rejected: true,
    rejectReason: reason,
  };
}

function categorize(title: string, body: string, isPathway: boolean): { category: JobCategory; secondary: JobCategory[] } {
  const scores = new Map<JobCategory, number>();

  for (const rule of CATEGORY_RULES) {
    let s = 0;
    if (rule.title.test(title)) s += 10 * (rule.weight ?? 1);
    if (rule.body?.test(body)) s += 3;
    if (s > 0) scores.set(rule.category, (scores.get(rule.category) ?? 0) + s);
  }

  if (scores.size === 0) {
    return { category: isPathway ? 'adjacent_it' : 'other', secondary: [] };
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  // A pathway role should be filed under adjacent_it even if it also matched something else.
  let primary = ranked[0][0];
  if (isPathway && ranked[0][1] < 10) primary = 'adjacent_it';

  const secondary = ranked
    .slice(1)
    .filter(([, s]) => s >= 5)
    .map(([c]) => c)
    .filter((c) => c !== primary)
    .slice(0, 3);

  return { category: primary, secondary };
}

/**
 * Blend relevance with freshness, salary transparency and description depth
 * to produce the default "Best match" ordering.
 */
export function computeRankScore(input: {
  relevanceScore: number;
  postedAt: string | null;
  hasSalary: boolean;
  descriptionLength: number;
  isOntario: boolean;
  isRemoteCanada: boolean;
  isExpired: boolean;
  isPathwayRole: boolean;
}): number {
  let score = input.relevanceScore;

  const ageDays = input.postedAt ? (Date.now() - Date.parse(input.postedAt)) / 86_400_000 : 45;
  if (Number.isFinite(ageDays)) {
    if (ageDays <= 1) score += 18;
    else if (ageDays <= 3) score += 14;
    else if (ageDays <= 7) score += 10;
    else if (ageDays <= 14) score += 5;
    else if (ageDays <= 30) score += 1;
    else if (ageDays > 60) score -= 12;
    else score -= 5;
  }

  if (input.hasSalary) score += 6;
  if (input.descriptionLength > 1200) score += 4;
  else if (input.descriptionLength < 300) score -= 8;
  if (input.isOntario) score += 8;
  else if (input.isRemoteCanada) score += 4;
  if (input.isPathwayRole) score -= 10;
  if (input.isExpired) score -= 40;

  return Math.round(Math.max(0, Math.min(150, score)));
}
