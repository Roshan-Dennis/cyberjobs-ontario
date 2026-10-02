import { expect, test, type Page } from '@playwright/test';
import JSZip from 'jszip';

/**
 * The ATS checker and resume advisor, end to end: every input route (paste,
 * PDF, Word), the privacy promise (nothing stored, nothing sent), and that
 * the same resume scores the same however it arrives.
 */

const RESUME_LINES = [
  'Jordan Lee',
  'jordan.lee@example.com | (519) 555-0142 | Waterloo, ON',
  'SUMMARY',
  'SOC analyst with hands-on incident response, threat hunting and cloud security lab work.',
  'EXPERIENCE',
  'Security Operations Analyst - Acme Corp',
  'Jan 2022 - Dec 2023',
  '- Responsible for monitoring alerts in Azure Sentinel and Splunk across 400 endpoints',
  '- Helped with incident response for phishing cases and malware alerts',
  '- Worked on Python scripts for log enrichment and alert triage',
  'IT Support Specialist - Beta Inc',
  'Mar 2024 - Present',
  '- Resolved tickets for a 200-person office using Active Directory and Microsoft 365',
  '- Involved in firewall rule reviews and vulnerability scanning with Nessus',
  'EDUCATION',
  'Bachelor of Science, Computer Science - 2021',
  'CERTIFICATIONS',
  'CompTIA Security+',
  'SKILLS',
  'Splunk, Azure Sentinel, Python, Incident Response, Threat Hunting, Linux, AWS, Nessus, CrowdStrike Falcon, SIEM',
];
const RESUME = RESUME_LINES.join('\n');

/** A real one-page PDF with the resume as text. */
function makePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const content = `BT /F1 10 Tf 40 770 Td 14 TL ${lines.map((l) => `(${esc(l)}) Tj T*`).join(' ')} ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

/** A real .docx with one paragraph per line. */
async function makeDocx(lines: string[]): Promise<Buffer> {
  const zip = new JSZip();
  const x = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${lines
      .map((l) => `<w:p><w:r><w:t xml:space="preserve">${x(l)}</w:t></w:r></w:p>`)
      .join('')}</w:body></w:document>`,
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}

const checker = (page: Page) => page.locator('section[aria-labelledby="ats-heading"]');

async function openFirstJob(page: Page) {
  await page.goto('./?q=SOC');
  await page.locator('article').first().getByRole('link', { name: 'Details' }).click();
  await expect(checker(page)).toBeVisible();
}

async function pasteResume(page: Page, scope = checker(page)) {
  await scope.getByRole('tab', { name: 'Paste text' }).click();
  await scope.getByPlaceholder(/Paste the full text/).fill(RESUME);
  await scope.getByRole('button', { name: 'Use this text' }).click();
}

const score = async (page: Page) => Number((await page.getByTestId('ats-score').innerText()).replace(/\/100.*/s, '').trim());

test('job page: paste a resume, get a scored, explained result', async ({ page }) => {
  await openFirstJob(page);
  await expect(checker(page).getByText(/Nothing is stored or sent/)).toBeVisible();
  await checker(page).getByRole('button', { name: 'Check my resume against this job' }).click();
  await expect(checker(page).getByText(/Nothing is stored or sent/)).toBeVisible();
  await pasteResume(page);

  const s = await score(page);
  expect(s).toBeGreaterThan(0);
  expect(s).toBeLessThanOrEqual(100);
  // The breakdown adds up to the score shown.
  const pts = await checker(page).locator('li', { has: page.locator('button') }).locator('span.tabular-nums span.font-semibold').allInnerTexts();
  const sum = pts.reduce((a, p) => a + Number(p), 0);
  expect(Math.abs(Math.round(sum) - s)).toBeLessThanOrEqual(1);

  await expect(checker(page).getByText('Where the points come from')).toBeVisible();
  await expect(checker(page).getByText(/How to improve it/)).toBeVisible();
  // Same-facts rewrites quote the real resume line.
  await expect(checker(page).getByText('Monitored alerts in Azure Sentinel and Splunk across 400 endpoints')).toBeVisible();
  await expect(checker(page).getByText('Can an ATS read it?')).toBeVisible();
  await checker(page).getByText('How this score is calculated').click();
  await expect(checker(page).getByText(/same resume and posting always give the same score/)).toBeVisible();
});

test('PDF, Word and pasted text give the same score', async ({ page }) => {
  await openFirstJob(page);
  await checker(page).getByRole('button', { name: 'Check my resume against this job' }).click();
  await pasteResume(page);
  const pasted = await score(page);

  await checker(page).getByRole('button', { name: 'Remove' }).click();
  // Removing a resume goes straight back to the form.
  await checker(page)
    .getByLabel('Upload your resume (PDF or Word)')
    .setInputFiles({ name: 'resume.pdf', mimeType: 'application/pdf', buffer: makePdf(RESUME_LINES) });
  await expect(checker(page).getByText('resume.pdf')).toBeVisible({ timeout: 15_000 });
  expect(await score(page)).toBe(pasted);

  await checker(page).getByRole('button', { name: 'Remove' }).click();
  await checker(page).getByLabel('Upload your resume (PDF or Word)').setInputFiles({
    name: 'resume.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: await makeDocx(RESUME_LINES),
  });
  await expect(checker(page).getByText('resume.docx')).toBeVisible({ timeout: 15_000 });
  expect(await score(page)).toBe(pasted);
});

test('old .doc files and unreadable files get a clear message', async ({ page }) => {
  await openFirstJob(page);
  await checker(page).getByRole('button', { name: 'Check my resume against this job' }).click();
  await checker(page)
    .getByLabel('Upload your resume (PDF or Word)')
    .setInputFiles({ name: 'old.doc', mimeType: 'application/msword', buffer: Buffer.from('binary') });
  await expect(checker(page).getByRole('alert')).toContainText('save it as .docx or PDF');
  await checker(page)
    .getByLabel('Upload your resume (PDF or Word)')
    .setInputFiles({ name: 'scan.pdf', mimeType: 'application/pdf', buffer: makePdf(['']) });
  await expect(checker(page).getByRole('alert')).toContainText(/scanned|couldn’t be read/, { timeout: 15_000 });
});

test('nothing is stored and nothing is sent', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() !== 'GET') posts.push(`${r.method()} ${r.url()}`);
    if ((r.postData() ?? '').includes('Jordan')) posts.push(`resume in ${r.url()}`);
    if (r.url().includes('Jordan') || r.url().includes('jordan.lee')) posts.push(`resume in URL ${r.url()}`);
  });
  await openFirstJob(page);
  await checker(page).getByRole('button', { name: 'Check my resume against this job' }).click();
  await pasteResume(page);
  await expect(page.getByTestId('ats-score')).toBeVisible();
  const stored = await page.evaluate(async () => {
    const dump = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie;
    const dbs = (await indexedDB.databases?.()) ?? [];
    return { hit: dump.includes('Jordan') || dump.includes('jordan.lee'), dbs: dbs.length };
  });
  expect(stored.hit, 'resume text in browser storage').toBe(false);
  expect(stored.dbs).toBe(0);
  expect(posts).toEqual([]);

  // In memory only: a reload forgets it.
  await page.reload();
  await expect(page.getByTestId('ats-score')).toHaveCount(0);
});

test('each job is scored on its own requirements; the resume follows you between jobs', async ({ page }) => {
  await page.goto('./');
  const links = page.locator('article').getByRole('link', { name: 'Details' });
  await links.nth(0).click();
  await checker(page).getByRole('button', { name: 'Check my resume against this job' }).click();
  await pasteResume(page);
  const first = await score(page);
  const firstTitle = await page.locator('main h1').innerText();

  // Client-side navigation keeps the in-memory resume.
  await page.getByRole('link', { name: '← Back to search' }).click();
  const cards = page.locator('article');
  await expect(cards.first()).toBeVisible();
  const n = await cards.count();
  let different = false;
  for (let i = 1; i < Math.min(n, 8) && !different; i += 1) {
    await cards.nth(i).getByRole('link', { name: 'Details' }).click();
    await expect(page.getByTestId('ats-score')).toBeVisible();
    expect(await page.locator('main h1').innerText()).not.toBe(firstTitle);
    if ((await score(page)) !== first) different = true;
    await page.getByRole('link', { name: '← Back to search' }).click();
    await expect(cards.first()).toBeVisible();
  }
  expect(different, 'different postings produce different scores').toBe(true);
});

test('search page advisor: matches, levels, gaps, and the board sorted by match', async ({ page }) => {
  await page.goto('./');
  const advisor = page.locator('section[aria-labelledby="advisor-heading"]');
  await advisor.getByRole('button', { name: 'Match my resume' }).click();
  await expect(advisor.getByText(/Nothing is stored or sent/)).toBeVisible();
  await pasteResume(page, advisor);

  await expect(advisor.getByRole('heading', { name: 'Your personalised job match' })).toBeVisible();
  await expect(advisor.getByText('What to do next')).toBeVisible();
  await expect(advisor.getByText('Levels to target')).toBeVisible();
  // An experienced resume isn't steered to student postings.
  await expect(advisor.locator('ol').nth(1).getByText(/Co-op Student/)).toHaveCount(0);
  await expect(advisor.getByText(/About 4.7 years of dated experience/)).toBeVisible();
  const matchRows = advisor.locator('ol').nth(1).locator('li');
  expect(await matchRows.count()).toBeGreaterThan(3);

  // Top matches are in descending order.
  const tops = (await matchRows.locator('span[title^="How well"]').allInnerTexts()).map((t) => Number(t.replace(/\D/g, '')));
  expect(tops).toEqual([...tops].sort((a, b) => b - a));

  // Cards now carry the same score as the advisor, and the board can sort by it.
  await advisor.getByRole('button', { name: 'Sort all jobs by match' }).click();
  await expect(page).toHaveURL(/sort=match/);
  await expect(page.getByLabel('Sort')).toHaveValue('match');
  // The board ranks every posting (all levels), so its first card scores at
  // least as high as the advisor's best at-your-level match, and cards are in order.
  const cardScores = (await page.locator('article span[title^="How well"]').allInnerTexts()).map((t) => Number(t.replace(/\D/g, '')));
  expect(cardScores).toEqual([...cardScores].sort((a, b) => b - a));
  const firstCard = cardScores[0];
  expect(firstCard).toBeGreaterThanOrEqual(tops[0]);

  // The card score and the job page's checker agree.
  await page.locator('article').first().getByRole('link', { name: 'Details' }).click();
  expect(await score(page)).toBe(firstCard);
});
