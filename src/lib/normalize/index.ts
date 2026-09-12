import { decodeEscapedHtml, htmlToText, sanitizeHtml, summarize } from '@/lib/normalize/html';
import { toIso } from '@/lib/normalize/dates';
import { findSalaryInText, parseSalary } from '@/lib/normalize/salary';
import { extractRequirements, buildKeywords } from '@/lib/normalize/extract';
import { classify, computeRankScore } from '@/lib/normalize/relevance';
import { companyKey, fingerprintOf, jobIdOf } from '@/lib/normalize/dedupe';
import { cleanTitle, inferEmploymentType, inferExperienceLevel, normalizeTitle } from '@/lib/taxonomy/titles';
import { detectHybrid, detectRemote, matchLocation } from '@/lib/taxonomy/canada';
import type { Job, RawJob, WorkArrangement } from '@/lib/types';

export interface NormalizeOptions {
  /** Keep postings outside Ontario when they are remote-Canada. */
  allowRemoteCanada: boolean;
  /** Keep adjacent IT roles that can lead into security. */
  includePathway: boolean;
  /** Minimum relevance score to keep. */
  minRelevance: number;
  now?: Date;
}

export const DEFAULT_NORMALIZE_OPTIONS: NormalizeOptions = {
  allowRemoteCanada: true,
  includePathway: true,
  minRelevance: 25,
};

export interface NormalizeOutcome {
  job: Job | null;
  reason?: string;
}

const EXPIRY_DAYS = 60;

/**
 * Does this text actually describe the job?
 *
 * Six or more words, at least one of them a real word rather than a code. That
 * clears prose while rejecting "2617970" and "Bangalore · Karnataka · JREQ203319".
 */
/**
 * Rough language detection, French vs English.
 *
 * Only two languages matter here, and the signal is strong: French postings are
 * dense with accents and function words English never uses. This is a display
 * hint — it decides whether to badge a posting "FR" and offer a translation
 * link — so a wrong answer costs a mislabelled badge, not a lost posting.
 */
const FRENCH_MARKERS =
  /\b(et|le|la|les|des|une|un|du|au|aux|pour|dans|sur|avec|vous|nous|est|sont|être|votre|notre|sécurité|réseau|données|expérience|travail|équipe|gestion|entreprise|poste|emploi|compétences|connaissances)\b/gi;
const ENGLISH_MARKERS =
  /\b(and|the|of|for|with|you|we|is|are|be|your|our|security|network|data|experience|work|team|management|company|role|job|skills|knowledge)\b/gi;

export function detectLanguage(text: string): 'fr' | 'en' {
  const sample = (text ?? '').slice(0, 4000);
  if (!sample.trim()) return 'en';
  const fr = (sample.match(FRENCH_MARKERS) ?? []).length;
  const en = (sample.match(ENGLISH_MARKERS) ?? []).length;
  // Accented characters are a strong tiebreaker; English postings rarely have them.
  const accents = (sample.match(/[àâäçéèêëîïôöùûüœ]/gi) ?? []).length;
  return fr + accents / 2 > en ? 'fr' : 'en';
}

function isMeaningfulDescription(text: string): boolean {
  if (!text) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 6) return false;
  const realWords = words.filter((w) => /^[a-z]{3,}$/i.test(w) && !/^\d+$/.test(w));
  return realWords.length >= 4;
}

export function normalizeJob(raw: RawJob, opts: NormalizeOptions = DEFAULT_NORMALIZE_OPTIONS): NormalizeOutcome {
  const now = opts.now ?? new Date();
  const nowIso = now.toISOString();

  const titleRaw = (raw.title ?? '').trim();
  if (!titleRaw) return { job: null, reason: 'missing title' };
  const company = (raw.company ?? '').trim() || 'Unknown employer';

  // Decode before parsing, not after. Greenhouse serves its `content` field
  // entity-encoded; without this the tag-stripper finds nothing to strip and the
  // entity-decoder then leaves literal <p> tags in the summary. Handled here
  // rather than per-connector so any source doing the same is covered.
  const rawDescription = raw.descriptionIsHtml ? decodeEscapedHtml(raw.description ?? '') : (raw.description ?? '');
  const descriptionHtml = raw.descriptionIsHtml ? sanitizeHtml(rawDescription) : null;
  const descriptionText = raw.descriptionIsHtml ? htmlToText(rawDescription) : rawDescription.trim();
  // Some feeds hand back metadata where the description should be — Workday's
  // list endpoint returns bullet fields, so cards were published reading
  // "R260024652". A handful of identifier-ish tokens is not a description, and
  // showing nothing is better than showing a requisition number.
  const description = isMeaningfulDescription(descriptionText) ? descriptionText : '';

  const cls = classify(titleRaw, description, raw.departmentRaw ?? '');
  if (cls.rejected) return { job: null, reason: cls.rejectReason };
  if (cls.isPathwayRole && !opts.includePathway) return { job: null, reason: 'pathway role excluded' };
  if (cls.relevanceScore < opts.minRelevance) return { job: null, reason: `relevance ${cls.relevanceScore} below threshold` };

  const geo = matchLocation(raw.locationRaw);
  const locationText = `${raw.locationRaw ?? ''} ${description.slice(0, 2500)}`;
  const remote = Boolean(raw.remoteHint) || geo.isRemote || detectRemote(raw.locationRaw ?? '');
  const hybrid = detectHybrid(`${raw.locationRaw ?? ''} ${description.slice(0, 4000)}`);

  let arrangement: WorkArrangement = 'unknown';
  if (hybrid) arrangement = 'hybrid';
  else if (remote) arrangement = 'remote';
  else if (geo.city) arrangement = 'onsite';

  // A bare mention of "Canada" anywhere in the description is not evidence that
  // a role is open to Canada — plenty of US-only postings say "the US and
  // Canada" in boilerplate. A Plaid role listing New York, Seattle, Raleigh and
  // San Francisco got in that way. Require the location field to say Canada, or
  // the text to tie remote and Canada together explicitly.
  const REMOTE_CANADA_RE =
    /\b(remote|work\s*from\s*home|distributed|hybrid)\b[^.!?]{0,60}\bcanada\b|\bcanada\b[^.!?]{0,60}\b(remote|work\s*from\s*home|distributed)\b|\banywhere in canada\b|\bcanada[-\s]based\b/i;
  const isRemoteCanada =
    arrangement === 'remote' && (geo.isCanada || REMOTE_CANADA_RE.test(locationText));

  // Geography gate. A location field that names somewhere outside Canada is
  // decisive: the description cannot argue it back in.
  if (!geo.isInScope) {
    if (geo.isForeign || !(opts.allowRemoteCanada && isRemoteCanada)) {
      return { job: null, reason: `outside coverage (${raw.locationRaw || 'no location'})` };
    }
  }

  const salaryRaw = raw.salaryRaw ?? findSalaryInText(description);
  const salary = parseSalary(salaryRaw, description);

  const requirements = extractRequirements(description);
  const experienceLevel = inferExperienceLevel(titleRaw, description);
  const employmentType = inferEmploymentType(raw.employmentTypeRaw, titleRaw, description.slice(0, 2000));

  const postedAt = toIso(raw.postedAt) ?? null;
  const ageDays = postedAt ? (now.getTime() - Date.parse(postedAt)) / 86_400_000 : null;
  const isExpired = ageDays != null && ageDays > EXPIRY_DAYS;

  const id = jobIdOf(raw.sourceId, raw.sourceJobId);
  const fingerprint = fingerprintOf({
    title: titleRaw,
    company,
    city: geo.city,
    isRemote: arrangement === 'remote',
  });

  const title = cleanTitle(titleRaw);

  const job: Job = {
    id,
    fingerprint,
    titleRaw,
    title,
    titleNormalized: normalizeTitle(titleRaw),
    company,
    companySlug: companyKey(company),
    companyUrl: raw.companyUrl ?? null,

    locationRaw: (raw.locationRaw ?? '').trim() || (arrangement === 'remote' ? 'Remote' : 'Not specified'),
    city: geo.city,
    region: geo.region,
    country: geo.country ?? (geo.isCanada ? 'Canada' : null),
    language: detectLanguage(`${titleRaw} ${description}`),
    province: geo.province,
    provinceName: geo.provinceName,
    isOntario: geo.isOntario,
    isCanada: geo.isCanada || isRemoteCanada,

    workArrangement: arrangement,
    experienceLevel,
    employmentType,
    category: cls.category,
    secondaryCategories: cls.secondary,

    salary,
    requirements,

    description,
    descriptionHtml,
    summary: summarize(description),

    postedAt,
    firstSeenAt: nowIso,
    lastSeenAt: nowIso,
    expiresAt: postedAt ? new Date(Date.parse(postedAt) + EXPIRY_DAYS * 86_400_000).toISOString() : null,
    isExpired,
    isRepost: false,
    repostOf: null,

    sourceId: raw.sourceId,
    sourceName: raw.sourceName,
    sourceUrl: raw.sourceUrl,
    applyUrl: raw.applyUrl || raw.sourceUrl,

    relevanceScore: cls.relevanceScore,
    isPathwayRole: cls.isPathwayRole,
    rankScore: 0,

    keywords: buildKeywords(title, company, geo.city, requirements.technologies.join(' '), description.slice(0, 6000)),
    duplicateCount: 1,
    alsoPostedOn: [],
  };

  job.rankScore = computeRankScore({
    relevanceScore: job.relevanceScore,
    postedAt: job.postedAt,
    hasSalary: job.salary.min != null,
    descriptionLength: job.description.length,
    isOntario: job.isOntario,
    isRemoteCanada,
    isExpired: job.isExpired,
    isPathwayRole: job.isPathwayRole,
  });

  return { job };
}

export { computeRankScore } from '@/lib/normalize/relevance';
