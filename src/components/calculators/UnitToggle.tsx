export type UnitToggleOption<T extends string> = {
  value: T;
  label: string;
};

export type UnitToggleProps<T extends string> = {
  options: readonly UnitToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
};

/** Segmented control for mode/unit switches, e.g. sf/lf or psf/annual. */
export default function UnitToggle<T extends string>({ options, value, onChange, label }: UnitToggleProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-md border p-1"
      style={{ borderColor: 'var(--color-border)' }}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className="rounded px-3 py-1 text-sm transition-colors"
            style={{
              backgroundColor: isActive ? 'var(--color-accent)' : 'transparent',
              color: isActive ? 'var(--color-accent-contrast)' : 'var(--color-text)',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
