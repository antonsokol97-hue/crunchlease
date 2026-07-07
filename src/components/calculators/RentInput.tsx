import { useRentUnit } from '../../hooks/useRentUnit';
import { fromDisplayUnit, toDisplayUnit } from '../../lib/rentUnit';
import NumberInput from './NumberInput';

export type RentInputProps = {
  id: string;
  label: string;
  /** Canonical value in $/{unitLabel}/yr. */
  valuePerYr: number;
  onChangePerYr: (perYr: number) => void;
  /** Range in canonical $/…/yr terms; converted for the active display unit. */
  minPerYr?: number;
  maxPerYr?: number;
  stepPerYr?: number;
  /** Area basis, e.g. "SF", "RSF", "USF". */
  unitLabel?: string;
  tooltip?: string;
  errorText?: string;
  helpText?: string;
};

/**
 * A NumberInput that follows the sitewide rent-basis toggle (SPEC.md §6):
 * displays and accepts the value in $/{unitLabel}/yr or /mo, but stores the
 * canonical $/{unitLabel}/yr value via onChangePerYr.
 */
export default function RentInput({
  id,
  label,
  valuePerYr,
  onChangePerYr,
  minPerYr,
  maxPerYr,
  stepPerYr = 0.25,
  unitLabel = 'SF',
  tooltip,
  errorText,
  helpText,
}: RentInputProps) {
  const [unit] = useRentUnit();
  const conv = (n: number | undefined) => (n === undefined ? undefined : toDisplayUnit(n, unit));

  return (
    <NumberInput
      id={id}
      label={label}
      value={toDisplayUnit(valuePerYr, unit)}
      onChange={(displayValue) => onChangePerYr(fromDisplayUnit(displayValue, unit))}
      min={conv(minPerYr)}
      max={conv(maxPerYr)}
      step={unit === 'mo' ? stepPerYr / 12 : stepPerYr}
      suffix={`$/${unitLabel}/${unit}`}
      tooltip={tooltip}
      errorText={errorText}
      helpText={helpText}
    />
  );
}
