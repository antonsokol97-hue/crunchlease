import { track } from '../../lib/analytics';

export type YearTableColumn<Row> = {
  header: string;
  /** Display string for a cell (formatted with money helpers). */
  cell: (row: Row) => string;
  /** Raw value for CSV export; defaults to `cell(row)`. */
  csv?: (row: Row) => string | number;
  align?: 'left' | 'right';
};

export type YearTableProps<Row> = {
  rows: Row[];
  columns: YearTableColumn<Row>[];
  caption?: string;
  /** Enables the "Download CSV" button when set. */
  csvFileName?: string;
  /** Tool slug, for the csv_export analytics event (SPEC.md §10). */
  tool?: string;
};

function toCsv<Row>(rows: Row[], columns: YearTableColumn<Row>[]): string {
  const escape = (value: string | number) => {
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => escape(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => escape(c.csv ? c.csv(row) : c.cell(row))).join(','));
  return [header, ...body].join('\n');
}

/**
 * Schedule table with a sticky header and optional CSV download (SPEC.md §5).
 * Wrapped in an `overflow-x-auto` container so wide tables scroll rather than
 * breaking the page layout.
 */
export default function YearTable<Row>({ rows, columns, caption, csvFileName, tool }: YearTableProps<Row>) {
  const handleCsv = () => {
    if (tool) track('csv_export', { tool });
    const blob = new Blob([toCsv(rows, columns)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = csvFileName as string;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {csvFileName && (
        <div className="mb-2 flex justify-end" data-print-hide>
          <button
            type="button"
            onClick={handleCsv}
            className="rounded-md border px-3 py-1 text-sm"
            style={{ borderColor: 'var(--color-border)' }}
          >
            Download CSV
          </button>
        </div>
      )}
      <div
        className="overflow-x-auto rounded-md border"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-card)' }}
      >
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr style={{ backgroundColor: 'var(--color-muted)' }}>
              {columns.map((c) => (
                <th
                  key={c.header}
                  scope="col"
                  className="sticky top-0 whitespace-nowrap px-3 py-2 font-medium"
                  style={{
                    textAlign: c.align ?? 'left',
                    backgroundColor: 'var(--color-muted)',
                  }}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                {columns.map((c) => (
                  <td key={c.header} className="whitespace-nowrap px-3 py-2" style={{ textAlign: c.align ?? 'left' }}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
