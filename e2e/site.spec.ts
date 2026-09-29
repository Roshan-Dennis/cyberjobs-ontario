import { expect, test, type Page } from '@playwright/test';

/**
 * Clicks every control on the site and checks each one does what it says.
 * Written after a manual click-through of the live board turned up a dozen
 * defects that unit tests could not see (filters acting like radio buttons,
 * certification tags matching nothing, a pager that left you at the bottom).
 *
 * Runs against the fixture snapshot: `npm run fixture && npm run build:static`.
 */

const errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|404 \(Not Found\)/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
});

test.afterEach(() => {
  expect(errors, 'no JavaScript errors on the page').toEqual([]);
});

const filters = (page: Page) => page.locator('aside[aria-label="Filters"]');
const cards = (page: Page) => page.locator('article');

async function count(page: Page): Promise<number> {
  const el = page.getByTestId('result-count');
  await expect(el).toContainText('jobs');
  return Number((await el.innerText()).replace(/[^\d]/g, ''));
}

/** Open a sidebar group if it is collapsed. */
async function openSection(page: Page, title: RegExp) {
  const header = filters(page).getByRole('button', { name: title });
  if ((await header.getAttribute('aria-expanded')) === 'false') await header.click();
}

async function home(page: Page, qs = '') {
  await page.goto(qs ? `./?${qs}` : './');
  await expect(cards(page).first()).toBeVisible();
}

test.describe('header', () => {
  test('every nav link lands on its page', async ({ page }) => {
    await home(page);
    const nav = page.locator('header');
    for (const [name, heading] of [
      ['Dashboard', /Market dashboard/],
      ['Saved', /Saved jobs/],
      ['Sources', /./],
      ['Jobs', /Cybersecurity jobs/],
    ] as const) {
      await nav.getByRole('link', { name, exact: true }).click();
      await expect(page.locator('main h1').first()).toHaveText(heading);
    }
    await page.goto('./saved/');
    await nav.getByRole('link', { name: /home/ }).click();
    await expect(page.locator('main h1').first()).toHaveText(/Cybersecurity jobs/);
  });

  test('theme toggle switches and persists across reload', async ({ page }) => {
    await home(page);
    const html = page.locator('html');
    const before = (await html.getAttribute('class'))?.includes('dark') ?? false;
    await page.locator('header').getByRole('button', { name: /theme/ }).click();
    await expect(html).toHaveClass(before ? /^(?!.*dark)/ : /dark/);
    await page.reload();
    await expect(html).toHaveClass(before ? /^(?!.*dark)/ : /dark/);
  });
});

test.describe('search', () => {
  test('typed search, phrase, exclusion and no-results state', async ({ page }) => {
    await home(page);
    const all = await count(page);
    const box = page.getByRole('searchbox', { name: /Search cybersecurity jobs/ });

    await box.fill('penetration');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page).toHaveURL(/q=penetration/);
    const pen = await count(page);
    expect(pen).toBeGreaterThan(0);
    expect(pen).toBeLessThan(all);
    for (const t of await cards(page).locator('h3').allInnerTexts()) expect(t.toLowerCase()).toContain('penetration');

    await box.fill('analyst -senior');
    await box.press('Enter');
    await expect(page).toHaveURL(/q=analyst/);
    for (const t of await cards(page).locator('h3').allInnerTexts()) expect(t.toLowerCase()).not.toContain('senior');

    await box.fill('"incident response"');
    await box.press('Enter');
    expect(await count(page)).toBeGreaterThan(0);

    await box.fill('zzzqqqxx');
    await box.press('Enter');
    await expect(page.getByText('No postings match these filters.')).toBeVisible();
    await page.getByRole('main').getByRole('button', { name: 'Clear all filters' }).last().click();
    await expect.poll(() => count(page)).toBe(all);
  });

  test('suggestion chips, recent searches and clearing history', async ({ page }) => {
    await home(page);
    const box = page.getByRole('searchbox', { name: /Search cybersecurity jobs/ });
    await box.click();
    await page.getByRole('button', { name: 'cloud security', exact: true }).click();
    await expect(page).toHaveURL(/q=cloud\+security|q=cloud%20security/);
    await expect(box).toHaveValue('cloud security');

    await page.goto('./');
    await box.click();
    await expect(page.getByText('Recent searches')).toBeVisible();
    await page.getByRole('button', { name: /cloud security.*hits/ }).click();
    await expect(page).toHaveURL(/q=cloud/);

    await box.click();
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(page.getByText('Recent searches')).toHaveCount(0);
  });
});

test.describe('filters', () => {
  test('every section header collapses and expands', async ({ page }) => {
    await home(page);
    const headers = filters(page).locator('section > button[aria-expanded]');
    const n = await headers.count();
    expect(n).toBeGreaterThan(8);
    for (let i = 0; i < n; i += 1) {
      const h = headers.nth(i);
      const was = await h.getAttribute('aria-expanded');
      await h.click();
      await expect(h).toHaveAttribute('aria-expanded', was === 'true' ? 'false' : 'true');
      await h.click();
      await expect(h).toHaveAttribute('aria-expanded', was ?? 'true');
    }
  });

  test('every checkbox in every group narrows results and unticks cleanly', async ({ page }) => {
    test.setTimeout(300_000);
    await home(page);
    const all = await count(page);
    // Expand everything so every checkbox is reachable.
    const headers = filters(page).locator('section > button[aria-expanded="false"]');
    while ((await headers.count()) > 0) await headers.first().click();
    const more = filters(page).getByRole('button', { name: /^Show \d+ more$/ });
    while ((await more.count()) > 0) await more.first().click();

    // Address each box by its form name/value: ticking one filter legitimately
    // removes options from other groups, so positions shift between clicks.
    const ids = await filters(page).locator('input[type=checkbox]').evaluateAll((els) =>
      els.map((e) => {
        const i = e as HTMLInputElement;
        return { name: i.name, value: i.getAttribute('value'), label: (i.parentElement?.textContent ?? '').trim() };
      }),
    );
    expect(ids.length).toBeGreaterThan(30);
    expect(ids.every((i) => i.name), 'every checkbox has a form name').toBe(true);
    for (const { name, value, label } of ids) {
      const box = filters(page).locator(value ? `input[name="${name}"][value="${value.replace(/"/g, '\\"')}"]` : `input[name="${name}"]`);
      await box.click();
      await expect(box, `${label} stays ticked`).toBeChecked();
      const n = await count(page);
      // "Include expired" is the one option allowed to widen the board.
      if (name !== 'includeExpired') expect(n, `${label} narrows`).toBeLessThanOrEqual(all);
      await expect(filters(page).getByRole('button', { name: 'Clear all filters' })).toBeEnabled();
      await box.click();
      await expect(box).not.toBeChecked();
      await expect.poll(() => count(page), { message: `${label} unticks back to all` }).toBe(all);
    }
  });

  test('multi-select within a group keeps the other options (regression)', async ({ page }) => {
    await home(page);
    await openSection(page, /Experience level/);
    const exp = filters(page).locator('section', { has: page.getByText('Experience level') });
    const optionsBefore = await exp.getByRole('checkbox').count();
    expect(optionsBefore).toBeGreaterThan(2);
    await exp.getByRole('checkbox').nth(0).click();
    await expect(exp.getByRole('checkbox').nth(0)).toBeChecked();
    await expect(exp.getByRole('checkbox')).toHaveCount(optionsBefore);
    const one = await count(page);
    await exp.getByRole('checkbox').nth(1).click();
    await expect(exp.getByRole('checkbox').nth(0)).toBeChecked();
    await expect(exp.getByRole('checkbox').nth(1)).toBeChecked();
    expect(await count(page)).toBeGreaterThan(one);
  });

  test('date chips, custom range and Clear all', async ({ page }) => {
    await home(page);
    const all = await count(page);
    const panel = filters(page);
    let prev = 0;
    for (const chip of ['Today', '3 days', '7 days', '14 days', '30 days']) {
      await panel.getByRole('button', { name: chip, exact: true }).click();
      await expect(panel.getByRole('button', { name: chip, exact: true })).toHaveAttribute('aria-pressed', 'true');
      const n = await count(page);
      expect(n, `${chip} is at least as wide as the previous chip`).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
    await panel.getByRole('button', { name: 'Any time', exact: true }).click();
    await expect.poll(() => count(page)).toBe(all);

    const from = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
    await panel.getByLabel('From', { exact: true }).fill(from);
    await expect(page).toHaveURL(/from=/);
    expect(await count(page)).toBeLessThan(all);
    await expect(panel.getByRole('button', { name: 'Any time', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await panel.getByLabel('To', { exact: true }).fill(new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10));
    await expect(page).toHaveURL(/to=/);

    // Regression: Clear all used to stay disabled with only a custom range.
    const clear = panel.getByRole('button', { name: 'Clear all filters' });
    await expect(clear).toBeEnabled();
    await clear.click();
    await expect.poll(() => count(page)).toBe(all);
    await expect(panel.getByLabel('From', { exact: true })).toHaveValue('');
  });

  test('salary box waits for typing to finish', async ({ page }) => {
    await home(page);
    await openSection(page, /Salary/);
    const box = filters(page).getByLabel('Minimum annual salary (CAD)');
    await box.pressSequentially('100000', { delay: 40 });
    await expect(page).toHaveURL(/salaryMin=100000/);
    const n = await count(page);
    expect(n).toBeGreaterThan(0);
    for (const s of await cards(page).locator('.text-good').allInnerTexts()) expect(s).toMatch(/\$/);
    // Only the final value reached history, not 1, 10, 100…
    const history = await page.evaluate(() => JSON.parse(localStorage.getItem('cjo-history') ?? '[]'));
    expect(history.filter((h: { params: string }) => /salaryMin=(1|10|100|1000|10000)(&|$)/.test(h.params))).toEqual([]);
  });
});

test.describe('results toolbar', () => {
  test('every sort option orders correctly', async ({ page }) => {
    await home(page);
    const sort = page.getByLabel('Sort');
    for (const v of ['newest', 'oldest', 'salary', 'company', 'relevance']) {
      await sort.selectOption(v);
      if (v !== 'relevance') await expect(page).toHaveURL(new RegExp(`sort=${v}`));
    }
    await sort.selectOption('company');
    await expect(page).toHaveURL(/sort=company/);
    await expect(cards(page).first().locator('p span.font-medium')).toHaveText(/^[0-9A-Da-d]/);
    const companies = await cards(page).locator('p span.font-medium').allInnerTexts();
    expect(companies).toEqual([...companies].sort((a, b) => a.localeCompare(b)));

    await sort.selectOption('salary');
    // Regression: an annual salary read as hourly used to top this list at $61,000/hr.
    await expect(cards(page).first().locator('.text-good')).not.toContainText('/hr');
  });

  test('per-page sizes and pagination', async ({ page }) => {
    await home(page);
    const all = await count(page);
    for (const size of [10, 50, 100, 25]) {
      await page.getByLabel('Per page').selectOption(String(size));
      await expect(cards(page)).toHaveCount(Math.min(size, all));
    }
    await page.getByLabel('Per page').selectOption('10');
    const pager = page.getByRole('navigation', { name: 'Pagination' });
    await expect(pager.getByRole('button', { name: '← Prev' })).toBeDisabled();
    const firstTitle = await cards(page).first().locator('h3').innerText();

    await pager.getByRole('button', { name: 'Next →' }).scrollIntoViewIfNeeded();
    await pager.getByRole('button', { name: 'Next →' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(cards(page).first().locator('h3')).not.toHaveText(firstTitle);
    // Regression: the new page used to open scrolled to its bottom.
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(600);

    await pager.getByRole('button', { name: '← Prev' }).click();
    await expect(page).not.toHaveURL(/page=2/);
    const last = Math.ceil(all / 10);
    await pager.getByRole('button', { name: String(last), exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`page=${last}`));
    await expect(pager.getByRole('button', { name: 'Next →' })).toBeDisabled();
    // Every page between is reachable without a gap hiding a single page.
    const labels = await pager.innerText();
    expect(labels).not.toMatch(/1\s*…\s*3/);
  });

  test('infinite scroll loads more cards and hides the pager', async ({ page }) => {
    await home(page);
    await page.getByLabel('Per page').selectOption('10');
    await page.getByLabel('Infinite scroll').check();
    await expect(page.getByRole('navigation', { name: 'Pagination' })).toHaveCount(0);
    await expect(cards(page)).toHaveCount(10);
    await page.mouse.wheel(0, 20000);
    await expect.poll(() => cards(page).count()).toBeGreaterThan(10);
  });
});

test.describe('job cards', () => {
  test('certification tag filters by certification (regression)', async ({ page }) => {
    await home(page);
    const tag = cards(page).locator('button.tag-cert').first();
    const cert = await tag.innerText();
    await tag.click();
    await expect(page).toHaveURL(/cert=/);
    const n = await count(page);
    expect(n, `${cert} returns postings`).toBeGreaterThan(0);
    await expect(filters(page).getByRole('checkbox', { name: new RegExp(cert.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toBeChecked();
  });

  test('tool tag filters by skill and the ticked skill stays visible', async ({ page }) => {
    await home(page);
    const tag = cards(page).locator('button.tag-button').first();
    const skill = await tag.innerText();
    await tag.click();
    await expect(page).toHaveURL(/skill=/);
    expect(await count(page)).toBeGreaterThan(0);
    const box = filters(page).getByRole('checkbox', { name: new RegExp(`^${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) });
    await expect(box).toBeVisible();
    await box.click();
    await expect(page).not.toHaveURL(/skill=/);
  });

  test('save, details and apply buttons', async ({ page, context }) => {
    await home(page);
    const card = cards(page).first();
    const title = await card.locator('h3').innerText();
    const save = card.getByRole('button', { name: /Save/ });
    await save.click();
    await expect(save).toHaveAttribute('aria-pressed', 'true');
    await save.click();
    await expect(save).toHaveAttribute('aria-pressed', 'false');

    const apply = card.getByRole('link', { name: /Apply/ });
    await expect(apply).toHaveAttribute('target', '_blank');
    await expect(apply).toHaveAttribute('href', /^https?:\/\//);

    await card.getByRole('link', { name: 'Details' }).click();
    await expect(page.locator('main h1')).toHaveText(title);
    void context;
  });

  test('company with a comma in its name can be filtered (regression)', async ({ page }) => {
    await home(page, 'company=' + encodeURIComponent('Remarcable, Inc.'));
    expect(await count(page)).toBeGreaterThan(0);
    await expect(cards(page).first()).toContainText('Remarcable, Inc.');
  });

  test('lowercase Job Bank titles are title-cased', async ({ page }) => {
    await home(page, 'q=informatics');
    await expect(cards(page).first().locator('h3')).toHaveText('Informatics Security Consultant');
  });
});

test.describe('job detail page', () => {
  test('back link restores the search, save and apply work', async ({ page }) => {
    await home(page, 'arrangement=remote');
    const remoteCount = await count(page);
    await cards(page).first().getByRole('link', { name: 'Details' }).click();
    const aside = page.locator('main aside');
    await expect(aside.getByRole('link', { name: /Apply on/ })).toHaveAttribute('href', /^https?:\/\//);
    const save = aside.getByRole('button', { name: /Save/ });
    await save.click();
    await expect(save).toHaveText(/Saved/);
    await expect(aside.getByText('At a glance')).toBeVisible();

    // Regression: this link used to drop every filter.
    await page.getByRole('link', { name: '← Back to search' }).click();
    await expect(page).toHaveURL(/arrangement=remote/);
    expect(await count(page)).toBe(remoteCount);
  });

  test('unknown posting shows the 404 page with a way back', async ({ page }) => {
    const res = await page.goto('./jobs/does-not-exist/');
    expect(res?.status()).toBe(404);
    await expect(page.getByText('Not found')).toBeVisible();
    await page.getByRole('link', { name: 'Back to job search' }).click();
    await expect(cards(page).first()).toBeVisible();
    errors.length = 0; // the 404 response itself is logged by the browser
  });
});

test.describe('deep links', () => {
  test('outbound search links carry the filters', async ({ page }) => {
    await home(page, 'q=SOC&province=AB');
    const links = page.locator('section', { hasText: 'Search these sites' }).getByRole('link');
    expect(await links.count()).toBeGreaterThan(4);
    for (const l of await links.all()) {
      await expect(l).toHaveAttribute('target', '_blank');
      await expect(l).toHaveAttribute('href', /^https:\/\//);
    }
    const li = await page.getByRole('link', { name: /LinkedIn/ }).getAttribute('href');
    expect(new URL(li!).searchParams.get('location')).toBe('Alberta, Canada');
    expect(new URL(li!).searchParams.get('keywords')).toBe('SOC');
  });
});

test.describe('dashboard', () => {
  test('stats render and every bar link opens a non-empty result', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('./dashboard/');
    await expect(page.getByText('Open postings')).toBeVisible();
    await page.getByText('View as table').click();
    await expect(page.locator('table')).toBeVisible();
    // The chart's last label is today (UTC), not yesterday.
    const today = new Date().toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    await expect(page.locator('figcaption span').last()).toHaveText(today);

    const hrefs = await page.locator('main section li a').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!));
    expect(hrefs.length).toBeGreaterThan(20);
    for (const href of [...new Set(hrefs)]) {
      await page.goto(href.replace(/^\/cyberjobs-ontario\//, './'));
      await expect.poll(() => count(page), { message: `${decodeURIComponent(href)} has results` }).toBeGreaterThan(0);
    }
  });
});

test.describe('saved jobs', () => {
  test('status, notes, filter chips, remove, clear all and history', async ({ page }) => {
    await home(page, 'q=analyst');
    for (let i = 0; i < 3; i += 1) await cards(page).nth(i).getByRole('button', { name: /Save/ }).click();
    await page.locator('header').getByRole('link', { name: 'Saved', exact: true }).click();
    const items = page.locator('main ul > li.card');
    await expect(items).toHaveCount(3);

    await items.first().getByRole('combobox').selectOption('applied');
    await page.getByRole('button', { name: /^applied \(1\)$/ }).click();
    await expect(items).toHaveCount(1);
    await page.getByRole('button', { name: /^offer \(0\)$/ }).click();
    // Regression: an empty status filter used to claim nothing was saved.
    await expect(page.getByText(/No saved jobs marked/)).toBeVisible();
    await page.getByRole('button', { name: 'Show all saved jobs' }).click();
    await expect(items).toHaveCount(3);

    const note = items.first().getByPlaceholder(/Notes/);
    await note.fill('Emailed the recruiter');
    await note.blur();
    await page.reload();
    await expect(items.first().getByPlaceholder(/Notes/)).toHaveValue('Emailed the recruiter');
    await expect(items.first().getByRole('combobox')).toHaveValue('applied');

    await expect(items.first().getByRole('link', { name: /Apply/ })).toHaveAttribute('href', /^https?:\/\//);
    await items.first().locator('h2 a').click();
    await expect(page.locator('main h1')).toBeVisible();
    await page.goBack();

    await items.first().getByRole('button', { name: /Remove/ }).click();
    await expect(items).toHaveCount(2);

    const historyLink = page.locator('section', { hasText: 'Search history' }).getByRole('link').first();
    await expect(historyLink).toBeVisible();
    await historyLink.click();
    await expect(cards(page).first()).toBeVisible();
    await page.goto('./saved/');
    await page.locator('section', { hasText: 'Search history' }).getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByText('Search history')).toHaveCount(0);

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect(page.getByText('Nothing saved yet.')).toBeVisible();
    await page.getByRole('link', { name: 'Browse jobs' }).click();
    await expect(cards(page).first()).toBeVisible();
  });

  test('a saved posting that left the board does not link to a 404', async ({ page }) => {
    await page.goto('./saved/');
    await page.evaluate(() =>
      localStorage.setItem('cjo-saved', JSON.stringify([{ id: 'gone123', title: 'Old SOC Role', company: 'Acme', location: 'Toronto', applyUrl: 'https://example.com', savedAt: new Date().toISOString(), status: 'saved' }])),
    );
    await page.reload();
    await expect(page.getByText('No longer listed')).toBeVisible();
    await expect(page.locator('main h2 a', { hasText: 'Old SOC Role' })).toHaveCount(0);
  });
});

test.describe('sources page', () => {
  test('outbound links are valid and the back link works', async ({ page }) => {
    await page.goto('./about/');
    const external = page.locator('main a[target="_blank"]');
    expect(await external.count()).toBeGreaterThan(3);
    for (const a of await external.all()) await expect(a).toHaveAttribute('href', /^https:\/\//);
    await page.locator('main a:not([target])').first().click();
    await expect(cards(page).first()).toBeVisible();
  });
});

test.describe('mobile @mobile', () => {
  test('filters toggle opens and closes the panel', async ({ page }) => {
    await home(page);
    const panel = filters(page);
    await expect(panel).toBeHidden();
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await expect(panel).toBeVisible();
    await panel.getByRole('checkbox').first().click();
    await expect(page).toHaveURL(/\?/);
    await page.getByRole('button', { name: 'Hide filters' }).click();
    await expect(panel).toBeHidden();
    // Nothing overflows sideways on a phone.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
