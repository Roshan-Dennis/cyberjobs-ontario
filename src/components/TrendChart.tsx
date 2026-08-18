interface Point {
  date: string;
  count: number;
}

/**
 * Small dependency-free area chart. Rendered as inline SVG on the server so
 * there is no client JS cost, with a table fallback for screen readers.
 */
export function TrendChart({ data, height = 160 }: { data: Point[]; height?: number }) {
  if (data.length === 0) return <p className="mt-3 text-sm text-muted">Not enough data yet.</p>;

  const width = 720;
  const padX = 8;
  const padY = 12;
  const max = Math.max(1, ...data.map((d) => d.count));
  const stepX = (width - padX * 2) / Math.max(1, data.length - 1);
  const scaleY = (v: number) => height - padY - (v / max) * (height - padY * 2);

  const points = data.map((d, i) => [padX + i * stepX, scaleY(d.count)] as const);
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${points[points.length - 1][0].toFixed(1)},${height - padY} L${points[0][0].toFixed(1)},${height - padY} Z`;

  const total = data.reduce((sum, d) => sum + d.count, 0);
  const firstLabel = new Date(data[0].date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  const lastLabel = new Date(data[data.length - 1].date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

  return (
    <figure className="mt-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-40 w-full"
        role="img"
        aria-label={`Postings per day from ${firstLabel} to ${lastLabel}. ${total} postings total, peak ${max} in one day.`}
        preserveAspectRatio="none"
      >
        <line
          x1={padX}
          x2={width - padX}
          y1={height - padY}
          y2={height - padY}
          stroke="rgb(var(--line))"
          strokeWidth="1"
        />
        <path d={area} fill="rgb(var(--brand))" opacity="0.12" />
        <path d={line} fill="none" stroke="rgb(var(--brand))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map(([x, y], i) =>
          data[i].count === max ? <circle key={data[i].date} cx={x} cy={y} r="3" fill="rgb(var(--brand))" /> : null,
        )}
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-muted">
        <span>{firstLabel}</span>
        <span>
          peak {max}/day · {total} total
        </span>
        <span>{lastLabel}</span>
      </figcaption>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted">View as table</summary>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr>
              <th className="text-left font-medium">Date</th>
              <th className="text-right font-medium">Postings</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date}>
                <td>{d.date}</td>
                <td className="text-right tabular-nums">{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
