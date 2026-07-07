import type { DscrBand } from '../../calc-core/dscr';

export type DscrGaugeProps = {
  dscr: number;
  band: DscrBand;
};

const MIN = 0.8;
const MAX = 1.6;

// Band segments across the [MIN, MAX] track (SPEC.md §T8 gauge bands).
const SEGMENTS: { from: number; to: number; color: string }[] = [
  { from: 0.8, to: 1.0, color: 'var(--color-error)' },
  { from: 1.0, to: 1.2, color: 'var(--color-warning)' },
  { from: 1.2, to: 1.25, color: 'var(--color-warning)' },
  { from: 1.25, to: 1.4, color: 'var(--color-accent)' },
  { from: 1.4, to: 1.6, color: 'var(--color-accent)' },
];

function pct(v: number): number {
  return (Math.min(Math.max(v, MIN), MAX) - MIN) / (MAX - MIN) * 100;
}

/** Horizontal lender-threshold gauge for DSCR (SPEC.md §T8). */
export default function DscrGauge({ dscr, band }: DscrGaugeProps) {
  const markerX = pct(dscr);
  return (
    <div className="space-y-1" role="img" aria-label={`DSCR ${dscr.toFixed(2)}x — ${band}`}>
      <div className="relative h-3 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--color-surface)' }}>
        {SEGMENTS.map((seg) => (
          <div
            key={seg.from}
            className="absolute top-0 h-full"
            style={{
              left: `${pct(seg.from)}%`,
              width: `${pct(seg.to) - pct(seg.from)}%`,
              backgroundColor: seg.color,
              opacity: 0.35,
            }}
          />
        ))}
        <div
          className="absolute top-[-2px] h-[calc(100%+4px)] w-0.5"
          style={{ left: `calc(${markerX}% - 1px)`, backgroundColor: 'var(--color-text)' }}
        />
      </div>
      <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <span>1.00x</span>
        <span>1.25x</span>
        <span>1.40x</span>
      </div>
    </div>
  );
}
