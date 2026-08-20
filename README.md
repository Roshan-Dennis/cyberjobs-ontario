# CyberJobs Ontario

A live cybersecurity job aggregator for **all of Ontario** plus **remote-Canada** roles.

It pulls postings from company career-site APIs, the Government of Canada Job Bank and licensed job-search APIs, then normalises, deduplicates, categorises, enriches and ranks them behind a fast search UI with deep filtering, saved jobs and a market dashboard.

No fabricated data. No scraping of sites that forbid it. Every posting links back to the employer's own application page.

---

## Contents

- [What it does](#what-it-does)
- [Data sources](#data-sources)
- [Why LinkedIn, Indeed and Glassdoor are not indexed](#why-linkedin-indeed-and-glassdoor-are-not-indexed)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Deploying to Vercel + Supabase](#deploying-to-vercel--supabase)
- [Scheduled refresh](#scheduled-refresh)
- [What it costs](#what-it-costs)
- [Configuration reference](#configuration-reference)
- [Adding a company board](#adding-a-company-board)
- [Adding a new source](#adding-a-new-source)
- [How the classification works](#how-the-classification-works)
- [Project layout](#project-layout)
- [Operations](#operations)
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
                       ┌───────────────────────────────────────┐
  Vercel Cron ────────▶│  /api/cron/ingest   (auth: CRON_SECRET)│
  GitHub Actions ─────▶└──────────────────┬────────────────────┘
                                          │
                                   runIngest()
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              │                           │                           │
        connectors                   normalise                     persist
   greenhouse / lever /        classify → geo-match →        Supabase Postgres
   ashby / workable /          extract skills, certs,        (or JSON file store
   recruitee / workday /       salary, seniority →           with zero config)
   jobbank / adzuna /          fingerprint → dedupe →
   jooble / arbeitnow          rank
                                          │
                                          ▼
                            ┌──────────────────────────┐
   Browser ◀── /api/jobs ───│  read-through cache (60s) │
              /api/stats    └──────────────────────────┘
              /api/facets
```

- **Framework** — Next.js 15 (App Router, React 19, TypeScript strict, Tailwind).
- **Storage** — Supabase Postgres. The normalised job document lives in a `jsonb` payload with generated columns and GIN/trigram/full-text indexes promoted for querying; see `supabase/schema.sql`.
- **Fallback store** — if no Supabase credentials are present the app uses an in-process + JSON-file store and triggers an ingest on first request, so `git clone && npm run dev` shows real live jobs with zero setup.
- **Search** — filtering, sorting and exact facet counts are computed in a 60-second read-through cache over the active job set. At the scale of a provincial cybersecurity board (thousands of postings) this is faster than round-tripping SQL per keystroke and keeps one implementation of the filter semantics. The SQL indexes are there for direct querying and for when the dataset outgrows that.
- **Rate limiting** — per-host request serialisation with configurable delays; `robots.txt` is parsed and cached per origin (`src/lib/robots.ts`).
- **Resilience** — every connector is isolated: a failing source produces an entry in the run report and never aborts the run. Ingestion respects a wall-clock budget so it always finishes inside the serverless function limit.

---

## Quick start

Requires Node 20+.

```bash
git clone https://github.com/Roshan-Dennis/cyberjobs-ontario.git
cd cyberjobs-ontario
npm install
cp .env.example .env.local     # optional — the app runs without it
npm run dev
```

Open <http://localhost:3000>. The first request kicks off a live ingest; refresh after ten or twenty seconds.

To watch the pipeline directly:

```bash
npm run sources                # which connectors are enabled here
npm run ingest:dry             # fetch + normalise, write nothing
npm run ingest                 # fetch + persist
npm run ingest -- --only greenhouse,lever --budget 120000
```

---

## Deploying to Vercel + Supabase

Both have free tiers sufficient for this workload.

### 1. Create the database

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor** and run the whole of [`supabase/schema.sql`](supabase/schema.sql).
3. From **Project Settings → API**, copy the **Project URL** and the **`service_role`** key.

### 2. Deploy the app

1. Import this repository at <https://vercel.com/new>. Framework preset: **Next.js** (auto-detected).
2. Add environment variables:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | your project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | your `service_role` key |
   | `CRON_SECRET` | any long random string — `openssl rand -hex 32` |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-app>.vercel.app` |
   | `CRAWLER_CONTACT` | a URL or email site operators can reach you at |

3. Deploy.

`vercel.json` already registers the cron job (`/api/cron/ingest`, every 4 hours) and raises that function's timeout to 300s. Vercel picks it up on the first production deploy.

### 3. Seed the first run

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-app>.vercel.app/api/cron/ingest"
```

Then check `https://<your-app>.vercel.app/api/health`.

> **Note on Vercel's Hobby (free) plan:** cron jobs may run **at most once per day**, and a more frequent expression **fails the deployment** with *"Hobby accounts are limited to daily cron jobs"*. `vercel.json` therefore ships with a daily schedule. For a 4-hourly refresh, use the included GitHub Action (option b below) — it costs nothing — or upgrade to Pro and change the schedule to `0 */4 * * *`.

---

## Scheduled refresh

Three options, pick one:

**a) Vercel Cron** — already configured in `vercel.json`. Nothing else to do on Pro.

**b) GitHub Actions pinging your deployment** *(works on Hobby)* — in your repo settings:

- **Variables** → `INGEST_URL` = `https://<your-app>.vercel.app/api/cron/ingest`
- **Secrets** → `CRON_SECRET` = the same value as in Vercel

`.github/workflows/ingest.yml` then runs every 4 hours.

**c) GitHub Actions running the pipeline itself** — set the variable `USE_LOCAL_INGEST=true` and the secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The Action executes the ingest on its own runner (no 300s limit) and writes directly to Supabase.

Trigger any of them manually from the **Actions** tab.

---

## What it costs

Nothing, on the free tiers — with two caveats worth knowing before you start.

| | Free allowance | What this project uses |
|---|---|---|
| **Vercel Hobby** | 1M function invocations, 1M edge requests, 4 CPU-hrs/month | A daily ingest plus normal browsing is a rounding error against these |
| **Supabase Free** | 500 MB database, 5 GB egress, 2 active projects | A few thousand postings with full descriptions is well under 100 MB |
| **GitHub Actions** | Free for public repositories | CI plus a 4-hourly ingest ping |

**Caveat 1 — Vercel Hobby is personal use only.** Vercel's fair-use guidelines restrict the Hobby plan to non-commercial, personal projects. Running this as your own job-search tool is fine. Turning it into a product, putting ads on it, or operating it for an organisation needs Pro ($20/month).

**Caveat 2 — Supabase pauses free projects after 1 week of inactivity.** A daily cron counts as activity, so a deployed instance stays awake on its own. A project you deploy and then ignore for a week will be paused until you restore it from the dashboard.

Neither Adzuna nor Jooble is required; both are optional connectors with free developer tiers if you want the extra coverage.

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
    page.tsx                    search UI (Suspense wrapper)
    jobs/[id]/page.tsx          job detail
    dashboard/page.tsx          market dashboard
    saved/page.tsx              saved jobs + application tracker
    about/page.tsx              live source status and legal position
    api/
      jobs/route.ts             search + facets + deep links
      jobs/[id]/route.ts        single job
      stats/route.ts            dashboard aggregates
      sources/route.ts          connector status
      health/route.ts           liveness + store health
      cron/ingest/route.ts      authenticated refresh trigger
  components/                   JobCard, FilterPanel, SearchBar, charts…
  lib/
    types.ts                    domain model
    config.ts                   env parsing
    http.ts                     retry, timeout, per-host rate limiting
    robots.ts                   robots.txt parser + cache
    ingest.ts                   orchestrator
    cache.ts                    read-through cache + auto-bootstrap
    query.ts                    filtering, sorting, faceting, URL state
    deeplinks.ts                LinkedIn/Indeed/Glassdoor link builder
    sources/                    one file per connector + company registry
    normalize/                  html, dates, salary, extraction, relevance, dedupe
    taxonomy/                   cyber terms, Ontario gazetteer, title rules
    store/                      Supabase and file-backed stores
scripts/                        ingest and source-listing CLIs
supabase/schema.sql             tables, indexes, RLS, retention function
.github/workflows/              CI and scheduled ingest
```

---

## Operations

```bash
# Is it alive, and which store is it using?
curl https://<app>/api/health

# Which connectors are configured?
curl https://<app>/api/sources

# Force a refresh
curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/ingest

# Dry run with full per-source diagnostics
npm run ingest:dry
```

The ingest response includes a per-source report (fetched / kept / duration / error) plus the log lines, so a source that has quietly stopped returning results is obvious.

**Common issues**

| Symptom | Cause | Fix |
|---|---|---|
| Zero jobs after deploy | Ingest has not run yet | Call `/api/cron/ingest` once |
| Jobs appear then vanish on redeploy | No database configured — using the ephemeral file store | Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |
| `401` from the cron endpoint | Missing or wrong `CRON_SECRET` | Check both Vercel and the caller |
| Function timeout during ingest | Budget above the plan's limit | Lower `INGEST_MAX_DURATION_MS`, or split runs with `INGEST_SOURCES` |
| Job Bank returns nothing | Their markup changed, or robots.txt now disallows | Check the run log — the connector reports which |
| Many `boards unavailable` | Companies changed ATS | Harmless; prune `companies.ts` when convenient |

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
