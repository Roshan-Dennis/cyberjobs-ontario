/**
 * Pure string functions for normalising an employer name, with no server-only
 * dependency — unlike the rest of dedupe.ts, which imports node:crypto for
 * fingerprint hashing. Keeping these here (and having dedupe.ts import them,
 * not the other way around) is what lets a client component like
 * CompanyAvatar use companyKey() without pulling node:crypto into the browser
 * bundle, which webpack cannot handle and fails the build on.
 */

export function slugify(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const COMPANY_SUFFIX =
  /-(inc|llc|ltd|limited|corp|corporation|co|company|group|holdings?|technologies|technology|solutions|services|canada|international|global|plc|gmbh|sa|nv|llp|lp|ulc|srl|pte|bv|ag)$/;

/**
 * Employers that publish the same requisitions under two names. BlackBerry
 * runs a second Workday site for QNX, so every QNX role appeared twice — once
 * as "BlackBerry" and once as "BlackBerry QNX" — and the fingerprint, which
 * includes the employer, could not see they were one job.
 */
const COMPANY_ALIASES: Record<string, string> = {
  'blackberry-qnx': 'blackberry',
  qnx: 'blackberry',
};

/**
 * Reduce an employer name to a comparable key. Legal suffixes are stripped
 * repeatedly, so "Acme Corp", "Acme Corp Inc." and "Acme Corporation Canada"
 * all collapse to "acme".
 */
export function companyKey(company: string): string {
  let key = slugify(company);
  for (let i = 0; i < 4; i += 1) {
    const next = key.replace(COMPANY_SUFFIX, '').replace(/-+$/, '');
    if (next === key || next === '') break;
    key = next;
  }
  return COMPANY_ALIASES[key] ?? key;
}
