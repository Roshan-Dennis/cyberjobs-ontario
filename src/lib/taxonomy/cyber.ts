import type { JobCategory } from '@/lib/types';

/** A term plus the surface forms that should match it in free text. */
export interface Term {
  canonical: string;
  aliases: string[];
  /** Optional: require word-boundary-exact matching (for short/ambiguous terms). */
  strict?: boolean;
}

const t = (canonical: string, aliases: string[] = [], strict = false): Term => ({
  canonical,
  aliases,
  strict,
});

/* ------------------------------------------------------------------ */
/* Certifications                                                      */
/* ------------------------------------------------------------------ */

export const CERTIFICATIONS: Term[] = [
  t('CISSP', ['certified information systems security professional']),
  t('CISM', ['certified information security manager']),
  t('CISA', ['certified information systems auditor']),
  t('CRISC'),
  t('CGEIT'),
  t('CCSP', ['certified cloud security professional']),
  t('CCSK'),
  t('CompTIA Security+', ['security+', 'sec+', 'securityplus']),
  t('CompTIA Network+', ['network+', 'net+']),
  t('CompTIA A+', ['comptia a+']),
  t('CompTIA CySA+', ['cysa+', 'cybersecurity analyst+']),
  t('CompTIA PenTest+', ['pentest+']),
  t('CompTIA CASP+', ['casp+', 'securityx']),
  t('CompTIA Cloud+', ['cloud+']),
  t('CompTIA Linux+', ['linux+']),
  t('CEH', ['certified ethical hacker'], true),
  t('OSCP', ['offensive security certified professional']),
  t('OSCE'),
  t('OSWE'),
  t('OSEP'),
  t('CRTO', ['certified red team operator']),
  t('CRTP'),
  t('PNPT'),
  t('eJPT'),
  t('eCPPT'),
  t('GSEC'),
  t('GCIH'),
  t('GCIA'),
  t('GCFA'),
  t('GCFE'),
  t('GNFA'),
  t('GREM'),
  t('GPEN'),
  t('GWAPT'),
  t('GCTI'),
  t('GSLC'),
  t('GDSA'),
  t('GMON'),
  t('GCED'),
  t('GICSP'),
  t('GIAC'),
  t('SANS'),
  t('SSCP'),
  t('CASP'),
  t('CCNA', ['cisco certified network associate']),
  t('CCNP'),
  t('CCIE'),
  t('CCNA Security'),
  t('CCNA CyberOps', ['cyberops associate']),
  t('AWS Certified Security - Specialty', ['aws security specialty', 'aws certified security']),
  t('AWS Certified Solutions Architect', ['aws solutions architect associate']),
  t('AWS Certified Cloud Practitioner'),
  t('Azure Security Engineer (AZ-500)', ['az-500', 'azure security engineer']),
  t('Azure Administrator (AZ-104)', ['az-104']),
  t('Azure Fundamentals (AZ-900)', ['az-900']),
  t('Microsoft SC-200', ['sc-200', 'security operations analyst associate']),
  t('Microsoft SC-100', ['sc-100', 'cybersecurity architect expert']),
  t('Microsoft SC-300', ['sc-300', 'identity and access administrator']),
  t('Microsoft SC-900', ['sc-900']),
  t('Microsoft MS-500', ['ms-500']),
  t('Google Professional Cloud Security Engineer', ['gcp security engineer']),
  t('Google Cybersecurity Certificate'),
  t('ITIL'),
  t('PMP'),
  t('CIPP', ['cipp/c', 'cipp/e', 'certified information privacy professional']),
  t('CIPM'),
  t('CIPT'),
  t('ISO 27001 Lead Auditor', ['27001 lead auditor', 'iso27001 lead auditor']),
  t('ISO 27001 Lead Implementer', ['27001 lead implementer']),
  t('CFE', ['certified fraud examiner'], true),
  t('CHFI'),
  t('EnCE'),
  t('ACE (AccessData)', ['accessdata certified examiner']),
  t('Splunk Certified', ['splunk core certified', 'splunk power user']),
  t('Palo Alto PCNSA', ['pcnsa']),
  t('Palo Alto PCNSE', ['pcnse']),
  t('Fortinet NSE', ['nse 4', 'nse4', 'nse 7', 'nse7', 'fortinet certified']),
  t('CrowdStrike CCFA', ['ccfa']),
  t('CrowdStrike CCFR', ['ccfr']),
  t('HashiCorp Vault Associate'),
  t('Certified Kubernetes Administrator', ['cka']),
  t('Certified Kubernetes Security Specialist', ['ckss', 'cks']),
  t('TOGAF'),
  t('SABSA'),
  t('CBCP'),
  t('CCSE (Check Point)', ['check point ccse']),
  t('CCSA (Check Point)', ['check point ccsa']),
];

/* ------------------------------------------------------------------ */
/* Technologies / tooling                                              */
/* ------------------------------------------------------------------ */

export const TECHNOLOGIES: Term[] = [
  // SIEM / logging
  t('Splunk'), t('Splunk ES', ['splunk enterprise security']),
  t('Microsoft Sentinel', ['azure sentinel', 'ms sentinel']),
  t('QRadar', ['ibm qradar']),
  t('Elastic Security', ['elk stack', 'elasticsearch', 'elastic siem']),
  t('Chronicle', ['google chronicle', 'google secops']),
  t('Sumo Logic'), t('LogRhythm'), t('Exabeam'), t('Securonix'),
  t('Devo'), t('Graylog'), t('Panther'), t('Datadog'), t('Grafana'),
  t('ArcSight'), t('Rapid7 InsightIDR', ['insightidr']),
  // EDR / XDR
  t('CrowdStrike Falcon', ['crowdstrike']),
  t('Microsoft Defender for Endpoint', ['defender for endpoint', 'mde']),
  t('Microsoft Defender XDR', ['defender xdr', 'm365 defender', 'microsoft 365 defender']),
  t('SentinelOne'), t('Carbon Black'), t('Cortex XDR'), t('Cybereason'),
  t('Trend Micro'), t('Sophos'), t('Trellix'), t('Tanium'), t('Velociraptor'),
  // SOAR
  t('Cortex XSOAR', ['demisto', 'xsoar']), t('Splunk SOAR', ['phantom']),
  t('Torq'), t('Tines'), t('Swimlane'), t('Logic Apps'),
  // Vuln management
  t('Tenable', ['tenable.io', 'tenable.sc']), t('Nessus'),
  t('Qualys'), t('Rapid7 Nexpose', ['nexpose']), t('InsightVM'),
  t('Wiz'), t('Orca Security'), t('Prisma Cloud'), t('Lacework'),
  t('OpenVAS'), t('Greenbone'),
  // Offensive
  t('Burp Suite', ['burpsuite', 'burp']), t('Metasploit'), t('Cobalt Strike'),
  t('Nmap'), t('Wireshark'), t('BloodHound'), t('Mimikatz'), t('Impacket'),
  t('Kali Linux', ['kali']), t('Hashcat'), t('Responder'), t('sqlmap'),
  t('OWASP ZAP', ['zap proxy']), t('Nuclei'), t('Ghidra'), t('IDA Pro'),
  t('Volatility'), t('Autopsy'), t('FTK'), t('EnCase'), t('X-Ways'),
  t('Magnet AXIOM', ['axiom']), t('Cellebrite'),
  // AppSec
  t('SAST'), t('DAST'), t('IAST'), t('SCA', ['software composition analysis'], true),
  t('Snyk'), t('Checkmarx'), t('Veracode'), t('Fortify'), t('SonarQube'),
  t('Semgrep'), t('Dependabot'), t('Trivy'), t('Aqua Security'), t('Sysdig'),
  t('GitHub Advanced Security', ['ghas']),
  // Network
  t('Palo Alto Networks', ['palo alto', 'pan-os']), t('Fortinet', ['fortigate']),
  t('Check Point'), t('Cisco ASA'), t('Cisco Firepower'), t('Juniper'),
  t('pfSense'), t('Zscaler'), t('Netskope'), t('Cloudflare'),
  t('F5'), t('Citrix'), t('Aruba'), t('Meraki'),
  t('Suricata'), t('Snort'), t('Zeek', ['bro ids']), t('Darktrace'), t('ExtraHop'),
  t('VPN'), t('SASE'), t('SD-WAN'), t('ZTNA'), t('NAC', ['network access control'], true),
  t('Cisco ISE'), t('Forescout'),
  // IAM
  t('Okta'), t('Entra ID', ['azure ad', 'azure active directory', 'aad', 'microsoft entra']),
  t('Active Directory'), t('Ping Identity', ['pingfederate']),
  t('SailPoint'), t('CyberArk'), t('BeyondTrust'), t('Delinea', ['thycotic']),
  t('HashiCorp Vault'), t('Duo Security', ['cisco duo']), t('ForgeRock'),
  t('SAML'), t('OAuth', ['oauth2', 'oauth 2.0']), t('OIDC', ['openid connect']),
  t('SCIM'), t('LDAP'), t('Kerberos'), t('MFA', ['multi-factor authentication'], true),
  t('SSO', ['single sign-on'], true),
  // Cloud / platform
  t('AWS', ['amazon web services'], true), t('Azure'), t('GCP', ['google cloud platform']),
  t('Kubernetes', ['k8s']), t('Docker'), t('Terraform'), t('Ansible'),
  t('CloudFormation'), t('Pulumi'), t('OpenShift'), t('Helm'),
  t('AWS GuardDuty', ['guardduty']), t('AWS Security Hub', ['security hub']),
  t('Azure Policy'), t('CSPM'), t('CNAPP'), t('CWPP'), t('CIEM'),
  // Data protection
  t('DLP', ['data loss prevention'], true), t('Microsoft Purview', ['purview']),
  t('Varonis'), t('Netwrix'), t('BitLocker'), t('PKI'), t('HSM'),
  t('Proofpoint'), t('Mimecast'), t('Abnormal Security'),
  // Dev / scripting
  t('Python'), t('PowerShell'), t('Bash'), t('Go', ['golang'], true),
  t('JavaScript'), t('TypeScript'), t('Java', [], true), t('C#'), t('C++'),
  t('SQL'), t('KQL', ['kusto query language']), t('SPL', ['search processing language'], true),
  t('Regex'), t('Git'), t('GitHub Actions'), t('GitLab CI'), t('Jenkins'),
  t('Terraform Cloud'), t('Linux'), t('Windows Server'), t('macOS'),
  // GRC platforms
  t('ServiceNow'), t('Archer'), t('OneTrust'), t('Vanta'), t('Drata'),
  t('LogicGate'), t('AuditBoard'), t('Jira'), t('Confluence'),
  // Frameworks (also treated as skills)
  t('MITRE ATT&CK', ['mitre attack', "att&ck"]),
  t('NIST CSF', ['nist cybersecurity framework']),
  t('NIST 800-53', ['800-53']), t('NIST 800-171', ['800-171']),
  t('ISO 27001', ['iso/iec 27001', 'iso27001']), t('ISO 27002'), t('ISO 27005'),
  t('SOC 2', ['soc2', 'soc ii']), t('PCI DSS', ['pci-dss', 'pci']),
  t('HIPAA'), t('GDPR'), t('PIPEDA'), t('PHIPA'),
  t('CIS Controls', ['cis benchmarks', 'cis top 18']),
  t('COBIT'), t('ITSG-33', ['itsg 33']), t('CCCS', ['canadian centre for cyber security']),
  t('OSFI B-13', ['osfi b13']), t('Bill C-26'), t('Law 25', ['quebec law 25']),
  t('OWASP Top 10', ['owasp']), t('SABSA'), t('Zero Trust'),
  t('Threat Modeling', ['threat modelling', 'stride']),
  t('Cyber Kill Chain', ['kill chain']),
];

/* ------------------------------------------------------------------ */
/* Soft / functional skills worth surfacing                            */
/* ------------------------------------------------------------------ */

export const SKILLS: Term[] = [
  t('Incident Response', ['incident handling', 'ir process']),
  t('Threat Hunting', ['threat-hunting']),
  t('Threat Intelligence', ['cti', 'cyber threat intelligence']),
  t('Malware Analysis', ['reverse engineering malware']),
  t('Digital Forensics', ['computer forensics', 'forensic analysis']),
  t('Log Analysis'),
  t('Alert Triage', ['triage']),
  t('Vulnerability Assessment', ['vulnerability scanning']),
  t('Patch Management'),
  t('Penetration Testing', ['pen testing', 'pentesting', 'ethical hacking']),
  t('Red Teaming', ['red team']),
  t('Purple Teaming', ['purple team']),
  t('Blue Teaming', ['blue team']),
  t('Risk Assessment', ['risk analysis', 'risk management']),
  t('Security Audit', ['auditing', 'audit support']),
  t('Compliance Management', ['regulatory compliance']),
  t('Policy Development', ['security policy']),
  t('Security Awareness Training', ['phishing simulation', 'awareness training']),
  t('Vendor Risk Management', ['third-party risk', 'tprm']),
  t('Business Continuity', ['bcp', 'disaster recovery', 'dr planning']),
  t('Identity Governance', ['iga', 'access reviews', 'access certification']),
  t('Privileged Access Management', ['pam']),
  t('Network Security Monitoring', ['nsm']),
  t('Firewall Management', ['firewall administration', 'firewall rules']),
  t('Cloud Security Posture Management'),
  t('Secure Code Review', ['code review']),
  t('Secure SDLC', ['ssdlc', 'sdlc security']),
  t('CI/CD Security', ['pipeline security']),
  t('Infrastructure as Code', ['iac']),
  t('Container Security'),
  t('Data Classification'),
  t('Encryption', ['cryptography']),
  t('Security Architecture'),
  t('Detection Engineering', ['detection rules', 'sigma rules', 'use case development']),
  t('Playbook Development', ['runbook']),
  t('Automation', ['scripting', 'security automation']),
  t('Ticketing', ['service desk', 'incident tickets']),
  t('Documentation'),
  t('Stakeholder Management'),
  t('Bilingual (English/French)', ['bilingual', 'french and english', 'français']),
  t('Security Clearance', ['secret clearance', 'enhanced reliability', 'top secret clearance', 'nato secret']),
  t('On-call Rotation', ['on call', 'shift work', 'rotating shifts', '24/7 soc']),
];

/* ------------------------------------------------------------------ */
/* Category classification                                             */
/* ------------------------------------------------------------------ */

interface CategoryRule {
  category: JobCategory;
  /** Matched against the title — heavily weighted. */
  title: RegExp;
  /** Matched against title + description — lightly weighted. */
  body?: RegExp;
  weight?: number;
}

export const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'soc_analysis',
    title: /\b(soc|security operations?(\s+cent(re|er))?|cyber\s*defen[cs]e)\b.*\b(analyst|specialist|technician|associate)\b|\b(security|cyber\s*security|cybersecurity|information security|infosec)\s+analyst\b|\bsoc\s*(i{1,3}|[123])\b/i,
    body: /\b(tier\s*[123]|alert triage|siem|24x7|24\/7|monitoring and analysis)\b/i,
  },
  {
    category: 'incident_response',
    title: /\b(incident\s+(response|responder|handler|manager|commander)|csirt|cirt|cyber\s+incident)\b/i,
    body: /\b(incident response|containment and eradication|post-incident|breach response)\b/i,
  },
  {
    category: 'threat_intelligence',
    title: /\b(threat\s+(intel(ligence)?|research(er)?|hunt(er|ing))|cti|intelligence analyst)\b/i,
    body: /\b(threat intelligence|ioc|iocs|threat actor|dark web|osint)\b/i,
  },
  {
    category: 'dfir',
    title: /\b(forensic\w*|dfir|e-?discovery|malware\s+(analyst|analysis|research))\b/i,
    body: /\b(digital forensics|memory forensics|chain of custody|reverse engineering)\b/i,
  },
  {
    category: 'vulnerability_management',
    title: /\b(vulnerability|vuln)\s*(management|analyst|engineer|specialist|assessment)\b|\battack surface\b/i,
    body: /\b(vulnerability management|cvss|patch management|remediation sla)\b/i,
  },
  {
    category: 'penetration_testing',
    title: /\b(penetration\s+test\w*|pen\s*test\w*|pentester|red\s+team\w*|offensive security|ethical hacker|adversary emulation|exploit developer)\b/i,
    body: /\b(penetration testing|red team|oscp|burp suite|cobalt strike)\b/i,
  },
  {
    category: 'grc',
    title: /\b(grc|governance|risk (and|&) compliance|compliance|audit(or)?|risk analyst|risk manager|isso|iso\s*27001|third[- ]party risk|controls? (analyst|assurance)|cyber risk)\b/i,
    body: /\b(soc 2|iso 27001|nist 800-53|risk register|control testing|audit evidence)\b/i,
  },
  {
    category: 'iam_pam',
    title: /\b(iam|identity(\s+and\s+access)?|access management|pam|privileged access|directory services|okta|entra|sailpoint|cyberark)\b/i,
    body: /\b(identity and access management|provisioning|deprovisioning|sso|saml|scim|role-based access)\b/i,
  },
  {
    category: 'cloud_security',
    title: /\b(cloud\s+security|aws\s+security|azure\s+security|gcp\s+security|cspm|cnapp)\b/i,
    body: /\b(cloud security posture|guardduty|security hub|wiz|prisma cloud|cloud workload protection)\b/i,
  },
  {
    category: 'application_security',
    title: /\b(app(lication)?\s*sec(urity)?|appsec|product security|software security|secure code|api security)\b/i,
    body: /\b(sast|dast|owasp top 10|secure code review|threat modeling|bug bounty)\b/i,
  },
  {
    category: 'network_security',
    title: /\b(network\s+security|firewall|perimeter security|network security engineer)\b/i,
    body: /\b(firewall rules|ids\/ips|palo alto|fortigate|network segmentation)\b/i,
  },
  {
    category: 'devsecops',
    title: /\b(devsecops|dev\s*sec\s*ops|platform security|security automation engineer)\b/i,
    body: /\b(ci\/cd security|shift left|pipeline security|infrastructure as code security)\b/i,
  },
  {
    category: 'security_architecture',
    title: /\b(security\s+architect(ure)?|cyber\s+architect|enterprise security architect|zero trust architect)\b/i,
    body: /\b(reference architecture|security design patterns|zero trust architecture)\b/i,
  },
  {
    category: 'ot_ics_security',
    title: /\b(ot\s+security|ics\s+security|scada|operational technology|industrial control)\b/i,
    body: /\b(iec 62443|purdue model|scada|plc|ot network)\b/i,
  },
  {
    category: 'privacy_data_protection',
    title: /\b(privacy|data protection|data governance|dpo)\b/i,
    body: /\b(pipeda|gdpr|phipa|privacy impact assessment|pia)\b/i,
  },
  {
    category: 'security_engineering',
    title: /\b(security\s+engineer(ing)?|cyber\s*security\s+engineer|infosec engineer|detection engineer|siem engineer|security developer)\b/i,
    body: /\b(build and maintain security|detection engineering|security tooling)\b/i,
  },
  {
    category: 'security_administration',
    title: /\b(security\s+(administrator|admin|technician|officer|coordinator|consultant|specialist)|cyber\s*security\s+(administrator|specialist|consultant))\b/i,
    body: /\b(administer security tools|manage endpoint protection)\b/i,
  },
  {
    category: 'security_leadership',
    title: /\b(ciso|chief information security|head of (cyber|information )?security|director,?\s+(of\s+)?(cyber|information )?security|vp,?\s+(of\s+)?security|security\s+(manager|director|lead)|manager,?\s+(cyber|information )?security)\b/i,
  },
  {
    category: 'security_sales_engineering',
    title: /\b(security\s+(sales|solutions?|pre-?sales)\s+engineer|solutions? architect,?\s+security|security consultant,? presales)\b/i,
  },
  {
    category: 'adjacent_it',
    title: /\b(help\s*desk|service\s*desk|desktop support|technical support|it support|noc|network operations?|systems? (administrator|analyst|engineer)|sysadmin|network (administrator|analyst|engineer|technician)|cloud (engineer|administrator|analyst)|infrastructure (analyst|engineer|specialist)|it (analyst|technician|specialist|generalist)|devops engineer|site reliability|database administrator|it operations)\b/i,
  },
];

/**
 * Strong security signals — presence in the title is near-certain evidence
 * the posting is a cybersecurity role.
 */
export const SECURITY_TITLE_SIGNALS =
  /\b(cyber\s*-?\s*security|cybersecurity|information security|infosec|it security|security|soc|siem|grc|iam|pam|dfir|appsec|devsecops|pentest\w*|penetration test\w*|red team|blue team|purple team|threat|vulnerabilit\w+|forensic\w*|cryptograph\w+|ciso|privacy|compliance|risk)\b/i;

/**
 * Titles that contain the word "security" but are physical-security / guard roles.
 * These must be excluded aggressively — Job Bank in particular is full of them.
 */
export const PHYSICAL_SECURITY_EXCLUSIONS =
  /\b(security guard|guard,|loss prevention|door\s*(person|staff)|bouncer|concierge|patrol(ler|ling)?\s*(officer|guard)?|mobile patrol|alarm response|crossing guard|correctional|armoured car|armored car|store detective|asset protection (associate|officer)|security screening officer|cctv operator(?!.*analyst)|gate\s*house|site security officer|security supervisor,? (retail|mall|hospital|site)|fire\s*watch|protection officer|commissionaire)\b/i;

/**
 * Non-technical roles that merely mention security. Excluded unless a strong
 * technical signal is also present.
 */
export const NON_TECHNICAL_EXCLUSIONS =
  /\b(social (worker|security)|food security|job security|security deposit|securities (trading|analyst|lawyer)|financial securities|insurance broker|life insurance|security systems installer|alarm installer|locksmith|welder|driver|nurse|caregiver|cook|cashier|cleaner|janitor|warehouse|forklift|truck driver|labourer|laborer|farm worker|receptionist)\b/i;

export const CYBER_QUERY_TERMS = [
  'cyber security',
  'cybersecurity',
  'information security',
  'security analyst',
  'security engineer',
  'soc analyst',
  'incident response',
  'threat intelligence',
  'penetration tester',
  'vulnerability management',
  'security operations',
  'grc analyst',
  'identity and access management',
  'cloud security',
  'application security',
  'devsecops',
  'security architect',
  'digital forensics',
  'it security',
  'network security',
];

/** Adjacent-role search terms used for the "pathway into cyber" bucket. */
export const PATHWAY_QUERY_TERMS = [
  'it support specialist',
  'service desk analyst',
  'network operations centre analyst',
  'systems administrator',
  'network administrator',
  'cloud engineer',
  'infrastructure analyst',
  'devops engineer',
  'it analyst',
];
