/**
 * Pipeline self-test.
 *
 * Exercises normalisation, geo-matching, classification, extraction, salary
 * parsing and deduplication against fixture inputs. These fixtures are test
 * data for the transform layer only — they are never written to the store and
 * never surface in the app.
 *
 *   npm run selftest
 */
import { normalizeJob, isMeaningfulDescription, DEFAULT_NORMALIZE_OPTIONS } from '../src/lib/normalize';
import { dedupeJobs, companyKey } from '../src/lib/normalize/dedupe';
import { parseResume, coveredMonths } from '../src/lib/ats/resume';
import { scoreResume, keywordSets, titleTokens } from '../src/lib/ats/score';
import { suggest, formatChecks, gainFor, pastTense } from '../src/lib/ats/suggest';
import { advise, levelsForYears } from '../src/lib/ats/advisor';
import { CAREERS, CAREER_BY_SLUG, CAREER_MAP } from '../src/lib/careers/catalog';
import { careerStats, jobsFor, boardLink } from '../src/lib/careers/stats';
import { QUIZ, scoreQuiz } from '../src/lib/careers/quiz';
import { GLOSSARY } from '../src/lib/careers/glossary';
import { parseWorkdaySites, discoverTenant, MAX_SITES_PER_TENANT } from '../src/lib/sources/workday-discovery';
import { searchJobs, filtersFromSearchParams, searchParamsFromFilters, countActiveFilters } from '../src/lib/query';
import { parseSalary } from '../src/lib/normalize/salary';
import { matchLocation } from '../src/lib/taxonomy/canada';
import { classify } from '../src/lib/normalize/relevance';
import { normalizeTitle, inferExperienceLevel, cleanTitle } from '../src/lib/taxonomy/titles';
import { buildDeepLinks } from '../src/lib/deeplinks';
import { decodeEscapedHtml } from '../src/lib/normalize/html';
import { mergeSnapshots, revalidate, sanityCheck } from '../src/lib/merge';
import { TOKENS as JOBBANK_TOKENS, jobBankSource, parseDetail, parseFeed as parseJobBankFeed } from '../src/lib/sources/jobbank';
import { activeSources } from '../src/lib/sources/registry';
import type { RawJob } from '../src/lib/types';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
  console.log('-'.repeat(70));
}

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

const raw = (over: Partial<RawJob>): RawJob => ({
  sourceJobId: Math.random().toString(36).slice(2),
  sourceId: 'greenhouse',
  sourceName: 'Greenhouse - Test',
  sourceUrl: 'https://example.com/job',
  applyUrl: 'https://example.com/apply',
  title: 'Security Analyst',
  company: 'Acme Corp',
  locationRaw: 'Toronto, ON, Canada',
  description: 'We are hiring a security analyst.',
  descriptionIsHtml: false,
  postedAt: daysAgo(2),
  ...over,
});

/* ------------------------------------------------------------------ */
section('Ontario gazetteer');

check('Toronto resolves', matchLocation('Toronto, ON').city === 'Toronto');
check('Sault Ste. Marie resolves', matchLocation('Sault Ste. Marie, Ontario').city === 'Sault Ste. Marie');
check('Alias: North York -> Toronto', matchLocation('North York, ON').city === 'Toronto');
check('Alias: Kanata -> Ottawa', matchLocation('Kanata, Ontario').city === 'Ottawa');
check('Small town: Tobermory', matchLocation('Tobermory, ON').city === 'Northern Bruce Peninsula');
check('Waterloo region tagged', matchLocation('Kitchener, ON').region === 'Waterloo-Wellington'.replace('-', '–'));
check('Remote detected', matchLocation('Remote - Canada').isRemote === true);
check('BC is Canada, not Ontario', (() => {
  const m = matchLocation('Vancouver, BC, Canada');
  return m.isCanada && !m.isOntario;
})());
check('New York is neither', (() => {
  const m = matchLocation('New York, NY, United States');
  return !m.isOntario && !m.isCanada;
})(), matchLocation('New York, NY, United States'));

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
section('Foreign places that share a Canadian name');

// Reported from the wild: a quarter of the published board was "London, UK"
// showing as London, Ontario. Ontario borrows a lot of British place names, so
// each of these needs a positive Canadian signal before it counts.
const GEO_CASES: [string, boolean][] = [
  ['London, UK', false],
  ['London, ON', true],
  ['London, Ontario', true],
  ['Hybrid - San Francisco, New York City, London, Berlin', false],
  ['Cambridge, UK', false],
  ['Cambridge, ON', true],
  ['Cambridge, MA', false],
  ['Kingston, Jamaica', false],
  ['Kingston, Ontario', true],
  ['Hamilton, New Zealand', false],
  ['Waterloo, Belgium', false],
  ['Waterloo, Ontario, Canada', true],
  ['Windsor, England', false],
  ['Bengaluru, India', false],
  ['Dublin, Ireland', false],
  ['Sydney, Australia', false],
  ['Remote (US)', false],
  ['Toronto', true],
  ['Remote - Canada', true],
  // Western provinces bring their own collisions: Vancouver is also in
  // Washington State, Victoria is an Australian state, Surrey is English,
  // Langley and Richmond are both in Virginia, Laval is in France.
  ['Vancouver, BC', true],
  ['Vancouver, WA', false],
  ['Victoria, BC', true],
  ['Victoria, Australia', false],
  ['Surrey, BC', true],
  ['Surrey, UK', false],
  ['Calgary, AB', true],
  ['Edmonton, Alberta', true],
  ['Montréal, QC', true],
  ['Laval, Québec', true],
  ['Laval, France', false],
  ['Gatineau, QC', true],
  ['Remote - Alberta', true],
  ['Winnipeg, MB', true],
];
for (const [raw, expected] of GEO_CASES) {
  const m = matchLocation(raw);
  check(`${raw} -> ${expected ? 'Canada' : 'foreign'}`, m.isCanada === expected, `${m.city} / ${m.country}`);
}

// A US-only posting that happens to say "Canada" in boilerplate must not pass
// as remote-Canada. This is how a Plaid role listing New York, Seattle,
// Raleigh and San Francisco reached the board.
const usBoilerplate = normalizeJob(
  raw({
    title: 'Security Engineer',
    locationRaw: 'New York City Office / Seattle Office / Raleigh Office / San Francisco HQ',
    description: 'Remote-friendly role. We run threat detection and incident response. Our payroll operates across the US and Canada.',
  }),
);
check('US-only posting citing Canada in prose rejected', usBoilerplate.job === null, usBoilerplate.reason);

const trueRemoteCanada = normalizeJob(
  raw({
    title: 'Security Engineer',
    locationRaw: 'Remote',
    description: 'This role is remote anywhere in Canada. You will run threat detection, incident response and SIEM tuning.',
  }),
);
check('Genuine remote-Canada posting kept', trueRemoteCanada.job !== null, trueRemoteCanada.reason);

const foreignBeatsProse = normalizeJob(
  raw({
    title: 'Security Engineer',
    locationRaw: 'London, UK',
    description: 'Remote within Canada is available for the right candidate. SIEM and incident response.',
  }),
);
check('Foreign location field beats remote-Canada prose', foreignBeatsProse.job === null, foreignBeatsProse.reason);

// The province a string resolves to, not just whether it is Canadian.
const PROVINCE_CASES: [string, string | null][] = [
  ['Toronto, ON', 'ON'],
  ['Calgary, AB', 'AB'],
  ['Vancouver, BC', 'BC'],
  ['Montréal, QC', 'QC'],
  ['Remote - Alberta', 'AB'],
  ['Winnipeg, MB', null],
  ['London, UK', null],
];
for (const [raw, expected] of PROVINCE_CASES) {
  const m = matchLocation(raw);
  check(`${raw} -> province ${expected ?? 'none'}`, m.province === expected, m.province);
}

// Manitoba is Canadian but outside coverage: in scope must be narrower than
// in Canada, or the board silently becomes national.
const mb = matchLocation('Winnipeg, MB');
check('Out-of-scope province is Canadian but not in scope', mb.isCanada && !mb.isInScope, `${mb.isCanada}/${mb.isInScope}`);

/* ------------------------------------------------------------------ */
section('French-language postings');
// The site cannot translate, so it labels instead: a wrong guess costs a
// mislabelled badge, never a hidden posting.
const LANG_CASES: [string, string, 'en' | 'fr'][] = [
  ['Analyste en cybersécurité', 'Vous surveillerez les menaces et gérerez les incidents de sécurité pour notre équipe.', 'fr'],
  ['Conseiller en sécurité', 'Gouvernance, conformité et analyse de risques dans une entreprise de services.', 'fr'],
  ['Security Analyst', 'You will monitor threats and respond to incidents with our security team.', 'en'],
  ['SOC Analyst', 'Alert triage, EDR and phishing investigations for the security operations centre.', 'en'],
];
for (const [title, description, lang] of LANG_CASES) {
  const out = normalizeJob(raw({ title, locationRaw: 'Montréal, QC', description }));
  check(`Language ${lang}: ${title}`, out.job?.language === lang, out.job?.language);
}


const frCases: [string, string, string][] = [
  ['Analyste en cybersécurité', 'Montréal, QC', 'Surveillance des menaces, gestion des incidents de sécurité et des vulnérabilités. Pare-feu et chiffrement.'],
  ['Conseiller en sécurité de l’information', 'Québec, QC', 'Gouvernance, conformité et analyse de risques. Gestion des identités et des accès.'],
  ['Stagiaire en cybersécurité', 'Laval, Québec', 'Stage en surveillance et détection des intrusions au centre opérationnel de sécurité.'],
];
for (const [title, locationRaw, description] of frCases) {
  const out = normalizeJob(raw({ title, locationRaw, description }));
  check(`FR kept: ${title}`, out.job !== null, out.reason);
  check(`FR categorised: ${title}`, out.job !== null && out.job.category !== 'other', out.job?.category);
}
const frIntern = normalizeJob(
  raw({ title: 'Stagiaire en cybersécurité', locationRaw: 'Montréal, QC', description: 'Stage en surveillance et détection des intrusions au centre opérationnel de sécurité.' }),
);
check('FR internship seniority read', frIntern.job?.experienceLevel === 'internship', frIntern.job?.experienceLevel);

const frGuard = normalizeJob(
  raw({ title: 'Agent de sécurité', locationRaw: 'Montréal, QC', description: 'Surveillance des lieux, rondes et contrôle des accès du bâtiment.' }),
);
check('FR physical-security posting still rejected', frGuard.job === null, frGuard.job?.category);

/* ------------------------------------------------------------------ */

const ukJob = normalizeJob(raw({ title: 'Security Engineer', locationRaw: 'London, UK', description: 'SIEM, incident response, threat detection across the estate.' }));
check('London UK posting rejected outright', ukJob.job === null, ukJob.reason);

/* ------------------------------------------------------------------ */
section('Title normalisation and seniority');

check('Sr. -> Senior', normalizeTitle('Sr. Cyber Security Analyst').startsWith('Senior'));
check('Cyber Security -> Cybersecurity', normalizeTitle('Cyber Security Engineer').includes('Cybersecurity'));
check('Strips remote suffix', !normalizeTitle('Security Analyst - Remote').toLowerCase().includes('remote'));
check('Strips req id', !normalizeTitle('Security Analyst (Req #12345)').includes('12345'));
check('Detects co-op', inferExperienceLevel('Cyber Security Co-op Student (Winter 2027)') === 'coop');
check('Detects intern', inferExperienceLevel('Security Intern') === 'internship');
check('Detects director', inferExperienceLevel('Director, Information Security') === 'director');
check('Detects CISO as executive', inferExperienceLevel('Chief Information Security Officer') === 'executive');
check('Years-of-experience fallback', inferExperienceLevel('Security Analyst', 'You have 7+ years of relevant experience.') === 'senior');

/* ------------------------------------------------------------------ */
section('Salary parsing');

const s1 = parseSalary('$95,000 - $120,000 per year');
check('Annual range', s1.min === 95000 && s1.max === 120000 && s1.period === 'year');
const s2 = parseSalary('$28.50 to $34.00 per hour');
check('Hourly range annualised', s2.period === 'hour' && s2.annualMax === Math.round(34 * 2080), s2);
const s3 = parseSalary('CAD 110k-140k');
check('k-notation', s3.min === 110000 && s3.max === 140000, s3);
check('Garbage rejected', parseSalary('competitive salary').min === null);

/* ------------------------------------------------------------------ */
section('Classification and filtering');

const guard = normalizeJob(raw({ title: 'Security Guard - Full Time', description: 'Patrol the site.' }));
check('Security guard rejected', guard.job === null, guard.reason);

const crossing = normalizeJob(raw({ title: 'Crossing Guard', description: 'School crossing.' }));
check('Crossing guard rejected', crossing.job === null);

const usJob = normalizeJob(raw({ locationRaw: 'Austin, TX, United States' }));
check('Out-of-province rejected', usJob.job === null, usJob.reason);

const remoteCa = normalizeJob(
  raw({
    title: 'Senior Detection Engineer',
    locationRaw: 'Remote - Canada',
    description: 'Build Sigma rules, tune the SIEM, respond to incidents. Splunk and MITRE ATT&CK experience required.',
  }),
);
check('Remote-Canada kept', remoteCa.job !== null, remoteCa.reason);
check('Remote arrangement set', remoteCa.job?.workArrangement === 'remote');

const soc = normalizeJob(
  raw({
    title: 'SOC Analyst II',
    locationRaw: 'Mississauga, ON',
    description: `About the role
We are looking for a Tier 2 SOC Analyst to join our 24/7 security operations centre in Mississauga.

Requirements:
- 3+ years of experience in alert triage and incident response
- Hands-on with Splunk and Microsoft Sentinel
- CompTIA Security+ or CySA+ certification
- Bachelor's degree in Computer Science or equivalent experience
- Strong PowerShell and Python scripting

Nice to have:
- GCIH or GCIA certification
- Experience with CrowdStrike Falcon and Cortex XSOAR
- Knowledge of MITRE ATT&CK

Salary: $85,000 - $105,000 per year
What we offer: benefits, RRSP matching.`,
  }),
);
check('SOC analyst kept', soc.job !== null, soc.reason);
check('Category = soc_analysis', soc.job?.category === 'soc_analysis', soc.job?.category);
check('Experience = mid', soc.job?.experienceLevel === 'mid', soc.job?.experienceLevel);
check('City = Mississauga', soc.job?.city === 'Mississauga');
check('Salary extracted from body', soc.job?.salary.min === 85000, soc.job?.salary);
check('Certs extracted', (soc.job?.requirements.certifications ?? []).includes('CompTIA Security+'), soc.job?.requirements.certifications);
check('Preferred certs separated', (soc.job?.requirements.preferredSkills ?? []).length > 0 || (soc.job?.requirements.certifications ?? []).includes('GCIH'));
check('Tech extracted', (soc.job?.requirements.technologies ?? []).includes('Splunk'));
check('Education extracted', (soc.job?.requirements.education ?? []).some((e) => e.includes('Bachelor')));
check('Years of experience', soc.job?.requirements.yearsExperience === '3+ years', soc.job?.requirements.yearsExperience);
check('Relevance is high', (soc.job?.relevanceScore ?? 0) >= 70, soc.job?.relevanceScore);

const helpdesk = normalizeJob(
  raw({
    title: 'IT Support Specialist',
    locationRaw: 'London, ON',
    description:
      'Provide desktop support, manage Active Directory accounts, apply security patches, and escalate phishing reports to the security team. Experience with MFA rollout an asset.',
  }),
);
check('Pathway role kept', helpdesk.job !== null, helpdesk.reason);
check('Flagged as pathway', helpdesk.job?.isPathwayRole === true);
check('Category = adjacent_it', helpdesk.job?.category === 'adjacent_it', helpdesk.job?.category);
check('Pathway ranked below SOC', (helpdesk.job?.rankScore ?? 0) < (soc.job?.rankScore ?? 0));

// Regression: "penetration test" with a \\b anchor never matched "Tester" or
// "tests", so core offensive-security roles were rejected outright.
const pentest = normalizeJob(
  raw({
    title: 'Penetration Tester',
    locationRaw: 'Mississauga, ON',
    description: 'Perform web application and network penetration tests using Burp Suite and Nmap. OSCP preferred.',
  }),
);
check('Penetration Tester kept', pentest.job !== null, pentest.reason);
check('Category = penetration_testing', pentest.job?.category === 'penetration_testing', pentest.job?.category);

const redteam = normalizeJob(
  raw({
    title: 'Senior Pentester',
    locationRaw: 'Toronto, ON',
    description: 'Adversary emulation, red team engagements and pen testing across our estate. Metasploit, Cobalt Strike.',
  }),
);
check('Pentester title kept', redteam.job !== null, redteam.reason);

const unrelated = normalizeJob(
  raw({ title: 'Registered Nurse', description: 'Provide patient care on the medical floor.' }),
);
check('Unrelated role rejected', unrelated.job === null, unrelated.reason);

const pathwayOff = normalizeJob(
  raw({ title: 'Help Desk Analyst', locationRaw: 'Ottawa, ON', description: 'Password resets, phishing escalation, MFA support.' }),
  { ...DEFAULT_NORMALIZE_OPTIONS, includePathway: false },
);
check('Pathway excluded when disabled', pathwayOff.job === null, pathwayOff.reason);

/* ------------------------------------------------------------------ */
section('HTML sanitisation');

const htmlJob = normalizeJob(
  raw({
    title: 'Application Security Engineer',
    locationRaw: 'Waterloo, ON',
    descriptionIsHtml: true,
    description:
      '<p>Join our <strong>AppSec</strong> team.</p><script>alert(1)</script><ul><li>SAST and DAST tooling</li><li>OWASP Top 10</li></ul><a href="javascript:alert(2)">bad</a><a href="https://example.com">good</a><img src=x onerror=alert(3)>',
  }),
);
check('HTML job kept', htmlJob.job !== null, htmlJob.reason);
check('Script stripped', !(htmlJob.job?.descriptionHtml ?? '').includes('<script'));
check('javascript: href stripped', !(htmlJob.job?.descriptionHtml ?? '').includes('javascript:'));
check('onerror stripped', !(htmlJob.job?.descriptionHtml ?? '').toLowerCase().includes('onerror'));
check('Safe link kept', (htmlJob.job?.descriptionHtml ?? '').includes('https://example.com'));
check('Plain text derived', (htmlJob.job?.description ?? '').includes('OWASP Top 10'));
check('Category = application_security', htmlJob.job?.category === 'application_security', htmlJob.job?.category);

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
section('Metadata is not a description');

// The metadata line that survived the first fix. It is long and full of real
// words, so a word-count test clears it; only its shape gives it away. Worse,
// the carry-forward rule preserved any non-empty stored description, so the
// connector change reached no existing posting at all.
const METADATA_LINES = [
  'September 11, 2026 · Bell Canada · Montréal (QC) · Salary $30.00 to $72.12 hourly · CareerBeacon Job number: 2233638',
  'August 20, 2026 · ACEROSEC · King City (ON) · Salary $48.50 hourly · Job Bank Job number: 3652764',
];
for (const line of METADATA_LINES) {
  check(`Metadata line rejected: ${line.slice(0, 28)}…`, !isMeaningfulDescription(line));
}
check(
  'Prose containing a dot separator is still kept',
  isMeaningfulDescription('Monitor Splunk alerts · triage incidents · escalate to tier three. Python required.'),
);


// Workday's list endpoint returns bullet fields where prose belongs, so cards
// were published whose entire summary read "R260024652".
const NOT_DESCRIPTIONS = ['2617970', 'R260024652', 'Bangalore · Karnataka · JREQ203319', 'Toronto · Ontario · JREQ201528'];
for (const desc of NOT_DESCRIPTIONS) {
  const out = normalizeJob(raw({ title: 'Security Analyst', locationRaw: 'Toronto, ON', description: desc }));
  check(`Rejected as description: ${desc.slice(0, 30)}`, out.job?.description === '' && out.job?.summary === '', out.job?.summary);
}
const realDesc = normalizeJob(
  raw({ title: 'Security Analyst', locationRaw: 'Toronto, ON', description: 'Monitor Splunk alerts, triage incidents and escalate to tier three engineers.' }),
);
check('Real prose survives', (realDesc.job?.description ?? '').length > 40, realDesc.job?.description?.slice(0, 30));

/* ------------------------------------------------------------------ */
section('Entity-encoded HTML (Greenhouse)');

// Greenhouse serves `content` entity-encoded. Missing this put literal <p> tags
// into the summary of all 34 Greenhouse postings on the first live site.
const escaped = '&lt;p&gt;We&rsquo;re hiring a &lt;strong&gt;Security Analyst&lt;/strong&gt;.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Splunk&lt;/li&gt;&lt;/ul&gt;';
const decoded = decodeEscapedHtml(escaped);
check('Escaped markup is decoded', decoded.includes('<strong>'), decoded.slice(0, 60));
check('Real HTML is left alone', decodeEscapedHtml('<p>Already <b>fine</b> &amp; valid</p>') === '<p>Already <b>fine</b> &amp; valid</p>');
check('Plain text is left alone', decodeEscapedHtml('No markup here at all') === 'No markup here at all');

const gh = normalizeJob(
  raw({
    title: 'Security Analyst',
    locationRaw: 'Toronto, ON',
    descriptionIsHtml: true,
    description: escaped + '&lt;p&gt;Requires incident response and SIEM experience with MITRE ATT&amp;CK.&lt;/p&gt;',
  }),
);
check('Encoded posting normalises', gh.job !== null, gh.reason);
check('Summary has no literal tags', !/[<>]/.test(gh.job?.summary ?? ''), gh.job?.summary?.slice(0, 80));
check('Rendered HTML has real tags', (gh.job?.descriptionHtml ?? '').includes('<strong>'));
check('Tech still extracted through the decode', (gh.job?.requirements.technologies ?? []).includes('Splunk'));

/* ------------------------------------------------------------------ */
section('Deduplication');

const dupeInputs = [
  raw({
    sourceId: 'jobbank',
    sourceName: 'Job Bank',
    sourceJobId: 'jb-1',
    title: 'Cyber Security Analyst',
    company: 'Acme Corp',
    locationRaw: 'Toronto, ON',
    description: 'Short snippet about a cyber security analyst role with SIEM monitoring.',
    postedAt: daysAgo(9),
  }),
  raw({
    sourceId: 'greenhouse',
    sourceName: 'Greenhouse - Acme',
    sourceJobId: 'gh-1',
    title: 'Cybersecurity Analyst',
    company: 'Acme Corp Inc.',
    locationRaw: 'Toronto, Ontario, Canada',
    description:
      'Full posting. Monitor the SIEM, triage alerts, perform incident response, work with Splunk, CrowdStrike and MITRE ATT&CK. Salary: $90,000 - $110,000 per year.',
    postedAt: daysAgo(5),
  }),
  raw({
    sourceId: 'lever',
    sourceName: 'Lever - Other',
    sourceJobId: 'lv-1',
    title: 'GRC Analyst',
    company: 'Beta Ltd',
    locationRaw: 'Ottawa, ON',
    description: 'ISO 27001 and SOC 2 control testing, risk register maintenance, vendor risk assessments, audit evidence.',
    postedAt: daysAgo(1),
  }),
];

const normalised = dupeInputs.map((r) => normalizeJob(r).job).filter((j): j is NonNullable<typeof j> => j !== null);
check('All three normalised', normalised.length === 3, normalised.length);

const { jobs: deduped, merged } = dedupeJobs(normalised);
check('Duplicates collapsed', deduped.length === 2, { deduped: deduped.length, merged });
const survivor = deduped.find((j) => j.company.startsWith('Acme'));
check('Richer source wins', survivor?.sourceId === 'greenhouse', survivor?.sourceId);
check('Earliest posted date kept', survivor?.postedAt === normalised.find((j) => j.sourceId === 'jobbank')?.postedAt);
check('Alternate source recorded', (survivor?.alsoPostedOn ?? []).length === 1);
check('Salary survives merge', survivor?.salary.min === 90000, survivor?.salary);

/* ------------------------------------------------------------------ */
section('Carry-forward between publishes');

// Distinct postings need distinct fingerprints. The helper used to clone one
// normalised job, so every fixture shared a fingerprint — harmless until the
// merge started collapsing on it, at which point the whole set folded into one.
const mk = (id: string, over: Partial<import('../src/lib/types').Job> = {}) =>
  ({
    ...(normalizeJob(raw({ title: 'Security Analyst', locationRaw: 'Toronto, ON' })).job as import('../src/lib/types').Job),
    id,
    fingerprint: `fp-${id}`,
    ...over,
  });

const MERGE_OPTS = { retentionDays: 21, staleDays: 3 };

// A source going dark must not remove its postings from the site.
const prevSet = [
  mk('keep-fresh', { lastSeenAt: daysAgo(0), firstSeenAt: daysAgo(30) }),
  mk('go-stale', { lastSeenAt: daysAgo(5), firstSeenAt: daysAgo(40), isExpired: false }),
  mk('too-old', { lastSeenAt: daysAgo(25), firstSeenAt: daysAgo(60) }),
];
const currSet = [mk('keep-fresh', { firstSeenAt: daysAgo(0) }), mk('brand-new')];

const m = mergeSnapshots(prevSet, currSet, MERGE_OPTS);
const byId = new Map(m.jobs.map((j) => [j.id, j]));

check('New posting added', m.added === 1 && byId.has('brand-new'), m.added);
check('Seen-again posting refreshed', m.refreshed === 1);
check('Unseen posting carried forward', byId.has('go-stale'));
check('Carried posting marked expired past staleDays', byId.get('go-stale')?.isExpired === true);
check('Posting past retention dropped', !byId.has('too-old') && m.dropped === 1);
check('firstSeenAt preserved across merge', byId.get('keep-fresh')?.firstSeenAt === daysAgo(30), byId.get('keep-fresh')?.firstSeenAt);
check('lastSeenAt refreshed for seen jobs', (Date.now() - Date.parse(byId.get('keep-fresh')!.lastSeenAt)) < 5000);
check('Counts add up', m.jobs.length === m.added + m.refreshed + m.carried, { len: m.jobs.length, m });

// The scenario this exists for: every connector fails.
const outage = mergeSnapshots(prevSet, [], MERGE_OPTS);
check('Total connector outage keeps the site populated', outage.jobs.length === 2, outage.jobs.length);

// First ever run.
const first = mergeSnapshots([], currSet, MERGE_OPTS);
check('First run works with no baseline', first.jobs.length === 2 && first.added === 2);

// A reappearing posting should come back to life.
const revived = mergeSnapshots([mk('back', { isExpired: true, lastSeenAt: daysAgo(4) })], [mk('back', { isExpired: false })], MERGE_OPTS);
check('Reappearing posting un-expires', revived.jobs[0]?.isExpired === false);

check('Sanity check passes normal runs', sanityCheck(70, 72) === null);
check('Sanity check blocks an empty merge', sanityCheck(70, 0) !== null);
check('Sanity check blocks a mass disappearance', sanityCheck(70, 20) !== null);
check('Sanity check tolerates small datasets', sanityCheck(5, 3) === null);

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
section('Duplicate records across runs');

// Job Bank only carries a description on the posting page, fetched a handful at
// a time under a five-second crawl delay. A posting therefore arrives bare on
// most runs and enriched on one; if the bare record won, the description would
// be discarded every hour and never stick.
const enriched = mk('jb', { description: 'Confer with clients to identify requirements and assess security risks.', summary: 'Confer with clients…', experienceLevel: 'mid' });
const bare = mk('jb', { description: '', summary: '', experienceLevel: 'unknown' });
const kept = mergeSnapshots([enriched], [bare], MERGE_OPTS);
check('Enriched description survives a bare re-fetch', kept.jobs[0]?.description?.startsWith('Confer'), kept.jobs[0]?.description);
check('Summary travels with it', kept.jobs[0]?.summary === 'Confer with clients…', kept.jobs[0]?.summary);
check('Seniority read from it travels too', kept.jobs[0]?.experienceLevel === 'mid', kept.jobs[0]?.experienceLevel);

// A genuinely updated description must still win.
const rewritten = mk('jb', { description: 'Updated posting text with new responsibilities listed here.', summary: 'Updated…' });
const fresh = mergeSnapshots([enriched], [rewritten], MERGE_OPTS);
check('A real new description still wins', fresh.jobs[0]?.description?.startsWith('Updated'), fresh.jobs[0]?.description);

// …but only a real description is worth carrying. Preserving any non-empty
// stored text kept the metadata line the connector had just stopped
// publishing, so the fix reached no existing posting at all.
const junk = mk('jb2', { description: METADATA_LINES[0], summary: METADATA_LINES[0] });
const blank = mk('jb2', { description: '', summary: '' });
const merged2 = mergeSnapshots([junk], [blank], MERGE_OPTS);
check('Stored metadata is not carried forward', merged2.jobs[0]?.description === '', merged2.jobs[0]?.description);

const cleaned = revalidate([mk('jb3', { description: METADATA_LINES[1], summary: METADATA_LINES[1] })]);
check('Already-published metadata is cleaned in place', cleaned.jobs[0]?.description === '', cleaned.jobs[0]?.description);


// The merge keys on id, and an id is not stable: Job Bank issues a new job
// number when an employer reposts, and Workday renumbers. Both records survived
// and the same role appeared twice on the live board.
const dupA = mk('old-id', { fingerprint: 'same-fp', lastSeenAt: daysAgo(1), firstSeenAt: daysAgo(20), sourceId: 'jobbank' });
const dupB = mk('new-id', { fingerprint: 'same-fp', lastSeenAt: daysAgo(0), firstSeenAt: daysAgo(0), sourceId: 'jobbank' });
const collapsed = mergeSnapshots([dupA], [dupB], MERGE_OPTS);
check('Same fingerprint collapses to one record', collapsed.jobs.length === 1, collapsed.jobs.length);
check('Collapse is counted', collapsed.collapsed === 1, collapsed.collapsed);
check('Newest record wins', collapsed.jobs[0]?.id === 'new-id', collapsed.jobs[0]?.id);
check('Earliest discovery date survives', collapsed.jobs[0]?.firstSeenAt === daysAgo(20), collapsed.jobs[0]?.firstSeenAt);

// A live record beats an expired one even if the expired one was seen later.
const expiredNewer = mk('expired', { fingerprint: 'fp2', lastSeenAt: daysAgo(0), isExpired: true });
const liveOlder = mk('live', { fingerprint: 'fp2', lastSeenAt: daysAgo(2), isExpired: false });
const pick = mergeSnapshots([expiredNewer, liveOlder], [], MERGE_OPTS);
check('Live record wins over expired duplicate', pick.jobs.length === 1 && pick.jobs[0]?.id === 'live', pick.jobs.map((j) => j.id));

// Distinct postings must not be merged just because they are similar.
const distinct = mergeSnapshots([], [mk('a', { fingerprint: 'fp-a' }), mk('b', { fingerprint: 'fp-b' })], MERGE_OPTS);
check('Different fingerprints are left alone', distinct.jobs.length === 2, distinct.jobs.length);

// A record with no fingerprint must never be collapsed into another.
const blanks = mergeSnapshots([], [mk('n1', { fingerprint: '' }), mk('n2', { fingerprint: '' })], MERGE_OPTS);
check('Missing fingerprints are not collapsed together', blanks.jobs.length === 2, blanks.jobs.length);

/* ------------------------------------------------------------------ */
section('Carried-forward postings are re-checked');

// Guard work that reads as corporate when abbreviated. Extending coverage to
// BC and Alberta put three "security officer" postings from guard firms on the
// live board, at $16 to $32 an hour.
const GUARD_CASES: [string, boolean][] = [
  ['security officer', false],
  ['Security Officer', false],
  ['Security Ambassador', false],
  ['Safety Officer', false],
  ['Agent de sécurité', false],
  ['Gardien de sécurité', false],
  ['Chief Information Security Officer', true],
  ['Information Security Officer', true],
  ['Cyber Security Officer', true],
  ['IT Security Officer', true],
  ['Agent de sécurité informatique', true],
];
for (const [title, keep] of GUARD_CASES) {
  const c = classify(title, 'Monitor alerts, respond to incidents, SIEM, vulnerability management, firewall, encryption.');
  check(`${keep ? 'kept' : 'rejected'}: ${title}`, !c.rejected === keep, c.rejectReason ?? c.category);
}

// And the carried-forward path must apply the same judgement.
const carriedGuard = revalidate([mk('guard', { titleRaw: 'security officer', title: 'Security Officer', locationRaw: 'Kelowna (BC)', city: 'Kelowna', region: 'Okanagan' })]);
check('Carried guard posting dropped on re-check', carriedGuard.dropped === 1, carriedGuard.dropped);


// Carry-forward let "London, UK" outlive the geo fix: those records came from
// the previous snapshot, so nothing re-examined them. Revalidation closes that.
const carriedBad = [
  mk('uk-1', { locationRaw: 'London, UK', city: 'London', region: 'Southwestern Ontario' }),
  mk('uk-2', { locationRaw: 'Hybrid - San Francisco, New York City, London, Berlin', city: 'London', region: 'Southwestern Ontario' }),
  mk('good-1', { locationRaw: 'Toronto, ON', city: 'Toronto', region: 'Greater Toronto Area' }),
  mk('good-2', { locationRaw: 'Remote - Canada', city: null, region: null, workArrangement: 'remote' }),
];
const rev = revalidate(carriedBad);
check('Foreign carried postings dropped', rev.dropped === 2, rev.dropped);
check('Canadian carried postings kept', rev.jobs.length === 2, rev.jobs.length);
check('Kept the right ones', rev.jobs.map((j) => j.id).join(',') === 'good-1,good-2', rev.jobs.map((j) => j.id));

// Carried postings face the same gate as fresh ones: Canadian, but in a
// province outside coverage and not remote, is out.
const carriedOffside = revalidate([mk('mb', { locationRaw: 'Winnipeg, MB', city: null, region: null, workArrangement: 'onsite' })]);
check('Carried out-of-scope on-site posting dropped', carriedOffside.dropped === 1, carriedOffside.dropped);

const carriedBC = revalidate([mk('bc', { locationRaw: 'Vancouver, BC', city: null, region: null, workArrangement: 'onsite' })]);
check('Carried BC posting kept now that BC is covered', carriedBC.dropped === 0, carriedBC.dropped);
check('Carried BC posting gains its province', carriedBC.jobs[0]?.province === 'BC', carriedBC.jobs[0]?.province);

const healed = revalidate([mk('h', { locationRaw: 'Ottawa, ON', city: 'Tornto', region: 'Wrong' })]);
check('Stale city corrected in place', healed.jobs[0]?.city === 'Ottawa', healed.jobs[0]?.city);

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
section('Search, filters and facets');

const corpus = [...deduped, soc.job!, helpdesk.job!, htmlJob.job!, remoteCa.job!];

const all = searchJobs(corpus, {}, { lastIngestAt: null });
check('All jobs returned', all.total === corpus.length, all.total);
check('Facets populated', all.facets.categories.length > 0 && all.facets.cities.length > 0);

const q1 = searchJobs(corpus, { q: 'splunk' }, { lastIngestAt: null });
check('Keyword search works', q1.total >= 1 && q1.jobs.every((j) => JSON.stringify(j).toLowerCase().includes('splunk')), q1.total);

const q2 = searchJobs(corpus, { q: '"incident response"' }, { lastIngestAt: null });
check('Phrase search works', q2.total >= 1, q2.total);

const q3 = searchJobs(corpus, { q: 'security -guard -nurse' }, { lastIngestAt: null });
check('Exclusion syntax works', q3.total >= 1, q3.total);

const q4 = searchJobs(corpus, { cities: ['Mississauga'] }, { lastIngestAt: null });
check('City filter works', q4.total === 1 && q4.jobs[0].city === 'Mississauga', q4.total);

const q5 = searchJobs(corpus, { onlyPathway: true }, { lastIngestAt: null });
check('Pathway-only filter works', q5.total === 1 && q5.jobs[0].isPathwayRole, q5.total);

const q6 = searchJobs(corpus, { hasSalary: true }, { lastIngestAt: null });
check('Salary filter works', q6.total >= 1 && q6.jobs.every((j) => j.salary.min != null), q6.total);

const q7 = searchJobs(corpus, { postedWithinDays: 3 }, { lastIngestAt: null });
check('Date window works', q7.jobs.every((j) => Date.now() - Date.parse(j.postedAt!) <= 3 * 86_400_000), q7.total);

const q8 = searchJobs(corpus, { sort: 'newest' }, { lastIngestAt: null });
const ordered = q8.jobs.every(
  (j, i) => i === 0 || Date.parse(q8.jobs[i - 1].postedAt ?? '0') >= Date.parse(j.postedAt ?? '0'),
);
check('Newest sort ordered', ordered);

const q9 = searchJobs(corpus, { pageSize: 2, page: 2 }, { lastIngestAt: null });
check('Pagination works', q9.page === 2 && q9.jobs.length <= 2 && q9.totalPages === Math.ceil(corpus.length / 2));

const q10 = searchJobs(corpus, { certifications: ['CompTIA Security+'] }, { lastIngestAt: null });
check('Certification filter works', q10.total >= 1, q10.total);

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
section('City facets grouped by province');

const cityJobs = [
  mk('t1', { city: 'Toronto', province: 'ON' }),
  mk('t2', { city: 'Toronto', province: 'ON' }),
  mk('o1', { city: 'Ottawa', province: 'ON' }),
  mk('c1', { city: 'Calgary', province: 'AB' }),
  mk('v1', { city: 'Vancouver', province: 'BC' }),
  mk('m1', { city: 'Montreal', province: 'QC' }),
  mk('r1', { city: null, province: null, workArrangement: 'remote' }),
];
const grouped = searchJobs(cityJobs, {}, { lastIngestAt: null }).facets.citiesByProvince;
check('Ontario cities grouped', (grouped.ON ?? []).map((f) => f.value).sort().join(',') === 'Ottawa,Toronto', grouped.ON);
check('Toronto counted twice', (grouped.ON ?? []).find((f) => f.value === 'Toronto')?.count === 2);
check('Alberta separated', (grouped.AB ?? []).map((f) => f.value).join(',') === 'Calgary', grouped.AB);
check('BC separated', (grouped.BC ?? []).map((f) => f.value).join(',') === 'Vancouver', grouped.BC);
check('Quebec separated', (grouped.QC ?? []).map((f) => f.value).join(',') === 'Montreal', grouped.QC);
check('Remote lands under other', (grouped.other ?? []).map((f) => f.value).join(',') === 'Remote', grouped.other);
check('No province leaks into another', !(grouped.ON ?? []).some((f) => ['Calgary', 'Vancouver', 'Montreal'].includes(f.value)));

/* ------------------------------------------------------------------ */
section('Deep links');

const links = buildDeepLinks({ q: 'soc analyst', cities: ['Toronto'], postedWithinDays: 7, experience: ['entry'] });
check('LinkedIn link built', links.some((l) => l.site === 'LinkedIn' && l.url.includes('f_TPR=r604800')));
check('Indeed link built', links.some((l) => l.site === 'Indeed Canada' && l.url.includes('fromage=7')));
check('Location encoded', links[0].url.includes('Toronto'));
check('All links absolute https', links.every((l) => l.url.startsWith('https://')));

/* ------------------------------------------------------------------ */
section('Job Bank connector (regression guards)');

// The detail pass shipped without a time budget and never made a single
// request: sixteen search queries at a five-second crawl delay had already
// exhausted the per-source ceiling before the loop was reached. The connector
// declares a longer ceiling and reserves part of it for descriptions.
check('Job Bank declares its own time ceiling', (jobBankSource.maxDurationMs ?? 0) >= 150_000, jobBankSource.maxDurationMs);
const reserveFor = (budgetMs: number, delay = 5000, maxDetails = 10) =>
  Math.min(budgetMs * 0.45, maxDetails * (delay + 2000));
check('Reserve leaves room for search', reserveFor(180_000) < 180_000 * 0.5, reserveFor(180_000));
check('Reserve buys several detail pages', Math.floor(reserveFor(180_000) / 7000) >= 5, Math.floor(reserveFor(180_000) / 7000));
check('A short budget still reserves something', reserveFor(90_000) > 20_000, reserveFor(90_000));


// Job Bank list rows carry no description — the snippet is the row's own
// metadata, which is how a detail page came to read "September 11, 2026 · Bell
// Canada · Montréal (QC) · Salary $30.00 to $72.12 hourly". The real text lives
// on the posting page.
const detailHtml = `<span property="description">Tasks: Assess security risks and develop policies for the organisation.</span>
  <div class="job-posting-detail-requirements">Overview Languages English Experience 3 years to less than 5 years On the road</div>`;
const detail = parseDetail(detailHtml);
check('Detail description extracted', detail.description.startsWith('Tasks: Assess security risks'), detail.description.slice(0, 40));
check('Experience line extracted whole', detail.experience === '3 years to less than 5 years', detail.experience);
check('Experience appended to the description', /Experience: 3 years to less than 5 years\.$/.test(detail.description), detail.description.slice(-40));

// Job Bank states experience with the word first, which the generic
// "N years of experience" pattern never matched — the reason a quarter of the
// board read "Not specified".
const EXPERIENCE_CASES: [string, string][] = [
  ['Less than 1 year', 'entry'],
  ['Will train', 'entry'],
  ['Experience an asset', 'entry'],
  ['7 months to less than 1 year', 'entry'],
  ['1 year to less than 2 years', 'junior'],
  ['3 years to less than 5 years', 'mid'],
];
for (const [stated, level] of EXPERIENCE_CASES) {
  const out = normalizeJob(
    raw({
      title: 'cybersecurity consultant',
      locationRaw: 'Montréal (QC)',
      description: `Tasks: Assess security risks, develop policies and respond to incidents.\n\nExperience: ${stated}.`,
    }),
  );
  check(`Job Bank experience "${stated}" -> ${level}`, out.job?.experienceLevel === level, out.job?.experienceLevel);
}


// The first live run fetched 0 from Job Bank because the query terms were
// multi-word: Job Bank reinterprets those as an employer name and returns
// nothing. Every token must be a single word.
check('Job Bank tokens found', JOBBANK_TOKENS.length >= 10, JOBBANK_TOKENS.length);
check(
  'Every Job Bank token is a single word',
  JOBBANK_TOKENS.every((t) => !/\s/.test(t)),
  JOBBANK_TOKENS.filter((t) => /\s/.test(t)),
);

// The Atom fallback must survive a restyle of the results page.
const FEED_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
 <title><![CDATA[cybersecurity - Job Bank]]></title>
 <entry>
  <title type="html"><![CDATA[cybersecurity consultant]]></title>
  <link rel="alternate" type="text/html" href="https://www.jobbank.gc.ca/jobsearch/jobposting/10233755446?source=searchresults"/>
  <id>https://www.jobbank.gc.ca/jobsearch/jobposting/10233755446</id>
  <updated>2026-08-18T10:00:00Z</updated>
  <summary type="html"><![CDATA[<strong>Job number:</strong> 10233755446<br /><strong>Location:</strong> Toronto (ON)  <br /><strong>Employer:</strong> Adisoft Inc<br /><strong>Salary:</strong> $60.00 to $120.00 hourly]]></summary>
 </entry>
</feed>`;

const feedJobs = parseJobBankFeed(FEED_FIXTURE);
check('Feed parses one entry', feedJobs.length === 1, feedJobs.length);
check('Feed title', feedJobs[0]?.title === 'cybersecurity consultant', feedJobs[0]?.title);
check('Feed employer', feedJobs[0]?.company === 'Adisoft Inc', feedJobs[0]?.company);
check('Feed location', feedJobs[0]?.locationRaw === 'Toronto (ON)', feedJobs[0]?.locationRaw);
check('Feed salary', feedJobs[0]?.salaryRaw === '$60.00 to $120.00 hourly', feedJobs[0]?.salaryRaw);
check('Feed strips query string from url', feedJobs[0]?.applyUrl.endsWith('/10233755446'), feedJobs[0]?.applyUrl);

const feedJob = normalizeJob(
  feedJobs[0] ?? raw({}),
);
check('Feed entry normalises into a job', feedJob.job !== null, feedJob.reason);
check('Feed entry lands in Toronto', feedJob.job?.city === 'Toronto', feedJob.job?.city);

/* ------------------------------------------------------------------ */
section('Source selection honours the environment at call time');

process.env.INGEST_SOURCES = 'greenhouse,lever';
check('--only style filter applies', activeSources().map((s) => s.id).join(',') === 'greenhouse,lever', activeSources().map((s) => s.id));
process.env.INGEST_SOURCES = '';
delete process.env.INGEST_SOURCES;
process.env.INGEST_DISABLED_SOURCES = 'workday';
check('Disable list applies', !activeSources().some((s) => s.id === 'workday'));
delete process.env.INGEST_DISABLED_SOURCES;
check('All sources return when unset', activeSources().length >= 10, activeSources().length);


/* ------------------------------------------------------------------ */
section('Defects found in the Sept 2026 click-through');

// Salary: the salary text decides the period, not the description.
const annual = parseSalary('Salary $61,000.00 to $75,000.00 annually', 'Work 37.5 hours per week on clinical systems.');
check('"annually" beats "hours" in the description', annual.period === 'year', annual);
check('Annual salary stays under $1M', (annual.annualMax ?? 0) === 75000, annual.annualMax);
const hourlyWords = parseSalary('$61,000 - $75,000', 'Paid hourly overtime available.');
check('Five-figure amount cannot be hourly', hourlyWords.period === 'year', hourlyWords);
const realHourly = parseSalary('$30.00 to $45.00 hourly');
check('Genuine hourly pay still hourly', realHourly.period === 'hour' && realHourly.annualMin === 62400, realHourly);

// Titles: all-lowercase titles are title-cased, others untouched.
check('Lowercase Job Bank title is title-cased', cleanTitle('informatics security consultant') === 'Informatics Security Consultant', cleanTitle('informatics security consultant'));
check('Acronyms upper-cased', cleanTitle('it security analyst') === 'IT Security Analyst', cleanTitle('it security analyst'));
check('Small words stay lower', cleanTitle('analyst, informatics security and compliance') === 'Analyst, Informatics Security and Compliance', cleanTitle('analyst, informatics security and compliance'));
check('Mixed-case titles untouched', cleanTitle('SOC Analyst (Tier 2)') === 'SOC Analyst (Tier 2)');

// URL lists: a company containing a comma survives the round trip.
const commaFilters = filtersFromSearchParams(new URLSearchParams(searchParamsFromFilters({ companies: ['Remarcable, Inc.', 'BMO'] }).toString()));
check('Comma inside a company name survives the URL', JSON.stringify(commaFilters.companies) === JSON.stringify(['Remarcable, Inc.', 'BMO']), commaFilters.companies);
check('Plain comma lists still split', JSON.stringify(filtersFromSearchParams(new URLSearchParams('city=Toronto,Ottawa')).cities) === '["Toronto","Ottawa"]');

// A custom date range counts as an active filter (enables "Clear all").
check('Custom date range counts as active', countActiveFilters({ postedFrom: '2026-09-20' }) === 1);
check('Hide-pathway option counts as active', countActiveFilters({ includePathway: false }) === 1);

// Facets are disjunctive: ticking one experience level keeps the others.
{
  const pool = ['Junior SOC Analyst', 'Senior Security Engineer', 'Security Analyst Intern', 'Junior IAM Analyst'].map((t, i) =>
    normalizeJob(raw({ sourceJobId: `facet-${i}`, title: t, description: 'SIEM triage with Splunk and incident response.' })).job!,
  ).filter(Boolean);
  const withJunior = searchJobs(pool, { experience: ['junior'] }, { lastIngestAt: null });
  const levels = withJunior.facets.experience.map((f) => f.value);
  check('Other experience levels remain selectable', levels.includes('senior') && levels.includes('junior'), levels);
  check('Results still narrowed to the ticked level', withJunior.jobs.every((j) => j.experienceLevel === 'junior'), withJunior.jobs.map((j) => j.experienceLevel));
}

// Carried-forward postings get the corrected salary and title.
{
  const stale = normalizeJob(raw({ sourceJobId: 'carried-salary', title: 'informatics security consultant', description: 'Work 37.5 hours per week. Firewalls and SIEM.', salaryRaw: 'Salary $61,000.00 to $75,000.00 annually' })).job!;
  const broken = { ...stale, title: 'informatics security consultant', salary: { ...stale.salary, period: 'hour', annualMin: 126880000, annualMax: 156000000 } };
  const [fixed] = revalidate([broken]).jobs;
  check('Carried posting salary re-parsed', fixed?.salary.period === 'year' && fixed?.salary.annualMax === 75000, fixed?.salary);
  check('Carried posting title re-cased', fixed?.title === 'Informatics Security Consultant', fixed?.title);
}

// Deep links follow the province/city filters instead of assuming Ontario.
{
  const li = (f: Parameters<typeof buildDeepLinks>[0], p?: string) => new URL(buildDeepLinks(f, p)[0].url).searchParams.get('location');
  check('Calgary searches Alberta', li({ cities: ['Calgary'] }, 'Alberta') === 'Calgary, Alberta, Canada', li({ cities: ['Calgary'] }, 'Alberta'));
  check('Quebec filter searches Quebec', li({ provinces: ['QC'] }) === 'Quebec, Canada', li({ provinces: ['QC'] }));
  check('No filter keeps Ontario default', li({}) === 'Ontario, Canada', li({}));
}


/* ------------------------------------------------------------------ */
section('Off-topic and mis-titled postings found on the live board');

// Company boilerplate that mentions security must not admit an unrelated title.
const OKTA_BOILERPLATE = 'Okta is The World\'s Identity Company. We secure identity, threat detection, phishing-resistant MFA, zero trust, incident response, identity and access, encryption, SIEM integrations, vulnerability management and security posture for every customer. Cyber threats evolve; our security team works on malware and forensic investigations.';
check('Marketing Automation Manager at a security vendor rejected', classify('Marketing Automation Manager, AI Journey', OKTA_BOILERPLATE).rejected);
check('Solutions Consultant rejected despite security boilerplate', classify('Senior Solutions Consultant - Fluent in Portuguese/English', OKTA_BOILERPLATE).rejected);
check('Software Systems Designer rejected', classify('Software Systems Designer', OKTA_BOILERPLATE).rejected);
check('Identity Engineer is a security title', !classify('Senior Identity Engineer', OKTA_BOILERPLATE).rejected && classify('Senior Identity Engineer', OKTA_BOILERPLATE).relevanceScore >= 62);
check('Cyber operations title still accepted on body evidence', !classify('Cyber Operations Strategist, Critical Harm Operations', OKTA_BOILERPLATE).rejected);
check('Fraud operations still accepted on body evidence', !classify('Senior Fraud Operations Analyst', OKTA_BOILERPLATE).rejected);

// "Systems engineer" in ML / distributed-systems work is not a pathway into security.
check('ML System Engineer is not a pathway role', classify('Principal ML System Engineer', 'Build training infrastructure. Security of model artifacts matters.').isPathwayRole === false);
check('Distributed Systems Engineer is not a pathway role', classify('Distributed Systems Engineer (Data Platform)', 'Internet-scale scanning of threats and vulnerabilities.').isPathwayRole === false);
check('Systems Administrator is still a pathway role', classify('IT Systems Administrator', 'Patch servers, manage firewall rules and MFA.').isPathwayRole === true);

// Titles the description does not support.
const EYECARE = 'Job Summary: Specsavers is looking for experienced retail sales associates and eyecare consultants to join our team. No experience in optics required. You will greet customers, help them choose frames and book eye tests.';
check('Retail description under a cyber title rejected', classify('Cybersecurity Consultant', EYECARE, '', 'Specsavers Scottsdale Delta').rejected);
check('Restaurant franchise with no description rejected', classify('Cybersecurity Manager', '', '', 'SUBWAY Rive-Nord').rejected);
check('Coffee franchise with no description rejected', classify('Cybersecurity Manager', '', '', 'TIM HORTONS Gestion Carrière Goyette Inc.').rejected);
check('Home-care agency with no description rejected', classify('Cybersecurity Manager', '', '', 'Soins Idéal / Ideal Care').rejected);
check('Staffing firm with no description kept', !classify('Cybersecurity Manager', '', '', 'Labranche RH').rejected);
check('Guarding company Security Manager rejected', classify('Security Manager', 'Tasks: Co-ordinate administrative services. Manage the operations of a department.', '', 'BRAVO SECURITY SERVICES LTD.').rejected);
check('Threat Hunter and Threat Researcher are core security titles', classify('Threat Hunter', 'Hunt adversaries.').relevanceScore >= 62 && classify('Senior Threat Researcher', 'Research adversaries.').relevanceScore >= 62);
check('Cyber firm registered as "Security Services" keeps its threat hunters', !classify('Threat Hunter', 'Hunt adversaries across EDR telemetry, write detections, respond to incidents and malware.', '', 'eSentire Security Services Inc.').rejected);
check('OT/ICS specialist at a cyber firm named "Security Services" kept', !classify('OT/ICS Security Specialist', 'Protect plant networks.', '', 'eSentire Security Services Inc.').rejected);
check('Generic Security Supervisor at a guarding company rejected', classify('Security Supervisor', 'Schedule staff and manage client sites.', '', 'Paladin Security Services').rejected);
check('IT Security Manager at a guarding company kept', !classify('IT Security Manager', 'Manage firewalls, SIEM and endpoint security for our systems.', '', 'Bravo Security Services').rejected);
check('Health centre with a real security description kept', !classify('informatics security consultant', 'Work 37.5 hours per week securing clinical systems. Firewall administration, vulnerability scanning and security awareness training.', '', 'Durham Community Health Centre').rejected);

// Generic security titles get a real category instead of "Other".
const cat = (t: string) => classify(t, 'SIEM, incident response, vulnerability management, firewall, encryption, threat detection, phishing and MFA across our security operations.').category;
check('Cybersecurity Manager -> Security Leadership', cat('Cybersecurity Manager') === 'security_leadership', cat('Cybersecurity Manager'));
check('QNX Senior Cybersecurity Manager -> Security Leadership', cat('QNX Senior Cybersecurity Manager') === 'security_leadership', cat('QNX Senior Cybersecurity Manager'));
check('Cybersecurity Advisor -> GRC', cat('Cybersecurity Advisor') === 'grc', cat('Cybersecurity Advisor'));
check('Security advisor -> GRC', cat('Security advisor') === 'grc', cat('Security advisor'));
check('Cyber Security Co-op -> SOC / Security Analysis', cat('Cyber Security Co-op/Intern – JEDI Partnership') === 'soc_analysis', cat('Cyber Security Co-op/Intern – JEDI Partnership'));
check('Security Researcher -> Penetration Testing', cat('QNX Senior Security Researcher') === 'penetration_testing', cat('QNX Senior Security Researcher'));
check('Security Service Manager -> Security Leadership', cat('Security Service Manager') === 'security_leadership', cat('Security Service Manager'));

// One employer under two names is one employer.
check('BlackBerry QNX and BlackBerry share a company key', companyKey('BlackBerry QNX') === companyKey('BlackBerry'), [companyKey('BlackBerry QNX'), companyKey('BlackBerry')]);

// "$170, 000" — a comma followed by a space is still a thousands separator.
const spaced = parseSalary('$170, 000 to $200, 000');
check('Comma-space thousands separator parsed', spaced.min === 170000 && spaced.max === 200000 && spaced.period === 'year', spaced);

// Carried postings with raw HTML are cleaned on the next run.
{
  const tagged = { ...mk('html-carried'), description: '<p><strong>Let\'s build something amazing together!</strong><br><br>Our IT team keeps platforms secure with firewall and SIEM work.</p>', summary: '<p><strong>Let\'s build something amazing together!</strong>' };
  const [healed] = revalidate([tagged]).jobs;
  check('Carried description loses its HTML tags', !!healed && !/<[a-z]/i.test(healed.description), healed?.description);
  check('Carried summary loses its HTML tags', !!healed && !/<[a-z]/i.test(healed.summary) && healed.summary.startsWith("Let's build"), healed?.summary);
}

// A duplicate carried under an old fingerprint collapses once re-fingerprinted.
{
  const a = { ...mk('bb-1', { company: 'BlackBerry', title: 'QNX Senior Security Researcher', titleRaw: 'QNX Senior Security Researcher', locationRaw: 'Ottawa, ON', city: 'Ottawa' }), fingerprint: 'old-a' };
  const b = { ...mk('bb-2', { company: 'BlackBerry QNX', title: 'QNX Senior Security Researcher', titleRaw: 'QNX Senior Security Researcher', locationRaw: 'Ottawa, ON', city: 'Ottawa' }), fingerprint: 'old-b' };
  const [ra, rb] = revalidate([a, b]).jobs;
  check('Two-name duplicates get the same fingerprint', !!ra && !!rb && ra.fingerprint === rb.fingerprint, [ra?.fingerprint, rb?.fingerprint]);
}

// A carried posting filed under "Other" is re-filed once a rule covers it;
// a posting already in a real category is left alone.
{
  const stuck = { ...mk('other-carried', { title: 'Cybersecurity Manager', titleRaw: 'Cybersecurity Manager', company: 'Labranche RH' }), category: 'other' as const };
  const settled = { ...mk('grc-carried', { title: 'Cybersecurity Manager', titleRaw: 'Cybersecurity Manager', company: 'Acme' }), category: 'grc' as const };
  const [s1, s2] = revalidate([stuck, settled]).jobs;
  check('Carried "Other" re-filed under its category', s1?.category === 'security_leadership', s1?.category);
  check('Carried real category left alone', s2?.category === 'grc', s2?.category);
}


/* ------------------------------------------------------------------ */
section('ATS checker: resume parsing');

const ATS_NOW = new Date(Date.UTC(2026, 9, 1));
const RESUME = `Jordan Lee
jordan.lee@example.com | (519) 555-0142 | Waterloo, ON

SUMMARY
SOC analyst with hands-on incident response and cloud security lab work.

EXPERIENCE
Security Operations Analyst — Acme Corp
Jan 2022 – Dec 2023
• Responsible for monitoring alerts in Azure Sentinel and Splunk across 400 endpoints
• Helped with incident response for phishing cases
• Worked on Python scripts for log enrichment

IT Support Specialist — Beta Inc
Mar 2024 – Present
• Resolved tickets for a 200-person office
• Involved in firewall rule reviews

EDUCATION
Bachelor of Science, Computer Science — 2021

CERTIFICATIONS
CompTIA Security+

SKILLS
Splunk, Azure Sentinel, Python, Incident Response, Linux`;

const prof = parseResume(RESUME, ATS_NOW);
check('Resume: Splunk recognised', prof.terms.has('splunk'));
check('Resume: alias recorded as written', prof.terms.get('microsoft sentinel')?.found === 'Azure Sentinel', prof.terms.get('microsoft sentinel'));
check('Resume: certification recognised', prof.certifications.some((c) => c.canonical === 'CompTIA Security+'));
check("Resume: bachelor's degree recognised", prof.educationRank === 3, prof.education);
// Jan 2022–Dec 2023 = 24 months; Mar 2024–Oct 2026 (present, capped at "now") = 32 months; 56 months = 4.7 years.
check('Resume: years from dated roles', prof.years === 4.7, [prof.years, prof.periods.map((p) => p.text)]);
check('Resume: education dates not counted as work', prof.periods.length === 2, prof.periods.map((p) => p.text));
check('Resume: contact details found', prof.hasEmail && prof.hasPhone);
check('Resume: standard sections found', prof.sections.experience && prof.sections.education && prof.sections.skills, prof.sections);
check('Resume: overlapping roles counted once', coveredMonths([
  { text: 'a', start: new Date(Date.UTC(2020, 0, 1)), end: new Date(Date.UTC(2020, 11, 1)) },
  { text: 'b', start: new Date(Date.UTC(2020, 5, 1)), end: new Date(Date.UTC(2021, 5, 1)) },
]) === 18);

section('ATS checker: scoring (hand-calculated)');

const SOC_JOB = {
  title: 'SOC Analyst',
  requirements: {
    requiredSkills: ['Splunk', 'Incident Response', 'Python', 'AWS'],
    preferredSkills: [],
    technologies: ['Splunk', 'CrowdStrike Falcon'],
    certifications: ['CompTIA Security+'],
    education: ["Bachelor's degree"],
    yearsExperience: '2+ years',
    yearsExperienceMin: 2,
  },
};
// Applicable weights: required 40, tools 15, certs 10, experience 10, education 10, title 5 = 90
// (no preferred list). Re-weighted to 100: required 44.44 x 3/4 = 33.33; tools 16.67 x 0/1 = 0;
// certs 11.11 x 1 = 11.11; experience 11.11 x 1 = 11.11; education 11.11; title 5.56 x 2/2 = 5.56.
// Total 72.22 -> 72.
const sc = scoreResume(prof, SOC_JOB);
check('Score matches the hand calculation (72)', sc.score === 72, sc.components.map((c) => `${c.key}:${c.points}/${c.maxPoints}`));
check('Score is deterministic', scoreResume(prof, SOC_JOB).score === sc.score && scoreResume(parseResume(RESUME, ATS_NOW), SOC_JOB).score === 72);
check('Tools exclude keywords already counted as required', JSON.stringify(keywordSets(SOC_JOB).tools) === '["CrowdStrike Falcon"]');
check('Missing required keyword reported', JSON.stringify(sc.components.find((c) => c.key === 'required')?.missing) === '["AWS"]');
check('Component maxima sum to 100', Math.round(sc.components.reduce((a, c) => a + c.maxPoints, 0)) === 100);
// Adding AWS lifts required to 4/4: 44.44 + 11.11 + 11.11 + 11.11 + 5.56 = 83.33 -> 83, a gain of 11.
check('Gain for a missing keyword is exact (+11)', gainFor(prof, SOC_JOB, sc, 'AWS') === 11, gainFor(prof, SOC_JOB, sc, 'AWS'));
check('Empty resume scores 0', scoreResume(parseResume('', ATS_NOW), SOC_JOB).score === 0);
check('Title tokens stop at the employer/programme suffix', JSON.stringify(titleTokens('SOC Analyst (Tier 2) — Arctic Wolf Networks Talent Program')) === '["soc","analyst"]', titleTokens('SOC Analyst (Tier 2) — Arctic Wolf Networks Talent Program'));
check('Title tokens keep a comma-separated speciality', titleTokens('Senior Detection Engineer, Threat Research').includes('threat'));
check('Title tokens drop seniority words', JSON.stringify(titleTokens('Senior Product Security Lead (Remote)')) === '["product","security"]');
{
  const fewer = { ...SOC_JOB, requirements: { ...SOC_JOB.requirements, yearsExperienceMin: 8 } };
  const s8 = scoreResume(prof, fewer);
  // Experience 11.11 x 4.7/8 = 6.53 instead of 11.11: 72.22 - 4.58 = 67.64 -> 68.
  check('Experience below the minimum scores proportionally (68)', s8.score === 68, s8.score);
}
{
  const anyCert = { ...SOC_JOB, requirements: { ...SOC_JOB.requirements, certifications: ['CISSP', 'CISM', 'CompTIA Security+'] } };
  const c = scoreResume(prof, anyCert).components.find((x) => x.key === 'certifications');
  check('One of three alternative certifications earns half', c?.points === Math.round((c?.maxPoints ?? 0) * 5) / 10, c);
}

section('ATS checker: suggestions');

const sugg = suggest(prof, SOC_JOB, sc);
check('Missing keywords suggestion lists AWS with its gain', sugg.find((x) => x.id === 'missing-required')?.keywords?.[0]?.keyword === 'AWS' && sugg.find((x) => x.id === 'missing-required')?.keywords?.[0]?.gain === 11);
check('Wording suggestion: Azure Sentinel -> Microsoft Sentinel only when the posting asks for it', !sugg.some((x) => x.id === 'wording'));
{
  const sentinelJob = { ...SOC_JOB, requirements: { ...SOC_JOB.requirements, technologies: ['Microsoft Sentinel'] } };
  const w = suggest(prof, sentinelJob, scoreResume(prof, sentinelJob)).find((x) => x.id === 'wording');
  check('Wording suggestion uses the posting term', w?.rewrites?.[0]?.after === 'Microsoft Sentinel (Azure Sentinel)', w?.rewrites);
}
const responsible = sugg.find((x) => x.title.startsWith('“Responsible for'));
check('"Responsible for monitoring" rewritten without changing facts', responsible?.rewrites?.[0]?.after === 'Monitored alerts in Azure Sentinel and Splunk across 400 endpoints', responsible?.rewrites);
check('"Helped with" rewritten as "Supported"', sugg.find((x) => x.title.startsWith('“Helped'))?.rewrites?.[0]?.after === 'Supported incident response for phishing cases');
check('"Worked on" flagged with the real line', sugg.find((x) => x.title.startsWith('“Worked on'))?.examples?.[0] === 'Worked on Python scripts for log enrichment');
check('Past tense: regular, silent-e, doubled, -ied, irregular',
  pastTense('monitoring') === 'monitored' && pastTense('managing') === 'managed' && pastTense('planning') === 'planned' &&
  pastTense('identifying') === 'identified' && pastTense('building') === 'built' && pastTense('troubleshooting') === 'troubleshot');
check('Format checks pass for a well-formed resume', formatChecks(prof).filter((c) => c.label !== 'Length').every((c) => c.ok), formatChecks(prof).filter((c) => !c.ok));
check('Length check flags a very short resume', formatChecks(prof).find((c) => c.label === 'Length')?.ok === false);
check('Format check flags an unreadable (scanned) resume', !formatChecks(parseResume('scan', ATS_NOW))[0].ok);

section('ATS checker: advisor');

check('Under a year targets internship and co-op', levelsForYears(0.5).levels.includes('internship') && levelsForYears(0.5).levels.includes('coop'));
check('No dates falls back to entry-level', levelsForYears(null).levels.includes('entry'));
{
  const pool = ['SOC Analyst', 'Cloud Security Engineer', 'Help Desk Technician'].map((t, i) =>
    normalizeJob(raw({ sourceJobId: `adv-${i}`, title: t, description: 'Requirements: Splunk, incident response, Python, AWS, firewall, SIEM. 2+ years of experience.' })).job!,
  ).filter(Boolean);
  const adv = advise(prof, pool);
  check('Advisor ranks every live posting', adv.matches.length === pool.length);
  check('Advisor matches are sorted by score', adv.matches.every((m, i, a) => i === 0 || a[i - 1].result.score >= m.result.score));
  check('Advisor gives guidance', adv.guidance.length >= 2);
  const coop = normalizeJob(raw({ sourceJobId: 'adv-coop', title: 'Cybersecurity Co-op Student', description: 'Requirements: Splunk, incident response, Python, AWS, SIEM.' })).job!;
  const adv2 = advise(prof, [...pool, coop]);
  check('Advisor keeps student postings out of an experienced resume\'s top matches', !adv2.matches.some((m) => m.job.id === coop.id), adv2.matches.map((m) => m.job.title));
  check('Checker flags a student posting for an experienced resume', suggest(prof, coop, scoreResume(prof, coop)).some((x) => x.id === 'student-posting'));
}


/* ------------------------------------------------------------------ */
section('Start here: career catalogue, quiz and live stats');

check('Every career has a unique slug', new Set(CAREERS.map((c) => c.slug)).size === CAREERS.length);
check('Every career links only to careers that exist', CAREERS.every((c) => c.next.every((n) => CAREER_BY_SLUG.has(n))), CAREERS.flatMap((c) => c.next.filter((n) => !CAREER_BY_SLUG.has(n))));
check('Career map names only real careers, each once', (() => {
  const all = CAREER_MAP.flatMap((s) => s.slugs);
  return all.every((s) => CAREER_BY_SLUG.has(s)) && new Set(all).size === all.length && all.length === CAREERS.length;
})());
check('No board category belongs to two careers', (() => {
  const cats = CAREERS.flatMap((c) => c.categories);
  return new Set(cats).size === cats.length;
})());
check('Every learning resource is an https link', CAREERS.every((c) => c.learn.every((r) => /^https:\/\//.test(r.url))));
check('Quiz options only point at real careers', QUIZ.every((q) => q.options.every((o) => Object.keys(o.points).every((k) => CAREER_BY_SLUG.has(k)))));

// Every possible combination of answers produces three suggestions.
{
  let combos = 0;
  let bad = 0;
  const walk = (i: number, answers: Record<string, string>) => {
    if (i === QUIZ.length) {
      combos += 1;
      if (scoreQuiz(answers).length !== 3) bad += 1;
      return;
    }
    for (const o of QUIZ[i].options) walk(i + 1, { ...answers, [QUIZ[i].id]: o.id });
  };
  walk(0, {});
  check(`All ${combos} answer combinations give three suggestions`, bad === 0, bad);
}
// Hand-checked: investigate + new to tech + fast pace + some people + light scripting.
// soc-analyst 3+2+2+1+1 = 9; incident-response 3+0+2+0+1 = 6; it-support 0+2+1+0+0 = 3 (ties with
// vulnerability-management 0+0+0+2+1 = 3, broken by catalogue order: IT support comes first).
{
  const r = scoreQuiz({ enjoy: 'investigate', background: 'none', pace: 'fast', people: 'some', code: 'ok' });
  check('Quiz result matches the hand calculation', JSON.stringify(r.map((x) => [x.slug, x.points])) === '[["soc-analyst",9],["incident-response",6],["it-support",3]]', r.map((x) => [x.slug, x.points]));
  check('Quiz explains each suggestion', r[0].reasons.includes('you enjoy investigating') && r[0].reasons.includes('you like a fast pace'));
}
{
  const r = scoreQuiz({ enjoy: 'organise', background: 'business', pace: 'projects', people: 'lots', code: 'avoid' });
  check('A business background that avoids code is pointed to GRC first', r[0].slug === 'grc-analyst', r);
}

// Live stats against a small hand-built board.
{
  const soc = CAREER_BY_SLUG.get('soc-analyst')!;
  const mkJob = (id: string, over: Partial<import('../src/lib/types').Job>) => ({ ...mk(id), ...over });
  const pay = (lo: number, hi: number) => ({ ...mk('p').salary, annualMin: lo, annualMax: hi });
  const board = [
    mkJob('s1', { category: 'soc_analysis', experienceLevel: 'junior', workArrangement: 'remote', salary: pay(60000, 80000), company: 'Acme' }),
    mkJob('s2', { category: 'soc_analysis', experienceLevel: 'mid', workArrangement: 'onsite', salary: pay(80000, 100000), company: 'Acme' }),
    mkJob('s3', { category: 'soc_analysis', experienceLevel: 'entry', workArrangement: 'hybrid', salary: pay(50000, 50000), company: 'Beta' }),
    mkJob('s4', { category: 'soc_analysis', experienceLevel: 'senior', isExpired: true }),
    mkJob('g1', { category: 'grc', experienceLevel: 'junior' }),
  ];
  const st = careerStats(soc, board);
  check('Stats count only live postings in the path', st.open === 3 && jobsFor(soc, board).length === 3, st.open);
  check('Stats count entry-level and remote postings', st.entryLevel === 2 && st.remote === 1, [st.entryLevel, st.remote]);
  // Midpoints 70k, 90k, 50k -> sorted 50k, 70k, 90k: median 70k, range 50k-90k.
  check('Pay median and range from midpoints', st.pay?.median === 70000 && st.pay?.low === 50000 && st.pay?.high === 90000 && st.pay?.sample === 3, st.pay);
  check('Pay withheld below three postings', careerStats(soc, board.slice(0, 2)).pay === null);
  check('Top employer counted', st.topEmployers[0]?.name === 'Acme' && st.topEmployers[0]?.count === 2, st.topEmployers);
  // The career page's link must show exactly the postings the stats counted.
  const linked = searchJobs(board, filtersFromSearchParams(new URLSearchParams(boardLink(soc).slice(2))), { lastIngestAt: null });
  check('Board link shows exactly the counted postings', linked.total === st.open, [linked.total, st.open]);
}
check('Glossary terms are unique', new Set(GLOSSARY.map((g) => g.term.toLowerCase())).size === GLOSSARY.length);


/* ------------------------------------------------------------------ */
section('Workday discovery from robots.txt');

// tsx compiles this file to CommonJS, which has no top-level await, so the
// async checks run in a function and the summary waits for it.
const asyncChecks = (async () => {
  const host = 'acme.wd3.myworkdayjobs.com';
  const robots = [
    'User-agent: *',
    'Disallow: /wday/',
    `Sitemap: https://${host}/Acme_Careers/siteMap.xml`,
    `Sitemap: https://${host}/en-US/Acme_Campus/siteMap.xml`,
    'Sitemap: https://other.wd3.myworkdayjobs.com/NotOurs/siteMap.xml',
  ].join('\n');
  check('Sitemap lines give the site names (locale segment skipped, other hosts ignored)', JSON.stringify(parseWorkdaySites(robots, host)) === '["Acme_Careers","Acme_Campus"]', parseWorkdaySites(robots, host));
  check('Allow lines are the fallback', JSON.stringify(parseWorkdaySites('Allow: /Acme_Jobs/\nAllow: /wday/x', host)) === '["Acme_Jobs"]');
  check('A robots.txt with no sites yields none', parseWorkdaySites('User-agent: *\nDisallow:', host).length === 0);

  // A simulated Workday: the tenant lives on wd10, has three sites, one of
  // which robots.txt forbids and one of which does not answer.
  const calls: string[] = [];
  const NOW = new Date(Date.UTC(2026, 9, 3, 12));
  const deps = (overrides: Partial<import('../src/lib/sources/workday-discovery').DiscoveryDeps> = {}) => ({
    now: NOW,
    previous: null,
    fetchText: async (url: string) => {
      calls.push(url);
      if (url === 'https://acme.wd10.myworkdayjobs.com/robots.txt') {
        return ['Good', 'Blocked', 'Broken'].map((x) => `Sitemap: https://acme.wd10.myworkdayjobs.com/${x}/siteMap.xml`).join('\n');
      }
      throw new Error('HTTP 404');
    },
    postJson: async (url: string) => {
      if (url.endsWith('/Good/jobs')) return { total: 42, jobPostings: [] };
      throw new Error('HTTP 422');
    },
    allowed: async (url: string) => !url.includes('/Blocked/'),
    ...overrides,
  });
  const cand = { tenant: 'acme', label: 'Acme' };
  const e = await discoverTenant(cand, deps());
  check('Finds the tenant on its shard', e.status === 'found' && e.host === 'acme.wd10.myworkdayjobs.com', e);
  check('Keeps only sites that answer and robots.txt allows', JSON.stringify(e.sites) === '[{"site":"Good","total":42}]', e.sites);
  check('Shards are tried in order until one answers', calls[0] === 'https://acme.wd3.myworkdayjobs.com/robots.txt' && calls[1] === 'https://acme.wd10.myworkdayjobs.com/robots.txt', calls);

  calls.length = 0;
  const again = await discoverTenant(cand, deps({ previous: { generatedAt: '', entries: [e] } }));
  check('A known tenant is re-checked on its host only', again.status === 'found' && calls.length === 1 && calls[0].includes('wd10'), calls);

  calls.length = 0;
  const miss = { tenant: 'nobody', label: 'Nobody', status: 'not-found' as const, host: null, sites: [], checkedAt: new Date(NOW.getTime() - 3_600_000).toISOString() };
  const skipped = await discoverTenant({ tenant: 'nobody', label: 'Nobody' }, deps({ previous: { generatedAt: '', entries: [miss] } }));
  check('A recent miss is not re-probed', skipped.status === 'not-found' && calls.length === 0, calls);
  const stale = { ...miss, checkedAt: new Date(NOW.getTime() - 25 * 3_600_000).toISOString() };
  const reprobed = await discoverTenant({ tenant: 'nobody', label: 'Nobody' }, deps({ previous: { generatedAt: '', entries: [stale] } }));
  check('A miss older than a day is probed again', reprobed.status === 'not-found' && calls.length === 5, calls.length);

  const many = Array.from({ length: 9 }, (_, i) => `Sitemap: https://big.wd3.myworkdayjobs.com/S${i}/siteMap.xml`).join('\n');
  const big = await discoverTenant({ tenant: 'big', label: 'Big' }, deps({
    fetchText: async (url: string) => { if (url.includes('big.wd3')) return many; throw new Error('404'); },
    postJson: async () => ({ total: 1 }),
  }));
  check(`At most ${MAX_SITES_PER_TENANT} sites are taken per employer`, big.sites.length === MAX_SITES_PER_TENANT, big.sites.length);

  const stopped = await discoverTenant({ tenant: 'late', label: 'Late' }, deps({ expired: () => true }));
  check('Running out of time is not recorded as a miss', stopped.status === 'error' && Date.parse(stopped.checkedAt) === 0, stopped);
  const kept = await discoverTenant(cand, deps({ expired: () => true, previous: { generatedAt: '', entries: [e] } }));
  check('A previously found employer keeps its sites when time runs out', kept.status === 'found' && kept.sites.length === 1, kept);
})();

/* ------------------------------------------------------------------ */
void asyncChecks.then(
  () => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  },
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
