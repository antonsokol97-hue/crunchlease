import type { ReactNode } from 'react';
import { formatPercent } from '../../calc-core/money';

export type CompareMetric = {
  label: string;
  a: number | null;
  b: number | null;
  /** Formats a metric value for display (e.g. money helpers). */
  format: (n: number) => string;
};

export type ScenarioCompareProps = {
  labelA: string;
  labelB: string;
  inputsA: ReactNode;
  inputsB: ReactNode;
  metrics: CompareMetric[];
  /** Remove scenario B and return to the single-scenario view. */
  onRemove: () => void;
};

/**
 * Two-column A/B comparison with a delta row (SPEC.md §5, MVP max 2 scenarios).
 * Presentational only — the island owns both scenarios' state and passes the
 * rendered input panels plus the numeric metrics to diff.
 */
export default function ScenarioCompare({ labelA, labelB, inputsA, inputsB, metrics, onRemove }: ScenarioCompareProps) {
  return (
    <div className="rounded-lg border p-4 md:p-6" style={{ borderColor: 'var(--color-border)' }}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Compare scenarios</h3>
        <button
          type="button"
          onClick={onRemove}
          data-print-hide
          className="rounded-md border px-3 py-1 text-sm"
          style={{ borderColor: 'var(--color-border)' }}
        >
          Remove {labelB}
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <p className="text-sm font-medium">{labelA}</p>
          {inputsA}
        </div>
        <div className="space-y-4">
          <p className="text-sm font-medium">{labelB}</p>
          {inputsB}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--color-surface)' }}>
              <th scope="col" className="px-3 py-2 text-left font-medium">Metric</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{labelA}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{labelB}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Δ</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.label} style={{ borderTop: '1px solid var(--color-border)' }}>
                <td className="px-3 py-2">{m.label}</td>
                <td className="px-3 py-2 text-right">{m.a === null ? '—' : m.format(m.a)}</td>
                <td className="px-3 py-2 text-right">{m.b === null ? '—' : m.format(m.b)}</td>
                <td className="px-3 py-2 text-right">{formatDelta(m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDelta(m: CompareMetric): string {
  if (m.a === null || m.b === null) return '—';
  const abs = m.b - m.a;
  const sign = abs > 0 ? '+' : '';
  const pct = m.a !== 0 ? ` (${sign}${formatPercent(abs / m.a)})` : '';
  return `${sign}${m.format(abs)}${pct}`;
}
