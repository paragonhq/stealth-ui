"use client";
import { Popover } from "@base-ui/react/popover";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type EventTone = "neutral" | "info" | "success" | "warning" | "danger";

export type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  /** Exclusive. An all-day event on the 24th ends at 00:00 on the 25th. */
  end: Date;
  allDay?: boolean;
  location?: string;
  description?: string;
  /** Meaning only: a deadline, an outage, a launch. Leave neutral for ordinary meetings. */
  tone?: EventTone;
  status?: "confirmed" | "tentative" | "canceled";
};

/* ------------------------------------------------------------------ */
/* Plain-date helpers. Local midnight everywhere; day math goes        */
/* through calendar fields, never milliseconds, so DST can't bite.     */
/* ------------------------------------------------------------------ */

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
function addMonths(d: Date, n: number) {
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), daysIn(first.getFullYear(), first.getMonth())));
}
const dayNum = (d: Date) => d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
const cmpDay = (a: Date, b: Date) => dayNum(a) - dayNum(b);
const sameDay = (a: Date | null | undefined, b: Date | null | undefined) => !!a && !!b && dayNum(a) === dayNum(b);
const diffDays = (a: Date, b: Date) =>
  Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5);
const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();
const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const SUNDAY_REGIONS = new Set("AG AS BD BR BS BT BW BZ CA CN CO DM DO ET GT GU HK HN ID IL IN JM JP KE KH KR LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PT PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW".split(" "));
const SATURDAY_REGIONS = new Set("AE AF BH DJ DZ EG IQ IR JO KW LY OM QA SD SY".split(" "));
function weekStartFor(locale: string): number {
  try {
    const l = new Intl.Locale(locale) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
    const info = l.getWeekInfo?.() ?? l.weekInfo;
    if (info) return info.firstDay % 7;
    const region = l.maximize().region ?? "";
    return SUNDAY_REGIONS.has(region) ? 0 : SATURDAY_REGIONS.has(region) ? 6 : 1;
  } catch {
    return 0;
  }
}

/* Today and the viewer's language only exist in the browser. Both read null /  */
/* en-US during the server render and settle on hydration without a mismatch.   */

function subscribeToday(notify: () => void) {
  let timer = 0;
  const arm = () => {
    const now = new Date();
    timer = window.setTimeout(() => (notify(), arm()), addDays(startOfDay(now), 1).getTime() - now.getTime() + 50);
  };
  arm();
  const onVisible = () => document.visibilityState === "visible" && notify();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
function useToday(override?: Date) {
  const key = useSyncExternalStore(subscribeToday, () => dayKey(new Date()), () => null);
  return useMemo(() => (override ? startOfDay(override) : key ? fromKey(key) : null), [key, override]);
}
function subscribeLanguage(notify: () => void) {
  window.addEventListener("languagechange", notify);
  return () => window.removeEventListener("languagechange", notify);
}
const useLocale = (locale?: string) => {
  const browser = useSyncExternalStore(subscribeLanguage, () => navigator.language, () => "en-US");
  return locale ?? browser;
};

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/* ------------------------------------------------------------------ */
/* Layout: which lane each event takes inside a week row               */
/* ------------------------------------------------------------------ */

type Item = { ev: CalendarEvent; first: Date; last: Date; bar: boolean; draft: boolean };

/** Days an event touches. Timed events live on their start day unless they last a full day or more. */
function toItem(ev: CalendarEvent, draft = false): Item {
  const first = startOfDay(ev.start);
  const endMs = Math.max(ev.end.getTime(), ev.start.getTime());
  const long = ev.allDay || endMs - ev.start.getTime() >= 864e5;
  let last = long ? startOfDay(new Date(endMs - 1)) : first;
  if (cmpDay(last, first) < 0) last = first;
  return { ev, first, last, bar: !!long, draft };
}

export type WeekSegment = {
  event: CalendarEvent;
  /** First and last column this segment covers in the week, 0–6. */
  from: number;
  to: number;
  lane: number;
  bar: boolean;
  draft: boolean;
  /** The event started before this week, or carries on after it. */
  continuesBefore: boolean;
  continuesAfter: boolean;
};

export type WeekLayout = { visible: WeekSegment[]; hidden: number[]; perDay: CalendarEvent[][] };

/**
 * Packs a week's events into lanes. Multi-day bars claim the top lanes, then
 * timed events stack beneath in start order. When a day has more than fits,
 * the last lane is given to a "+N more" count instead of a chip.
 */
export function layoutWeek(weekStart: Date, events: CalendarEvent[], lanes: number, draft?: CalendarEvent | null): WeekLayout {
  const weekEnd = addDays(weekStart, 6);
  const items = events.map((e) => toItem(e));
  if (draft) items.push(toItem(draft, true));
  const segs: WeekSegment[] = [];
  const perDay: CalendarEvent[][] = Array.from({ length: 7 }, () => []);
  for (const it of items) {
    if (cmpDay(it.last, weekStart) < 0 || cmpDay(it.first, weekEnd) > 0) continue;
    const from = Math.max(0, diffDays(weekStart, it.first));
    const to = Math.min(6, diffDays(weekStart, it.last));
    segs.push({ event: it.ev, from, to, lane: 0, bar: it.bar, draft: it.draft, continuesBefore: cmpDay(it.first, weekStart) < 0, continuesAfter: cmpDay(it.last, weekEnd) > 0 });
    if (!it.draft) for (let c = from; c <= to; c++) perDay[c].push(it.ev);
  }
  const rank = (s: WeekSegment) => (s.bar ? 0 : s.draft ? 1 : 2);
  segs.sort(
    (x, y) =>
      rank(x) - rank(y) ||
      x.from - y.from ||
      (x.bar ? y.to - y.from - (x.to - x.from) : 0) ||
      x.event.start.getTime() - y.event.start.getTime() ||
      y.event.end.getTime() - x.event.end.getTime(),
  );
  const occupied: boolean[][] = [];
  for (const s of segs) {
    for (let lane = 0; ; lane++) {
      const row = (occupied[lane] ??= Array(7).fill(false));
      let free = true;
      for (let c = s.from; c <= s.to && free; c++) free = !row[c];
      if (!free) continue;
      for (let c = s.from; c <= s.to; c++) row[c] = true;
      s.lane = lane;
      break;
    }
  }
  const counts = Array(7).fill(0);
  for (const s of segs) for (let c = s.from; c <= s.to; c++) counts[c]++;
  const limit = counts.map((n) => (n <= lanes ? lanes : Math.max(0, lanes - 1)));
  const hidden = Array(7).fill(0);
  const visible: WeekSegment[] = [];
  for (const s of segs) {
    let cap = Infinity;
    for (let c = s.from; c <= s.to; c++) cap = Math.min(cap, limit[c]);
    if (s.lane < cap) visible.push(s);
    else if (s.draft) visible.push({ ...s, lane: Math.max(0, lanes - 1) });
    else for (let c = s.from; c <= s.to; c++) hidden[c]++;
  }
  for (const d of perDay) d.sort((a, b) => Number(!!b.allDay) - Number(!!a.allDay) || a.start.getTime() - b.start.getTime());
  return { visible, hidden, perDay };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export type EventCalendarProps = Omit<React.ComponentProps<"div">, "children" | "defaultValue" | "onChange"> & {
  events?: CalendarEvent[];
  defaultEvents?: CalendarEvent[];
  onEventsChange?: (events: CalendarEvent[]) => void;
  /** Called with the new event after it is created from a day. */
  onEventCreate?: (event: CalendarEvent) => void;
  /** Called when an event's details are opened. */
  onEventClick?: (event: CalendarEvent) => void;
  /** The visible month (controlled). Any date inside it. */
  month?: Date;
  defaultMonth?: Date;
  onMonthChange?: (month: Date) => void;
  /** BCP 47 tag. Defaults to the browser's language; drives names, times and the week start. */
  locale?: string;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Skeleton chips while events load. The grid and navigation stay usable. */
  loading?: boolean;
  /** Browse and open events, but no creating. */
  readOnly?: boolean;
  /** Always draw six weeks. Off by default, so a five-week month gets taller rows and more room per day. */
  fixedWeeks?: boolean;
  /** Pin "today" for tests and screenshots. Defaults to the real date. */
  today?: Date;
  labels?: { today?: string; previousMonth?: string; nextMonth?: string; newEvent?: string; create?: string; titlePlaceholder?: string };
};

const HEAD = 26; // day number row
const CHIP = 20;
const GAP = 2;
const COMPACT_BELOW = 480;

type Slide = { dir: number; instant: boolean; reduce: boolean };
const gridVariants = {
  enter: (c: Slide) => (c.instant ? { opacity: 1, x: 0 } : { opacity: 0, x: c.reduce ? 0 : c.dir * 24 }),
  center: (c: Slide) => ({ opacity: 1, x: 0, transition: { duration: c.instant ? 0 : c.reduce ? 0.15 : 0.28, ease: ease.out } }),
  exit: (c: Slide) =>
    c.instant ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: c.reduce ? 0 : c.dir * -24, transition: { duration: c.reduce ? 0.1 : 0.18, ease: ease.out } },
};
const titleVariants = {
  enter: (c: Slide) => (c.instant ? { opacity: 1, y: 0 } : { opacity: 0, y: c.reduce ? 0 : c.dir * 8, filter: c.reduce ? "blur(0px)" : "blur(2px)" }),
  center: (c: Slide) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: c.instant ? 0 : 0.24, ease: ease.out } }),
  exit: (c: Slide) =>
    c.instant ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: c.reduce ? 0 : c.dir * -8, filter: c.reduce ? "blur(0px)" : "blur(2px)", transition: { duration: 0.14, ease: ease.in } },
};

// A just-created event lands with a hairline ring that fades, so the eye finds it.
const LAND_CSS = "@keyframes stealth-ec-land{from{box-shadow:inset 0 0 0 1px var(--fg-3)}to{box-shadow:inset 0 0 0 1px transparent}}";

const toneDot: Record<EventTone, string> = { neutral: "bg-fg-3", info: "bg-info", success: "bg-success", warning: "bg-warning", danger: "bg-danger" };
const toneBar: Record<EventTone, string> = {
  neutral: "bg-fg/[0.07] before:bg-fg-3",
  info: "bg-info-soft before:bg-info",
  success: "bg-success-soft before:bg-success",
  warning: "bg-warning-soft before:bg-warning",
  danger: "bg-danger-soft before:bg-danger",
};

type Panel = { kind: "day"; date: Date } | { kind: "event"; event: CalendarEvent };

export function EventCalendar({
  events: eventsProp,
  defaultEvents = [],
  onEventsChange,
  onEventCreate,
  onEventClick,
  month: monthProp,
  defaultMonth,
  onMonthChange,
  locale: localeProp,
  weekStartsOn,
  loading = false,
  readOnly = false,
  fixedWeeks = false,
  today: todayProp,
  labels,
  className,
  ref,
  ...rest
}: EventCalendarProps) {
  const L = {
    today: "Today",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    newEvent: "New event",
    create: "Create event",
    titlePlaceholder: "Add title",
    ...labels,
  };
  const reduce = !!useReducedMotion();
  const locale = useLocale(localeProp);
  const today = useToday(todayProp);
  const ws = weekStartsOn ?? weekStartFor(locale);
  const uid = useId();

  const [events, setEvents] = useControllableState({ value: eventsProp, defaultValue: defaultEvents, onChange: onEventsChange });
  const [monthState, setMonthState] = useControllableState<Date | null>({
    value: monthProp,
    defaultValue: defaultMonth ?? null,
    onChange: (m) => m && onMonthChange?.(m),
  });
  const month = monthState ? startOfMonth(monthState) : today ? startOfMonth(today) : null;
  const [slide, setSlide] = useState<Slide>({ dir: 1, instant: true, reduce });


  // Focus: one roving day, moved by arrow keys.
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const cellRefs = useRef(new Map<string, HTMLDivElement>());
  const wantFocus = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  // Popovers: one for a day's list or an event's details, one for creating.
  const [panel, setPanel] = useState<{ open: boolean; value: Panel | null; anchor: Element | null }>({ open: false, value: null, anchor: null });
  const [draft, setDraft] = useState<{ date: Date; title: string; cell: HTMLElement | null } | null>(null);
  const [draftEl, setDraftEl] = useState<HTMLElement | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  const landTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(landTimer.current), []);
  const suppressClick = useRef(false);
  // Popovers stay inside the calendar instead of spilling over the page.
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const setRoot = useCallback(
    (el: HTMLDivElement | null) => {
      setRootEl(el);
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );

  const fmt = useMemo(() => {
    const make = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, o);
    return {
      month: make({ month: "long" }),
      year: make({ year: "numeric" }),
      weekday: make({ weekday: "short" }),
      narrow: make({ weekday: "narrow" }),
      dayNum: make({ day: "numeric" }),
      long: make({ weekday: "long", day: "numeric", month: "long" }),
      longYear: make({ weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      weekdayLong: make({ weekday: "long" }),
      dayMonth: make({ day: "numeric", month: "short" }),
      time: make({ hour: "numeric", minute: "2-digit" }),
      hour: make({ hour: "numeric" }),
    };
  }, [locale]);
  const shortTime = useCallback((d: Date) => (d.getMinutes() ? fmt.time : fmt.hour).format(d), [fmt]);
  const when = useCallback(
    (e: CalendarEvent) => {
      const item = toItem(e);
      if (e.allDay) return sameDay(item.first, item.last) ? "All day" : fmt.dayMonth.formatRange(item.first, item.last);
      if (item.bar) return `${fmt.dayMonth.format(e.start)}, ${shortTime(e.start)} – ${fmt.dayMonth.format(e.end)}, ${shortTime(e.end)}`;
      return fmt.time.formatRange(e.start, e.end);
    },
    [fmt, shortTime],
  );

  const weeks = useMemo(() => {
    if (!month) return null;
    const lead = (month.getDay() - ws + 7) % 7;
    const start = addDays(month, -lead);
    const count = fixedWeeks ? 6 : Math.ceil((lead + daysIn(month.getFullYear(), month.getMonth())) / 7);
    return Array.from({ length: count }, (_, w) => addDays(start, w * 7));
  }, [month, ws, fixedWeeks]);
  const rows = weeks?.length ?? 5;

  const [bodyRef, body] = useSize<HTMLDivElement>();
  const compact = body.w > 0 && body.w < COMPACT_BELOW;
  const lanes = body.h ? Math.max(1, Math.floor((body.h / rows - HEAD - 2 + GAP) / (CHIP + GAP))) : 2;
  const wide = body.w === 0 || body.w / 7 >= 118;

  const draftEvent = useMemo<CalendarEvent | null>(
    () => (draft ? { id: "__draft", title: draft.title, start: draft.date, end: addDays(draft.date, 1), allDay: true } : null),
    [draft],
  );
  const layouts = useMemo(
    () => (weeks ? weeks.map((w) => layoutWeek(w, loading ? [] : events, lanes, draftEvent)) : null),
    [weeks, events, lanes, draftEvent, loading],
  );
  const monthCount = useMemo(() => {
    if (!month) return 0;
    const end = addMonths(month, 1);
    return events.filter((e) => e.start < end && e.end > month).length;
  }, [events, month]);

  const tabbableKey = useMemo(() => {
    if (!month) return null;
    const inMonth = (k: string | null) => k && monthIndex(fromKey(k)) === monthIndex(month);
    if (inMonth(focusKey)) return focusKey!;
    if (today && monthIndex(today) === monthIndex(month)) return dayKey(today);
    return dayKey(month);
  }, [focusKey, month, today]);

  // After keyboard navigation re-renders the grid, put focus on the new day.
  useEffect(() => {
    if (!wantFocus.current || !tabbableKey) return;
    wantFocus.current = false;
    cellRefs.current.get(tabbableKey)?.focus();
  }, [tabbableKey, month]);

  const goMonth = (next: Date, instant = false) => {
    if (!month) return;
    const n = startOfMonth(next);
    if (monthIndex(n) === monthIndex(month)) return;
    setSlide({ dir: monthIndex(n) > monthIndex(month) ? 1 : -1, instant, reduce });
    setDraft(null);
    setPanel((p) => ({ ...p, open: false }));
    setMonthState(n);
  };

  const moveFocus = (to: Date) => {
    wantFocus.current = true;
    setFocusKey(dayKey(to));
    if (month && monthIndex(to) !== monthIndex(month)) goMonth(to, true);
  };

  const openDay = (date: Date, anchor: Element) => {
    returnFocus.current = cellRefs.current.get(dayKey(date)) ?? null;
    setFocusKey(dayKey(date));
    setPanel({ open: true, value: { kind: "day", date }, anchor });
  };
  const openEvent = (event: CalendarEvent, anchor: Element) => {
    returnFocus.current = cellRefs.current.get(dayKey(event.start)) ?? null;
    setPanel({ open: true, value: { kind: "event", event }, anchor });
    onEventClick?.(event);
  };
  const startDraft = (date: Date) => {
    if (readOnly) return;
    returnFocus.current = cellRefs.current.get(dayKey(date)) ?? null;
    setFocusKey(dayKey(date));
    setPanel((p) => ({ ...p, open: false }));
    setDraft({ date, title: "", cell: cellRefs.current.get(dayKey(date)) ?? null });
  };
  const commitDraft = () => {
    if (!draft || !draft.title.trim()) return;
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `evt-${draft.date.getTime()}-${events.length}`;
    const created: CalendarEvent = { id, title: draft.title.trim(), start: draft.date, end: addDays(draft.date, 1), allDay: true };
    setLanded(id);
    window.clearTimeout(landTimer.current);
    landTimer.current = window.setTimeout(() => setLanded(null), 1000);
    setEvents([...events, created]);
    onEventCreate?.(created);
    setDraft(null);
  };

  const onGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!tabbableKey || !(e.target as HTMLElement).dataset?.day) return;
    const current = fromKey(tabbableKey);
    const colOf = (d: Date) => (d.getDay() - ws + 7) % 7;
    const map: Record<string, () => Date> = {
      ArrowLeft: () => addDays(current, -1),
      ArrowRight: () => addDays(current, 1),
      ArrowUp: () => addDays(current, -7),
      ArrowDown: () => addDays(current, 7),
      Home: () => addDays(current, -colOf(current)),
      End: () => addDays(current, 6 - colOf(current)),
      PageUp: () => addMonths(current, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(current, e.shiftKey ? 12 : 1),
    };
    if (map[e.key]) {
      e.preventDefault();
      moveFocus(map[e.key]());
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDay(current, e.target as Element);
    } else if ((e.key === "n" || e.key === "c") && !e.metaKey && !e.ctrlKey && !e.altKey && !readOnly) {
      e.preventDefault();
      startDraft(current);
    }
  };

  const weekdayNames = useMemo(() => {
    const base = new Date(2026, 0, 4 + ws); // 4 Jan 2026 is a Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(base, i);
      return { short: fmt.weekday.format(d), narrow: fmt.narrow.format(d), long: fmt.weekdayLong.format(d) };
    });
  }, [fmt, ws]);

  const monthKey = month ? monthIndex(month) : -1;
  const isCurrentMonth = !!(today && month && monthIndex(today) === monthIndex(month));

  return (
    <div
      data-slot="event-calendar"
      data-compact={compact || undefined}
      className={cn("flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]", className)}
      onPointerDownCapture={() => {
        // A click that only dismisses an open popover shouldn't also start a new event.
        suppressClick.current = panel.open || !!draft;
      }}
      ref={setRoot}
      {...rest}
    >
      <style>{LAND_CSS}</style>

      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line pl-4 pr-2">
        <h2 className="relative min-w-0 flex-1 overflow-hidden text-[15px] font-medium tracking-[-0.015em]" aria-live="polite">
          <span className="invisible">September 0000</span>
          <AnimatePresence initial={false} custom={slide} mode="popLayout">
            {month && (
              <motion.span
                key={monthKey}
                custom={slide}
                variants={titleVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="absolute inset-y-0 left-0 flex items-center gap-1.5 whitespace-nowrap"
              >
                <span className="text-fg">{fmt.month.format(month)}</span>
                <span className="text-fg-3 tabular">{fmt.year.format(month)}</span>
                {!loading && monthCount === 0 && (
                  <span className="ml-1.5 hidden text-[12px] font-normal tracking-normal text-fg-4 sm:inline">No events</span>
                )}
              </motion.span>
            )}
          </AnimatePresence>
        </h2>
        <button
          type="button"
          onClick={() => {
            if (!today) return;
            if (isCurrentMonth) {
              wantFocus.current = true;
              setFocusKey(dayKey(today));
            } else goMonth(today);
          }}
          disabled={!today}
          className={cn(
            "h-7 rounded-md border border-line-2 px-2.5 text-[12px] font-medium text-fg-2 select-none",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "transition-[background-color,border-color,color,scale] duration-150 ease-out hover:border-fg-4 hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          {L.today}
        </button>
        <div className="flex items-center">
          <NavButton label={L.previousMonth} onClick={() => month && goMonth(addMonths(month, -1))} disabled={!month}>
            <ChevronLeft />
          </NavButton>
          <NavButton label={L.nextMonth} onClick={() => month && goMonth(addMonths(month, 1))} disabled={!month}>
            <ChevronRight />
          </NavButton>
        </div>
      </div>

      {/* Grid */}
      <div role="grid" aria-label={month ? `${fmt.month.format(month)} ${fmt.year.format(month)}` : undefined} aria-busy={loading || !month || undefined} aria-readonly={readOnly || undefined} className="flex min-h-0 flex-1 flex-col" onKeyDown={onGridKeyDown}>
        <div role="row" className="grid shrink-0 grid-cols-7 border-b border-line">
          {weekdayNames.map((n, i) => (
            <div key={i} role="columnheader" aria-label={n.long} className="truncate px-2 py-1.5 font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">
              {compact ? n.narrow : n.short}
            </div>
          ))}
        </div>
        <div ref={bodyRef} className="relative min-h-0 flex-1 overflow-hidden">
          <AnimatePresence initial={false} custom={slide} mode="popLayout">
            <motion.div
              key={monthKey}
              custom={slide}
              variants={gridVariants}
              initial="enter"
              animate="center"
              exit="exit"
              role="rowgroup"
              className="absolute inset-0 grid"
              style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: rows }, (_, w) => {
                const weekStart = weeks?.[w];
                const layout = layouts?.[w];
                return (
                  <div key={w} role="row" className="relative min-h-0">
                    {/* Day cells: the click target for creating, the focus target for the keyboard. */}
                    <div className="absolute inset-0 grid grid-cols-7">
                      {Array.from({ length: 7 }, (_, c) => {
                        const date = weekStart ? addDays(weekStart, c) : null;
                        if (!date || !month) return <div key={c} role="gridcell" className={cn("border-line", c < 6 && "border-r", w < rows - 1 && "border-b")} />;
                        const key = dayKey(date);
                        const outside = monthIndex(date) !== monthIndex(month);
                        const isToday = sameDay(date, today);
                        const dayEvents = layout?.perDay[c] ?? [];
                        const label = `${fmt.longYear.format(date)}${isToday ? `, ${L.today.toLowerCase()}` : ""}, ${dayEvents.length === 0 ? "no events" : dayEvents.length === 1 ? "1 event" : `${dayEvents.length} events`}`;
                        return (
                          <div
                            key={c}
                            ref={(el) => {
                              if (el) cellRefs.current.set(key, el);
                              else cellRefs.current.delete(key);
                            }}
                            role="gridcell"
                            data-day={key}
                            data-outside={outside || undefined}
                            data-today={isToday || undefined}
                            aria-label={label}
                            aria-current={isToday ? "date" : undefined}
                            tabIndex={key === tabbableKey ? 0 : -1}
                            onFocus={() => setFocusKey(key)}
                            onClick={(e) => {
                              if (suppressClick.current) return void (suppressClick.current = false);
                              if (compact) openDay(date, e.currentTarget);
                              else if (readOnly) openDay(date, e.currentTarget);
                              else startDraft(date);
                            }}
                            className={cn(
                              "group/day relative min-w-0 border-line outline-none",
                              c < 6 && "border-r",
                              w < rows - 1 && "border-b",
                              outside && "bg-page/50",
                              !readOnly && "cursor-default",
                              "transition-colors duration-150 [-webkit-tap-highlight-color:transparent] hover:bg-fg/[0.025] active:bg-fg/[0.04]",
                              "focus-visible:z-[2] focus-visible:shadow-[inset_0_0_0_1px_var(--fg-3)]",
                            )}
                          >
                            <div className={cn("flex h-[26px] items-center justify-between px-1.5", compact && "justify-center")}>
                              <span
                                className={cn(
                                  "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[12px] leading-none tabular",
                                  isToday ? "bg-fg font-medium text-frame" : outside ? "text-fg-4" : "text-fg-2",
                                  !isToday && date.getDate() === 1 && "font-medium text-fg",
                                )}
                              >
                                {date.getDate() === 1 && !compact && !isToday ? fmt.dayMonth.format(date) : fmt.dayNum.format(date)}
                              </span>
                              {!readOnly && !compact && (
                                <span aria-hidden className="grid size-5 place-items-center rounded text-fg-3 opacity-0 transition-opacity duration-150 pointer-fine:group-hover/day:opacity-100">
                                  <Plus size={12} />
                                </span>
                              )}
                            </div>
                            {compact && dayEvents.length > 0 && (
                              <div aria-hidden className="flex justify-center gap-[3px] px-1">
                                {dayEvents.slice(0, 3).map((ev) => (
                                  <span key={ev.id} className={cn("size-[5px] rounded-full", toneDot[ev.tone ?? "neutral"], ev.status === "canceled" && "opacity-40")} />
                                ))}
                                {dayEvents.length > 3 && <span className="size-[5px] rounded-full bg-fg-4" />}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Chips. A pointer layer over the cells; keyboard and screen readers reach events through the day list. */}
                    {!compact && (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 grid grid-cols-7 content-start"
                        style={{ gridTemplateRows: `${HEAD}px repeat(${lanes}, ${CHIP}px)`, rowGap: GAP }}
                      >
                        {(loading || !month) && weekStart
                          ? Array.from({ length: 7 }, (_, c) => {
                              const d = addDays(weekStart, c).getDate();
                              const n = Math.min(lanes, (d * 7 + w) % 4 === 0 ? 2 : (d * 3) % 5 === 0 ? 1 : 0);
                              return Array.from({ length: n }, (_, l) => (
                                <span
                                  key={`${c}-${l}`}
                                  className="mx-1 self-center rounded bg-fg/[0.06] animate-pulse-soft motion-reduce:animate-none"
                                  style={{ gridColumn: c + 1, gridRow: l + 2, height: 12, width: l ? "55%" : "80%" }}
                                />
                              ));
                            })
                          : null}
                        <AnimatePresence initial={false}>
                          {layout?.visible.map((s) =>
                            s.draft ? (
                              <motion.div
                                key="__draft"
                                ref={setDraftEl}
                                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, filter: "blur(2px)" }}
                                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                                transition={reduce ? { duration: 0.15 } : spring.pop}
                                className="pointer-events-auto mx-1 flex min-w-0 origin-left items-center gap-1.5 rounded-[5px] border border-dashed border-fg-4 bg-raised px-1.5 text-[11.5px] leading-none"
                                style={{ gridColumn: `${s.from + 1} / ${s.to + 2}`, gridRow: s.lane + 2 }}
                              >
                                <span className={cn("truncate", draft?.title ? "font-medium text-fg" : "text-fg-3")}>{draft?.title || L.newEvent}</span>
                              </motion.div>
                            ) : (
                              <Chip
                                key={s.event.id}
                                seg={s}
                                wide={wide}
                                reduce={reduce}
                                landed={landed === s.event.id}
                                time={s.bar ? "" : shortTime(s.event.start)}
                                onOpen={(el) => openEvent(s.event, el)}
                              />
                            ),
                          )}
                        </AnimatePresence>
                        {layout?.hidden.map((n, c) =>
                          n > 0 && !(draft && weekStart && sameDay(addDays(weekStart, c), draft.date)) ? (
                            <button
                              key={`more-${c}`}
                              type="button"
                              tabIndex={-1}
                              onClick={(e) => weekStart && openDay(addDays(weekStart, c), e.currentTarget)}
                              className={cn(
                                "pointer-events-auto mx-1 flex min-w-0 items-center rounded-[5px] px-1.5 text-left text-[11px] font-medium text-fg-3 select-none",
                                "transition-[background-color,color,scale] duration-150 hover:bg-fg/[0.06] hover:text-fg active:scale-[0.97] active:duration-75",
                              )}
                              style={{ gridColumn: c + 1, gridRow: Math.max(0, lanes - 1) + 2 }}
                            >
                              <span className="truncate tabular">+{n} more</span>
                            </button>
                          ) : null,
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Day list and event details */}
      <Popover.Root open={panel.open} onOpenChange={(open) => !open && setPanel((p) => ({ ...p, open: false }))}>
        <Popover.Portal>
          <Popover.Positioner anchor={panel.anchor} side="bottom" align="start" sideOffset={6} collisionPadding={8} collisionBoundary={rootEl ?? undefined} className="z-(--z-popover)">
            <Popover.Popup finalFocus={returnFocus} className={popupClass}>
              {panel.value?.kind === "day" && (
                <DayList
                  date={panel.value.date}
                  isToday={sameDay(panel.value.date, today)}
                  events={eventsOn(events, panel.value.date)}
                  fmt={fmt}
                  when={when}
                  readOnly={readOnly}
                  newLabel={L.newEvent}
                  onPick={(ev) => {
                    onEventClick?.(ev);
                    setPanel((p) => ({ ...p, open: false }));
                  }}
                  onNew={(date) => {
                    setPanel((p) => ({ ...p, open: false }));
                    // Let the list close first so the new chip's popover isn't dismissed by it.
                    window.setTimeout(() => startDraft(date), 0);
                  }}
                />
              )}
              {panel.value?.kind === "event" && <EventDetails event={panel.value.event} fmt={fmt} when={when} />}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {/* Quick create, anchored to the draft chip */}
      <Popover.Root open={!!draft && !!(compact ? draft.cell : draftEl)} onOpenChange={(open) => !open && setDraft(null)}>
        <Popover.Portal>
          <Popover.Positioner anchor={compact ? draft?.cell : draftEl} side="bottom" align="start" sideOffset={6} collisionPadding={8} collisionBoundary={rootEl ?? undefined} className="z-(--z-popover)">
            <Popover.Popup finalFocus={returnFocus} className={popupClass}>
              {draft && (
                <form
                  className="flex w-[272px] flex-col gap-2 p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    commitDraft();
                  }}
                >
                  <Popover.Title className="sr-only">{L.newEvent}</Popover.Title>
                  <input
                    autoFocus
                    id={`${uid}-title`}
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder={L.titlePlaceholder}
                    aria-label="Event title"
                    autoComplete="off"
                    enterKeyHint="done"
                    maxLength={120}
                    className="h-8 w-full rounded-md bg-transparent px-1 text-base font-medium tracking-[-0.015em] text-fg outline-none placeholder:font-normal placeholder:text-fg-4 sm:text-[15px]"
                  />
                  <p className="flex items-center gap-2 px-1 text-[12.5px] text-fg-2">
                    <CalendarIcon size={14} className="shrink-0 text-fg-3" />
                    <span className="truncate">{fmt.long.format(draft.date)}</span>
                    <span className="text-fg-4">·</span>
                    <span className="shrink-0 text-fg-3">All day</span>
                  </p>
                  <div className="mt-1 flex items-center justify-end gap-1.5">
                    <button type="button" onClick={() => setDraft(null)} className={cn(btnBase, "px-2.5 text-fg-2 hover:bg-hover hover:text-fg")}>
                      Cancel
                    </button>
                    <button type="submit" disabled={!draft.title.trim()} className={cn(btnBase, "bg-fg px-3 text-frame hover:bg-fg/90 disabled:opacity-40")}>
                      {L.create}
                    </button>
                  </div>
                </form>
              )}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

const popupClass = cn(
  "origin-[var(--transform-origin)] rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
  "transition-[scale,opacity] duration-200 ease-out-expo data-ending-style:duration-150",
  "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0",
  "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
);
const btnBase = cn(
  "inline-flex h-7 items-center justify-center rounded-md text-[12.5px] font-medium select-none",
  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
  "transition-[background-color,color,scale,opacity] duration-150 ease-out active:scale-[0.97] active:duration-75 disabled:pointer-events-none",
);

function eventsOn(events: CalendarEvent[], date: Date) {
  return events
    .map((e) => toItem(e))
    .filter((it) => cmpDay(it.first, date) <= 0 && cmpDay(it.last, date) >= 0)
    .map((it) => it.ev)
    .sort((a, b) => Number(!!b.allDay) - Number(!!a.allDay) || a.start.getTime() - b.start.getTime());
}

function NavButton({ label, children, ...rest }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "relative grid size-8 place-items-center rounded-md text-fg-2 select-none",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
        "disabled:pointer-events-none disabled:opacity-40",
        "before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

function Chip({
  seg,
  wide,
  reduce,
  landed,
  time,
  onOpen,
}: {
  seg: WeekSegment;
  wide: boolean;
  reduce: boolean;
  landed: boolean;
  time: string;
  onOpen: (el: HTMLElement) => void;
}) {
  const e = seg.event;
  const tone = e.tone ?? "neutral";
  const tentative = e.status === "tentative";
  const canceled = e.status === "canceled";
  return (
    <motion.button
      type="button"
      tabIndex={-1}
      onClick={(ev) => onOpen(ev.currentTarget)}
      initial={landed ? false : reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={reduce ? { duration: 0.15 } : spring.pop}
      className={cn(
        "pointer-events-auto relative flex min-w-0 items-center gap-1.5 rounded-[5px] px-1.5 text-left text-[11.5px] leading-none select-none [-webkit-tap-highlight-color:transparent]",
        "transition-[background-color,scale] duration-150 active:scale-[0.97] active:duration-75",
        seg.bar
          ? cn(
              "pl-2.5 font-medium before:absolute before:inset-y-[3px] before:left-[3px] before:w-[2px] before:rounded-full hover:shadow-[inset_0_0_0_1px_var(--line-2)]",
              tentative ? "border border-dashed border-fg-4 before:bg-fg-4" : toneBar[tone],
            )
          : "hover:bg-fg/[0.06]",
        !seg.continuesBefore && "ml-1",
        !seg.continuesAfter && "mr-1",
        seg.continuesBefore && "rounded-l-none before:hidden",
        seg.continuesAfter && "rounded-r-none",
      )}
      style={{
        gridColumn: `${seg.from + 1} / ${seg.to + 2}`,
        gridRow: seg.lane + 2,
        animation: landed ? "stealth-ec-land 900ms var(--ease-out-quart)" : undefined,
      }}
    >
      {!seg.bar && (
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            tentative ? "border border-fg-3 bg-transparent" : toneDot[tone],
            canceled && "opacity-40",
          )}
        />
      )}
      {!seg.bar && wide && time && <span className="shrink-0 text-fg-3 tabular">{time}</span>}
      <span className={cn("truncate", seg.bar ? "font-medium text-fg" : "text-fg", canceled && "text-fg-4 line-through decoration-fg-4")}>{e.title}</span>
    </motion.button>
  );
}

type Fmt = {
  long: Intl.DateTimeFormat;
  weekdayLong: Intl.DateTimeFormat;
  dayNum: Intl.DateTimeFormat;
  dayMonth: Intl.DateTimeFormat;
};

function DayList({
  date,
  isToday,
  events,
  fmt,
  when,
  readOnly,
  newLabel,
  onPick,
  onNew,
}: {
  date: Date;
  isToday: boolean;
  events: CalendarEvent[];
  fmt: Fmt;
  when: (e: CalendarEvent) => string;
  readOnly: boolean;
  newLabel: string;
  onPick: (e: CalendarEvent) => void;
  onNew: (d: Date) => void;
}) {
  return (
    <div className="relative flex max-h-[min(440px,var(--available-height))] w-[272px] flex-col p-1.5">
      <div className="flex shrink-0 items-center gap-2.5 py-1.5 pl-2 pr-10">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-[14px] font-medium tabular", isToday ? "bg-fg text-frame" : "bg-hover text-fg")}>
          {fmt.dayNum.format(date)}
        </span>
        <div className="min-w-0">
          <Popover.Title className="truncate text-[13px] font-medium tracking-[-0.01em] text-fg">{fmt.weekdayLong.format(date)}</Popover.Title>
          <Popover.Description className="text-[12px] text-fg-3">
            {events.length === 0 ? "Nothing scheduled" : events.length === 1 ? "1 event" : `${events.length} events`}
          </Popover.Description>
        </div>
      </div>
      {events.length > 0 && (
        <ul className={cn("-mx-0.5 min-h-0 flex-1 overflow-y-auto overscroll-contain px-0.5 pb-px", events.length > 4 && "[mask-image:linear-gradient(to_bottom,var(--fg)_calc(100%-24px),transparent)]")}>
          {events.map((ev) => (
            <li key={ev.id}>
              <button
                type="button"
                onClick={() => onPick(ev)}
                className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none transition-[background-color,scale] duration-150 hover:bg-hover focus-visible:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-4 active:scale-[0.98] active:duration-75"
              >
                <span aria-hidden className="grid h-[19px] w-2 shrink-0 place-items-center">
                  <span
                    className={cn(
                      "rounded-full",
                      ev.allDay || toItem(ev).bar ? "h-2.5 w-[3px]" : "size-1.5",
                      ev.status === "tentative" ? "border border-fg-3" : toneDot[ev.tone ?? "neutral"],
                    )}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-[13px] text-fg", ev.status === "canceled" && "text-fg-4 line-through")}>{ev.title}</span>
                  <span className="block truncate text-[12px] text-fg-3 tabular">
                    {when(ev)}
                    {ev.location ? ` · ${ev.location}` : ""}
                    {ev.status === "tentative" ? " · Tentative" : ev.status === "canceled" ? " · Canceled" : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <button
          type="button"
          onClick={() => onNew(date)}
          className="mt-1 flex h-8 shrink-0 items-center gap-2 rounded-lg px-2 text-[12.5px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:bg-hover focus-visible:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-4 active:scale-[0.98] active:duration-75"
        >
          <Plus size={14} />
          {newLabel}
        </button>
      )}
      {/* Last in the DOM so opening the list focuses its first event, not Close. */}
      <Popover.Close aria-label="Close" className={cn(closeClass, "absolute right-2.5 top-3")}>
        <X size={14} />
      </Popover.Close>
    </div>
  );
}

const closeClass = cn(
  "grid size-7 place-items-center rounded-md text-fg-3 outline-none select-none",
  "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
  "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
);

function EventDetails({ event, fmt, when }: { event: CalendarEvent; fmt: Fmt; when: (e: CalendarEvent) => string }) {
  const tone = event.tone ?? "neutral";
  return (
    <div className="relative flex w-[288px] flex-col gap-2.5 p-4 pr-10">
      <div className="flex items-start gap-2.5">
        <span aria-hidden className={cn("mt-[3px] h-3.5 w-[3px] shrink-0 rounded-full", event.status === "tentative" ? "border border-fg-3" : toneDot[tone])} />
        <div className="min-w-0">
          <Popover.Title className={cn("text-[14px] font-medium leading-snug tracking-[-0.015em] text-fg [overflow-wrap:anywhere]", event.status === "canceled" && "text-fg-3 line-through")}>
            {event.title}
          </Popover.Title>
          <Popover.Description className="mt-0.5 text-[12.5px] text-fg-2 tabular">
            {fmt.long.format(event.start)}
            <br />
            {when(event)}
          </Popover.Description>
        </div>
      </div>
      {(event.location || event.status === "tentative" || event.status === "canceled") && (
        <div className="flex flex-col gap-1.5 pl-[13px] text-[12.5px] text-fg-2">
          {event.location && (
            <p className="flex items-start gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-px shrink-0 text-fg-3">
                <path d="M8 14s4.5-4.1 4.5-7.75a4.5 4.5 0 0 0-9 0C3.5 9.9 8 14 8 14z" />
                <circle cx="8" cy="6.25" r="1.5" />
              </svg>
              <span className="min-w-0 [overflow-wrap:anywhere]">{event.location}</span>
            </p>
          )}
          {event.status === "tentative" && <p className="text-fg-3">Tentative</p>}
          {event.status === "canceled" && <p className="text-fg-3">Canceled</p>}
        </div>
      )}
      {event.description && <p className="line-clamp-3 pl-[13px] text-[12.5px] leading-relaxed text-fg-3">{event.description}</p>}
      <Popover.Close aria-label="Close" className={cn(closeClass, "absolute right-2 top-2")}>
        <X size={14} />
      </Popover.Close>
    </div>
  );
}
