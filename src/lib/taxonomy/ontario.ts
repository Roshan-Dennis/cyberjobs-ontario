/**
 * Ontario geography. Used to decide whether a posting is in-province, to
 * normalise free-text location strings, and to build region facets.
 */

export interface OntarioPlace {
  name: string;
  region: string;
  aliases?: string[];
}

/** Economic regions used for grouping in the UI. */
export const ONTARIO_REGIONS = [
  'Greater Toronto Area',
  'Hamilton–Niagara',
  'Waterloo–Wellington',
  'Southwestern Ontario',
  'Ottawa & Eastern Ontario',
  'Central Ontario',
  'Northern Ontario',
] as const;

export type OntarioRegion = (typeof ONTARIO_REGIONS)[number];

const P = (name: string, region: OntarioRegion, aliases?: string[]): OntarioPlace => ({
  name,
  region,
  aliases,
});

export const ONTARIO_PLACES: OntarioPlace[] = [
  // ---------------- Greater Toronto Area ----------------
  P('Toronto', 'Greater Toronto Area', ['downtown toronto', 'north york', 'scarborough', 'etobicoke', 'east york', 'york, on', 'gta']),
  P('Mississauga', 'Greater Toronto Area', ['port credit', 'streetsville', 'meadowvale']),
  P('Brampton', 'Greater Toronto Area', ['bramalea']),
  P('Markham', 'Greater Toronto Area', ['unionville', 'thornhill']),
  P('Vaughan', 'Greater Toronto Area', ['concord', 'woodbridge', 'maple, on', 'kleinburg']),
  P('Richmond Hill', 'Greater Toronto Area'),
  P('Oakville', 'Greater Toronto Area'),
  P('Burlington', 'Greater Toronto Area'),
  P('Milton', 'Greater Toronto Area'),
  P('Halton Hills', 'Greater Toronto Area', ['georgetown', 'acton']),
  P('Pickering', 'Greater Toronto Area'),
  P('Ajax', 'Greater Toronto Area'),
  P('Whitby', 'Greater Toronto Area', ['brooklin']),
  P('Oshawa', 'Greater Toronto Area'),
  P('Clarington', 'Greater Toronto Area', ['bowmanville', 'courtice', 'newcastle, on']),
  P('Uxbridge', 'Greater Toronto Area'),
  P('Scugog', 'Greater Toronto Area', ['port perry']),
  P('Brock', 'Greater Toronto Area', ['cannington', 'beaverton', 'sunderland']),
  P('Aurora', 'Greater Toronto Area'),
  P('Newmarket', 'Greater Toronto Area'),
  P('King City', 'Greater Toronto Area', ['king township', 'nobleton', 'schomberg']),
  P('Whitchurch-Stouffville', 'Greater Toronto Area', ['stouffville']),
  P('East Gwillimbury', 'Greater Toronto Area', ['sharon, on', 'mount albert', 'holland landing']),
  P('Georgina', 'Greater Toronto Area', ['keswick', 'sutton, on', 'jacksons point']),
  P('Caledon', 'Greater Toronto Area', ['bolton, on', 'alton', 'inglewood, on']),

  // ---------------- Hamilton–Niagara ----------------
  P('Hamilton', 'Hamilton–Niagara', ['stoney creek', 'ancaster', 'dundas, on', 'waterdown', 'flamborough']),
  P('St. Catharines', 'Hamilton–Niagara', ['st catharines', 'saint catharines']),
  P('Niagara Falls', 'Hamilton–Niagara'),
  P('Welland', 'Hamilton–Niagara'),
  P('Fort Erie', 'Hamilton–Niagara'),
  P('Port Colborne', 'Hamilton–Niagara'),
  P('Thorold', 'Hamilton–Niagara'),
  P('Grimsby', 'Hamilton–Niagara'),
  P('Lincoln', 'Hamilton–Niagara', ['beamsville', 'vineland']),
  P('Pelham', 'Hamilton–Niagara', ['fonthill']),
  P('Niagara-on-the-Lake', 'Hamilton–Niagara', ['virgil']),
  P('West Lincoln', 'Hamilton–Niagara', ['smithville']),
  P('Wainfleet', 'Hamilton–Niagara'),
  P('Haldimand County', 'Hamilton–Niagara', ['caledonia', 'hagersville', 'dunnville', 'cayuga']),
  P('Norfolk County', 'Hamilton–Niagara', ['simcoe, on', 'port dover', 'delhi, on', 'waterford, on']),

  // ---------------- Waterloo–Wellington ----------------
  P('Kitchener', 'Waterloo–Wellington'),
  P('Waterloo', 'Waterloo–Wellington'),
  P('Cambridge', 'Waterloo–Wellington', ['galt', 'preston, on', 'hespeler']),
  P('Guelph', 'Waterloo–Wellington'),
  P('Woolwich', 'Waterloo–Wellington', ['elmira, on', 'st. jacobs', 'st jacobs', 'breslau']),
  P('Wilmot', 'Waterloo–Wellington', ['new hamburg', 'baden, on']),
  P('Wellesley', 'Waterloo–Wellington', ['st. clements']),
  P('North Dumfries', 'Waterloo–Wellington', ['ayr, on']),
  P('Centre Wellington', 'Waterloo–Wellington', ['fergus', 'elora']),
  P('Guelph/Eramosa', 'Waterloo–Wellington', ['rockwood']),
  P('Puslinch', 'Waterloo–Wellington', ['aberfoyle']),
  P('Erin', 'Waterloo–Wellington', ['hillsburgh']),
  P('Minto', 'Waterloo–Wellington', ['harriston', 'palmerston, on', 'clifford']),
  P('Wellington North', 'Waterloo–Wellington', ['mount forest', 'arthur, on']),
  P('Mapleton', 'Waterloo–Wellington', ['drayton']),

  // ---------------- Southwestern Ontario ----------------
  P('London', 'Southwestern Ontario', ['london, ontario']),
  P('Windsor', 'Southwestern Ontario'),
  P('Sarnia', 'Southwestern Ontario', ['point edward']),
  P('Chatham-Kent', 'Southwestern Ontario', ['chatham', 'wallaceburg', 'tilbury', 'blenheim, on', 'ridgetown']),
  P('Brantford', 'Southwestern Ontario'),
  P('Brant County', 'Southwestern Ontario', ['paris, on', 'st. george, on', 'burford']),
  P('Woodstock', 'Southwestern Ontario'),
  P('Stratford', 'Southwestern Ontario'),
  P('St. Thomas', 'Southwestern Ontario', ['st thomas']),
  P('Tillsonburg', 'Southwestern Ontario'),
  P('Ingersoll', 'Southwestern Ontario'),
  P('Leamington', 'Southwestern Ontario'),
  P('Kingsville', 'Southwestern Ontario'),
  P('Essex', 'Southwestern Ontario', ['harrow, on']),
  P('LaSalle', 'Southwestern Ontario'),
  P('Tecumseh', 'Southwestern Ontario'),
  P('Amherstburg', 'Southwestern Ontario'),
  P('Lakeshore', 'Southwestern Ontario', ['belle river']),
  P('Owen Sound', 'Southwestern Ontario'),
  P('Goderich', 'Southwestern Ontario'),
  P('Clinton', 'Southwestern Ontario'),
  P('Exeter', 'Southwestern Ontario'),
  P('Strathroy-Caradoc', 'Southwestern Ontario', ['strathroy', 'mount brydges']),
  P('Middlesex Centre', 'Southwestern Ontario', ['komoka', 'ilderton']),
  P('Thames Centre', 'Southwestern Ontario', ['dorchester, on']),
  P('Aylmer', 'Southwestern Ontario'),
  P('Norwich', 'Southwestern Ontario', ['otterville']),
  P('Perth East', 'Southwestern Ontario', ['milverton', 'shakespeare, on']),
  P('North Perth', 'Southwestern Ontario', ['listowel']),
  P('South Huron', 'Southwestern Ontario'),
  P('Huron East', 'Southwestern Ontario', ['seaforth', 'brussels, on']),
  P('Bluewater', 'Southwestern Ontario', ['bayfield', 'zurich, on']),
  P('Saugeen Shores', 'Southwestern Ontario', ['port elgin', 'southampton, on']),
  P('Kincardine', 'Southwestern Ontario', ['tiverton']),
  P('Hanover', 'Southwestern Ontario'),
  P('Meaford', 'Southwestern Ontario'),
  P('Grey Highlands', 'Southwestern Ontario', ['markdale', 'flesherton']),
  P('West Grey', 'Southwestern Ontario', ['durham, on', 'neustadt']),
  P('Brockton', 'Southwestern Ontario', ['walkerton']),
  P('South Bruce', 'Southwestern Ontario', ['teeswater', 'mildmay']),
  P('Arran-Elderslie', 'Southwestern Ontario', ['chesley', 'paisley']),
  P('Northern Bruce Peninsula', 'Southwestern Ontario', ['tobermory', 'lions head']),
  P('South Bruce Peninsula', 'Southwestern Ontario', ['wiarton', 'sauble beach']),
  P('Dutton Dunwich', 'Southwestern Ontario'),
  P('West Elgin', 'Southwestern Ontario', ['rodney, on', 'west lorne']),
  P('Bayham', 'Southwestern Ontario', ['port burwell', 'straffordville']),
  P('Malahide', 'Southwestern Ontario', ['springfield, on']),
  P('Central Elgin', 'Southwestern Ontario', ['port stanley', 'belmont, on']),
  P('Southwest Middlesex', 'Southwestern Ontario', ['glencoe, on']),
  P('Lucan Biddulph', 'Southwestern Ontario', ['lucan']),
  P('North Middlesex', 'Southwestern Ontario', ['parkhill', 'ailsa craig']),
  P('Adelaide Metcalfe', 'Southwestern Ontario'),
  P('Petrolia', 'Southwestern Ontario'),
  P('St. Clair', 'Southwestern Ontario', ['corunna', 'mooretown']),
  P('Plympton-Wyoming', 'Southwestern Ontario', ['wyoming, on']),
  P('Lambton Shores', 'Southwestern Ontario', ['grand bend', 'forest, on', 'thedford']),
  P('Warwick', 'Southwestern Ontario', ['watford, on']),
  P('Dawn-Euphemia', 'Southwestern Ontario'),
  P('Enniskillen', 'Southwestern Ontario', ['petrolia area']),
  P('Oil Springs', 'Southwestern Ontario'),
  P('Brooke-Alvinston', 'Southwestern Ontario', ['alvinston']),
  P('Zorra', 'Southwestern Ontario', ['thamesford', 'embro']),
  P('South-West Oxford', 'Southwestern Ontario', ['mount elgin']),
  P('Blandford-Blenheim', 'Southwestern Ontario', ['drumbo', 'plattsville']),
  P('East Zorra-Tavistock', 'Southwestern Ontario', ['tavistock', 'innerkip']),
  P('West Perth', 'Southwestern Ontario', ['mitchell, on']),
  P('Ashfield-Colborne-Wawanosh', 'Southwestern Ontario'),
  P('Central Huron', 'Southwestern Ontario'),
  P('Morris-Turnberry', 'Southwestern Ontario'),
  P('North Huron', 'Southwestern Ontario', ['wingham', 'blyth']),
  P('Howick', 'Southwestern Ontario', ['gorrie', 'fordwich']),
  P('Chatsworth', 'Southwestern Ontario'),
  P('Georgian Bluffs', 'Southwestern Ontario'),
  P('The Blue Mountains', 'Southwestern Ontario', ['thornbury', 'blue mountains']),
  P('Southgate', 'Southwestern Ontario', ['dundalk']),
  P('Pelee', 'Southwestern Ontario', ['pelee island']),

  // ---------------- Ottawa & Eastern Ontario ----------------
  P('Ottawa', 'Ottawa & Eastern Ontario', ['nepean', 'kanata', 'orleans', 'gloucester, on', 'barrhaven', 'stittsville', 'ncr', 'national capital region', 'manotick', 'greely', 'osgoode', 'richmond, on']),
  P('Kingston', 'Ottawa & Eastern Ontario'),
  P('Belleville', 'Ottawa & Eastern Ontario'),
  P('Cornwall', 'Ottawa & Eastern Ontario'),
  P('Brockville', 'Ottawa & Eastern Ontario'),
  P('Pembroke', 'Ottawa & Eastern Ontario'),
  P('Petawawa', 'Ottawa & Eastern Ontario'),
  P('Renfrew', 'Ottawa & Eastern Ontario'),
  P('Arnprior', 'Ottawa & Eastern Ontario'),
  P('Carleton Place', 'Ottawa & Eastern Ontario'),
  P('Smiths Falls', 'Ottawa & Eastern Ontario'),
  P('Perth', 'Ottawa & Eastern Ontario'),
  P('Almonte', 'Ottawa & Eastern Ontario', ['mississippi mills']),
  P('Kemptville', 'Ottawa & Eastern Ontario', ['north grenville']),
  P('Prescott', 'Ottawa & Eastern Ontario'),
  P('Gananoque', 'Ottawa & Eastern Ontario'),
  P('Napanee', 'Ottawa & Eastern Ontario', ['greater napanee']),
  P('Quinte West', 'Ottawa & Eastern Ontario', ['trenton, on', 'cfb trenton']),
  P('Prince Edward County', 'Ottawa & Eastern Ontario', ['picton', 'wellington, on', 'bloomfield, on']),
  P('Hawkesbury', 'Ottawa & Eastern Ontario'),
  P('Rockland', 'Ottawa & Eastern Ontario', ['clarence-rockland']),
  P('Casselman', 'Ottawa & Eastern Ontario'),
  P('Embrun', 'Ottawa & Eastern Ontario', ['russell, on']),
  P('Alexandria', 'Ottawa & Eastern Ontario', ['north glengarry']),
  P('Morrisburg', 'Ottawa & Eastern Ontario', ['south dundas']),
  P('Winchester', 'Ottawa & Eastern Ontario', ['north dundas']),
  P('Deep River', 'Ottawa & Eastern Ontario'),
  P('Bancroft', 'Ottawa & Eastern Ontario'),
  P('Madoc', 'Ottawa & Eastern Ontario'),
  P('Tweed', 'Ottawa & Eastern Ontario'),
  P('Trent Hills', 'Ottawa & Eastern Ontario', ['campbellford', 'hastings, on']),
  P('Brighton', 'Ottawa & Eastern Ontario'),
  P('Cobourg', 'Ottawa & Eastern Ontario'),
  P('Port Hope', 'Ottawa & Eastern Ontario'),
  P('Peterborough', 'Ottawa & Eastern Ontario'),
  P('Lindsay', 'Ottawa & Eastern Ontario', ['kawartha lakes', 'city of kawartha lakes', 'fenelon falls', 'bobcaygeon']),
  P('Havelock', 'Ottawa & Eastern Ontario'),
  P('Lakefield', 'Ottawa & Eastern Ontario', ['selwyn']),
  P('Athens', 'Ottawa & Eastern Ontario'),
  P('Merrickville', 'Ottawa & Eastern Ontario'),
  P('Westport', 'Ottawa & Eastern Ontario'),

  // ---------------- Central Ontario ----------------
  P('Barrie', 'Central Ontario'),
  P('Orillia', 'Central Ontario'),
  P('Innisfil', 'Central Ontario', ['alcona', 'cookstown']),
  P('Bradford West Gwillimbury', 'Central Ontario', ['bradford']),
  P('New Tecumseth', 'Central Ontario', ['alliston', 'tottenham', 'beeton']),
  P('Essa', 'Central Ontario', ['angus, on', 'base borden', 'cfb borden']),
  P('Springwater', 'Central Ontario', ['elmvale', 'midhurst']),
  P('Oro-Medonte', 'Central Ontario', ['horseshoe valley']),
  P('Collingwood', 'Central Ontario'),
  P('Wasaga Beach', 'Central Ontario'),
  P('Midland', 'Central Ontario'),
  P('Penetanguishene', 'Central Ontario'),
  P('Tiny', 'Central Ontario', ['lafontaine']),
  P('Tay', 'Central Ontario', ['victoria harbour', 'port mcnicoll']),
  P('Severn', 'Central Ontario', ['coldwater']),
  P('Ramara', 'Central Ontario', ['brechin']),
  P('Clearview', 'Central Ontario', ['stayner', 'creemore']),
  P('Adjala-Tosorontio', 'Central Ontario'),
  P('Orangeville', 'Central Ontario'),
  P('Shelburne', 'Central Ontario'),
  P('Mono', 'Central Ontario'),
  P('Grand Valley', 'Central Ontario', ['east luther']),
  P('Amaranth', 'Central Ontario'),
  P('Melancthon', 'Central Ontario'),
  P('Mulmur', 'Central Ontario'),
  P('Gravenhurst', 'Central Ontario'),
  P('Bracebridge', 'Central Ontario'),
  P('Huntsville', 'Central Ontario'),
  P('Muskoka Lakes', 'Central Ontario', ['port carling', 'bala']),
  P('Georgian Bay', 'Central Ontario', ['port severn', 'honey harbour']),
  P('Lake of Bays', 'Central Ontario', ['dwight', 'baysville']),
  P('Parry Sound', 'Central Ontario'),
  P('Haliburton', 'Central Ontario', ['dysart et al', 'minden']),
  P('Minden Hills', 'Central Ontario', ['minden']),

  // ---------------- Northern Ontario ----------------
  P('Sudbury', 'Northern Ontario', ['greater sudbury', 'val caron', 'lively, on', 'chelmsford']),
  P('Thunder Bay', 'Northern Ontario'),
  P('Sault Ste. Marie', 'Northern Ontario', ['sault ste marie', 'the soo']),
  P('North Bay', 'Northern Ontario'),
  P('Timmins', 'Northern Ontario', ['south porcupine']),
  P('Kenora', 'Northern Ontario'),
  P('Dryden', 'Northern Ontario'),
  P('Fort Frances', 'Northern Ontario'),
  P('Elliot Lake', 'Northern Ontario'),
  P('Kapuskasing', 'Northern Ontario'),
  P('Hearst', 'Northern Ontario'),
  P('Cochrane', 'Northern Ontario'),
  P('Kirkland Lake', 'Northern Ontario'),
  P('New Liskeard', 'Northern Ontario', ['temiskaming shores', 'haileybury']),
  P('Iroquois Falls', 'Northern Ontario'),
  P('Espanola', 'Northern Ontario'),
  P('Blind River', 'Northern Ontario'),
  P('Wawa', 'Northern Ontario'),
  P('Marathon', 'Northern Ontario'),
  P('Nipigon', 'Northern Ontario'),
  P('Geraldton', 'Northern Ontario', ['greenstone']),
  P('Sioux Lookout', 'Northern Ontario'),
  P('Red Lake', 'Northern Ontario'),
  P('Atikokan', 'Northern Ontario'),
  P('Manitouwadge', 'Northern Ontario'),
  P('Moosonee', 'Northern Ontario'),
  P('Mattawa', 'Northern Ontario'),
  P('Sturgeon Falls', 'Northern Ontario', ['west nipissing']),
  P('Manitoulin Island', 'Northern Ontario', ['little current', 'gore bay', 'mindemoya']),
  P('Powassan', 'Northern Ontario'),
  P('Callander', 'Northern Ontario'),
  P('Temagami', 'Northern Ontario'),
  P('Smooth Rock Falls', 'Northern Ontario'),
  P('Chapleau', 'Northern Ontario'),
];

const NORMALIZE_RE = /[^a-z0-9]+/g;

function key(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(NORMALIZE_RE, ' ').trim();
}

interface IndexEntry {
  place: OntarioPlace;
  needle: string;
}

const INDEX: IndexEntry[] = (() => {
  const entries: IndexEntry[] = [];
  for (const place of ONTARIO_PLACES) {
    entries.push({ place, needle: key(place.name) });
    for (const alias of place.aliases ?? []) entries.push({ place, needle: key(alias) });
  }
  // Longest needle first so "sault ste marie" wins over "marie".
  return entries.sort((a, b) => b.needle.length - a.needle.length);
})();

export const ONTARIO_MARKERS = [
  'ontario',
  ' on,',
  ', on',
  '(on)',
  ' ont ',
  'ontario, canada',
];

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
 * Places outside Canada that a bare Ontario city name would otherwise match.
 *
 * Ontario is full of names borrowed from Britain — London, Cambridge, Windsor,
 * Kingston, Stratford, Woodstock, Newmarket — so "London, UK" sailed straight
 * through the gazetteer as London, Ontario. At one point a quarter of the board
 * was London-UK postings. Any of these markers disqualifies the string unless a
 * Canadian marker also appears.
 */
const FOREIGN_MARKERS =
  /\b(uk|u k|united kingdom|england|scotland|wales|northern ireland|ireland|dublin|berlin|germany|munich|france|paris|netherlands|amsterdam|belgium|brussels|spain|madrid|barcelona|portugal|lisbon|italy|milan|rome|switzerland|zurich|austria|vienna|sweden|stockholm|norway|oslo|denmark|copenhagen|finland|helsinki|poland|warsaw|krakow|czech|prague|romania|bucharest|ukraine|greece|athens|turkey|istanbul|israel|tel aviv|india|bengaluru|bangalore|hyderabad|mumbai|delhi|pune|chennai|noida|gurgaon|gurugram|singapore|malaysia|kuala lumpur|philippines|manila|japan|tokyo|korea|seoul|china|shanghai|beijing|shenzhen|hong kong|taiwan|australia|sydney|melbourne|brisbane|perth|new zealand|auckland|wellington nz|south africa|johannesburg|cape town|brazil|sao paulo|argentina|buenos aires|chile|santiago|colombia|bogota|mexico|mexico city|guadalajara|costa rica|uae|dubai|abu dhabi|saudi|riyadh|qatar|doha|egypt|cairo|nigeria|lagos|kenya|nairobi)\b/;

/** US signals. Kept separate so the country can be reported accurately. */
const US_MARKERS =
  /\b(united states|usa|u s a|u s |us only|remote us|san francisco|new york|nyc|los angeles|seattle|austin|boston|chicago|denver|atlanta|dallas|houston|miami|phoenix|portland|san diego|san jose|washington dc|bay area|silicon valley)\b/;
const US_STATE_CODES =
  /\b(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)\b/;

/**
 * Ontario city names that are far better known as somewhere else. These need a
 * positive Canadian signal in the same string before they count — a bare
 * "London" or "Cambridge" is more likely England than Ontario.
 */
const AMBIGUOUS_CITIES = new Set([
  'london', 'cambridge', 'windsor', 'kingston', 'hamilton', 'waterloo', 'stratford',
  'woodstock', 'newmarket', 'bradford', 'chatham', 'perth', 'sarnia', 'york', 'essex',
  'aurora', 'richmond hill', 'peterborough', 'barrie', 'guelph', 'oxford', 'dublin',
]);

export interface GeoMatch {
  city: string | null;
  region: string | null;
  country: string | null;
  isOntario: boolean;
  isCanada: boolean;
  isRemote: boolean;
  /** The location field names a place outside Canada and no Canadian one. */
  isForeign: boolean;
}

const REMOTE_RE = /\b(remote|work\s*from\s*home|wfh|telecommute|distributed|anywhere|virtual)\b/i;
const HYBRID_RE = /\b(hybrid|flex(ible)?\s*(work|hybrid)|[0-9]\s*days?\s*(in|per week in)\s*(the\s*)?office|partially remote)\b/i;

/**
 * Resolve a free-text location string against the Ontario gazetteer.
 * Never throws; returns a best-effort match.
 */
export function matchLocation(raw: string | null | undefined): GeoMatch {
  const text = (raw ?? '').trim();
  const lower = ` ${key(text)} `;
  const isRemote = REMOTE_RE.test(text);

  let city: string | null = null;
  let region: string | null = null;

  for (const entry of INDEX) {
    // Word-boundary-ish containment on the normalised string.
    if (lower.includes(` ${entry.needle} `) || lower.includes(` ${entry.needle},`)) {
      city = entry.place.name;
      region = entry.place.region;
      break;
    }
  }

  // Fallback: substring match for city names >= 5 chars (handles "Toronto/Ontario").
  if (!city) {
    for (const entry of INDEX) {
      if (entry.needle.length >= 5 && lower.includes(entry.needle)) {
        city = entry.place.name;
        region = entry.place.region;
        break;
      }
    }
  }

  const mentionsOntario = /\bontario\b/.test(lower) || /\bon\b/.test(lower) || /\bont\b/.test(lower);
  const mentionsCanada =
    CANADA_MARKERS.some((m) => lower.includes(key(m))) || CANADA_PROVINCE_CODES.test(lower) || mentionsOntario;

  // A foreign marker beats a city-name match. "London, UK" and
  // "Hybrid - San Francisco, New York City, London, Berlin" both contain an
  // Ontario city name, and neither is in Ontario.
  const foreign = FOREIGN_MARKERS.test(lower) || US_MARKERS.test(lower);
  if (foreign && !mentionsCanada) {
    return {
      city: null,
      region: null,
      country: US_MARKERS.test(lower) ? 'United States' : null,
      isOntario: false,
      isCanada: false,
      isRemote,
      isForeign: true,
    };
  }

  // Borrowed British names need corroboration: a bare "Cambridge" is more
  // likely England than Ontario, so drop it unless Canada is named too.
  if (city && !mentionsCanada && AMBIGUOUS_CITIES.has(key(city))) {
    city = null;
    region = null;
  }

  const isOntario = Boolean(city) || mentionsOntario;
  const isCanada = isOntario || mentionsCanada;

  let country: string | null = null;
  if (isCanada) country = 'Canada';
  else if (US_MARKERS.test(lower) || US_STATE_CODES.test(lower)) country = 'United States';
  else if (text) country = null;

  return { city, region, country, isOntario, isCanada, isRemote, isForeign: false };
}

export function detectHybrid(text: string): boolean {
  return HYBRID_RE.test(text);
}

export function detectRemote(text: string): boolean {
  return REMOTE_RE.test(text);
}

export const ONTARIO_CITY_NAMES = ONTARIO_PLACES.map((p) => p.name);

export function regionForCity(city: string | null): string | null {
  if (!city) return null;
  return ONTARIO_PLACES.find((p) => p.name === city)?.region ?? null;
}
