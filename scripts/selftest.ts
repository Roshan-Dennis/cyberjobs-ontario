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
import { normalizeJob, DEFAULT_NORMALIZE_OPTIONS } from '../src/lib/normalize';
import { dedupeJobs } from '../src/lib/normalize/dedupe';
import { searchJobs } from '../src/lib/query';
import { parseSalary } from '../src/lib/normalize/salary';
import { matchLocation } from '../src/lib/taxonomy/ontario';
import { normalizeTitle, inferExperienceLevel } from '../src/lib/taxonomy/titles';
import { buildDeepLinks } from '../src/lib/deeplinks';
import { decodeEscapedHtml } from '../src/lib/normalize/html';
import { TOKENS as JOBBANK_TOKENS, parseFeed as parseJobBankFeed } from '../src/lib/sources/jobbank';
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
section('Deep links');

const links = buildDeepLinks({ q: 'soc analyst', cities: ['Toronto'], postedWithinDays: 7, experience: ['entry'] });
check('LinkedIn link built', links.some((l) => l.site === 'LinkedIn' && l.url.includes('f_TPR=r604800')));
check('Indeed link built', links.some((l) => l.site === 'Indeed Canada' && l.url.includes('fromage=7')));
check('Location encoded', links[0].url.includes('Toronto'));
check('All links absolute https', links.every((l) => l.url.startsWith('https://')));

/* ------------------------------------------------------------------ */
section('Job Bank connector (regression guards)');

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
console.log(`\n${'='.repeat(70)}`);
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
