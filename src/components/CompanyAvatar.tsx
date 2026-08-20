import type { CSSProperties } from 'react';

/**
 * Company avatar placeholder.
 *
 * Real logos would mean hotlinking third-party assets from a static site with
 * no image proxy — slow, fragile, and a privacy leak for visitors. Initials on
 * a deterministic tint give the eye the same scanning anchor at zero cost, and
 * the same employer always renders the same colour, so repeat companies become
 * recognisable down a long list.
 *
 * Each tint carries a light and a dark foreground; `globals.css` picks between
 * them so contrast holds in both themes.
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

export function CompanyAvatar({ company, className = '' }: { company: string; className?: string }) {
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
