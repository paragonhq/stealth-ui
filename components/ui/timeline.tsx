"use client";
import { Avatar } from "@base-ui/react/avatar";
import { Collapsible } from "@base-ui/react/collapsible";
import { AnimatePresence, motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { ChevronRight, Loader } from "@/lib/icons";

export type TimelineTone = "neutral" | "success" | "warning" | "danger" | "info";

export type TimelineEvent = {
  /** Stable id. New ids that arrive after mount animate in. */
  id: string;
  date: Date | string | number;
  /** The event, usually with the actor in it: “Maya merged #1290”. */
  title: React.ReactNode;
  /** One line under the title. */
  description?: React.ReactNode;
  /** Hidden behind a Details toggle: a diff, a log excerpt, the full comment. */
  details?: React.ReactNode;
  /** 14px glyph in the rail node. */
  icon?: React.ReactNode;
  /** Draws the node as this person's avatar instead of an icon. */
  actor?: { name: string; avatarSrc?: string };
  /** Colors the node's icon. Meaning only: a failed deploy, a resolved incident. */
  tone?: TimelineTone;
};

/* -------------------------------------------------------------------------------------------------
 * Time
 * -----------------------------------------------------------------------------------------------*/

// A clock shared by every timeline on the page, ticking every 30s. On the server and during
// hydration it reads null, so relative labels only ever render on the client.
const ticker = (() => {
  const listeners = new Set<() => void>();
  let now = 0;
  let timer: number | undefined;
  const read = () => Math.floor(Date.now() / 30000) * 30000;
  return {
    subscribe(fn: () => void) {
      listeners.add(fn);
      if (listeners.size === 1) {
        now = read();
        timer = window.setInterval(() => {
          const next = read();
          if (next !== now) {
            now = next;
            listeners.forEach((l) => l());
          }
        }, 5000);
      }
      return () => {
        listeners.delete(fn);
        if (!listeners.size) window.clearInterval(timer);
      };
    },
    get: () => (now ||= read()),
  };
})();

/** The current time to the nearest 30 seconds, or null before hydration. */
export function useNow() {
  return useSyncExternalStore(ticker.subscribe, ticker.get, () => null);
}

const toDate = (d: TimelineEvent["date"]) => (d instanceof Date ? d : new Date(d));
const dayKey = (d: Date, utc: boolean) => (utc ? d.toISOString().slice(0, 10) : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function dayLabel(d: Date, now: number | null, locale: string) {
  if (now === null) return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
  const days = Math.round((startOfDay(new Date(now)) - startOfDay(d)) / 86400000);
  if (days === 0 || days === 1) {
    const s = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-days, "day");
    return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  }
  if (days > 1 && days < 7) return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(d);
  const sameYear = new Date(now).getFullYear() === d.getFullYear();
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: sameYear ? undefined : "numeric" }).format(d);
}

function timeLabel(d: Date, now: number | null, locale: string) {
  const clock = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: now === null ? "UTC" : undefined }).format(d);
  if (now === null) return clock;
  const s = (now - d.getTime()) / 1000;
  // Recent events read as an age; anything older than a few hours reads as a time of day,
  // because the day header already says which day.
  if (s < 45) return "Just now";
  const rtf = new Intl.RelativeTimeFormat(locale, { style: "narrow", numeric: "always" });
  if (s < 3600) return rtf.format(-Math.max(1, Math.round(s / 60)), "minute");
  if (s < 4 * 3600) return rtf.format(-Math.floor(s / 3600), "hour");
  return clock;
}

/* -------------------------------------------------------------------------------------------------
 * Timeline
 * -----------------------------------------------------------------------------------------------*/

export type TimelineProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Newest first. Grouped by the viewer's local day. */
  events: TimelineEvent[];
  locale?: string;
  /** Day headers stick to the top of the nearest scroll container. Set `--timeline-surface` to the background behind the timeline so they cover what scrolls under them. */
  stickyHeaders?: boolean;
  /** Skeleton rows while the first page loads. */
  loading?: boolean;
  /** Shown when there are no events and nothing is loading. */
  empty?: React.ReactNode;
  /** There is older history: the rail continues, dashed, into a Show older button. */
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
};

export function Timeline({
  events,
  locale = "en-US",
  stickyHeaders = true,
  loading = false,
  empty = "No activity yet",
  hasMore = false,
  onLoadMore,
  loadingMore = false,
  className,
  ...rest
}: TimelineProps) {
  const now = useNow();
  const reduce = useReducedMotion();
  // The first events shown are history. Later ids newer than all of them are news and get the
  // entrance; older pages loaded at the bottom don't. The snapshot waits for loading to finish.
  const [history, setHistory] = useState<{ ids: Set<string>; newest: number } | null>(null);
  if (!loading && history === null) {
    setHistory({ ids: new Set(events.map((e) => e.id)), newest: Math.max(-Infinity, ...events.map((e) => toDate(e.date).getTime())) });
  }
  const isFresh = (e: TimelineEvent & { at: Date }) => !!history && !history.ids.has(e.id) && e.at.getTime() > history.newest;

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: (TimelineEvent & { at: Date })[] }[] = [];
    for (const e of events) {
      const at = toDate(e.date);
      const key = dayKey(at, now === null);
      const last = out[out.length - 1];
      if (last?.key === key) last.items.push({ ...e, at });
      else out.push({ key, label: dayLabel(at, now, locale), items: [{ ...e, at }] });
    }
    return out;
  }, [events, now, locale]);

  if (loading) return <TimelineSkeleton className={className} {...rest} />;
  if (!events.length)
    return (
      <div className={cn("flex items-center gap-3 py-2 text-[13px] text-fg-3", className)} {...rest}>
        <span aria-hidden className="size-2 shrink-0 rounded-full border border-dashed border-fg-4 ml-2 mr-1" />
        {empty}
      </div>
    );

  // Arrivals grow from zero height, pushing history down rather than jumping it. Clipping is
  // only on while growing, so sticky headers, focus rings and the arrival ring aren't cut.
  const enter: Enter = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
    : {
        initial: { height: 0, opacity: 0, overflow: "hidden" },
        animate: { height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } },
        transition: { height: { duration: 0.34, ease: ease.out }, opacity: { duration: 0.24, delay: 0.06, ease: ease.out } },
      };

  return (
    <div data-slot="timeline" className={cn("relative text-[13px]", className)} {...rest}>
      {/* Before hydration days are grouped in UTC; the local regrouping swaps in without animating. */}
      <AnimatePresence key={now === null ? "server" : "client"} initial={false}>
        {groups.map((g, gi) => (
          <motion.section
            key={g.key}
            aria-label={g.label}
            {...enter}
            exit={{ opacity: 0, height: 0, overflow: "hidden", transition: { duration: 0.18 } }}
          >
            <h3
              className={cn(
                "relative z-[1] flex h-8 items-center pl-9 font-mono text-2xs tracking-[0.08em] text-fg-3 uppercase",
                stickyHeaders && "sticky top-0 bg-(--timeline-surface,var(--frame))",
                // The rail runs through every header but the first.
                gi > 0 && "before:absolute before:top-0 before:bottom-0 before:left-[11.5px] before:w-px before:bg-line-2",
              )}
            >
              <span suppressHydrationWarning>{g.label}</span>
            </h3>
            <ol>
              <AnimatePresence initial={false}>
                {g.items.map((e, i) => (
                  <Item
                    key={e.id}
                    event={e}
                    at={e.at}
                    now={now}
                    locale={locale}
                    fresh={isFresh(e)}
                    first={gi === 0 && i === 0}
                    last={gi === groups.length - 1 && i === g.items.length - 1 && !hasMore}
                    enter={enter}
                    reduce={!!reduce}
                  />
                ))}
              </AnimatePresence>
            </ol>
          </motion.section>
        ))}
      </AnimatePresence>

      {hasMore && (
        <div className="relative flex items-center pt-1 pl-9">
          {/* The rail keeps going, dashed: there is more above the fold of history. */}
          <span
            aria-hidden
            className="absolute top-0 left-[11.5px] h-full w-px bg-[linear-gradient(var(--line-2)_50%,transparent_50%)] bg-[length:1px_4px]"
          />
          <button
            type="button"
            onClick={onLoadMore}
            aria-busy={loadingMore || undefined}
            className={cn(
              "relative -ml-2 inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-fg-2 select-none",
              "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75",
              loadingMore && "pointer-events-none",
            )}
          >
            <span className={cn("transition-opacity duration-150", loadingMore && "opacity-0")}>Show older activity</span>
            {loadingMore && (
              <span className="absolute inset-0 grid place-items-center">
                <Loader size={14} className="animate-spin-slow" />
                <span className="sr-only">Loading older activity</span>
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

const toneClass: Record<TimelineTone, string> = {
  neutral: "text-fg-2",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

type Enter = Pick<HTMLMotionProps<"li">, "initial" | "animate" | "transition">;

function Item({
  event,
  at,
  now,
  locale,
  fresh,
  first,
  last,
  enter,
  reduce,
}: {
  event: TimelineEvent;
  at: Date;
  now: number | null;
  locale: string;
  fresh: boolean;
  first: boolean;
  last: boolean;
  enter: Enter;
  reduce: boolean;
}) {
  const { title, description, details, icon, actor, tone = "neutral" } = event;
  const absolute = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: now === null ? "UTC" : undefined }).format(
    at,
  );

  return (
    <motion.li {...enter} exit={{ opacity: 0, height: 0, overflow: "hidden", transition: { duration: 0.18 } }} className="relative">
      {/* The rail: from this node's center down, and up to the previous one unless this is the first. */}
      <span
        aria-hidden
        className={cn("absolute left-[11.5px] w-px bg-line-2", first ? "top-3" : "top-0", last ? "h-3" : "bottom-0", first && last && "hidden")}
      />
      <motion.div
        initial={fresh && !reduce ? { y: -6, filter: "blur(2px)" } : false}
        animate={{ y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.34, ease: ease.out }}
        className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 pb-4"
      >
        <Node icon={icon} actor={actor} tone={tone} fresh={fresh} reduce={reduce} />
        <div className="min-w-0 pt-0.5">
          <div className="flex items-baseline gap-3">
            <p className="min-w-0 flex-1 leading-5 text-pretty text-fg [&_b]:font-medium [&_strong]:font-medium">{title}</p>
            <time
              dateTime={at.toISOString()}
              title={absolute}
              suppressHydrationWarning
              className="shrink-0 text-[12px] leading-5 whitespace-nowrap text-fg-3 tabular"
            >
              {timeLabel(at, now, locale)}
            </time>
          </div>
          {description && <p className="mt-0.5 text-[12.5px] leading-[18px] text-pretty text-fg-2">{description}</p>}
          {details && <Details>{details}</Details>}
        </div>
      </motion.div>
    </motion.li>
  );
}

function Node({
  icon,
  actor,
  tone,
  fresh,
  reduce,
}: {
  icon?: React.ReactNode;
  actor?: TimelineEvent["actor"];
  tone: TimelineTone;
  fresh: boolean;
  reduce: boolean;
}) {
  return (
    <span className="relative grid size-6 place-items-center">
      {fresh && !reduce && (
        // One ring, once, on arrival: it marks what's new without looping for attention.
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full border border-fg-3"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.9, opacity: 0 }}
          transition={{ duration: 0.8, ease: ease.out, delay: 0.2 }}
        />
      )}
      <motion.span
        initial={fresh && !reduce ? { scale: 0.6 } : false}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 30, mass: 0.7, delay: 0.08 }}
        className={cn(
          "relative grid size-6 place-items-center overflow-hidden rounded-full border border-line-2 bg-raised",
          !actor && toneClass[tone],
          tone !== "neutral" && !actor && "border-current/30",
        )}
      >
        {actor ? (
          <Avatar.Root className="grid size-full place-items-center bg-fg/[0.1] text-[9.5px] font-medium text-fg-2 select-none">
            <Avatar.Image src={actor.avatarSrc} alt="" width={24} height={24} className="col-start-1 row-start-1 size-full object-cover" />
            <Avatar.Fallback className="col-start-1 row-start-1">{initials(actor.name)}</Avatar.Fallback>
          </Avatar.Root>
        ) : (
          <span className="grid place-items-center [&>svg]:size-3.5">{icon ?? <span className="size-1.5 rounded-full bg-current" />}</span>
        )}
      </motion.span>
    </span>
  );
}

function Details({ children }: { children: React.ReactNode }) {
  return (
    <Collapsible.Root className="mt-0.5 -mb-1">
      <Collapsible.Trigger
        className={cn(
          "group/details relative -ml-1.5 inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[12px] text-fg-3 select-none",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
          "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg-2 active:scale-[0.97] active:duration-75 data-panel-open:text-fg-2",
          "before:absolute before:-inset-y-2.5 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
        )}
      >
        <ChevronRight
          size={14}
          className="-ml-0.5 transition-transform duration-200 ease-out-quart group-data-panel-open/details:rotate-90 motion-reduce:transition-none"
        />
        Details
      </Collapsible.Trigger>
      <Collapsible.Panel
        className={cn(
          "h-(--collapsible-panel-height) overflow-hidden",
          "transition-[height,opacity] duration-220 ease-out-quart data-ending-style:duration-150",
          "data-starting-style:h-0 data-starting-style:opacity-0 data-ending-style:h-0 data-ending-style:opacity-0",
          "motion-reduce:transition-[opacity]",
        )}
      >
        <div className="pt-1.5 pb-0.5">
          <div className="rounded-lg border border-line bg-fg/[0.025] px-3 py-2.5 text-[12.5px] leading-[18px] text-fg-2">{children}</div>
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

function initials(name: string) {
  const words = name
    .trim()
    .split(/[\s._]+/)
    .filter(Boolean);
  const first = (w: string) => Array.from(w)[0] ?? "";
  return (words.length > 1 ? first(words[0]) + first(words[words.length - 1]) : first(words[0] ?? "")).toUpperCase();
}

// Three rows in the item's own geometry: node, title line with a time, a description line.
function TimelineSkeleton({ className, ...rest }: React.ComponentProps<"div">) {
  const fill = "bg-fg/[0.07] animate-pulse-soft motion-reduce:animate-none";
  return (
    <div aria-busy className={cn("relative", className)} {...rest}>
      <span className="sr-only">Loading activity</span>
      <div className="flex h-8 items-center pl-9">
        <span className={cn(fill, "h-2.5 w-14 rounded-[4px]")} />
      </div>
      {[0.72, 0.56, 0.64].map((w, i) => (
        <div key={i} aria-hidden className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 pb-4">
          {i < 2 && <span className={cn("absolute left-[11.5px] w-px bg-line-2", i === 0 ? "top-3" : "top-0", "bottom-0")} />}
          {i === 2 && <span className="absolute top-0 left-[11.5px] h-3 w-px bg-line-2" />}
          <span className={cn(fill, "relative size-6 rounded-full")} />
          <div className="pt-0.5">
            <div className="flex h-5 items-center gap-3">
              <span className={cn(fill, "h-3 rounded-[4px]")} style={{ width: `${w * 100}%` }} />
              <span className={cn(fill, "ml-auto h-2.5 w-10 rounded-[4px]")} />
            </div>
            <div className="mt-0.5 flex h-[18px] items-center">
              <span className={cn(fill, "h-2.5 rounded-[4px]")} style={{ width: `${w * 60}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
