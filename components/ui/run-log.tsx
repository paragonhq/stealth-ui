"use client";
import { Collapsible } from "@base-ui/react/collapsible";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogStepStatus = "pending" | "running" | "done" | "failed" | "skipped";
type Time = number | Date;
const toMs = (t: Time) => (typeof t === "number" ? t : t.getTime());

export type LogLine = {
  /** Stable, so appended lines are the only ones React touches. */
  id: string;
  time: Time;
  level?: LogLevel;
  text: string;
};

export type LogStep = {
  id: string;
  label: React.ReactNode;
  status: LogStepStatus;
  lines: LogLine[];
  /** Milliseconds, shown once the step has finished. */
  duration?: number;
};

export type RunLogProps = Omit<React.ComponentProps<"div">, "title" | "children"> & {
  steps: LogStep[];
  /** Names the log for screen readers and heads it when shown. */
  title: React.ReactNode;
  /** True while output is still arriving: shows Live, a caret on the newest line, and keeps following. */
  streaming?: boolean;
  /** Where +00:00.000 is. Defaults to the earliest line. */
  origin?: Time;
  /** Height of the scrolling area in pixels. */
  height?: number;
  /** Hide the title bar (title, live marker, count, copy). */
  hideHeader?: boolean;
};

const levelTag: Record<LogLevel, string> = { debug: "dbg", info: "inf", warn: "wrn", error: "err" };

/** +MM:SS.mmm from the start of the run. Deterministic, so server and client agree. */
export function formatLogTime(ms: number) {
  const t = Math.max(0, Math.round(ms));
  const m = Math.floor(t / 60000);
  const s = Math.floor(t / 1000) % 60;
  return `+${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(t % 1000).padStart(3, "0")}`;
}

/** Plain text for copying: one line per entry, steps as headings. */
export function runLogText(steps: LogStep[], origin?: Time) {
  const o = origin != null ? toMs(origin) : firstTime(steps);
  return steps
    .map((s) => [`## ${typeof s.label === "string" ? s.label : s.id} (${s.status})`, ...s.lines.map((l) => `${formatLogTime(toMs(l.time) - o)} ${levelTag[l.level ?? "info"].toUpperCase()} ${l.text}`)].join("\n"))
    .join("\n\n");
}

const firstTime = (steps: LogStep[]) => {
  let min = Infinity;
  for (const s of steps) for (const l of s.lines) min = Math.min(min, toMs(l.time));
  return Number.isFinite(min) ? min : 0;
};

/**
 * A streaming run log, grouped by step. It follows new output while you're at
 * the bottom; scroll up and it stops, counting what arrives until you jump back.
 */
export function RunLog({ steps, title, streaming = false, origin, height = 320, hideHeader = false, className, ...rest }: RunLogProps) {
  const reduce = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const total = steps.reduce((n, s) => n + s.lines.length, 0);
  const o = origin != null ? toMs(origin) : firstTime(steps);

  // Following: on while the reader is at the bottom. Scrolling up turns it off
  // and remembers how much had arrived, so the pill can say how much is new.
  const [following, setFollowing] = useState(true);
  const [seen, setSeen] = useState(0);
  const unseen = following ? 0 : Math.max(0, total - seen);

  // A smooth jump passes through "not at the bottom"; don't mistake it for the reader leaving.
  const jumping = useRef(false);
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (jumping.current) {
      if (atBottom) jumping.current = false;
      return;
    }
    if (atBottom !== following) {
      setFollowing(atBottom);
      if (!atBottom) setSeen(total);
    }
  };

  // Before paint, so a following log never shows a frame with the new line below the fold.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && following) el.scrollTop = el.scrollHeight;
  }, [total, following, steps]);

  const jump = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    jumping.current = !reduce;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
    setFollowing(true);
    el.focus({ preventScroll: true });
  }, [reduce]);

  // Announce steps as they change state, never individual lines.
  const latest = [...steps].reverse().find((s) => s.status !== "pending");
  const announcement = latest && typeof latest.label === "string" ? `${latest.label}: ${latest.status === "running" ? "running" : latest.status}` : "";

  return (
    <div className={cn("@container/log relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]", className)} {...rest}>
      {!hideHeader && (
        <div className="flex h-10 shrink-0 items-center gap-2.5 border-b border-line pl-3 pr-1.5">
          <span className="min-w-0 truncate text-[13px] font-medium tracking-[-0.006em] text-fg">{title}</span>
          <AnimatePresence initial={false}>
            {streaming && (
              <motion.span
                key="live"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success-soft px-1.5 py-px text-[11px] font-medium text-success"
                initial={{ opacity: 0, scale: reduce ? 1 : 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={reduce ? { duration: 0.15 } : spring.pop}
              >
                <span className="relative grid size-1.5 place-items-center">
                  <span className="absolute size-1.5 animate-ping-soft rounded-full bg-success" />
                  <span className="relative size-1.5 rounded-full bg-success" />
                </span>
                Live
              </motion.span>
            )}
          </AnimatePresence>
          <span className="ml-auto shrink-0 text-[12px] tabular text-fg-3">
            <NumberFlow value={total} locales="en-US" /> {total === 1 ? "line" : "lines"}
          </span>
          <CopyButton value={() => runLogText(steps, origin)} iconOnly variant="ghost" size="sm" label="Copy log" copiedLabel="Log copied" />
        </div>
      )}

      <div
        ref={scroller}
        role="log"
        aria-live="off"
        aria-label={typeof title === "string" ? title : "Run log"}
        tabIndex={0}
        onScroll={onScroll}
        style={{ height }}
        className={cn(
          "relative overflow-y-auto overflow-x-hidden overscroll-contain font-mono text-[12px] leading-5 outline-none",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
        )}
      >
        {steps.length === 0 ? (
          <p className="px-3 py-3 font-sans text-[12.5px] text-fg-3">{streaming ? "Waiting for output…" : "No output"}</p>
        ) : (
          steps.map((step, i) => <Step key={step.id} step={step} origin={o} streaming={streaming} last={i === steps.length - 1} />)
        )}
      </div>

      {/* Anchored to the bottom edge; only there while the reader has scrolled away from new output. */}
      <AnimatePresence>
        {!following && (
          <motion.button
            key="jump"
            type="button"
            onClick={jump}
            className={cn(
              "absolute bottom-3 left-1/2 z-[2] inline-flex h-7 items-center gap-1.5 rounded-full border border-line-2 bg-raised pl-2 pr-2.5 text-[12px] font-medium text-fg shadow-pop",
              "outline-none transition-[background-color] duration-150 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]",
              "pointer-coarse:before:absolute pointer-coarse:before:-inset-2 pointer-coarse:before:content-['']",
            )}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: 6, scale: 0.97, transition: { duration: 0.14, ease: ease.in } }}
            transition={reduce ? { duration: 0.15 } : spring.snappy}
            style={{ x: "-50%" }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-fg-2">
              <path d="M8 3v10M4 9l4 4 4-4" />
            </svg>
            {unseen > 0 ? (
              <span className="tabular">
                <NumberFlow value={unseen} locales="en-US" /> new {unseen === 1 ? "line" : "lines"}
              </span>
            ) : (
              "Jump to latest"
            )}
          </motion.button>
        )}
      </AnimatePresence>

      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

function Step({ step, origin, streaming, last }: { step: LogStep; origin: number; streaming: boolean; last: boolean }) {
  const { status, lines } = step;
  // Steps follow the run (open while running or failed, folded when done) until
  // the reader toggles one; from then on their choice stands.
  const [override, setOverride] = useState<boolean>();
  const auto = status === "running" || status === "failed" || (last && status === "done" && !streaming);
  const open = lines.length > 0 && (override ?? auto);
  const warnings = lines.filter((l) => l.level === "warn").length;
  const errors = lines.filter((l) => l.level === "error").length;

  return (
    <Collapsible.Root open={open} onOpenChange={(next) => setOverride(next)} disabled={lines.length === 0} data-status={status}>
      <Collapsible.Trigger
        className={cn(
          "group/step sticky top-0 z-[1] flex h-8 w-full items-center gap-2 border-b border-line bg-raised pl-2 pr-3 text-left font-sans",
          "outline-none transition-[background-color] duration-150 hover:bg-hover active:bg-fg/[0.06] focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
          "data-[disabled]:cursor-default data-[disabled]:hover:bg-raised",
        )}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cn("shrink-0 text-fg-4 transition-[rotate,color] duration-200 ease-in-out-quart group-data-[panel-open]/step:rotate-90 group-hover/step:text-fg-3 motion-reduce:transition-none", lines.length === 0 && "invisible")}>
          <path d="m6.25 4.5 3.5 3.5-3.5 3.5" />
        </svg>
        <StepGlyph status={status} />
        <span className={cn("min-w-0 flex-1 truncate text-[12.5px] font-medium", status === "pending" || status === "skipped" ? "text-fg-3" : "text-fg")}>{step.label}</span>
        {errors > 0 && <span className="shrink-0 rounded px-1 text-[11px] tabular text-danger bg-danger-soft">{errors} {errors === 1 ? "error" : "errors"}</span>}
        {warnings > 0 && <span className="shrink-0 rounded px-1 text-[11px] tabular text-warning bg-warning-soft @max-[24rem]/log:hidden">{warnings} {warnings === 1 ? "warning" : "warnings"}</span>}
        <span className="shrink-0 font-mono text-[11px] tabular text-fg-3">{step.duration != null && status !== "running" ? formatDuration(step.duration) : status === "pending" ? "Queued" : status === "skipped" ? "Skipped" : null}</span>
        <span className="sr-only">, {status}</span>
      </Collapsible.Trigger>
      <Collapsible.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out-quart data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none">
        <ol className="py-1">
          {lines.map((line, i) => (
            <Line key={line.id} line={line} origin={origin} caret={streaming && status === "running" && i === lines.length - 1} />
          ))}
        </ol>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

// New lines fade in from their starting style: cheap, CSS only, and nothing moves.
function Line({ line, origin, caret }: { line: LogLine; origin: number; caret: boolean }) {
  const level = line.level ?? "info";
  return (
    <li
      data-level={level}
      className={cn(
        "grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-3 px-3 [contain-intrinsic-size:auto_20px] [content-visibility:auto]",
        "transition-opacity duration-150 ease-out starting:opacity-0",
        level === "error" && "bg-danger-soft",
        level === "warn" && "bg-warning-soft/60",
      )}
    >
      <span className="select-none tabular text-fg-3 @max-[24rem]/log:hidden">{formatLogTime(toMs(line.time) - origin)}</span>
      <span className={cn("select-none uppercase", level === "error" ? "text-danger" : level === "warn" ? "text-warning" : "text-fg-4")}>{levelTag[level]}</span>
      <span className={cn("whitespace-pre-wrap [overflow-wrap:anywhere]", level === "error" ? "text-danger" : level === "debug" ? "text-fg-3" : "text-fg-2")}>
        {line.text}
        {caret && <span aria-hidden className="ml-0.5 inline-block h-3.5 w-[7px] translate-y-[2px] animate-caret bg-fg-3" />}
      </span>
    </li>
  );
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${String(Math.floor(s % 60)).padStart(2, "0")}s`;
}

function StepGlyph({ status }: { status: LogStepStatus }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative grid size-3.5 shrink-0 place-items-center">
      <AnimatePresence initial={false}>
        <motion.span
          key={status}
          className="absolute inset-0 grid place-items-center"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={reduce ? { duration: 0.15 } : spring.pop}
        >
          {status === "running" ? (
            <svg viewBox="0 0 16 16" fill="none" aria-hidden className="size-3.5 animate-spin [animation-duration:0.9s]">
              <circle cx="8" cy="8" r="6" stroke="var(--line-2)" strokeWidth="2" />
              <path d="M8 2a6 6 0 0 1 6 6" stroke="var(--fg)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : status === "done" ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-success">
              <motion.path d="M3 8.5 6.5 12 13 4.5" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={reduce ? { duration: 0 } : { duration: 0.3, ease: ease.out, delay: 0.06 }} />
            </svg>
          ) : status === "failed" ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden className="text-danger">
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
          ) : status === "skipped" ? (
            <span className="size-2.5 rounded-full border border-dashed border-fg-4" />
          ) : (
            <span className="size-2.5 rounded-full border-[1.5px] border-line-2" />
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
