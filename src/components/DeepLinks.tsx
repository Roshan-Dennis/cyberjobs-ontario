export interface DeepLinkItem {
  site: string;
  url: string;
  note: string;
}

export function DeepLinks({ links }: { links: DeepLinkItem[] }) {
  if (!links?.length) return null;
  return (
    <section className="card p-4">
      <h2 className="text-sm font-semibold">Search these sites with the same filters</h2>
      <p className="mt-1 text-xs text-muted">
        LinkedIn, Indeed and Glassdoor have no public job-search API and their terms prohibit scraping, so their
        postings are not indexed here. These links open each site with your current keywords, location and date
        window already applied.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {links.map((l) => (
          <a
            key={l.site}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="btn text-sm"
            title={l.note}
          >
            {l.site} ↗
          </a>
        ))}
      </div>
    </section>
  );
}
