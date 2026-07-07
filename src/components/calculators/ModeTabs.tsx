export type ModeTabOption<T extends string> = {
  value: T;
  label: string;
};

export type ModeTabsProps<T extends string> = {
  options: readonly ModeTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
};

/**
 * Tab bar for tools with input modes (SPEC.md §5), e.g. NNN's psf ↔ totals.
 * Rendered as an ARIA tablist; the calculator island owns the panels.
 */
export default function ModeTabs<T extends string>({ options, value, onChange, label }: ModeTabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className="-mb-px border-b-2 px-4 py-2 text-sm font-medium"
            style={{
              borderColor: isActive ? 'var(--color-accent)' : 'transparent',
              color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
