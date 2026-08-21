/**
 * Curated registry of public applicant-tracking-system job boards.
 *
 * Every entry here is a board whose vendor publishes an unauthenticated JSON
 * feed intended for public consumption (that is how the company's own careers
 * page renders). Tokens that 404 are skipped silently at ingest time and
 * reported in the run summary, so a stale entry costs nothing.
 *
 * Bias of the list: employers with a real Ontario footprint (banks, telecom,
 * public sector suppliers, health, retail, tech) plus security vendors and
 * remote-Canada-friendly companies.
 */

export interface BoardEntry {
  token: string;
  label: string;
  /** Rough hint only; the pipeline still geo-filters every posting. */
  hint?: string;
}

/* ------------------------------------------------------------------ */
/* Greenhouse: https://boards-api.greenhouse.io/v1/boards/{token}/jobs  */
/* ------------------------------------------------------------------ */
export const GREENHOUSE_BOARDS: BoardEntry[] = [
  // Canadian / strong Ontario presence
  { token: 'hootsuite', label: 'Hootsuite' },
  { token: 'faire', label: 'Faire', hint: 'Toronto/Kitchener' },
  { token: 'leagueinc', label: 'League', hint: 'Toronto' },
  { token: 'ritual', label: 'Ritual', hint: 'Toronto' },
  { token: 'flipp', label: 'Flipp', hint: 'Toronto' },
  { token: 'd2l', label: 'D2L', hint: 'Kitchener' },

  // Security vendors and MSSPs (many hire in Ontario or remote-Canada)
  { token: 'cloudflare', label: 'Cloudflare' },
  { token: 'tenableinc', label: 'Tenable' },
  { token: 'zscaler', label: 'Zscaler' },
  { token: 'netskope', label: 'Netskope' },
  { token: 'okta', label: 'Okta' },
  { token: 'huntress', label: 'Huntress' },
  { token: 'dragos', label: 'Dragos' },
  { token: 'recordedfuture', label: 'Recorded Future' },
  { token: 'expel', label: 'Expel' },
  { token: 'veracode', label: 'Veracode' },
  { token: 'bugcrowd', label: 'Bugcrowd' },
  { token: 'securityscorecard', label: 'SecurityScorecard' },
  { token: 'axonius', label: 'Axonius' },
  { token: 'yubico', label: 'Yubico' },
  { token: 'keyfactorinc', label: 'Keyfactor' },
  { token: 'sumologic', label: 'Sumo Logic' },
  { token: 'cribl', label: 'Cribl' },
  { token: 'abnormalsecurity', label: 'Abnormal Security' },

  // Big tech / platform companies with Ontario offices or remote-CA roles
  { token: 'stripe', label: 'Stripe' },
  { token: 'databricks', label: 'Databricks' },
  { token: 'gitlab', label: 'GitLab' },
  { token: 'mongodb', label: 'MongoDB' },
  { token: 'elastic', label: 'Elastic' },
  { token: 'datadog', label: 'Datadog' },
  { token: 'twilio', label: 'Twilio' },
  { token: 'dropbox', label: 'Dropbox' },
  { token: 'reddit', label: 'Reddit' },
  { token: 'pinterest', label: 'Pinterest' },
  { token: 'instacart', label: 'Instacart' },
  { token: 'affirm', label: 'Affirm' },
  { token: 'robinhood', label: 'Robinhood' },
  { token: 'coinbase', label: 'Coinbase' },
  { token: 'samsara', label: 'Samsara' },
  { token: 'gusto', label: 'Gusto' },
  { token: 'asana', label: 'Asana' },
  { token: 'grafanalabs', label: 'Grafana Labs' },
  { token: 'vercel', label: 'Vercel' },
  { token: 'clickhouse', label: 'ClickHouse' },
  { token: 'temporaltechnologies', label: 'Temporal' },
  { token: 'brex', label: 'Brex' },
  { token: 'nuro', label: 'Nuro' },
  { token: 'scaleai', label: 'Scale AI' },

  // Relocated here after a platform migration (verified 2026-08-21).
  { token: 'runzero', label: 'runZero' },
  { token: 'censys', label: 'Censys' },
  { token: 'tailscale', label: 'Tailscale', hint: 'Toronto' },
  { token: 'chainguard', label: 'Chainguard' },
  { token: 'corelight', label: 'Corelight' },
];

/* ------------------------------------------------------------------ */
/* Lever: https://api.lever.co/v0/postings/{token}?mode=json           */
/* ------------------------------------------------------------------ */
export const LEVER_BOARDS: BoardEntry[] = [
  { token: 'palantir', label: 'Palantir' },
  { token: 'bluecatnetworks', label: 'BlueCat Networks', hint: 'Toronto' },
  { token: 'sonatype', label: 'Sonatype' },
  { token: 'sysdig', label: 'Sysdig' },
  { token: 'magnetforensics', label: 'Magnet Forensics', hint: 'Waterloo' },
  { token: 'trustarc', label: 'TrustArc' },

  // Relocated here after a platform migration (verified 2026-08-21).
  { token: 'pointclickcare', label: 'PointClickCare', hint: 'Mississauga' },
  { token: 'achievers', label: 'Achievers', hint: 'Toronto' },
  { token: 'fullscript', label: 'Fullscript', hint: 'Ottawa' },
  { token: 'sophos', label: 'Sophos' },
  { token: 'sonarsource', label: 'Sonar' },
  { token: 'jumpcloud', label: 'JumpCloud' },
  { token: 'secureframe', label: 'Secureframe' },
];

/* ------------------------------------------------------------------ */
/* Ashby: https://api.ashbyhq.com/posting-api/job-board/{token}        */
/* ------------------------------------------------------------------ */
export const ASHBY_BOARDS: BoardEntry[] = [
  { token: 'ramp', label: 'Ramp' },
  { token: 'cohere', label: 'Cohere', hint: 'Toronto' },
  { token: 'linear', label: 'Linear' },
  { token: 'notion', label: 'Notion' },
  { token: 'openai', label: 'OpenAI' },
  { token: 'runway', label: 'Runway' },
  { token: 'oso', label: 'Oso' },
  { token: 'doppler', label: 'Doppler' },
  { token: 'semgrep', label: 'Semgrep' },
  { token: 'socket', label: 'Socket' },
  { token: 'sardine', label: 'Sardine' },
  { token: 'vetcove', label: 'Vetcove' },

  // Relocated here after a platform migration (verified 2026-08-21).
  { token: 'wealthsimple', label: 'Wealthsimple', hint: 'Toronto' },
  { token: '1password', label: '1Password', hint: 'Toronto' },
  { token: 'jobber', label: 'Jobber', hint: 'Toronto/Edmonton' },
  { token: 'loopio', label: 'Loopio', hint: 'Toronto' },
  { token: 'docebo', label: 'Docebo', hint: 'Toronto' },
  { token: 'miovision', label: 'Miovision', hint: 'Kitchener' },
  { token: 'benevity', label: 'Benevity' },
  { token: 'clearco', label: 'Clearco', hint: 'Toronto' },
  { token: 'koho', label: 'KOHO' },
  { token: 'neofinancial', label: 'Neo Financial' },
  { token: 'trulioo', label: 'Trulioo' },
  { token: 'hackerone', label: 'HackerOne' },
  { token: 'vanta', label: 'Vanta' },
  { token: 'drata', label: 'Drata' },
  { token: 'plaid', label: 'Plaid' },
  { token: 'lightspeed', label: 'Lightspeed Commerce' },
];

/* ------------------------------------------------------------------ */
/* Workable: https://apply.workable.com/api/v1/widget/accounts/{token} */
/* ------------------------------------------------------------------ */
export const WORKABLE_BOARDS: BoardEntry[] = [
  { token: 'cybeready', label: 'CybeReady' },
  { token: 'hackthebox', label: 'Hack The Box' },
  { token: 'nozominetworks', label: 'Nozomi Networks' },
  { token: 'cymulate', label: 'Cymulate' },
  { token: 'pentera', label: 'Pentera' },
  { token: 'safebreach', label: 'SafeBreach' },
  { token: 'coro', label: 'Coro' },
  { token: 'cyberint', label: 'Cyberint' },
  { token: 'gomboc', label: 'Gomboc AI' },
  { token: 'kovrr', label: 'Kovrr' },
];

/* ------------------------------------------------------------------ */
/* Recruitee: https://{token}.recruitee.com/api/offers/                */
/* ------------------------------------------------------------------ */
export const RECRUITEE_BOARDS: BoardEntry[] = [
  { token: 'eyeo', label: 'eyeo' },
  { token: 'usercentrics', label: 'Usercentrics' },
  { token: 'hive', label: 'Hive' },
];

/* ------------------------------------------------------------------ */
/* SmartRecruiters (opt-in): api.smartrecruiters.com/v1/companies/{id} */
/* ------------------------------------------------------------------ */
export const SMARTRECRUITERS_BOARDS: BoardEntry[] = [
  { token: 'Telus', label: 'TELUS' },
  { token: 'Bosch', label: 'Bosch' },
  { token: 'Visa', label: 'Visa' },
  { token: 'Ubisoft', label: 'Ubisoft' },
  { token: 'McDonalds', label: "McDonald's" },
];

/* ------------------------------------------------------------------ */
/* Workday tenants (robots.txt is checked per tenant before crawling)  */
/* Endpoint: https://{host}/wday/cxs/{tenant}/{site}/jobs              */
/* ------------------------------------------------------------------ */
export interface WorkdayEntry {
  label: string;
  host: string;
  tenant: string;
  site: string;
  hint?: string;
}

export const WORKDAY_TENANTS: WorkdayEntry[] = [
  // Verified against each tenant's own robots.txt sitemap, which lists the real
  // site slug. Guessed slugs answer HTTP 422 and yield nothing — the first two
  // live runs wasted nine entries that way.
  { label: 'RBC (Early Talent)', host: 'rbc.wd3.myworkdayjobs.com', tenant: 'rbc', site: 'RBCEARLYTALENT1', hint: 'Toronto' },
  { label: 'CIBC', host: 'cibc.wd3.myworkdayjobs.com', tenant: 'cibc', site: 'search', hint: 'Toronto' },
  { label: 'BMO', host: 'bmo.wd3.myworkdayjobs.com', tenant: 'bmo', site: 'External', hint: 'Toronto' },
  { label: 'Manulife', host: 'manulife.wd3.myworkdayjobs.com', tenant: 'manulife', site: 'MFCJH_Jobs', hint: 'Toronto/Waterloo' },
  { label: 'Sun Life', host: 'sunlife.wd3.myworkdayjobs.com', tenant: 'sunlife', site: 'Experienced-Jobs', hint: 'Toronto/Waterloo' },
  { label: 'Thomson Reuters', host: 'thomsonreuters.wd5.myworkdayjobs.com', tenant: 'thomsonreuters', site: 'External_Career_Site', hint: 'Toronto' },
  { label: 'Aviva Canada', host: 'aviva.wd1.myworkdayjobs.com', tenant: 'aviva', site: 'External', hint: 'Markham' },
  { label: 'OMERS', host: 'omers.wd3.myworkdayjobs.com', tenant: 'omers', site: 'OMERS_Careers', hint: 'Toronto' },

  { label: 'Loblaw', host: 'myview.wd3.myworkdayjobs.com', tenant: 'myview', site: 'loblaw_careers', hint: 'Brampton' },
  { label: 'Shoppers Drug Mart', host: 'myview.wd3.myworkdayjobs.com', tenant: 'myview', site: 'sdm_careers', hint: 'Toronto' },
  { label: 'Loblaw Digital', host: 'myview.wd3.myworkdayjobs.com', tenant: 'myview', site: 'Loblaw-Digital_Careers_Carrieres', hint: 'Toronto' },
  { label: 'Canadian Tire', host: 'canadiantirecorporation.wd3.myworkdayjobs.com', tenant: 'canadiantirecorporation', site: 'Enterprise_External_Careers_Site', hint: 'Toronto' },
  { label: 'Ontario Teachers Pension Plan', host: 'otppb.wd3.myworkdayjobs.com', tenant: 'otppb', site: 'OntarioTeachers_Careers', hint: 'Toronto' },
  { label: 'Ontario Health', host: 'oh.wd3.myworkdayjobs.com', tenant: 'oh', site: 'OH', hint: 'Ontario-wide' },
  { label: 'Scarborough Health Network', host: 'shn.wd10.myworkdayjobs.com', tenant: 'shn', site: 'SHN_External_Career_Site', hint: 'Toronto' },

  // Security vendors with an Ontario footprint. Slugs read off each company's
  // own careers page rather than guessed, so these are the real site names.
  { label: 'Arctic Wolf Networks', host: 'arcticwolf.wd1.myworkdayjobs.com', tenant: 'arcticwolf', site: 'External', hint: 'Waterloo' },
  { label: 'CrowdStrike', host: 'crowdstrike.wd5.myworkdayjobs.com', tenant: 'crowdstrike', site: 'crowdstrikecareers' },
  { label: 'BlackBerry', host: 'bb.wd3.myworkdayjobs.com', tenant: 'bb', site: 'BlackBerry', hint: 'Waterloo' },
  { label: 'BlackBerry QNX', host: 'bb.wd3.myworkdayjobs.com', tenant: 'bb', site: 'QNX', hint: 'Ottawa/Waterloo' },
  { label: 'BlackBerry (Students)', host: 'bb.wd3.myworkdayjobs.com', tenant: 'bb', site: 'Student', hint: 'Waterloo' },

  // Removed after verification — these employers are not on Workday:
  //   eSentire   -> Dayforce (can60.dayforcehcm.com), no connector yet
  //   Scotiabank  -> SuccessFactors (jobs.scotiabank.com)
  //   Air Canada  -> Taleo (aircanada.taleo.net)
  //   OpenText, Definity, UHN, CPP Investments -> no public Workday tenant found
];

export function boardsWithExtras(base: BoardEntry[], extras: string[]): BoardEntry[] {
  const seen = new Set(base.map((b) => b.token.toLowerCase()));
  const out = [...base];
  for (const token of extras) {
    if (seen.has(token.toLowerCase())) continue;
    seen.add(token.toLowerCase());
    out.push({ token, label: token });
  }
  return out;
}
