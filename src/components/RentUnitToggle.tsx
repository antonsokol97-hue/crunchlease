import { useRentUnit } from '../hooks/useRentUnit';
import UnitToggle from './calculators/UnitToggle';

/**
 * Sitewide rent-basis toggle (SPEC.md §6). Rendered in the header; sets the
 * unit rent is entered in ($/SF/yr default, or $/SF/mo). Results always show
 * both bases regardless.
 */
export default function RentUnitToggle() {
  const [unit, setUnit] = useRentUnit();
  return (
    <UnitToggle
      label="Rent basis"
      options={[
        { value: 'yr', label: '$/SF/yr' },
        { value: 'mo', label: '$/SF/mo' },
      ]}
      value={unit}
      onChange={setUnit}
    />
  );
}
