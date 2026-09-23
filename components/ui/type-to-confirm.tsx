"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Check, Loader } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

function commonPrefix(a: string, b: string) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * The matching logic on its own: whether the text matches, how much of it is
 * right so far, and a hint for the near misses people actually make (a stray
 * space, the wrong capitals).
 */
export function useTypeToConfirm(resource: string, typed: string) {
  const matched = typed === resource;
  const progress = resource.length ? commonPrefix(typed, resource) / resource.length : 0;
  let hint: "space" | "case" | null = null;
  if (!matched && typed.length >= resource.length) {
    if (typed.trim() === resource) hint = "space";
    else if (typed.toLowerCase() === resource.toLowerCase()) hint = "case";
  }
  return { matched, progress: matched ? 1 : progress, hint };
}

type Phase = "idle" | "pending" | "error" | "done";

export type TypeToConfirmProps = Omit<React.ComponentProps<"form">, "onSubmit" | "children" | "defaultValue"> & {
  /** The exact text to type: a project slug, a repo name, an email. */
  resource: string;
  /** The verb on the button. */
  action?: string;
  /** Runs on an exact match. Return a promise to show progress; a rejection shows the error and lets them try again. */
  onConfirm: () => void | Promise<unknown>;
  /** Shows a Cancel button. */
  onCancel?: () => void;
  cancelLabel?: string;
  /** Replaces the default "To confirm, type … below". */
  label?: React.ReactNode;
  /** The button's label once onConfirm resolves. */
  confirmedLabel?: string;
  /** Shown when onConfirm rejects. */
  errorText?: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

/** The last gate before something irreversible: type the name, and only an exact match unlocks the button. */
export function TypeToConfirm({
  resource,
  action = "Delete",
  onConfirm,
  onCancel,
  cancelLabel = "Cancel",
  label,
  confirmedLabel = "Done",
  errorText,
  value,
  defaultValue = "",
  onValueChange,
  disabled = false,
  autoFocus = false,
  className,
  ...rest
}: TypeToConfirmProps) {
  const id = useId();
  const reduce = !!useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useControllableState({ value, defaultValue, onChange: onValueChange });
  const [phase, setPhase] = useState<Phase>("idle");
  const [nudged, setNudged] = useState(false);
  const { matched, progress, hint } = useTypeToConfirm(resource, typed);
  const locked = !matched || disabled;
  const busy = phase === "pending";
  const done = phase === "done";

  const submit = async () => {
    if (busy || done || disabled) return;
    if (!matched) {
      setNudged(true);
      inputRef.current?.focus();
      return;
    }
    setPhase("pending");
    try {
      await onConfirm();
      setPhase("done");
    } catch {
      setPhase("error");
    }
  };

  const message =
    phase === "error"
      ? (errorText ?? `Couldn’t ${action.toLowerCase()} ${resource}. Try again.`)
      : hint === "space"
        ? "Remove the extra space"
        : hint === "case"
          ? "Match the capitals exactly"
          : nudged && !matched
            ? `Type ${resource} exactly to continue`
            : null;
  const tone = phase === "error" || (nudged && !matched && !hint) ? "danger" : "muted";

  return (
    <form
      noValidate
      data-state={done ? "done" : matched ? "unlocked" : "locked"}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={cn("flex w-full min-w-0 flex-col gap-2", className)}
      {...rest}
    >
      <label htmlFor={`${id}-input`} className="text-[12.5px] leading-[18px] text-fg-2 text-pretty">
        {label ?? (
          <>
            To confirm, type <code className="rounded-[4px] border border-line bg-hover px-1 py-px font-mono text-[12px] text-fg">{resource}</code> below
          </>
        )}
      </label>

      <div
        className={cn(
          "relative flex h-9 items-center rounded-lg border border-line-2 bg-frame",
          "transition-[border-color,box-shadow] duration-150 focus-within:border-fg-4 focus-within:ring-3 focus-within:ring-fg/10",
          (disabled || done) && "opacity-60",
        )}
      >
        <input
          ref={inputRef}
          id={`${id}-input`}
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            setNudged(false);
            if (phase === "error") setPhase("idle");
          }}
          readOnly={busy || done}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-invalid={tone === "danger" || undefined}
          aria-describedby={message ? `${id}-message` : undefined}
          className="h-full w-full min-w-0 rounded-lg bg-transparent px-3 font-mono text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]"
        />
        {/* How much of the name is right so far. It grows as they type and pulls back to where a typo starts. */}
        <span aria-hidden className="pointer-events-none absolute inset-x-2.5 -bottom-px h-px overflow-hidden">
          <span
            className={cn(
              "block h-full origin-left transition-[scale,background-color] duration-200 ease-out-expo motion-reduce:transition-none",
              matched ? "bg-danger" : "bg-fg-3",
            )}
            style={{ scale: `${progress} 1` }}
          />
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 pt-1">
        {/* Hints share the button row, so they never push the layout around. */}
        <p
          id={`${id}-message`}
          role={phase === "error" ? "alert" : "status"}
          aria-live="polite"
          className={cn("relative min-w-0 flex-[1_1_10rem] text-[12px] leading-[18px]", tone === "danger" ? "text-danger" : "text-fg-3")}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {message && (
              <motion.span
                key={String(message)}
                className="block"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.18, ease: ease.out }}
              >
                {message}
              </motion.span>
            )}
          </AnimatePresence>
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {onCancel && !done && (
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className={cn(
                "inline-flex h-8 items-center rounded-lg border border-line-2 bg-raised px-3 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] outline-none",
                "transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 disabled:opacity-50",
              )}
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="submit"
            // Locked stays focusable and pressable: pressing it explains what's missing instead of doing nothing.
            aria-disabled={locked || busy || done || undefined}
            aria-busy={busy || undefined}
            data-state={done ? "done" : matched ? "unlocked" : "locked"}
            className={cn(
              "relative inline-flex h-8 items-center rounded-lg px-3 text-[12.5px] font-medium outline-none",
              "transition-[background-color,color,box-shadow,scale] duration-200 ease-out",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              locked ? "cursor-not-allowed bg-danger-soft text-danger/70" : "bg-danger text-frame shadow-[var(--shadow)] hover:bg-danger/90 active:scale-[0.97] active:duration-75",
              (busy || done) && "pointer-events-none",
            )}
          >
            <span className={cn("inline-flex items-center gap-1.5 transition-opacity duration-150", busy && "opacity-0")}>
              <span className="relative grid size-3.5 place-items-center">
                <AnimatePresence initial={false}>
                  <motion.span
                    key={done ? "done" : "lock"}
                    className="absolute inset-0 grid place-items-center"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
                    transition={reduce ? { duration: 0.12 } : spring.pop}
                  >
                    {done ? <Check size={14} /> : <Padlock open={matched && !disabled} reduce={reduce} />}
                  </motion.span>
                </AnimatePresence>
              </span>
              {/* Both labels share one cell so the button never changes width. */}
              <span className="grid">
                <span aria-hidden className="invisible col-start-1 row-start-1">
                  {action}
                </span>
                <span aria-hidden className="invisible col-start-1 row-start-1">
                  {confirmedLabel}
                </span>
                <span className="col-start-1 row-start-1 text-center">{done ? confirmedLabel : action}</span>
              </span>
            </span>
            {busy && (
              <span className="absolute inset-0 grid place-items-center">
                <Loader size={14} className="animate-spin-slow" />
              </span>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

// The shackle lifts out of the body on an exact match: the one moment this component exists for.
function Padlock({ open, reduce }: { open: boolean; reduce: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <motion.path
        initial={false}
        animate={{ d: open ? "M5.5 7V3.9a2.5 2.5 0 0 1 5 0V5.2" : "M5.5 7V5.25a2.5 2.5 0 0 1 5 0V7" }}
        transition={reduce ? { duration: 0 } : { ...spring.bouncy }}
      />
    </svg>
  );
}
