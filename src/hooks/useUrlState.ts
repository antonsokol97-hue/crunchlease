import { useEffect, useRef, useState } from 'react';
import { decodeParams, encodeParams, type ParamSchema } from '../lib/urlState';

const DEBOUNCE_MS = 300;

/**
 * Hydrates calculator state from the URL on mount and debounces
 * `history.replaceState` on every subsequent change (SPEC.md §4.1).
 * `schema` should be a stable, module-scoped `ParamSchema` for the tool.
 */
export function useUrlState<T extends Record<string, unknown>>(schema: ParamSchema<T>) {
  const [state, setState] = useState<T>(() => {
    const search = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
    return decodeParams(schema, search);
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = encodeParams(schema, state);
      const query = params.toString();
      const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', url);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // schema is expected to be a stable, module-scoped reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return [state, setState] as const;
}
