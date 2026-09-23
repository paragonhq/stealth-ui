"use client";
import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ArrowDown, ArrowUp, ChevronDown, Plus } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type EventTone = "neutral" | "info" | "success" | "warning" | "danger";

export type AgendaEvent = {
  id: string;
  title: string;
  start: Date;
  /** Exclusive. */
  end: Date;
  allDay?: boolean;
  location?: string;
  /** A video call link. Shows a Join button until the event ends. */
  meetingUrl?: string;
  /** Short line under the title: attendees, a project, a room. */
  detail?: string;
  /** Meaning only: a deadline, an outage, a launch. */
  tone?: EventTone;
  status?: "confirmed" | "tentative" | "canceled";
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayNum = (d: Date) => d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
const cmpDay = (a: Date, b: Date) => dayNum(a) - dayNum(b);
const diffDays = (a: Date, b: Date) =>
  Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5);
const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isAllDay = (e: AgendaEvent) => !!e.allDay || e.end.getTime() - e.start.getTime() >= 864e5;
const lastDay = (e: AgendaEvent) => {
  const last = startOfDay(new Date(Math.max(e.end.getTime() - 1, e.start.getTime())));
  return cmpDay(last, e.start) < 0 ? startOfDay(e.start) : last;
};
const duration = (mins: number) => (mins < 60 ? `${mins}m` : mins % 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins / 60}h`);

function subscribeLanguage(notify: () => void) {
  window.addEventListener("languagechange", notify);
  return () => window.removeEventListener("languagechange", notify);
}
const useLocale = (locale?: string) => {
  const browser = useSyncExternalStore(subscribeLanguage, () => navigator.language, () => "en-US");
  return locale ?? browser;
};

/**
 * A clock that ticks every `ms`, aligned to the boundary, and resyncs when the tab
 * comes back. Null during the server render so nothing time-relative is prerendered.
 */
export function useClock(ms: number, override?: Date) {
  const subscribe = useCallback(
    (notify: () => void) => {
      let timer = 0;
      const arm = () => {
        timer = window.setTimeout(() => (notify(), arm()), ms - (Date.now() % ms) + 10);
      };
      arm();
      const onVisible = () => document.visibilityState === "visible" && notify();
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        window.clearTimeout(timer);
        document.removeEventListener("visibilitychange", onVisible);
      };
    },
    [ms],
  );
  const t = useSyncExternalStore(subscribe, () => Math.floor(Date.now() / ms) * ms, () => null);
  return useMemo(() => override ?? (t === null ? null : new Date(t)), [t, override]);
}

/* ------------------------------------------------------------------ */
/* Grouping                                                            */
/* ------------------------------------------------------------------ */

type Row = { event: AgendaEvent; key: string; allDay: boolean; dayIndex: number; dayCount: number };
type Group = { date: Date; key: string; rows: Row[] };

/** Events from today on, one group per day. Multi-day events appear on each day they cover. */
export function groupByDay(events: AgendaEvent[], today: Date, days: number): Group[] {
  const groups = new Map<string, Group>();
  const ensure = (d: Date) => {
    const k = dayKey(d);
    let g = groups.get(k);
    if (!g) groups.set(k, (g = { date: d, key: k, rows: [] }));
    return g;
  };
  ensure(today);
  const horizon = addDays(today, days - 1);
  for (const ev of events) {
    const allDay = isAllDay(ev);
    const first = startOfDay(ev.start);
    const last = allDay ? lastDay(ev) : first;
    const count = diffDays(first, last) + 1;
    for (let i = 0; i < count; i++) {
      const d = addDays(first, i);
      if (cmpDay(d, today) < 0 || cmpDay(d, horizon) > 0) continue;
      ensure(d).rows.push({ event: ev, key: count > 1 ? `${ev.id}@${dayKey(d)}` : ev.id, allDay, dayIndex: i + 1, dayCount: count });
    }
  }
  return [...groups.values()]
    .sort((a, b) => cmpDay(a.date, b.date))
    .map((g) => ({
      ...g,
      rows: g.rows.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.event.start.getTime() - b.event.start.getTime() || a.event.end.getTime() - b.event.end.getTime()),
    }));
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export type AgendaProps = Omit<React.ComponentProps<"div">, "children" | "title"> & {
  events: AgendaEvent[];
  /** Heading shown above the list, with the time beside it. */
  title?: React.ReactNode;
  /** How many days ahead to list, today included. */
  days?: number;
  /** Minutes before the start when Join becomes the primary action. */
  joinLeadMinutes?: number;
  /** Called when Join is pressed. Call event.preventDefault() to handle the link yourself. */
  onJoin?: (event: AgendaEvent, e: React.MouseEvent<HTMLAnchorElement>) => void;
  onEventClick?: (event: AgendaEvent) => void;
  /** Shows a New event action in the empty state. */
  onCreate?: () => void;
  loading?: boolean;
  locale?: string;
  /** Pin the clock for tests and screenshots. */
  now?: Date;
  labels?: { today?: string; tomorrow?: string; now?: string; join?: string; joinNow?: string; empty?: string; nothingElse?: string; newEvent?: string };
};

type JoinState = "none" | "idle" | "soon" | "live";

export function Agenda({
  events,
  title,
  days = 14,
  joinLeadMinutes = 5,
  onJoin,
  onEventClick,
  onCreate,
  loading = false,
  locale: localeProp,
  now: nowProp,
  labels,
  className,
  ...rest
}: AgendaProps) {
  const L = {
    today: "Today",
    tomorrow: "Tomorrow",
    now: "Now",
    join: "Join",
    joinNow: "Join now",
    empty: "No upcoming events",
    nothingElse: "Nothing else today",
    newEvent: "New event",
    ...labels,
  };
  const reduce = !!useReducedMotion();
  const locale = useLocale(localeProp);
  const lead = joinLeadMinutes * 60000;

  // Tick every second only while a Join countdown is on screen; otherwise once a minute.
  const minute = useClock(60000, nowProp);
  const counting = useMemo(() => {
    if (!minute) return false;
    const t = minute.getTime();
    return events.some((e) => e.meetingUrl && e.start.getTime() - t <= lead + 60000 && e.start.getTime() - t > -60000);
  }, [events, minute, lead]);
  const [visible, setVisible] = useState(true);
  const second = useClock(counting && visible ? 1000 : 60000, nowProp);
  const now = second ?? minute;
  const today = useMemo(() => (now ? startOfDay(now) : null), [now]);
  const nowMs = now?.getTime() ?? 0;

  const fmt = useMemo(() => {
    const make = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, o);
    return {
      weekday: make({ weekday: "long" }),
      date: make({ month: "short", day: "numeric" }),
      time: make({ hour: "numeric", minute: "2-digit" }),
      long: make({ weekday: "long", day: "numeric", month: "long" }),
    };
  }, [locale]);

  const groups = useMemo(() => (today && !loading ? groupByDay(events, today, days) : null), [events, today, days, loading]);
  const upcomingCount = useMemo(() => {
    const ids = new Set<string>();
    for (const g of groups ?? []) for (const r of g.rows) if (r.event.end.getTime() > nowMs && r.event.status !== "canceled") ids.add(r.event.id);
    return ids.size;
  }, [groups, nowMs]);

  /* ---------- scrolling and the Now marker ---------- */
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  // State, not a ref: the marker remounts further down the list as events start, and the observer must follow it.
  const [markerEl, setMarkerEl] = useState<HTMLLIElement | null>(null);
  const [markerSide, setMarkerSide] = useState<"above" | "below" | null>(null);
  const [showEarlier, setShowEarlier] = useState(false);

  // Pause the per-second tick when the list is off screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const marker = markerEl;
    if (!scroller || !marker) return;
    // Today is always the first group and finished events fold away, so the list opens at now by itself.
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) return setMarkerSide(null);
        setMarkerSide(e.boundingClientRect.top < (e.rootBounds?.top ?? 0) + 40 ? "above" : "below");
      },
      { root: scroller, rootMargin: "-36px 0px 0px 0px" },
    );
    io.observe(marker);
    return () => io.disconnect();
  }, [markerEl]);

  const jumpToNow = () => {
    const scroller = scrollerRef.current;
    // Land on the call in progress if there is one, so it isn't hidden just above the marker.
    const target = scroller?.querySelector<HTMLElement>("[data-live]") ?? markerEl;
    if (!scroller || !target) return;
    scroller.scrollTo({ top: Math.max(0, target.offsetTop - 44), behavior: reduce ? "auto" : "smooth" });
  };

  /* ---------- keyboard: arrows and j/k between rows ---------- */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowDown", "ArrowUp", "j", "k", "Home", "End"];
    if (!keys.includes(e.key) || e.metaKey || e.ctrlKey || e.altKey) return;
    // Folded-away earlier events are inert, so they're skipped.
    const rows = [...(scrollerRef.current?.querySelectorAll<HTMLElement>("[data-agenda-row]") ?? [])].filter((r) => !r.closest("[inert]"));
    const i = rows.indexOf(document.activeElement as HTMLElement);
    if (i === -1 && !(e.target as HTMLElement).closest("[data-agenda-row], [data-join]")) return;
    e.preventDefault();
    const from = i === -1 ? rows.indexOf((e.target as HTMLElement).closest("li")?.querySelector<HTMLElement>("[data-agenda-row]") ?? rows[0]) : i;
    const next = e.key === "Home" ? 0 : e.key === "End" ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, from + (e.key === "ArrowDown" || e.key === "j" ? 1 : -1)));
    rows[next]?.focus();
    rows[next]?.scrollIntoView({ block: "nearest" });
  };

  const joinState = (e: AgendaEvent): JoinState => {
    if (!e.meetingUrl || e.status === "canceled" || !now) return "none";
    const s = e.start.getTime();
    const end = e.end.getTime();
    if (nowMs >= end) return "none";
    if (nowMs >= s) return "live";
    if (s - nowMs <= lead) return "soon";
    return "idle";
  };

  const dayLabel = (d: Date) => {
    if (!today) return "";
    const diff = diffDays(today, d);
    return diff === 0 ? L.today : diff === 1 ? L.tomorrow : fmt.weekday.format(d);
  };

  return (
    <div
      ref={rootRef}
      data-slot="agenda"
      className={cn("relative flex min-h-[320px] min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]", className)}
      onKeyDown={onKeyDown}
      {...rest}
    >
      {title && (
        <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
          <h2 className="truncate text-[14px] font-medium tracking-[-0.015em] text-fg">{title}</h2>
          <span className="shrink-0 text-[12px] text-fg-3 tabular" suppressHydrationWarning>
            {now ? `${upcomingCount === 0 ? "Nothing" : upcomingCount === 1 ? "1 event" : `${upcomingCount} events`} ahead` : ""}
          </span>
        </div>
      )}

      <div ref={scrollerRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-busy={loading || !now || undefined}>
        {!groups ? (
          <Skeleton />
        ) : upcomingCount === 0 && groups.every((g) => g.rows.length === 0) ? (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="grid size-9 place-items-center rounded-full bg-hover text-fg-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="2.5" y="3.25" width="11" height="10.25" rx="1.75" />
                <path d="M2.5 6.5h11M5.5 2v2.5M10.5 2v2.5" />
              </svg>
            </span>
            <p className="text-[13px] text-fg-2">{L.empty}</p>
            {onCreate && (
              <button type="button" onClick={onCreate} className={cn(btn, "gap-1.5 bg-fg px-3 text-frame hover:bg-fg/90")}>
                <Plus size={14} />
                {L.newEvent}
              </button>
            )}
          </div>
        ) : (
          groups.map((g) => {
            const isToday = today && cmpDay(g.date, today) === 0;
            const past = isToday ? g.rows.filter((r) => !r.allDay && r.event.end.getTime() <= nowMs) : [];
            const current = isToday ? g.rows.filter((r) => r.allDay || r.event.end.getTime() > nowMs) : g.rows;
            // The marker sits before the first event that hasn't started; in-progress events stay above it.
            const markerAt = isToday ? current.findIndex((r) => !r.allDay && r.event.start.getTime() > nowMs) : -1;
            const nextUp = markerAt >= 0 ? current[markerAt] : null;
            if (!isToday && g.rows.length === 0) return null;
            return (
              <section key={g.key} aria-labelledby={`agenda-${g.key}`}>
                <h3
                  id={`agenda-${g.key}`}
                  className="sticky top-0 z-[2] flex h-9 items-baseline gap-2 border-b border-line bg-raised px-4 pt-2.5"
                >
                  <span className={cn("text-[12.5px] font-medium", isToday ? "text-fg" : "text-fg-2")}>{dayLabel(g.date)}</span>
                  <span className="text-[12px] text-fg-3 tabular">{fmt.date.format(g.date)}</span>
                </h3>
                <ul className="flex flex-col py-1">
                  {past.length > 0 && (
                    <li>
                      <button
                        type="button"
                        onClick={() => setShowEarlier((s) => !s)}
                        aria-expanded={showEarlier}
                        className="flex h-8 w-full items-center gap-1.5 px-4 text-left text-[12px] text-fg-3 outline-none transition-colors duration-150 hover:text-fg focus-visible:bg-hover"
                      >
                        <ChevronDown size={14} className={cn("transition-transform duration-200 ease-out-expo", !showEarlier && "-rotate-90")} />
                        {showEarlier ? "Hide" : "Show"} {past.length === 1 ? "1 earlier event" : `${past.length} earlier events`}
                      </button>
                      <div className={cn("grid transition-[grid-template-rows] duration-250 ease-in-out-quart motion-reduce:transition-none", showEarlier ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                        <ul className="min-h-0 overflow-hidden" inert={!showEarlier}>
                          {past.map((r) => (
                            <AgendaRow key={r.key} row={r} state="past" join="none" now={nowMs} fmt={fmt} L={L} reduce={reduce} onJoin={onJoin} onEventClick={onEventClick} />
                          ))}
                        </ul>
                      </div>
                    </li>
                  )}
                  {current.map((r, i) => {
                    const live = !r.allDay && r.event.start.getTime() <= nowMs && r.event.end.getTime() > nowMs;
                    return (
                      <FragmentWithMarker
                        key={r.key}
                        marker={i === markerAt ? <NowMarker ref={setMarkerEl} label={L.now} time={now ? fmt.time.format(now) : ""} /> : null}
                      >
                        <AgendaRow
                          row={r}
                          state={live ? "live" : r === nextUp ? "next" : "upcoming"}
                          join={joinState(r.event)}
                          now={nowMs}
                          fmt={fmt}
                          L={L}
                          reduce={reduce}
                          onJoin={onJoin}
                          onEventClick={onEventClick}
                        />
                      </FragmentWithMarker>
                    );
                  })}
                  {isToday && markerAt === -1 && (
                    <>
                      <NowMarker ref={setMarkerEl} label={L.now} time={now ? fmt.time.format(now) : ""} />
                      {!current.some((r) => !r.allDay && r.event.end.getTime() > nowMs) && <li className="px-4 pb-2 pl-[84px] text-[12.5px] text-fg-3">{L.nothingElse}</li>}
                    </>
                  )}
                </ul>
              </section>
            );
          })
        )}
      </div>

      {/* When Now scrolls out of view, a pill brings it back from the side it went. */}
      <AnimatePresence>
        {markerSide && (
          <motion.button
            key="jump"
            type="button"
            onClick={jumpToNow}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: markerSide === "above" ? -6 : 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={reduce ? { duration: 0.15 } : spring.pop}
            className={cn(
              "absolute left-1/2 z-[3] -ml-9 flex h-7 w-[72px] items-center justify-center gap-1 rounded-full border border-line-2 bg-raised text-[12px] font-medium text-fg shadow-pop select-none",
              "outline-none transition-[background-color,scale] duration-150 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.96]",
              markerSide === "above" ? (title ? "top-[92px]" : "top-11") : "bottom-3",
            )}
          >
            {markerSide === "above" ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
            {L.now}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function FragmentWithMarker({ marker, children }: { marker: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      {marker}
      {children}
    </>
  );
}

const btn = cn(
  "inline-flex h-7 shrink-0 items-center justify-center rounded-md text-[12.5px] font-medium select-none",
  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
  "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.97] active:duration-75",
);

function NowMarker({ ref, label, time }: { ref: React.Ref<HTMLLIElement>; label: string; time: string }) {
  return (
    <li ref={ref} aria-label={`${label}, ${time}`} className="relative flex h-6 scroll-mt-10 items-center gap-2 pl-4 pr-4">
      <span className="w-[56px] shrink-0 font-mono text-2xs uppercase tracking-[0.08em] text-fg">{label}</span>
      <span aria-hidden className="relative h-px flex-1 bg-fg/70">
        <span className="absolute -left-[3px] -top-[3px] size-[7px] rounded-full bg-fg" />
      </span>
      <span className="shrink-0 text-[11px] text-fg-2 tabular" suppressHydrationWarning>
        {time}
      </span>
    </li>
  );
}

type RowState = "past" | "live" | "next" | "upcoming";
type Fmt = { time: Intl.DateTimeFormat; long: Intl.DateTimeFormat };

const toneDot: Record<EventTone, string> = { neutral: "bg-fg-3", info: "bg-info", success: "bg-success", warning: "bg-warning", danger: "bg-danger" };

function AgendaRow({
  row,
  state,
  join,
  now,
  fmt,
  L,
  reduce,
  onJoin,
  onEventClick,
}: {
  row: Row;
  state: RowState;
  join: JoinState;
  now: number;
  fmt: Fmt;
  L: { join: string; joinNow: string };
  reduce: boolean;
  onJoin?: AgendaProps["onJoin"];
  onEventClick?: AgendaProps["onEventClick"];
}) {
  const e = row.event;
  const tone = e.tone ?? "neutral";
  const mins = Math.round((e.end.getTime() - e.start.getTime()) / 60000);
  const tentative = e.status === "tentative";
  const canceled = e.status === "canceled";
  const startsIn = Math.max(0, e.start.getTime() - now);
  const endsIn = Math.max(0, e.end.getTime() - now);
  const progress = state === "live" ? Math.min(1, (now - e.start.getTime()) / Math.max(1, e.end.getTime() - e.start.getTime())) : 0;
  const rel =
    state === "live"
      ? `Ends in ${duration(Math.max(1, Math.ceil(endsIn / 60000)))}`
      : state === "next" && startsIn < 864e5 && join !== "soon"
        ? startsIn < 60000
          ? "Starting now"
          : `In ${duration(Math.ceil(startsIn / 60000))}`
        : "";
  const meta = [row.allDay && row.dayCount > 1 ? `Day ${row.dayIndex} of ${row.dayCount}` : "", e.location, e.detail, tentative ? "Tentative" : canceled ? "Canceled" : ""].filter(Boolean).join(" · ");
  const label = `${e.title}, ${row.allDay ? "all day" : fmt.time.formatRange(e.start, e.end)}${meta ? `, ${meta}` : ""}${rel ? `, ${rel.toLowerCase()}` : ""}`;

  return (
    <li data-live={state === "live" || undefined} className={cn("group/row relative isolate flex items-start gap-3 px-4 py-2", state === "past" && "opacity-55")}>
      <div className="w-[56px] shrink-0 pt-px tabular">
        {row.allDay ? (
          <span className="text-[12px] text-fg-3">All day</span>
        ) : (
          <>
            <span className={cn("block text-[12px]", state === "live" ? "font-medium text-fg" : "text-fg-2")}>{fmt.time.format(e.start)}</span>
            <span className="block text-[11px] text-fg-4">{duration(mins)}</span>
          </>
        )}
      </div>
      <span aria-hidden className={cn("mt-[3px] w-[3px] shrink-0 self-stretch rounded-full", tentative ? "border border-dashed border-fg-4" : toneDot[tone], canceled && "opacity-40")} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          data-agenda-row
          aria-label={label}
          onClick={() => onEventClick?.(e)}
          className={cn(
            "line-clamp-2 max-w-full text-left text-[13px] font-medium leading-[18px] tracking-[-0.005em] text-fg outline-none [overflow-wrap:anywhere]",
            // The whole row is the target; the Join button sits above it.
            "after:absolute after:inset-x-1.5 after:inset-y-0.5 after:-z-10 after:rounded-lg after:transition-colors after:duration-150 hover:after:bg-fg/[0.035] focus-visible:after:bg-hover focus-visible:after:shadow-[inset_0_0_0_1px_var(--line-2)] active:after:bg-fg/[0.06]",
            canceled && "text-fg-3 line-through decoration-fg-4",
          )}
        >
          {e.title}
        </button>
        {(meta || rel) && (
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] leading-4 text-fg-3">
            {rel && (
              <span className={cn("shrink-0 tabular", state === "live" ? "text-fg" : "text-fg-2")} suppressHydrationWarning>
                {rel}
              </span>
            )}
            {rel && meta && <span className="text-fg-4">·</span>}
            {meta && <span className="truncate">{meta}</span>}
          </p>
        )}
        {state === "live" && (
          <span aria-hidden className="mt-2 block h-[2px] overflow-hidden rounded-full bg-fg/10">
            <span className="block h-full origin-left rounded-full bg-fg/60 transition-transform duration-1000 ease-linear motion-reduce:transition-none" style={{ transform: `scaleX(${progress})` }} />
          </span>
        )}
      </div>
      {join !== "none" && <JoinButton event={e} state={join} startsIn={startsIn} reduce={reduce} L={L} onJoin={onJoin} />}
    </li>
  );
}

/**
 * Quiet until it matters: a camera icon while the call is far off. Five minutes out
 * it grows into a filled Join with a countdown; once the call starts it says Join now
 * with a live dot. The width change springs, so the row never jumps.
 */
function JoinButton({
  event,
  state,
  startsIn,
  reduce,
  L,
  onJoin,
}: {
  event: AgendaEvent;
  state: Exclude<JoinState, "none">;
  startsIn: number;
  reduce: boolean;
  L: { join: string; joinNow: string };
  onJoin?: AgendaProps["onJoin"];
}) {
  const prominent = state !== "idle";
  const secs = Math.ceil(startsIn / 1000);
  const t = reduce ? { duration: 0 } : spring.snappy;
  return (
    <motion.a
      data-join
      href={event.meetingUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${state === "live" ? L.joinNow : L.join} ${event.title}${state === "soon" ? `, starts in ${Math.floor(secs / 60)} minutes ${secs % 60} seconds` : ""}`}
      title={state === "idle" ? `${L.join} call` : undefined}
      onClick={(e) => onJoin?.(event, e)}
      layout
      // One nudge as it turns prominent: something changed while you weren't looking.
      animate={prominent && !reduce ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      whileTap={reduce ? undefined : { scale: 0.95 }}
      transition={{ layout: t, scale: { duration: 0.42, ease: ease.out } }}
      style={{ borderRadius: 7 }}
      data-state={state}
      className={cn(
        "relative z-[1] mt-px inline-flex h-7 shrink-0 items-center justify-center gap-1.5 overflow-hidden border text-[12px] font-medium whitespace-nowrap select-none",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color,border-color,color] duration-300 ease-out",
        "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
        prominent ? "border-transparent bg-fg px-2.5 text-frame hover:bg-fg/90" : "w-7 border-line-2 text-fg-3 hover:border-fg-4 hover:bg-hover hover:text-fg",
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {state === "idle" ? (
          <motion.svg
            key="icon"
            layout="position"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.1 } }}
            transition={t}
          >
            <rect x="1.75" y="4" width="9" height="8" rx="1.75" />
            <path d="m10.75 7 3.5-2v6l-3.5-2" />
          </motion.svg>
        ) : (
          <motion.span
            key="label"
            layout="position"
            className="flex items-center gap-1.5"
            initial={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(2px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.2, ease: ease.out }}
          >
            {state === "live" && (
              <span aria-hidden className="relative grid size-1.5 place-items-center">
                <span className="absolute inset-0 rounded-full bg-success animate-ping-soft motion-reduce:animate-none" />
                <span className="relative size-1.5 rounded-full bg-success" />
              </span>
            )}
            {state === "live" ? L.joinNow : L.join}
            {state === "soon" && (
              <span aria-hidden className="flex items-center font-normal opacity-70 tabular">
                <NumberFlowGroup>
                  <NumberFlow value={Math.floor(secs / 60)} animated={!reduce} />
                  <span>:</span>
                  <NumberFlow value={secs % 60} format={{ minimumIntegerDigits: 2 }} animated={!reduce} trend={-1} />
                </NumberFlowGroup>
              </span>
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.a>
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      {[3, 2].map((n, g) => (
        <div key={g}>
          <div className="flex h-9 items-end border-b border-line px-4 pb-2.5">
            <span className="h-2.5 w-24 rounded bg-fg/[0.07]" />
          </div>
          <div className="flex flex-col py-1">
            {Array.from({ length: n }, (_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2 animate-pulse-soft motion-reduce:animate-none">
                <span className="mt-1 h-2.5 w-11 rounded bg-fg/[0.07]" />
                <span className="h-8 w-[3px] rounded-full bg-fg/[0.07]" />
                <span className="flex flex-1 flex-col gap-2 pt-1">
                  <span className="h-2.5 rounded bg-fg/[0.08]" style={{ width: `${[62, 48, 70, 55, 40][(g * 3 + i) % 5]}%` }} />
                  <span className="h-2 w-1/3 rounded bg-fg/[0.05]" />
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
