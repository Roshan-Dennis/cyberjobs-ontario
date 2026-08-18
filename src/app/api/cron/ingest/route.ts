import { NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { invalidateJobsCache } from '@/lib/cache';
import { runIngest } from '@/lib/ingest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(request: Request): boolean {
  // Vercel Cron sends this header on scheduled invocations.
  if (request.headers.get('x-vercel-cron')) return true;

  if (!config.cronSecret) {
    // No secret configured: only allow outside production so local dev works.
    return !config.isProd;
  }
  const auth = request.headers.get('authorization') ?? '';
  const bearer = auth.replace(/^Bearer\s+/i, '');
  const headerSecret = request.headers.get('x-cron-secret') ?? '';
  const querySecret = new URL(request.url).searchParams.get('secret') ?? '';
  return [bearer, headerSecret, querySecret].some((v) => v && v === config.cronSecret);
}

async function handle(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dryRun') === '1';
  const budget = Number.parseInt(url.searchParams.get('budgetMs') ?? '', 10);

  try {
    const { report, logs } = await runIngest({
      dryRun,
      budgetMs: Number.isFinite(budget) ? budget : undefined,
    });
    invalidateJobsCache();
    return NextResponse.json({ ok: true, dryRun, report, logs }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Ingest failed' },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
