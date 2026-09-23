"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Children, createContext, isValidElement, use, useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * The step logic on its own
 * -----------------------------------------------------------------------------------------------*/

/** Where a wizard is and how to move it. `value === count` means every step is done. */
export function useStepper({ count, defaultValue = 0 }: { count: number; defaultValue?: number }) {
  const [value, setValue] = useState(defaultValue);
  const goTo = useCallback((i: number) => setValue(Math.min(Math.max(0, i), count)), [count]);
  return {
    value,
    setValue: goTo,
    next: () => goTo(value + 1),
    back: () => goTo(value - 1),
    reset: () => goTo(0),
    isFirst: value === 0,
    isLast: value === count - 1,
    isComplete: value >= count,
  };
}

/* -------------------------------------------------------------------------------------------------
 * Stepper
 * -----------------------------------------------------------------------------------------------*/

type Orientation = "horizontal" | "vertical";
export type StepStatus = "complete" | "current" | "upcoming" | "error" | "loading";

type Ctx = {
  value: number;
  count: number;
  orientation: Orientation;
  linear: boolean;
  instant: boolean;
  go: (index: number, e: React.MouseEvent) => void;
};
const StepperContext = createContext<Ctx | null>(null);
const IndexContext = createContext(0);

export type StepperProps = Omit<React.ComponentProps<"ol">, "onChange"> & {
  /** The current step, from 0. Equal to the number of steps when everything is done. */
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  orientation?: Orientation;
  /** Linear flows only let people go back to completed steps. Set false to allow jumping ahead. */
  linear?: boolean;
};

export function Stepper({ value: valueProp, defaultValue = 0, onValueChange, orientation = "horizontal", linear = true, className, children, ...rest }: StepperProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  // A step chosen with the keyboard renders on the same frame; a click animates.
  const [instant, setInstant] = useState(false);
  const steps = Children.toArray(children).filter(isValidElement<StepperStepProps>);
  const current = value >= steps.length ? "All steps complete" : steps[value]?.props.title;

  const ctx = useMemo<Ctx>(
    () => ({
      value,
      count: steps.length,
      orientation,
      linear,
      instant,
      go: (index, e) => {
        setInstant(e.detail === 0);
        setValue(index);
      },
    }),
    [value, steps.length, orientation, linear, instant, setValue],
  );

  return (
    <StepperContext value={ctx}>
      <ol
        aria-label={rest["aria-label"] ?? "Progress"}
        data-orientation={orientation}
        className={cn(
          orientation === "horizontal" ? "@container flex w-full flex-wrap items-start" : "flex flex-col",
          className,
        )}
        {...rest}
      >
        {steps.map((step, i) => (
          <IndexContext key={step.key ?? i} value={i}>
            {step}
          </IndexContext>
        ))}
        {orientation === "horizontal" && (
          // In a narrow container the labels step aside for one line about where you are.
          <li aria-hidden className="mt-3 hidden min-w-0 basis-full truncate text-[12.5px] @max-[30rem]:block">
            <span className="font-medium text-fg">{current}</span>
            <span className="text-fg-3"> · Step {Math.min(value + 1, steps.length)} of {steps.length}</span>
          </li>
        )}
      </ol>
    </StepperContext>
  );
}

/* -------------------------------------------------------------------------------------------------
 * A step
 * -----------------------------------------------------------------------------------------------*/

export type StepperStepProps = Omit<React.ComponentProps<"li">, "title"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Marks the step as failed and shows the message in place of the description. */
  error?: React.ReactNode;
  /** Shows a spinner on the step, for while it validates or saves. */
  loading?: boolean;
  /** Adds a quiet "Optional" label. */
  optional?: boolean;
  disabled?: boolean;
  /** Vertical only: content shown under the current step. */
  children?: React.ReactNode;
};

export function StepperStep({ title, description, error, loading = false, optional = false, disabled = false, className, children, ...rest }: StepperStepProps) {
  const ctx = use(StepperContext);
  const index = use(IndexContext);
  if (!ctx) throw new Error("StepperStep must be inside a Stepper");
  const { value, count, orientation, linear, instant, go } = ctx;

  const status: StepStatus = error ? "error" : index < value ? "complete" : index === value ? (loading ? "loading" : "current") : "upcoming";
  const last = index === count - 1;
  const done = index < value;
  const clickable = !disabled && index !== value && (index < value || !linear);
  const vertical = orientation === "vertical";

  const label = (
    <>
      <Indicator status={status} index={index} instant={instant} />
      <span className={cn("flex min-w-0 max-w-full flex-col text-left", vertical ? "pt-[3px]" : "@max-[30rem]:sr-only")}>
        <span className="flex items-baseline gap-1.5">
          <span
            className={cn(
              "truncate text-[13px] font-medium tracking-[-0.01em] transition-colors duration-200",
              status === "error" ? "text-danger" : status === "upcoming" ? "text-fg-3" : "text-fg",
              clickable && "group-hover/step:text-fg",
            )}
          >
            <span className="sr-only">
              Step {index + 1} of {count}:{" "}
            </span>
            {title}
          </span>
          {optional && <span className="shrink-0 text-[11px] text-fg-4">Optional</span>}
        </span>
        {(error || description) && (
          <span className={cn("text-[12px] leading-4", error ? "text-danger/90" : "text-fg-3", !vertical && "truncate")}>{error || description}</span>
        )}
        <span className="sr-only">{statusText[status]}</span>
      </span>
    </>
  );

  const labelClass = cn(
    "group/step relative flex min-w-0 items-start rounded-lg text-left outline-none",
    vertical ? "gap-2.5" : "max-w-full flex-col gap-2",
    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-fg-3",
    disabled && "opacity-50",
  );

  return (
    <li
      aria-current={index === value ? "step" : undefined}
      data-status={status}
      data-disabled={disabled || undefined}
      className={cn(
        // Horizontal steps share the row equally; the last one only takes what its label needs, so the rail ends at its circle.
        vertical ? "grid grid-cols-[24px_minmax(0,1fr)] gap-x-3" : cn("relative flex min-w-0 items-start", last ? "flex-none" : "flex-1 pr-4"),
        className,
      )}
      {...rest}
    >
      {vertical ? (
        <>
          <div className="col-start-1 row-start-1 flex flex-col items-center">
            {/* The label sits in the second column; its button spans both so the circle is part of the target. */}
            <Connector filled={done} hidden={last} vertical instant={instant} />
          </div>
          <div className="col-start-1 row-start-1 col-span-2 flex min-w-0 flex-col">
            {clickable ? (
              <button type="button" onClick={(e) => go(index, e)} className={cn(labelClass, "transition-transform duration-150 ease-out active:scale-[0.98]")}>
                {label}
              </button>
            ) : (
              <div className={labelClass}>{label}</div>
            )}
            <Panel open={index === value && !!children} instant={instant}>
              {children}
            </Panel>
            {!last && <div className="h-5" />}
          </div>
        </>
      ) : (
        <>
          {clickable ? (
            <button type="button" onClick={(e) => go(index, e)} className={cn(labelClass, "transition-transform duration-150 ease-out active:scale-[0.97]")}>
              {label}
            </button>
          ) : (
            <div className={labelClass}>{label}</div>
          )}
          {/* Runs from this circle to the next one, under the labels' row. */}
          {!last && <Connector filled={done} instant={instant} />}
        </>
      )}
    </li>
  );
}

const statusText: Record<StepStatus, string> = {
  complete: ", completed",
  current: ", current step",
  upcoming: "",
  error: ", needs attention",
  loading: ", saving",
};

/* -------------------------------------------------------------------------------------------------
 * Parts
 * -----------------------------------------------------------------------------------------------*/

// The number becomes a drawn tick when the step completes, an exclamation when it fails,
// and gains a turning arc while it saves. The circle's fill and ring change in CSS.
function Indicator({ status, index, instant }: { status: StepStatus; index: number; instant: boolean }) {
  const reduce = useReducedMotion();
  const glyph = status === "complete" ? "check" : status === "error" ? "error" : "number";
  const swap = reduce || instant ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : { initial: { opacity: 0, scale: 0.5, filter: "blur(2px)" }, animate: { opacity: 1, scale: 1, filter: "blur(0px)" }, exit: { opacity: 0, scale: 0.5, filter: "blur(2px)" } };

  return (
    <span
      aria-hidden
      data-status={status}
      className={cn(
        "relative grid size-6 shrink-0 place-items-center rounded-full border text-[11.5px] font-medium tabular",
        "transition-[background-color,border-color,color,box-shadow,scale] duration-200 ease-out motion-reduce:transition-none",
        "group-hover/step:border-fg-3 group-active/step:scale-[0.94]",
        status === "upcoming" && "border-line-2 bg-raised text-fg-3",
        (status === "current" || status === "loading") && "border-fg bg-raised text-fg ring-4 ring-fg/[0.07]",
        status === "complete" && "border-fg bg-fg text-frame group-hover/step:border-fg group-hover/step:bg-fg/85",
        status === "error" && "border-danger/60 bg-danger-soft text-danger ring-4 ring-danger/[0.08] group-hover/step:border-danger",
        instant && "duration-0",
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span key={glyph} className="absolute inset-0 grid place-items-center" {...swap} transition={instant ? { duration: 0 } : reduce ? { duration: 0.15 } : spring.pop}>
          {glyph === "check" ? (
            <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <motion.path
                d="M3.5 8.5 6.5 11.5 12.5 4.5"
                initial={reduce || instant ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3, ease: ease.out, delay: 0.06 }}
              />
            </svg>
          ) : glyph === "error" ? (
            <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M8 3.75v5" />
              <circle cx="8" cy="12" r=".6" fill="currentColor" />
            </svg>
          ) : (
            index + 1
          )}
        </motion.span>
      </AnimatePresence>
      {status === "loading" && (
        <svg className="absolute -inset-[3px] size-[calc(100%+6px)] animate-spin-slow text-fg motion-reduce:animate-none" viewBox="0 0 30 30" fill="none">
          <circle cx="15" cy="15" r="14" stroke="currentColor" strokeOpacity={0.12} strokeWidth={1.5} />
          <path d="M15 1a14 14 0 0 1 14 14" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

// A hairline track with a fill that runs toward the next step. Advancing fills after the tick
// has started drawing; going back empties at once, so the rail never lags the click.
function Connector({ filled, vertical = false, hidden = false, instant }: { filled: boolean; vertical?: boolean; hidden?: boolean; instant: boolean }) {
  const reduce = useReducedMotion();
  if (hidden) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "overflow-hidden rounded-full bg-line-2",
        vertical ? "relative mt-[30px] mb-1.5 w-px flex-1" : "pointer-events-none absolute top-[11.5px] right-2 left-8 h-px",
      )}
    >
      <motion.span
        className={cn("absolute inset-0 bg-fg", vertical ? "origin-top" : "origin-left")}
        initial={false}
        animate={vertical ? { scaleY: filled ? 1 : 0 } : { scaleX: filled ? 1 : 0 }}
        transition={instant || reduce ? { duration: instant ? 0 : 0.15 } : { duration: filled ? 0.36 : 0.2, ease: ease.inOut, delay: filled ? 0.08 : 0 }}
      />
    </span>
  );
}

// Vertical steps open their content under the title; the height eases so the steps below
// move instead of jumping, and the closed panel is inert so its fields leave the tab order.
function Panel({ open, instant, children }: { open: boolean; instant: boolean; children?: React.ReactNode }) {
  return (
    <div
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-260 ease-in-out-quart motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        instant && "duration-0",
      )}
    >
      <div className="min-h-0 overflow-hidden pl-[34px]">{children && <div className="pt-3">{children}</div>}</div>
    </div>
  );
}
