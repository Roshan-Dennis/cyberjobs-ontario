import { expect, test } from '@playwright/test';

/** The "Start here" guide: the five steps, the quiz, career pages and glossary. */

const count = async (page: import('@playwright/test').Page) => {
  const el = page.getByTestId('result-count');
  await expect(el).toContainText(/\bjobs?\b/);
  return Number((await el.innerText()).replace(/[^\d]/g, ''));
};

test('header and search page lead to the guide', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'New to cybersecurity? Start here →' }).click();
  await expect(page.locator('main h1')).toHaveText('New to cybersecurity? Here is how to begin.');
  await page.goto('./saved/');
  await page.locator('header').getByRole('link', { name: 'Start here', exact: true }).click();
  await expect(page).toHaveURL(/\/start\/?$/);
});

test('start page: five steps, live numbers, and working links', async ({ page }) => {
  await page.goto('./start/');
  for (let n = 1; n <= 5; n += 1) await expect(page.locator(`#step-${n}`)).toBeVisible();
  const figures = await page.locator('main section').first().locator('dd.text-2xl').allInnerTexts();
  expect(figures.map(Number).every((n) => Number.isFinite(n) && n >= 0)).toBe(true);
  expect(Number(figures[0])).toBeGreaterThan(0);

  // Entry-level link lands on the filtered board.
  await page.getByRole('link', { name: 'entry-level and junior postings' }).click();
  await expect(page).toHaveURL(/experience=internship%2Ccoop%2Centry%2Cjunior|experience=internship,coop,entry,junior/);
  expect(await count(page)).toBeGreaterThan(0);

  // The resume step opens the advisor directly.
  await page.goto('./start/');
  await page.getByRole('link', { name: 'Check my resume against every open job' }).click();
  await expect(page.locator('#match').getByRole('tab', { name: 'Paste text' })).toBeVisible();

  // Canada essentials expand.
  await page.goto('./start/');
  await page.getByText('Government jobs and security clearances').click();
  await expect(page.getByText(/the employer sponsors it after an offer/)).toBeVisible();
});

test('quiz: five questions, back button, three explained results', async ({ page }) => {
  await page.goto('./start/');
  const quiz = page.locator('#quiz');
  await expect(quiz.getByText('Question 1 of 5')).toBeVisible();
  await quiz.getByRole('button', { name: /Investigating something suspicious/ }).click();
  await quiz.getByRole('button', { name: /New to tech/ }).click();
  await quiz.getByRole('button', { name: '← Back' }).click();
  await expect(quiz.getByText('Question 2 of 5')).toBeVisible();
  await quiz.getByRole('button', { name: /New to tech/ }).click();
  await quiz.getByRole('button', { name: /Fast-paced/ }).click();
  await quiz.getByRole('button', { name: /Some — a mix/ }).click();
  await quiz.getByRole('button', { name: /A little scripting/ }).click();

  const results = quiz.locator('ol > li');
  await expect(results).toHaveCount(3);
  await expect(results.first()).toContainText('SOC Analyst');
  await expect(results.first()).toContainText('Suggested because you enjoy investigating');
  await results.first().getByRole('link', { name: 'Learn about this path' }).click();
  await expect(page.locator('main h1')).toHaveText('SOC Analyst');
});

test('career pages: live stats, learning path, and a jobs link that matches its count', async ({ page }) => {
  await page.goto('./careers/');
  const cards = page.locator('main ul.grid > li');
  await expect(cards).toHaveCount(10);
  await expect(page.getByRole('heading', { name: 'How careers usually progress' })).toBeVisible();

  await page.goto('./careers/soc-analyst/');
  const aside = page.getByLabel('Live job market for this path');
  const open = Number(await aside.locator('dd').first().innerText());
  await expect(page.getByRole('heading', { name: 'Learning path' })).toBeVisible();
  const resources = page.locator('#learn ~ ol > li a[target="_blank"]');
  expect(await resources.count()).toBeGreaterThan(2);
  for (const a of await resources.all()) await expect(a).toHaveAttribute('href', /^https:\/\//);

  if (open > 0) {
    await aside.getByRole('link', { name: new RegExp(`See all ${open} open jobs`) }).click();
    expect(await count(page)).toBe(open);
  }

  // "Where this can lead" moves along the career map.
  await page.goto('./careers/soc-analyst/');
  await page.getByRole('link', { name: 'Incident Response & Threat Intelligence →' }).click();
  await expect(page.locator('main h1')).toHaveText('Incident Response & Threat Intelligence');
});

test('every career page builds and shows its numbers', async ({ page }) => {
  await page.goto('./careers/');
  const hrefs = await page.locator('main ul.grid > li a').evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
  for (const href of hrefs) {
    const res = await page.goto(href.replace(/^\/cyberjobs-ontario\//, './'));
    expect(res?.status(), href).toBe(200);
    await expect(page.getByLabel('Live job market for this path')).toBeVisible();
  }
});

test('glossary search', async ({ page }) => {
  await page.goto('./glossary/');
  const all = await page.locator('dl > div').count();
  expect(all).toBeGreaterThan(30);
  await page.getByLabel('Search the glossary').fill('siem');
  await expect(page.locator('dl > div').first()).toContainText('SIEM');
  expect(await page.locator('dl > div').count()).toBeLessThan(all);
  await page.getByLabel('Search the glossary').fill('zzzz');
  await expect(page.getByText('No term matches')).toBeVisible();
});

test('mobile @mobile header fits with Start here', async ({ page }) => {
  await page.goto('./start/');
  await expect(page.locator('header').getByRole('link', { name: 'Start here', exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.goto('./careers/soc-analyst/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});
