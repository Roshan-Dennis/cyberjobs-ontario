/**
 * Two build modes:
 *
 *   next build                      -> server mode (API routes, live per request)
 *   STATIC_EXPORT=1 next build      -> static export for GitHub Pages
 *
 * The static build is the deployed one. It needs no database, no serverless
 * functions and no third-party account: a GitHub Action runs the ingest, writes
 * a JSON snapshot into public/data, exports the site and publishes it to Pages.
 */
const isStatic = process.env.STATIC_EXPORT === '1';

// GitHub Pages serves a project site from /<repo>, so every asset and link
// needs that prefix. Set NEXT_PUBLIC_BASE_PATH="" for a user/custom-domain site.
const basePath = isStatic ? (process.env.NEXT_PUBLIC_BASE_PATH ?? '/cyberjobs-ontario') : '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(isStatic
    ? {
        output: 'export',
        basePath: basePath || undefined,
        assetPrefix: basePath || undefined,
        images: { unoptimized: true },
        // GitHub Pages serves /foo/ as /foo/index.html.
        trailingSlash: true,
      }
    : {
        async headers() {
          return [{ source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }] }];
        },
      }),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_STATIC_MODE: isStatic ? '1' : '',
  },
};

export default nextConfig;
