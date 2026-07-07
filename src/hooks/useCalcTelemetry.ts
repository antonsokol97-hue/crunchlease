import { useEffect, useRef } from 'react';
import { track, trackOnce } from '../lib/analytics';

/**
 * Fires the per-tool calc analytics (SPEC.md §10): `calc_input_change` once per
 * session on the first input edit, and `calc_result_valid` (debounced) whenever
 * a valid result settles. `signature` should change whenever inputs change
 * (e.g. JSON.stringify of the tool state).
 */
export function useCalcTelemetry(tool: string, signature: string, ok: boolean): void {
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return; // skip the initial (default-state) render
    }
    trackOnce(`input:${tool}`, 'calc_input_change', { tool });
  }, [tool, signature]);

  useEffect(() => {
    if (!ok) return;
    const id = window.setTimeout(() => track('calc_result_valid', { tool }), 500);
    return () => window.clearTimeout(id);
  }, [tool, signature, ok]);
}
