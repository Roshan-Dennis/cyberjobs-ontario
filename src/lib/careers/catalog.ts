/**
 * The cybersecurity career paths the "Start here" guide explains.
 *
 * Only the descriptions live here. Every number shown about a path — open
 * jobs, entry-level share, skills, certifications, pay, employers — is
 * computed from the live postings at build time (see stats.ts), so nothing on
 * these pages goes stale or has to be kept up to date by hand.
 */
import type { JobCategory } from '@/lib/types';

export type EntryLevel = 'first-job' | 'from-it' | 'experienced';

export const ENTRY_LABELS: Record<EntryLevel, string> = {
  'first-job': 'Good first job',
  'from-it': 'Common second step',
  experienced: 'Usually needs experience',
};

export interface Resource {
  name: string;
  url: string;
  note: string;
  free: boolean;
}

export interface Career {
  slug: string;
  title: string;
  /** One line, plain language. */
  summary: string;
  /** Board categories whose postings count towards this path. */
  categories: JobCategory[];
  entry: EntryLevel;
  /** What the work looks like day to day. */
  work: string[];
  /** Signs this could suit someone. */
  enjoyIf: string[];
  /** How people usually get their first role on this path. */
  wayIn: string;
  /** Where this path tends to lead (career map). */
  next: string[];
  /** Free or low-cost ways to start learning, in a sensible order. */
  learn: Resource[];
  /** Certifications in the order people usually take them. */
  certs: { name: string; note: string }[];
}

const R = {
  messer: { name: 'Professor Messer', url: 'https://www.professormesser.com/', note: 'Free video courses for CompTIA A+, Network+ and Security+', free: true },
  netacad: { name: 'Cisco Networking Academy', url: 'https://www.netacad.com/', note: 'Free introductory networking and cybersecurity courses', free: true },
  thm: { name: 'TryHackMe', url: 'https://tryhackme.com/', note: 'Guided hands-on labs in the browser; many rooms are free', free: true },
  msLearn: { name: 'Microsoft Learn', url: 'https://learn.microsoft.com/training/', note: 'Free courses on Microsoft 365, Entra ID, Azure and Sentinel', free: true },
  aws: { name: 'AWS Skill Builder', url: 'https://skillbuilder.aws/', note: 'Free AWS cloud and security fundamentals courses', free: true },
  splunk: { name: 'Splunk training', url: 'https://www.splunk.com/en_us/training.html', note: 'Includes free introductory Splunk courses', free: true },
  mitre: { name: 'MITRE ATT&CK', url: 'https://attack.mitre.org/', note: 'The common language for how attackers operate', free: true },
  nist: { name: 'NIST Cybersecurity Framework', url: 'https://www.nist.gov/cyberframework', note: 'The framework most security programs are built around', free: true },
  cis: { name: 'CIS Controls', url: 'https://www.cisecurity.org/controls', note: 'A practical, prioritised list of security safeguards', free: true },
  owasp: { name: 'OWASP Top 10', url: 'https://owasp.org/www-project-top-ten/', note: 'The most important web application security risks', free: true },
  portswigger: { name: 'PortSwigger Web Security Academy', url: 'https://portswigger.net/web-security', note: 'Free, in-depth web security labs', free: true },
  htb: { name: 'Hack The Box', url: 'https://www.hackthebox.com/', note: 'Practice machines for offensive skills; free tier available', free: true },
  cyberdefenders: { name: 'CyberDefenders', url: 'https://cyberdefenders.org/', note: 'Blue-team investigation challenges; free tier available', free: true },
  cccs: { name: 'Canadian Centre for Cyber Security', url: 'https://www.cyber.gc.ca/en', note: 'Canada’s national guidance, alerts and publications', free: true },
} satisfies Record<string, Resource>;

export const CAREERS: Career[] = [
  {
    slug: 'it-support',
    title: 'IT Support / Help Desk',
    summary: 'Keep people and their devices working. The most common first step into security.',
    categories: ['adjacent_it'],
    entry: 'first-job',
    work: [
      'Answer tickets: password resets, laptops, email, printers and access requests',
      'Set up accounts and devices, and remove access when people leave',
      'Spot and escalate suspicious emails, logins and malware',
    ],
    enjoyIf: ['You like helping people and solving everyday problems', 'You want paid experience while you learn security'],
    wayIn: 'Often open to beginners. CompTIA A+ or a college IT diploma helps; customer-service experience counts.',
    next: ['soc-analyst', 'iam-analyst', 'security-engineer'],
    learn: [R.messer, R.netacad, R.msLearn],
    certs: [
      { name: 'CompTIA A+', note: 'Hardware, operating systems and troubleshooting' },
      { name: 'CompTIA Network+', note: 'How networks work' },
      { name: 'Microsoft 365 / Azure fundamentals', note: 'The tools most Canadian employers run' },
    ],
  },
  {
    slug: 'soc-analyst',
    title: 'SOC Analyst',
    summary: 'Watch for attacks, investigate alerts and raise the alarm when something is real.',
    categories: ['soc_analysis'],
    entry: 'first-job',
    work: [
      'Triage alerts from a SIEM such as Splunk or Microsoft Sentinel',
      'Investigate suspicious logins, phishing and malware on endpoints',
      'Write up what happened and hand serious cases to incident response',
    ],
    enjoyIf: ['You like investigating and finding the story in data', 'You stay calm and methodical under pressure'],
    wayIn: 'The classic entry-level security job. Security+, a home lab with a SIEM, and IT support experience make a strong application.',
    next: ['incident-response', 'cloud-security', 'vulnerability-management'],
    learn: [R.messer, R.thm, R.splunk, R.mitre, R.cyberdefenders],
    certs: [
      { name: 'CompTIA Security+', note: 'A widely recognised entry-level security certification' },
      { name: 'ISC2 Certified in Cybersecurity (CC)', note: 'An entry-level alternative; check ISC2 for current free-exam offers' },
      { name: 'CompTIA CySA+', note: 'Analyst-focused, once you have some experience' },
    ],
  },
  {
    slug: 'grc-analyst',
    title: 'GRC & Compliance Analyst',
    summary: 'Make sure the organisation follows security rules, standards and laws — and can prove it.',
    categories: ['grc', 'privacy_data_protection'],
    entry: 'first-job',
    work: [
      'Assess risks and track how they are being reduced',
      'Map controls to frameworks such as ISO 27001, SOC 2 and NIST',
      'Prepare evidence for audits and write security policies',
    ],
    enjoyIf: ['You are organised and good with documents and people', 'You come from business, audit, project management or law'],
    wayIn: 'Open to career changers with business, audit or project experience. Learning the main frameworks matters more than coding.',
    next: ['security-engineer', 'cloud-security'],
    learn: [R.nist, R.cis, R.cccs, R.messer],
    certs: [
      { name: 'CompTIA Security+', note: 'Shared security vocabulary' },
      { name: 'ISO 27001 Foundation', note: 'The international security management standard' },
      { name: 'ISACA CISA or CRISC', note: 'Audit and risk, once you have experience' },
    ],
  },
  {
    slug: 'iam-analyst',
    title: 'Identity & Access (IAM) Analyst',
    summary: 'Control who can sign in to what — one of the most important defences there is.',
    categories: ['iam_pam'],
    entry: 'from-it',
    work: [
      'Manage accounts, groups and permissions in Entra ID (Azure AD) or Okta',
      'Run access reviews and remove access people no longer need',
      'Set up single sign-on and multi-factor authentication',
    ],
    enjoyIf: ['You like systems, rules and getting details right', 'You enjoyed the access side of IT support'],
    wayIn: 'A natural next step from IT support or system administration, especially with Active Directory or Microsoft 365 experience.',
    next: ['cloud-security', 'security-engineer'],
    learn: [R.msLearn, R.messer, R.thm],
    certs: [
      { name: 'Microsoft SC-900', note: 'Security, compliance and identity fundamentals' },
      { name: 'Microsoft SC-300', note: 'Identity and access administrator' },
      { name: 'Okta Certified Professional', note: 'If you work with Okta' },
    ],
  },
  {
    slug: 'vulnerability-management',
    title: 'Vulnerability Management Analyst',
    summary: 'Find the weaknesses in systems before attackers do, and get them fixed.',
    categories: ['vulnerability_management'],
    entry: 'from-it',
    work: [
      'Run scanners such as Nessus, Qualys or Rapid7 across the network',
      'Rank findings by real risk and work with teams to patch them',
      'Track progress and report on what is still exposed',
    ],
    enjoyIf: ['You like methodical work and following things through', 'You want a technical role that also involves people'],
    wayIn: 'Often reached from IT support, system administration or a SOC. Comfort with Windows, Linux and networking matters.',
    next: ['penetration-tester', 'cloud-security', 'security-engineer'],
    learn: [R.thm, R.messer, R.cis],
    certs: [
      { name: 'CompTIA Security+', note: 'Foundation' },
      { name: 'CompTIA CySA+', note: 'Covers vulnerability management in depth' },
      { name: 'Tenable or Qualys product certifications', note: 'Free vendor courses for the scanners employers use' },
    ],
  },
  {
    slug: 'incident-response',
    title: 'Incident Response & Threat Intelligence',
    summary: 'Lead the response when an attack happens, and track who is attacking and how.',
    categories: ['incident_response', 'dfir', 'threat_intelligence'],
    entry: 'experienced',
    work: [
      'Contain and investigate breaches, ransomware and account takeovers',
      'Collect and analyse forensic evidence from systems and logs',
      'Research attacker groups and turn it into detections and advice',
    ],
    enjoyIf: ['You like high-stakes problem solving', 'You enjoyed the investigation side of SOC work'],
    wayIn: 'Usually reached after time in a SOC. Hands-on investigation practice and knowledge of MITRE ATT&CK set candidates apart.',
    next: ['security-engineer'],
    learn: [R.mitre, R.cyberdefenders, R.thm, R.cccs],
    certs: [
      { name: 'CompTIA CySA+', note: 'Analyst foundation' },
      { name: 'GIAC GCIH', note: 'Incident handling (paid, highly regarded)' },
      { name: 'GIAC GCFA', note: 'Forensics, later in the path' },
    ],
  },
  {
    slug: 'cloud-security',
    title: 'Cloud Security',
    summary: 'Secure what companies run in AWS, Azure and Google Cloud.',
    categories: ['cloud_security', 'devsecops'],
    entry: 'from-it',
    work: [
      'Configure secure cloud accounts, networks and identity',
      'Review infrastructure-as-code and fix risky cloud settings',
      'Monitor cloud activity and respond to alerts',
    ],
    enjoyIf: ['You like building and automating', 'You have (or want) cloud or infrastructure skills'],
    wayIn: 'Usually reached from cloud, system administration or DevOps roles. A cloud certification plus a security one is a strong pair.',
    next: ['security-engineer'],
    learn: [R.aws, R.msLearn, R.thm],
    certs: [
      { name: 'AWS Certified Cloud Practitioner or Azure AZ-900', note: 'Cloud fundamentals' },
      { name: 'AWS Security Specialty or Microsoft AZ-500', note: 'Cloud security, once you have experience' },
      { name: 'ISC2 CCSP', note: 'Advanced, vendor-neutral' },
    ],
  },
  {
    slug: 'penetration-tester',
    title: 'Penetration Tester',
    summary: 'Hack systems with permission to find holes before criminals do.',
    categories: ['penetration_testing'],
    entry: 'experienced',
    work: [
      'Test networks, web apps and cloud setups for weaknesses',
      'Chain findings together to show real business impact',
      'Write clear reports with steps to fix every issue',
    ],
    enjoyIf: ['You love puzzles and figuring out how things break', 'You will practise a lot on your own time'],
    wayIn: 'Competitive, and rarely a first job. Most testers start in IT, a SOC or development and build a portfolio on practice platforms.',
    next: ['application-security'],
    learn: [R.thm, R.htb, R.portswigger, R.owasp],
    certs: [
      { name: 'CompTIA PenTest+ or eJPT', note: 'Entry-level offensive certifications' },
      { name: 'OSCP', note: 'The best-known hands-on pentest certification (paid, demanding)' },
    ],
  },
  {
    slug: 'application-security',
    title: 'Application Security',
    summary: 'Help developers build software that is secure from the start.',
    categories: ['application_security'],
    entry: 'experienced',
    work: [
      'Review code and designs for security flaws',
      'Run and tune code-scanning tools (SAST, DAST) in the build pipeline',
      'Train developers and help them fix what is found',
    ],
    enjoyIf: ['You can code, or enjoy learning to', 'You like teaching and working with engineering teams'],
    wayIn: 'Usually reached from software development or penetration testing. Knowing the OWASP Top 10 well is the starting point.',
    next: ['security-engineer'],
    learn: [R.owasp, R.portswigger, R.thm],
    certs: [
      { name: 'CompTIA Security+', note: 'Foundation' },
      { name: 'GIAC GWEB or vendor AppSec training', note: 'Web application security' },
    ],
  },
  {
    slug: 'security-engineer',
    title: 'Security Engineer & Administrator',
    summary: 'Build and run the security tools and defences an organisation relies on.',
    categories: ['security_engineering', 'security_administration', 'network_security', 'security_architecture'],
    entry: 'from-it',
    work: [
      'Deploy and manage firewalls, EDR, email security and SIEM tools',
      'Automate security tasks with scripts',
      'Harden systems and design safer networks',
    ],
    enjoyIf: ['You like building things and making them reliable', 'You have system, network or scripting experience'],
    wayIn: 'Reached from system or network administration, a SOC, or IT support with strong technical skills.',
    next: ['cloud-security', 'incident-response'],
    learn: [R.netacad, R.messer, R.msLearn, R.cis],
    certs: [
      { name: 'CompTIA Network+ and Security+', note: 'Foundations' },
      { name: 'Vendor certifications (Palo Alto, Fortinet, Microsoft)', note: 'For the tools you run' },
      { name: 'ISC2 CISSP', note: 'Senior, needs five years of experience' },
    ],
  },
];

export const CAREER_BY_SLUG = new Map(CAREERS.map((c) => [c.slug, c]));

/** The career map: where people usually start, step next, and specialise. */
export const CAREER_MAP: { stage: string; note: string; slugs: string[] }[] = [
  { stage: 'Start', note: 'Open to beginners', slugs: ['it-support', 'soc-analyst', 'grc-analyst'] },
  { stage: 'Grow', note: 'After 1–3 years', slugs: ['iam-analyst', 'vulnerability-management', 'cloud-security', 'security-engineer'] },
  { stage: 'Specialise', note: 'With experience', slugs: ['incident-response', 'penetration-tester', 'application-security'] },
];
