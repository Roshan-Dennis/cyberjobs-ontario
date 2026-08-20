/**
 * Write a small synthetic snapshot so the site can be built and eyeballed
 * without network access.
 *
 *   npm run fixture && npm run build:static
 *
 * These postings are obviously fake and the file it writes is gitignored, so
 * fixture data can never reach a publish — the real pipeline is `npm run data`.
 */
import { promises as fs } from 'node:fs';
import { normalizeJob } from '../src/lib/normalize';
import type { RawJob } from '../src/lib/types';

const SEEDS = [
  ['SOC Analyst (Tier 2)', 'Arctic Wolf Networks', 'Waterloo, Ontario, Canada', 'Monitor Splunk and CrowdStrike alerts, triage incidents, and escalate. CISSP or GCIA an asset. 3+ years of experience in a security operations centre. Python scripting preferred.', '$85,000 - $110,000 a year'],
  ['Cloud Security Engineer', 'Shopify', 'Remote - Canada', 'Secure our AWS and Kubernetes footprint using Terraform. You will build guardrails, run threat models, and partner with platform teams. Senior level. AWS Certified Security Specialty welcome.', null],
  ['Cybersecurity Co-op Student', 'Ontario Power Generation', 'Pickering, ON', 'Four month co-op supporting the OT security team. Exposure to Nessus, SIEM tooling and NERC CIP compliance work. Currently enrolled in a related program.', '$24 an hour'],
  ['Manager, GRC and Compliance', 'Sun Life', 'Toronto, ON (Hybrid)', 'Lead a team of five running the ISO 27001 and SOC 2 programs, vendor risk reviews and internal audit remediation. CISA or CRISC required. 8+ years experience.', '$130,000 - $160,000'],
  ['IT Support Specialist', 'City of Ottawa', 'Ottawa, Ontario', 'Provide desktop and Active Directory support, manage endpoint patching, and assist with MFA rollout. A great stepping stone toward a security career.', null],
  ['Penetration Tester', 'Bell Canada', 'Mississauga, ON', 'Perform web application and network penetration tests using Burp Suite, Metasploit and Nmap. OSCP strongly preferred. Reports to the offensive security lead.', '$100,000 - $125,000 per year'],
];

const now = Date.now();
const raws: RawJob[] = SEEDS.map(([title, company, loc, desc, salary], i) => ({
  sourceJobId: `fixture-${i}`,
  sourceId: 'greenhouse',
  sourceName: 'Greenhouse',
  sourceUrl: `https://example.com/jobs/${i}`,
  applyUrl: `https://example.com/jobs/${i}/apply`,
  title: title as string,
  company: company as string,
  locationRaw: loc as string,
  description: desc as string,
  descriptionIsHtml: false,
  postedAt: new Date(now - i * 36 * 3600 * 1000).toISOString(),
  salaryRaw: salary as string | null,
}));

const jobs = raws.map((r) => normalizeJob(r)).filter((o) => o.job).map((o) => o.job!);
const payload = {
  generatedAt: new Date().toISOString(),
  sources: [{ id: 'greenhouse', fetched: raws.length, kept: jobs.length }],
  jobs,
  truncatedDescriptions: false,
};
async function main() {
  await fs.mkdir('public/data', { recursive: true });
  await fs.writeFile('public/data/jobs.full.json', JSON.stringify(payload));
  await fs.writeFile('public/data/jobs.json', JSON.stringify({ ...payload, truncatedDescriptions: true }));
  console.log(`fixture: ${jobs.length}/${raws.length} jobs kept`);
}
main();
