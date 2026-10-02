import type { Metadata } from 'next';
import Link from 'next/link';
import { readSnapshot } from '@/lib/snapshot';
import { CAREERS, ENTRY_LABELS } from '@/lib/careers/catalog';
import { boardLink, careerStats } from '@/lib/careers/stats';
import { CareerQuiz, type QuizCareer } from '@/components/CareerQuiz';

export const metadata: Metadata = {
  title: 'Start here: how to begin a career in cybersecurity',
  description:
    'A step-by-step guide for beginners: the jobs that exist, a 2-minute quiz to find your direction, free ways to build skills, resume help and how to apply in Canada.',
};

export const dynamic = 'force-static';

const ENTRY_LEVELS = 'internship,coop,entry,junior';

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card flex gap-4 p-5" aria-labelledby={`step-${n}`}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/15 text-sm font-bold text-brand" aria-hidden>
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <h2 id={`step-${n}`} className="text-lg font-semibold">
          <span className="sr-only">Step {n}: </span>
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function Checklist({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden className="text-good">
            ✓
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Essential({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group border-t border-line py-3 first:border-t-0">
      <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">
        <span className="flex items-center justify-between gap-2">
          {title}
          <span aria-hidden className="text-muted transition-transform group-open:rotate-45">
            +
          </span>
        </span>
      </summary>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted">{children}</div>
    </details>
  );
}

export default async function StartPage() {
  const { jobs } = await readSnapshot();
  const live = jobs.filter((j) => !j.isExpired);
  const entry = live.filter((j) => ['internship', 'coop', 'entry', 'junior'].includes(j.experienceLevel));
  const remote = live.filter((j) => j.workArrangement === 'remote').length;

  // The certification entry-level postings ask for most, from today's data.
  const certCounts = new Map<string, number>();
  for (const j of entry) for (const c of new Set(j.requirements.certifications)) certCounts.set(c, (certCounts.get(c) ?? 0) + 1);
  const topCert = [...certCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const quizCareers: QuizCareer[] = CAREERS.map((c) => {
    const s = careerStats(c, jobs);
    return {
      slug: c.slug,
      title: c.title,
      summary: c.summary,
      entryLabel: ENTRY_LABELS[c.entry],
      open: s.open,
      entryLevel: s.entryLevel,
      jobsHref: boardLink(c),
    };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="card p-6">
        <p className="text-sm font-medium text-brand">Start here</p>
        <h1 className="mt-1 text-2xl font-bold leading-tight">New to cybersecurity? Here is how to begin.</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          You don’t need to know the job titles or have a security degree to start. Follow these five steps — each one links
          to a tool on this site that does the hard part for you.
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            [live.length, 'open jobs right now'],
            [entry.length, 'at entry or junior level'],
            [remote, 'fully remote'],
          ].map(([n, label]) => (
            <div key={label as string} className="rounded-lg border border-line bg-surface2 px-2 py-3">
              <dt className="sr-only">{label}</dt>
              <dd className="text-2xl font-bold tabular-nums">{n}</dd>
              <dd className="text-xs text-muted">{label}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="#step-2" className="btn btn-primary">
            Take the 2-minute quiz
          </a>
          <Link href="/careers" className="btn">
            Explore career paths
          </Link>
        </div>
      </section>

      <Step n={1} title="Learn what the jobs actually are">
        <p className="text-sm leading-relaxed text-muted">
          “Cybersecurity” is a family of jobs, not one job. Some people investigate attacks, some build defences, some make
          sure rules are followed, and some test systems by trying to break in. Knowing the difference is what lets you search
          for the right roles.
        </p>
        <Checklist
          items={[
            <>
              Read about the <Link href="/careers" className="link">10 main career paths</Link> — what each one does day to
              day, and which are open to beginners
            </>,
            <>
              Look up any confusing term in the <Link href="/glossary" className="link">plain-English glossary</Link>
            </>,
          ]}
        />
      </Step>

      <Step n={2} title="Find your direction">
        <p className="text-sm leading-relaxed text-muted">
          Five quick questions about what you enjoy and what you have done so far. You get three paths that fit, why they fit,
          and how many jobs are open in each today. Nothing is saved.
        </p>
        <div id="quiz" className="rounded-lg border border-line p-4">
          <CareerQuiz careers={quizCareers} />
        </div>
      </Step>

      <Step n={3} title="Build skills you can show">
        <p className="text-sm leading-relaxed text-muted">
          Employers hiring beginners look for proof you can do the work. You can build that for free.
        </p>
        <Checklist
          items={[
            <>
              Follow the free learning path on your chosen <Link href="/careers" className="link">career page</Link> — each
              lists courses and practice labs in order
            </>,
            <>Build a small home lab (free virtual machines and a free SIEM trial) and write up what you did — it becomes a resume section</>,
            topCert ? (
              <>
                Plan for one entry certification. Right now <strong>{topCert[0]}</strong> is the most requested, named in{' '}
                {topCert[1]} of {entry.length} entry-level postings on this board
              </>
            ) : (
              <>Plan for one entry certification such as CompTIA Security+</>
            ),
            <>Don’t wait until you feel “ready” to apply — apply while you learn</>,
          ]}
        />
      </Step>

      <Step n={4} title="Get your resume ready">
        <p className="text-sm leading-relaxed text-muted">
          Most employers filter applications with software that looks for the posting’s keywords. A clear, honest resume that
          uses the right words gets read.
        </p>
        <Checklist
          items={[
            <>Use standard headings: Summary, Experience, Education, Certifications, Skills — and a “Projects” section for labs</>,
            <>Give every role dates (“Jan 2024 – Present”) and lead each bullet with a verb</>,
            <>Add real numbers you know: tickets resolved, users supported, endpoints managed</>,
            <>Count transferable experience: customer service, troubleshooting and training others all matter in security teams</>,
            <>In Canada, leave out your photo, age, marital status and SIN</>,
          ]}
        />
        <Link href="/#match" className="btn btn-primary">
          Check my resume against every open job
        </Link>
        <p className="text-xs text-muted">Shows your best matches and what to improve. Your resume is never uploaded or stored.</p>
      </Step>

      <Step n={5} title="Apply and prepare for interviews">
        <Checklist
          items={[
            <>
              Start with <Link href={`/?experience=${ENTRY_LEVELS}`} className="link">entry-level and junior postings</Link>{' '}
              and IT support roles — many security careers start there
            </>,
            <>Apply to fewer jobs, better: tailor your resume to each using the checker on its job page</>,
            <>
              Track every application with ☆ Save and the status menu on your <Link href="/saved" className="link">Saved page</Link>
            </>,
            <>If you hear nothing after a week, a short, polite follow-up email is normal</>,
            <>Meet people: local BSides conferences, OWASP and ISACA chapters, and meetups lead to many first jobs</>,
          ]}
        />
        <div className="rounded-lg border border-line bg-surface2 p-4 text-sm">
          <p className="font-medium">Answer behaviour questions with STAR</p>
          <p className="mt-1 text-muted">
            <strong>S</strong>ituation, <strong>T</strong>ask, <strong>A</strong>ction, <strong>R</strong>esult — a short
            story about something you actually did. Questions entry-level candidates are often asked:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>How would you investigate a suspicious login to someone’s account?</li>
            <li>What is the difference between a vulnerability, a threat and a risk?</li>
            <li>What happens, step by step, when you type a website address into a browser?</li>
            <li>Tell me about a time you solved a difficult problem.</li>
            <li>How do you keep up with security news?</li>
          </ul>
        </div>
      </Step>

      <section className="card p-5" aria-labelledby="essentials">
        <h2 id="essentials" className="text-lg font-semibold">
          Canada essentials
        </h2>
        <p className="mt-1 text-sm text-muted">Things that work differently here, and that most guides leave out.</p>
        <div className="mt-2">
          <Essential title="Co-op and internships">
            <p>
              Many Canadian college and university programs include paid co-op terms, and employers use them to hire graduates.
              If you are a student, co-op is often the fastest way in. Filter the board to{' '}
              <Link href="/?experience=internship,coop" className="link">internships and co-ops</Link>.
            </p>
          </Essential>
          <Essential title="Government jobs and security clearances">
            <p>
              Federal jobs are posted on{' '}
              <a href="https://emploisfp-psjobs.cfp-psc.gc.ca/psrs-srfp/applicant/page2440?fromMenu=true&toggleLanguage=en" className="link" target="_blank" rel="noopener noreferrer">
                GC Jobs
              </a>{' '}
              and Ontario government jobs on{' '}
              <a href="https://www.gojobs.gov.on.ca/Search.aspx?Language=English" className="link" target="_blank" rel="noopener noreferrer">
                Ontario Public Service Careers
              </a>
              . Government roles often use hiring pools, so an application can lead to an offer months later.
            </p>
            <p>
              Many security roles need a clearance — usually <em>Reliability</em>, sometimes <em>Secret</em>. You can’t apply
              for one yourself: the employer sponsors it after an offer. Federal jobs may also require English, French or both;
              the posting says which.
            </p>
          </Essential>
          <Essential title="New to Canada">
            <p>
              Government-funded settlement agencies offer free employment help, including resume reviews and mock interviews.
              Some employers ask how your education compares to Canadian credentials — an education credential assessment can
              answer that. Several colleges run bridging programs for internationally trained IT professionals.
            </p>
            <p>Canadian resumes usually leave out photos, age and marital status, and are one to two pages long.</p>
          </Essential>
          <Essential title="Where to keep learning">
            <p>
              The{' '}
              <a href="https://www.cyber.gc.ca/en" className="link" target="_blank" rel="noopener noreferrer">
                Canadian Centre for Cyber Security
              </a>{' '}
              publishes free guidance and current threat alerts. Each <Link href="/careers" className="link">career page</Link>{' '}
              lists free courses and labs for that path.
            </p>
          </Essential>
        </div>
      </section>
    </div>
  );
}
