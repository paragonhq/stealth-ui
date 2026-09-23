"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Field, FieldControl, FieldDescription, FieldLabel, type FieldControlProps } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type ValidationStatus = "idle" | "checking" | "valid" | "invalid" | "error";

/** Return nothing when the value is fine, or the message to show when it isn't. Throw when the check itself failed. */
export type AsyncValidator = (value: string, ctx: { signal: AbortSignal }) => Promise<React.ReactNode | null | undefined> | React.ReactNode | null | undefined;

type Options = {
  validate: AsyncValidator;
  /** Milliseconds of quiet typing before a check starts. */
  debounce?: number;
  /** Once the spinner shows, it stays at least this long so a fast answer never flickers. */
  minPending?: number;
  onStatusChange?: (status: ValidationStatus) => void;
};

/**
 * The check on its own. Call `change` on every edit and `flush` on blur.
 * Stale answers are dropped (each check aborts the last), empty values are idle,
 * and the same value is never checked twice in a row: after a failed check, `retry` asks again.
 */
export function useInlineValidation({ validate, debounce = 450, minPending = 500, onStatusChange }: Options) {
  const [status, setStatus] = useState<ValidationStatus>("idle");
  const [message, setMessage] = useState<React.ReactNode>(null);
  // The value the current answer is about, which is not always the one on screen.
  const [subject, setSubject] = useState("");
  // True while the value on screen differs from the one the current answer is about.
  const [stale, setStale] = useState(false);
  const timer = useRef<number>(undefined);
  const hold = useRef<number>(undefined);
  const abort = useRef<AbortController | null>(null);
  const runId = useRef(0);
  const checked = useRef<{ value: string } | null>(null);
  const latest = useRef({ validate, onStatusChange });
  useEffect(() => {
    latest.current = { validate, onStatusChange };
  });

  const report = useCallback((next: ValidationStatus) => {
    setStatus(next);
    latest.current.onStatusChange?.(next);
  }, []);

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
    window.clearTimeout(hold.current);
    abort.current?.abort();
    runId.current += 1;
  }, []);

  useEffect(() => cancel, [cancel]);

  const flush = useCallback(
    async (raw: string) => {
      const value = raw.trim();
      if (!value) {
        cancel();
        checked.current = null;
        setStale(false);
        setMessage(null);
        report("idle");
        return;
      }
      if (checked.current?.value === value) {
        // Nothing new to ask (a failed check waits for Try again); drop the debounce and un-dim the answer we have.
        window.clearTimeout(timer.current);
        setStale(false);
        return;
      }
      cancel();
      const id = runId.current;
      const controller = new AbortController();
      abort.current = controller;
      checked.current = { value };
      report("checking");
      const started = performance.now();

      let result: React.ReactNode | null | undefined;
      let failed = false;
      try {
        result = await latest.current.validate(value, { signal: controller.signal });
      } catch {
        failed = true;
      }
      if (id !== runId.current) return;
      const rest = minPending - (performance.now() - started);
      if (rest > 0) await new Promise((r) => (hold.current = window.setTimeout(r, rest)));
      if (id !== runId.current) return;

      setStale(false);
      setSubject(value);
      if (failed) {
        setMessage(null);
        report("error");
      } else if (result != null && result !== false && result !== "") {
        setMessage(result);
        report("invalid");
      } else {
        setMessage(null);
        report("valid");
      }
    },
    [cancel, minPending, report],
  );

  const change = useCallback(
    (value: string, schedule = true) => {
      cancel();
      if (!value.trim()) {
        flush("");
        return;
      }
      // The previous answer is about a different value now: dim it, and ask again once typing pauses.
      setStale(true);
      setStatus((s) => (s === "checking" ? "idle" : s));
      if (schedule) timer.current = window.setTimeout(() => flush(value), debounce);
    },
    [cancel, debounce, flush],
  );

  const retry = useCallback((value: string) => {
    checked.current = null;
    flush(value);
  }, [flush]);

  return { status, message, subject, stale, change, flush, retry, cancel };
}

export type InlineValidationProps = Omit<FieldControlProps, "value" | "defaultValue" | "end" | "confirmFix"> &
  Options & {
    label: React.ReactNode;
    /** The resting hint. Validation messages take its place in the same slot. */
    description?: React.ReactNode;
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    /** Check as the user types (debounced), or only when they leave the field. */
    trigger?: "change" | "blur";
    /** Shown under the field while a check runs. */
    checkingMessage?: React.ReactNode;
    /** Shown when the value passes. Receives the value, e.g. `(v) => \`${v} is available\``. */
    validMessage?: React.ReactNode | ((value: string) => React.ReactNode);
    /** Shown when the check itself failed (network, timeout). A Try again button follows it. */
    errorMessage?: React.ReactNode;
    required?: boolean;
    optional?: boolean;
    fieldClassName?: string;
  };

export function InlineValidation({
  label,
  description,
  validate,
  debounce,
  minPending,
  onStatusChange,
  trigger = "change",
  checkingMessage = "Checking…",
  validMessage,
  errorMessage = "Couldn’t check right now.",
  value: valueProp,
  defaultValue = "",
  onValueChange,
  required,
  optional,
  name,
  disabled,
  size,
  fieldClassName,
  onBlur,
  onKeyDown,
  ...rest
}: InlineValidationProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const v = useInlineValidation({ validate, debounce, minPending, onStatusChange });
  const input = useRef<HTMLInputElement | null>(null);

  const answer = v.status;
  let slot: { key: string; tone: "hint" | "muted" | "success" | "danger" | "warning"; body: React.ReactNode } | null = null;
  if (answer === "checking") slot = { key: "checking", tone: "muted", body: checkingMessage };
  else if (answer === "invalid") slot = { key: "invalid", tone: "danger", body: v.message };
  else if (answer === "valid" && validMessage) slot = { key: "valid", tone: "success", body: typeof validMessage === "function" ? validMessage(v.subject) : validMessage };
  else if (answer === "error")
    slot = {
      key: "error",
      tone: "warning",
      body: (
        <>
          {errorMessage}{" "}
          <button
            type="button"
            onClick={() => {
              v.retry(value);
              input.current?.focus();
            }}
            className="relative font-medium text-fg underline decoration-fg-4 underline-offset-[3px] outline-none transition-[text-decoration-color] duration-150 hover:decoration-fg-2 focus-visible:rounded-[3px] focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid before:absolute before:-inset-x-1 before:-inset-y-2 before:content-['']"
          >
            Try again
          </button>
        </>
      ),
    };
  else if (description) slot = { key: "hint", tone: "hint", body: description };

  return (
    <Field
      name={name}
      required={required}
      disabled={disabled}
      size={size}
      invalid={v.status === "invalid" && !v.stale}
      data-status={v.status}
      className={fieldClassName}
    >
      <FieldLabel optional={optional}>{label}</FieldLabel>
      <FieldControl
        {...rest}
        ref={input}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          // On blur mode an edit only marks the old answer as out of date.
          v.change(next, trigger === "change");
        }}
        onBlur={(e) => {
          onBlur?.(e);
          v.flush(e.currentTarget.value);
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          // Enter checks now instead of waiting for the pause.
          if (e.key === "Enter") v.flush(e.currentTarget.value);
        }}
        aria-busy={v.status === "checking" || undefined}
        confirmFix={false}
        end={<StatusGlyph status={v.status} stale={v.stale} />}
      />
      <MessageSlot slot={slot} stale={v.stale} />
      <span role="status" aria-live="polite" className="sr-only">
        {v.stale || v.status === "checking" || v.status === "idle" ? "" : slot && slot.key !== "hint" ? slot.body : v.status === "valid" ? "Looks good" : ""}
      </span>
    </Field>
  );
}

const svg = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

/** The end-slot status: a spinner, then a tick that draws or a cross that strikes. Always 16px, so the value never shifts. */
export function StatusGlyph({ status, stale = false, className }: { status: ValidationStatus; stale?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const draw = (delay = 0.05) =>
    reduce ? {} : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 0.28, ease: ease.out, delay } };
  const glyph =
    status === "checking" ? (
      <svg {...svg} strokeWidth={1.4} className="animate-spin text-fg-3 [animation-duration:0.75s]">
        <circle cx="8" cy="8" r="5.75" opacity="0.22" />
        <path d="M8 2.25a5.75 5.75 0 0 1 5.75 5.75" />
      </svg>
    ) : status === "valid" ? (
      <svg {...svg} className="text-success">
        <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" {...draw()} />
      </svg>
    ) : status === "invalid" ? (
      <svg {...svg} className="text-danger">
        <motion.path d="m4.75 4.75 6.5 6.5" {...draw()} />
        <motion.path d="m11.25 4.75-6.5 6.5" {...draw(0.14)} />
      </svg>
    ) : status === "error" ? (
      <svg {...svg} strokeWidth={1.4} className="text-warning">
        <path d="M7.1 2.9a1 1 0 0 1 1.8 0l5 9.1a1 1 0 0 1-.9 1.5H3a1 1 0 0 1-.9-1.5z" />
        <path d="M8 6.25v3" />
        <circle cx="8" cy="11.1" r=".6" fill="currentColor" stroke="none" />
      </svg>
    ) : null;

  return (
    <span data-status={status} className={cn("relative grid size-4 place-items-center", className)}>
      <AnimatePresence initial={false}>
        {glyph && (
          <motion.span
            key={status}
            className="absolute inset-0 grid place-items-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
            animate={{ opacity: stale ? 0.35 : 1, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)", transition: { duration: 0.12 } }}
            transition={reduce ? { duration: 0.15 } : spring.pop}
          >
            {glyph}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

// Marked important so the tone always beats the description's resting color.
const tones = {
  hint: "text-fg-3!",
  muted: "text-fg-3!",
  success: "text-success!",
  danger: "text-danger!",
  warning: "text-fg-2!",
};

// One slot under the field. The hint, "Checking…", the verdict and the failure all
// take turns in the same grid cell, so a message change never moves the form below.
// With nothing to say, the slot closes, and takes the field's 6px gap with it.
function MessageSlot({ slot, stale }: { slot: { key: string; tone: keyof typeof tones; body: React.ReactNode } | null; stale: boolean }) {
  const reduce = useReducedMotion();
  // Clip only while the height moves, so a focus ring on Try again is never cut off at rest.
  const [moving, setMoving] = useState(false);
  return (
    <motion.div
      initial={false}
      animate={slot ? { height: "auto", marginTop: 0, opacity: 1 } : { height: 0, marginTop: -6, opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.24, ease: ease.out }}
      onAnimationStart={() => setMoving(true)}
      onAnimationComplete={() => setMoving(false)}
      className={cn((moving || !slot) && "overflow-hidden")}
    >
      <div className="grid">
        <AnimatePresence initial={false}>
          {slot && (
            <motion.div
              key={slot.key}
              className="col-start-1 row-start-1"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: stale && slot.key !== "hint" ? 0.5 : 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, transition: { duration: 0.12, ease: ease.in } }}
              transition={{ duration: reduce ? 0.15 : 0.22, ease: ease.out }}
            >
              <FieldDescription className={cn("text-[12px] transition-colors duration-150", tones[slot.tone])}>{slot.body}</FieldDescription>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
