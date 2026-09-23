"use client";
import { useCallback, useState } from "react";

/**
 * One state that is either controlled (`value` + `onChange`) or uncontrolled
 * (`defaultValue`). Never half of one: when `value` is defined, the prop wins.
 */
export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: {
  value?: T;
  defaultValue: T;
  onChange?: (next: T) => void;
}) {
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(current) : next;
      if (Object.is(resolved, current)) return;
      if (!controlled) setInner(resolved);
      onChange?.(resolved);
    },
    [controlled, current, onChange],
  );

  return [current, set] as const;
}
