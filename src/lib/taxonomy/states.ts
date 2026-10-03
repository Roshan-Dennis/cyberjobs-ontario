/**
 * United States geography: all 50 states plus DC, and a curated gazetteer of
 * the metro areas where tech and security employers actually hire.
 *
 * Same philosophy as `ontario.ts`/`provinces.ts`: coverage follows where
 * people work, not an exhaustive census. The Washington DC metro area gets
 * unusual depth — Reston, Arlington, Tysons, Columbia MD, Fort Meade — because
 * US government and defense-contractor cybersecurity hiring concentrates
 * there as heavily as banking does in Toronto.
 */

import type { OntarioPlace } from '@/lib/taxonomy/ontario';

export const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
] as const;
export type USStateCode = (typeof US_STATE_CODES)[number];

export const US_STATE_NAMES: Record<USStateCode, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'Washington, D.C.',
};

/** A place plus the state that owns it. */
export interface StatePlace extends OntarioPlace {
  state: USStateCode;
}

const P = (name: string, state: USStateCode, region: string, aliases?: string[]): StatePlace => ({
  name,
  state,
  region,
  aliases,
});

/**
 * Curated US metro gazetteer. Each entry is tagged with its state so the
 * matcher never has to guess — unlike the four-province Canadian list, a US
 * city name alone is often ambiguous even within the US (there are 30+
 * Springfields), so city names here are only ones distinctive enough to be
 * useful signals, or are always matched alongside an explicit state code in
 * practice (which the matcher requires — see `matchLocation` in `canada.ts`).
 */
export const US_PLACES: StatePlace[] = [
  // ---------------- Washington DC Metro (govt / defense contractors) ----------------
  P('Washington', 'DC', 'Washington DC Metro', ['washington d.c.', 'washington dc', 'dc metro']),
  P('Arlington', 'VA', 'Washington DC Metro'),
  P('Alexandria', 'VA', 'Washington DC Metro'),
  P('Reston', 'VA', 'Washington DC Metro'),
  P('Tysons', 'VA', 'Washington DC Metro', ['tysons corner']),
  P('McLean', 'VA', 'Washington DC Metro'),
  P('Herndon', 'VA', 'Washington DC Metro'),
  P('Fairfax', 'VA', 'Washington DC Metro'),
  P('Chantilly', 'VA', 'Washington DC Metro'),
  P('Vienna', 'VA', 'Washington DC Metro'),
  P('Columbia', 'MD', 'Washington DC Metro'),
  P('Bethesda', 'MD', 'Washington DC Metro'),
  P('Rockville', 'MD', 'Washington DC Metro'),
  P('Annapolis Junction', 'MD', 'Washington DC Metro', ['fort meade', 'ft meade', 'ft. meade']),
  P('Silver Spring', 'MD', 'Washington DC Metro'),
  P('Baltimore', 'MD', 'Baltimore'),

  // ---------------- SF Bay Area ----------------
  P('San Francisco', 'CA', 'SF Bay Area', ['sf bay area', 'soma']),
  P('San Jose', 'CA', 'SF Bay Area', ['silicon valley']),
  P('Palo Alto', 'CA', 'SF Bay Area'),
  P('Mountain View', 'CA', 'SF Bay Area'),
  P('Sunnyvale', 'CA', 'SF Bay Area'),
  P('Santa Clara', 'CA', 'SF Bay Area'),
  P('Redwood City', 'CA', 'SF Bay Area'),
  P('Menlo Park', 'CA', 'SF Bay Area'),
  P('Oakland', 'CA', 'SF Bay Area'),
  P('Berkeley', 'CA', 'SF Bay Area'),
  P('Fremont', 'CA', 'SF Bay Area'),
  P('San Mateo', 'CA', 'SF Bay Area'),
  P('Cupertino', 'CA', 'SF Bay Area'),
  P('Pleasanton', 'CA', 'SF Bay Area'),

  // ---------------- Los Angeles / San Diego ----------------
  P('Los Angeles', 'CA', 'Greater Los Angeles', ['la, ca']),
  P('Irvine', 'CA', 'Greater Los Angeles'),
  P('Santa Monica', 'CA', 'Greater Los Angeles'),
  P('Pasadena', 'CA', 'Greater Los Angeles'),
  P('Long Beach', 'CA', 'Greater Los Angeles'),
  P('El Segundo', 'CA', 'Greater Los Angeles'),
  P('San Diego', 'CA', 'San Diego'),
  P('Sacramento', 'CA', 'Sacramento'),

  // ---------------- Greater Seattle ----------------
  P('Seattle', 'WA', 'Greater Seattle'),
  P('Bellevue', 'WA', 'Greater Seattle'),
  P('Redmond', 'WA', 'Greater Seattle'),
  P('Kirkland', 'WA', 'Greater Seattle'),
  P('Tacoma', 'WA', 'Greater Seattle'),
  P('Spokane', 'WA', 'Spokane'),

  // ---------------- Greater Boston ----------------
  P('Boston', 'MA', 'Greater Boston'),
  P('Cambridge', 'MA', 'Greater Boston'),
  P('Waltham', 'MA', 'Greater Boston'),
  P('Burlington', 'MA', 'Greater Boston'),
  P('Lexington', 'MA', 'Greater Boston'),
  P('Somerville', 'MA', 'Greater Boston'),

  // ---------------- NYC Metro ----------------
  P('New York', 'NY', 'NYC Metro', ['new york city', 'nyc', 'manhattan', 'brooklyn']),
  P('Jersey City', 'NJ', 'NYC Metro'),
  P('Newark', 'NJ', 'NYC Metro'),
  P('White Plains', 'NY', 'NYC Metro'),
  P('Stamford', 'CT', 'NYC Metro'),

  // ---------------- Austin / Dallas / Houston ----------------
  P('Austin', 'TX', 'Austin'),
  P('Dallas', 'TX', 'Dallas-Fort Worth'),
  P('Fort Worth', 'TX', 'Dallas-Fort Worth'),
  P('Plano', 'TX', 'Dallas-Fort Worth'),
  P('Irving', 'TX', 'Dallas-Fort Worth'),
  P('Houston', 'TX', 'Houston'),
  P('San Antonio', 'TX', 'San Antonio'),

  // ---------------- Chicago ----------------
  P('Chicago', 'IL', 'Chicago'),
  P('Schaumburg', 'IL', 'Chicago'),
  P('Naperville', 'IL', 'Chicago'),

  // ---------------- Denver ----------------
  P('Denver', 'CO', 'Denver'),
  P('Boulder', 'CO', 'Denver'),
  P('Colorado Springs', 'CO', 'Colorado Springs'),

  // ---------------- Atlanta / Southeast ----------------
  P('Atlanta', 'GA', 'Atlanta'),
  P('Alpharetta', 'GA', 'Atlanta'),
  P('Charlotte', 'NC', 'Charlotte'),
  P('Raleigh', 'NC', 'Raleigh-Durham'),
  P('Durham', 'NC', 'Raleigh-Durham'),
  P('Nashville', 'TN', 'Nashville'),
  P('Tampa', 'FL', 'Tampa'),
  P('Orlando', 'FL', 'Orlando'),
  P('Miami', 'FL', 'Miami'),
  P('Fort Lauderdale', 'FL', 'Miami'),
  P('Jacksonville', 'FL', 'Jacksonville'),
  P('New Orleans', 'LA', 'New Orleans'),
  P('Richmond', 'VA', 'Richmond VA'),

  // ---------------- Midwest ----------------
  P('Minneapolis', 'MN', 'Minneapolis-Saint Paul', ['saint paul', 'st. paul', 'st paul']),
  P('Detroit', 'MI', 'Detroit'),
  P('Ann Arbor', 'MI', 'Detroit'),
  P('Columbus', 'OH', 'Columbus OH'),
  P('Cincinnati', 'OH', 'Cincinnati'),
  P('Cleveland', 'OH', 'Cleveland'),
  P('Indianapolis', 'IN', 'Indianapolis'),
  P('Kansas City', 'MO', 'Kansas City'),
  P('St. Louis', 'MO', 'St. Louis', ['saint louis']),
  P('Omaha', 'NE', 'Omaha'),

  // ---------------- Mountain / West ----------------
  P('Phoenix', 'AZ', 'Phoenix'),
  P('Scottsdale', 'AZ', 'Phoenix'),
  P('Tempe', 'AZ', 'Phoenix'),
  P('Salt Lake City', 'UT', 'Salt Lake City'),
  P('Las Vegas', 'NV', 'Las Vegas'),
  P('Portland', 'OR', 'Portland OR'),

  // ---------------- Northeast / Mid-Atlantic ----------------
  P('Philadelphia', 'PA', 'Philadelphia'),
  P('Pittsburgh', 'PA', 'Pittsburgh'),
  P('Providence', 'RI', 'Providence'),
];
