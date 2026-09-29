'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { lastSearch } from '@/lib/client/storage';

/**
 * "Back to search" that returns to the results the reader came from. It used
 * to link to the bare board, throwing away every filter they had set.
 */
export function BackToSearch() {
  const [params, setParams] = useState('');
  useEffect(() => setParams(lastSearch()), []);
  return (
    <Link href={params ? `/?${params}` : '/'} className="text-sm text-brand hover:underline">
      ← Back to search
    </Link>
  );
}
