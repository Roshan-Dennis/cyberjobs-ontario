/**
 * Core domain types shared by the ingestion pipeline, the storage layer and the UI.
 */

export type WorkArrangement = 'remote' | 'hybrid' | 'onsite' | 'unknown';

export type ExperienceLevel =
  | 'internship'
  | 'coop'
  | 'entry'
  | 'junior'
  | 'mid'
  | 'senior'
  | 'lead'
  | 'manager'
  | 'director'
  | 'executive'
  | 'unknown';

export const EXPERIENCE_LEVELS: ExperienceLevel[] = [
  'internship',
  'coop',
  'entry',
  'junior',
  'mid',
  'senior',
  'lead',
  'manager',
  'director',
  'executive',
];

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  internship: 'Internship',
  coop: 'Co-op',
  entry: 'Entry level',
  junior: 'Junior',
  mid: 'Mid level',
  senior: 'Senior',
  lead: 'Lead / Principal',
  manager: 'Manager',
  director: 'Director',
  executive: 'Executive',
  unknown: 'Not specified',
};

export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'temporary'
  | 'internship'
  | 'volunteer'
  | 'unknown';

export const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  temporary: 'Temporary',
  internship: 'Internship',
  volunteer: 'Volunteer',
  unknown: 'Not specified',
};

/**
 * Job families. `adjacent` roles are non-security roles (helpdesk, NOC, sysadmin,
 * cloud/network engineering) that are realistic stepping stones into security.
 */
export type JobCategory =
  | 'soc_analysis'
  | 'incident_response'
  | 'threat_intelligence'
  | 'dfir'
  | 'vulnerability_management'
  | 'penetration_testing'
  | 'grc'
  | 'iam_pam'
  | 'cloud_security'
  | 'application_security'
  | 'network_security'
  | 'security_engineering'
  | 'devsecops'
  | 'security_architecture'
  | 'ot_ics_security'
  | 'privacy_data_protection'
  | 'security_administration'
  | 'security_leadership'
  | 'security_sales_engineering'
  | 'adjacent_it'
  | 'other';

export const CATEGORY_LABELS: Record<JobCategory, string> = {
  soc_analysis: 'SOC / Security Analysis',
  incident_response: 'Incident Response',
  threat_intelligence: 'Threat Intelligence',
  dfir: 'Digital Forensics (DFIR)',
  vulnerability_management: 'Vulnerability Management',
  penetration_testing: 'Penetration Testing / Red Team',
  grc: 'GRC / Compliance / Audit',
  iam_pam: 'IAM / PAM',
  cloud_security: 'Cloud Security',
  application_security: 'Application Security',
  network_security: 'Network Security',
  security_engineering: 'Security Engineering',
  devsecops: 'DevSecOps',
  security_architecture: 'Security Architecture',
  ot_ics_security: 'OT / ICS Security',
  privacy_data_protection: 'Privacy & Data Protection',
  security_administration: 'Security Administration',
  security_leadership: 'Security Leadership',
  security_sales_engineering: 'Security Sales Engineering',
  adjacent_it: 'IT / Pathway into security',
  other: 'Other',
};

export interface SalaryInfo {
  min: number | null;
  max: number | null;
  currency: string | null;
  /** 'year' | 'month' | 'week' | 'day' | 'hour' */
  period: string | null;
  /** Normalised annual midpoint in CAD-ish terms, for sorting/filtering. */
  annualMin: number | null;
  annualMax: number | null;
  raw: string | null;
}

export interface JobRequirements {
  requiredSkills: string[];
  preferredSkills: string[];
  technologies: string[];
  certifications: string[];
  education: string[];
  /** e.g. "3+ years" */
  yearsExperience: string | null;
  yearsExperienceMin: number | null;
}

export interface RawJob {
  /** Stable id from the source, if any. */
  sourceJobId: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  applyUrl: string;
  title: string;
  company: string;
  companyUrl?: string | null;
  locationRaw: string;
  /** Plain text or HTML description. */
  description: string;
  descriptionIsHtml: boolean;
  postedAt?: string | number | null;
  employmentTypeRaw?: string | null;
  salaryRaw?: string | null;
  remoteHint?: boolean | null;
  departmentRaw?: string | null;
  extra?: Record<string, unknown>;
}

export interface Job {
  id: string;
  fingerprint: string;
  titleRaw: string;
  title: string;
  titleNormalized: string;
  company: string;
  companySlug: string;
  companyUrl: string | null;

  locationRaw: string;
  city: string | null;
  region: string | null;
  country: string | null;
  isOntario: boolean;
  isCanada: boolean;

  workArrangement: WorkArrangement;
  experienceLevel: ExperienceLevel;
  employmentType: EmploymentType;
  category: JobCategory;
  secondaryCategories: JobCategory[];

  salary: SalaryInfo;
  requirements: JobRequirements;

  description: string;
  descriptionHtml: string | null;
  summary: string;

  postedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  expiresAt: string | null;
  isExpired: boolean;
  isRepost: boolean;
  repostOf: string | null;

  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  applyUrl: string;

  /** 0-100 cybersecurity relevance. */
  relevanceScore: number;
  /** True when this is not a security title but is a credible pathway role. */
  isPathwayRole: boolean;
  /** Combined ranking score used for the default "Best match" sort. */
  rankScore: number;

  keywords: string[];
  duplicateCount: number;
  alsoPostedOn: { sourceName: string; url: string }[];
}

export interface JobFilters {
  q?: string;
  experience?: ExperienceLevel[];
  categories?: JobCategory[];
  arrangement?: WorkArrangement[];
  employment?: EmploymentType[];
  cities?: string[];
  companies?: string[];
  skills?: string[];
  certifications?: string[];
  /** Days since posting. */
  postedWithinDays?: number;
  postedFrom?: string;
  postedTo?: string;
  salaryMin?: number;
  hasSalary?: boolean;
  includeExpired?: boolean;
  includePathway?: boolean;
  onlyPathway?: boolean;
  sources?: string[];
  sort?: SortKey;
  page?: number;
  pageSize?: number;
}

export type SortKey = 'relevance' | 'newest' | 'oldest' | 'salary' | 'company';

export interface Facet {
  value: string;
  label: string;
  count: number;
}

export interface JobSearchResult {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: {
    categories: Facet[];
    experience: Facet[];
    arrangement: Facet[];
    employment: Facet[];
    cities: Facet[];
    companies: Facet[];
    sources: Facet[];
    certifications: Facet[];
    skills: Facet[];
  };
  meta: {
    lastIngestAt: string | null;
    generatedAt: string;
    degraded: boolean;
    notes: string[];
  };
}

export interface SourceRunReport {
  sourceId: string;
  sourceName: string;
  ok: boolean;
  fetched: number;
  kept: number;
  durationMs: number;
  error?: string;
  skipped?: string;
}

export interface IngestReport {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  sources: SourceRunReport[];
  totalFetched: number;
  totalKept: number;
  inserted: number;
  updated: number;
  expired: number;
  duplicatesMerged: number;
}
