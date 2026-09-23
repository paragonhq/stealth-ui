"use client";
import { Collapsible } from "@base-ui/react/collapsible";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

export type ToolCallStatus = "running" | "done" | "error" | "canceled";
type Time = number | Date;
const toMs = (t: Time | undefined) => (t == null ? undefined : typeof t === "number" ? t : t.getTime());

// One clock for every running call on the page, ticking on the second boundary
// so all timers change together. It sleeps while the tab is hidden; elapsed time
// is derived from Date.now, so nothing drifts.
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

/** Milliseconds a call has run: fixed once it ends, live (once a second) while it runs, null before hydration. */
export function useToolCallElapsed({ startedAt, endedAt, duration }: { startedAt?: Time; endedAt?: Time; duration?: number }) {
  const start = toMs(startedAt);
  const end = toMs(endedAt);
  const live = duration == null && start != null && end == null;
  const now = useSyncExternalStore(live ? clock.subscribe : idle, clock.get, () => null);
  if (duration != null) return duration;
  if (start == null) return null;
  if (end != null) return Math.max(0, end - start);
  return now == null ? null : Math.max(0, now - start);
}

/** 84ms · 1.4s · 12s · 2m 03s. Precise when short, calm when long. */
export function formatToolDuration(ms: number) {
  if (ms < 1000) return `${Math.max(1, Math.round(ms))}ms`;
  if (ms < 10_000) return `${(Math.floor(ms / 100) / 10).toFixed(1)}s`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

const spoken: Record<ToolCallStatus, string> = { running: "running", done: "done", error: "failed", canceled: "canceled" };

// Inside a group, calls drop their own frame and sit as rows of the group's card.
const Nested = createContext(false);

export type ToolCallProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The tool, as a verb or its id: "Search", "read_file". */
  name: string;
  /** What it acted on: a path, a query, a URL. Monospaced and truncated from the end. */
  target?: React.ReactNode;
  status: ToolCallStatus;
  /** A small glyph for the kind of tool, drawn at 16px in currentColor. */
  icon?: React.ReactNode;
  /** The arguments. Objects and arrays are shown as formatted JSON; strings as they are. */
  input?: unknown;
  /** The result, shown the same way. */
  output?: unknown;
  /** What went wrong, when the status is error. Shown in the row, and in full when expanded. */
  error?: React.ReactNode;
  /** One short result at the end of the row once done: "3 hits", "200 OK". */
  summary?: React.ReactNode;
  /** When the call started. With no endedAt and no duration, the timer runs. */
  startedAt?: Time;
  endedAt?: Time;
  /** Milliseconds, when you already know it. Wins over startedAt/endedAt. */
  duration?: number;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function ToolCall({
  name,
  target,
  status,
  icon,
  input,
  output,
  error,
  summary,
  startedAt,
  endedAt,
  duration,
  open,
  defaultOpen,
  onOpenChange,
  className,
  ...rest
}: ToolCallProps) {
  const nested = useContext(Nested);
  const elapsed = useToolCallElapsed({ startedAt, endedAt, duration });
  const hasInput = input !== undefined;
  const hasOutput = output !== undefined;
  const failed = status === "error";
  const expandable = hasInput || hasOutput || (failed && error != null);

  const row = "group/trigger relative flex h-9 w-full min-w-0 select-none items-center gap-2 pl-2 pr-2.5 text-left";
  const header = (
    <>
      <span className={cn("grid size-4 shrink-0 place-items-center text-fg-4 transition-colors duration-150 group-hover/trigger:text-fg-3 group-data-[panel-open]/trigger:text-fg-2", !expandable && "invisible")}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="transition-[rotate] duration-[240ms] ease-in-out-quart motion-reduce:transition-none group-data-[panel-open]/trigger:rotate-90">
          <path d="m6.25 4.5 3.5 3.5-3.5 3.5" />
        </svg>
      </span>

      {icon != null && <span aria-hidden className="-ml-0.5 grid size-4 shrink-0 place-items-center text-fg-3 [&>svg]:size-4">{icon}</span>}

      <span className={cn("shrink-0 text-[13px] font-medium tracking-[-0.006em]", status === "canceled" ? "text-fg-3" : "text-fg")}>
        <Sheen active={status === "running"}>{name}</Sheen>
      </span>

      {target != null ? <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-2">{target}</span> : <span className="flex-1" />}

      <Meta status={status} error={error} summary={summary} elapsed={elapsed} />

      <span className="sr-only">, {spoken[status]}</span>
    </>
  );

  return (
    <Collapsible.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={(next) => onOpenChange?.(next)}
      data-status={status}
      className={cn(
        "group/tool @container/tool relative min-w-0",
        !nested && "rounded-lg border border-line bg-raised shadow-[var(--shadow)] transition-[border-color] duration-200 data-[status=error]:border-danger/30",
        className,
      )}
      {...rest}
    >
      {/* A call with nothing to show is a plain row, not a button that does nothing. */}
      {expandable ? (
        <Collapsible.Trigger
          className={cn(
            row,
            "touch-manipulation [-webkit-tap-highlight-color:transparent]",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
            "transition-[background-color] duration-150 hover:bg-hover active:bg-fg/[0.06] active:duration-75",
            nested ? "rounded-md" : "rounded-[7px] group-data-[open]/tool:rounded-b-none",
          )}
        >
          {header}
        </Collapsible.Trigger>
      ) : (
        <div className={row}>{header}</div>
      )}

      {expandable && (
        <Collapsible.Panel
          className={cn(
            "group/panel h-(--collapsible-panel-height) overflow-hidden",
            "transition-[height] duration-[260ms] ease-out-quart data-ending-style:duration-200 data-ending-style:ease-in-out-quart",
            "data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none",
          )}
        >
          <div
            className={cn(
              "flex flex-col gap-3 pb-3 pt-2.5",
              nested ? "pl-8 pr-2" : "border-t border-line px-3",
              "transition-[opacity,translate] delay-[50ms] duration-[280ms] ease-out-expo",
              "group-data-[starting-style]/panel:-translate-y-1 group-data-[starting-style]/panel:opacity-0",
              "group-data-[ending-style]/panel:opacity-0 group-data-[ending-style]/panel:delay-0 group-data-[ending-style]/panel:duration-[140ms]",
              "motion-reduce:translate-y-0 motion-reduce:delay-0",
            )}
          >
            {hasInput && <Payload label="Input" value={input} />}
            {hasOutput ? (
              <Payload label="Output" value={output} />
            ) : status === "running" ? (
              <section className="flex flex-col gap-1.5">
                <h4 className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">Output</h4>
                <p className="text-[12px] text-fg-3">
                  <Sheen active>Waiting for the result</Sheen>
                </p>
              </section>
            ) : null}
            {failed && error != null && (
              <section className="flex flex-col gap-1.5">
                <h4 className="font-mono text-2xs uppercase tracking-[0.08em] text-danger">Error</h4>
                <div className="rounded-md border border-danger/20 bg-danger-soft px-2.5 py-2 font-mono text-[12px] leading-[18px] text-danger [overflow-wrap:anywhere]">
                  {error}
                </div>
              </section>
            )}
          </div>
        </Collapsible.Panel>
      )}
    </Collapsible.Root>
  );
}

/** The right end of the row: summary or error, then the duration, then the status glyph. */
function Meta({ status, error, summary, elapsed }: { status: ToolCallStatus; error?: React.ReactNode; summary?: React.ReactNode; elapsed: number | null }) {
  const reduce = useReducedMotion();
  // A running timer only appears after a second, so fast calls never flash "0s".
  const showTime = elapsed != null && (status !== "running" || elapsed >= 1000);
  const note = status === "error" ? (error ?? "Failed") : status === "canceled" ? "Canceled" : status === "done" ? summary : null;
  return (
    <span className="ml-auto flex min-w-0 shrink items-center gap-2 pl-1">
      <AnimatePresence initial={false} mode="popLayout">
        {note != null && (
          <motion.span
            key={status}
            className={cn(
              "min-w-0 truncate text-[12px]",
              // In a narrow column the target keeps the room; the error is one tap away in the panel.
              status === "error" ? "max-w-[22ch] text-danger @max-[26rem]/tool:hidden" : "max-w-[16ch] text-fg-3",
            )}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 4, filter: "blur(2px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: reduce ? 0.15 : 0.24, ease: ease.out }}
          >
            {note}
          </motion.span>
        )}
      </AnimatePresence>
      {showTime && (
        <span className="shrink-0 text-[12px] tabular text-fg-3">
          {status === "running" ? <NumberFlow value={Math.floor(elapsed / 1000)} suffix="s" /> : formatToolDuration(elapsed)}
        </span>
      )}
      <span className="relative grid size-4 shrink-0 place-items-center">
        <AnimatePresence initial={false}>
          <motion.span
            key={status}
            className="absolute inset-0 grid place-items-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(3px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.5, filter: "blur(3px)", transition: { duration: 0.12, ease: ease.in } }}
            transition={reduce ? { duration: 0.15 } : spring.pop}
          >
            <StatusGlyph status={status} reduce={!!reduce} />
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}

const stroke = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

function StatusGlyph({ status, reduce }: { status: ToolCallStatus; reduce: boolean }) {
  // The same attributes either way so server and client markup agree; reduced motion just doesn't draw.
  const draw = (delay = 0.05) => ({
    initial: { pathLength: reduce ? 1 : 0 },
    animate: { pathLength: 1 },
    transition: reduce ? { duration: 0 } : { duration: 0.3, ease: ease.out, delay },
  });
  if (status === "running")
    return (
      <svg {...stroke} className="animate-spin text-fg-2 [animation-duration:0.8s]">
        <circle cx="8" cy="8" r="5.5" stroke="var(--line-2)" />
        <path d="M8 2.5a5.5 5.5 0 0 1 5.5 5.5" />
      </svg>
    );
  if (status === "done")
    return (
      <svg {...stroke} className="text-success">
        <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" {...draw()} />
      </svg>
    );
  if (status === "error")
    return (
      <svg {...stroke} className="text-danger">
        <motion.path d="m4.5 4.5 7 7" {...draw()} />
        <motion.path d="m11.5 4.5-7 7" {...draw(0.12)} />
      </svg>
    );
  return (
    <svg {...stroke} className="text-fg-4">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M5.75 8h4.5" />
    </svg>
  );
}

// A sheen crosses the words only while the call is actually working.
// Reduced motion keeps the plain label.
function Sheen({ active, children }: { active: boolean; children: React.ReactNode }) {
  if (!active) return <>{children}</>;
  return (
    <span
      className={cn(
        "bg-[linear-gradient(90deg,var(--fg-3)_0%,var(--fg-3)_40%,var(--fg)_50%,var(--fg-3)_60%,var(--fg-3)_100%)]",
        "animate-shine bg-clip-text [background-size:250%_100%] [-webkit-text-fill-color:transparent] rtl:[animation-direction:reverse]",
        "motion-reduce:animate-none motion-reduce:bg-none motion-reduce:[-webkit-text-fill-color:currentColor]",
      )}
    >
      {children}
    </span>
  );
}

export type PayloadProps = { label: string; value: unknown };

/** One labeled block of arguments or results, highlighted, scrollable and copyable. */
function Payload({ label, value }: PayloadProps) {
  const text = useMemo(() => stringify(value), [value]);
  const isJson = typeof value !== "string";
  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      <div className="flex h-5 items-center justify-between">
        <h4 className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">{label}</h4>
        <CopyButton value={text} iconOnly variant="ghost" size="sm" label={`Copy ${label.toLowerCase()}`} className="-mr-1.5 size-6" />
      </div>
      <div className="relative min-w-0 rounded-md border border-line bg-frame">
        <pre
          tabIndex={0}
          aria-label={label}
          className={cn(
            "max-h-56 overflow-auto overscroll-contain px-2.5 py-2 font-mono text-[12px] leading-[18px] text-fg-2 outline-none",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3 rounded-[5px]",
          )}
        >
          <code className="block w-max min-w-full">{isJson ? <Json text={text} /> : text}</code>
        </pre>
      </div>
    </section>
  );
}

function stringify(value: unknown) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2) ?? String(value);
  } catch {
    return String(value);
  }
}

// Keys, strings, numbers and literals, told apart by weight of ink rather than hue.
const token = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],])/g;

function Json({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(token)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const [whole, str, colon, literal, num, punct] = m;
    if (str && colon) parts.push(<span key={i++} className="text-fg">{str}</span>, <span key={i++} className="text-fg-4">{colon}</span>);
    else if (str) parts.push(<span key={i++} className="text-fg-2">{str}</span>);
    else if (literal) parts.push(<span key={i++} className="italic text-fg-3">{literal}</span>);
    else if (num) parts.push(<span key={i++} className="text-fg tabular">{num}</span>);
    else if (punct) parts.push(<span key={i++} className="text-fg-4">{punct}</span>);
    else parts.push(whole);
    last = m.index + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

export type ToolCallGroupProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** What the calls did together: "Read 6 files". */
  label: React.ReactNode;
  /** Overall status. Running while any call runs; error if one failed. */
  status: ToolCallStatus;
  /** Shown at the end of the header: a total duration, a count. */
  summary?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/** Consecutive calls of one kind, collapsed into a single row that opens into the list. */
export function ToolCallGroup({ label, status, summary, icon, children, open, defaultOpen, onOpenChange, className, ...rest }: ToolCallGroupProps) {
  return (
    <Collapsible.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={(next) => onOpenChange?.(next)}
      data-status={status}
      className={cn("group/tool relative min-w-0 rounded-lg border border-line bg-raised shadow-[var(--shadow)] data-[status=error]:border-danger/30", className)}
      {...rest}
    >
      <Collapsible.Trigger
        className={cn(
          "group/trigger relative flex h-9 w-full min-w-0 select-none items-center gap-2 rounded-[7px] pl-2 pr-2.5 text-left group-data-[open]/tool:rounded-b-none",
          "touch-manipulation [-webkit-tap-highlight-color:transparent]",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
          "transition-[background-color] duration-150 hover:bg-hover active:bg-fg/[0.06] active:duration-75",
        )}
      >
        <span className="grid size-4 shrink-0 place-items-center text-fg-4 transition-colors duration-150 group-hover/trigger:text-fg-3 group-data-[panel-open]/trigger:text-fg-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="transition-[rotate] duration-[240ms] ease-in-out-quart motion-reduce:transition-none group-data-[panel-open]/trigger:rotate-90">
            <path d="m6.25 4.5 3.5 3.5-3.5 3.5" />
          </svg>
        </span>
        {icon != null && <span aria-hidden className="-ml-0.5 grid size-4 shrink-0 place-items-center text-fg-3 [&>svg]:size-4">{icon}</span>}
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.006em] text-fg">
          <Sheen active={status === "running"}>{label}</Sheen>
        </span>
        <GroupMeta status={status} summary={summary} />
        <span className="sr-only">, {spoken[status]}</span>
      </Collapsible.Trigger>
      <Collapsible.Panel
        className={cn(
          "group/panel h-(--collapsible-panel-height) overflow-hidden",
          "transition-[height] duration-[260ms] ease-out-quart data-ending-style:duration-200 data-ending-style:ease-in-out-quart",
          "data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none",
        )}
      >
        <div
          className={cn(
            "flex flex-col gap-px border-t border-line p-1",
            "transition-[opacity,translate] delay-[50ms] duration-[280ms] ease-out-expo",
            "group-data-[starting-style]/panel:-translate-y-1 group-data-[starting-style]/panel:opacity-0",
            "group-data-[ending-style]/panel:opacity-0 group-data-[ending-style]/panel:delay-0 group-data-[ending-style]/panel:duration-[140ms]",
            "motion-reduce:translate-y-0 motion-reduce:delay-0",
          )}
        >
          <Nested.Provider value={true}>{children}</Nested.Provider>
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

function GroupMeta({ status, summary }: { status: ToolCallStatus; summary?: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <span className="ml-auto flex shrink-0 items-center gap-2 pl-1">
      {summary != null && <span className="text-[12px] tabular text-fg-3">{summary}</span>}
      <span className="relative grid size-4 place-items-center">
        <AnimatePresence initial={false}>
          <motion.span
            key={status}
            className="absolute inset-0 grid place-items-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(3px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={reduce ? { duration: 0.15 } : spring.pop}
          >
            <StatusGlyph status={status} reduce={!!reduce} />
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
