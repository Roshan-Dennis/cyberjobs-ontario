import { NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { getStore } from '@/lib/store';
import { activeSources } from '@/lib/sources/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const store = getStore();
  let storeHealth = { ok: false, detail: 'unknown' };
  try {
    storeHealth = await store.health();
  } catch (err) {
    storeHealth = { ok: false, detail: err instanceof Error ? err.message : 'store error' };
  }

  let meta = null;
  try {
    meta = await store.getMeta();
  } catch {
    /* ignore */
  }

  return NextResponse.json(
    {
      ok: storeHealth.ok,
      store: { kind: store.kind, ...storeHealth },
      lastIngestAt: meta?.lastIngestAt ?? null,
      sourcesEnabled: activeSources().filter((s) => s.isEnabled()).map((s) => s.id),
      cronConfigured: Boolean(config.cronSecret),
      version: '1.0.0',
      time: new Date().toISOString(),
    },
    { status: storeHealth.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
