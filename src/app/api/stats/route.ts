import { NextResponse } from 'next/server';
import { getJobs } from '@/lib/cache';
import { CATEGORY_LABELS, EXPERIENCE_LABELS } from '@/lib/types';
import type { Job } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function countBy<T extends string>(items: T[], labels?: Record<string, string>): { key: string; label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const i of items) map.set(i, (map.get(i) ?? 0) + 1);
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, label: labels?.[key] ?? key, count }));
}

function postingsPerDay(jobs: Job[], days = 30): { date: string; count: number }[] {
  const buckets = new Map<string, number>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * 86_400_000);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const job of jobs) {
    if (!job.postedAt) continue;
    const key = job.postedAt.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([date, count]) => ({ date, count }));
}

export async function GET(): Promise<NextResponse> {
  try {
    const { jobs, lastIngestAt, degraded, notes } = await getJobs();
    const live = jobs.filter((j) => !j.isExpired);
    const withSalary = live.filter((j) => j.salary.annualMin != null || j.salary.annualMax != null);
    const salaries = withSalary
      .map((j) => j.salary.annualMax ?? j.salary.annualMin ?? 0)
      .filter((n) => n > 20_000 && n < 1_000_000)
      .sort((a, b) => a - b);

    const now = Date.now();
    const within = (d: number) =>
      live.filter((j) => j.postedAt && now - Date.parse(j.postedAt) <= d * 86_400_000).length;

    return NextResponse.json(
      {
        totals: {
          all: live.length,
          today: within(1),
          last7Days: within(7),
          last30Days: within(30),
          remote: live.filter((j) => j.workArrangement === 'remote').length,
          hybrid: live.filter((j) => j.workArrangement === 'hybrid').length,
          onsite: live.filter((j) => j.workArrangement === 'onsite').length,
          withSalary: withSalary.length,
          pathway: live.filter((j) => j.isPathwayRole).length,
          entryFriendly: live.filter((j) =>
            ['internship', 'coop', 'entry', 'junior'].includes(j.experienceLevel),
          ).length,
          companies: new Set(live.map((j) => j.companySlug)).size,
          expired: jobs.length - live.length,
        },
        salary: {
          count: salaries.length,
          median: salaries.length ? salaries[Math.floor(salaries.length / 2)] : null,
          p25: salaries.length ? salaries[Math.floor(salaries.length * 0.25)] : null,
          p75: salaries.length ? salaries[Math.floor(salaries.length * 0.75)] : null,
        },
        byCategory: countBy(live.map((j) => j.category), CATEGORY_LABELS as Record<string, string>),
        byExperience: countBy(live.map((j) => j.experienceLevel), EXPERIENCE_LABELS as Record<string, string>),
        byRegion: countBy(live.map((j) => j.region ?? (j.workArrangement === 'remote' ? 'Remote (Canada)' : 'Unspecified'))),
        byCity: countBy(live.map((j) => j.city ?? (j.workArrangement === 'remote' ? 'Remote' : 'Unspecified'))).slice(0, 25),
        bySource: countBy(live.map((j) => j.sourceId)),
        topCompanies: countBy(live.map((j) => j.company)).slice(0, 20),
        topCertifications: countBy(live.flatMap((j) => j.requirements.certifications)).slice(0, 20),
        topTechnologies: countBy(live.flatMap((j) => j.requirements.technologies)).slice(0, 30),
        trend: postingsPerDay(live),
        meta: { lastIngestAt, degraded, notes, generatedAt: new Date().toISOString() },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Stats failed' }, { status: 500 });
  }
}
