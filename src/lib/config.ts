/** Runtime configuration, all read from environment variables. */

function bool(v: string | undefined, fallback = false): boolean {
  if (v == null || v === '') return fallback;
  return /^(1|true|yes|on)$/i.test(v.trim());
}

function num(v: string | undefined, fallback: number): number {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

function list(v: string | undefined): string[] {
  return (v ?? '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'CyberJobs Ontario',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',

  supabase: {
    url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    anonKey: process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    get enabled(): boolean {
      return Boolean(
        (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL) &&
          (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      );
    },
  },

  cronSecret: process.env.CRON_SECRET ?? '',

  /** Contact address advertised in the crawler User-Agent, per good-citizen practice. */
  crawlerContact: process.env.CRAWLER_CONTACT ?? 'https://github.com/Roshan-Dennis/cyberjobs-ontario',
  userAgent:
    process.env.CRAWLER_USER_AGENT ??
    `CyberJobsOntarioBot/1.0 (+${process.env.CRAWLER_CONTACT ?? 'https://github.com/Roshan-Dennis/cyberjobs-ontario'})`,

  ingest: {
    /** Hard ceiling on wall-clock time for one ingestion run (serverless limits). */
    maxDurationMs: num(process.env.INGEST_MAX_DURATION_MS, 240_000),
    concurrency: num(process.env.INGEST_CONCURRENCY, 4),
    minRelevance: num(process.env.INGEST_MIN_RELEVANCE, 25),
    includePathway: bool(process.env.INGEST_INCLUDE_PATHWAY, true),
    allowRemoteCanada: bool(process.env.INGEST_ALLOW_REMOTE_CANADA, true),
    /** Postings older than this are marked expired. */
    expiryDays: num(process.env.INGEST_EXPIRY_DAYS, 60),
    /** Only these sources run, when set. */
    only: list(process.env.INGEST_SOURCES),
    disabled: list(process.env.INGEST_DISABLED_SOURCES),
    /** Extra ATS board tokens supplied by the operator. */
    extraGreenhouse: list(process.env.EXTRA_GREENHOUSE_BOARDS),
    extraLever: list(process.env.EXTRA_LEVER_BOARDS),
    extraAshby: list(process.env.EXTRA_ASHBY_BOARDS),
    extraWorkable: list(process.env.EXTRA_WORKABLE_BOARDS),
    extraRecruitee: list(process.env.EXTRA_RECRUITEE_BOARDS),
    extraSmartRecruiters: list(process.env.EXTRA_SMARTRECRUITERS_BOARDS),
  },

  jobbank: {
    enabled: bool(process.env.JOBBANK_ENABLED, true),
    /** Job Bank's robots.txt asks for Crawl-delay: 5. Do not lower this. */
    crawlDelayMs: Math.max(5000, num(process.env.JOBBANK_CRAWL_DELAY_MS, 5000)),
    maxPagesPerQuery: num(process.env.JOBBANK_MAX_PAGES, 2),
    maxQueries: num(process.env.JOBBANK_MAX_QUERIES, 8),
    fetchDetails: bool(process.env.JOBBANK_FETCH_DETAILS, false),
  },

  adzuna: {
    appId: process.env.ADZUNA_APP_ID ?? '',
    appKey: process.env.ADZUNA_APP_KEY ?? '',
    get enabled(): boolean {
      return Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
    },
    maxPages: num(process.env.ADZUNA_MAX_PAGES, 3),
  },

  jooble: {
    apiKey: process.env.JOOBLE_API_KEY ?? '',
    get enabled(): boolean {
      return Boolean(process.env.JOOBLE_API_KEY);
    },
  },

  /**
   * Sources whose robots.txt disallows automated access are opt-in only.
   * Enable them only if you have permission from the operator.
   */
  optIn: {
    smartrecruiters: bool(process.env.ENABLE_SMARTRECRUITERS, false),
    remotive: bool(process.env.ENABLE_REMOTIVE, false),
  },

  cache: {
    /** Seconds the API layer may serve a memoised search result. */
    searchTtl: num(process.env.SEARCH_CACHE_TTL, 60),
    /** In file/memory mode, re-ingest automatically after this many seconds. */
    memoryRefreshTtl: num(process.env.MEMORY_REFRESH_TTL, 1800),
  },

  isProd: process.env.NODE_ENV === 'production',
};

export type AppConfig = typeof config;
