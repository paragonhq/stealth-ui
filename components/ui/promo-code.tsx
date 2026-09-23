"use client";
import { Collapsible } from "@base-ui/react/collapsible";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Alert, ChevronDown, Loader, Tag, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type AppliedPromo = {
  /** The code as the store knows it, e.g. "SPRING20". */
  code: string;
  /** What it takes off, already formatted: "−€18", "20% off", "Free shipping". */
  label: string;
};

export type PromoCodeProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  /** The applied code, or null. */
  value?: AppliedPromo | null;
  defaultValue?: AppliedPromo | null;
  onValueChange?: (value: AppliedPromo | null) => void;
  /**
   * Checks a code. Resolve with the applied promo; reject with an Error whose message says what's
   * wrong ("SPRING10 expired on 31 May"). The code arrives trimmed and uppercased.
   */
  onApply: (code: string) => Promise<AppliedPromo>;
  /** Called after the applied code is removed. */
  onRemove?: (value: AppliedPromo) => void;
  /** Start with the field open. */
  defaultOpen?: boolean;
  label?: string;
  placeholder?: string;
  applyLabel?: string;
  disabled?: boolean;
};

type Phase = "idle" | "busy" | "error";

export function PromoCode({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  onApply,
  onRemove,
  defaultOpen = false,
  label = "Add promo code",
  placeholder = "Enter code",
  applyLabel = "Apply",
  disabled = false,
  className,
  ...rest
}: PromoCodeProps) {
  const [applied, setApplied] = useControllableState<AppliedPromo | null>({ value: valueProp, defaultValue, onChange: onValueChange });
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [spinner, setSpinner] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [moving, setMoving] = useState(false);
  const id = useId();

  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const removeButton = useRef<HTMLButtonElement>(null);
  const entry = useRef<HTMLDivElement>(null);
  const refocus = useRef<"input" | "trigger" | "remove" | null>(null);
  const request = useRef(0);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Focus follows the control that replaced the one you were using.
  useEffect(() => {
    const target = refocus.current;
    refocus.current = null;
    if (target === "input") input.current?.focus();
    if (target === "trigger") trigger.current?.focus();
    if (target === "remove") removeButton.current?.focus();
  }, [open, applied]);

  const apply = async () => {
    const code = draft.trim().toUpperCase();
    if (!code || phase === "busy" || disabled) return;
    const mine = ++request.current;
    setPhase("busy");
    setError("");
    let shownAt = 0;
    timer.current = window.setTimeout(() => {
      shownAt = performance.now();
      setSpinner(true);
    }, 150);
    const settle = (fn: () => void) => {
      window.clearTimeout(timer.current);
      const hold = shownAt ? Math.max(0, 300 - (performance.now() - shownAt)) : 0;
      timer.current = window.setTimeout(() => {
        if (mine !== request.current) return;
        setSpinner(false);
        fn();
      }, hold);
    };
    try {
      const result = await onApply(code);
      settle(() => {
        if (entry.current?.contains(document.activeElement)) refocus.current = "remove";
        setPhase("idle");
        setDraft("");
        setOpen(false);
        setApplied(result);
        setAnnounce(`${result.code} applied, ${result.label}`);
      });
    } catch (e) {
      settle(() => {
        const message = e instanceof Error && e.message ? e.message : `${code} isn’t a valid code`;
        setPhase("error");
        setError(message);
        setAnnounce(message);
        // Back to the field with the code selected, so fixing it is one keystroke away.
        input.current?.focus();
        input.current?.select();
      });
    }
  };

  const remove = () => {
    if (!applied) return;
    const was = applied;
    refocus.current = "trigger";
    setApplied(null);
    setPhase("idle");
    setAnnounce(`${was.code} removed`);
    onRemove?.(was);
  };

  const swap = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, height: 0, filter: "blur(2px)" },
    animate: { opacity: 1, height: "auto", filter: "blur(0px)" },
    exit: reduce ? { opacity: 0 } : { opacity: 0, height: 0, filter: "blur(2px)" },
    transition: { duration: 0.24, ease: ease.inOut },
    // Clipped only while the height moves, so focus rings aren't cut off at rest.
    onAnimationStart: () => setMoving(true),
    onAnimationComplete: () => setMoving(false),
    className: cn(moving && "overflow-hidden"),
  };
  const invalid = phase === "error";
  const busy = phase === "busy";

  return (
    <div data-state={applied ? "applied" : open ? "open" : "closed"} className={cn("flex flex-col", className)} {...rest}>
      <AnimatePresence initial={false}>
        {applied ? (
          <motion.div key="applied" {...swap}>
            <div className="flex min-h-8 items-center justify-between gap-3 py-0.5">
              <motion.span
                // Same starting pose on server and client; reduced motion just skips the scale.
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={reduce ? { duration: 0.12, scale: { duration: 0 } } : { ...spring.pop, delay: 0.08 }}
                className="inline-flex h-7 min-w-0 items-center gap-1.5 rounded-md bg-success-soft pl-2 pr-0.5 text-success"
              >
                <Tag size={14} className="shrink-0" />
                <span className="truncate font-mono text-[12px] font-medium tracking-[0.04em]">{applied.code}</span>
                <button
                  ref={removeButton}
                  type="button"
                  onClick={remove}
                  disabled={disabled}
                  aria-label={`Remove code ${applied.code}`}
                  className={cn(
                    "relative grid size-6 shrink-0 place-items-center rounded-[5px] text-success/80 outline-none",
                    "transition-[background-color,color,scale] duration-150 hover:bg-success-soft hover:text-success active:scale-90 active:duration-75",
                    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-success",
                    "before:absolute before:-inset-2.5 before:content-[''] pointer-fine:before:hidden",
                  )}
                >
                  <X size={13} />
                </button>
              </motion.span>
              <motion.span
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={reduce ? { duration: 0.12, x: { duration: 0 } } : { duration: 0.26, ease: ease.out, delay: 0.12 }}
                className="tabular shrink-0 text-[13px] font-medium text-success"
              >
                {applied.label}
              </motion.span>
            </div>
          </motion.div>
        ) : (
          <motion.div key="entry" ref={entry} {...swap}>
            <Collapsible.Root
              open={open}
              disabled={disabled}
              onOpenChange={(next) => {
                if (next) refocus.current = "input";
                setOpen(next);
              }}
            >
              <Collapsible.Trigger
                ref={trigger}
                className={cn(
                  "group/trigger relative -mx-1 flex h-8 items-center gap-1.5 rounded-md px-1 text-[12.5px] text-fg-2 outline-none",
                  "transition-colors duration-150 hover:text-fg data-panel-open:text-fg data-disabled:pointer-events-none data-disabled:opacity-50",
                  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
                )}
              >
                <Tag size={14} className="text-fg-3 transition-colors duration-150 group-hover/trigger:text-fg-2" />
                {label}
                <ChevronDown
                  size={14}
                  className="text-fg-3 transition-transform duration-200 ease-out-expo group-data-panel-open/trigger:rotate-180 motion-reduce:transition-none"
                />
              </Collapsible.Trigger>
              <Collapsible.Panel
                className={cn(
                  "-mx-1 h-(--collapsible-panel-height) overflow-hidden px-1 transition-[height,opacity] duration-240 ease-in-out-quart",
                  "data-starting-style:h-0 data-starting-style:opacity-0 data-ending-style:h-0 data-ending-style:opacity-0 data-ending-style:duration-180",
                  "motion-reduce:transition-[opacity]",
                )}
              >
                <div className="flex flex-col gap-1.5 pb-1 pt-1.5">
                  <div className="flex gap-2">
                    <input
                      ref={input}
                      id={`${id}-input`}
                      value={draft}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        if (invalid) setPhase("idle");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          apply();
                        }
                        if (e.key === "Escape" && !draft) {
                          e.preventDefault();
                          refocus.current = "trigger";
                          setOpen(false);
                        }
                      }}
                      disabled={disabled}
                      readOnly={busy}
                      placeholder={placeholder}
                      aria-label="Promo code"
                      aria-invalid={invalid || undefined}
                      aria-describedby={invalid ? `${id}-error` : undefined}
                      autoComplete="off"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="done"
                      className={cn(
                        "h-8 min-w-0 flex-1 rounded-lg border bg-raised px-2.5 font-mono text-base uppercase tracking-[0.04em] text-fg outline-none sm:text-[12.5px]",
                        "shadow-[var(--shadow)] placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-fg-4",
                        "transition-[border-color,box-shadow] duration-150",
                        invalid
                          ? "border-danger/70 focus:ring-3 focus:ring-danger/15"
                          : "border-line-2 hover:border-fg-4 focus:border-fg-4 focus:ring-3 focus:ring-fg/10",
                      )}
                    />
                    <button
                      type="button"
                      onClick={apply}
                      disabled={disabled || !draft.trim()}
                      aria-busy={busy || undefined}
                      className={cn(
                        "relative inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-line-2 bg-raised px-3 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] outline-none",
                        "transition-[background-color,border-color,opacity,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75",
                        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                        "disabled:opacity-50 disabled:hover:border-line-2 disabled:hover:bg-raised aria-busy:cursor-progress aria-busy:active:scale-100",
                      )}
                    >
                      <span className={cn("transition-opacity duration-150", spinner && "opacity-0")}>{applyLabel}</span>
                      {spinner && (
                        <span className="absolute inset-0 grid place-items-center">
                          <Loader size={15} className="animate-spin motion-reduce:animate-none" />
                          <span className="sr-only">Checking code</span>
                        </span>
                      )}
                    </button>
                  </div>
                  {/* The error opens in place under the field and closes as soon as they type. */}
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows,opacity] duration-200 ease-in-out-quart",
                      invalid ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <p id={`${id}-error`} className="flex min-h-0 items-start gap-1.5 overflow-hidden text-[12px] leading-[1.45] text-danger">
                      <Alert size={13} className="mt-[2px] shrink-0" />
                      <span>{error}</span>
                    </p>
                  </div>
                </div>
              </Collapsible.Panel>
            </Collapsible.Root>
          </motion.div>
        )}
      </AnimatePresence>
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}
