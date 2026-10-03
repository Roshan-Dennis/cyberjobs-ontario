import type { JobFilters } from '@/lib/types';
import { PROVINCE_CODES, PROVINCE_NAMES as CA_NAMES, US_STATE_CODES, US_STATE_NAMES } from '@/lib/taxonomy/canada';

/**
 * LinkedIn, Indeed and Glassdoor do not offer a public job-search API and
 * their terms prohibit scraping, so this app does not index them. Instead we
 * generate pre-filtered search links so a user can jump straight into those
 * sites with the same filters applied — for whichever of Canada and the
 * United States the current filters point at.
 */

const EXPERIENCE_TO_LINKEDIN: Record<string, string> = {
  internship: '1',
  coop: '1',
  entry: '2',
  junior: '2',
  mid: '3',
  senior: '4',
  lead: '4',
  manager: '5',
  director: '6',
  executive: '6',
};

const WITHIN_TO_LINKEDIN_SECONDS: Record<number, number> = {
  1: 86400,
  3: 259200,
  7: 604800,
  14: 1209600,
  30: 2592000,
};

const REGION_NAMES: Record<string, string> = { ...CA_NAMES, ...US_STATE_NAMES };
const CA_CODES = new Set<string>(PROVINCE_CODES);
const US_CODES = new Set<string>(US_STATE_CODES);

function countryOfRegion(code: string | undefined): 'Canada' | 'United States' | null {
  if (!code) return null;
  if (CA_CODES.has(code)) return 'Canada';
  if (US_CODES.has(code)) return 'United States';
  return null;
}

/**
 * Which country the deep links should point at. Decided, in order, by an
 * explicit country filter, an unambiguous set of ticked provinces/states, the
 * single selected city's region, and finally defaulting to Canada — the
 * board's original home — when nothing says otherwise.
 */
function primaryCountry(f: JobFilters, cityRegion?: string): 'Canada' | 'United States' {
  const countries = (f.countries ?? []).filter((c) => c === 'Canada' || c === 'United States');
  if (countries.length === 1) return countries[0] as 'Canada' | 'United States';
  const regionCountries = [...new Set((f.provinces ?? []).map(countryOfRegion).filter((c): c is 'Canada' | 'United States' => c != null))];
  if (regionCountries.length === 1) return regionCountries[0];
  return countryOfRegion(cityRegion) ?? 'Canada';
}

/** Region the other sites should search, taken from the province/state/city filters. */
function primaryRegion(f: JobFilters, country: 'Canada' | 'United States', cityRegion?: string): string {
  const codes = CA_CODES.size && country === 'Canada' ? CA_CODES : US_CODES;
  const regions = (f.provinces ?? []).filter((p) => codes.has(p) && REGION_NAMES[p]);
  if (regions.length === 1) return REGION_NAMES[regions[0]];
  if (cityRegion && codes.has(cityRegion) && REGION_NAMES[cityRegion]) return REGION_NAMES[cityRegion];
  // Several regions ticked, or none: search the whole country. Canada
  // defaults to Ontario specifically, where most of the Canadian board is.
  if (regions.length > 1) return country;
  return country === 'Canada' ? 'Ontario' : 'United States';
}

function keywords(f: JobFilters): string {
  const base = f.q?.trim();
  if (base) return base;
  return 'cyber security';
}

export interface DeepLink {
  site: string;
  url: string;
  note: string;
}

export function buildDeepLinks(f: JobFilters, cityRegion?: string): DeepLink[] {
  const kw = keywords(f);
  const country = primaryCountry(f, cityRegion);
  const region = primaryRegion(f, country, cityRegion);
  const remote = f.arrangement?.length === 1 && f.arrangement[0] === 'remote';
  const city = f.cities && f.cities.length === 1 && !['Remote', 'Other'].includes(f.cities[0]) ? f.cities[0] : null;
  const loc = remote
    ? country
    : city
      ? cityRegion && REGION_NAMES[cityRegion]
        ? `${city}, ${REGION_NAMES[cityRegion]}, ${country}`
        : `${city}, ${country}`
      : region === country
        ? country
        : `${region}, ${country}`;

  // ---- LinkedIn ----
  const li = new URLSearchParams({ keywords: kw, location: loc });
  const liExp = (f.experience ?? []).map((e) => EXPERIENCE_TO_LINKEDIN[e]).filter(Boolean);
  if (liExp.length) li.set('f_E', [...new Set(liExp)].join(','));
  if (f.postedWithinDays && WITHIN_TO_LINKEDIN_SECONDS[f.postedWithinDays]) {
    li.set('f_TPR', `r${WITHIN_TO_LINKEDIN_SECONDS[f.postedWithinDays]}`);
  }
  if (remote) li.set('f_WT', '2');
  else if (f.arrangement?.includes('hybrid')) li.set('f_WT', '3');
  li.set('sortBy', f.sort === 'newest' ? 'DD' : 'R');

  // ---- Indeed (country-specific domain) ----
  const indeedHost = country === 'Canada' ? 'ca.indeed.com' : 'www.indeed.com';
  const ind = new URLSearchParams({ q: kw, l: loc });
  if (f.postedWithinDays) ind.set('fromage', String(Math.min(f.postedWithinDays, 30)));
  if (f.sort === 'newest') ind.set('sort', 'date');
  if (f.salaryMin) ind.set('q', `${kw} $${Math.round(f.salaryMin / 1000)},000`);

  // ---- Glassdoor (country-specific domain) ----
  const glassdoorHost = country === 'Canada' ? 'www.glassdoor.ca' : 'www.glassdoor.com';
  const gd = new URLSearchParams({ sc: '0kf', typedKeyword: kw, locT: 'S', locName: loc });

  // ---- Google Jobs ----
  const googleQuery = `${kw} jobs ${remote ? `remote ${country}` : loc}`;

  const links: DeepLink[] = [
    {
      site: 'LinkedIn',
      url: `https://www.linkedin.com/jobs/search/?${li.toString()}`,
      note: 'Opens LinkedIn job search with these filters applied.',
    },
    {
      site: country === 'Canada' ? 'Indeed Canada' : 'Indeed',
      url: `https://${indeedHost}/jobs?${ind.toString()}`,
      note: 'Opens Indeed with the same keywords, location and date window.',
    },
    {
      site: 'Glassdoor',
      url: `https://${glassdoorHost}/Job/jobs.htm?${gd.toString()}`,
      note: 'Opens Glassdoor job search.',
    },
    {
      site: 'Google Jobs',
      url: `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}&ibp=htl;jobs`,
      note: 'Google aggregates postings from many boards, including LinkedIn and Indeed.',
    },
  ];

  // Government portals: Canadian ones for Canada, USAJobs for the US. Shown
  // for whichever country the current filters resolved to, since a reader
  // narrowed to Texas gets nothing useful from a Government of Canada link.
  if (country === 'Canada') {
    links.push(
      {
        site: 'Job Bank',
        url: `https://www.jobbank.gc.ca/jobsearch/jobsearch?searchstring=${encodeURIComponent(kw)}&locationstring=${encodeURIComponent(region === 'Canada' ? 'Canada' : region)}`,
        note: 'The federal job board — already indexed here, link included for completeness.',
      },
      {
        site: 'GC Jobs (federal public service)',
        url: 'https://emploisfp-psjobs.cfp-psc.gc.ca/psrs-srfp/applicant/page2440?fromMenu=true&toggleLanguage=en',
        note: 'Government of Canada public service hiring portal.',
      },
      {
        site: 'Ontario Public Service',
        url: 'https://www.gojobs.gov.on.ca/Search.aspx?Language=English',
        note: 'Ontario provincial government careers.',
      },
    );
  } else {
    links.push({
      site: 'USAJobs',
      url: `https://www.usajobs.gov/Search/Results?k=${encodeURIComponent(kw)}&l=${encodeURIComponent(region === 'United States' ? '' : region)}`,
      note: 'The official US federal government job board.',
    });
  }

  return links;
}
