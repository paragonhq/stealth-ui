"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ArrowUpRight } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

export type DeployState = "queued" | "building" | "ready" | "error" | "canceled";

const LABEL: Record<DeployState, string> = { queued: "Queued", building: "Building", ready: "Ready", error: "Error", canceled: "Canceled" };
const TEXT: Record<DeployState, string> = { queued: "text-fg-3", building: "text-warning", ready: "text-success", error: "text-danger", canceled: "text-fg-3" };

// One shared one-second clock for every live row on the page, paused while the tab is hidden.
const listeners = new Set<() => void>();
let timer = 0;
let current = 0;
const read = () => Math.floor(Date.now() / 1000) * 1000;
const tick = () => {
  current = read();
  listeners.forEach((l) => l());
};
function sync() {
  window.clearInterval(timer);
  timer = document.hidden || !listeners.size ? 0 : window.setInterval(tick, 1000);
  if (!document.hidden) tick();
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1) {
    sync();
    document.addEventListener("visibilitychange", sync);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size) {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
    }
  };
}
const noSub = () => () => {};
// The snapshot only moves when the clock ticks, so React always reads a stable value between ticks.
const snapshot = () => current || (current = read());

/** The current time in whole seconds, ticking while `live`. Null during server render and hydration. */
export function useNow(live = true) {
  return useSyncExternalStore(live ? subscribe : noSub, snapshot, () => null);
}

const toMs = (t?: number | string | Date) => (t === undefined ? undefined : t instanceof Date ? t.getTime() : typeof t === "string" ? Date.parse(t) : t);

/** 48s, 1m 12s, 1h 3m. */
export function formatDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 45) return "Just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export type DeployStatusDotProps = Omit<React.ComponentProps<"span">, "children"> & { status: DeployState };

/** The status mark on its own: a ring while queued, a pulse while building, a solid dot when settled. */
export function DeployStatusDot({ status, className, ...rest }: DeployStatusDotProps) {
  const reduce = useReducedMotion();
  const color = { queued: "border border-fg-4", building: "bg-warning", ready: "bg-success", error: "bg-danger", canceled: "bg-fg-4" }[status];
  return (
    <span aria-hidden data-status={status} className={cn("relative grid size-4 shrink-0 place-items-center", className)} {...rest}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={status}
          className="absolute inset-0 grid place-items-center"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4, transition: { duration: 0.12 } }}
          transition={reduce ? { duration: 0.15 } : spring.pop}
        >
          {status === "building" && <span className="absolute size-2 animate-ping-soft rounded-full bg-warning motion-reduce:hidden" />}
          {/* Settling into ready or error sends out one ring, so a change seen from the corner of the eye registers. */}
          {/* Hidden by CSS under reduced motion, so server and client render the same tree. */}
          {(status === "ready" || status === "error") && (
            <motion.span
              className={cn("absolute size-2 rounded-full motion-reduce:hidden", status === "ready" ? "bg-success" : "bg-danger")}
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{ duration: 0.7, ease: ease.out }}
            />
          )}
          <span className={cn("relative size-2 rounded-full", color)} />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export type DeployCommit = {
  message: string;
  sha: string;
  branch?: string;
  author?: string;
};

export type DeployStatusProps = Omit<React.ComponentProps<"div">, "children"> & {
  status: DeployState;
  commit: DeployCommit;
  /** "Production", "Preview"… shown as a tag beside the message. */
  environment?: string;
  /** When the deployment was created: drives "2m ago" and the queued timer. */
  createdAt?: number | string | Date;
  /** When the build started: the duration counts from here while building. */
  startedAt?: number | string | Date;
  /** When it finished: freezes the duration. */
  finishedAt?: number | string | Date;
  /** What went wrong, shown under the commit when status is "error". */
  error?: string;
  /** Link to the build logs. */
  logsHref?: string;
  /** Or handle the logs button yourself (open a drawer). */
  onViewLogs?: () => void;
};

export function DeployStatus({
  status,
  commit,
  environment,
  createdAt,
  startedAt,
  finishedAt,
  error,
  logsHref,
  onViewLogs,
  className,
  ref: userRef,
  ...rest
}: DeployStatusProps) {
  const reduce = useReducedMotion();
  const [ref, offscreen] = useOffscreen<HTMLDivElement>();
  const live = status === "queued" || status === "building";
  const now = useNow(true);
  const created = toMs(createdAt);
  const started = toMs(startedAt);
  const finished = toMs(finishedAt);

  // Queued counts from creation, building from the start, settled rows show the frozen total.
  const from = status === "queued" ? created : started ?? created;
  const to = live ? now : finished;
  const elapsed = from !== undefined && to != null ? Math.max(0, to - from) : null;
  const seconds = elapsed === null ? null : Math.round(elapsed / 1000);

  const settledLine =
    status === "ready" ? `Ready in ${elapsed !== null ? formatDuration(elapsed) : "—"}` : status === "error" ? "Build failed" : status === "canceled" ? "Canceled" : "";

  const logs = cn(
    "relative inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-md text-[12px] font-medium text-fg-2 outline-none",
    "px-2 @max-md:w-7 @max-md:px-0",
    "transition-[background-color,color,scale] duration-150 ease-out hover:bg-fg/[0.06] hover:text-fg active:scale-[0.96] active:duration-75",
    "focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 focus-visible:outline-solid",
    // 44px touch target around a 28px drawing.
    "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
  );
  const logsLabel = `View logs for ${commit.sha.slice(0, 7)}`;
  const logsInner = (
    <>
      <span className="@max-md:sr-only">Logs</span>
      <ArrowUpRight size={13} className="text-fg-3 transition-transform duration-150 ease-out group-hover/logs:-translate-y-px group-hover/logs:translate-x-px" />
    </>
  );
  const envTag = environment && (
    <span className="shrink-0 rounded-[5px] border border-line-2 px-1.5 font-sans text-[11px] leading-[18px] text-fg-3">{environment}</span>
  );

  return (
    <div
      ref={(node) => {
        ref(node);
        if (typeof userRef === "function") userRef(node);
        else if (userRef) userRef.current = node;
      }}
      data-slot="deploy-status"
      data-status={status}
      data-offscreen={offscreen || undefined}
      className={cn(
        "@container relative min-w-0 overflow-hidden px-4 py-3 text-fg",
        // Continuous marks (the pulse, the scanner) stop drawing when nobody can see them.
        "data-offscreen:[&_*]:[animation-play-state:paused]",
        className,
      )}
      {...rest}
    >
      <div className="flex min-w-0 items-start gap-3">
        <DeployStatusDot status={status} className="mt-0.5" />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {/* The message is the name of the row: it wraps to two lines on narrow rows instead of vanishing into an ellipsis. */}
            <span className="min-w-0 truncate text-[13px] font-medium tracking-[-0.005em] @max-md:line-clamp-2 @max-md:whitespace-normal">{commit.message}</span>
            <span className="contents @max-md:hidden">{envTag}</span>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-fg-3">
            <span className="hidden @max-md:contents">{envTag}</span>
            {commit.branch && (
              <span className="flex min-w-0 items-center gap-1">
                <BranchIcon />
                <span className="max-w-40 truncate font-mono text-[11.5px] text-fg-2 @max-md:max-w-28">{commit.branch}</span>
              </span>
            )}
            <span className="font-mono text-[11.5px] text-fg-3">{commit.sha.slice(0, 7)}</span>
            {commit.author && (
              <span className="flex min-w-0 items-center gap-1.5 @max-md:hidden">
                <span aria-hidden className="text-fg-4">·</span>
                <span className="truncate">{commit.author}</span>
              </span>
            )}
            {created !== undefined && (
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="text-fg-4">·</span>
                <time
                  dateTime={new Date(created).toISOString()}
                  title={now === null ? undefined : new Date(created).toLocaleString()}
                  className="tabular whitespace-nowrap"
                >
                  {now === null ? "\u00a0" : ago(now - created)}
                </time>
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {/* Every label shares one cell, so the column never changes width as the status moves on. */}
          <span className="grid text-right text-[12px] font-medium">
            {Object.values(LABEL).map((l) => (
              <span key={l} aria-hidden className="invisible col-start-1 row-start-1">
                {l}
              </span>
            ))}
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={status}
                className={cn("col-start-1 row-start-1", TEXT[status])}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" }}
                transition={{ duration: 0.22, ease: ease.out }}
              >
                {LABEL[status]}
              </motion.span>
            </AnimatePresence>
          </span>
          <Elapsed seconds={seconds} animated={!reduce && live} />
        </div>

        {(logsHref || onViewLogs) &&
          (logsHref ? (
            <a href={logsHref} className={cn(logs, "group/logs mt-1.5")} aria-label={logsLabel} title={logsLabel}>
              {logsInner}
            </a>
          ) : (
            <button type="button" onClick={onViewLogs} className={cn(logs, "group/logs mt-1.5")} aria-label={logsLabel} title={logsLabel}>
              {logsInner}
            </button>
          ))}
      </div>

      <AnimatePresence initial={false}>
        {status === "error" && error && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.16, ease: ease.out } }}
            transition={{ duration: 0.22, ease: ease.out }}
            className="overflow-hidden pl-7"
          >
            <p className="mt-2 rounded-md bg-danger-soft px-2 py-1 font-mono text-[11.5px] leading-4 text-danger [overflow-wrap:anywhere]">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* A thin scanner along the bottom edge while it builds. */}
      <AnimatePresence>
        {status === "building" && (
          <motion.span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-px overflow-hidden motion-reduce:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
          >
            <span className="absolute inset-y-0 left-0 w-1/2 animate-indeterminate bg-linear-to-r from-transparent via-warning/70 to-transparent" />
          </motion.span>
        )}
      </AnimatePresence>

      <span role="status" className="sr-only">
        {status === "building" ? "Building" : status === "queued" ? "Queued" : settledLine}
      </span>
    </div>
  );
}

/** 48s rolls second by second; past a minute the minutes and seconds roll on their own. */
function Elapsed({ seconds, animated }: { seconds: number | null; animated: boolean }) {
  return (
    <span className="tabular flex h-4 items-center font-mono text-[11.5px] text-fg-3">
      {seconds === null ? (
        "—"
      ) : seconds < 3600 ? (
        <>
          {seconds >= 60 && <NumberFlow value={Math.floor(seconds / 60)} suffix="m" animated={animated} willChange className="mr-[0.5ch]" />}
          <NumberFlow value={seconds % 60} suffix="s" animated={animated} willChange />
        </>
      ) : (
        formatDuration(seconds * 1000)
      )}
    </span>
  );
}

/** Whether the element is outside the viewport, for pausing continuous animation. */
function useOffscreen<T extends Element>() {
  const [el, setEl] = useState<T | null>(null);
  const [offscreen, setOffscreen] = useState(false);
  useEffect(() => {
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [el]);
  return [setEl, offscreen] as const;
}

function BranchIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <circle cx="4.5" cy="3.5" r="1.5" />
      <circle cx="4.5" cy="12.5" r="1.5" />
      <circle cx="11.5" cy="5" r="1.5" />
      <path d="M4.5 5v6M11.5 6.5c0 3-7 2-7 4.5" />
    </svg>
  );
}
