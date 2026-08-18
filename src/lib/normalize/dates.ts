const MONTHS: Record<string, number> = {
  january: 0, jan: 0, février: 1, february: 1, feb: 1, fevrier: 1, janvier: 0,
  march: 2, mar: 2, mars: 2, april: 3, apr: 3, avril: 3,
  may: 4, mai: 4, june: 5, jun: 5, juin: 5, july: 6, jul: 6, juillet: 6,
  august: 7, aug: 7, août: 7, aout: 7, september: 8, sep: 8, sept: 8, septembre: 8,
  october: 9, oct: 9, octobre: 9, november: 10, nov: 10, novembre: 10,
  december: 11, dec: 11, décembre: 11, decembre: 11,
};

export function toIso(value: unknown): string | null {
  if (value == null) return null;

  if (typeof value === 'number') {
    // Heuristic: seconds vs milliseconds.
    const ms = value > 1e12 ? value : value * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const s = String(value).trim();
  if (!s) return null;

  // Pure numeric string (epoch).
  if (/^\d{10}$/.test(s)) return new Date(Number(s) * 1000).toISOString();
  if (/^\d{13}$/.test(s)) return new Date(Number(s)).toISOString();

  const direct = new Date(s);
  if (!Number.isNaN(direct.getTime()) && /\d{4}/.test(s)) return direct.toISOString();

  // "August 13, 2026" / "13 August 2026"
  const m1 = /([a-zéûôàç]+)\s+(\d{1,2}),?\s+(\d{4})/i.exec(s);
  if (m1) {
    const mon = MONTHS[m1[1].toLowerCase()];
    if (mon != null) return new Date(Date.UTC(Number(m1[3]), mon, Number(m1[2]))).toISOString();
  }
  const m2 = /(\d{1,2})\s+([a-zéûôàç]+)\.?,?\s+(\d{4})/i.exec(s);
  if (m2) {
    const mon = MONTHS[m2[2].toLowerCase()];
    if (mon != null) return new Date(Date.UTC(Number(m2[3]), mon, Number(m2[1]))).toISOString();
  }

  // Relative: "3 days ago", "Posted 5 hours ago", "il y a 2 jours"
  const rel = /(\d+)\s*(minute|hour|day|week|month|jour|heure|semaine|mois)s?\s*(ago)?/i.exec(s);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase();
    const now = Date.now();
    const factor: Record<string, number> = {
      minute: 60_000, heure: 60 * 60_000, hour: 60 * 60_000,
      day: 86_400_000, jour: 86_400_000,
      week: 7 * 86_400_000, semaine: 7 * 86_400_000,
      month: 30 * 86_400_000, mois: 30 * 86_400_000,
    };
    const f = factor[unit];
    if (f) return new Date(now - n * f).toISOString();
  }

  if (/\b(today|aujourd)/i.test(s)) return new Date().toISOString();
  if (/\byesterday|hier\b/i.test(s)) return new Date(Date.now() - 86_400_000).toISOString();

  return null;
}

export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

export function relativeTime(iso: string | null): string {
  const d = daysSince(iso);
  if (d == null) return 'Date unknown';
  if (d <= 0) {
    const hours = Math.floor((Date.now() - Date.parse(iso!)) / 3_600_000);
    if (hours <= 1) return 'Just posted';
    return `${hours}h ago`;
  }
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  if (d < 14) return '1 week ago';
  if (d < 31) return `${Math.floor(d / 7)} weeks ago`;
  if (d < 60) return '1 month ago';
  return `${Math.floor(d / 30)} months ago`;
}
