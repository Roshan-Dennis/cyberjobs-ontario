# CyberJobs Ontario

A live cybersecurity job aggregator for **all of Ontario** plus **remote-Canada** roles.

It pulls postings from company career-site APIs, the Government of Canada Job Bank and licensed job-search APIs, then normalises, deduplicates, categorises, enriches and ranks them behind a fast search UI with deep filtering, saved jobs and a market dashboard.

**It runs on nothing.** No server, no database, no paid tier, no third-party account. A GitHub Action collects the postings hourly, bakes them into a JSON file and publishes a static site to GitHub Pages. Search, filtering and faceting run in your browser, so they are instant.

No fabricated data. No scraping of sites that forbid it. Every posting links back to the employer's own application page.

**Live:** https://roshan-dennis.github.io/cyberjobs-ontario/

Current scale: ~11,000 postings fetched per run across 94 verified ATS boards, 21 Workday sites and the federal Job Bank; roughly 90 survive the Ontario-and-cybersecurity filter at any time.

---

## Contents

- [What it does](#what-it-does)
- [Data sources](#data-sources)
- [Why LinkedIn, Indeed and Glassdoor are not indexed](#why-linkedin-indeed-and-glassdoor-are-not-indexed)
- [Architecture](#architecture)
- [How postings persist between runs](#how-postings-persist-between-runs)
- [Geography rules](#geography-rules)
- [Quick start](#quick-start)
- [Deploying](#deploying)
- [What it costs](#what-it-costs)
- [Configuration reference](#configuration-reference)
- [Adding a company board](#adding-a-company-board)
- [Adding a new source](#adding-a-new-source)
- [How the classification works](#how-the-classification-works)
- [Project layout](#project-layout)
- [Operations](#operations)
- [Known gaps and roadmap](#known-gaps-and-roadmap)
- [Legal and ethical position](#legal-and-ethical-position)
- [Licence](#licence)

---

## What it does

**Coverage**

- Every Ontario municipality — cities, towns and smaller communities — via a built-in gazetteer of ~250 places grouped into seven economic regions.
- Remote roles open to anywhere in Canada.
- Internships and co-ops through to CISO.

**Role families**

SOC / security analysis · incident response · threat intelligence · DFIR · vulnerability management · penetration testing and red team · GRC, audit and compliance · IAM and PAM · cloud security · application security · network security · security engineering · DevSecOps · security architecture · OT/ICS security · privacy and data protection · security administration · security leadership · security sales engineering.

Plus a separate **"pathway into cyber"** bucket — help desk, service desk, NOC, systems, network, cloud and DevOps roles with genuine security exposure — flagged so you can include or exclude them with one click.

**Per-posting intelligence**

Title (raw and normalised) · company · location and region · work arrangement · experience level · employment type · date posted · salary when disclosed · source · direct application link · required skills · preferred skills · technologies · certifications · education · years of experience · cybersecurity relevance score.

**Automatic processing**

- Duplicate removal across sources (fingerprint on normalised title + employer + location), with the surviving record listing every other board the role appeared on.
- Expiry detection and repost detection.
- Title normalisation (`Sr. Cyber Sec. Analyst II` → `Senior Cybersecurity Analyst II`).
- Skill, tool and certification extraction with required-vs-preferred separation.
- Relevance scoring and rank blending (relevance + freshness + salary transparency + description depth + geography).
- Aggressive filtering of physical-security / guard postings, which otherwise flood any query containing the word "security".

**UI**

Full-text search with phrase (`"incident response"`) and exclusion (`-senior`) syntax · faceted filters with live counts · sort by best match, newest, oldest, salary or company · pagination or infinite scroll · job detail pages · saved jobs with an application-status tracker and notes · search history · light/dark theme · responsive down to mobile · market dashboard with trends, top certifications, top technologies, top employers and regional breakdown.

---

## Data sources

| Source | Access | Key needed |
|---|---|---|
| **Greenhouse** company boards | Public JSON board API published for careers-page embedding | No |
| **Lever** company boards | Public postings API | No |
| **Ashby** company boards | Public job-board API | No |
| **Workable** company boards | Public careers-widget JSON | No |
| **Recruitee** company boards | Public offers API | No |
| **Workday** career sites | The tenant's own careers page reads this unauthenticated endpoint. **Each tenant's `robots.txt` is fetched and honoured before any request**; tenants that disallow it are skipped and reported. | No |
| **Job Bank** (Government of Canada) | `robots.txt` permits crawling with `Crawl-delay: 5`, which the connector honours. Content is Open Government Licence – Canada. | No |
| **Adzuna Canada** | Official developer API, free tier | `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` |
| **Jooble** | Official partner API, free key | `JOOBLE_API_KEY` |
| **Arbeitnow** | Free public job-board API | No |
| **SmartRecruiters** | *Opt-in only* — their `robots.txt` disallows automated access | `ENABLE_SMARTRECRUITERS=true` |
| **Remotive** | *Opt-in only* — their `robots.txt` disallows automated access | `ENABLE_REMOTIVE=true` |

Run `npm run sources` to print the live status of every connector in your environment. The deployed app shows the same list at `/about`.

The Greenhouse/Lever/Ashby/Workable/Recruitee registry ships with ~180 curated employer boards weighted toward Ontario employers and security vendors (`src/lib/sources/companies.ts`). Tokens that 404 are skipped silently and counted in the run report, so a company changing ATS costs you nothing.

---

## Why LinkedIn, Indeed and Glassdoor are not indexed

These three have no public job-search API available to new developers, and their terms of use prohibit automated collection of search results:

- **LinkedIn** retired public job-search API access; the User Agreement forbids scraping.
- **Indeed** closed its Publisher API to new applicants and prohibits scraping.
- **Glassdoor** offers no job-search API and prohibits scraping.

Rather than pretend otherwise, the app generates **pre-filtered deep links** that open each of those sites with your current keywords, location, experience level and date window already applied — one click from the results page. Google Jobs, GC Jobs and the Ontario Public Service portal are linked the same way.

If you have a licensed commercial feed (Adzuna paid tier, a SerpApi subscription, an Apify actor you are entitled to run), add it as a new connector — the source interface is a single function.

---

## Architecture

```
   GitHub Actions (hourly)
   ────────────────────────────────────────────────────────
    npm run data                       npm run build:static
        │                                      │
   ┌────┴──────────────┐             ┌─────────┴──────────┐
   │ connectors        │             │ Next.js static     │
   │  greenhouse       │  normalise  │ export             │
   │  lever            │  classify   │                    │
   │  ashby       ───▶ │  geo-match  │  index.html        │
   │  workable         │  extract    │  jobs/<id>/…  one  │
   │  recruitee        │  dedupe     │   page per posting │
   │  workday          │  rank       │  data/jobs.json    │
   │  jobbank          │             │   the search index │
   │  adzuna, jooble   │             └─────────┬──────────┘
   └───────────────────┘                       │
              ▲                        deploy to Pages
              │                                │
              │  the previous publish is       ▼
              │  fetched back as the      Browser: fetches data/jobs.json
              └─ carry-forward baseline  once, then filters / sorts /
                 (see below)             facets locally
```

- **Framework** — Next.js 15 (App Router, React 19, TypeScript strict, Tailwind), built with `output: 'export'`.
- **No runtime** — the deployed site is plain HTML, CSS, JS and one JSON file. Nothing to pay for, nothing to keep awake, nothing to secure.
- **Search** — `src/lib/query.ts` is pure TypeScript with no Node dependencies, so the same filtering, sorting and facet-counting code runs in the browser. Changing a filter costs no network round-trip.
- **Job pages** — prerendered at build time, one static page per posting, so every job has a real crawlable URL.
- **Payload size** — the browser downloads `data/jobs.json` with descriptions truncated to 1,200 characters (enough to search against); the full text lives on the prerendered detail pages. That keeps a 100-job set near 200 KB rather than 1 MB.
- **Rate limiting** — per-host request serialisation; `robots.txt` is parsed and cached per origin (`src/lib/robots.ts`).
- **Resilience** — every connector is isolated: a failing source produces an entry in the run report and never aborts the run. Each source has its own time ceiling so one slow site cannot starve the rest.

### Optional: running it with a server and database

The pipeline still supports writing to Supabase Postgres (`supabase/schema.sql`, `src/lib/store/`) via `npm run ingest`, if you would rather run this as a live server-rendered app. That path is not what the published site uses and is not covered by CI.

---

## How postings persist between runs

Each run rebuilds the site from whatever the connectors return at that moment. Left alone, that makes a bad run visible to everyone: Greenhouse is roughly half the dataset, so a single timeout would halve the board for an hour.

There is no database to fall back on — but there does not need to be, because **the previously published JSON is itself the state**. Each run fetches its own last output from the live site, merges the fresh results over it, and republishes.

| Behaviour | Default | Setting |
|---|---|---|
| A posting is dropped this long after a source last returned it | 21 days | `INGEST_RETENTION_DAYS` |
| A posting is marked expired after this long unseen | 3 days | `INGEST_STALE_DAYS` |
| Where the baseline is fetched from | the live site | `PREVIOUS_SNAPSHOT_URL` |

Expiry is shorter than retention on purpose: a vanished posting has probably been filled, so it should grey out quickly but stay searchable for a while.

Two guards make this safe:

- **A sanity check refuses to publish** an empty snapshot, or one where more than half the postings disappeared at once. That pattern means a broken collector, not an empty job market.
- **Carried postings are re-checked against current rules** before merging (`revalidate()` in `src/lib/merge.ts`). Without this, a posting admitted under yesterday's rules keeps its place for the whole retention window, so a classification fix never reaches what is already published. This was not hypothetical — see below.

---

## Geography rules

Ontario borrows heavily from British place names: London, Cambridge, Windsor, Kingston, Stratford, Woodstock, Newmarket. The gazetteer originally matched a city name anywhere in the location string, so **"London, UK" was published as London, Ontario** — at one point 24 of 101 postings on the live site. A reader spotted it within an hour of launch.

Three rules now apply, in order:

1. **A foreign marker beats a city-name match.** `London, UK` and `Hybrid - San Francisco, New York City, London, Berlin` both contain an Ontario city name; neither is in Ontario.
2. **Borrowed names need corroboration.** A bare `Cambridge` is more likely England than Ontario, so it counts only with a Canadian signal in the same string.
3. **Remote-Canada needs real evidence.** A passing mention of "Canada" in a description is not proof a role is open to Canada — plenty of US-only postings say "the US and Canada" in boilerplate. The location field must say Canada, or the text must tie remote and Canada together in the same clause.

A location field naming somewhere outside Canada is decisive: prose cannot argue it back in. Twenty geo cases are locked into the self-test.

---

## Quick start

Requires Node 20+.

```bash
git clone https://github.com/Roshan-Dennis/cyberjobs-ontario.git
cd cyberjobs-ontario
npm install
cp .env.example .env.local     # optional — the app runs without it
npm run data                   # collect postings into data/ and public/data/
npm run dev
```

Open <http://localhost:3000>. `npm run data` is what produces the JSON the UI reads; without it the site loads but shows no postings.

To watch the pipeline directly:

```bash
npm run sources                # which connectors are enabled here
npm run ingest:dry             # fetch + normalise, write nothing
npm run ingest                 # fetch + persist
npm run ingest -- --only greenhouse,lever --budget 120000
```

---

## Deploying

One-time setup, about two minutes. You need nothing but the GitHub account you already have — no card, no signups.

1. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**.
2. **Actions → "Publish to GitHub Pages" → Run workflow.**

The site appears at `https://<your-username>.github.io/<repo>/` and republishes every hour.

### Optional repository variables

Under **Settings → Secrets and variables → Actions → Variables**:

| Variable | When you need it |
|---|---|
| `BASE_PATH` | Set to an empty string for a custom domain or a `<username>.github.io` repo. Defaults to `/<repo>`. |
| `SITE_URL` | Canonical URL for the sitemap. Defaults to the Pages URL. |
| `CRAWLER_CONTACT` | URL or email advertised in the crawler User-Agent. Defaults to your repo URL. |

Optional secrets `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` / `JOOBLE_API_KEY` enable two extra connectors. Everything works without them.

### One caveat worth knowing

GitHub **disables scheduled workflows after 60 days without repository activity**. If you stop touching the repo for two months, hourly publishing pauses until you push a commit or re-enable it. Nothing breaks — the site stays up with its last data.

---

## What it costs

Nothing, and there is no billing relationship to enter into.

| | Free allowance | What this uses |
|---|---|---|
| **GitHub Pages** | 1 GB site, 100 GB/month bandwidth (soft) | A few MB of HTML plus one JSON file |
| **GitHub Actions** | Unlimited minutes on public repositories | ~4 minutes per hourly publish |

No credit card, no account beyond GitHub, no database to keep awake, no function invocations to meter.

The one restriction that exists: GitHub Pages may not be used to run an online business, e-commerce site, or commercial SaaS. A personal job-search tool is none of those. Turning this into a commercial product would need different hosting.

---

## Configuration reference

Every variable is documented inline in [`.env.example`](.env.example). The ones worth knowing:

| Variable | Default | Effect |
|---|---|---|
| `INGEST_MIN_RELEVANCE` | `25` | 0–100 cutoff. Raise to ~40 for security-only results; lower to widen. |
| `INGEST_INCLUDE_PATHWAY` | `true` | Include help desk / NOC / sysadmin stepping-stone roles. |
| `INGEST_ALLOW_REMOTE_CANADA` | `true` | Include remote roles open across Canada, not just Ontario. |
| `INGEST_EXPIRY_DAYS` | `60` | Age at which a posting is marked likely expired. |
| `INGEST_MAX_DURATION_MS` | `240000` | Wall-clock budget per run. Keep below your function timeout. |
| `INGEST_MAX_SOURCE_MS` | `90000` | Ceiling for any one source, so a slow source cannot starve the rest. |
| `INGEST_SOURCES` | *(all)* | Allow-list, e.g. `greenhouse,lever,jobbank`. |
| `INGEST_DISABLED_SOURCES` | *(none)* | Deny-list. |
| `JOBBANK_CRAWL_DELAY_MS` | `5000` | Honours Job Bank's stated `Crawl-delay`. **Do not lower.** |
| `JOBBANK_MAX_QUERIES` | `16` | Number of single-word keyword queries per run. |
| `JOBBANK_FETCH_DETAILS` | `false` | Fetch full descriptions (costs 5s each). |
| `SEARCH_CACHE_TTL` | `60` | Seconds the API may serve a memoised result set. |

---

## Adding a company board

You do not need to fork the code. Find the employer's ATS slug from their careers-page URL and add it to the right variable:

| ATS | Careers URL looks like | Slug |
|---|---|---|
| Greenhouse | `boards.greenhouse.io/**acme**` | `acme` |
| Lever | `jobs.lever.co/**acme**` | `acme` |
| Ashby | `jobs.ashbyhq.com/**acme**` | `acme` |
| Workable | `apply.workable.com/**acme**` | `acme` |
| Recruitee | `**acme**.recruitee.com` | `acme` |

```bash
EXTRA_GREENHOUSE_BOARDS="acme,globex,initech"
EXTRA_LEVER_BOARDS="soylent"
```

To make it permanent, add an entry to the relevant array in `src/lib/sources/companies.ts` and open a PR.

---

## Adding a new source

Implement one interface (`src/lib/sources/types.ts`):

```ts
export const mySource: JobSource = {
  id: 'mysource',
  name: 'My Source',
  access: 'How this source is legitimately accessed — shown in the UI.',
  homepage: 'https://example.com',
  isEnabled: () => Boolean(process.env.MYSOURCE_KEY),
  disabledReason: () => 'Set MYSOURCE_KEY.',
  async fetchJobs(ctx) {
    const data = await fetchJson<Response>('https://example.com/api/jobs');
    return data.jobs.map((j) => ({
      sourceJobId: String(j.id),
      sourceId: 'mysource',
      sourceName: 'My Source',
      sourceUrl: j.url,
      applyUrl: j.applyUrl ?? j.url,
      title: j.title,
      company: j.company,
      locationRaw: j.location,
      description: j.descriptionHtml,
      descriptionIsHtml: true,
      postedAt: j.publishedAt,
    }));
  },
};
```

Register it in `src/lib/sources/registry.ts`. Everything downstream — geo-matching, classification, skill extraction, dedupe, ranking, faceting — happens automatically.

If the source is HTML rather than an API, call `isAllowed(url, false)` from `src/lib/robots.ts` first and `setHostDelay()` with the crawl delay, as `jobbank.ts` does.

---

## How the classification works

`src/lib/normalize/relevance.ts` scores each posting 0–100:

1. **Hard rejections** — physical security ("security guard", "loss prevention", "mobile patrol", "commissionaire"…) and clearly non-technical roles are dropped before scoring. This is the single most important filter: without it, a search for "security" in Ontario returns mostly guard postings.
2. **Title evidence** — a core security title (`security analyst`, `SOC`, `penetration test`, `GRC`, `IAM`, `DFIR`…) is worth 62 points; a weaker signal 28.
3. **Body evidence** — up to 26 points for security terminology density (SIEM, EDR, MITRE ATT&CK, NIST, ISO 27001, incident response…).
4. **Department evidence** — 8 points if the team name is a security team.
5. **Category assignment** — the highest-scoring of 20 category rules wins; runners-up become secondary categories.
6. **Pathway detection** — a non-security title matching the IT-pathway pattern is kept but flagged `isPathwayRole` and penalised in ranking.

`computeRankScore` then blends relevance with freshness (up to +18 for today), salary transparency, description depth and geography.

Tune the cutoff with `INGEST_MIN_RELEVANCE`. Every rejection reason is counted in the ingest report, so `npm run ingest:dry` tells you exactly what is being filtered and why.

---

## Project layout

```
src/
  app/
    page.tsx                    search UI (client-rendered)
    jobs/[id]/page.tsx          job detail, prerendered one per posting
    dashboard/page.tsx          market dashboard
    saved/page.tsx              saved jobs + application tracker
    about/page.tsx              source status and legal position
  components/                   JobBrowser, FilterPanel, SearchBar, charts…
  lib/
    types.ts                    domain model
    config.ts                   env parsing
    http.ts                     retry, timeout, per-host rate limiting
    robots.ts                   robots.txt parser + cache
    ingest.ts                   orchestrator
    query.ts                    filtering, sorting, faceting, URL state
                                (pure — runs in the browser)
    snapshot.ts                 build-time reader for the JSON snapshot
    client/dataset.ts           browser-side loader for the JSON snapshot
    client/storage.ts           saved jobs, search history (localStorage)
    deeplinks.ts                LinkedIn/Indeed/Glassdoor link builder
    sources/                    one file per connector + company registry
    normalize/                  html, dates, salary, extraction, relevance, dedupe
    taxonomy/                   cyber terms, Ontario gazetteer, title rules
    store/                      optional Supabase / file persistence
scripts/
  build-data.ts                 produces the JSON snapshots
  ingest.ts                     CLI ingest into the optional store
  selftest.ts                   86 assertions over the transform layer
  list-sources.ts               connector status
supabase/schema.sql             optional database schema
.github/workflows/
  ci.yml                        typecheck, lint, self-test, build
  pages.yml                     hourly: collect data, export, publish
```

---

## Operations

```bash
npm run sources                # which connectors are enabled here
npm run data                   # collect postings and write both snapshots
npm run data -- --only greenhouse,lever --budget 120000
npm run fixture                # synthetic snapshot, so the site builds offline
npm run selftest               # 139 assertions over the transform layer
npm run publish                # data + static export into out/
```

Every publish prints a per-source table (fetched / kept / duration / error) to the
Actions run summary, so a source that has quietly stopped returning results is
visible at a glance.

**Common issues**

| Symptom | Cause | Fix |
|---|---|---|
| Site shows no jobs | `npm run data` never ran, or the publish failed | Check the latest "Publish to GitHub Pages" run |
| Publish fails with "No postings collected" | Every connector failed — usually no network | Deliberate: it refuses to publish an empty site |
| Data stopped updating | GitHub disabled the schedule after 60 days idle | Push any commit, or re-enable the workflow |
| Many `boards unavailable` | Companies changed ATS | Harmless, but worth pruning — every dead token is an employer whose jobs are never seen. All 179 handles were verified in August 2026 and 109 were dead |
| Job Bank returns 0 | Job Bank throttles some source IPs and answers 503. It works from the Pages runner but not from every CI runner | Expected; the circuit breaker gives up after 6 consecutive failures rather than burning the budget |
| Assets 404 after moving to a custom domain | `basePath` still set to `/<repo>` | Set the `BASE_PATH` repository variable to an empty string |

---

## Known gaps and roadmap

Stated plainly, because they shape what the board can and cannot tell you.

**Entry-level supply is thin.** Typically 4 of ~85 open postings are co-op, entry or junior. Part of that is the real market — Ontario cybersecurity skews senior — but part is structural. The board reaches security vendors and tech companies, which recruit specialists. It reaches the employers who hire juniors and train them (colleges, hospitals, municipalities, MSPs, the provincial government) far less well, because most of them run on Dayforce, SuccessFactors, iCIMS or Taleo, and no connector exists for those yet.

There is a second, subtler cause: junior roles at those employers are titled "IT Support Analyst" and never mention security, so the relevance classifier rejects them. Loosening that rule would surface more entry-level work at the cost of making this partly an IT board. That is a product decision, not a bug.

**Roughly a third of postings state no seniority at all.** They are counted as "Not specified" and are selectable in the experience filter rather than hidden, since excluding them silently removed a third of the board from anyone filtering for junior work.

**Coverage is bounded by the curated board list.** There is no public "list every Greenhouse board" API, so employers have to be discovered. The scaling path, in order of value per unit of effort:

1. **Aggregator APIs.** The Adzuna and Jooble connectors are written and disabled, waiting on free API keys. They do web-scale crawling legally and expose it through an API — the single largest available jump in coverage, for about an hour of setup.
2. **Automated ATS discovery.** Generate candidate tokens from company directories and probe all three ATS APIs, rather than curating by hand.
3. **Generic career-page crawling** via embedded `JSON-LD JobPosting` data, where robots.txt permits. Technically possible, worst effort-to-yield ratio, and needs a daily job rather than an hourly one.

**Geography is Ontario-only by configuration, not by architecture.** The connectors already fetch globally and discard ~99% of what they pull (about 11,000 postings fetched per run, ~90 kept). Extending to another province or country is largely a gazetteer change, not new plumbing.

---

## Legal and ethical position

- Only sources with a vendor-published public API, or whose `robots.txt` permits crawling, are indexed.
- `robots.txt` is fetched, parsed and cached per origin, and **stated crawl delays are honoured**. For HTML crawling, a robots.txt that cannot be read is treated as "not allowed".
- No CAPTCHA solving, no authentication bypass, no anti-bot evasion, no residential proxies.
- Requests carry an identifying User-Agent with a contact URL (`CRAWLER_CONTACT`).
- Sources whose terms currently prohibit automated access are shipped **disabled** and require an explicit opt-in flag.
- No job data is invented. Missing fields are shown as unknown, never guessed.
- Postings link to the employer's own application page; the app is not an intermediary.
- Job Bank content is used under the Open Government Licence – Canada.

If you operate a site indexed here and want it removed, open an issue and it will be dropped.

---

## Licence

MIT — see [LICENSE](LICENSE).

Job posting content belongs to the respective employers and source platforms. This project indexes and links to it; it does not claim ownership.
