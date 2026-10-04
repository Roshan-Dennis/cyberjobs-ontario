'use client';

import { useState, type CSSProperties } from 'react';
import { companyKey } from '@/lib/normalize/companyKey';
import { COMPANY_DOMAINS } from '@/lib/companyDomains';

/**
 * Company avatar: a real logo when the employer is on the verified domain
 * list, initials on a deterministic tint otherwise.
 *
 * The initials fallback (both for unmapped companies and for a logo image
 * that fails to load) was the whole avatar until this change, and the
 * reasoning for it still holds for anything not on the verified list:
 * hotlinking a guessed domain risks showing the WRONG company's logo, which
 * is worse than initials. So this only ever requests an image for a company
 * this code can already name a real domain for — nothing is guessed.
 *
 * The image comes from Google's public favicon service, which needs no API
 * key and no sign-up (the domain map above is what makes this safe — this
 * service will return *something* for almost any domain string, so it is
 * never used to validate a guess, only to fetch the icon for one already
 * confirmed by hand). It returns a small icon, not a full logo — noticeably
 * lower-resolution than a dedicated logo API, but it works today with zero
 * setup. A higher-resolution option (Logo.dev) exists but needs a free
 * account and a publishable API key only the site owner can create; this
 * can switch to it later by adding that key as a repository variable.
 */

/** Tints sit at similar lightness so no single card shouts louder than another. */
const TINTS: { bg: string; fg: string; fgDark: string }[] = [
  { bg: '34 211 238', fg: '14 116 144', fgDark: '103 232 249' },
  { bg: '129 140 248', fg: '67 56 202', fgDark: '165 180 252' },
  { bg: '52 211 153', fg: '4 120 87', fgDark: '110 231 183' },
  { bg: '251 191 36', fg: '146 64 14', fgDark: '253 224 71' },
  { bg: '244 114 182', fg: '157 23 77', fgDark: '249 168 212' },
  { bg: '148 163 184', fg: '51 65 85', fgDark: '203 213 225' },
];

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** "Arctic Wolf Networks" -> "AW", "Cohere" -> "CO". */
export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !/^(inc|ltd|llc|corp|the|of|and)$/i.test(w));
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2);
  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`;
}

function InitialsAvatar({ company, className }: { company: string; className: string }) {
  const tint = TINTS[hash(company) % TINTS.length];
  const style = {
    '--a-bg': tint.bg,
    '--a-fg': tint.fg,
    '--a-fg-dark': tint.fgDark,
  } as CSSProperties;
  return (
    <span className={`avatar ${className}`} style={style} aria-hidden>
      {initials(company)}
    </span>
  );
}

export function CompanyAvatar({ company, className = '' }: { company: string; className?: string }) {
  const domain = COMPANY_DOMAINS[companyKey(company)];
  const [failed, setFailed] = useState(false);

  if (!domain || failed) {
    return <InitialsAvatar company={company} className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- external favicon URL, not a local asset next/image can optimise
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`}
      alt=""
      aria-hidden
      className={`avatar bg-surface2 object-contain p-1.5 ring-1 ring-inset ring-line ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
