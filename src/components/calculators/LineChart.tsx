export type LinePoint = {
  label: string;
  value: number;
};

export type LineChartProps = {
  points: LinePoint[];
  ariaLabel: string;
  formatValue?: (n: number) => string;
  height?: number;
};

/**
 * Dependency-free line chart (SPEC.md §2 — no chart libraries). Pure SVG,
 * scaled to the value range. The accompanying YearTable carries the exact
 * numbers, so the chart is labelled with role="img" + a summary aria-label.
 */
export default function LineChart({ points, ariaLabel, formatValue, height = 220 }: LineChartProps) {
  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const plotHeight = height - 24; // room for x labels
  const n = points.length;

  const coords = points.map((p, i) => {
    const x = n === 1 ? 0 : (i / (n - 1)) * 100;
    const y = plotHeight - ((p.value - min) / span) * plotHeight;
    return { x, y, ...p };
  });

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');
  // Label the first, middle, and last points to avoid crowding.
  const labelIdx = new Set([0, Math.floor((n - 1) / 2), n - 1]);

  return (
    <figure className="m-0">
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        width="100%"
        height={height}
        style={{ display: 'block' }}
      >
        <polyline points={polyline} fill="none" stroke="var(--color-accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {coords.map((c) => (
          <circle key={c.label} cx={c.x} cy={c.y} r={1.5} fill="var(--color-accent)" vectorEffect="non-scaling-stroke">
            <title>{`${c.label}: ${formatValue ? formatValue(c.value) : c.value}`}</title>
          </circle>
        ))}
        {coords.map((c, i) =>
          labelIdx.has(i) ? (
            <text key={`l-${c.label}`} x={c.x} y={height - 6} textAnchor="middle" fontSize="7" fill="var(--color-text-muted)">
              {c.label}
            </text>
          ) : null,
        )}
      </svg>
    </figure>
  );
}
