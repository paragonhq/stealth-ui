"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ArrowUp, Bolt, CircleCheck, CircleX, Loader, Message, Pencil, Plus, Tag, Trash, Upload, Users, Warning } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

export type ActivityKind = "merge" | "commit" | "comment" | "deploy" | "approve" | "request-changes" | "open" | "close" | "edit" | "delete" | "invite" | "upload" | "release";

export type ActivityItem = {
  id: string;
  actor: { name: string; avatarUrl?: string };
  /** The verb phrase: "merged", "commented on", "deployed". */
  action: React.ReactNode;
  /** What it happened to. Rendered as a link when it has an href. */
  target?: { label: React.ReactNode; href?: string };
  /** Anything that follows the target: "to production", "from main". */
  suffix?: React.ReactNode;
  /** A quote, a commit list, a diff summary: shown under the sentence. */
  detail?: React.ReactNode;
  at: Date | string | number;
  /** Picks the icon and its tone. */
  kind?: ActivityKind;
  /** Overrides the icon for this item. */
  icon?: React.ReactNode;
};

/* -------------------------------------------------------------------------------------------------
 * Time: one shared clock, 30s ticks while the tab is visible; 0 on the server and while hydrating
 * -----------------------------------------------------------------------------------------------*/

let clock = 0;
let ticker: number | undefined;
const listeners = new Set<() => void>();
const tick = () => {
  if (document.hidden) return;
  clock = Date.now();
  listeners.forEach((l) => l());
};
function subscribeClock(cb: () => void) {
  listeners.add(cb);
  if (ticker === undefined) {
    ticker = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size) {
      window.clearInterval(ticker);
      ticker = undefined;
      document.removeEventListener("visibilitychange", tick);
    }
  };
}
const readClock = () => clock || (clock = Date.now());
const useNow = () => useSyncExternalStore(subscribeClock, readClock, () => 0);

const toMs = (d: Date | string | number) => (d instanceof Date ? d.getTime() : typeof d === "number" ? d : Date.parse(d));
const dayStart = (ms: number) => new Date(ms).setHours(0, 0, 0, 0);
const fmtWeekday = new Intl.DateTimeFormat(undefined, { weekday: "long" });
const fmtDay = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const fmtDayYear = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const fmtTime = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const fmtFull = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function groupLabel(dayMs: number, now: number) {
  const days = Math.round((dayStart(now) - dayMs) / 864e5);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return fmtWeekday.format(dayMs);
  return new Date(dayMs).getFullYear() === new Date(now).getFullYear() ? fmtDay.format(dayMs) : fmtDayYear.format(dayMs);
}

/** Recent times read as a distance ("4m"); older ones as the clock time, since the day is in the header. */
function shortTime(ms: number, now: number) {
  if (!now) return fmtTime.format(ms);
  const s = Math.max(0, (now - ms) / 1000);
  if (s < 45) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 12 && dayStart(ms) === dayStart(now)) return `${h}h`;
  return fmtTime.format(ms);
}

/* -------------------------------------------------------------------------------------------------
 * Icons: the shared set plus merge and commit, drawn on the same grid
 * -----------------------------------------------------------------------------------------------*/

const glyph = {
  width: 14,
  height: 14,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
const MergeIcon = () => (
  <svg {...glyph}>
    <circle cx="5" cy="3.75" r="1.5" />
    <circle cx="5" cy="12.25" r="1.5" />
    <circle cx="11.25" cy="8.75" r="1.5" />
    <path d="M5 5.25v5.5M5 5.5c0 2.2 1.6 3.25 4.75 3.25" />
  </svg>
);
const CommitIcon = () => (
  <svg {...glyph}>
    <circle cx="8" cy="8" r="2.25" />
    <path d="M2.25 8h3.5M10.25 8h3.5" />
  </svg>
);

const kinds: Record<ActivityKind, { icon: React.ReactNode; tone: "default" | "success" | "danger" | "warning" | "info" }> = {
  merge: { icon: <MergeIcon />, tone: "info" },
  commit: { icon: <CommitIcon />, tone: "default" },
  comment: { icon: <Message size={14} />, tone: "default" },
  deploy: { icon: <Bolt size={14} />, tone: "success" },
  approve: { icon: <CircleCheck size={14} />, tone: "success" },
  "request-changes": { icon: <Warning size={14} />, tone: "warning" },
  open: { icon: <Plus size={14} />, tone: "default" },
  close: { icon: <CircleX size={14} />, tone: "danger" },
  edit: { icon: <Pencil size={14} />, tone: "default" },
  delete: { icon: <Trash size={14} />, tone: "danger" },
  invite: { icon: <Users size={14} />, tone: "default" },
  upload: { icon: <Upload size={14} />, tone: "default" },
  release: { icon: <Tag size={14} />, tone: "info" },
};

const tones = {
  default: "text-fg-2",
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
  info: "text-info",
} as const;

/* -------------------------------------------------------------------------------------------------
 * ActivityFeed
 * -----------------------------------------------------------------------------------------------*/

export type ActivityFeedProps = Omit<React.ComponentProps<"section">, "children"> & {
  /** Newest first. Prepend to show live activity; append after onLoadMore for older. */
  items: ActivityItem[];
  /** Load the next page of older items. A promise keeps the button busy; a rejection shows Retry. */
  onLoadMore?: () => void | Promise<unknown>;
  /** Whether older items exist. When false the feed ends with endLabel. */
  hasMore?: boolean;
  /** First load: shows rows shaped like the feed instead of an empty state. */
  loading?: boolean;
  /** Height of the scroll area. Without it the feed grows with its content and the "new" pill is not needed. */
  maxHeight?: number | string;
  /** Shown where the history begins, e.g. "Project created". */
  endLabel?: React.ReactNode;
  /** Shown when there's nothing at all. */
  emptyLabel?: React.ReactNode;
  /** Accessible name of the feed. */
  label?: string;
};

export function ActivityFeed({
  items,
  onLoadMore,
  hasMore = false,
  loading = false,
  maxHeight,
  endLabel,
  emptyLabel = "No activity yet",
  label = "Activity",
  className,
  style,
  ...rest
}: ActivityFeedProps) {
  const reduce = !!useReducedMotion();
  const now = useNow();
  const uid = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [head, setHead] = useState(items[0]?.id);
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle");
  const [announcement, setAnnouncement] = useState("");
  const [live, setLive] = useState<string[]>([]);
  // The row at the top of the view and how far down it sits, so arrivals above it can't move it.
  const anchor = useRef<{ id: string; offset: number } | null>(null);

  // New items at the top: count them if the reader has scrolled away, rather than
  // pushing what they're reading down. (Adjusting state during render, not in an effect.)
  if (items[0]?.id !== head) {
    const at = items.findIndex((i) => i.id === head);
    const added = at > 0 ? at : 0;
    setHead(items[0]?.id);
    if (added) {
      setLive((l) => [...items.slice(0, added).map((i) => i.id), ...l].slice(0, 50));
      if (away && maxHeight != null) setUnseen((n) => n + added);
      const first = items[0];
      setAnnouncement(`${first.actor.name} ${typeof first.action === "string" ? first.action : ""} ${typeof first.target?.label === "string" ? first.target.label : ""}`.trim());
    }
  }

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: ActivityItem[] }[] = [];
    for (const item of items) {
      const ms = toMs(item.at);
      const day = dayStart(ms);
      // Until the client clock is known the headers can't say "Today", so the first paint groups by date only.
      const key = String(day);
      const last = out[out.length - 1];
      if (last?.key === key) last.items.push(item);
      else out.push({ key, label: now ? groupLabel(day, now) : fmtDay.format(day), items: [item] });
    }
    return out;
  }, [items, now]);

  const loadMore = async () => {
    if (!onLoadMore || more === "loading") return;
    setMore("loading");
    try {
      await onLoadMore();
      setMore("idle");
    } catch {
      setMore("error");
    }
  };

  const captureAnchor = (el: HTMLElement) => {
    const top = el.getBoundingClientRect().top;
    for (const row of el.querySelectorAll<HTMLElement>("[data-activity-id]")) {
      const r = row.getBoundingClientRect();
      if (r.bottom > top + 32) {
        anchor.current = { id: row.dataset.activityId!, offset: r.top - top };
        return;
      }
    }
  };

  // Keep the reader's place when rows arrive above it: put the anchored row back where it was.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const a = anchor.current;
    if (!el || !a || maxHeight == null || el.scrollTop <= 24) return;
    const row = el.querySelector<HTMLElement>(`[data-activity-id="${CSS.escape(a.id)}"]`);
    if (!row) return;
    const d = row.getBoundingClientRect().top - el.getBoundingClientRect().top - a.offset;
    if (Math.abs(d) > 0.5) el.scrollTop += d;
  }, [items, maxHeight]);

  const toTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    setUnseen(0);
  };

  return (
    <section
      aria-label={label}
      aria-busy={loading || more === "loading" || undefined}
      className={cn("relative flex min-w-0 flex-col [--feed-bg:var(--raised)]", className)}
      style={style}
      {...rest}
    >
      {/* "3 new" floats over the top edge; pressing it scrolls up to them. */}
      <AnimatePresence>
        {unseen > 0 && (
          <motion.button
            type="button"
            onClick={toTop}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12 } }}
            transition={reduce ? { duration: 0.12 } : spring.snappy}
            className={cn(
              "absolute left-1/2 top-2 z-10 inline-flex h-7 -translate-x-1/2 items-center gap-1.5 rounded-full bg-fg px-3 text-[12px] font-medium text-frame shadow-pop outline-none",
              "transition-[background-color,scale] duration-150 hover:bg-fg/90 active:scale-[0.96]",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            )}
          >
            <ArrowUp size={12} />
            {unseen} new
          </motion.button>
        )}
      </AnimatePresence>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const top = e.currentTarget.scrollTop;
          const isAway = top > 24;
          if (isAway !== away) setAway(isAway);
          if (!isAway && unseen) setUnseen(0);
          captureAnchor(e.currentTarget);
        }}
        style={{ maxHeight }}
        className={cn(
          "relative min-w-0",
          // The bottom edge fades so a cut-off row reads as "more below". Anchoring is done by hand (above), so the browser's is off.
          maxHeight != null &&
            "overflow-y-auto overscroll-contain pb-6 [overflow-anchor:none] [scrollbar-width:thin] [mask-image:linear-gradient(to_bottom,black_calc(100%-24px),transparent)]",
        )}
      >
        {loading && items.length === 0 ? (
          <Skeleton />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
            <p className="text-[13px] font-medium text-fg">{emptyLabel}</p>
            <p className="text-[12.5px] text-fg-3">Changes, comments and deploys will show up here.</p>
          </div>
        ) : (
          <div className="relative">
            {groups.map((g) => (
              <div key={g.key} role="group" aria-labelledby={`${uid}-${g.key}`} className="relative">
                <h3
                  id={`${uid}-${g.key}`}
                  suppressHydrationWarning
                  className={cn(
                    "sticky top-0 z-[1] flex h-8 items-center pl-10 font-mono text-2xs uppercase tracking-[0.08em] text-fg-3",
                    maxHeight != null && "bg-[var(--feed-bg)]",
                  )}
                >
                  {g.label}
                </h3>
                <ol className="flex flex-col">
                  <AnimatePresence initial={false}>
                    {g.items.map((item, i) => (
                      <Row
                        key={item.id}
                        item={item}
                        now={now}
                        reduce={reduce}
                        live={live.includes(item.id)}
                        // Rows that arrive while the reader is scrolled away appear at full height, so the anchor holds.
                        instant={away && maxHeight != null}
                        first={i === 0}
                        // The last row of the last day runs on into "Load older" or the end marker.
                        last={i === g.items.length - 1 && (g !== groups[groups.length - 1] || (!(hasMore && onLoadMore) && !endLabel))}
                      />
                    ))}
                  </AnimatePresence>
                </ol>
              </div>
            ))}

            <FeedEnd hasMore={hasMore && !!onLoadMore} state={more} onLoad={() => void loadMore()} endLabel={endLabel} />
          </div>
        )}
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {more === "error" ? "Couldn’t load older activity" : announcement}
      </span>
    </section>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Parts
 * -----------------------------------------------------------------------------------------------*/

function Row({
  item,
  now,
  reduce,
  live,
  instant,
  first,
  last,
  ref,
}: {
  item: ActivityItem;
  now: number;
  reduce: boolean;
  live: boolean;
  instant: boolean;
  first: boolean;
  last: boolean;
  ref?: React.Ref<HTMLLIElement>;
}) {
  const kind = item.kind ? kinds[item.kind] : null;
  const ms = toMs(item.at);
  const target = item.target;

  return (
    <motion.li
      ref={ref}
      data-activity-id={item.id}
      initial={instant ? false : reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.16 } }}
      transition={reduce ? { duration: 0.15 } : { height: { duration: 0.28, ease: ease.inOut }, opacity: { duration: 0.2, delay: 0.06 } }}
      className="relative overflow-hidden"
    >
      {/* A row that arrives live starts lit and cools to the page, so the eye finds it. */}
      {live && (
        <motion.span
          aria-hidden
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.4, delay: 0.5, ease: ease.outQuart }}
          className="pointer-events-none absolute inset-y-0.5 left-7 right-0 rounded-lg bg-fg/[0.07]"
        />
      )}
      {/* The timeline is drawn per row, node centre to node centre, so it starts and ends exactly on a node. */}
      {!first && <span aria-hidden className="pointer-events-none absolute left-[13.5px] top-0 h-5 w-px bg-line-2" />}
      {!last && <span aria-hidden className="pointer-events-none absolute bottom-0 left-[13.5px] top-5 w-px bg-line-2" />}
      <div className="relative grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-x-3 py-1.5">
        <motion.span
          aria-hidden
          initial={reduce || !live ? false : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduce ? { duration: 0 } : { ...spring.pop, delay: 0.12 }}
          className={cn("relative grid size-7 place-items-center rounded-full border border-line-2 bg-[var(--feed-bg)]", kind ? tones[kind.tone] : "text-fg-2")}
        >
          {item.icon ?? kind?.icon ?? (
            <span className="text-[10px] font-medium text-fg-2">
              {item.actor.name
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0])
                .join("")}
            </span>
          )}
        </motion.span>

        <div className="min-w-0 pt-[5px]">
          <p className="text-[13px] leading-[18px] text-fg-2 [overflow-wrap:anywhere]">
            <span className="font-medium text-fg">{item.actor.name}</span> {item.action}
            {target && (
              <>
                {" "}
                {target.href ? (
                  <a
                    href={target.href}
                    className={cn(
                      "rounded-sm font-medium text-fg underline decoration-fg-4 decoration-1 underline-offset-[3px] outline-none transition-[text-decoration-color] duration-150 hover:decoration-fg-2",
                      "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                    )}
                  >
                    {target.label}
                  </a>
                ) : (
                  <span className="font-medium text-fg">{target.label}</span>
                )}
              </>
            )}
            {item.suffix && <> {item.suffix}</>}
          </p>
          {item.detail && <div className="mt-1.5 min-w-0 text-[12.5px] text-fg-2">{item.detail}</div>}
        </div>

        <time
          dateTime={new Date(ms).toISOString()}
          title={fmtFull.format(ms)}
          suppressHydrationWarning
          className="whitespace-nowrap pt-[5px] text-[12px] leading-[18px] text-fg-3 tabular"
        >
          {shortTime(ms, now)}
        </time>
      </div>
    </motion.li>
  );
}

function FeedEnd({ hasMore, state, onLoad, endLabel }: { hasMore: boolean; state: "idle" | "loading" | "error"; onLoad: () => void; endLabel?: React.ReactNode }) {
  if (!hasMore) {
    return endLabel ? (
      <div className="relative grid grid-cols-[28px_minmax(0,1fr)] items-center gap-x-3 py-2">
        <span aria-hidden className="pointer-events-none absolute left-[13.5px] top-0 h-1/2 w-px bg-line-2" />
        <span aria-hidden className="mx-auto size-2 rounded-full border border-line-2 bg-[var(--feed-bg)]" />
        <p className="text-[12px] text-fg-3">{endLabel}</p>
      </div>
    ) : null;
  }
  return (
    <div className="relative grid grid-cols-[28px_minmax(0,1fr)] items-center gap-x-3 py-2">
      <span aria-hidden className="pointer-events-none absolute left-[13.5px] top-0 h-1/2 w-px bg-line-2 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <span aria-hidden className="mx-auto grid size-5 place-items-center rounded-full border border-dashed border-line-2 bg-[var(--feed-bg)] text-fg-3">
        {state === "loading" ? <Loader size={11} className="animate-spin" /> : <span className="size-1 rounded-full bg-fg-4" />}
      </span>
      <div className="flex min-w-0 items-center gap-2">
        {state === "error" && <span className="text-[12px] text-danger">Couldn’t load older activity.</span>}
        <button
          type="button"
          onClick={onLoad}
          disabled={state === "loading"}
          aria-busy={state === "loading" || undefined}
          className={cn(
            "relative -ml-1.5 inline-flex h-7 items-center rounded-md px-1.5 text-[12.5px] font-medium text-fg-2 outline-none",
            "transition-[background-color,color,scale] duration-150 ease-out-quart hover:bg-fg/[0.06] hover:text-fg active:scale-[0.97] active:duration-75",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
            "disabled:cursor-progress disabled:text-fg-3 disabled:hover:bg-transparent",
            "before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
          )}
        >
          {state === "loading" ? "Loading older activity…" : state === "error" ? "Try again" : "Load older activity"}
        </button>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-1 py-1">
      <span className="ml-10 h-8 w-16 py-3">
        <span className="block h-2 w-full rounded-full bg-fg/[0.06] animate-pulse-soft" />
      </span>
      {[72, 88, 60, 80].map((w, i) => (
        <div key={i} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 py-1.5">
          <span className="size-7 rounded-full bg-fg/[0.06] animate-pulse-soft" />
          <span className="h-2.5 rounded-full bg-fg/[0.06] animate-pulse-soft" style={{ width: `${w}%` }} />
          <span className="h-2.5 w-6 rounded-full bg-fg/[0.06] animate-pulse-soft" />
        </div>
      ))}
    </div>
  );
}
