import type { Metadata } from 'next';
import Link from 'next/link';
import { GLOSSARY } from '@/lib/careers/glossary';
import { GlossarySearch } from '@/components/GlossarySearch';

export const metadata: Metadata = {
  title: 'Cybersecurity glossary in plain English',
  description: 'The terms you will see in cybersecurity job postings — SIEM, EDR, IAM, GRC and more — explained in one sentence each.',
};

export const dynamic = 'force-static';

export default function GlossaryPage() {
  const terms = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="card p-6">
        <p className="text-sm text-muted">
          <Link href="/start" className="link">Start here</Link> / Glossary
        </p>
        <h1 className="mt-1 text-2xl font-bold">Glossary</h1>
        <p className="mt-2 text-sm text-muted">The words you will meet in job postings, in one plain sentence each.</p>
      </section>
      <section className="card p-6">
        <GlossarySearch terms={terms} />
      </section>
    </div>
  );
}
