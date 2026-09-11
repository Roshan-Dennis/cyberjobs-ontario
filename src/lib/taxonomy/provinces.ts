/**
 * Alberta, British Columbia and Quebec places and regions.
 *
 * Data only, in the same shape as `ontario.ts`; `canada.ts` composes all four
 * into one index.
 *
 * Coverage is deliberately uneven — it follows where people actually work
 * rather than trying to be a complete gazetteer. Every census metropolitan
 * area is here, plus the smaller centres that employ IT and security staff
 * (universities, hospitals, refineries, ports, provincial offices). A place
 * missing from this list is not lost: a posting saying "Alberta" or "AB" still
 * resolves to the province, it just gets no city.
 */

import type { OntarioPlace } from '@/lib/taxonomy/ontario';

/** A place plus the province that owns it. */
export interface ProvincePlace extends OntarioPlace {
  province: ProvinceCode;
}

export const PROVINCE_CODES = ['ON', 'AB', 'BC', 'QC'] as const;
export type ProvinceCode = (typeof PROVINCE_CODES)[number];

export const PROVINCE_NAMES: Record<ProvinceCode, string> = {
  ON: 'Ontario',
  AB: 'Alberta',
  BC: 'British Columbia',
  QC: 'Quebec',
};

export const ALBERTA_REGIONS = [
  'Calgary Region',
  'Edmonton Region',
  'Central Alberta',
  'Southern Alberta',
  'Northern Alberta',
] as const;

export const BC_REGIONS = [
  'Metro Vancouver',
  'Vancouver Island',
  'Fraser Valley',
  'Okanagan',
  'Northern BC',
] as const;

export const QUEBEC_REGIONS = [
  'Greater Montreal',
  'Quebec City Region',
  'Eastern Townships',
  'Outaouais',
  'Central Quebec',
] as const;

const A = (name: string, region: string, aliases?: string[]): OntarioPlace => ({ name, region, aliases });

export const ALBERTA_PLACES: OntarioPlace[] = [
  // ---------------- Calgary Region ----------------
  A('Calgary', 'Calgary Region', ['yyc', 'downtown calgary']),
  A('Airdrie', 'Calgary Region'),
  A('Okotoks', 'Calgary Region'),
  A('Cochrane', 'Calgary Region'),
  A('Chestermere', 'Calgary Region'),
  A('Canmore', 'Calgary Region'),
  A('High River', 'Calgary Region'),
  A('Strathmore', 'Calgary Region'),

  // ---------------- Edmonton Region ----------------
  A('Edmonton', 'Edmonton Region', ['yeg', 'downtown edmonton']),
  A('St. Albert', 'Edmonton Region', ['st albert', 'saint albert']),
  A('Sherwood Park', 'Edmonton Region', ['strathcona county']),
  A('Spruce Grove', 'Edmonton Region'),
  A('Leduc', 'Edmonton Region'),
  A('Fort Saskatchewan', 'Edmonton Region'),
  A('Stony Plain', 'Edmonton Region'),
  A('Beaumont', 'Edmonton Region'),
  A('Nisku', 'Edmonton Region'),

  // ---------------- Central Alberta ----------------
  A('Red Deer', 'Central Alberta'),
  A('Camrose', 'Central Alberta'),
  A('Sylvan Lake', 'Central Alberta'),
  A('Lacombe', 'Central Alberta'),
  A('Wetaskiwin', 'Central Alberta'),
  A('Olds', 'Central Alberta'),
  A('Drumheller', 'Central Alberta'),

  // ---------------- Southern Alberta ----------------
  A('Lethbridge', 'Southern Alberta'),
  A('Medicine Hat', 'Southern Alberta'),
  A('Brooks', 'Southern Alberta'),
  A('Taber', 'Southern Alberta'),
  A('Banff', 'Southern Alberta'),

  // ---------------- Northern Alberta ----------------
  A('Fort McMurray', 'Northern Alberta', ['wood buffalo']),
  A('Grande Prairie', 'Northern Alberta'),
  A('Cold Lake', 'Northern Alberta'),
  A('Lloydminster', 'Northern Alberta'),
  A('Whitecourt', 'Northern Alberta'),
  A('Hinton', 'Northern Alberta'),
  A('Peace River', 'Northern Alberta'),
  A('Slave Lake', 'Northern Alberta'),
];

export const BC_PLACES: OntarioPlace[] = [
  // ---------------- Metro Vancouver ----------------
  A('Vancouver', 'Metro Vancouver', ['yvr', 'downtown vancouver', 'east vancouver']),
  A('Surrey', 'Metro Vancouver'),
  A('Burnaby', 'Metro Vancouver'),
  A('Richmond', 'Metro Vancouver'),
  A('Coquitlam', 'Metro Vancouver', ['port coquitlam', 'tri-cities']),
  A('North Vancouver', 'Metro Vancouver'),
  A('West Vancouver', 'Metro Vancouver'),
  A('New Westminster', 'Metro Vancouver'),
  A('Delta', 'Metro Vancouver'),
  A('Langley', 'Metro Vancouver'),
  A('Port Moody', 'Metro Vancouver'),
  A('Maple Ridge', 'Metro Vancouver'),
  A('White Rock', 'Metro Vancouver'),

  // ---------------- Vancouver Island ----------------
  A('Victoria', 'Vancouver Island', ['saanich', 'esquimalt', 'oak bay']),
  A('Nanaimo', 'Vancouver Island'),
  A('Langford', 'Vancouver Island'),
  A('Courtenay', 'Vancouver Island', ['comox']),
  A('Campbell River', 'Vancouver Island'),
  A('Duncan', 'Vancouver Island'),
  A('Port Alberni', 'Vancouver Island'),
  A('Sidney', 'Vancouver Island'),

  // ---------------- Fraser Valley ----------------
  A('Abbotsford', 'Fraser Valley'),
  A('Chilliwack', 'Fraser Valley'),
  A('Mission', 'Fraser Valley'),
  A('Hope', 'Fraser Valley'),

  // ---------------- Okanagan ----------------
  A('Kelowna', 'Okanagan', ['west kelowna']),
  A('Vernon', 'Okanagan'),
  A('Penticton', 'Okanagan'),
  A('Kamloops', 'Okanagan'),
  A('Salmon Arm', 'Okanagan'),
  A('Osoyoos', 'Okanagan'),

  // ---------------- Northern BC ----------------
  A('Prince George', 'Northern BC'),
  A('Fort St. John', 'Northern BC', ['fort st john']),
  A('Terrace', 'Northern BC'),
  A('Prince Rupert', 'Northern BC'),
  A('Dawson Creek', 'Northern BC'),
  A('Cranbrook', 'Northern BC'),
  A('Nelson', 'Northern BC'),
  A('Trail', 'Northern BC'),
  A('Whistler', 'Northern BC'),
  A('Squamish', 'Northern BC'),
];

export const QUEBEC_PLACES: OntarioPlace[] = [
  // ---------------- Greater Montreal ----------------
  // Accented spellings are handled by the matcher, which strips diacritics
  // before comparing — "Montréal" and "Montreal" both resolve here.
  A('Montreal', 'Greater Montreal', ['montréal', 'ville-marie', 'downtown montreal', 'centre-ville', 'mile end', 'plateau']),
  A('Laval', 'Greater Montreal'),
  A('Longueuil', 'Greater Montreal', ['saint-hubert', 'greenfield park']),
  A('Brossard', 'Greater Montreal'),
  A('Saint-Laurent', 'Greater Montreal', ['ville saint-laurent', 'st-laurent']),
  A('Dorval', 'Greater Montreal'),
  A('Pointe-Claire', 'Greater Montreal', ['pointe claire']),
  A('Terrebonne', 'Greater Montreal'),
  A('Repentigny', 'Greater Montreal'),
  A('Boucherville', 'Greater Montreal'),
  A('Saint-Jérôme', 'Greater Montreal', ['saint jerome', 'st-jerome']),
  A('Vaudreuil-Dorion', 'Greater Montreal', ['vaudreuil']),
  A('Mirabel', 'Greater Montreal'),
  A('Blainville', 'Greater Montreal'),
  A('Mascouche', 'Greater Montreal'),
  A('Saint-Bruno', 'Greater Montreal', ['saint-bruno-de-montarville']),

  // ---------------- Quebec City Region ----------------
  A('Quebec City', 'Quebec City Region', ['québec city', 'ville de québec', 'ville de quebec', 'sainte-foy', 'charlesbourg', 'beauport']),
  A('Lévis', 'Quebec City Region', ['levis']),
  A('Saint-Augustin-de-Desmaures', 'Quebec City Region'),

  // ---------------- Eastern Townships ----------------
  A('Sherbrooke', 'Eastern Townships'),
  A('Granby', 'Eastern Townships'),
  A('Magog', 'Eastern Townships'),
  A('Saint-Hyacinthe', 'Eastern Townships', ['saint hyacinthe']),
  A('Drummondville', 'Eastern Townships'),
  A('Saint-Jean-sur-Richelieu', 'Eastern Townships'),

  // ---------------- Outaouais ----------------
  A('Gatineau', 'Outaouais', ['hull', 'aylmer']),

  // ---------------- Central Quebec ----------------
  A('Trois-Rivières', 'Central Quebec', ['trois rivieres', 'trois-rivieres']),
  A('Shawinigan', 'Central Quebec'),
  A('Victoriaville', 'Central Quebec'),
  A('Saguenay', 'Central Quebec', ['chicoutimi', 'jonquière', 'jonquiere']),
  A('Rimouski', 'Central Quebec'),
  A('Rouyn-Noranda', 'Central Quebec'),
  A('Val-d’Or', 'Central Quebec', ["val-d'or", 'val dor']),
  A('Baie-Comeau', 'Central Quebec'),
  A('Sept-Îles', 'Central Quebec', ['sept-iles', 'sept iles']),
];
