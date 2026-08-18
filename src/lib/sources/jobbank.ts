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

/**
 * Job Bank (Government of Canada). robots.txt at the time of writing is:
 *
 *   User-agent: *
 *   Crawl-delay: 5
 *
 * i.e. crawling is permitted with a five-second delay and no path is
 * disallowed. We re-check robots.txt on every run and abort if that changes.
 * Content is Government of Canada material available under the Open
 * Government Licence – Canada.
 */

interface Query {
  search: string;
  location: string;
  label: string;
}

const QUERIES: Query[] = [
  { search: 'cyber security', location: 'Ontario', label: 'cyber security / ON' },
  { search: 'cybersecurity analyst', location: 'Ontario', label: 'cybersecurity analyst / ON' },
  { search: 'information security', location: 'Ontario', label: 'information security / ON' },
  { search: 'security analyst', location: 'Ontario', label: 'security analyst / ON' },
  { search: 'IT security', location: 'Ontario', label: 'IT security / ON' },
  { search: 'network security', location: 'Ontario', label: 'network security / ON' },
  { search: 'security engineer', location: 'Ontario', label: 'security engineer / ON' },
  { search: 'penetration tester', location: 'Ontario', label: 'penetration tester / ON' },
  { search: 'incident response', location: 'Ontario', label: 'incident response / ON' },
  { search: 'security operations centre', location: 'Ontario', label: 'SOC / ON' },
  { search: 'identity access management', location: 'Ontario', label: 'IAM / ON' },
  { search: 'cloud security', location: 'Ontario', label: 'cloud security / ON' },
  { search: 'information technology support', location: 'Ontario', label: 'IT support / ON' },
  { search: 'systems administrator', location: 'Ontario', label: 'sysadmin / ON' },
  { search: 'network administrator', location: 'Ontario', label: 'network admin / ON' },
  { search: 'cyber security', location: 'Canada', label: 'cyber security / remote CA' },
];

function text($: cheerio.CheerioAPI, el: cheerio.Cheerio<never>, selector: string): string {
  const node = el.find(selector).first();
  if (!node.length) return '';
  node.find('.hidden, .wb-inv, .sr-only').remove();
  return node.text().replace(/\s+/g, ' ').trim();
}

function parseResults(html: string, queryLabel: string): RawJob[] {
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

    const company = text($, article, '.business') || text($, article, 'li.business') || 'Employer not disclosed';
    const location = text($, article, '.location') || text($, article, 'li.location') || 'Ontario, Canada';
    const dateText = text($, article, '.date') || text($, article, 'li.date');
    const salary = text($, article, '.salary') || text($, article, 'li.salary');

    const snippetParts = [
      text($, article, '.summary'),
      text($, article, '.description'),
      article.find('li').map((__, li) => $(li).text().replace(/\s+/g, ' ').trim()).get().join(' · '),
    ].filter(Boolean);

    out.push({
      sourceJobId: id,
      sourceId: 'jobbank',
      sourceName: 'Job Bank (Government of Canada)',
      sourceUrl: url,
      applyUrl: url,
      title,
      company: company.replace(/^Employer:\s*/i, '').trim(),
      locationRaw: location.replace(/^Location:\s*/i, '').trim(),
      description: snippetParts.join('\n'),
      descriptionIsHtml: false,
      postedAt: dateText.replace(/^Posted on\s*/i, '').trim() || null,
      salaryRaw: salary.replace(/^Salary:\s*/i, '').trim() || null,
      remoteHint: /remote|t[eé]l[eé]travail/i.test(`${title} ${location} ${snippetParts.join(' ')}`) || null,
      extra: { query: queryLabel },
    });
  });

  return out;
}

async function fetchDetail(url: string): Promise<{ html: string; posted: string | null } | null> {
  try {
    const html = await fetchText(url, { retries: 1, timeoutMs: 20_000 });
    const $ = cheerio.load(html);
    const body =
      $('.job-posting-detail-requirements').html() ??
      $('#job-posting-detail').html() ??
      $('main').html() ??
      '';
    const posted = $('.date-posted, .job-posting-detail-posted').first().text().replace(/\s+/g, ' ').trim() || null;
    return { html: body, posted };
  } catch {
    return null;
  }
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
    const probe = `${SEARCH}?searchstring=cyber+security&locationstring=Ontario`;
    const verdict = await isAllowed(probe, false);
    if (!verdict.allowed) {
      ctx.log(`jobbank: skipped — ${verdict.reason ?? 'robots.txt disallows'}`);
      return [];
    }

    const delay = Math.max(config.jobbank.crawlDelayMs, verdict.crawlDelayMs ?? 0);
    setHostDelay(HOST, delay);
    ctx.log(`jobbank: crawling with ${delay}ms delay (robots.txt Crawl-delay honoured)`);

    const results: RawJob[] = [];
    const queries = QUERIES.slice(0, Math.max(1, config.jobbank.maxQueries));

    for (const query of queries) {
      if (ctx.deadline.expired) {
        ctx.log('jobbank: stopped early (time budget)');
        break;
      }
      for (let page = 1; page <= config.jobbank.maxPagesPerQuery; page += 1) {
        if (ctx.deadline.expired) break;
        const url = `${SEARCH}?searchstring=${encodeURIComponent(query.search)}&locationstring=${encodeURIComponent(query.location)}&sort=M&page=${page}`;
        try {
          const html = await fetchText(url, { retries: 1, timeoutMs: 25_000 });
          const parsed = parseResults(html, query.label);
          results.push(...parsed);
          if (parsed.length === 0) break;
        } catch (err) {
          ctx.log(`jobbank "${query.label}" p${page}: ${err instanceof Error ? err.message : String(err)}`);
          break;
        }
      }
    }

    const unique = dedupeRaw(results);

    if (config.jobbank.fetchDetails && !ctx.deadline.expired) {
      const targets = unique.slice(0, 25);
      for (const job of targets) {
        if (ctx.deadline.expired) break;
        const detail = await fetchDetail(job.sourceUrl);
        if (detail?.html) {
          job.description = detail.html;
          job.descriptionIsHtml = true;
        }
        if (detail?.posted) job.postedAt = detail.posted;
      }
    }

    for (const j of unique) delete j.extra;
    return unique;
  },
};
