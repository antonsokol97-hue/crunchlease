import type { ReactNode } from 'react';

export type CalcShellProps = {
  inputs: ReactNode;
  results: ReactNode;
  shareBar?: ReactNode;
  className?: string;
};

/**
 * Layout wrapper for a calculator island: an inputs region and a results
 * region, side by side on desktop and stacked on mobile (SPEC.md §4). Each
 * tool composes this from NumberInput/UnitToggle on the left and
 * ResultCard/ShareBar on the right — no formulas live here.
 */
export default function CalcShell({ inputs, results, shareBar, className = '' }: CalcShellProps) {
  return (
    <div
      className={`grid gap-6 rounded-lg border p-4 md:grid-cols-2 md:p-6 ${className}`}
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className="space-y-4">{inputs}</div>
      <div className="space-y-4">
        {results}
        {shareBar}
      </div>
    </div>
  );
}
