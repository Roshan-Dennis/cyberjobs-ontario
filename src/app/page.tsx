import { Suspense } from 'react';
import { JobBrowser } from '@/components/JobBrowser';

// The page is a client component fed by the JSON snapshot; nothing to render
// on a server. Static so it can be exported for GitHub Pages.
export const dynamic = 'force-static';

export default function HomePage() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse bg-surface2" />}>
      <JobBrowser />
    </Suspense>
  );
}
