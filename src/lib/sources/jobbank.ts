import * as cheerio from 'cheerio';
import { config } from '@/lib/config';
import { fetchText, setHostDelay } from '@/lib/http';
import { isAllowed } from '@/lib/robots';
import type { JobSource, SourceContext } from '@/lib/sources/types';
import { dedupeRaw } from '@/lib/sources/types';
import type { RawJob } from '@/lib/types';

const HOST = 'www.jobbank.gc.ca';
const ORIGIN = `https://${HOST}`;
const SEARCH = `${ORIGIN}/jobsearch/jobsearch`;
const FEED = `${ORIGIN}/jobsearch/feed/jobSearchRSSfeed`;

/**
 * Job Bank (Government of Canada).
 *
 * robots.txt at the time of writing is:
 *
 *   User-agent: *
 *   Crawl-delay: 5
 *
 * i.e. crawling is permitted with a five-second delay and no path is
 * disallowed. We re-check robots.txt on every run and abort if that changes.
 * Content is Government of Canada material available under the Open
 * Government Licence – Canada.
 *
 * IMPORTANT — single-word queries only.
 * `searchstring` must be a single token. Job Bank reinterprets a multi-word
 * value as an *employer name* ("cyber security" renders as the filter chip
 * `Employer:cyber security`) and returns zero results. The first live run used
 * phrases like "cyber security" and "incident response" and consequently
 * fetched nothing at all from this source despite crawling successfully for
 * 36 seconds. Keep every entry in TOKENS a single word.
 */

interface Query {
  token: string;
  location: string;
  province: string | null;
}

/** Single-token keywords. Noise is fine — the relevance classifier filters it. */
export const TOKENS = [
  'cybersecurity',
  'security',
  'cyber',
  'infosec',
  'SOC',
  'SIEM',
  'firewall',
  'forensic',
  'penetration',
  'vulnerability',
  'compliance',
  'helpdesk',
  'sysadmin',
];

function buildQueries(): Query[] {
  const queries: Query[] = TOKENS.map((token) => ({ token, location: 'Ontario', province: 'ON' }));
  // A couple of Canada-wide passes to pick up remote roles.
  queries.push({ token: 'cybersecurity', location: 'Canada', province: null });
  queries.push({ token: 'security', location: 'Canada', province: null });
  return queries;
}

/* ------------------------------------------------------------------ */
/* HTML search results                                                 */
/* ------------------------------------------------------------------ */

function text($: cheerio.CheerioAPI, el: cheerio.Cheerio<never>, selector: string): string {
  const node = el.find(selector).first();
  if (!node.length) return '';
  node.find('.hidden, .wb-inv, .sr-only').remove();
  return node.text().replace(/\s+/g, ' ').trim();
}

/**
 * Result markup (verified against the live site):
 *   article.action-buttons > a.resultJobItem
 *     h3.title > span.noctitle              -> job title
 *     ul.list-unstyled > li.date            -> "Posted on <date>"
 *                       > li.business       -> employer
 *                       > li.location       -> location
 *                       > li.salary         -> salary
 */
function parseSearchHtml(html: string): RawJob[] {
  const $ = cheerio.load(html);
  const out: RawJob[] = [];

  const items = $('article').filter((_, el) => $(el).find('a[href*="/jobsearch/jobposting/"]').length > 0);

  items.each((_, el) => {
    const article = $(el) as unknown as cheerio.Cheerio<never>;
    const anchor = article.find('a[href*="/jobsearch/jobposting/"]').first();
    const href = anchor.attr('href') ?? '';
    const idMatch = /\/jobposting\/(\d+)/.exec(href);
    if (!idMatch) return;
    const id = idMatch[1];
    const url = href.startsWith('http') ? href.split('?')[0] : `${ORIGIN}${href.split('?')[0]}`;

    let title = text($, article, '.noctitle') || text($, article, 'h3') || anchor.text().replace(/\s+/g, ' ').trim();
    title = title.replace(/^\s*\d+\s*/, '').trim();
    if (!title) return;

    const company = text($, article, 'li.business') || text($, article, '.business') || 'Employer not disclosed';
    const location = text($, article, 'li.location') || text($, article, '.location') || 'Ontario, Canada';
    const dateText = text($, article, 'li.date') || text($, article, '.date');
    const salary = text($, article, 'li.salary') || text($, article, '.salary');

    const snippet = article
      .find('li')
      .map((__, li) => $(li).text().replace(/\s+/g, ' ').trim())
      .get()
      .filter(Boolean)
      .join(' · ');

    out.push({
      sourceJobId: id,
      sourceId: 'jobbank',
      sourceName: 'Job Bank (Government of Canada)',
      sourceUrl: url,
      applyUrl: url,
      title,
      company: company.replace(/^Employer:\s*/i, '').trim(),
      locationRaw: location.replace(/^Location:\s*/i, '').trim(),
      description: snippet,
      descriptionIsHtml: false,
      postedAt: dateText.replace(/^Posted on\s*/i, '').trim() || null,
      salaryRaw: salary.replace(/^Salary:\s*/i, '').trim() || null,
      remoteHint: /remote|t[eé]l[eé]travail/i.test(`${title} ${location} ${snippet}`) || null,
    });
  });

  return out;
}

/* ------------------------------------------------------------------ */
/* Atom feed                                                           */
/* ------------------------------------------------------------------ */

/**
 * Job Bank publishes the same search as an Atom feed. Each entry carries a
 * title, link, updated timestamp and a summary of the form:
 *
 *   <strong>Job number:</strong> 3650182<br>
 *   <strong>Location:</strong> Toronto (ON)<br>
 *   <strong>Employer:</strong> Adisoft Inc<br>
 *   <strong>Salary:</strong> $60.00 to $120.00 hourly
 *
 * This is structurally stable, so it is used as a fallback whenever the HTML
 * parser comes back empty — if Job Bank restyles their results page the
 * connector degrades to the feed instead of silently returning nothing.
 */
/** Exported for the pipeline self-test. */
export function parseFeed(xml: string): RawJob[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const out: RawJob[] = [];

  $('entry').each((_, el) => {
    const entry = $(el);
    const title = entry.find('title').first().text().trim();
    const href = entry.find('link').first().attr('href') ?? entry.find('id').first().text().trim();
    const idMatch = /\/jobposting\/(\d+)/.exec(href);
    if (!title || !idMatch) return;

    const summary = entry.find('summary').first().text();
    const field = (label: string): string | null => {
      const re = new RegExp(`<strong>\\s*${label}\\s*:?\\s*</strong>\\s*([^<]*)`, 'i');
      const m = re.exec(summary);
      return m?.[1]?.replace(/\s+/g, ' ').trim() || null;
    };

    const location = field('Location');
    const employer = field('Employer');
    const salary = field('Salary');

    out.push({
      sourceJobId: idMatch[1],
      sourceId: 'jobbank',
      sourceName: 'Job Bank (Government of Canada)',
      sourceUrl: href.split('?')[0],
      applyUrl: href.split('?')[0],
      title,
      company: employer || 'Employer not disclosed',
      locationRaw: location && location !== 'Not Available' ? location : 'Ontario, Canada',
      description: summary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      descriptionIsHtml: false,
      postedAt: entry.find('updated').first().text().trim() || null,
      salaryRaw: salary,
      remoteHint: /remote|t[eé]l[eé]travail/i.test(`${title} ${location ?? ''}`) || null,
    });
  });

  return out;
}

export const jobBankSource: JobSource = {
  id: 'jobbank',
  name: 'Job Bank (Government of Canada)',
  access:
    'Public federal job board. robots.txt permits crawling with Crawl-delay: 5, which this connector honours; content is available under the Open Government Licence – Canada.',
  homepage: 'https://www.jobbank.gc.ca',
  isEnabled: () => config.jobbank.enabled,
  disabledReason: () => 'Set JOBBANK_ENABLED=true to include Job Bank.',
  async fetchJobs(ctx: SourceContext): Promise<RawJob[]> {
    const probe = `${SEARCH}?searchstring=security&locationstring=Ontario`;
    const verdict = await isAllowed(probe, false);
    if (!verdict.allowed) {
      ctx.log(`jobbank: skipped — ${verdict.reason ?? 'robots.txt disallows'}`);
      return [];
    }

    const delay = Math.max(config.jobbank.crawlDelayMs, verdict.crawlDelayMs ?? 0);
    setHostDelay(HOST, delay);

    // Job Bank is the slowest source by a wide margin: every request costs the
    // five-second crawl delay, and the site intermittently answers 503 under
    // sustained access (observed consistently from CI runners). Requests, not
    // postings, are the scarce resource here — so:
    //
    //   * retries are off. A retry costs another full crawl delay plus backoff
    //     for a request that is being throttled anyway; spending that on the
    //     next token yields more.
    //   * the token list is rotated by the hour, so consecutive scheduled runs
    //     start at different keywords. A single run only gets through part of
    //     the list, but the store accumulates across runs, so over a day the
    //     whole list is covered.
    //   * per token we try the results page first (~25 rows/request against the
    //     feed's ~14) and fall back to the feed only for tokens where the page
    //     yielded nothing. That way a failure costs one extra request instead
    //     of leaving the token uncovered.
    const all = buildQueries();
    const offset = new Date().getUTCHours() % all.length;
    const queries = [...all.slice(offset), ...all.slice(0, offset)].slice(
      0,
      Math.max(1, config.jobbank.maxQueries),
    );
    ctx.log(`jobbank: ${delay}ms delay (robots.txt Crawl-delay honoured), starting at token "${queries[0]?.token}"`);

    const results: RawJob[] = [];
    let htmlHits = 0;
    let feedHits = 0;
    let requests = 0;
    let covered = 0;
    let consecutiveFailures = 0;
    let anySuccess = false;

    for (const query of queries) {
      if (ctx.deadline.expired) break;

      // Circuit breaker. Job Bank blocks some source IPs outright — from GitHub
      // Actions runners every request now answers 503. Without this the source
      // spends its entire 90s budget collecting nothing, which is time the other
      // connectors could have used. Six failures with no success means this
      // vantage point is blocked; stop rather than keep paying the crawl delay.
      if (!anySuccess && consecutiveFailures >= 6) {
        ctx.log('jobbank: aborting — 6 consecutive failures with no success, this IP looks blocked');
        break;
      }

      covered += 1;

      let got = 0;
      const url =
        `${SEARCH}?searchstring=${encodeURIComponent(query.token)}` +
        `&locationstring=${encodeURIComponent(query.location)}&sort=M&page=1`;
      try {
        requests += 1;
        const parsed = parseSearchHtml(await fetchText(url, { retries: 0, timeoutMs: 20_000 }));
        got = parsed.length;
        htmlHits += got;
        results.push(...parsed);
        anySuccess = true;
        consecutiveFailures = 0;
      } catch (err) {
        consecutiveFailures += 1;
        ctx.log(`jobbank html "${query.token}": ${err instanceof Error ? err.message : String(err)}`);
      }

      if (got > 0 || ctx.deadline.expired) continue;

      const params = new URLSearchParams({ searchstring: query.token, sort: 'M', rows: '100' });
      if (query.province) params.set('fprov', query.province);
      try {
        requests += 1;
        const parsed = parseFeed(await fetchText(`${FEED}?${params.toString()}`, { retries: 0, timeoutMs: 20_000 }));
        feedHits += parsed.length;
        results.push(...parsed);
        anySuccess = true;
        consecutiveFailures = 0;
      } catch (err) {
        consecutiveFailures += 1;
        ctx.log(`jobbank feed "${query.token}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const unique = dedupeRaw(results);
    ctx.log(
      `jobbank: ${unique.length} unique from ${requests} requests across ${covered}/${all.length} tokens ` +
        `(${htmlHits} via results page, ${feedHits} via Atom feed)`,
    );
    return unique;
  },
};
