/**
 * Generic, framework-agnostic URL query-param encode/decode for calculator
 * state (SPEC.md §4.1). Each tool defines its own `ParamSchema` mapping field
 * names to short query keys; invalid or missing values silently fall back to
 * the field's default — results should never show NaN.
 */

export type ParamCodec<T> = {
  default: T;
  /** Parse a non-null raw query value. Throwing or returning an invalid value falls back to `default`. */
  parse: (raw: string) => T;
  /** Serialize a value for the URL, or return `null` to omit the param (e.g. when it equals the default). */
  serialize: (value: T) => string | null;
};

export type ParamSchema<T extends Record<string, unknown>> = {
  [K in keyof T]: ParamCodec<T[K]>;
};

/** Decode a full state object from URLSearchParams, using per-field defaults for anything missing or invalid. */
export function decodeParams<T extends Record<string, unknown>>(
  schema: ParamSchema<T>,
  search: URLSearchParams,
): T {
  const result = {} as T;
  (Object.keys(schema) as Array<keyof T>).forEach((key) => {
    const codec = schema[key];
    const raw = search.get(String(key));
    if (raw === null) {
      result[key] = codec.default;
      return;
    }
    try {
      result[key] = codec.parse(raw);
    } catch {
      result[key] = codec.default;
    }
  });
  return result;
}

/** Encode a state object into URLSearchParams, omitting params whose codec says to (typically default values). */
export function encodeParams<T extends Record<string, unknown>>(
  schema: ParamSchema<T>,
  values: T,
): URLSearchParams {
  const params = new URLSearchParams();
  (Object.keys(schema) as Array<keyof T>).forEach((key) => {
    const codec = schema[key];
    const serialized = codec.serialize(values[key]);
    if (serialized !== null) params.set(String(key), serialized);
  });
  return params;
}

/** Numeric param codec: invalid/missing values fall back to `defaultValue`; the default is omitted from the URL. */
export function numberParam(defaultValue: number): ParamCodec<number> {
  return {
    default: defaultValue,
    parse: (raw) => {
      const n = Number(raw);
      return Number.isFinite(n) ? n : defaultValue;
    },
    serialize: (value) => (Number.isFinite(value) && value !== defaultValue ? String(value) : null),
  };
}

/** Enum param codec: any value outside `values` falls back to `defaultValue`; the default is omitted from the URL. */
export function enumParam<T extends string>(values: readonly T[], defaultValue: T): ParamCodec<T> {
  return {
    default: defaultValue,
    parse: (raw) => ((values as readonly string[]).includes(raw) ? (raw as T) : defaultValue),
    serialize: (value) => (value === defaultValue ? null : value),
  };
}
