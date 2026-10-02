/** Plain-English definitions of the terms that appear most in postings. */
export interface GlossaryTerm {
  term: string;
  /** Spelled-out name, when the term is an acronym. */
  full?: string;
  definition: string;
}

export const GLOSSARY: GlossaryTerm[] = [
  { term: 'Access review', definition: 'A regular check that people only have the access they still need, removing the rest.' },
  { term: 'Active Directory', full: 'Microsoft Active Directory', definition: 'The Microsoft system most organisations use to manage user accounts, computers and permissions.' },
  { term: 'Alert triage', definition: 'Quickly sorting security alerts into false alarms and real problems that need investigation.' },
  { term: 'ATS', full: 'Applicant tracking system', definition: 'Software employers use to collect and filter applications; it often searches resumes for keywords.' },
  { term: 'Blue team', definition: 'The defenders: people who protect systems and respond to attacks.' },
  { term: 'CISSP', full: 'Certified Information Systems Security Professional', definition: 'A senior security certification from ISC2 that requires about five years of experience.' },
  { term: 'Cloud security', definition: 'Protecting systems and data hosted in services such as AWS, Microsoft Azure and Google Cloud.' },
  { term: 'Co-op', definition: 'A paid work term that is part of a college or university program; a common first job in Canada.' },
  { term: 'Compliance', definition: 'Showing that an organisation follows the laws, standards and rules that apply to it.' },
  { term: 'CVE', full: 'Common Vulnerabilities and Exposures', definition: 'A public ID number for a known security flaw, such as CVE-2024-12345.' },
  { term: 'DevSecOps', definition: 'Building security checks into the way software is developed and released, rather than adding them at the end.' },
  { term: 'DFIR', full: 'Digital forensics and incident response', definition: 'Investigating a breach: collecting evidence, finding out what happened and cleaning it up.' },
  { term: 'EDR', full: 'Endpoint detection and response', definition: 'Software on laptops and servers that detects and stops malicious activity, such as CrowdStrike or Microsoft Defender.' },
  { term: 'Encryption', definition: 'Scrambling data so only someone with the right key can read it.' },
  { term: 'Firewall', definition: 'A system that allows or blocks network traffic according to rules.' },
  { term: 'GRC', full: 'Governance, risk and compliance', definition: 'The side of security that sets policies, manages risk and proves the rules are followed.' },
  { term: 'Hardening', definition: 'Reducing a system’s weak points, for example by removing unused software and tightening settings.' },
  { term: 'Home lab', definition: 'A practice environment you build yourself — often free virtual machines — to gain hands-on experience.' },
  { term: 'IAM', full: 'Identity and access management', definition: 'Controlling who can sign in to which systems and what they can do there.' },
  { term: 'Incident response', definition: 'The organised way a team handles a security breach, from first alert to recovery.' },
  { term: 'ISO 27001', definition: 'The international standard for running an information security management program.' },
  { term: 'MFA', full: 'Multi-factor authentication', definition: 'Signing in with something extra besides a password, such as a code on your phone.' },
  { term: 'MITRE ATT&CK', definition: 'A public catalogue of the techniques attackers use, used to describe and detect attacks.' },
  { term: 'NIST CSF', full: 'NIST Cybersecurity Framework', definition: 'A widely used framework that organises security into identify, protect, detect, respond and recover.' },
  { term: 'OWASP Top 10', definition: 'A well-known list of the most serious web application security risks.' },
  { term: 'PAM', full: 'Privileged access management', definition: 'Extra controls around powerful admin accounts, which attackers target most.' },
  { term: 'Patch management', definition: 'Keeping software up to date with security fixes, in a planned and tracked way.' },
  { term: 'Penetration testing', definition: 'Authorised, simulated attacks to find weaknesses before criminals do.' },
  { term: 'Phishing', definition: 'Fake emails or messages designed to trick people into giving up passwords or running malware.' },
  { term: 'Red team', definition: 'People who play the attacker to test how well an organisation defends itself.' },
  { term: 'Reliability status', definition: 'The basic Government of Canada security screening needed for most federal jobs; the employer arranges it.' },
  { term: 'SAST / DAST', full: 'Static / dynamic application security testing', definition: 'Tools that look for security flaws in source code (static) or in a running application (dynamic).' },
  { term: 'Security clearance', definition: 'Government screening (Reliability, Secret, Top Secret) that some jobs require; it is sponsored by the employer, not applied for yourself.' },
  { term: 'Security+', full: 'CompTIA Security+', definition: 'A widely recognised entry-level security certification from CompTIA.' },
  { term: 'SIEM', full: 'Security information and event management', definition: 'A system that collects logs from across an organisation and raises alerts, such as Splunk or Microsoft Sentinel.' },
  { term: 'SOC', full: 'Security operations centre', definition: 'The team that monitors an organisation around the clock for attacks.' },
  { term: 'SOC 2', definition: 'A North American audit report showing that a service provider protects customer data properly.' },
  { term: 'SSO', full: 'Single sign-on', definition: 'Signing in once to reach many applications, managed centrally.' },
  { term: 'STAR method', definition: 'A way to answer interview questions: Situation, Task, Action, Result.' },
  { term: 'Threat hunting', definition: 'Proactively searching for attackers who have slipped past automated alerts.' },
  { term: 'Threat intelligence', definition: 'Information about attackers, their tools and methods, used to defend better.' },
  { term: 'Vulnerability', definition: 'A weakness in software or configuration that an attacker could exploit.' },
  { term: 'Zero trust', definition: 'A security approach that never assumes a user or device is safe just because it is inside the network.' },
];
