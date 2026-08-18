import type { SalaryInfo } from '@/lib/types';

const EMPTY: SalaryInfo = {
  min: null, max: null, currency: null, period: null,
  annualMin: null, annualMax: null, raw: null,
};

const PERIOD_MULTIPLIER: Record<string, number> = {
  hour: 2080,
  hourly: 2080,
  heure: 2080,
  day: 260,
  daily: 260,
  week: 52,
  weekly: 52,
  biweekly: 26,
  month: 12,
  monthly: 12,
  mois: 12,
  year: 1,
  yearly: 1,
  annual: 1,
  annually: 1,
  an: 1,
  annee: 1,
};

function detectPeriod(text: string): string | null {
  const t = text.toLowerCase();
  if (/\b(per|\/|an )?\s*hour|hourly|\/hr|\/h\b|per hour|de l'heure|horaire/.test(t)) return 'hour';
  if (/\bper\s*day|\/day|daily|per diem\b/.test(t)) return 'day';
  if (/\bper\s*week|\/week|weekly|hebdomadaire\b/.test(t)) return 'week';
  if (/\bbi-?weekly|every two weeks\b/.test(t)) return 'biweekly';
  if (/\bper\s*month|\/month|monthly|mensuel|par mois\b/.test(t)) return 'month';
  if (/\bper\s*(year|annum)|\/year|\/yr|annually|annual|yearly|par an|annuel\b/.test(t)) return 'year';
  return null;
}

function detectCurrency(text: string): string | null {
  const t = text.toUpperCase();
  if (/\bCAD\b|\bC\$/.test(t)) return 'CAD';
  if (/\bUSD\b|\bUS\$/.test(t)) return 'USD';
  if (/\bEUR\b|€/.test(t)) return 'EUR';
  if (/\bGBP\b|£/.test(t)) return 'GBP';
  if (/\$/.test(t)) return 'CAD';
  return null;
}

function toNumber(token: string): number | null {
  const cleaned = token.replace(/[,\s ']/g, '').replace(/[^0-9.kK]/g, '');
  if (!cleaned) return null;
  const isK = /[kK]$/.test(cleaned);
  const n = Number.parseFloat(cleaned.replace(/[kK]$/, ''));
  if (!Number.isFinite(n)) return null;
  return isK ? n * 1000 : n;
}

const AMOUNT = String.raw`\$?\s?\d{1,3}(?:[,\s ']\d{3})*(?:\.\d{1,2})?[kK]?|\$?\s?\d+(?:\.\d{1,2})?[kK]?`;
const RANGE_RE = new RegExp(String.raw`(${AMOUNT})\s*(?:-|–|—|to|à|and)\s*(${AMOUNT})`, 'i');
const SINGLE_RE = new RegExp(String.raw`(?:\$|CAD|USD)\s?(${AMOUNT})`, 'i');

/**
 * Parse a free-text salary string. Returns nulls rather than guessing when
 * the text is ambiguous — a wrong salary is worse than no salary.
 */
export function parseSalary(raw: string | null | undefined, contextText = ''): SalaryInfo {
  const text = (raw ?? '').trim();
  if (!text) return { ...EMPTY };

  const haystack = `${text} ${contextText.slice(0, 400)}`;
  let period = detectPeriod(haystack);
  const currency = detectCurrency(haystack) ?? 'CAD';

  let min: number | null = null;
  let max: number | null = null;

  const range = RANGE_RE.exec(text);
  if (range) {
    min = toNumber(range[1]);
    max = toNumber(range[2]);
  } else {
    const single = SINGLE_RE.exec(text);
    if (single) min = toNumber(single[1]);
  }

  if (min == null && max == null) return { ...EMPTY, raw: text, currency: null };
  if (min != null && max != null && min > max) [min, max] = [max, min];

  // Infer the period from magnitude when the text does not say.
  const probe = max ?? min ?? 0;
  if (!period) {
    if (probe > 0 && probe < 200) period = 'hour';
    else if (probe >= 200 && probe < 3000) period = 'week';
    else if (probe >= 3000 && probe < 25000) period = 'month';
    else period = 'year';
  }

  // Reject nonsense.
  if (probe <= 0 || probe > 10_000_000) return { ...EMPTY, raw: text };

  const mult = PERIOD_MULTIPLIER[period] ?? 1;
  const annualMin = min != null ? Math.round(min * mult) : null;
  const annualMax = max != null ? Math.round(max * mult) : null;

  return { min, max, currency, period, annualMin, annualMax, raw: text };
}

/** Pull a salary string out of a job description when the source has no field. */
export function findSalaryInText(text: string): string | null {
  if (!text) return null;
  const window = text.slice(0, 12000);
  const patterns = [
    /(?:salary|compensation|pay|base pay|pay range|salary range|compensation range|hiring range|rémunération|salaire)[^\n]{0,60}?(\$[\d,. ]+\s*(?:-|–|to)\s*\$?[\d,. ]+[^\n]{0,40})/i,
    /(\$\s?\d{2,3}(?:[,\s]\d{3})+\s*(?:-|–|to)\s*\$?\s?\d{2,3}(?:[,\s]\d{3})+(?:\s*(?:per|\/)\s*(?:year|annum|hour|hr))?)/i,
    /(\$\s?\d{1,3}(?:\.\d{2})?\s*(?:-|–|to)\s*\$?\s?\d{1,3}(?:\.\d{2})?\s*(?:per hour|\/\s*hour|\/hr|hourly))/i,
  ];
  for (const re of patterns) {
    const m = re.exec(window);
    if (m?.[1]) return m[1].replace(/\s+/g, ' ').trim();
  }
  return null;
}

export function formatSalary(s: SalaryInfo): string | null {
  if (s.min == null && s.max == null) return null;
  const cur = s.currency === 'USD' ? 'US$' : '$';
  const fmt = (n: number) =>
    s.period === 'hour'
      ? n.toFixed(2)
      : n >= 1000
        ? n.toLocaleString('en-CA', { maximumFractionDigits: 0 })
        : String(n);
  const unit =
    s.period === 'hour' ? '/hr'
    : s.period === 'day' ? '/day'
    : s.period === 'week' ? '/wk'
    : s.period === 'biweekly' ? '/2wks'
    : s.period === 'month' ? '/mo'
    : '/yr';
  if (s.min != null && s.max != null && s.min !== s.max) return `${cur}${fmt(s.min)} – ${cur}${fmt(s.max)}${unit}`;
  const one = (s.min ?? s.max)!;
  return `${cur}${fmt(one)}${unit}`;
}
