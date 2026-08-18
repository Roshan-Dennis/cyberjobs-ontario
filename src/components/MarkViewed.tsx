'use client';

import { useEffect } from 'react';
import { viewedJobs } from '@/lib/client/storage';

export function MarkViewed({ id }: { id: string }) {
  useEffect(() => {
    viewedJobs.add(id);
  }, [id]);
  return null;
}
