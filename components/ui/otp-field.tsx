"use client";
import { OTPField as Base } from "@base-ui/react/otp-field";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Fragment, useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Alert } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type OTPStatus = "idle" | "verifying" | "success" | "error";

export type OTPFieldProps = Omit<React.ComponentProps<"div">, "children" | "defaultValue" | "onChange"> & {
  /** Number of cells. */
  length?: number;
  /** Put a separator after every n cells, e.g. 3 for 123–456. 0 for none. */
  groupSize?: number;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Called once every cell is filled, by typing, paste or autofill. */
  onValueComplete?: (value: string) => void;
  /**
   * Drive the result from outside. `verifying` locks the cells and ripples them,
   * `success` tints them in sequence, `error` turns them danger and then clears
   * them after `errorClearDelay` so the next attempt starts fresh.
   */
  status?: OTPStatus;
  /** Milliseconds the wrong code stays on screen before the cells clear. */
  errorClearDelay?: number;
  label?: React.ReactNode;
  description?: React.ReactNode;
  /** Shown in place of the description while status is error. */
  error?: React.ReactNode;
  validationType?: "numeric" | "alpha" | "alphanumeric";
  /** Hide the characters as dots. */
  mask?: boolean;
  size?: "sm" | "md";
  name?: string;
  disabled?: boolean;
  /** Submit the owning form when complete. */
  autoSubmit?: boolean;
  autoFocus?: boolean;
};

export function OTPField({
  length = 6,
  groupSize = 3,
  value: valueProp,
  defaultValue = "",
  onValueChange,
  onValueComplete,
  status = "idle",
  errorClearDelay = 1100,
  label,
  description,
  error,
  validationType = "numeric",
  mask = false,
  size = "md",
  name,
  disabled,
  autoSubmit,
  autoFocus,
  className,
  id: idProp,
  ...rest
}: OTPFieldProps) {
  const reduce = useReducedMotion();
  const autoId = useId();
  const id = idProp ?? `otp-${autoId}`;
  const descId = `${id}-desc`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const [active, setActive] = useState<number | null>(null);

  // A change that adds several characters at once is a paste or an autofill:
  // those digits land left to right instead of all on the same frame.
  const [prev, setPrev] = useState(value);
  const [batchFrom, setBatchFrom] = useState(-1);
  if (prev !== value) {
    setPrev(value);
    setBatchFrom(value.length - prev.length > 1 ? commonPrefix(prev, value) : -1);
  }

  const locked = status === "verifying" || status === "success";
  const showError = status === "error" && value.length === length;

  // After a wrong code: hold it long enough to be seen, then clear and start over at the first cell.
  const clear = useEffectEvent(() => {
    setValue("");
    const first = rootRef.current?.querySelector<HTMLInputElement>("input:not([type=hidden])");
    if (first && rootRef.current?.contains(document.activeElement)) first.focus();
  });
  useEffect(() => {
    if (status !== "error") return;
    const t = window.setTimeout(clear, errorClearDelay);
    return () => window.clearTimeout(t);
  }, [status, errorClearDelay]);

  const tone = status === "success" ? "success" : showError ? "error" : "idle";
  const chars = Array.from({ length }, (_, i) => value[i] ?? "");
  const cell = size === "sm" ? "h-9 w-full rounded-md text-[16px]" : "h-11 w-full rounded-lg text-[18px]";
  // Cells keep their size until the row runs out of room, then shrink together.
  const slot = size === "sm" ? "w-8 min-w-6" : "w-10 min-w-7";
  const noun = validationType === "numeric" ? "Digit" : "Character";
  const message = status === "error" && error ? error : description;

  return (
    <div
      data-status={status}
      data-size={size}
      className={cn("group/otp flex w-fit max-w-full flex-col gap-2", className)}
      {...rest}
    >
      {label && (
        <label htmlFor={id} className="w-fit text-[12.5px] font-medium leading-4 text-fg">
          {label}
        </label>
      )}
      <Base.Root
        ref={rootRef}
        id={id}
        length={length}
        name={name}
        value={value}
        onValueChange={(v) => setValue(v)}
        onValueComplete={(v) => onValueComplete?.(v)}
        validationType={validationType}
        mask={mask}
        disabled={disabled}
        readOnly={locked}
        autoSubmit={autoSubmit}
        aria-describedby={message ? descId : undefined}
        className="flex max-w-full items-center gap-1.5 data-[disabled]:opacity-50"
      >
        {chars.map((char, i) => {
          const filled = char !== "";
          const isActive = active === i;
          return (
            <Fragment key={i}>
              {groupSize > 0 && i > 0 && i % groupSize === 0 && (
                <Base.Separator className="mx-1 h-px w-2.5 shrink-0 rounded-full bg-fg-4" />
              )}
              <motion.div
                className={cn("relative shrink", slot)}
                initial={false}
                // Success runs through the cells like a wave, once.
                animate={status === "success" && !reduce ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={{ duration: 0.34, ease: ease.out, delay: i * 0.05 }}
              >
                <Base.Input
                  autoFocus={autoFocus && i === 0}
                  aria-label={i === 0 ? undefined : `${noun} ${i + 1} of ${length}`}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive((a) => (a === i ? null : a))}
                  style={{ "--i": i } as React.CSSProperties}
                  className={cn(
                    "block border bg-raised text-center text-transparent caret-transparent outline-none selection:bg-transparent! selection:text-transparent!",
                    "transition-[border-color,background-color,box-shadow] duration-150 ease-out",
                    "focus:ring-3",
                    tone === "idle" && cn("hover:border-fg-4 focus:border-fg-3 focus:ring-fg/8", filled ? "border-fg-4/80" : "border-line-2"),
                    // Verdict colors step through the cells with the wave.
                    tone === "success" && "border-success/50 bg-success-soft focus:border-success/60 focus:ring-success/15 [transition-delay:calc(var(--i)*50ms)] motion-reduce:[transition-delay:0ms]",
                    tone === "error" && "border-danger/60 bg-danger-soft focus:border-danger/80 focus:ring-danger/15",
                    "read-only:cursor-default disabled:cursor-not-allowed",
                    cell,
                  )}
                />
                {/* What you see is drawn over the input, so each character can arrive with its own motion. */}
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-0 grid place-items-center font-medium tabular transition-colors duration-150",
                    tone === "idle" && "text-fg",
                    tone === "success" && "text-success [transition-delay:calc(var(--i)*50ms)] motion-reduce:[transition-delay:0ms]",
                    tone === "error" && "text-danger",
                    size === "sm" ? "text-[15px]" : "text-[18px]",
                  )}
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <AnimatePresence initial={false}>
                    {filled && (
                      <motion.span
                        key={`${i}-${char}`}
                        className="col-start-1 row-start-1"
                        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.8, filter: "blur(2px)" }}
                        animate={
                          status === "verifying" && !reduce
                            ? { opacity: [1, 0.4, 1], y: 0, scale: 1, filter: "blur(0px)" }
                            : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
                        }
                        exit={reduce ? { opacity: 0, transition: { duration: 0.08 } } : { opacity: 0, scale: 0.7, filter: "blur(2px)", transition: { duration: 0.1, ease: ease.in } }}
                        transition={
                          status === "verifying" && !reduce
                            ? { opacity: { duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.09 } }
                            : reduce
                              ? { duration: 0.12 }
                              : { ...spring.pop, delay: batchFrom >= 0 && i >= batchFrom ? (i - batchFrom) * 0.035 : 0 }
                        }
                      >
                        {mask ? <span className="block size-2 rounded-full bg-current" /> : char}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {isActive && !filled && !locked && (
                    <span className={cn("col-start-1 row-start-1 w-[1.5px] animate-caret rounded-full bg-fg motion-reduce:animate-none", size === "sm" ? "h-4" : "h-5")} />
                  )}
                </span>
              </motion.div>
            </Fragment>
          );
        })}
      </Base.Root>

      {message && (
        <p id={descId} className={cn("flex items-start gap-1.5 text-[12px] leading-4", status === "error" && error ? "text-danger" : "text-fg-3")}>
          {status === "error" && error && <Alert size={14} className="mt-px shrink-0" />}
          <span className="min-w-0">{message}</span>
        </p>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {status === "verifying" ? "Verifying code" : status === "success" ? "Code verified" : status === "error" ? (typeof error === "string" ? error : "That code didn’t work") : ""}
      </span>
    </div>
  );
}

function commonPrefix(a: string, b: string) {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return i;
}
