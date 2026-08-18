import type { Metadata } from 'next';
import { SavedJobsClient } from '@/components/SavedJobsClient';

export const metadata: Metadata = { title: 'Saved jobs' };

export default function SavedPage() {
  return <SavedJobsClient />;
}
