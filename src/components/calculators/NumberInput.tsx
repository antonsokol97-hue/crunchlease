import { useEffect, useState, type ChangeEvent } from 'react';

export type NumberInputProps = {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Unit suffix shown after the field, e.g. "$/SF/yr". */
  suffix?: string;
  /** Externally supplied validation message (e.g. cross-field checks like rsf < usf) — takes priority over range clamping. */
  errorText?: string;
  helpText?: string;
};

/**
 * Labeled numeric input with clamp-on-blur range validation and inline error
 * text (SPEC.md §7). Typing an out-of-range value shows the error and
 * keeps the typed value until blur, at which point it clamps.
 */
export default function NumberInput({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  errorText,
  helpText,
}: NumberInputProps) {
  const [rawValue, setRawValue] = useState(String(value));
  const [rangeError, setRangeError] = useState<string | null>(null);

  useEffect(() => {
    setRawValue(String(value));
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setRawValue(next);
    const parsed = Number(next);
    if (next !== '' && Number.isFinite(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = Number(rawValue);
    if (rawValue === '' || !Number.isFinite(parsed)) {
      setRangeError(null);
      return;
    }
    let clamped = parsed;
    if (min !== undefined && clamped < min) clamped = min;
    if (max !== undefined && clamped > max) clamped = max;
    if (clamped !== parsed) {
      setRangeError(`Value must be between ${min} and ${max}.`);
      setRawValue(String(clamped));
      onChange(clamped);
    } else {
      setRangeError(null);
    }
  };

  const message = errorText ?? rangeError;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={rawValue}
          min={min}
          max={max}
          step={step}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={Boolean(message)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: message ? 'var(--color-error)' : 'var(--color-border)' }}
        />
        {suffix && (
          <span className="whitespace-nowrap text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {suffix}
          </span>
        )}
      </div>
      {message && (
        <p className="text-xs" style={{ color: 'var(--color-error)' }}>
          {message}
        </p>
      )}
      {!message && helpText && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {helpText}
        </p>
      )}
    </div>
  );
}
