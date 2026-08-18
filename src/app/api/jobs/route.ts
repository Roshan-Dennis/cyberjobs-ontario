import { NextResponse } from 'next/server';
import { getJobs } from '@/lib/cache';
import { buildDeepLinks } from '@/lib/deeplinks';
import { filtersFromSearchParams, searchJobs } from '@/lib/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const filters = filtersFromSearchParams(url.searchParams);

  try {
    const { jobs, lastIngestAt, notes, degraded } = await getJobs();
    const result = searchJobs(jobs, filters, { lastIngestAt, notes, degraded });
    return NextResponse.json(
      { ...result, deepLinks: buildDeepLinks(filters) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Search failed' },
      { status: 500 },
    );
  }
}
