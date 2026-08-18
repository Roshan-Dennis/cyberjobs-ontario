const BLOCK_TAGS = /<\/?(p|div|br|li|ul|ol|h[1-6]|tr|table|section|article|header|footer|blockquote)\b[^>]*>/gi;

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&bull;': '•',
  '&eacute;': 'é',
  '&egrave;': 'è',
  '&agrave;': 'à',
  '&ccedil;': 'ç',
};

export function decodeEntities(input: string): string {
  let out = input;
  for (const [k, v] of Object.entries(ENTITIES)) out = out.split(k).join(v);
  out = out.replace(/&#(\d+);/g, (_, d: string) => {
    const code = Number.parseInt(d, 10);
    return Number.isFinite(code) && code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : '';
  });
  out = out.replace(/&#x([0-9a-f]+);/gi, (_, h: string) => {
    const code = Number.parseInt(h, 16);
    return Number.isFinite(code) && code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : '';
  });
  return out;
}

/** Convert an HTML description to readable plain text with preserved line breaks. */
export function htmlToText(html: string): string {
  if (!html) return '';
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<li\b[^>]*>/gi, '\n• ')
      .replace(BLOCK_TAGS, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/g, '')
    .split('\n')
    .map((l) => l.trim())
    .join('\n');
}

const ALLOWED_TAGS = new Set([
  'p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'blockquote', 'code', 'pre', 'hr', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
]);

/**
 * Conservative HTML sanitiser for rendering third-party job descriptions.
 * Drops every tag not in the allow-list, every attribute except safe hrefs,
 * and any javascript:/data: URL.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  let out = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<(object|embed|form|input|button|link|meta|base)\b[^>]*>/gi, '');

  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, tag: string, attrs: string) => {
    const name = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return '';
    if (match.startsWith('</')) return `</${name}>`;
    if (name === 'a') {
      const href = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
      const url = (href?.[2] ?? href?.[3] ?? href?.[4] ?? '').trim();
      if (!/^https?:\/\//i.test(url)) return '<a>';
      const safe = url.replace(/"/g, '&quot;');
      return `<a href="${safe}" target="_blank" rel="nofollow noopener noreferrer">`;
    }
    return `<${name}>`;
  });

  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/** First ~2 sentences / 280 chars of the description, for the job card. */
export function summarize(text: string, maxLen = 280): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const cut = clean.slice(0, maxLen);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (lastStop > maxLen * 0.5) return cut.slice(0, lastStop + 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}
