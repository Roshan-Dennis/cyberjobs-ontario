import type { MetadataRoute } from 'next';
import { config } from '@/lib/config';

// Required by `output: 'export'`: these are emitted as files at build time.
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: [] }],
    sitemap: `${config.siteUrl.replace(/\/$/, '')}/sitemap.xml`,
  };
}
