/**
 * Turn a free-text location string into a place, a province and a verdict on
 * whether the posting is in scope.
 *
 * Scope is Ontario, Alberta, British Columbia and Quebec, plus roles that are
 * genuinely remote-anywhere-in-Canada. The four provincial gazetteers are data
 * only (`ontario.ts`, `provinces.ts`); everything that decides *what a string
 * means* lives here, so there is exactly one place to fix when it gets it wrong.
 *
 * It has got it wrong before, expensively, which is why the guards below are
 * as blunt as they are. See `FOREIGN_MARKERS` and `AMBIGUOUS_CITIES`.
 */

import { ONTARIO_PLACES } from '@/lib/taxonomy/ontario';
import {
  ALBERTA_PLACES,
  BC_PLACES,
  PROVINCE_NAMES,
  QUEBEC_PLACES,
  type ProvinceCode,
} from '@/lib/taxonomy/provinces';
import type { OntarioPlace } from '@/lib/taxonomy/ontario';

export { PROVINCE_CODES, PROVINCE_NAMES } from '@/lib/taxonomy/provinces';
export type { ProvinceCode } from '@/lib/taxonomy/provinces';

const NORMALIZE_RE = /[^a-z0-9]+/g;

/** Lowercase, strip diacritics and punctuation. "Montréal, QC" -> "montreal qc". */
function key(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(NORMALIZE_RE, ' ').trim();
}

interface IndexEntry {
  place: OntarioPlace;
  province: ProvinceCode;
  needle: string;
}

const PROVINCE_PLACES: [ProvinceCode, OntarioPlace[]][] = [
  ['ON', ONTARIO_PLACES],
  ['AB', ALBERTA_PLACES],
  ['BC', BC_PLACES],
  ['QC', QUEBEC_PLACES],
];

const INDEX: IndexEntry[] = (() => {
  const entries: IndexEntry[] = [];
  for (const [province, places] of PROVINCE_PLACES) {
    for (const place of places) {
      entries.push({ place, province, needle: key(place.name) });
      for (const alias of place.aliases ?? []) entries.push({ place, province, needle: key(alias) });
    }
  }
  // Longest needle first so "sault ste marie" wins over "marie", and
  // "north vancouver" wins over "vancouver".
  return entries.sort((a, b) => b.needle.length - a.needle.length);
})();

export const CANADA_MARKERS = [
  'canada',
  'canadian',
  'ontario',
  'quebec',
  'québec',
  'british columbia',
  'alberta',
  'manitoba',
  'saskatchewan',
  'nova scotia',
  'new brunswick',
  'newfoundland',
  'prince edward island',
  'yukon',
  'nunavut',
  'northwest territories',
];

const CANADA_PROVINCE_CODES = /\b(on|qc|bc|ab|mb|sk|ns|nb|nl|pe|yt|nt|nu)\b/;

/**
 * Written-out province names and codes, for strings that name a province but
 * no city we know ("Remote - Alberta", "BC, Canada").
 */
const PROVINCE_SIGNALS: [ProvinceCode, RegExp][] = [
  ['ON', /\b(ontario|ont|on)\b/],
  ['AB', /\b(alberta|alta|ab)\b/],
  ['BC', /\b(british columbia|colombie britannique|bc)\b/],
  ['QC', /\b(quebec|qc|que)\b/],
];

/**
 * Places outside Canada that a bare Canadian city name would otherwise match.
 *
 * Canada borrows heavily from Britain — London, Cambridge, Windsor, Kingston,
 * Surrey, Richmond — so "London, UK" sailed straight through the gazetteer as
 * London, Ontario. At one point a quarter of the published board was London-UK
 * postings. Any of these markers disqualifies the string unless a Canadian
 * marker also appears.
 */
const FOREIGN_MARKERS =
  /\b(uk|u k|united kingdom|england|scotland|wales|northern ireland|ireland|dublin|berlin|germany|munich|france|paris|netherlands|amsterdam|belgium|brussels|spain|madrid|barcelona|portugal|lisbon|italy|milan|rome|switzerland|zurich|austria|vienna|sweden|stockholm|norway|oslo|denmark|copenhagen|finland|helsinki|poland|warsaw|krakow|czech|prague|romania|bucharest|ukraine|greece|athens|turkey|istanbul|israel|tel aviv|india|bengaluru|bangalore|hyderabad|mumbai|delhi|pune|chennai|noida|gurgaon|gurugram|singapore|malaysia|kuala lumpur|philippines|manila|japan|tokyo|korea|seoul|china|shanghai|beijing|shenzhen|hong kong|taiwan|australia|sydney|melbourne|brisbane|perth au|new zealand|auckland|wellington nz|south africa|johannesburg|cape town|brazil|sao paulo|argentina|buenos aires|chile|santiago|colombia|bogota|mexico|mexico city|guadalajara|costa rica|uae|dubai|abu dhabi|saudi|riyadh|qatar|doha|egypt|cairo|nigeria|lagos|kenya|nairobi)\b/;

/** US signals. Kept separate so the country can be reported accurately. */
const US_MARKERS =
  /\b(united states|usa|u s a|u s |us only|remote us|san francisco|new york|nyc|los angeles|seattle|austin|boston|chicago|denver|atlanta|dallas|houston|miami|phoenix|san diego|san jose|washington dc|bay area|silicon valley)\b/;
const US_STATE_CODES =
  /\b(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)\b/;

/**
 * Canadian city names far better known as somewhere else. These need a positive
 * Canadian signal in the same string before they count.
 *
 * Adding the western provinces made this list matter more, not less: Vancouver
 * is also in Washington State, Victoria is an Australian state, Surrey is an
 * English county, Langley and Richmond are both in Virginia, and Laval is in
 * France. A bare "Surrey" or "Victoria" is a coin flip at best.
 */
const AMBIGUOUS_CITIES = new Set([
  // Ontario
  'london', 'cambridge', 'windsor', 'kingston', 'hamilton', 'waterloo', 'stratford',
  'woodstock', 'newmarket', 'bradford', 'chatham', 'perth', 'sarnia', 'york', 'essex',
  'aurora', 'richmond hill', 'peterborough', 'barrie', 'guelph', 'oxford', 'dublin',
  // British Columbia
  'vancouver', 'victoria', 'surrey', 'richmond', 'langley', 'delta', 'nelson', 'trail',
  'mission', 'hope', 'sidney', 'duncan', 'terrace', 'whistler', 'burnaby',
  // Alberta
  'edmonton', 'banff', 'brooks', 'olds', 'taber', 'hinton', 'camrose',
  // Quebec
  'laval', 'granby', 'magog', 'mirabel', 'delson',
]);

export interface GeoMatch {
  city: string | null;
  region: string | null;
  /** Two-letter code for the province the posting sits in, when known. */
  province: ProvinceCode | null;
  provinceName: string | null;
  country: string | null;
  /** In one of the four covered provinces. */
  isInScope: boolean;
  /** Kept for the Ontario-specific relevance bonus and older records. */
  isOntario: boolean;
  isCanada: boolean;
  isRemote: boolean;
  /** The location field names a place outside Canada and no Canadian one. */
  isForeign: boolean;
}

const REMOTE_RE = /\b(remote|work\s*from\s*home|wfh|telecommute|distributed|anywhere|virtual|t[ée]l[ée]travail|[àa] distance)\b/i;
const HYBRID_RE =
  /\b(hybrid|hybride|flex(ible)?\s*(work|hybrid)|[0-9]\s*days?\s*(in|per week in)\s*(the\s*)?office|partially remote)\b/i;

function empty(isRemote: boolean, over: Partial<GeoMatch> = {}): GeoMatch {
  return {
    city: null,
    region: null,
    province: null,
    provinceName: null,
    country: null,
    isInScope: false,
    isOntario: false,
    isCanada: false,
    isRemote,
    isForeign: false,
    ...over,
  };
}

/**
 * Resolve a free-text location string against the four-province gazetteer.
 * Never throws; returns a best-effort match.
 */
export function matchLocation(raw: string | null | undefined): GeoMatch {
  const text = (raw ?? '').trim();
  const lower = ` ${key(text)} `;
  const isRemote = REMOTE_RE.test(text);

  let city: string | null = null;
  let region: string | null = null;
  let province: ProvinceCode | null = null;

  for (const entry of INDEX) {
    // Word-boundary-ish containment on the normalised string.
    if (lower.includes(` ${entry.needle} `) || lower.includes(` ${entry.needle},`)) {
      city = entry.place.name;
      region = entry.place.region;
      province = entry.province;
      break;
    }
  }

  // Fallback: substring match for longer names (handles "Toronto/Ontario").
  if (!city) {
    for (const entry of INDEX) {
      if (entry.needle.length >= 5 && lower.includes(entry.needle)) {
        city = entry.place.name;
        region = entry.place.region;
        province = entry.province;
        break;
      }
    }
  }

  const namedProvince = PROVINCE_SIGNALS.find(([, re]) => re.test(lower))?.[0] ?? null;
  const mentionsCanada =
    CANADA_MARKERS.some((m) => lower.includes(key(m))) || CANADA_PROVINCE_CODES.test(lower) || namedProvince !== null;

  // A foreign marker beats a city-name match. "London, UK" and
  // "Hybrid - San Francisco, New York City, London, Berlin" both contain a
  // Canadian city name, and neither is in Canada.
  const foreign = FOREIGN_MARKERS.test(lower) || US_MARKERS.test(lower);
  if (foreign && !mentionsCanada) {
    return empty(isRemote, {
      country: US_MARKERS.test(lower) ? 'United States' : null,
      isForeign: true,
    });
  }

  // Borrowed names need corroboration: a bare "Cambridge" is more likely
  // England, and a bare "Vancouver" could be Washington State.
  if (city && !mentionsCanada && AMBIGUOUS_CITIES.has(key(city))) {
    city = null;
    region = null;
    province = null;
  }

  // A city we recognise wins; otherwise fall back to a province named outright.
  const resolved = province ?? namedProvince;
  const isInScope = resolved !== null;
  const isCanada = isInScope || mentionsCanada;

  let country: string | null = null;
  if (isCanada) country = 'Canada';
  else if (US_MARKERS.test(lower) || US_STATE_CODES.test(lower)) country = 'United States';

  return {
    city,
    region,
    province: resolved,
    provinceName: resolved ? PROVINCE_NAMES[resolved] : null,
    country,
    isInScope,
    isOntario: resolved === 'ON',
    isCanada,
    isRemote,
    isForeign: false,
  };
}

export function detectHybrid(text: string): boolean {
  return HYBRID_RE.test(text);
}

export function detectRemote(text: string): boolean {
  return REMOTE_RE.test(text);
}

export const CITY_NAMES = INDEX.filter((e) => key(e.place.name) === e.needle).map((e) => e.place.name);

export function regionForCity(city: string | null): string | null {
  if (!city) return null;
  const needle = key(city);
  return INDEX.find((e) => e.needle === needle)?.place.region ?? null;
}

export function provinceForCity(city: string | null): ProvinceCode | null {
  if (!city) return null;
  const needle = key(city);
  return INDEX.find((e) => e.needle === needle)?.province ?? null;
}
