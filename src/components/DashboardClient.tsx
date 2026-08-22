'use client';

import { useEffect, useState } from 'react';
import { loadDataset } from '@/lib/client/dataset';
import { CATEGORY_LABELS, EXPERIENCE_LABELS } from '@/lib/types';
import type { Job } from '@/lib/types';
import { TrendChart } from '@/components/TrendChart';
import { BarList } from '@/components/BarList';

function countBy<T extends string>(items: T[], labels?: Record<string, string>) {
  const map = new Map<string, number>();
  for (const i of items) map.set(i, (map.get(i) ?? 0) + 1);
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, label: labels?.[key] ?? key, count }));
}

function trendSeries(jobs: Job[], days = 30) {
  const buckets = new Map<string, number>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    buckets.set(new Date(today.getTime() - i * 86_400_000).toISOString().slice(0, 10), 0);
  }
  for (const job of jobs) {
    if (!job.postedAt) continue;
    const key = job.postedAt.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([date, count]) => ({ date, count }));
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="label">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {typeof value === 'number' ? value.toLocaleString('en-CA') : value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function DashboardClient() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDataset().then((d) => {
      if (cancelled) return;
      setJobs(d.jobs);
      setGeneratedAt(d.generatedAt);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!jobs) {
    return (
      <div className="space-y-3">
        <div className="card h-24 animate-pulse bg-surface2" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="card h-24 animate-pulse bg-surface2" />
          ))}
        </div>
      </div>
    );
  }

  const live = jobs.filter((j) => !j.isExpired);
  const now = Date.now();
  const within = (d: number) => live.filter((j) => j.postedAt && now - Date.parse(j.postedAt) <= d * 86_400_000).length;

  const salaries = live
    .map((j) => j.salary.annualMax ?? j.salary.annualMin ?? 0)
    .filter((n) => n > 20_000 && n < 1_000_000)
    .sort((a, b) => a - b);
  const median = salaries.length ? salaries[Math.floor(salaries.length / 2)] : null;

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h1 className="text-lg font-semibold">Market dashboard</h1>
        <p className="mt-0.5 text-sm text-muted">
          Aggregate view of every posting currently indexed
          {generatedAt ? ` · data refreshed ${new Date(generatedAt).toLocaleString('en-CA')}` : ''}.
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open postings" value={live.length} hint={`${jobs.length - live.length} marked expired`} />
        <Stat label="Posted today" value={within(1)} hint={`${within(7)} in the last 7 days`} />
        <Stat label="Employers" value={new Set(live.map((j) => j.companySlug)).size} />
        <Stat
          label="Median salary"
          value={median ? `$${median.toLocaleString('en-CA')}` : '—'}
          hint={`${salaries.length} postings disclose pay`}
        />
        <Stat label="Remote" value={live.filter((j) => j.workArrangement === 'remote').length} />
        <Stat label="Hybrid" value={live.filter((j) => j.workArrangement === 'hybrid').length} />
        <Stat
          label="Entry / co-op friendly"
          value={live.filter((j) => ['internship', 'coop', 'entry', 'junior'].includes(j.experienceLevel)).length}
        />
        <Stat
          label="Pathway into cyber"
          value={live.filter((j) => j.isPathwayRole).length}
          hint="Adjacent IT roles that build security experience"
        />
      </div>

      <section className="card p-4">
        <h2 className="text-sm font-semibold">Postings per day (last 30 days)</h2>
        <TrendChart data={trendSeries(live)} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList
          title="By job category"
          items={countBy(live.map((j) => j.category), CATEGORY_LABELS as Record<string, string>).slice(0, 12)}
          hrefFor={(key) => `/?category=${encodeURIComponent(key)}`}
        />
        <BarList
          title="By experience level"
          items={countBy(live.map((j) => j.experienceLevel), EXPERIENCE_LABELS as Record<string, string>)}
          hrefFor={(key) => `/?experience=${encodeURIComponent(key)}`}
        />
        <BarList
          title="By region"
          items={countBy(live.map((j) => j.region ?? (j.workArrangement === 'remote' ? 'Remote (Canada)' : 'Unspecified')))}
        />
        <BarList
          title="Top cities"
          items={countBy(live.map((j) => j.city ?? (j.workArrangement === 'remote' ? 'Remote' : 'Unspecified'))).slice(0, 12)}
          hrefFor={(key) => `/?city=${encodeURIComponent(key)}`}
        />
        <BarList
          title="Most-requested certifications"
          items={countBy(live.flatMap((j) => j.requirements.certifications)).slice(0, 15)}
          hrefFor={(key) => `/?cert=${encodeURIComponent(key)}`}
        />
        <BarList
          title="Most-requested technologies"
          items={countBy(live.flatMap((j) => j.requirements.technologies)).slice(0, 15)}
          hrefFor={(key) => `/?skill=${encodeURIComponent(key)}`}
        />
        <BarList title="Top employers" items={countBy(live.map((j) => j.company)).slice(0, 15)} hrefFor={(key) => `/?company=${encodeURIComponent(key)}`} />
        <BarList title="By source" items={countBy(live.map((j) => j.sourceId))} hrefFor={(key) => `/?source=${encodeURIComponent(key)}`} />
      </div>
    </div>
  );
}
