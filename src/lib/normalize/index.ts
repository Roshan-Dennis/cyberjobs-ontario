import { htmlToText, sanitizeHtml, summarize } from '@/lib/normalize/html';
import { toIso } from '@/lib/normalize/dates';
import { findSalaryInText, parseSalary } from '@/lib/normalize/salary';
import { extractRequirements, buildKeywords } from '@/lib/normalize/extract';
import { classify, computeRankScore } from '@/lib/normalize/relevance';
import { companyKey, fingerprintOf, jobIdOf } from '@/lib/normalize/dedupe';
import { cleanTitle, inferEmploymentType, inferExperienceLevel, normalizeTitle } from '@/lib/taxonomy/titles';
import { detectHybrid, detectRemote, matchLocation } from '@/lib/taxonomy/ontario';
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

export function normalizeJob(raw: RawJob, opts: NormalizeOptions = DEFAULT_NORMALIZE_OPTIONS): NormalizeOutcome {
  const now = opts.now ?? new Date();
  const nowIso = now.toISOString();

  const titleRaw = (raw.title ?? '').trim();
  if (!titleRaw) return { job: null, reason: 'missing title' };
  const company = (raw.company ?? '').trim() || 'Unknown employer';

  const descriptionHtml = raw.descriptionIsHtml ? sanitizeHtml(raw.description ?? '') : null;
  const description = raw.descriptionIsHtml ? htmlToText(raw.description ?? '') : (raw.description ?? '').trim();

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

  const isRemoteCanada = arrangement === 'remote' && (geo.isCanada || /\bcanada\b/i.test(locationText));

  // Geography gate.
  if (!geo.isOntario) {
    if (!(opts.allowRemoteCanada && isRemoteCanada)) {
      return { job: null, reason: `outside Ontario (${raw.locationRaw || 'no location'})` };
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
