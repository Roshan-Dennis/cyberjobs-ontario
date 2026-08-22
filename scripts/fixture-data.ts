/**
 * Write a synthetic snapshot so the site can be built and audited without
 * network access.
 *
 *   npm run fixture && npm run build:static
 *
 * The set is deliberately varied — long titles, missing salary, expired and
 * reposted entries, every work arrangement — so layout and empty-state bugs
 * surface locally instead of in production. The file it writes is gitignored,
 * so fixture data can never reach a publish; the real pipeline is `npm run data`.
 */
import { promises as fs } from 'node:fs';
import { normalizeJob } from '../src/lib/normalize';
import type { RawJob } from '../src/lib/types';

const TITLES: [string, string][] = [
  ['SOC Analyst (Tier 2)', 'Monitor Splunk and CrowdStrike alerts, triage incidents and escalate. CISSP or GCIA an asset. 3+ years in a security operations centre. Python scripting preferred.'],
  ['Cloud Security Engineer', 'Secure our AWS and Kubernetes footprint using Terraform. Build guardrails, run threat models, partner with platform teams. AWS Certified Security Specialty welcome.'],
  ['Cybersecurity Co-op Student', 'Four month co-op supporting the OT security team. Exposure to Nessus, SIEM tooling and NERC CIP compliance. Currently enrolled in a related program.'],
  ['Manager, GRC and Compliance', 'Lead a team of five running the ISO 27001 and SOC 2 programs, vendor risk reviews and internal audit remediation. CISA or CRISC required. 8+ years experience.'],
  ['IT Support Specialist', 'Desktop and Active Directory support, endpoint patching, MFA rollout assistance. A stepping stone toward a security career.'],
  ['Penetration Tester', 'Web application and network penetration tests using Burp Suite, Metasploit and Nmap. OSCP strongly preferred.'],
  ['Senior Detection Engineer, Threat Research and Adversary Emulation', 'Write Sigma rules, tune the SIEM, hunt across EDR telemetry. MITRE ATT&CK fluency required. Splunk and Sentinel.'],
  ['Identity and Access Management Analyst', 'Administer Okta and Active Directory, run access reviews, support privileged access management. SailPoint experience an asset.'],
  ['Application Security Engineer', 'Threat modelling, secure code review and SAST/DAST tooling across a Go and TypeScript codebase. Work with developers, not against them.'],
  ['Incident Response Consultant', 'Lead client engagements during active intrusions. Forensics with Velociraptor and KAPE. GCIH or GCFA required.'],
  ['Network Security Administrator', 'Manage Palo Alto and Fortinet firewalls, VPN concentrators and network segmentation. CCNA Security an asset.'],
  ['Privacy Analyst', 'Support PIPEDA and PHIPA compliance, privacy impact assessments and data mapping. CIPP/C preferred.'],
  ['DevSecOps Engineer', 'Embed security scanning into GitLab CI, manage secrets with Vault, harden container images. Kubernetes and Go.'],
  ['Security Architect', 'Own reference architecture for a hybrid Azure estate. Zero trust, segmentation and identity. 10+ years experience.'],
  ['Help Desk Analyst', 'Password resets, phishing triage and MFA support for 900 staff. Great first step into security.'],
  ['Threat Intelligence Analyst', 'Track adversary infrastructure, produce finished intelligence, brief stakeholders. Recorded Future and MISP.'],
  ['Vulnerability Management Analyst', 'Run Tenable scans, drive remediation SLAs, report on exposure trends across 4,000 endpoints.'],
  ['OT/ICS Security Specialist', 'Protect plant control systems. IEC 62443, Claroty and network monitoring in a manufacturing environment.'],
];

const CITIES = ['Toronto, ON', 'Ottawa, ON', 'Waterloo, Ontario, Canada', 'Mississauga, ON', 'London, ON',
  'Hamilton, Ontario', 'Kingston, ON', 'Remote - Canada', 'Markham, ON (Hybrid)', 'Windsor, Ontario'];
const COMPANIES = ['Arctic Wolf Networks', 'BlackBerry', 'Shopify', 'Sun Life', 'Ontario Power Generation',
  'City of Ottawa', 'Bell Canada', 'Thomson Reuters', 'BMO', 'D2L', 'Cohere', 'eSentire Security Services Inc.'];
const SALARIES: (string | null)[] = ['$85,000 - $110,000 a year', null, '$24 an hour', '$130,000 - $160,000',
  null, '$100,000 - $125,000 per year', null, null];
const SOURCES: [string, string][] = [['greenhouse', 'Greenhouse'], ['lever', 'Lever'], ['ashby', 'Ashby'],
  ['workday', 'Workday'], ['jobbank', 'Job Bank']];

const now = Date.now();
const DAY = 86_400_000;

const raws: RawJob[] = [];
for (let i = 0; i < 96; i += 1) {
  const [title, desc] = TITLES[i % TITLES.length];
  const [sourceId, sourceName] = SOURCES[i % SOURCES.length];
  raws.push({
    sourceJobId: `fixture-${i}`,
    sourceId,
    sourceName,
    sourceUrl: `https://example.com/jobs/${i}`,
    applyUrl: `https://example.com/jobs/${i}/apply`,
    title: i % 11 === 0 ? `${title} — ${COMPANIES[i % COMPANIES.length]} Talent Program` : title,
    company: COMPANIES[i % COMPANIES.length],
    locationRaw: CITIES[i % CITIES.length],
    description: desc,
    descriptionIsHtml: false,
    // Spread across 45 days so the trend chart and date filters have something
    // to show, and some entries fall past the expiry threshold.
    postedAt: new Date(now - (i % 45) * DAY - (i % 7) * 3_600_000).toISOString(),
    salaryRaw: SALARIES[i % SALARIES.length],
  });
}

async function main() {
  const jobs = raws.map((r) => normalizeJob(r)).flatMap((o) => (o.job ? [o.job] : []));
  const payload = {
    generatedAt: new Date().toISOString(),
    sources: SOURCES.map(([id]) => ({ id, fetched: 40, kept: jobs.filter((j) => j.sourceId === id).length })),
    jobs,
    truncatedDescriptions: false,
  };
  await fs.mkdir('public/data', { recursive: true });
  await fs.writeFile('public/data/jobs.full.json', JSON.stringify(payload));
  await fs.writeFile('public/data/jobs.json', JSON.stringify({ ...payload, truncatedDescriptions: true }));
  console.log(`fixture: ${jobs.length}/${raws.length} jobs kept`);
}
main();
