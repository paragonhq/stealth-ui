"use client";
import { Input as BaseInput } from "@base-ui/react/input";
import NumberFlow from "@number-flow/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { useControllableState } from "@/lib/use-controllable-state";

export type TextareaProps = Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "rows"> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Height when empty, in lines. */
  minRows?: number;
  /** Grows with the text up to this many lines, then scrolls. */
  maxRows?: number;
  /** A soft character limit: typing past it is allowed but marks the field invalid. Use maxLength for a hard stop. */
  limit?: number;
  /** How many characters before the limit the count appears. Defaults to 20% of the limit. */
  countFrom?: number;
  /** Called on Cmd+Enter (Ctrl+Enter off Mac) with the current text. */
  onModEnter?: (value: string) => void;
  /** Label for the shortcut hint shown while focused, e.g. "to send". Set to false to hide the hint. */
  modEnterHint?: string | false;
  /** Content for the left of the footer row, after the shortcut hint: a formatting note, an attach button. */
  footer?: React.ReactNode;
  /** Content for the right end of the footer row, after the count: usually the send button. */
  actions?: React.ReactNode;
  invalid?: boolean;
  /** Classes for the inner textarea; `className` styles the outer box. */
  textareaClassName?: string;
};

// Mac check that is stable through hydration: the server and the first client
// render both say Mac, then the real answer arrives without a mismatch warning.
const subscribe = () => () => {};
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export function useIsMac() {
  return useSyncExternalStore(subscribe, isMac, () => true);
}

/**
 * Sizes a textarea to its content between two line counts. It measures a hidden
 * twin instead of collapsing the real field to auto, so the page never jumps
 * and the height can transition. Returns refs for the field and the twin.
 */
export function useAutosize(value: string, { minRows = 2, maxRows = 8 } = {}) {
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const twinRef = useRef<HTMLTextAreaElement | null>(null);
  const [overflow, setOverflow] = useState(false);

  const measure = useCallback(() => {
    const el = fieldRef.current;
    const m = twinRef.current;
    if (!el || !m) return;
    const cs = getComputedStyle(el);
    const line = parseFloat(cs.lineHeight) || 20;
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    m.value = el.value || " ";
    const content = m.scrollHeight - pad;
    const next = Math.min(Math.max(content, minRows * line), maxRows * line) + pad;
    el.style.height = `${next}px`;
    setOverflow(content > maxRows * line + 1);
  }, [minRows, maxRows]);

  useLayoutEffect(measure, [measure, value]);

  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    // Width changes rewrap the text, so the height has to follow.
    let w = el.offsetWidth;
    const ro = new ResizeObserver(() => {
      if (el.offsetWidth === w) return;
      w = el.offsetWidth;
      measure();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return { fieldRef, twinRef, overflow };
}

export function Textarea({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  minRows = 2,
  maxRows = 8,
  limit,
  countFrom,
  onModEnter,
  modEnterHint = "to send",
  footer,
  actions,
  invalid,
  disabled,
  readOnly,
  className,
  textareaClassName,
  onKeyDown,
  ref,
  ...rest
}: TextareaProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const { fieldRef, twinRef, overflow } = useAutosize(value, { minRows, maxRows });
  const mac = useIsMac();
  const [fired, setFired] = useState(false);
  const firedTimer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(firedTimer.current), []);

  const setRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      fieldRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref, fieldRef],
  );

  const length = value.length;
  const threshold = limit != null ? (countFrom ?? Math.max(10, Math.round(limit * 0.2))) : 0;
  const showCount = limit != null && length >= limit - threshold;
  const over = limit != null && length > limit;
  const isInvalid = invalid || over;
  const showHint = !!onModEnter && modEnterHint !== false && !readOnly;
  const hasFooter = footer != null || actions != null || limit != null || showHint;

  // Announce crossings, not keystrokes: entering the last stretch, reaching the limit, going over.
  const remaining = limit != null ? limit - length : 0;
  const announcement =
    limit == null || !showCount ? "" : over ? "Over the character limit" : remaining === 0 ? "Character limit reached" : remaining <= 10 ? "10 or fewer characters left" : `${threshold} or fewer characters left`;

  return (
    <div
      data-slot="textarea"
      data-invalid={isInvalid || undefined}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
      className={cn(
        "group/textarea relative flex w-full min-w-0 flex-col rounded-lg border border-line-2 bg-raised text-fg shadow-[var(--shadow)]",
        "transition-[border-color,box-shadow,background-color] duration-150 ease-out",
        "hover:border-fg-4 focus-within:border-fg-3 focus-within:ring-3 focus-within:ring-fg/8 hover:focus-within:border-fg-3",
        "data-invalid:border-danger/70 data-invalid:hover:border-danger data-invalid:focus-within:border-danger data-invalid:focus-within:ring-danger/15",
        "has-[textarea[data-invalid]]:border-danger/70 has-[textarea[data-invalid]]:focus-within:border-danger has-[textarea[data-invalid]]:focus-within:ring-danger/15",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:shadow-none data-disabled:hover:border-line-2",
        "data-readonly:bg-frame data-readonly:shadow-none data-readonly:hover:border-line-2 data-readonly:focus-within:border-line-2",
        className,
      )}
      // Pressing the footer's empty space puts the caret back in the text.
      onMouseDown={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest("textarea, button, a, input, [role=button]") || disabled) return;
        e.preventDefault();
        fieldRef.current?.focus();
      }}
    >
      <div className="relative">
        {/* Base UI Input rendered as a textarea, so Field.Label, validation and Field.Error work as they do for Input. */}
        <BaseInput
          ref={setRef as unknown as React.Ref<HTMLInputElement>}
          value={value}
          onValueChange={(next) => setValue(next)}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={isInvalid || undefined}
          data-overflow={overflow || undefined}
          className={cn(
            "block w-full resize-none overflow-hidden bg-transparent px-2.5 py-2 text-base leading-6 outline-none sm:text-[13px] sm:leading-5",
            "placeholder:text-fg-4 disabled:cursor-not-allowed",
            // Growth eases so a new line reads as the box making room, not a jolt.
            "transition-[height] duration-100 ease-out motion-reduce:transition-none",
            "data-overflow:overflow-y-auto [scrollbar-width:thin]",
            hasFooter && "pb-1",
            textareaClassName,
          )}
          render={
            <textarea
              rows={minRows}
              {...rest}
              onKeyDown={(e) => {
                onKeyDown?.(e);
                if (e.defaultPrevented || !onModEnter) return;
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  onModEnter(e.currentTarget.value);
                  setFired(true);
                  window.clearTimeout(firedTimer.current);
                  firedTimer.current = window.setTimeout(() => setFired(false), 160);
                }
              }}
            />
          }
        />
        {/* The twin: same box and type, never seen, used only for measuring. */}
        <textarea
          ref={twinRef}
          aria-hidden
          tabIndex={-1}
          readOnly
          rows={1}
          className={cn(
            "pointer-events-none invisible absolute inset-x-0 top-0 block h-0 w-full resize-none overflow-hidden px-2.5 py-2 text-base leading-6 sm:text-[13px] sm:leading-5",
            hasFooter && "pb-1",
            textareaClassName,
          )}
        />
      </div>

      {hasFooter && (
        <div className="flex min-h-8 items-center gap-2 pb-1.5 pl-2.5 pr-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {showHint && (
              <span
                className={cn(
                  "flex items-center gap-1 whitespace-nowrap text-[11px] text-fg-4 opacity-0 transition-opacity duration-150 pointer-coarse:hidden",
                  "group-focus-within/textarea:opacity-100",
                )}
              >
                <span className="flex items-center gap-0.5">
                  <Key pressed={fired}>{mac ? "⌘" : "Ctrl"}</Key>
                  <Key pressed={fired}>↵</Key>
                </span>
                {modEnterHint}
              </span>
            )}
            {footer}
          </div>

          {limit != null && (
            <span
              aria-hidden
              data-state={showCount ? "visible" : "hidden"}
              data-over={over || undefined}
              className={cn(
                "flex items-center px-1 text-[11.5px] tabular text-fg-3 transition-[opacity,translate,color] duration-200 ease-out-expo",
                "data-[state=hidden]:translate-y-1 data-[state=hidden]:opacity-0 data-[state=hidden]:duration-100",
                "data-over:text-danger motion-reduce:translate-y-0",
              )}
            >
              <NumberFlow value={length} />
              <span className="opacity-60">/{limit}</span>
            </span>
          )}

          {actions}
        </div>
      )}

      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}

function Key({ pressed, children }: { pressed: boolean; children: React.ReactNode }) {
  return (
    <kbd
      data-pressed={pressed || undefined}
      className={cn(
        "inline-grid h-[18px] min-w-[18px] place-items-center rounded-[4px] border border-line-2 bg-frame px-1 font-sans text-[10.5px] leading-none text-fg-3",
        // The keycap dips when the shortcut fires, so the send is acknowledged where the eye already is.
        "transition-[scale,background-color,color] duration-150 ease-out data-pressed:scale-[0.88] data-pressed:bg-hover data-pressed:text-fg data-pressed:duration-75",
      )}
    >
      {children}
    </kbd>
  );
}
