import { useEffect, useState } from 'react';
import { getRentUnit, RENT_UNIT_EVENT, setRentUnit, type RentUnit } from '../lib/rentUnit';

/**
 * Read/write the sitewide rent-basis unit (SPEC.md §6). Stays in sync with
 * other islands in the same tab (custom event) and across tabs (storage event).
 */
export function useRentUnit(): [RentUnit, (unit: RentUnit) => void] {
  const [unit, setUnitState] = useState<RentUnit>(() => getRentUnit());

  useEffect(() => {
    const sync = () => setUnitState(getRentUnit());
    window.addEventListener(RENT_UNIT_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(RENT_UNIT_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setUnit = (next: RentUnit) => {
    setRentUnit(next);
    setUnitState(next);
  };

  return [unit, setUnit];
}
