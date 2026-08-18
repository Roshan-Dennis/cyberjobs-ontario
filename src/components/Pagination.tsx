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

  push(1);
  if (page - window > 2) push('…');
  for (let i = Math.max(2, page - window); i <= Math.min(totalPages - 1, page + window); i += 1) push(i);
  if (page + window < totalPages - 1) push('…');
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
