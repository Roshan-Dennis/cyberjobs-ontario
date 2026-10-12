import Script from 'next/script';
import { config } from '@/lib/config';

/**
 * Google Analytics 4. Renders nothing unless NEXT_PUBLIC_GA_ID is set to a
 * valid Measurement ID (G-XXXXXXXXXX), so local dev, CI and forks stay
 * untracked by default.
 *
 * The Measurement ID is public by design (it is visible in every page's
 * source), so it is safe to keep in a repository variable rather than a secret.
 *
 * GA4 "enhanced measurement" records history-change events, so client-side
 * navigation in this static export is counted as page views without extra code.
 */
export function GoogleAnalytics() {
  const id = config.gaMeasurementId;
  if (!id) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}');
        `}
      </Script>
    </>
  );
}
