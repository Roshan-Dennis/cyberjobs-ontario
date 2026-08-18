import Link from 'next/link';

interface Item {
  key: string;
  label: string;
  count: number;
}

export function BarList({
  title,
  items,
  hrefFor,
}: {
  title: string;
  items: Item[];
  hrefFor?: (key: string) => string;
}) {
  if (items.length === 0) {
    return (
      <section className="card p-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted">No data yet.</p>
      </section>
    );
  }

  const max = Math.max(...items.map((i) => i.count));

  return (
    <section className="card p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2">
        {items.map((item) => {
          const pct = Math.round((item.count / max) * 100);
          const label = (
            <span className="min-w-0 flex-1 truncate" title={item.label}>
              {item.label}
            </span>
          );
          return (
            <li key={item.key}>
              <div className="flex items-baseline gap-2 text-sm">
                {hrefFor ? (
                  <Link href={hrefFor(item.key)} className="min-w-0 flex-1 truncate hover:text-brand hover:underline">
                    {item.label}
                  </Link>
                ) : (
                  label
                )}
                <span className="shrink-0 text-xs tabular-nums text-muted">{item.count.toLocaleString('en-CA')}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
                <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
