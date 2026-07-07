export type ChartSegment = {
  label: string;
  value: number;
  /** CSS color (use a token var, e.g. 'var(--color-accent)'). */
  color: string;
};

export type ChartBar = {
  label: string;
  segments: ChartSegment[];
};

export type StackedBarChartProps = {
  bars: ChartBar[];
  ariaLabel: string;
  formatValue?: (n: number) => string;
  height?: number;
};

/**
 * Dependency-free stacked bar chart (SPEC.md §2 — no chart libraries). Pure
 * SVG scaled to the tallest bar. The accompanying YearTable carries the exact
 * numbers, so the chart is labelled with role="img" + a summary aria-label.
 */
export default function StackedBarChart({ bars, ariaLabel, formatValue, height = 220 }: StackedBarChartProps) {
  const legend = bars[0]?.segments ?? [];
  const maxTotal = Math.max(...bars.map((b) => b.segments.reduce((sum, s) => sum + s.value, 0)), 0);
  if (maxTotal <= 0) return null;

  const plotHeight = height - 28; // leave room for x-axis labels
  const gap = 8;
  const barWidth = 100 / bars.length;

  return (
    <figure className="m-0">
      <div className="mb-2 flex flex-wrap gap-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {legend.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        width="100%"
        height={height}
        style={{ display: 'block' }}
      >
        {bars.map((bar, i) => {
          const x = i * barWidth + gap / 2;
          const w = barWidth - gap;
          let cursorY = plotHeight;
          return (
            <g key={bar.label}>
              {bar.segments.map((seg) => {
                const h = (seg.value / maxTotal) * plotHeight;
                cursorY -= h;
                return (
                  <rect key={seg.label} x={x} y={cursorY} width={w} height={h} fill={seg.color}>
                    <title>{`${bar.label} · ${seg.label}: ${formatValue ? formatValue(seg.value) : seg.value}`}</title>
                  </rect>
                );
              })}
              <text
                x={x + w / 2}
                y={height - 8}
                textAnchor="middle"
                fontSize="7"
                fill="var(--color-text-muted)"
              >
                {bar.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
