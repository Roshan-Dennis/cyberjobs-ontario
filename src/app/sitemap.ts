import type { MetadataRoute } from 'next';
import { config } from '@/lib/config';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = config.siteUrl.replace(/\/$/, '');
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/dashboard`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  try {
    const jobs = await getStore().allJobs();
    for (const job of jobs.filter((j) => !j.isExpired).slice(0, 5000)) {
      entries.push({
        url: `${base}/jobs/${job.id}`,
        lastModified: job.lastSeenAt,
        changeFrequency: 'daily',
        priority: 0.5,
      });
    }
  } catch {
    /* sitemap degrades to the static pages */
  }

  return entries;
}
