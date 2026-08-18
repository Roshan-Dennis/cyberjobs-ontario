import { NextResponse } from 'next/server';
import { ALL_SOURCES } from '@/lib/sources/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    sources: ALL_SOURCES.map((s) => ({
      id: s.id,
      name: s.name,
      homepage: s.homepage,
      access: s.access,
      enabled: s.isEnabled(),
      disabledReason: s.isEnabled() ? null : (s.disabledReason?.() ?? null),
    })),
    notIndexed: [
      {
        name: 'LinkedIn',
        reason: 'No public job-search API; the User Agreement prohibits scraping. Deep links are provided instead.',
      },
      {
        name: 'Indeed',
        reason: 'Publisher API was retired for new applicants and scraping is prohibited. Deep links are provided instead.',
      },
      {
        name: 'Glassdoor',
        reason: 'No public job-search API. Deep links are provided instead.',
      },
    ],
  });
}
