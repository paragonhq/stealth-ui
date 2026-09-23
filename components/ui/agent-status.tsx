"use client";
import { Popover } from "@base-ui/react/popover";
import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

export type AgentRunStatus = "running" | "waiting" | "done" | "failed" | "stopped";
type Time = number | Date;
const toMs = (t: Time | undefined) => (t == null ? undefined : typeof t === "number" ? t : t.getTime());

// One clock for every live pill on the page, on the second boundary, asleep while the tab is hidden.
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
    get: () => (now ||= Date.now()),
  };
})();
const idle = () => () => {};

/** Milliseconds since startedAt (live, once a second) or until endedAt. Null on the server. */
export function useRunElapsed(startedAt?: Time, endedAt?: Time) {
  const start = toMs(startedAt);
  const end = toMs(endedAt);
  const live = start != null && end == null;
  const now = useSyncExternalStore(live ? clock.subscribe : idle, clock.get, () => null);
  if (start == null) return null;
  if (end != null) return Math.max(0, end - start);
  return now == null ? null : Math.max(0, now - start);
}

export type AgentStatusProps = Omit<React.ComponentProps<"button">, "title" | "children"> & {
  status: AgentRunStatus;
  /** What the agent is doing, as a short task name: “Refactor the auth module”. */
  title: React.ReactNode;
  /** 1-based index of the current step. */
  step?: number;
  totalSteps?: number;
  /** The step being worked on now, shown in the details. */
  currentStep?: React.ReactNode;
  startedAt?: Time;
  endedAt?: Time;
  /** Adds a Stop button to the details while it runs or waits. */
  onStop?: () => void;
  /** More controls for the details footer: View run, Open pull request. */
  actions?: React.ReactNode;
  /** Anything else the details should show, under the progress. */
  children?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Where the details portal to. Defaults to the body. */
  container?: Popover.Portal.Props["container"];
};

const word: Record<AgentRunStatus, string> = { running: "Running", waiting: "Needs your input", done: "Done", failed: "Failed", stopped: "Stopped" };

/**
 * A small live pill for an agent working in the background. It carries the
 * status, elapsed time and step on one line; pressing it opens the details.
 */
export function AgentStatus({
  status,
  title,
  step,
  totalSteps,
  currentStep,
  startedAt,
  endedAt,
  onStop,
  actions,
  children,
  open,
  defaultOpen,
  onOpenChange,
  container,
  className,
  ...rest
}: AgentStatusProps) {
  const reduce = useReducedMotion();
  const elapsed = useRunElapsed(startedAt, endedAt);
  const live = status === "running" || status === "waiting";
  const hasSteps = step != null && totalSteps != null && totalSteps > 0;

  // The pill's width follows its content, so a label change glides instead of jumping.
  const inner = useRef<HTMLSpanElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>();
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.ceil(entry.borderBoxSize?.[0]?.inlineSize ?? el.offsetWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const spokenState = `${word[status]}${elapsed != null && status !== "failed" && status !== "stopped" ? `, ${spokenDuration(elapsed)}` : ""}${hasSteps ? `, step ${step} of ${totalSteps}` : ""}`;

  return (
    <Popover.Root open={open} defaultOpen={defaultOpen} onOpenChange={(next) => onOpenChange?.(next)}>
      <Popover.Trigger
        data-status={status}
        aria-label={`${typeof title === "string" ? `${title}: ` : ""}${spokenState}`}
        className={cn(
          "group/pill relative inline-flex h-8 max-w-full select-none items-center overflow-hidden rounded-full border bg-raised text-[12.5px] shadow-[var(--shadow)]",
          "touch-manipulation outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[border-color,background-color,scale] duration-200 ease-out active:scale-[0.97] active:duration-75",
          "hover:bg-hover data-[popup-open]:bg-hover",
          status === "done" ? "border-success/30" : status === "failed" ? "border-danger/30" : status === "waiting" ? "border-warning/30" : "border-line-2",
          "pointer-coarse:before:absolute pointer-coarse:before:-inset-y-1.5 pointer-coarse:before:inset-x-0 pointer-coarse:before:content-['']",
          className,
        )}
        {...rest}
      >
        <motion.span
          className="flex min-w-0 items-center"
          initial={false}
          animate={{ width: width ?? "auto" }}
          transition={reduce ? { duration: 0 } : { duration: 0.34, ease: ease.inOut }}
        >
          <span ref={inner} className="flex w-max shrink-0 items-center gap-2 whitespace-nowrap pl-2.5 pr-3">
            <Glyph status={status} reduce={!!reduce} />
            <span className="grid">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={status}
                  className="col-start-1 row-start-1 font-medium text-fg"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } }}
                  transition={{ duration: reduce ? 0.15 : 0.24, ease: ease.out }}
                >
                  {status === "done" ? "Done in" : status === "failed" ? "Failed at" : status === "stopped" ? "Stopped at" : status === "waiting" ? "Needs input" : "Running"}
                </motion.span>
              </AnimatePresence>
            </span>
            {(status === "running" || status === "done") && elapsed != null && (
              <span className="tabular text-fg-2">
                <Duration value={elapsed} />
              </span>
            )}
            {hasSteps && (
              <>
                {(status === "running" || status === "waiting") && (
                  <span aria-hidden className="text-fg-4">
                    ·
                  </span>
                )}
                {status !== "done" && (
                  <span className="tabular text-fg-2">
                    step <NumberFlow value={step!} />/{totalSteps}
                  </span>
                )}
              </>
            )}
          </span>
        </motion.span>
      </Popover.Trigger>

      <Popover.Portal container={container}>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} collisionPadding={12} className="z-(--z-popover)">
          <Popover.Popup
            ref={popup}
            // Focus lands on the details, not on Stop, so a second Enter can't end the run by accident.
            initialFocus={popup}
            className={cn(
              "flex w-[320px] max-w-[var(--available-width)] flex-col rounded-xl border border-line-2 bg-raised text-[13px] text-fg shadow-pop outline-none",
              "origin-[var(--transform-origin)] transition-[opacity,scale,translate,filter] duration-200 ease-out-expo",
              "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-starting-style:blur-[2px]",
              "data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1",
              "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:ease-out-quart",
              "data-instant:transition-none",
              "motion-reduce:data-starting-style:translate-0 motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:blur-none motion-reduce:data-ending-style:scale-100",
            )}
          >
            <div className="flex flex-col gap-3 p-3.5">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5">
                  <Glyph status={status} reduce={!!reduce} />
                </span>
                <div className="min-w-0 flex-1">
                  <Popover.Title className="text-pretty text-[14px] font-medium leading-5 tracking-[-0.012em] text-fg">{title}</Popover.Title>
                  <Popover.Description className="mt-0.5 text-[12px] leading-[18px] text-fg-3">
                    <span className={cn(status === "failed" ? "text-danger" : status === "waiting" ? "text-warning" : status === "done" ? "text-success" : "text-fg-2")}>{word[status]}</span>
                    {elapsed != null && (
                      <>
                        {" · "}
                        <span className="tabular">{formatRunDuration(elapsed)}</span>
                      </>
                    )}
                    {startedAt != null && (
                      <>
                        {" · started "}
                        <Clock time={startedAt} />
                      </>
                    )}
                  </Popover.Description>
                </div>
              </div>

              {hasSteps && (
                <div className="flex flex-col gap-2">
                  <Segments step={step!} total={totalSteps!} status={status} />
                  <div className="flex items-baseline justify-between gap-3 text-[12px]">
                    <span className="min-w-0 truncate text-fg-2">
                      {currentStep != null ? (
                        live ? (
                          <Sheen active={status === "running"}>{currentStep}</Sheen>
                        ) : (
                          currentStep
                        )
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular text-fg-3">
                      {status === "done" ? totalSteps : step} of {totalSteps}
                    </span>
                  </div>
                </div>
              )}

              {children}
            </div>

            {((onStop && live) || actions) && (
              <div className="flex items-center justify-end gap-2 border-t border-line px-3 py-2.5">
                {onStop && live && (
                  <button
                    type="button"
                    onClick={onStop}
                    className={cn(
                      "mr-auto inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none",
                      "transition-[background-color,color,scale] duration-150 hover:bg-danger-soft hover:text-danger active:scale-[0.97]",
                      "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                    )}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden>
                      <rect x="3.5" y="3.5" width="9" height="9" rx="2" fill="currentColor" />
                    </svg>
                    Stop
                  </button>
                )}
                {actions}
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>

      <span className="sr-only" role="status" aria-live="polite">
        {live ? "" : `${typeof title === "string" ? `${title}: ` : ""}${word[status]}`}
      </span>
    </Popover.Root>
  );
}

/** 42s · 3m 07s · 1h 12m. */
export function formatRunDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, "0")}m`;
}

const spokenDuration = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m ? `${m} minute${m === 1 ? "" : "s"} ${s % 60} seconds` : `${s} seconds`;
};

// Seconds roll like an odometer; minutes join once they exist.
function Duration({ value }: { value: number }) {
  const s = Math.floor(value / 1000);
  if (s >= 3600) return <>{formatRunDuration(value)}</>;
  return (
    <NumberFlowGroup>
      <span className="inline-flex items-baseline gap-[0.3em]">
        {s >= 60 && <NumberFlow value={Math.floor(s / 60)} suffix="m" />}
        <NumberFlow value={s % 60} suffix="s" format={s >= 60 ? { minimumIntegerDigits: 2 } : undefined} />
      </span>
    </NumberFlowGroup>
  );
}

// Local wall-clock time, formatted only on the client so server HTML never disagrees with it.
function Clock({ time }: { time: Time }) {
  const text = useSyncExternalStore(
    idle,
    () => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(toMs(time)),
    () => "",
  );
  return <span className="tabular">{text}</span>;
}

/** One segment per step: done ones filled, the current one breathing, the rest empty. */
function Segments({ step, total, status }: { step: number; total: number; status: AgentRunStatus }) {
  const done = status === "done" ? total : step - 1;
  return (
    <div aria-hidden className="flex h-1.5 gap-[3px]">
      {Array.from({ length: total }, (_, i) => {
        const current = i === step - 1 && status !== "done";
        return (
          <span key={i} className="relative flex-1 overflow-hidden rounded-full bg-line-2">
            <span
              className={cn(
                "absolute inset-0 origin-left rounded-full transition-[scale,background-color] duration-500 ease-in-out-quart motion-reduce:transition-none",
                i < done ? "scale-x-100" : current ? "scale-x-100" : "scale-x-0",
                status === "done" ? "bg-success" : current ? (status === "failed" ? "bg-danger" : status === "waiting" ? "bg-warning" : status === "stopped" ? "bg-fg-4" : "animate-pulse-soft bg-fg-2") : "bg-fg-2",
              )}
              style={{ transitionDelay: status === "done" ? `${i * 30}ms` : undefined }}
            />
          </span>
        );
      })}
    </div>
  );
}

const glyphBase = { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

function Glyph({ status, reduce }: { status: AgentRunStatus; reduce: boolean }) {
  const draw = (delay = 0.1) => ({
    initial: { pathLength: reduce ? 1 : 0 },
    animate: { pathLength: 1 },
    transition: reduce ? { duration: 0 } : { duration: 0.34, ease: ease.out, delay },
  });
  return (
    <span className="relative grid size-3.5 shrink-0 place-items-center">
      <AnimatePresence initial={false}>
        <motion.span
          key={status}
          className="absolute inset-0 grid place-items-center"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.6, transition: { duration: 0.12, ease: ease.in } }}
          transition={reduce ? { duration: 0.15 } : spring.pop}
        >
          {status === "running" ? (
            <svg viewBox="0 0 16 16" fill="none" aria-hidden className="size-3.5 animate-spin [animation-duration:0.9s]">
              <circle cx="8" cy="8" r="6.25" stroke="var(--line-2)" strokeWidth="2" />
              <path d="M8 1.75A6.25 6.25 0 0 1 14.25 8" stroke="var(--fg)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : status === "waiting" ? (
            <span className="relative grid size-3.5 place-items-center">
              <span className="absolute size-2 animate-ping-soft rounded-full bg-warning" />
              <span className="relative size-2 rounded-full bg-warning" />
            </span>
          ) : status === "done" ? (
            <svg {...glyphBase} className="text-success">
              <motion.path d="M3 8.5 6.5 12 13 4.5" {...draw()} />
            </svg>
          ) : status === "failed" ? (
            <svg {...glyphBase} className="text-danger">
              <motion.path d="m4 4 8 8" {...draw()} />
              <motion.path d="m12 4-8 8" {...draw(0.18)} />
            </svg>
          ) : (
            <span className="size-2.5 rounded-[3px] bg-fg-3" />
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Sheen({ active, children }: { active: boolean; children: React.ReactNode }) {
  if (!active) return <>{children}</>;
  return (
    <span
      className={cn(
        "bg-[linear-gradient(90deg,var(--fg-2)_0%,var(--fg-2)_40%,var(--fg)_50%,var(--fg-2)_60%,var(--fg-2)_100%)]",
        "animate-shine bg-clip-text [background-size:250%_100%] [-webkit-text-fill-color:transparent] rtl:[animation-direction:reverse]",
        "motion-reduce:animate-none motion-reduce:bg-none motion-reduce:[-webkit-text-fill-color:currentColor]",
      )}
    >
      {children}
    </span>
  );
}
