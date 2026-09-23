"use client";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Tooltip } from "@base-ui/react/tooltip";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ArrowDown, Search, X } from "@/lib/icons";
import { spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogLine = {
  /** Stable and unique: new lines are told apart from old ones by id. */
  id: string | number;
  /** Epoch milliseconds, a Date, or an ISO string. */
  time: number | Date | string;
  level: LogLevel;
  message: string;
  /** Where it came from: a service, a worker, a region. */
  source?: string;
};

const LEVELS: LogLevel[] = ["error", "warn", "info", "debug"];
const LEVEL_LABEL: Record<LogLevel, string> = { error: "Error", warn: "Warn", info: "Info", debug: "Debug" };
const LEVEL_TAG: Record<LogLevel, string> = { error: "ERR", warn: "WRN", info: "INF", debug: "DBG" };
const LEVEL_TEXT: Record<LogLevel, string> = { error: "text-danger", warn: "text-warning", info: "text-fg-3", debug: "text-fg-4" };
const LEVEL_DOT: Record<LogLevel, string> = { error: "bg-danger", warn: "bg-warning", info: "bg-fg-3", debug: "bg-fg-4" };

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
/** 14:03:12.408 in the reader's own time zone. */
export function formatLogTime(t: LogLine["time"]) {
  const d = t instanceof Date ? t : new Date(t);
  if (Number.isNaN(d.getTime())) return "--:--:--.---";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function Marked({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const out: React.ReactNode[] = [];
  let at = 0;
  for (let i = lower.indexOf(q); i !== -1; i = lower.indexOf(q, at)) {
    if (i > at) out.push(text.slice(at, i));
    out.push(
      <mark key={i} className="rounded-[2px] bg-fg/15 text-fg">
        {text.slice(i, i + q.length)}
      </mark>,
    );
    at = i + q.length;
  }
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}

export type LogViewerProps = Omit<React.ComponentProps<"div">, "children"> & {
  lines: LogLine[];
  /** New lines are still arriving: shows the live dot and the waiting state. */
  streaming?: boolean;
  /** Stick to the newest line (controlled). Scrolling up turns it off; scrolling back to the end turns it on. */
  follow?: boolean;
  defaultFollow?: boolean;
  onFollowChange?: (follow: boolean) => void;
  /** Soft-wrap long lines instead of scrolling sideways. */
  wrap?: boolean;
  defaultWrap?: boolean;
  onWrapChange?: (wrap: boolean) => void;
  /** Levels shown (controlled). */
  levels?: LogLevel[];
  defaultLevels?: LogLevel[];
  onLevelsChange?: (levels: LogLevel[]) => void;
  /** Filter text (controlled). Lines that don't contain it are hidden; matches are marked. */
  query?: string;
  defaultQuery?: string;
  onQueryChange?: (query: string) => void;
  /** Height of the scrolling region. */
  height?: number | string;
  /** Skeleton lines while the first page of logs loads. */
  loading?: boolean;
  /** Names the log for screen readers. */
  label?: string;
  /** Overrides the timestamp format. Defaults to HH:MM:SS.mmm in local time. */
  formatTime?: (time: LogLine["time"]) => string;
};

export function LogViewer({
  lines,
  streaming = false,
  follow: followProp,
  defaultFollow = true,
  onFollowChange,
  wrap: wrapProp,
  defaultWrap = false,
  onWrapChange,
  levels: levelsProp,
  defaultLevels = LEVELS,
  onLevelsChange,
  query: queryProp,
  defaultQuery = "",
  onQueryChange,
  height = 320,
  loading = false,
  label = "Logs",
  formatTime = formatLogTime,
  className,
  ...rest
}: LogViewerProps) {
  const reduce = useReducedMotion();
  const [follow, setFollow] = useControllableState({ value: followProp, defaultValue: defaultFollow, onChange: onFollowChange });
  const [wrap, setWrap] = useControllableState({ value: wrapProp, defaultValue: defaultWrap, onChange: onWrapChange });
  const [levels, setLevels] = useControllableState<LogLevel[]>({ value: levelsProp, defaultValue: defaultLevels, onChange: onLevelsChange });
  const [query, setQuery] = useControllableState({ value: queryProp, defaultValue: defaultQuery, onChange: onQueryChange });
  const scroller = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const lastTop = useRef(0);
  const [tip] = useState(() => Tooltip.createHandle<string>());
  // Lines on screen at mount don't fade in; everything after does.
  const [initial] = useState(() => new Set(lines.map((l) => l.id)));
  // The newest line seen before following stopped, so the pill can count what came after.
  const [pausedAt, setPausedAt] = useState<LogLine["id"] | null>(null);

  const q = query.trim().toLowerCase();
  const matching = useMemo(() => (q ? lines.filter((l) => l.message.toLowerCase().includes(q) || l.source?.toLowerCase().includes(q)) : lines), [lines, q]);
  const counts = useMemo(() => {
    const c: Record<LogLevel, number> = { error: 0, warn: 0, info: 0, debug: 0 };
    for (const l of matching) c[l.level]++;
    return c;
  }, [matching]);
  const shown = useMemo(() => matching.filter((l) => levels.includes(l.level)), [matching, levels]);
  const filtered = !!q || levels.length < LEVELS.length;

  const newCount = useMemo(() => {
    if (follow || pausedAt === null) return 0;
    const i = shown.findIndex((l) => l.id === pausedAt);
    return i === -1 ? 0 : shown.length - 1 - i;
  }, [follow, pausedAt, shown]);

  // While following, every new line keeps the newest one in view, before paint.
  const lastId = shown.length ? shown[shown.length - 1].id : null;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !follow) return;
    el.scrollTop = el.scrollHeight;
    lastTop.current = el.scrollTop;
  }, [lastId, follow, wrap, shown.length]);

  const pause = () => {
    setPausedAt(lastId);
    setFollow(false);
  };
  const resume = () => {
    setPausedAt(null);
    setFollow(true);
  };

  // Only a person scrolls up. Scrolling up pauses; landing on the end again resumes.
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const up = el.scrollTop < lastTop.current - 1;
    const down = el.scrollTop > lastTop.current + 1;
    lastTop.current = el.scrollTop;
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
    if (follow && up && !atEnd) pause();
    else if (!follow && down && atEnd) resume();
  };

  // Resuming lands on the newest line on the next frame (the effect above does the scroll).
  const jumpToEnd = () => resume();

  const clearFilters = () => {
    setQuery("");
    setLevels(LEVELS);
  };

  const live = streaming && follow;

  return (
    <Tooltip.Provider delay={500}>
      <div
        data-slot="log-viewer"
        data-state={loading ? "loading" : live ? "live" : follow ? "following" : "paused"}
        aria-busy={loading || undefined}
        className={cn("flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-raised text-fg shadow-[var(--shadow)]", className)}
        {...rest}
      >
        <div className="flex h-10 items-center gap-1 border-b border-line pl-2.5 pr-1.5">
          <Search size={14} className="shrink-0 text-fg-3" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.preventDefault();
                setQuery("");
              }
            }}
            placeholder="Filter lines"
            aria-label={`Filter ${label.toLowerCase()}`}
            enterKeyHint="search"
            spellCheck={false}
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent pl-1.5 text-base text-fg outline-none placeholder:text-fg-4 sm:text-[12.5px] [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <IconButton label="Clear filter" tip={tip} onClick={() => { setQuery(""); searchRef.current?.focus(); }}>
              <X size={14} />
            </IconButton>
          )}
          <Tooltip.Trigger
            handle={tip}
            payload={wrap ? "Don’t wrap lines" : "Wrap lines"}
            render={
              <Toggle
                pressed={wrap}
                onPressedChange={setWrap}
                aria-label="Wrap lines"
                className={cn(iconButton, "data-pressed:bg-fg/[0.08] data-pressed:text-fg")}
              />
            }
          >
            <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M2.75 4h10.5M2.75 8h8.75a1.75 1.75 0 0 1 0 3.5H8.5M2.75 12h3M10 10l-1.5 1.5L10 13" />
            </svg>
          </Tooltip.Trigger>
          <Toggle
            pressed={follow}
            onPressedChange={(p) => (p ? jumpToEnd() : pause())}
            className={cn(
              "relative flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-fg-3 outline-none",
              "transition-[background-color,color,scale] duration-150 ease-out hover:bg-fg/[0.06] hover:text-fg active:scale-[0.96] active:duration-75",
              "focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 focus-visible:outline-solid",
              "data-pressed:bg-fg/[0.08] data-pressed:text-fg",
            )}
          >
            <span aria-hidden className="relative grid size-2 place-items-center">
              {live && <span className="absolute inset-0 animate-ping-soft rounded-full bg-success motion-reduce:hidden" />}
              <span className={cn("size-1.5 rounded-full transition-colors duration-200", live ? "bg-success" : follow ? "bg-fg-3" : "bg-fg-4")} />
            </span>
            Follow
          </Toggle>
        </div>

        <div className="flex h-9 items-center gap-2 border-b border-line px-1.5">
          <ToggleGroup
            multiple
            value={levels}
            onValueChange={(v) => setLevels(v as LogLevel[])}
            aria-label="Levels"
            className="flex min-w-0 items-center gap-0.5 overflow-x-auto px-0.5 py-1 [scrollbar-width:none]"
          >
            {LEVELS.map((lv) => (
              <Toggle
                key={lv}
                value={lv}
                data-empty={counts[lv] === 0 || undefined}
                aria-label={`${LEVEL_LABEL[lv]}, ${counts[lv]} ${counts[lv] === 1 ? "line" : "lines"}`}
                className={cn(
                  "group/chip relative flex h-6 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-[12px] text-fg-4 outline-none",
                  "transition-[background-color,color,scale] duration-150 ease-out hover:bg-fg/[0.05] hover:text-fg-2 active:scale-[0.95] active:duration-75",
                  "focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 focus-visible:outline-solid",
                  "data-pressed:text-fg data-pressed:data-empty:text-fg-3",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 rounded-full transition-[opacity,scale] duration-200 ease-out-expo",
                    LEVEL_DOT[lv],
                    "scale-75 opacity-40 group-data-pressed/chip:scale-100 group-data-pressed/chip:opacity-100",
                  )}
                />
                {LEVEL_LABEL[lv]}
                <span className="tabular min-w-3 font-mono text-[11px] text-fg-4 group-data-pressed/chip:text-fg-3">
                  <NumberFlow value={counts[lv]} animated={!reduce} willChange />
                </span>
              </Toggle>
            ))}
          </ToggleGroup>
          <span className="tabular ml-auto hidden shrink-0 pr-1.5 font-mono text-[11px] text-fg-4 sm:block" aria-live="polite">
            {filtered ? `${shown.length} of ${lines.length}` : `${lines.length} ${lines.length === 1 ? "line" : "lines"}`}
          </span>
        </div>

        <div className="relative min-h-0">
          <div
            ref={scroller}
            role="log"
            aria-label={label}
            aria-live="off"
            tabIndex={0}
            onScroll={onScroll}
            onKeyDown={(e) => {
              if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                searchRef.current?.focus();
              }
            }}
            className={cn(
              "overflow-auto overscroll-contain py-1.5 font-mono text-[12px] leading-5 outline-none",
              "focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3 focus-visible:outline-solid",
            )}
            style={{ height }}
          >
            {loading ? (
              <div aria-hidden className="flex flex-col gap-[7px] px-3 py-1.5">
                {[72, 54, 88, 40, 66, 58, 80].map((w, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="h-2.5 w-[84px] shrink-0 animate-pulse-soft rounded-sm bg-fg/[0.06]" />
                    <span className="h-2.5 animate-pulse-soft rounded-sm bg-fg/[0.06]" style={{ width: `${w - 30}%` }} />
                  </div>
                ))}
              </div>
            ) : !lines.length ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 font-sans text-[12.5px] text-fg-3">
                {streaming ? (
                  <>
                    <span aria-hidden className="size-1.5 animate-pulse-soft rounded-full bg-fg-3" />
                    Waiting for logs…
                  </>
                ) : (
                  "No logs yet"
                )}
              </div>
            ) : !shown.length ? (
              <div className="flex h-full flex-col items-center justify-center gap-2.5 px-6 text-center font-sans">
                <p className="text-[12.5px] text-fg-2">
                  {q ? (
                    <>
                      No lines match <span className="text-fg">“{query.trim()}”</span>
                    </>
                  ) : (
                    "No lines at these levels"
                  )}
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="h-7 rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 ease-out hover:border-fg-4 hover:bg-hover active:scale-[0.97] focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className={cn("flex flex-col", !wrap && "w-max min-w-full")}>
                {shown.map((l) => (
                  <div
                    key={l.id}
                    data-level={l.level}
                    className={cn(
                      "grid grid-cols-[auto_auto_1fr] gap-x-3 px-3 hover:bg-fg/[0.035] [contain-intrinsic-size:auto_20px] [content-visibility:auto]",
                      l.level === "error" && "bg-danger-soft/70 shadow-[inset_2px_0_0_var(--danger)] hover:bg-danger-soft",
                      l.level === "warn" && "shadow-[inset_2px_0_0_var(--warning)]",
                      !initial.has(l.id) && "transition-opacity duration-200 ease-out starting:opacity-0",
                    )}
                  >
                    <time className="tabular select-none text-fg-4" suppressHydrationWarning>
                      {formatTime(l.time)}
                    </time>
                    <span className={cn("select-none", LEVEL_TEXT[l.level])}>
                      <span aria-hidden>{LEVEL_TAG[l.level]}</span>
                      <span className="sr-only">{LEVEL_LABEL[l.level]}</span>
                    </span>
                    <span className={cn("min-w-0", wrap ? "whitespace-pre-wrap [overflow-wrap:anywhere]" : "whitespace-pre", l.level === "error" ? "text-fg" : "text-fg-2")}>
                      {l.source && (
                        <span className="text-fg-3">
                          <Marked text={l.source} query={query} />{" "}
                        </span>
                      )}
                      <Marked text={l.message} query={query} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <AnimatePresence>
            {!follow && shown.length > 0 && (
              <motion.button
                key="jump"
                type="button"
                onClick={() => {
                  jumpToEnd();
                  // The pill leaves as it's pressed; focus lands on the log it scrolled.
                  scroller.current?.focus({ preventScroll: true });
                }}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97, transition: { duration: 0.14 } }}
                transition={reduce ? { duration: 0.15 } : spring.snappy}
                className={cn(
                  "absolute bottom-3 left-1/2 flex h-7 -translate-x-1/2 items-center gap-1.5 rounded-full bg-fg pl-2.5 pr-3 text-[12px] font-medium text-frame shadow-pop outline-none",
                  "transition-[background-color] duration-150 hover:bg-fg/90 active:scale-[0.96]",
                  "focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid",
                )}
              >
                <ArrowDown size={13} />
                {newCount > 0 ? (
                  <span className="tabular flex items-center gap-1">
                    <NumberFlow value={newCount} animated={!reduce} willChange />
                    {newCount === 1 ? "new line" : "new lines"}
                  </span>
                ) : (
                  "Jump to latest"
                )}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Tooltip.Root handle={tip}>
        {({ payload }) => (
          <Tooltip.Portal>
            <Tooltip.Positioner side="top" sideOffset={6} collisionPadding={8} className="z-(--z-tooltip)">
              <Tooltip.Popup
                className={cn(
                  "flex min-h-6 items-center rounded-md border border-line-2 bg-raised px-2 py-1 text-[12px] leading-4 text-fg shadow-pop",
                  "origin-(--transform-origin) transition-[opacity,scale,translate] duration-150 ease-out-expo",
                  "data-starting-style:translate-y-0.5 data-starting-style:scale-96 data-starting-style:opacity-0 data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-100",
                  "data-instant:duration-0",
                )}
              >
                {payload}
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        )}
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

const iconButton = cn(
  "relative grid size-7 shrink-0 place-items-center rounded-md text-fg-3 outline-none",
  "transition-[background-color,color,scale] duration-150 ease-out hover:bg-fg/[0.06] hover:text-fg active:scale-[0.92] active:duration-75",
  "focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 focus-visible:outline-solid",
  "before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden",
);

function IconButton({ label, tip, onClick, children }: { label: string; tip: ReturnType<typeof Tooltip.createHandle<string>>; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip.Trigger handle={tip} payload={label} render={<button type="button" aria-label={label} onClick={onClick} className={iconButton} />}>
      {children}
    </Tooltip.Trigger>
  );
}
