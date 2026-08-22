import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { config } from '@/lib/config';
import { ThemeToggle } from '@/components/ThemeToggle';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `${config.appName} — live cybersecurity jobs across Ontario`,
    template: `%s · ${config.appName}`,
  },
  description:
    'Live cybersecurity job postings across all of Ontario plus remote-Canada roles, aggregated from company career boards, the federal Job Bank and licensed job APIs. Filter by experience, category, location, salary and skills.',
  keywords: [
    'cybersecurity jobs Ontario',
    'SOC analyst jobs Toronto',
    'security analyst Ontario',
    'cyber security co-op Canada',
    'GRC jobs Ontario',
    'penetration tester Canada',
  ],
  // metadataBase makes og:image resolve to an absolute URL, which every link
  // preview (LinkedIn, Slack, iMessage) requires — a relative path is ignored.
  metadataBase: new URL(config.siteUrl),
  openGraph: {
    title: `${config.appName} — cybersecurity jobs across Ontario`,
    description: 'Live cybersecurity job postings across Ontario and remote Canada, refreshed hourly.',
    type: 'website',
    locale: 'en_CA',
    siteName: config.appName,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: `${config.appName} — cybersecurity jobs across Ontario and remote Canada` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${config.appName} — cybersecurity jobs across Ontario`,
    description: 'Live cybersecurity job postings across Ontario and remote Canada, refreshed hourly.',
    images: ['/og.png'],
  },
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#080c14' },
  ],
  width: 'device-width',
  initialScale: 1,
};

const THEME_SCRIPT = `
(function(){try{
  var t = localStorage.getItem('cjo-theme');
  var m = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (t === 'dark' || (!t && m)) document.documentElement.classList.add('dark');
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen">
        <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
            <Link
              href="/"
              aria-label={`${config.appName} — home`}
              className="group flex items-center gap-2.5 font-semibold tracking-tight"
            >
              {/* Cyan mark, ink wordmark: the accent identifies the product
                  without competing with the blue used for actions. */}
              <span
                aria-hidden
                className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-sm font-bold text-accent ring-1 ring-inset ring-accent/30 transition-colors group-hover:bg-accent/25"
              >
                CJ
              </span>
              <span className="hidden sm:inline">
                Cyber<span className="text-accent">Jobs</span>
                <span className="ml-1 font-normal text-muted">Ontario</span>
              </span>
            </Link>

            <nav className="ml-auto flex items-center gap-1 text-sm">
              <Link href="/" className="btn btn-ghost hidden sm:inline-flex">
                Jobs
              </Link>
              <Link href="/dashboard" className="btn btn-ghost">
                Dashboard
              </Link>
              <Link href="/saved" className="btn btn-ghost">
                Saved
              </Link>
              <Link href="/about" className="btn btn-ghost">
                Sources
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>

        <footer className="mt-16 border-t border-line bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-muted">
            <p className="mb-2">
              {config.appName} aggregates publicly available job postings from company career-site APIs, the
              Government of Canada Job Bank and licensed job-search APIs. Postings link back to the original
              employer application page.
            </p>
            <p className="mb-2">
              LinkedIn, Indeed and Glassdoor are not indexed — they provide no public job-search API and their
              terms prohibit scraping. Pre-filtered deep links to those sites are offered instead.
            </p>
            <p>
              <Link href="/about" className="link">
                How this works and where the data comes from
              </Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
