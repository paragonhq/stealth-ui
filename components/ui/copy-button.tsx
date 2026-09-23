"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

type CopyState = "idle" | "copied" | "failed";
type Value = string | (() => string | Promise<string>);

async function writeText(text: string) {
  if (navigator.clipboard?.writeText && window.isSecureContext) return navigator.clipboard.writeText(text);
  // Insecure contexts (plain http, some embeds) have no async clipboard.
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("The browser refused the copy command");
}

/** The copy lifecycle on its own, for when the trigger isn't a button. */
export function useCopy({ timeout = 2000, onCopied, onError }: { timeout?: number; onCopied?: (text: string) => void; onError?: (error: unknown) => void } = {}) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = useCallback(
    async (value: Value) => {
      window.clearTimeout(timer.current);
      try {
        const text = typeof value === "function" ? await value() : value;
        // Never report a success that didn't happen.
        if (!text) throw new Error("Nothing to copy");
        await writeText(text);
        setState("copied");
        onCopied?.(text);
      } catch (error) {
        setState("failed");
        onError?.(error);
      }
      timer.current = window.setTimeout(() => setState("idle"), timeout);
    },
    [timeout, onCopied, onError],
  );

  return { state, copy };
}

export type CopyButtonProps = Omit<React.ComponentProps<"button">, "value" | "children" | "onCopy"> & {
  /** The text to copy, or a function that returns it (sync or async) at press time. */
  value: Value;
  label?: string;
  copiedLabel?: string;
  failedLabel?: string;
  /** Square button with only the icon. The label becomes the accessible name. */
  iconOnly?: boolean;
  size?: "sm" | "md";
  variant?: "secondary" | "ghost";
  /** Milliseconds before the button returns to its resting state. */
  timeout?: number;
  onCopied?: (text: string) => void;
  onError?: (error: unknown) => void;
};

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  failedLabel = "Failed",
  iconOnly = false,
  size = "md",
  variant = "secondary",
  timeout = 2000,
  onCopied,
  onError,
  disabled,
  className,
  onClick,
  ...rest
}: CopyButtonProps) {
  const { state, copy } = useCopy({ timeout, onCopied, onError });
  const reduce = useReducedMotion();
  const empty = value === "";
  const text = state === "copied" ? copiedLabel : state === "failed" ? failedLabel : label;

  // Swaps pop in place. Reduced motion keeps the crossfade and drops the travel.
  const enter = reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" };
  const leave = reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" };

  return (
    <>
      <button
        type="button"
        data-state={state}
        data-size={size}
        data-variant={variant}
        disabled={disabled || empty}
        aria-label={iconOnly ? text : undefined}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) copy(value);
        }}
        className={cn(
          "group/copy relative inline-flex shrink-0 select-none items-center justify-center font-medium tracking-[-0.005em]",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.97] active:duration-75",
          "disabled:pointer-events-none disabled:opacity-50",
          size === "sm" ? "h-7 gap-1.5 rounded-md text-[12px]" : "h-8 gap-2 rounded-lg text-[12.5px]",
          iconOnly ? (size === "sm" ? "w-7" : "w-8") : size === "sm" ? "px-2" : "px-2.5",
          // Icon-only buttons draw at 28–32px; on touch the hit area grows to 44px+ without changing the drawing.
          iconOnly && "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
          variant === "secondary"
            ? "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover"
            : "text-fg-2 hover:bg-hover hover:text-fg",
          state === "failed" && "text-danger hover:text-danger",
          className,
        )}
        {...rest}
      >
        <span className="relative grid size-4 place-items-center">
          <AnimatePresence initial={false}>
            <motion.span
              key={state}
              className="absolute inset-0 grid place-items-center"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(3px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(3px)" }}
              transition={reduce ? { duration: 0.15 } : spring.pop}
            >
              <Glyph state={state} reduce={!!reduce} />
            </motion.span>
          </AnimatePresence>
        </span>

        {!iconOnly && (
          // Every label sits in the same grid cell, so the button is always as wide
          // as the longest one and never shifts the layout around it.
          <span className="grid overflow-hidden py-1 text-left">
            {[label, copiedLabel, failedLabel].map((l, i) => (
              <span key={i} aria-hidden className="invisible col-start-1 row-start-1">{l}</span>
            ))}
            <AnimatePresence initial={false}>
              <motion.span
                key={state}
                className="col-start-1 row-start-1"
                initial={enter}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={leave}
                transition={{ duration: reduce ? 0.15 : 0.22, ease: ease.out }}
              >
                {text}
              </motion.span>
            </AnimatePresence>
          </span>
        )}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? copiedLabel : state === "failed" ? failedLabel : ""}
      </span>
    </>
  );
}

function Glyph({ state, reduce }: { state: CopyState; reduce: boolean }) {
  const draw = reduce ? {} : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 0.32, ease: ease.out, delay: 0.04 } };
  const common = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (state === "copied")
    return (
      <svg {...common}>
        <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" {...draw} />
      </svg>
    );
  if (state === "failed")
    return (
      <svg {...common}>
        <motion.path d="m4.5 4.5 7 7" {...draw} />
        <motion.path d="m11.5 4.5-7 7" {...draw} transition={{ ...draw.transition, delay: 0.12 }} />
      </svg>
    );
  return (
    <svg {...common} className="transition-transform duration-200 ease-out group-hover/copy:-translate-y-px">
      <rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.75" />
      <path d="M10.5 5.5V4.25A1.25 1.25 0 0 0 9.25 3h-5A1.25 1.25 0 0 0 3 4.25v5A1.25 1.25 0 0 0 4.25 10.5H5.5" />
    </svg>
  );
}
