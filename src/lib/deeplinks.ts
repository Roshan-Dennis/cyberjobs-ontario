import type { JobFilters } from '@/lib/types';

/**
 * LinkedIn, Indeed and Glassdoor do not offer a public job-search API and
 * their terms prohibit scraping, so this app does not index them. Instead we
 * generate pre-filtered search links so a user can jump straight into those
 * sites with the same filters applied.
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

function primaryLocation(f: JobFilters): string {
  if (f.cities && f.cities.length === 1 && f.cities[0] !== 'Remote') return `${f.cities[0]}, Ontario, Canada`;
  return 'Ontario, Canada';
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

export function buildDeepLinks(f: JobFilters): DeepLink[] {
  const kw = keywords(f);
  const loc = primaryLocation(f);
  const remote = f.arrangement?.length === 1 && f.arrangement[0] === 'remote';

  // ---- LinkedIn ----
  const li = new URLSearchParams({ keywords: kw, location: remote ? 'Canada' : loc });
  const liExp = (f.experience ?? []).map((e) => EXPERIENCE_TO_LINKEDIN[e]).filter(Boolean);
  if (liExp.length) li.set('f_E', [...new Set(liExp)].join(','));
  if (f.postedWithinDays && WITHIN_TO_LINKEDIN_SECONDS[f.postedWithinDays]) {
    li.set('f_TPR', `r${WITHIN_TO_LINKEDIN_SECONDS[f.postedWithinDays]}`);
  }
  if (remote) li.set('f_WT', '2');
  else if (f.arrangement?.includes('hybrid')) li.set('f_WT', '3');
  li.set('sortBy', f.sort === 'newest' ? 'DD' : 'R');

  // ---- Indeed ----
  const ind = new URLSearchParams({ q: kw, l: remote ? 'Remote' : loc });
  if (f.postedWithinDays) ind.set('fromage', String(Math.min(f.postedWithinDays, 30)));
  if (f.sort === 'newest') ind.set('sort', 'date');
  if (f.salaryMin) ind.set('q', `${kw} $${Math.round(f.salaryMin / 1000)},000`);

  // ---- Glassdoor ----
  const gd = new URLSearchParams({ sc: '0kf', typedKeyword: kw, locT: 'S', locName: remote ? 'Canada' : 'Ontario' });

  // ---- Google Jobs ----
  const googleQuery = `${kw} jobs ${remote ? 'remote Canada' : loc}`;

  return [
    {
      site: 'LinkedIn',
      url: `https://www.linkedin.com/jobs/search/?${li.toString()}`,
      note: 'Opens LinkedIn job search with these filters applied.',
    },
    {
      site: 'Indeed Canada',
      url: `https://ca.indeed.com/jobs?${ind.toString()}`,
      note: 'Opens Indeed with the same keywords, location and date window.',
    },
    {
      site: 'Glassdoor',
      url: `https://www.glassdoor.ca/Job/jobs.htm?${gd.toString()}`,
      note: 'Opens Glassdoor job search.',
    },
    {
      site: 'Google Jobs',
      url: `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}&ibp=htl;jobs`,
      note: 'Google aggregates postings from many boards, including LinkedIn and Indeed.',
    },
    {
      site: 'Job Bank',
      url: `https://www.jobbank.gc.ca/jobsearch/jobsearch?searchstring=${encodeURIComponent(kw)}&locationstring=${encodeURIComponent(remote ? 'Canada' : 'Ontario')}`,
      note: 'The federal job board — already indexed here, link included for completeness.',
    },
    {
      site: 'GC Jobs (federal public service)',
      url: `https://emploisfp-psjobs.cfp-psc.gc.ca/psrs-srfp/applicant/page2440?fromMenu=true&toggleLanguage=en`,
      note: 'Government of Canada public service hiring portal.',
    },
    {
      site: 'Ontario Public Service',
      url: 'https://www.gojobs.gov.on.ca/Search.aspx?Language=English',
      note: 'Ontario provincial government careers.',
    },
  ];
}
