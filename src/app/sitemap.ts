import type { MetadataRoute } from 'next';
import { config } from '@/lib/config';
import { readSnapshot } from '@/lib/snapshot';
import { CAREERS } from '@/lib/careers/catalog';

// Required by `output: 'export'`: these are emitted as files at build time.
export const dynamic = 'force-static';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = config.siteUrl.replace(/\/$/, '');
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/dashboard`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/start`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/careers`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/glossary`, changeFrequency: 'monthly', priority: 0.4 },
    ...CAREERS.map((c) => ({ url: `${base}/careers/${c.slug}`, changeFrequency: 'daily' as const, priority: 0.7 })),
  ];

  const { jobs } = await readSnapshot();
  for (const job of jobs.filter((j) => !j.isExpired).slice(0, 5000)) {
    entries.push({
      url: `${base}/jobs/${job.id}`,
      lastModified: job.lastSeenAt,
      changeFrequency: 'daily',
      priority: 0.5,
    });
  }

  return entries;
}
