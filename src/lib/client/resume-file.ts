/**
 * Reads the text out of a resume file, entirely in the browser.
 *
 * PDF goes through pdf.js and Word (.docx) through mammoth, both bundled with
 * the site and loaded only when a file is chosen. The file's bytes are read
 * with the File API and never leave the page: nothing here makes a network
 * request except fetching pdf.js's own worker script from this site.
 */

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export class ResumeFileError extends Error {}

function extensionOf(name: string): string {
  return name.toLowerCase().split('.').pop() ?? '';
}

async function readPdf(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // The worker ships in public/ (copied from pdfjs-dist at build time).
  pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/pdf.worker.min.js`;
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const pages: string[] = [];
  const count = Math.min(doc.numPages, 10);
  for (let i = 1; i <= count; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = '';
    const lines: string[] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = '';
      } else if (item.str && !line.endsWith(' ')) line += ' ';
    }
    if (line.trim()) lines.push(line);
    pages.push(lines.map((l) => l.replace(/\s+/g, ' ').trim()).join('\n'));
  }
  await doc.destroy();
  return pages.join('\n');
}

async function readDocx(data: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const { value } = await (mammoth.default ?? mammoth).extractRawText({ arrayBuffer: data });
  return value;
}

/** Text of a resume file. Throws ResumeFileError with a reader-facing message. */
export async function readResumeFile(file: File): Promise<string> {
  if (file.size > MAX_RESUME_BYTES) throw new ResumeFileError('That file is over 5 MB. A resume is usually well under 1 MB — try exporting it again, or paste the text instead.');
  const ext = extensionOf(file.name);
  if (ext === 'doc') {
    throw new ResumeFileError(
      'Older Word files (.doc) can’t be read reliably in a browser. Open it in Word or Google Docs and save it as .docx or PDF, or paste the text instead.',
    );
  }
  if (!['pdf', 'docx', 'txt'].includes(ext)) throw new ResumeFileError('Please choose a PDF or Word (.docx) file, or paste the text.');

  let text = '';
  try {
    if (ext === 'txt') text = await file.text();
    else {
      const data = await file.arrayBuffer();
      text = ext === 'pdf' ? await readPdf(data) : await readDocx(data);
    }
  } catch {
    throw new ResumeFileError(
      ext === 'pdf'
        ? 'This PDF couldn’t be read. It may be password-protected or damaged — try exporting it again, or paste the text.'
        : 'This Word file couldn’t be read. Try saving it again as .docx or PDF, or paste the text.',
    );
  }
  if (text.replace(/\s/g, '').length < 50) {
    throw new ResumeFileError(
      'Almost no text could be read from this file. If it is a scanned or image-only PDF, applicant tracking systems can’t read it either — export it as a text PDF from Word or Google Docs, or paste the text.',
    );
  }
  return text;
}
