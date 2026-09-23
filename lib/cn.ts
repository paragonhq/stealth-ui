type Value = string | number | false | null | undefined;

/** Joins class names, dropping falsy values. Later classes are appended, so pass overrides last. */
export function cn(...values: Value[]) {
  let out = "";
  for (const v of values) if (v) out += (out ? " " : "") + v;
  return out;
}
