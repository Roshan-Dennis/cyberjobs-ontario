/**
 * Copies pdf.js's worker into public/ so the resume checker can read PDFs
 * without loading anything from another site. Runs before every build; the
 * copy is gitignored because it always comes from the installed pdfjs-dist.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('public', { recursive: true });
copyFileSync('node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', 'public/pdf.worker.min.js');
console.log('copied pdf.js worker to public/pdf.worker.min.js');
