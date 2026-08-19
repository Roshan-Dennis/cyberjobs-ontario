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
  { token: 'wealthsimple', label: 'Wealthsimple', hint: 'Toronto' },
  { token: '1password', label: '1Password', hint: 'Toronto' },
  { token: 'clio', label: 'Clio', hint: 'Toronto/Burnaby' },
  { token: 'jobber', label: 'Jobber', hint: 'Toronto/Edmonton' },
  { token: 'hootsuite', label: 'Hootsuite' },
  { token: 'faire', label: 'Faire', hint: 'Toronto/Kitchener' },
  { token: 'ada', label: 'Ada', hint: 'Toronto' },
  { token: 'league', label: 'League', hint: 'Toronto' },
  { token: 'wave', label: 'Wave', hint: 'Toronto' },
  { token: 'ritual', label: 'Ritual', hint: 'Toronto' },
  { token: 'flipp', label: 'Flipp', hint: 'Toronto' },
  { token: 'loopio', label: 'Loopio', hint: 'Toronto' },
  { token: 'q4inc', label: 'Q4 Inc', hint: 'Toronto' },
  { token: 'docebo', label: 'Docebo', hint: 'Toronto' },
  { token: 'thinkific', label: 'Thinkific' },
  { token: 'vidyard', label: 'Vidyard', hint: 'Kitchener' },
  { token: 'axonify', label: 'Axonify', hint: 'Waterloo' },
  { token: 'miovision', label: 'Miovision', hint: 'Kitchener' },
  { token: 'd2l', label: 'D2L', hint: 'Kitchener' },
  { token: 'arcticwolf', label: 'Arctic Wolf Networks', hint: 'Waterloo' },
  { token: 'ecobee', label: 'ecobee', hint: 'Toronto' },
  { token: 'nuvei', label: 'Nuvei' },
  { token: 'pointclickcare', label: 'PointClickCare', hint: 'Mississauga' },
  { token: 'achievers', label: 'Achievers', hint: 'Toronto' },
  { token: 'sensibill', label: 'Sensibill', hint: 'Toronto' },
  { token: 'kinaxis', label: 'Kinaxis', hint: 'Ottawa' },
  { token: 'assentcompliance', label: 'Assent', hint: 'Ottawa' },
  { token: 'youarehere', label: 'Solink', hint: 'Ottawa' },
  { token: 'fullscript', label: 'Fullscript', hint: 'Ottawa' },
  { token: 'mnpdigital', label: 'MNP Digital' },
  { token: 'coveo', label: 'Coveo' },
  { token: 'dialogue', label: 'Dialogue Health' },
  { token: 'benevity', label: 'Benevity' },
  { token: 'clearco', label: 'Clearco', hint: 'Toronto' },
  { token: 'properly', label: 'Properly' },
  { token: 'borrowell', label: 'Borrowell', hint: 'Toronto' },
  { token: 'koho', label: 'KOHO' },
  { token: 'neofinancial', label: 'Neo Financial' },
  { token: 'float', label: 'Float', hint: 'Toronto' },
  { token: 'relayfi', label: 'Relay', hint: 'Toronto' },
  { token: 'certn', label: 'Certn' },
  { token: 'trulioo', label: 'Trulioo' },

  // Security vendors and MSSPs (many hire in Ontario or remote-Canada)
  { token: 'cloudflare', label: 'Cloudflare' },
  { token: 'crowdstrike', label: 'CrowdStrike' },
  { token: 'sentinelone', label: 'SentinelOne' },
  { token: 'tenable', label: 'Tenable' },
  { token: 'rapid7', label: 'Rapid7' },
  { token: 'zscaler', label: 'Zscaler' },
  { token: 'netskope', label: 'Netskope' },
  { token: 'okta', label: 'Okta' },
  { token: 'cyberark', label: 'CyberArk' },
  { token: 'sailpoint', label: 'SailPoint' },
  { token: 'proofpoint', label: 'Proofpoint' },
  { token: 'mimecast', label: 'Mimecast' },
  { token: 'sophos', label: 'Sophos' },
  { token: 'trellix', label: 'Trellix' },
  { token: 'huntress', label: 'Huntress' },
  { token: 'dragos', label: 'Dragos' },
  { token: 'recordedfuture', label: 'Recorded Future' },
  { token: 'expel', label: 'Expel' },
  { token: 'redcanary', label: 'Red Canary' },
  { token: 'snyk', label: 'Snyk' },
  { token: 'checkmarx', label: 'Checkmarx' },
  { token: 'veracode', label: 'Veracode' },
  { token: 'sonarsource', label: 'Sonar' },
  { token: 'hackerone', label: 'HackerOne' },
  { token: 'bugcrowd', label: 'Bugcrowd' },
  { token: 'securityscorecard', label: 'SecurityScorecard' },
  { token: 'bitsight', label: 'BitSight' },
  { token: 'axonius', label: 'Axonius' },
  { token: 'jumpcloud', label: 'JumpCloud' },
  { token: 'duosecurity', label: 'Duo Security' },
  { token: 'yubico', label: 'Yubico' },
  { token: 'keyfactor', label: 'Keyfactor' },
  { token: 'venafi', label: 'Venafi' },
  { token: 'sumologic', label: 'Sumo Logic' },
  { token: 'exabeam', label: 'Exabeam' },
  { token: 'securonix', label: 'Securonix' },
  { token: 'devo', label: 'Devo' },
  { token: 'cribl', label: 'Cribl' },
  { token: 'panthers', label: 'Panther Labs' },
  { token: 'abnormalsecurity', label: 'Abnormal Security' },
  { token: 'vanta', label: 'Vanta' },
  { token: 'drata', label: 'Drata' },
  { token: 'secureframe', label: 'Secureframe' },
  { token: 'coalitioninc', label: 'Coalition' },
  { token: 'atbash', label: 'At-Bay' },

  // Big tech / platform companies with Ontario offices or remote-CA roles
  { token: 'stripe', label: 'Stripe' },
  { token: 'databricks', label: 'Databricks' },
  { token: 'gitlab', label: 'GitLab' },
  { token: 'mongodb', label: 'MongoDB' },
  { token: 'elastic', label: 'Elastic' },
  { token: 'hashicorp', label: 'HashiCorp' },
  { token: 'datadog', label: 'Datadog' },
  { token: 'twilio', label: 'Twilio' },
  { token: 'dropbox', label: 'Dropbox' },
  { token: 'reddit', label: 'Reddit' },
  { token: 'pinterest', label: 'Pinterest' },
  { token: 'doordash', label: 'DoorDash' },
  { token: 'instacart', label: 'Instacart' },
  { token: 'affirm', label: 'Affirm' },
  { token: 'robinhood', label: 'Robinhood' },
  { token: 'coinbase', label: 'Coinbase' },
  { token: 'benchling', label: 'Benchling' },
  { token: 'samsara', label: 'Samsara' },
  { token: 'gusto', label: 'Gusto' },
  { token: 'asana', label: 'Asana' },
  { token: 'atlassian', label: 'Atlassian' },
  { token: 'grafanalabs', label: 'Grafana Labs' },
  { token: 'sourcegraph', label: 'Sourcegraph' },
  { token: 'vercel', label: 'Vercel' },
  { token: 'supabase', label: 'Supabase' },
  { token: 'clickhouse', label: 'ClickHouse' },
  { token: 'temporaltechnologies', label: 'Temporal' },
  { token: 'render', label: 'Render' },
  { token: 'chainalysis', label: 'Chainalysis' },
  { token: 'kraken', label: 'Kraken' },
  { token: 'circle', label: 'Circle' },
  { token: 'plaid', label: 'Plaid' },
  { token: 'brex', label: 'Brex' },
  { token: 'nuro', label: 'Nuro' },
  { token: 'scaleai', label: 'Scale AI' },
];

/* ------------------------------------------------------------------ */
/* Lever: https://api.lever.co/v0/postings/{token}?mode=json           */
/* ------------------------------------------------------------------ */
export const LEVER_BOARDS: BoardEntry[] = [
  { token: 'palantir', label: 'Palantir' },
  { token: 'shopify', label: 'Shopify', hint: 'Ottawa/Toronto' },
  { token: 'thescore', label: 'theScore', hint: 'Toronto' },
  { token: 'nulogy', label: 'Nulogy', hint: 'Toronto' },
  { token: 'topcoder', label: 'Topcoder' },
  { token: 'sortable', label: 'Sortable', hint: 'Kitchener' },
  { token: 'kobo', label: 'Rakuten Kobo', hint: 'Toronto' },
  { token: 'securekey', label: 'SecureKey', hint: 'Toronto' },
  { token: 'bluecatnetworks', label: 'BlueCat Networks', hint: 'Toronto' },
  { token: 'flexiti', label: 'Flexiti', hint: 'Toronto' },
  { token: 'drop', label: 'Drop', hint: 'Toronto' },
  { token: 'sterlingbackcheck', label: 'Sterling Backcheck' },
  { token: 'plusgrade', label: 'Plusgrade' },
  { token: 'hopper', label: 'Hopper' },
  { token: 'lightspeed', label: 'Lightspeed Commerce' },
  { token: 'sonatype', label: 'Sonatype' },
  { token: 'binalyze', label: 'Binalyze' },
  { token: 'swimlane', label: 'Swimlane' },
  { token: 'threatconnect', label: 'ThreatConnect' },
  { token: 'sysdig', label: 'Sysdig' },
  { token: 'aquasec', label: 'Aqua Security' },
  { token: 'upguard', label: 'UpGuard' },
  { token: 'runzero', label: 'runZero' },
  { token: 'greynoise', label: 'GreyNoise' },
  { token: 'censys', label: 'Censys' },
  { token: 'silentpush', label: 'Silent Push' },
  { token: 'blackberry', label: 'BlackBerry', hint: 'Waterloo' },
  { token: 'magnetforensics', label: 'Magnet Forensics', hint: 'Waterloo' },
  { token: 'esentire', label: 'eSentire', hint: 'Waterloo' },
  { token: 'cyclr', label: 'Cyclr' },
  { token: 'trustarc', label: 'TrustArc' },
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
  { token: 'anthropic', label: 'Anthropic' },
  { token: 'deel', label: 'Deel' },
  { token: 'mistral', label: 'Mistral AI' },
  { token: 'runway', label: 'Runway' },
  { token: 'clerk', label: 'Clerk' },
  { token: 'wiz', label: 'Wiz' },
  { token: 'tailscale', label: 'Tailscale', hint: 'Toronto' },
  { token: 'oso', label: 'Oso' },
  { token: 'teleport', label: 'Teleport' },
  { token: 'doppler', label: 'Doppler' },
  { token: 'material-security', label: 'Material Security' },
  { token: 'nightfall', label: 'Nightfall AI' },
  { token: 'semgrep', label: 'Semgrep' },
  { token: 'socket', label: 'Socket' },
  { token: 'chainguard', label: 'Chainguard' },
  { token: 'corelight', label: 'Corelight' },
  { token: 'dfinity', label: 'DFINITY' },
  { token: 'ledn', label: 'Ledn', hint: 'Toronto' },
  { token: 'apollo', label: 'Apollo GraphQL' },
  { token: 'sardine', label: 'Sardine' },
  { token: 'vetcove', label: 'Vetcove' },
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

  // Removed after verification — these employers are not on Workday:
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
