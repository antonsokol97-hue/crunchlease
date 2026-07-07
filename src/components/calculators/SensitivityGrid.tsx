import { formatNumber } from '../../calc-core/money';
import type { SensitivityMatrix } from '../../calc-core/capRate';

export type SensitivityGridProps = {
  matrix: SensitivityMatrix;
  /** Resolved deal cap rate; the nearest row × base-NOI column is highlighted. */
  highlightCap: number;
  formatValue: (n: number) => string;
};

function nearestIndex(values: number[], target: number): number {
  let best = 0;
  let bestDiff = Infinity;
  values.forEach((v, i) => {
    const diff = Math.abs(v - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  });
  return best;
}

/**
 * Cap × NOI sensitivity matrix of implied values (SPEC.md §T7). The base cell
 * (deal cap × unchanged NOI) is highlighted — the screenshot-able asset.
 */
export default function SensitivityGrid({ matrix, highlightCap, formatValue }: SensitivityGridProps) {
  const baseNoiIdx = matrix.noiFactors.indexOf(0);
  const highlightCapIdx = nearestIndex(matrix.caps, highlightCap);

  return (
    <div
      className="overflow-x-auto rounded-md border"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-card)' }}
    >
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Implied value by cap rate and NOI change</caption>
        <thead>
          <tr style={{ backgroundColor: 'var(--color-muted)' }}>
            <th scope="col" className="px-3 py-2 text-left font-medium">Cap ＼ NOI</th>
            {matrix.noiFactors.map((f) => (
              <th key={f} scope="col" className="px-3 py-2 text-right font-medium">
                {f === 0 ? 'Base' : `${f > 0 ? '+' : ''}${formatNumber(f * 100, 0)}%`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.caps.map((c, capIdx) => (
            <tr key={c} style={{ borderTop: '1px solid var(--color-border)' }}>
              <th scope="row" className="px-3 py-2 text-left font-medium" style={{ backgroundColor: 'var(--color-muted)' }}>
                {formatNumber(c, 1)}%
              </th>
              {matrix.cells[capIdx].map((cell, noiIdx) => {
                const isBase = capIdx === highlightCapIdx && noiIdx === baseNoiIdx;
                return (
                  <td
                    key={noiIdx}
                    className="whitespace-nowrap px-3 py-2 text-right"
                    style={
                      isBase
                        ? { backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-contrast)', fontWeight: 600 }
                        : undefined
                    }
                  >
                    {formatValue(cell)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
