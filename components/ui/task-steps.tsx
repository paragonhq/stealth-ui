"use client";
import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

export type TaskStepStatus = "pending" | "active" | "done" | "failed" | "skipped";

type Time = number | Date;
const ms = (t: Time | undefined) => (t == null ? undefined : typeof t === "number" ? t : t.getTime());

// One shared clock for every running timer on the page. It ticks on the wall
// clock's second boundary so all timers change together, and sleeps while the
// tab is hidden (elapsed time is derived from Date.now, so nothing drifts).
const clock = (() => {
  let now = 0;
  let timer = 0;
  const subs = new Set<() => void>();
  const emit = () => {
    now = Date.now();
    subs.forEach((fn) => fn());
  };
  const schedule = () => {
    window.clearTimeout(timer);
    if (document.hidden) return;
    timer = window.setTimeout(() => {
      emit();
      schedule();
    }, 1000 - (Date.now() % 1000) + 4);
  };
  const onVisibility = () => {
    if (!document.hidden) emit();
    schedule();
  };
  return {
    subscribe(fn: () => void) {
      subs.add(fn);
      if (subs.size === 1) {
        now = Date.now();
        schedule();
        document.addEventListener("visibilitychange", onVisibility);
      }
      return () => {
        subs.delete(fn);
        if (subs.size) return;
        window.clearTimeout(timer);
        document.removeEventListener("visibilitychange", onVisibility);
        now = 0;
      };
    },
    // Before anyone subscribes there is no tick yet; take one reading and keep it.
    get: () => (now ||= Date.now()),
  };
})();
const idle = () => () => {};

/**
 * Milliseconds between `startedAt` and `endedAt`, or until now while it is
 * still running (re-rendering once a second). Null on the server and before
 * hydration, so nothing time-dependent is baked into the HTML.
 */
export function useElapsed(startedAt?: Time, endedAt?: Time) {
  const start = ms(startedAt);
  const end = ms(endedAt);
  const running = start != null && end == null;
  const now = useSyncExternalStore(running ? clock.subscribe : idle, clock.get, () => null);
  if (start == null) return null;
  if (end != null) return Math.max(0, end - start);
  return now == null ? null : Math.max(0, now - start);
}

/** 42s · 3m 07s · 1h 12m. Short, unambiguous, the same width for every second. */
export function formatDuration(value: number) {
  const s = Math.floor(value / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, "0")}m`;
}

export type TaskStepsProps = React.ComponentProps<"ol">;

/** An ordered list of the stages of one long job. Give it an aria-label that names the job. */
export function TaskSteps({ className, ...rest }: TaskStepsProps) {
  return <ol className={cn("flex min-w-0 flex-col", className)} {...rest} />;
}

export type TaskStepProps = Omit<React.ComponentProps<"li">, "children"> & {
  status: TaskStepStatus;
  /** The stage, as a noun or -ing verb: "Building", "Deploying to edge". */
  label: React.ReactNode;
  /** One line under the label. While active it can change as work progresses; each new line crossfades in. */
  description?: React.ReactNode;
  /** When the step started. With no endedAt, the timer runs. */
  startedAt?: Time;
  /** When the step finished or failed. Freezes the timer. */
  endedAt?: Time;
  /** What went wrong, shown when the status is failed. */
  error?: React.ReactNode;
  /** Controls under the error: Retry, View logs. Shown when the status is failed. */
  action?: React.ReactNode;
};

const spoken: Record<TaskStepStatus, string> = {
  pending: "Not started",
  active: "In progress",
  done: "Done",
  failed: "Failed",
  skipped: "Skipped",
};

export function TaskStep({ status, label, description, startedAt, endedAt, error, action, className, ref, ...rest }: TaskStepProps) {
  const reduce = useReducedMotion();
  const self = useRef<HTMLLIElement>(null);
  const block = useRef<HTMLDivElement>(null);

  // Pressing Retry removes the button that had focus. Catch it on the step
  // itself so focus never falls back to the top of the page.
  useEffect(() => {
    if (status !== "failed" && block.current?.contains(document.activeElement)) self.current?.focus();
  }, [status]);
  const elapsed = useElapsed(startedAt, endedAt);
  const failed = status === "failed";
  const showTime = elapsed != null && (status === "active" || status === "done" || failed);
  const descKey = typeof description === "string" ? description : status;

  return (
    <li
      ref={(node) => {
        self.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      tabIndex={-1}
      data-status={status}
      aria-current={status === "active" ? "step" : undefined}
      className={cn(
        "group/step relative grid grid-cols-[20px_minmax(0,1fr)] gap-x-3 rounded-md pb-4 outline-none last:pb-0",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-fg-3",
        className,
      )}
      {...rest}
    >
      {/* The segment to the next step. It fills from the top once this step is done. */}
      <span aria-hidden className="absolute bottom-1 left-[9.5px] top-6 w-px overflow-hidden rounded-full bg-line-2 group-last/step:hidden">
        <span
          className={cn(
            "absolute inset-0 origin-top bg-fg-3 transition-transform duration-500 ease-in-out-quart",
            status === "done" ? "scale-y-100" : "scale-y-0",
          )}
        />
      </span>

      <span className="relative z-[1] mt-px grid size-5 place-items-center">
        <AnimatePresence initial={false}>
          <motion.span
            key={status}
            className="absolute inset-0 grid place-items-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.8, transition: { duration: 0.12, ease: ease.in } }}
            transition={reduce ? { duration: 0.15 } : spring.pop}
          >
            <Node status={status} reduce={!!reduce} />
          </motion.span>
        </AnimatePresence>
      </span>

      <div className="min-w-0">
        <div className="flex min-h-[22px] items-baseline gap-3">
          {/* The state word is spoken when it changes; the ticking timer is deliberately outside it. */}
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {label}, {spoken[status].toLowerCase()}
            {(status === "done" || failed) && elapsed != null ? ` after ${formatDuration(elapsed)}` : ""}
          </span>
          <span
            aria-hidden
            className={cn(
              "min-w-0 flex-1 truncate text-[13px] font-medium leading-[22px] tracking-[-0.006em] transition-colors duration-200",
              status === "active" || failed ? "text-fg" : status === "done" ? "text-fg-2" : status === "skipped" ? "text-fg-4" : "text-fg-3",
            )}
          >
            {label}
          </span>
          <span
            aria-hidden
            className={cn(
              "shrink-0 font-mono text-[11.5px] tabular leading-[22px] transition-colors duration-200",
              status === "active" ? "text-fg-2" : failed ? "text-danger" : "text-fg-3",
            )}
          >
            {showTime ? <Duration value={elapsed} /> : status === "skipped" ? <span className="text-fg-4">Skipped</span> : null}
          </span>
        </div>

        {description != null && (
          <div className="grid">
            <AnimatePresence initial={false}>
              <motion.p
                key={descKey}
                className={cn(
                  "col-start-1 row-start-1 truncate text-[12px] leading-[18px] transition-colors duration-200",
                  status === "active" ? "text-fg-2" : "text-fg-3",
                )}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 5, filter: "blur(2px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -5, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } }}
                transition={{ duration: reduce ? 0.15 : 0.24, ease: ease.out }}
              >
                {description}
              </motion.p>
            </AnimatePresence>
          </div>
        )}

        {/* Grows open instead of shoving the steps below it down in one frame. */}
        <AnimatePresence initial={false}>
          {failed && (error != null || action != null) && (
            <motion.div
              key="error"
              ref={block}
              // Bleeds 4px sideways so focus rings on the actions aren't clipped by the height animation.
              className="-mx-1 overflow-hidden px-1"
              initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0, transition: { duration: 0.16, ease: ease.in } }}
              transition={{ duration: reduce ? 0.15 : 0.26, ease: ease.out }}
            >
              <div className="flex flex-col items-start gap-2.5 pb-1 pt-1.5">
                {error != null && <p className="text-pretty text-[12px] leading-[18px] text-danger">{error}</p>}
                {action != null && <div className="flex flex-wrap items-center gap-2">{action}</div>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </li>
  );
}

// Seconds roll like an odometer rather than flicker; minutes join once they exist.
function Duration({ value }: { value: number }) {
  const s = Math.floor(value / 1000);
  if (s >= 3600) return <>{formatDuration(value)}</>;
  return (
    <NumberFlowGroup>
      <span className="inline-flex items-baseline gap-[0.35em]">
        {s >= 60 && <NumberFlow value={Math.floor(s / 60)} suffix="m" />}
        <NumberFlow value={s % 60} suffix="s" format={s >= 60 ? { minimumIntegerDigits: 2 } : undefined} />
      </span>
    </NumberFlowGroup>
  );
}

const glyph = { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

function Node({ status, reduce }: { status: TaskStepStatus; reduce: boolean }) {
  const draw = (delay = 0.06) =>
    reduce ? {} : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 0.32, ease: ease.out, delay } };

  if (status === "done")
    return (
      <span className="grid size-5 place-items-center rounded-full bg-fg text-frame">
        <svg {...glyph} className="size-3">
          <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" {...draw()} />
        </svg>
      </span>
    );
  if (status === "failed")
    return (
      <span className="grid size-5 place-items-center rounded-full bg-danger text-frame">
        <svg {...glyph} className="size-3">
          <motion.path d="m5 5 6 6" {...draw()} />
          <motion.path d="m11 5-6 6" {...draw(0.14)} />
        </svg>
      </span>
    );
  if (status === "active")
    return (
      <span className="relative grid size-5 place-items-center rounded-full text-fg">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden className="absolute inset-0 size-5 animate-spin [animation-duration:0.9s]">
          <circle cx="10" cy="10" r="8.75" stroke="var(--line-2)" strokeWidth="1.5" />
          <path d="M10 1.25a8.75 8.75 0 0 1 8.75 8.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="size-[5px] rounded-full bg-fg" />
      </span>
    );
  if (status === "skipped")
    return (
      <span className="grid size-5 place-items-center rounded-full border border-dashed border-fg-4">
        <span className="h-px w-2 rounded-full bg-fg-4" />
      </span>
    );
  return <span className="size-5 rounded-full border-[1.5px] border-line-2" />;
}
