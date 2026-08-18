import { Suspense } from 'react';
import { JobBrowser } from '@/components/JobBrowser';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse bg-surface2" />}>
      <JobBrowser />
    </Suspense>
  );
}
