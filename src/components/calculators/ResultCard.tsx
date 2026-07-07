import type { ReactNode } from 'react';

export type ResultRow = {
  label: string;
  /** Pre-formatted display string — format with calc-core's money.ts helpers before passing in. */
  value: string;
  emphasis?: boolean;
  helpText?: string;
};

export type ResultCardProps = {
  rows: ResultRow[];
  /** Shown instead of rows when there's nothing to calculate yet (SPEC.md §7 — never show NaN). */
  emptyState?: ReactNode;
  title?: string;
};

const DEFAULT_EMPTY_STATE = 'Enter values to calculate.';

export default function ResultCard({ rows, emptyState = DEFAULT_EMPTY_STATE, title }: ResultCardProps) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}
    >
      {title && <h2 className="mb-3 text-sm font-semibold">{title}</h2>}
      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {emptyState}
        </p>
      ) : (
        <dl className="space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4">
              <dt className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {row.label}
              </dt>
              <dd className={row.emphasis ? 'text-lg font-semibold' : 'text-sm font-medium'}>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
