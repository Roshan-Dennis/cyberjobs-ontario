'use client';

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | '…')[] = [];
  const push = (n: number | '…') => pages.push(n);
  const window = 2;

  // An ellipsis standing in for a single page ("1 2 3 … 5") hides page 4
  // behind a symbol that takes the same space as its number, so a gap of one
  // is shown as the page itself.
  let lo = Math.max(2, page - window);
  let hi = Math.min(totalPages - 1, page + window);
  if (lo === 3) lo = 2;
  if (hi === totalPages - 2) hi = totalPages - 1;

  push(1);
  if (lo > 2) push('…');
  for (let i = lo; i <= hi; i += 1) push(i);
  if (hi < totalPages - 1) push('…');
  if (totalPages > 1) push(totalPages);

  return (
    <nav className="mt-6 flex flex-wrap items-center justify-center gap-1.5" aria-label="Pagination">
      <button type="button" className="btn px-3 py-1.5 text-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ← Prev
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          // eslint-disable-next-line react/no-array-index-key
          <span key={`gap-${i}`} className="px-1 text-muted">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`btn px-3 py-1.5 text-sm ${p === page ? 'btn-primary' : ''}`}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        className="btn px-3 py-1.5 text-sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next →
      </button>
    </nav>
  );
}
