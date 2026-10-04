/**
 * Turn a free-text location string into a place, a region and a verdict on
 * whether the posting is in scope.
 *
 * Scope is Canada (Ontario, Alberta, British Columbia, Quebec — plus a named
 * province elsewhere, or genuinely remote-anywhere-in-Canada) and the United
 * States (any of the 50 states + DC, or genuinely remote-anywhere-in-the-US).
 * The gazetteers are data only (`ontario.ts`, `provinces.ts`, `states.ts`);
 * everything that decides *what a string means* lives here, so there is
 * exactly one place to fix when it gets it wrong.
 *
 * It has got it wrong before, expensively, which is why the guards below are
 * as blunt as they are. See `FOREIGN_MARKERS` and `AMBIGUOUS_CITIES`. Adding
 * the US did not relax that: a bare "Cambridge" is still ambiguous (Ontario?
 * Massachusetts? England?) and still needs a country or state marker to
 * resolve, the same discipline that governs the Canadian places.
 */

import { ONTARIO_PLACES } from '@/lib/taxonomy/ontario';
import {
  ALBERTA_PLACES,
  BC_PLACES,
  PROVINCE_NAMES,
  QUEBEC_PLACES,
  type ProvinceCode,
} from '@/lib/taxonomy/provinces';
import { US_PLACES, US_STATE_CODES, US_STATE_NAMES, type USStateCode } from '@/lib/taxonomy/states';
import type { OntarioPlace } from '@/lib/taxonomy/ontario';

export { PROVINCE_CODES, PROVINCE_NAMES } from '@/lib/taxonomy/provinces';
export type { ProvinceCode } from '@/lib/taxonomy/provinces';
export { US_STATE_CODES, US_STATE_NAMES } from '@/lib/taxonomy/states';
export type { USStateCode } from '@/lib/taxonomy/states';

/** A region code is a Canadian province or a US state, never ambiguous between
 * the two: the four province codes (ON/AB/BC/QC) and the fifty-one US codes
 * share no letters in common. */
export type RegionCode = ProvinceCode | USStateCode;

const NORMALIZE_RE = /[^a-z0-9]+/g;

/** Lowercase, strip diacritics and punctuation. "Montréal, QC" -> "montreal qc". */
function key(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(NORMALIZE_RE, ' ').trim();
}

interface IndexEntry {
  place: OntarioPlace;
  country: 'Canada' | 'United States';
  region: RegionCode;
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
      entries.push({ place, country: 'Canada', region: province, needle: key(place.name) });
      for (const alias of place.aliases ?? []) entries.push({ place, country: 'Canada', region: province, needle: key(alias) });
    }
  }
  for (const place of US_PLACES) {
    entries.push({ place, country: 'United States', region: place.state, needle: key(place.name) });
    for (const alias of place.aliases ?? []) entries.push({ place, country: 'United States', region: place.state, needle: key(alias) });
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

/** Every two-letter US state code, as a word-boundary alternation. Built once. */
const US_STATE_CODE_RE = new RegExp(`\\b(${US_STATE_CODES.map((c) => c.toLowerCase()).join('|')})\\b`);

/**
 * Written-out US state names, for strings that name a state but no city we
 * know ("Remote - Texas", "CA, USA"). Built from the full state list so
 * every state has a signal even though only some have gazetteer cities.
 */
// Sorted longest state name first: "Virginia" is a literal substring of
// "West Virginia" (and "New York" of nothing else here, but the same risk
// applies generally), so searching shortest-first let "West Virginia" match
// Virginia's regex before ever reaching its own — a real bug caught by
// testing that every state resolves by its own name.
const STATE_SIGNALS: [USStateCode, RegExp][] = US_STATE_CODES.map((code) => {
  const name = US_STATE_NAMES[code].toLowerCase();
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [code, new RegExp(`\\b(${escaped}|${code.toLowerCase()})\\b`)] as [USStateCode, RegExp];
}).sort((a, b) => US_STATE_NAMES[b[0]].length - US_STATE_NAMES[a[0]].length);

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

/**
 * US signals: the United States is in scope now, so these no longer disqualify
 * a posting the way FOREIGN_MARKERS do — they instead confirm the country when
 * a US state or city has been matched, and resolve a named-but-cityless state
 * ("Remote - Texas").
 */
const US_MARKERS = /\b(united states|usa|u s a|u s |us only|remote us|us-based)\b/;

/**
 * City names far better known as somewhere else — within Canada, within the
 * US, or across the border. These need a positive signal (country, province
 * or state) in the same string before they count.
 *
 * Adding the US made this matter far more: Cambridge is Ontario, England and
 * Massachusetts; Portland is Oregon and Maine; Richmond is BC and Virginia;
 * Columbus is Ohio and a dozen smaller towns. A bare mention of any of these
 * resolves to nothing rather than guessing.
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
  // United States — names shared with a Canadian place above, or well-known
  // elsewhere, need their own state or country marker to resolve.
  'portland', 'columbus', 'arlington', 'alexandria', 'fairfax', 'vienna', 'providence',
  // Burlington, Ontario (GTA) and Burlington, Massachusetts were already both
  // in the gazetteer without this guard — a latent bug, now fixed, that would
  // have let a bare "Burlington" always resolve to Ontario regardless of
  // which one a posting meant. Burlington, Vermont makes it a three-way tie.
  'burlington',
  // Charleston (SC and WV) and Columbia (MD and SC, now also the South
  // Carolina capital) are each two real US places sharing one name.
  'charleston', 'columbia',
  // Manchester and Birmingham are state capitals/major cities here (NH, AL)
  // and also major UK cities this gazetteer does not otherwise list — a bare
  // mention should not quietly become New Hampshire or Alabama.
  'manchester', 'birmingham',
]);

export interface GeoMatch {
  city: string | null;
  region: string | null;
  /** Two-letter province or state code the posting sits in, when known. */
  province: RegionCode | null;
  provinceName: string | null;
  /** 'Canada' | 'United States', when known. */
  country: string | null;
  /** In Canada or the United States — a covered province/state, or a named one. */
  isInScope: boolean;
  /** Kept for the Ontario-specific relevance bonus and older records. */
  isOntario: boolean;
  isCanada: boolean;
  /** Mirrors isCanada, for the symmetric US relevance bonus. */
  isUnitedStates: boolean;
  isRemote: boolean;
  /** The location field names a place outside North America and nothing in scope. */
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
    isUnitedStates: false,
    isRemote,
    isForeign: false,
    ...over,
  };
}

/**
 * Resolve a free-text location string against the Canada + US gazetteer.
 * Never throws; returns a best-effort match.
 */
export function matchLocation(raw: string | null | undefined): GeoMatch {
  const text = (raw ?? '').trim();
  const lower = ` ${key(text)} `;
  const isRemote = REMOTE_RE.test(text);

  let city: string | null = null;
  let region: string | null = null;
  let matchCountry: 'Canada' | 'United States' | null = null;
  let matchRegion: RegionCode | null = null;

  // Computed before the city match (not after, as earlier versions of this
  // function had it): several city names exist in more than one state or
  // province — Charleston is SC and WV, Columbia is MD and SC — and an
  // explicit code in the string is the tie-breaker. Finding it first lets the
  // city loop below prefer the entry whose region actually matches.
  const namedProvince = PROVINCE_SIGNALS.find(([, re]) => re.test(lower))?.[0] ?? null;
  const namedState = STATE_SIGNALS.find(([, re]) => re.test(lower))?.[0] ?? null;
  const explicitRegion: RegionCode | null = namedProvince ?? namedState;

  /**
   * Among entries whose needle matches, prefer one whose region agrees with
   * an explicit code already found in the string; otherwise the first (index
   * order — longest needle first, Canada before US at equal length).
   */
  function pick(candidates: IndexEntry[]): IndexEntry | null {
    if (candidates.length === 0) return null;
    if (explicitRegion) {
      const agree = candidates.find((c) => c.region === explicitRegion);
      if (agree) return agree;
    }
    return candidates[0];
  }

  // "Washington State" is unambiguous — nobody ever means DC by it — unlike a
  // bare "Washington", which more often does mean DC in real postings. The
  // gazetteer's Washington-DC entry would otherwise shadow it the same way,
  // since "Washington" is a literal prefix of "Washington State".
  const isWashingtonState = /\bwashington state\b/.test(lower);
  const indexForCity = isWashingtonState ? INDEX.filter((e) => !(e.place.name === 'Washington' && e.region === 'DC')) : INDEX;

  {
    const exact = indexForCity.filter((e) => lower.includes(` ${e.needle} `) || lower.includes(` ${e.needle},`));
    const found = pick(exact);
    if (found) {
      city = found.place.name;
      region = found.place.region;
      matchCountry = found.country;
      matchRegion = found.region;
    }
  }

  // Fallback: substring match for longer names (handles "Toronto/Ontario").
  if (!city) {
    const sub = indexForCity.filter((e) => e.needle.length >= 5 && lower.includes(e.needle));
    const found = pick(sub);
    if (found) {
      city = found.place.name;
      region = found.place.region;
      matchCountry = found.country;
      matchRegion = found.region;
    }
  }
  const mentionsCanada =
    CANADA_MARKERS.some((m) => lower.includes(key(m))) || CANADA_PROVINCE_CODES.test(lower) || namedProvince !== null;
  const mentionsUS = US_MARKERS.test(lower) || namedState !== null || US_STATE_CODE_RE.test(lower);
  const mentionsEitherCountry = mentionsCanada || mentionsUS;

  // A foreign marker beats a city-name match — "London, UK" is not Ontario —
  // and it takes more than a borrowed state name to argue it back in. Several
  // US state names double as city names (New York, Washington, Georgia), so
  // "New York City" alone would otherwise "mention" New York State and
  // rescue a string that also says "Berlin". Overriding the foreign marker
  // needs an explicit top-level country word or a province/state CODE
  // ("ON", "TX") — signals too deliberate to appear by coincidence — not a
  // bare province/state name, which a city match already supplies on its own
  // merits via AMBIGUOUS_CITIES/matchCountry below.
  const explicitCountrySignal =
    CANADA_MARKERS.some((m) => lower.includes(key(m))) || CANADA_PROVINCE_CODES.test(lower) || US_MARKERS.test(lower) || US_STATE_CODE_RE.test(lower);
  // "New Mexico" contains "mexico" as a literal substring with its own word
  // boundaries, so the foreign-country marker for Mexico the country would
  // otherwise fire on the New Mexico state name. This is the one marker that
  // needs the exclusion — no other FOREIGN_MARKERS entry is also a US state
  // name's tail.
  const isActuallyNewMexico = /\bnew mexico\b/.test(lower);
  if (FOREIGN_MARKERS.test(lower) && !explicitCountrySignal && !isActuallyNewMexico) {
    return empty(isRemote, { isForeign: true });
  }

  // Borrowed names need corroboration: a bare "Cambridge" is more likely
  // England, and a bare "Portland" could be Maine when the match was Oregon.
  if (city && !mentionsEitherCountry && AMBIGUOUS_CITIES.has(key(city))) {
    city = null;
    region = null;
    matchCountry = null;
    matchRegion = null;
  }
  // A matched US city needs a US signal (or at minimum no competing Canadian
  // one) and vice versa — "Cambridge, Ontario" must not resolve to
  // Massachusetts just because Cambridge MA sorts first in the index.
  if (city && matchCountry === 'United States' && mentionsCanada && !mentionsUS) {
    city = null;
    region = null;
    matchCountry = null;
    matchRegion = null;
  }
  if (city && matchCountry === 'Canada' && mentionsUS && !mentionsCanada) {
    city = null;
    region = null;
    matchCountry = null;
    matchRegion = null;
  }

  // A city we recognise wins; otherwise fall back to a province/state named outright.
  const resolvedRegion: RegionCode | null = matchRegion ?? namedProvince ?? namedState;
  const resolvedCountry: 'Canada' | 'United States' | null =
    matchCountry ?? (namedProvince ? 'Canada' : namedState ? 'United States' : mentionsCanada ? 'Canada' : mentionsUS ? 'United States' : null);
  // In scope means a specific covered region resolved — one of the four
  // Canadian provinces this board covers, or any US state (the US gazetteer
  // intentionally covers the whole country). A bare country mention with no
  // region ("Manitoba", "somewhere in Canada" with no city) is NOT enough:
  // that is what the separate genuinely-remote-in-country check in
  // normalize/index.ts exists for, gated on the posting actually being remote.
  const isInScope = resolvedRegion !== null;
  const isCanada = resolvedCountry === 'Canada';
  const isUnitedStates = resolvedCountry === 'United States';

  const provinceName =
    resolvedRegion && resolvedCountry === 'Canada'
      ? PROVINCE_NAMES[resolvedRegion as ProvinceCode]
      : resolvedRegion && resolvedCountry === 'United States'
        ? US_STATE_NAMES[resolvedRegion as USStateCode]
        : null;

  return {
    city,
    region,
    province: resolvedRegion,
    provinceName,
    country: resolvedCountry,
    isInScope,
    isOntario: resolvedRegion === 'ON',
    isCanada,
    isUnitedStates,
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

export function provinceForCity(city: string | null): RegionCode | null {
  if (!city) return null;
  const needle = key(city);
  return INDEX.find((e) => e.needle === needle)?.region ?? null;
}

/** 'Canada' | 'United States' the given city belongs to, when known. */
export function countryForCity(city: string | null): 'Canada' | 'United States' | null {
  if (!city) return null;
  const needle = key(city);
  return INDEX.find((e) => e.needle === needle)?.country ?? null;
}
