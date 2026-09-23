"use client";
import { Popover } from "@base-ui/react/popover";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight, Clock, X } from "@/lib/icons";
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
  /** Exclusive. */
  end: Date;
  allDay?: boolean;
  location?: string;
  description?: string;
  /** Meaning only: a deadline, an outage, a launch. Leave neutral for ordinary meetings. */
  tone?: EventTone;
  status?: "confirmed" | "tentative" | "canceled";
};

/* ------------------------------------------------------------------ */
/* Date helpers                                                        */
/* ------------------------------------------------------------------ */

const DAY_MIN = 1440;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayNum = (d: Date) => d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
const cmpDay = (a: Date, b: Date) => dayNum(a) - dayNum(b);
const sameDay = (a: Date | null | undefined, b: Date | null | undefined) => !!a && !!b && dayNum(a) === dayNum(b);
const diffDays = (a: Date, b: Date) =>
  Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5);
const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
/** A wall-clock time on a day. Minutes past 1440 roll into the next day. */
const at = (day: Date, minutes: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes);
const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isAllDay = (e: CalendarEvent) => !!e.allDay || e.end.getTime() - e.start.getTime() >= 864e5;
const lastDay = (e: CalendarEvent) => {
  const last = startOfDay(new Date(Math.max(e.end.getTime() - 1, e.start.getTime())));
  return cmpDay(last, e.start) < 0 ? startOfDay(e.start) : last;
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

/* The clock and the viewer's language only exist in the browser: null / en-US */
/* on the server, settled on hydration. The clock ticks on the minute.          */

function subscribeMinute(notify: () => void) {
  let timer = 0;
  const arm = () => {
    timer = window.setTimeout(() => (notify(), arm()), 60000 - (Date.now() % 60000) + 20);
  };
  arm();
  const onVisible = () => document.visibilityState === "visible" && notify();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
/** The current minute, re-rendering once a minute. Null during the server render. */
export function useMinute(override?: Date) {
  const m = useSyncExternalStore(subscribeMinute, () => Math.floor(Date.now() / 60000), () => null);
  return useMemo(() => override ?? (m === null ? null : new Date(m * 60000)), [m, override]);
}
function subscribeLanguage(notify: () => void) {
  window.addEventListener("languagechange", notify);
  return () => window.removeEventListener("languagechange", notify);
}
const useLocale = (locale?: string) => {
  const browser = useSyncExternalStore(subscribeLanguage, () => navigator.language, () => "en-US");
  return locale ?? browser;
};

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export type DaySegment = {
  event: CalendarEvent;
  key: string;
  /** Minutes from the start of the day. */
  start: number;
  end: number;
  /** Column inside its overlap group, how many columns the group has, and how many it may widen across. */
  col: number;
  cols: number;
  span: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

/**
 * Timed events for one day, laid side by side where they overlap. Each group of
 * transitively overlapping events shares a column count; an event widens into
 * neighboring columns that stay free for its whole length.
 */
export function layoutDay(day: Date, events: CalendarEvent[], minVisual = 20): DaySegment[] {
  const d0 = day.getTime();
  const d1 = addDays(day, 1).getTime();
  const segs: (DaySegment & { vEnd: number })[] = [];
  for (const ev of events) {
    if (isAllDay(ev)) continue;
    const s = ev.start.getTime();
    const e = Math.max(ev.end.getTime(), s + 60000);
    if (e <= d0 || s >= d1) continue;
    const start = s < d0 ? 0 : minutesOf(ev.start);
    const end = e >= d1 ? DAY_MIN : Math.max(start + 1, minutesOf(new Date(e)));
    segs.push({ event: ev, key: s < d0 ? `${ev.id}@${dayKey(day)}` : ev.id, start, end, vEnd: Math.max(end, start + minVisual), col: 0, cols: 1, span: 1, continuesBefore: s < d0, continuesAfter: e > d1 });
  }
  segs.sort((a, b) => a.start - b.start || b.end - a.end);
  let group: typeof segs = [];
  let colEnds: number[] = [];
  let groupEnd = -1;
  const flush = () => {
    const n = colEnds.length;
    for (const s of group) {
      s.cols = n;
      let span = 1;
      for (let c = s.col + 1; c < n; c++) {
        if (group.some((o) => o.col === c && o.start < s.vEnd && o.vEnd > s.start)) break;
        span++;
      }
      s.span = span;
    }
    group = [];
    colEnds = [];
  };
  for (const s of segs) {
    if (s.start >= groupEnd) {
      flush();
      groupEnd = -1;
    }
    let c = colEnds.findIndex((end) => end <= s.start);
    if (c === -1) {
      c = colEnds.length;
      colEnds.push(s.vEnd);
    } else colEnds[c] = s.vEnd;
    s.col = c;
    group.push(s);
    groupEnd = Math.max(groupEnd, s.vEnd);
  }
  flush();
  return segs;
}

type AllDaySeg = { event: CalendarEvent; from: number; to: number; lane: number; continuesBefore: boolean; continuesAfter: boolean };
function layoutAllDay(first: Date, count: number, events: CalendarEvent[]) {
  const last = addDays(first, count - 1);
  const segs: AllDaySeg[] = [];
  for (const ev of events) {
    if (!isAllDay(ev)) continue;
    const a = startOfDay(ev.start);
    const b = lastDay(ev);
    if (cmpDay(b, first) < 0 || cmpDay(a, last) > 0) continue;
    segs.push({ event: ev, from: Math.max(0, diffDays(first, a)), to: Math.min(count - 1, diffDays(first, b)), lane: 0, continuesBefore: cmpDay(a, first) < 0, continuesAfter: cmpDay(b, last) > 0 });
  }
  segs.sort((x, y) => x.from - y.from || y.to - y.from - (x.to - x.from) || x.event.start.getTime() - y.event.start.getTime());
  const rows: boolean[][] = [];
  for (const s of segs) {
    for (let lane = 0; ; lane++) {
      const row = (rows[lane] ??= Array(count).fill(false));
      let free = true;
      for (let c = s.from; c <= s.to && free; c++) free = !row[c];
      if (!free) continue;
      for (let c = s.from; c <= s.to; c++) row[c] = true;
      s.lane = lane;
      break;
    }
  }
  const perDay = Array(count).fill(0);
  for (const s of segs) for (let c = s.from; c <= s.to; c++) perDay[c]++;
  return { segs, lanes: rows.length, perDay };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export type WeekGridProps = Omit<React.ComponentProps<"div">, "children" | "defaultValue" | "onChange"> & {
  events?: CalendarEvent[];
  defaultEvents?: CalendarEvent[];
  onEventsChange?: (events: CalendarEvent[]) => void;
  /** Called with the new event once its title is confirmed. */
  onEventCreate?: (event: CalendarEvent) => void;
  /** Called after an event is moved or resized, by pointer or keyboard. */
  onEventChange?: (event: CalendarEvent, previous: CalendarEvent) => void;
  onEventClick?: (event: CalendarEvent) => void;
  /** Any date in the range to show (controlled). */
  date?: Date;
  defaultDate?: Date;
  onDateChange?: (date: Date) => void;
  /** Days side by side, 1–7. Defaults to a full week, or three days when narrower than 560px. */
  days?: number;
  locale?: string;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Pixels per hour. */
  hourHeight?: number;
  /** Minutes every drag and nudge snaps to. */
  snapMinutes?: number;
  /** Length of an event made with a single click, in minutes. */
  defaultDuration?: number;
  /** Hour to scroll to on mount. Defaults to an hour before now, or 8 AM. */
  scrollToHour?: number;
  loading?: boolean;
  /** Open events, but no creating, moving or resizing. */
  readOnly?: boolean;
  /** Pin the clock for tests and screenshots. */
  now?: Date;
  labels?: { today?: string; previous?: string; next?: string; allDay?: string; newEvent?: string; create?: string; titlePlaceholder?: string };
};

type Slide = { dir: number; instant: boolean; reduce: boolean };
const colsVariants = {
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

const toneEdge: Record<EventTone, string> = { neutral: "before:bg-fg-3", info: "before:bg-info", success: "before:bg-success", warning: "before:bg-warning", danger: "before:bg-danger" };
const toneFill: Record<EventTone, string> = { neutral: "bg-[color-mix(in_oklab,var(--fg)_9%,var(--raised))]", info: "bg-[color-mix(in_oklab,var(--info)_16%,var(--raised))]", success: "bg-[color-mix(in_oklab,var(--success)_16%,var(--raised))]", warning: "bg-[color-mix(in_oklab,var(--warning)_16%,var(--raised))]", danger: "bg-[color-mix(in_oklab,var(--danger)_16%,var(--raised))]" };

type Draft = { day: number; start: number; end: number; title: string; phase: "drag" | "name" };
type Drag = { id: string; mode: "move" | "resize"; day: number; start: number; end: number };
type Gesture = {
  kind: "create" | "move" | "resize";
  pointerId: number;
  pointerType: string;
  x: number;
  y: number;
  active: boolean;
  timer: number;
  day: number;
  anchor: number;
  event?: CalendarEvent;
  /** Minutes between the pointer and the event's start when it was picked up. */
  grab?: number;
  duration?: number;
  lastX: number;
  lastY: number;
};

const GUTTER = 52;

export function WeekGrid({
  events: eventsProp,
  defaultEvents = [],
  onEventsChange,
  onEventCreate,
  onEventChange,
  onEventClick,
  date: dateProp,
  defaultDate,
  onDateChange,
  days: daysProp,
  locale: localeProp,
  weekStartsOn,
  hourHeight = 48,
  snapMinutes = 15,
  defaultDuration = 30,
  scrollToHour,
  loading = false,
  readOnly = false,
  now: nowProp,
  labels,
  className,
  ref,
  ...rest
}: WeekGridProps) {
  const L = { today: "Today", previous: "Previous", next: "Next", allDay: "All day", newEvent: "New event", create: "Create event", titlePlaceholder: "Add title", ...labels };
  const reduce = !!useReducedMotion();
  const locale = useLocale(localeProp);
  const now = useMinute(nowProp);
  const today = useMemo(() => (now ? startOfDay(now) : null), [now]);
  const ws = weekStartsOn ?? weekStartFor(locale);
  const uid = useId();
  const pxPerMin = hourHeight / 60;
  const snap = Math.max(1, snapMinutes);

  const [events, setEvents] = useControllableState({ value: eventsProp, defaultValue: defaultEvents, onChange: onEventsChange });
  const [anchorState, setAnchor] = useControllableState<Date | null>({ value: dateProp, defaultValue: defaultDate ?? null, onChange: (d) => d && onDateChange?.(d) });
  const anchor = anchorState ? startOfDay(anchorState) : today;

  // Width decides the day count when none is given.
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!rootEl) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(rootEl);
    return () => ro.disconnect();
  }, [rootEl]);
  const setRoot = useCallback(
    (el: HTMLDivElement | null) => {
      setRootEl(el);
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );
  const count = Math.min(7, Math.max(1, daysProp ?? (width > 0 && width < 560 ? 3 : 7)));
  const first = useMemo(() => (anchor ? (count === 7 ? addDays(anchor, -((anchor.getDay() - ws + 7) % 7)) : anchor) : null), [anchor, count, ws]);
  const dayList = useMemo(() => (first ? Array.from({ length: count }, (_, i) => addDays(first, i)) : null), [first, count]);
  const rangeKey = first ? dayKey(first) : "none";
  const [slide, setSlide] = useState<Slide>({ dir: 1, instant: true, reduce });

  const fmt = useMemo(() => {
    const make = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, o);
    return {
      range: make({ month: "short", day: "numeric", year: "numeric" }),
      monthYear: make({ month: "long", year: "numeric" }),
      weekday: make({ weekday: "short" }),
      dayNum: make({ day: "numeric" }),
      long: make({ weekday: "long", day: "numeric", month: "long" }),
      short: make({ weekday: "short", day: "numeric", month: "short" }),
      time: make({ hour: "numeric", minute: "2-digit" }),
      hour: make({ hour: "numeric" }),
      clock: make({ hour: "numeric", minute: "2-digit", hour12: false }),
    };
  }, [locale]);
  const timeRange = useCallback((s: Date, e: Date) => fmt.time.formatRange(s, e), [fmt]);
  // Blocks are narrow: "4 – 5:45 PM", not "4:00 PM – 5:45 PM".
  const compactRange = useCallback(
    (s: Date, e: Date) => {
      const parts = (d: Date) => (d.getMinutes() ? fmt.time : fmt.hour).formatToParts(d);
      const period = (p: Intl.DateTimeFormatPart[]) => p.find((x) => x.type === "dayPeriod")?.value;
      const text = (p: Intl.DateTimeFormatPart[], drop: boolean) => p.filter((x) => !(drop && x.type === "dayPeriod")).map((x) => x.value).join("").trim();
      const ps = parts(s);
      const pe = parts(e);
      return `${text(ps, period(ps) === period(pe))} – ${text(pe, false)}`;
    },
    [fmt],
  );
  const duration = (mins: number) => (mins < 60 ? `${mins}m` : mins % 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins / 60}h`);

  const segsByDay = useMemo(() => (dayList && !loading ? dayList.map((d) => layoutDay(d, events)) : null), [dayList, events, loading]);
  const allDay = useMemo(() => (first && !loading ? layoutAllDay(first, count, events) : { segs: [], lanes: 0, perDay: [] as number[] }), [first, count, events, loading]);
  const [allDayOpen, setAllDayOpen] = useState(false);
  const allDayLanes = allDayOpen ? allDay.lanes : Math.min(allDay.lanes, 2);
  const allDayHidden = useMemo(() => {
    if (allDayOpen || allDay.lanes <= 2) return null;
    const hidden = Array(count).fill(0);
    for (const s of allDay.segs) if (s.lane >= 2) for (let c = s.from; c <= s.to; c++) hidden[c]++;
    return hidden;
  }, [allDay, allDayOpen, count]);

  /* ---------- scroll ---------- */
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || scrolled.current || !now) return;
    scrolled.current = true;
    const hour = scrollToHour ?? Math.max(0, Math.min(minutesOf(now) / 60 - 1.5, 24));
    el.scrollTop = Math.max(0, hour * hourHeight - (scrollToHour === undefined ? 0 : 8));
  }, [now, scrollToHour, hourHeight]);

  /* ---------- popovers ---------- */
  const [panel, setPanel] = useState<{ open: boolean; event: CalendarEvent | null; anchor: Element | null }>({ open: false, event: null, anchor: null });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftEl, setDraftEl] = useState<HTMLElement | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const returnFocus = useRef<HTMLElement | null>(null);

  /* ---------- navigation ---------- */
  const go = (dir: number) => {
    if (!anchor) return;
    setSlide({ dir, instant: false, reduce });
    setDraft(null);
    setPanel((p) => ({ ...p, open: false }));
    setAnchor(addDays(anchor, dir * count));
  };
  const goToday = () => {
    if (!today || !anchor || !first) return;
    const inRange = cmpDay(today, first) >= 0 && diffDays(first, today) < count;
    if (!inRange) {
      setSlide({ dir: cmpDay(today, first) > 0 ? 1 : -1, instant: false, reduce });
      setDraft(null);
      setAnchor(today);
    }
    const el = scrollerRef.current;
    if (el && now) el.scrollTo({ top: Math.max(0, (minutesOf(now) / 60 - 1.5) * hourHeight), behavior: reduce ? "auto" : "smooth" });
  };

  /* ---------- pointer gestures ---------- */
  const colsRef = useRef<HTMLDivElement | null>(null);
  const hoverRef = useRef<HTMLDivElement | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const justDragged = useRef(false);
  const suppress = useRef(false);
  const autoScroll = useRef(0);

  const locate = (x: number, y: number) => {
    const el = colsRef.current;
    if (!el) return { day: 0, min: 0 };
    const r = el.getBoundingClientRect();
    const day = Math.max(0, Math.min(count - 1, Math.floor(((x - r.left) / r.width) * count)));
    const min = Math.max(0, Math.min(DAY_MIN, (y - r.top) / pxPerMin));
    return { day, min };
  };
  const floorSnap = (m: number) => Math.floor(m / snap) * snap;
  const roundSnap = (m: number) => Math.round(m / snap) * snap;

  const update = (g: Gesture) => {
    const p = locate(g.lastX, g.lastY);
    if (g.kind === "create") {
      const m = p.min;
      const start = m >= g.anchor ? g.anchor : floorSnap(m);
      const end = m >= g.anchor ? Math.min(DAY_MIN, Math.max(g.anchor + snap, Math.ceil(m / snap) * snap)) : g.anchor + snap;
      setDraft((d) => (d && d.start === start && d.end === end ? d : { day: g.day, start, end, title: "", phase: "drag" }));
    } else if (g.kind === "move") {
      const dur = g.duration!;
      const start = Math.max(0, Math.min(DAY_MIN - Math.min(dur, DAY_MIN), roundSnap(p.min - g.grab!)));
      const next = { id: g.event!.id, mode: "move" as const, day: p.day, start, end: start + dur };
      setDrag((d) => (d && d.day === next.day && d.start === next.start ? d : next));
    } else {
      setDrag((d) => {
        if (!d) return d;
        const end = Math.max(d.start + snap, Math.min(DAY_MIN, roundSnap(p.min)));
        return end === d.end ? d : { ...d, end };
      });
    }
  };

  const stopAutoScroll = () => {
    cancelAnimationFrame(autoScroll.current);
    autoScroll.current = 0;
  };
  // While dragging near the top or bottom edge, the grid scrolls under the pointer.
  const runAutoScroll = () => {
    const tick = () => {
      const g = gesture.current;
      const el = scrollerRef.current;
      if (!g?.active || !el) return stopAutoScroll();
      const r = el.getBoundingClientRect();
      const topEdge = r.top + 76;
      const speed = g.lastY < topEdge + 32 ? -Math.min(14, (topEdge + 32 - g.lastY) / 3) : g.lastY > r.bottom - 32 ? Math.min(14, (g.lastY - (r.bottom - 32)) / 3) : 0;
      if (speed) {
        el.scrollTop += speed;
        update(g);
      }
      autoScroll.current = requestAnimationFrame(tick);
    };
    stopAutoScroll();
    autoScroll.current = requestAnimationFrame(tick);
  };

  const activate = (g: Gesture) => {
    g.active = true;
    try {
      colsRef.current?.setPointerCapture(g.pointerId);
    } catch {}
    if (hoverRef.current) hoverRef.current.dataset.show = "false";
    setPanel((p) => ({ ...p, open: false }));
    if (g.kind === "create") setDraft({ day: g.day, start: g.anchor, end: g.anchor + snap, title: "", phase: "drag" });
    else {
      const seg = segsByDay?.[g.day]?.find((s) => s.event.id === g.event!.id);
      if (seg) setDrag({ id: g.event!.id, mode: g.kind, day: g.day, start: seg.start, end: seg.end });
    }
    runAutoScroll();
  };

  const cancelGesture = useCallback(() => {
    const g = gesture.current;
    if (!g) return;
    window.clearTimeout(g.timer);
    try {
      colsRef.current?.releasePointerCapture(g.pointerId);
    } catch {}
    gesture.current = null;
    stopAutoScroll();
    if (g.active) {
      setDrag(null);
      if (g.kind === "create") setDraft(null);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && gesture.current?.active && (e.preventDefault(), cancelGesture());
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancelGesture]);
  useEffect(() => () => stopAutoScroll(), []);

  // A touch drag only begins after a long press; from then on the page mustn't scroll.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => gesture.current?.active && e.cancelable && e.preventDefault();
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, []);

  const commitMove = (id: string, day: number, start: number, end: number, how: "move" | "resize") => {
    const prev = events.find((e) => e.id === id);
    if (!prev || !dayList) return;
    let next: CalendarEvent;
    if (how === "move") {
      const s = at(dayList[day], start);
      next = { ...prev, start: s, end: new Date(s.getTime() + (prev.end.getTime() - prev.start.getTime())) };
    } else {
      next = { ...prev, end: at(dayList[day], end) };
    }
    if (next.start.getTime() === prev.start.getTime() && next.end.getTime() === prev.end.getTime()) return;
    setEvents(events.map((e) => (e.id === id ? next : e)));
    onEventChange?.(next, prev);
    setAnnouncement(`${next.title}, ${fmt.short.format(next.start)}, ${timeRange(next.start, next.end)}`);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const busy = suppress.current;
    suppress.current = false;
    if (e.button !== 0 || gesture.current || !dayList) return;
    const target = e.target as HTMLElement;
    const evEl = target.closest<HTMLElement>("[data-event-id]");
    const p = locate(e.clientX, e.clientY);
    const base = { pointerId: e.pointerId, pointerType: e.pointerType, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, active: false, timer: 0 };
    if (evEl) {
      if (readOnly || evEl.dataset.cont) return;
      const ev = events.find((x) => x.id === evEl.dataset.eventId);
      if (!ev) return;
      const day = Math.max(0, diffDays(dayList[0], ev.start));
      const resize = !!target.closest("[data-resize]");
      gesture.current = { ...base, kind: resize ? "resize" : "move", day, anchor: 0, event: ev, grab: p.min - minutesOf(ev.start), duration: Math.round((ev.end.getTime() - ev.start.getTime()) / 60000) };
    } else {
      if (readOnly || busy) return;
      gesture.current = { ...base, kind: "create", day: p.day, anchor: floorSnap(p.min) };
    }
    const g = gesture.current;
    if (e.pointerType === "touch") g.timer = window.setTimeout(() => gesture.current === g && activate(g), 380);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) {
      // Hover: a faint slot follows the pointer, showing where a click would land.
      const h = hoverRef.current;
      if (!h || readOnly || e.pointerType !== "mouse" || (e.target as HTMLElement).closest("[data-event-id]") || draft) {
        if (h) h.dataset.show = "false";
        return;
      }
      const p = locate(e.clientX, e.clientY);
      const start = floorSnap(Math.min(p.min, DAY_MIN - defaultDuration));
      h.style.transform = `translateY(${start * pxPerMin}px)`;
      h.style.left = `${(p.day / count) * 100}%`;
      h.dataset.show = "true";
      h.firstElementChild!.textContent = fmt.time.format(at(dayList?.[p.day] ?? new Date(0), start));
      return;
    }
    if (e.pointerId !== g.pointerId) return;
    g.lastX = e.clientX;
    g.lastY = e.clientY;
    if (!g.active) {
      const moved = Math.hypot(e.clientX - g.x, e.clientY - g.y);
      if (g.pointerType === "touch") {
        if (moved > 8) cancelGesture();
        return;
      }
      if (moved < 4) return;
      activate(g);
    }
    update(g);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    window.clearTimeout(g.timer);
    gesture.current = null;
    stopAutoScroll();
    try {
      colsRef.current?.releasePointerCapture(g.pointerId);
    } catch {}
    if (!g.active) {
      if (g.kind === "create") {
        const start = Math.min(g.anchor, DAY_MIN - defaultDuration);
        setPanel((p) => ({ ...p, open: false }));
        setDraft({ day: g.day, start, end: start + defaultDuration, title: "", phase: "name" });
      }
      return;
    }
    justDragged.current = true;
    window.setTimeout(() => (justDragged.current = false), 0);
    if (g.kind === "create") setDraft((d) => (d ? { ...d, phase: "name" } : d));
    else if (drag) {
      commitMove(drag.id, drag.day, drag.start, drag.end, drag.mode);
      setDrag(null);
    } else setDrag(null);
  };

  /* ---------- keyboard ---------- */
  // Moving an event to another day remounts it in that column; put focus back on it.
  const refocus = useRef<string | null>(null);
  useEffect(() => {
    const id = refocus.current;
    if (!id) return;
    refocus.current = null;
    colsRef.current?.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(id)}"]:not([data-cont])`)?.focus();
  }, [events]);

  const onEventKeyDown = (e: React.KeyboardEvent<HTMLElement>, ev: CalendarEvent) => {
    if (readOnly || !e.altKey || !dayList) return;
    const dm = { ArrowUp: -snap, ArrowDown: snap }[e.key as "ArrowUp" | "ArrowDown"];
    const dd = { ArrowLeft: -1, ArrowRight: 1 }[e.key as "ArrowLeft" | "ArrowRight"];
    if (!dm && !dd) return;
    e.preventDefault();
    refocus.current = ev.id;
    const day = Math.max(0, diffDays(dayList[0], ev.start));
    const start = minutesOf(ev.start);
    const dur = Math.round((ev.end.getTime() - ev.start.getTime()) / 60000);
    if (e.shiftKey && dm) {
      const end = Math.max(start + snap, Math.min(DAY_MIN, start + dur + dm));
      commitMove(ev.id, day, start, end, "resize");
    } else if (dm) {
      commitMove(ev.id, day, Math.max(0, Math.min(DAY_MIN - dur, start + dm)), 0, "move");
    } else if (dd) {
      const nd = day + dd;
      if (nd < 0 || nd >= count) return;
      commitMove(ev.id, nd, start, 0, "move");
    }
  };

  // N starts an event at the next free-looking slot: after now if today is visible, otherwise 9 AM on the first day.
  const onGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly || e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey || !dayList) return;
    if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
    e.preventDefault();
    const todayIdx = today ? dayList.findIndex((d) => sameDay(d, today)) : -1;
    const start = todayIdx >= 0 && now ? Math.min(DAY_MIN - defaultDuration, Math.ceil(minutesOf(now) / snap) * snap) : 9 * 60;
    const day = todayIdx >= 0 ? todayIdx : 0;
    returnFocus.current = document.activeElement as HTMLElement | null;
    setDraft({ day, start, end: start + defaultDuration, title: "", phase: "name" });
    scrollerRef.current?.scrollTo({ top: Math.max(0, start * pxPerMin - 80) });
  };

  const commitDraft = () => {
    if (!draft || !draft.title.trim() || !dayList) return;
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `evt-${Date.now()}`;
    const created: CalendarEvent = { id, title: draft.title.trim(), start: at(dayList[draft.day], draft.start), end: at(dayList[draft.day], draft.end) };
    setLanded(id);
    setEvents([...events, created]);
    onEventCreate?.(created);
    setAnnouncement(`Created ${created.title}, ${fmt.short.format(created.start)}, ${timeRange(created.start, created.end)}`);
    setDraft(null);
  };

  /* ---------- render ---------- */
  const nowMin = now ? minutesOf(now) : null;
  const todayIdx = dayList && today ? dayList.findIndex((d) => sameDay(d, today)) : -1;
  const title = first && dayList ? (count === 1 ? fmt.long.format(first) : fmt.range.formatRange(first, dayList[count - 1])) : "";
  const layoutT = reduce ? { duration: 0 } : spring.snappy;
  const cols = `repeat(${count}, minmax(0, 1fr))`;
  const rangeEmpty = !loading && !!segsByDay && segsByDay.every((d) => d.length === 0) && allDay.segs.length === 0;

  return (
    <div
      data-slot="week-grid"
      ref={setRoot}
      className={cn("flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]", className)}
      onPointerDownCapture={() => {
        // A press that only dismisses an open popover shouldn't also start a new event.
        suppress.current = panel.open || draft?.phase === "name";
      }}
      onKeyDown={onGridKeyDown}
      {...rest}
    >
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line pl-4 pr-2">
        <h2 className="relative min-w-0 flex-1 overflow-hidden text-[15px] font-medium tracking-[-0.015em]" aria-live="polite">
          <span className="invisible">Sep 00 – 00, 0000</span>
          <AnimatePresence initial={false} custom={slide} mode="popLayout">
            <motion.span
              key={rangeKey}
              custom={slide}
              variants={titleVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="absolute inset-y-0 left-0 flex items-center gap-2 whitespace-nowrap tabular"
            >
              {title}
              {rangeEmpty && <span className="hidden text-[12px] font-normal tracking-normal text-fg-4 sm:inline">No events</span>}
            </motion.span>
          </AnimatePresence>
        </h2>
        <button type="button" onClick={goToday} disabled={!today} className={cn(btnBase, "border border-line-2 px-2.5 text-[12px] text-fg-2 hover:border-fg-4 hover:bg-hover hover:text-fg disabled:opacity-50")}>
          {L.today}
        </button>
        <div className="flex items-center">
          <NavButton label={count === 7 ? "Previous week" : `${L.previous} ${count} days`} onClick={() => go(-1)} disabled={!anchor}>
            <ChevronLeft />
          </NavButton>
          <NavButton label={count === 7 ? "Next week" : `${L.next} ${count} days`} onClick={() => go(1)} disabled={!anchor}>
            <ChevronRight />
          </NavButton>
        </div>
      </div>

      <motion.div ref={scrollerRef} layoutScroll className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]" aria-busy={loading || !now || undefined}>
        {/* Day headers and the all-day row stay pinned while the hours scroll. */}
        <div className="sticky top-0 z-(--z-sticky) border-b border-line bg-raised">
          <div className="flex">
            <div style={{ width: GUTTER }} className="shrink-0" />
            <div className="relative min-w-0 flex-1 overflow-hidden">
              <AnimatePresence initial={false} custom={slide} mode="popLayout">
                <motion.div key={rangeKey} custom={slide} variants={colsVariants} initial="enter" animate="center" exit="exit" className="grid" style={{ gridTemplateColumns: cols }}>
                  {Array.from({ length: count }, (_, i) => {
                    const d = dayList?.[i];
                    const isToday = sameDay(d, today);
                    return (
                      <div key={i} className="flex h-11 min-w-0 items-center gap-1.5 border-l border-line px-2" aria-current={isToday ? "date" : undefined}>
                        {d && (
                          <>
                            <span className={cn("font-mono text-2xs uppercase tracking-[0.08em]", isToday ? "text-fg" : "text-fg-3")}>{fmt.weekday.format(d)}</span>
                            <span className={cn("grid h-6 min-w-6 place-items-center rounded-full px-1 text-[13px] tabular", isToday ? "bg-fg font-medium text-frame" : "text-fg-2")}>{fmt.dayNum.format(d)}</span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          <div className="flex border-t border-line">
            <div style={{ width: GUTTER }} className="flex shrink-0 items-start justify-end pr-2 pt-[7px] text-2xs text-fg-4">
              {allDay.lanes > 2 ? (
                <button
                  type="button"
                  onClick={() => setAllDayOpen((o) => !o)}
                  aria-expanded={allDayOpen}
                  className="flex items-center gap-0.5 rounded text-fg-3 outline-none transition-colors hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3"
                >
                  {L.allDay}
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cn("transition-transform duration-200 ease-out-expo", allDayOpen && "rotate-180")}>
                    <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
                  </svg>
                </button>
              ) : (
                L.allDay
              )}
            </div>
            <div className="relative min-w-0 flex-1 overflow-hidden">
              <AnimatePresence initial={false} custom={slide} mode="popLayout">
                <motion.div
                  key={rangeKey}
                  custom={slide}
                  variants={colsVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="relative grid py-1"
                  style={{ gridTemplateColumns: cols, gridTemplateRows: `repeat(${Math.max(1, allDayLanes + (allDayHidden ? 1 : 0))}, 20px)`, rowGap: 2, minHeight: 30 }}
                >
                  {Array.from({ length: count }, (_, i) => (
                    <div key={i} className="border-l border-line" style={{ gridColumn: i + 1, gridRow: "1 / -1", marginBlock: -4 }} />
                  ))}
                  {allDay.segs
                    .filter((s) => s.lane < allDayLanes)
                    .map((s) => (
                      <button
                        key={s.event.id}
                        type="button"
                        data-event-chip
                        aria-haspopup="dialog"
                        aria-label={`${s.event.title}, all day`}
                        onClick={(e) => openEvent(s.event, e.currentTarget)}
                        className={cn(
                          "relative flex min-w-0 items-center rounded-[5px] pl-2.5 pr-1.5 text-left text-[11.5px] font-medium leading-none text-fg select-none",
                          "outline-none transition-[scale,box-shadow] duration-150 hover:shadow-[inset_0_0_0_1px_var(--line-2)] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 active:scale-[0.98]",
                          "before:absolute before:inset-y-[3px] before:left-[3px] before:w-[2px] before:rounded-full",
                          s.event.status === "tentative" ? "border border-dashed border-fg-4 before:bg-fg-4" : cn(toneFill[s.event.tone ?? "neutral"], toneEdge[s.event.tone ?? "neutral"]),
                          s.continuesBefore ? "ml-0 rounded-l-none before:hidden" : "ml-1",
                          s.continuesAfter ? "mr-0 rounded-r-none" : "mr-1",
                        )}
                        style={{ gridColumn: `${s.from + 1} / ${s.to + 2}`, gridRow: s.lane + 1 }}
                      >
                        <span className="truncate">{s.event.title}</span>
                      </button>
                    ))}
                  {allDayHidden?.map((n, c) =>
                    n > 0 ? (
                      <button
                        key={`more-${c}`}
                        type="button"
                        onClick={() => setAllDayOpen(true)}
                        className="mx-1 flex items-center rounded-[5px] px-1.5 text-left text-[11px] font-medium text-fg-3 outline-none transition-[background-color,color,scale] duration-150 hover:bg-fg/[0.06] hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.97]"
                        style={{ gridColumn: c + 1, gridRow: 3 }}
                      >
                        +{n} more
                      </button>
                    ) : null,
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Hours */}
        <div className="relative flex" style={{ height: 24 * hourHeight }}>
          <div style={{ width: GUTTER }} className="relative shrink-0 select-none" aria-hidden>
            {Array.from({ length: 23 }, (_, i) => {
              const h = i + 1;
              const nearNow = todayIdx >= 0 && nowMin !== null && Math.abs(nowMin - h * 60) < 16;
              return (
                // Node and the browser can space "1 PM" differently (ICU versions), so the server text may differ by a character.
                <span key={h} suppressHydrationWarning className={cn("absolute right-2 -translate-y-1/2 text-2xs text-fg-4 tabular transition-opacity duration-150", nearNow && "opacity-0")} style={{ top: h * hourHeight }}>
                  {fmt.hour.format(at(new Date(2026, 0, 5), h * 60))}
                </span>
              );
            })}
            {todayIdx >= 0 && nowMin !== null && (
              <span className="absolute right-1.5 z-[3] -translate-y-1/2 rounded bg-fg px-1 py-px font-mono text-[10px] leading-[14px] text-frame tabular" style={{ top: nowMin * pxPerMin }}>
                {fmt.clock.format(now!)}
              </span>
            )}
          </div>
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <AnimatePresence initial={false} custom={slide} mode="popLayout">
              <motion.div
                key={rangeKey}
                // The outgoing range unmounts after the incoming one mounts; ignore its null so the live grid keeps the ref.
                ref={(el: HTMLDivElement | null) => {
                  if (el) colsRef.current = el;
                }}
                custom={slide}
                variants={colsVariants}
                initial="enter"
                animate="center"
                exit="exit"
                role="group"
                aria-label={title}
                className={cn("absolute inset-0 grid touch-pan-y", !readOnly && "cursor-default")}
                style={{
                  gridTemplateColumns: cols,
                  backgroundImage: `linear-gradient(to bottom, var(--line) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--line) 50%, transparent) 1px, transparent 1px)`,
                  backgroundSize: `100% ${hourHeight}px, 100% ${hourHeight / 2}px`,
                  backgroundPosition: `0 0, 0 ${hourHeight / 2}px`,
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={cancelGesture}
                onPointerLeave={() => hoverRef.current && (hoverRef.current.dataset.show = "false")}
              >
                {Array.from({ length: count }, (_, i) => {
                  const d = dayList?.[i];
                  const past = !!(d && today && cmpDay(d, today) < 0);
                  const segs = segsByDay?.[i] ?? [];
                  return (
                    <div key={i} data-day={d ? dayKey(d) : undefined} className={cn("relative min-w-0 border-l border-line", past && "bg-page/30")}>
                      {(loading || !now) &&
                        [0, 1].map((k) => {
                          const start = 9 * 60 + ((i * 97 + k * 190) % 420);
                          return (
                            <span
                              key={k}
                              className="absolute inset-x-1 rounded-md bg-fg/[0.06] animate-pulse-soft motion-reduce:animate-none"
                              style={{ top: start * pxPerMin, height: (k ? 45 : 60) * pxPerMin }}
                            />
                          );
                        })}
                      {/* Leave a strip on the right so there's always somewhere to click to create. */}
                      <div className="absolute inset-y-0 left-0.5 right-2.5">
                        {segs.map((s) => {
                          const isDragged = drag?.id === s.event.id && !s.continuesBefore;
                          if (isDragged) {
                            return (
                              <div
                                key={`ph-${s.key}`}
                                aria-hidden
                                className="absolute rounded-md border border-dashed border-line-2"
                                style={{ top: s.start * pxPerMin, height: Math.max(18, (s.end - s.start) * pxPerMin) - 1, left: `${(s.col / s.cols) * 100}%`, width: `calc(${(s.span / s.cols) * 100}% - 2px)` }}
                              />
                            );
                          }
                          return (
                            <EventBlock
                              key={s.key}
                              seg={s}
                              layoutId={`${uid}-${landed === s.event.id ? "draft" : s.key}`}
                              layoutT={layoutT}
                              pxPerMin={pxPerMin}
                              past={!!(now && s.event.end <= now)}
                              readOnly={readOnly}
                              label={compactRange(s.event.start, s.event.end)}
                              longLabel={`${s.event.title}, ${fmt.short.format(s.event.start)}, ${timeRange(s.event.start, s.event.end)}${s.event.location ? `, ${s.event.location}` : ""}`}
                              onOpen={(el) => {
                                if (justDragged.current) return;
                                openEvent(s.event, el);
                              }}
                              onKeyDown={(e) => onEventKeyDown(e, s.event)}
                            />
                          );
                        })}
                        {drag && drag.day === i && (
                          <DragBlock
                            key="drag"
                            event={events.find((e) => e.id === drag.id)!}
                            layoutId={`${uid}-${drag.id}`}
                            layoutT={layoutT}
                            top={drag.start * pxPerMin}
                            height={Math.max(18, (drag.end - drag.start) * pxPerMin) - 1}
                            label={d ? compactRange(at(d, drag.start), at(d, drag.end)) : ""}
                          />
                        )}
                        {draft && draft.day === i && d && (
                          <motion.div
                            ref={setDraftEl}
                            layoutId={`${uid}-draft`}
                            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ ...layoutT, opacity: { duration: 0.12 } }}
                            className={cn(
                              "absolute inset-x-0 z-[4] flex flex-col overflow-hidden rounded-md px-2 py-1 text-[11.5px] leading-tight",
                              draft.phase === "drag" ? "bg-fg text-frame shadow-pop" : "border border-dashed border-fg-3 bg-raised text-fg",
                            )}
                            style={{ top: draft.start * pxPerMin, height: Math.max(18, (draft.end - draft.start) * pxPerMin) - 1 }}
                          >
                            <span className={cn("truncate font-medium", draft.phase === "name" && !draft.title && "text-fg-3")}>{draft.title || L.newEvent}</span>
                            {(draft.end - draft.start) * pxPerMin >= 34 && (
                              <span className={cn("truncate tabular", draft.phase === "drag" ? "text-frame/70" : "text-fg-3")}>{compactRange(at(d, draft.start), at(d, draft.end))}</span>
                            )}
                            {(draft.end - draft.start) * pxPerMin >= 50 && (
                              <span className={cn("truncate tabular", draft.phase === "drag" ? "text-frame/70" : "text-fg-4")}>{duration(draft.end - draft.start)}</span>
                            )}
                          </motion.div>
                        )}
                      </div>
                      {i === todayIdx && nowMin !== null && (
                        <div aria-hidden className="pointer-events-none absolute inset-x-0 z-[3] h-px bg-fg" style={{ top: nowMin * pxPerMin }}>
                          <span className="absolute -left-[4px] -top-[3.5px] size-2 rounded-full bg-fg" />
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Faint line for the current time across the other days. */}
                {todayIdx >= 0 && nowMin !== null && (
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 z-[2] h-px bg-fg/20" style={{ top: nowMin * pxPerMin }} />
                )}
                {!readOnly && (
                  <div
                    ref={(el) => {
                      if (el) hoverRef.current = el;
                    }}
                    aria-hidden
                    data-show="false"
                    className="pointer-events-none absolute top-0 z-[1] flex items-start rounded-md border border-line-2 px-1.5 pt-0.5 opacity-0 transition-opacity duration-100 data-[show=true]:opacity-100 max-pointer-fine:hidden"
                    style={{ width: `calc(${100 / count}% - 12px)`, marginLeft: 2, height: defaultDuration * pxPerMin - 1 }}
                  >
                    <span className="text-[10.5px] text-fg-3 tabular" />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>

      {/* Event details */}
      <Popover.Root open={panel.open} onOpenChange={(open) => !open && setPanel((p) => ({ ...p, open: false }))}>
        <Popover.Portal>
          <Popover.Positioner anchor={panel.anchor} side="right" align="start" sideOffset={6} collisionPadding={8} collisionBoundary={rootEl ?? undefined} className="z-(--z-popover)">
            <Popover.Popup finalFocus={returnFocus} className={popupClass}>
              {panel.event && <EventDetails event={panel.event} fmt={fmt} timeRange={timeRange} readOnly={readOnly} />}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {/* Quick create */}
      <Popover.Root open={draft?.phase === "name" && !!draftEl} onOpenChange={(open) => !open && setDraft(null)}>
        <Popover.Portal>
          <Popover.Positioner anchor={draftEl} side="right" align="start" sideOffset={6} collisionPadding={8} collisionBoundary={rootEl ?? undefined} className="z-(--z-popover)">
            <Popover.Popup finalFocus={returnFocus} className={popupClass}>
              {draft && dayList && (
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
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder={L.titlePlaceholder}
                    aria-label="Event title"
                    autoComplete="off"
                    enterKeyHint="done"
                    maxLength={120}
                    className="h-8 w-full bg-transparent px-1 text-base font-medium tracking-[-0.015em] text-fg outline-none placeholder:font-normal placeholder:text-fg-4 sm:text-[15px]"
                  />
                  <p className="flex items-center gap-2 px-1 text-[12.5px] text-fg-2">
                    <Clock size={14} className="shrink-0 text-fg-3" />
                    <span className="min-w-0 truncate tabular">
                      {fmt.short.format(dayList[draft.day])}, {timeRange(at(dayList[draft.day], draft.start), at(dayList[draft.day], draft.end))}
                    </span>
                    <span className="shrink-0 text-fg-3 tabular">{duration(draft.end - draft.start)}</span>
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

  function openEvent(event: CalendarEvent, el: HTMLElement) {
    returnFocus.current = el;
    setDraft(null);
    setPanel({ open: true, event, anchor: el });
    onEventClick?.(event);
  }
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
  "transition-[background-color,border-color,color,scale,opacity] duration-150 ease-out active:scale-[0.97] active:duration-75 disabled:pointer-events-none",
);

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

type LayoutT = { duration: number } | typeof spring.snappy;

function EventBlock({
  seg,
  layoutId,
  layoutT,
  pxPerMin,
  past,
  readOnly,
  label,
  longLabel,
  onOpen,
  onKeyDown,
}: {
  seg: DaySegment;
  layoutId: string;
  layoutT: LayoutT;
  pxPerMin: number;
  past: boolean;
  readOnly: boolean;
  label: string;
  longLabel: string;
  onOpen: (el: HTMLElement) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
}) {
  const e = seg.event;
  const tone = e.tone ?? "neutral";
  const height = Math.max(18, (seg.end - seg.start) * pxPerMin) - 1;
  // Text follows the space: one line under 34px, title then time up to 50px, a two-line title above that.
  const narrow = seg.cols > 1 && seg.span / seg.cols <= 0.5;
  const mode = height < 34 ? "inline" : height < 50 || narrow ? "stack" : "tall";
  const tall = mode !== "inline";
  const tentative = e.status === "tentative";
  const canceled = e.status === "canceled";
  const resizable = !readOnly && !seg.continuesAfter && height >= 22;
  return (
    <motion.button
      type="button"
      layoutId={layoutId}
      transition={layoutT}
      data-event-id={e.id}
      data-cont={seg.continuesBefore || undefined}
      aria-haspopup="dialog"
      aria-label={longLabel}
      aria-description={readOnly || seg.continuesBefore ? undefined : "Alt and arrow keys to move, add Shift to change the length"}
      onClick={(ev) => onOpen(ev.currentTarget)}
      onKeyDown={onKeyDown}
      className={cn(
        "group/ev absolute flex min-w-0 overflow-hidden rounded-md pl-2 pr-1 text-left leading-tight select-none [-webkit-tap-highlight-color:transparent]",
        "outline-none focus-visible:z-[5] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
        "shadow-[0_0_0_1px_var(--raised)] transition-[scale,box-shadow,opacity] duration-150 active:scale-[0.985]",
        "before:absolute before:inset-y-1 before:left-[3px] before:w-[2px] before:rounded-full",
        tentative ? "border border-dashed border-fg-4 bg-raised before:bg-fg-4" : cn(toneFill[tone], toneEdge[tone]),
        !readOnly && !seg.continuesBefore && "cursor-grab active:cursor-grabbing",
        tall ? "flex-col py-1" : "items-center gap-1.5",
        past && "opacity-60 hover:opacity-100",
        seg.continuesBefore && "rounded-t-none",
        seg.continuesAfter && "rounded-b-none",
        "hover:shadow-[0_0_0_1px_var(--raised),inset_0_0_0_1px_var(--line-2)]",
      )}
      style={{
        top: seg.start * pxPerMin,
        height,
        left: `${(seg.col / seg.cols) * 100}%`,
        width: `calc(${(seg.span / seg.cols) * 100}% - 2px)`,
      }}
    >
      <motion.span
        layout="position"
        transition={layoutT}
        className={cn(
          "min-w-0 text-[11.5px] font-medium text-fg",
          canceled && "text-fg-4 line-through",
          mode === "tall" ? "w-full [display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2]" : mode === "stack" ? "w-full truncate" : "min-w-[45%] shrink truncate",
        )}
      >
        {e.title}
      </motion.span>
      <motion.span layout="position" transition={layoutT} className={cn("min-w-0 truncate text-[11px] text-fg-3 tabular", !tall && "shrink-[3]", !tall && narrow && "hidden")}>
        {tall ? label : label.split(/\s[–-]\s/)[0]}
      </motion.span>
      {resizable && (
        <span data-resize aria-hidden className="absolute inset-x-0 bottom-0 flex h-2 cursor-ns-resize items-end justify-center pb-0.5 opacity-0 transition-opacity duration-150 group-hover/ev:opacity-100">
          <span className="h-[2px] w-4 rounded-full bg-fg-3" />
        </span>
      )}
    </motion.button>
  );
}

function DragBlock({ event, layoutId, layoutT, top, height, label }: { event: CalendarEvent; layoutId: string; layoutT: LayoutT; top: number; height: number; label: string }) {
  if (!event) return null;
  const tone = event.tone ?? "neutral";
  return (
    <motion.div
      layoutId={layoutId}
      transition={layoutT}
      aria-hidden
      className={cn(
        "absolute inset-x-0 z-[6] flex cursor-grabbing flex-col overflow-hidden rounded-md py-1 pl-2 pr-1 leading-tight shadow-pop",
        "before:absolute before:inset-y-1 before:left-[3px] before:w-[2px] before:rounded-full",
        toneFill[tone],
        toneEdge[tone],
        "outline-1 -outline-offset-1 outline-solid outline-fg-4",
      )}
      style={{ top, height }}
    >
      <span className="truncate text-[11.5px] font-medium text-fg">{event.title}</span>
      {height >= 30 && <span className="truncate text-[11px] font-medium text-fg-2 tabular">{label}</span>}
    </motion.div>
  );
}

type DetailFmt = { long: Intl.DateTimeFormat };

function EventDetails({ event, fmt, timeRange, readOnly }: { event: CalendarEvent; fmt: DetailFmt; timeRange: (s: Date, e: Date) => string; readOnly: boolean }) {
  const tone = event.tone ?? "neutral";
  return (
    <div className="relative flex w-[280px] flex-col gap-2.5 p-4 pr-10">
      <div className="flex items-start gap-2.5">
        <span aria-hidden className={cn("mt-[3px] h-3.5 w-[3px] shrink-0 rounded-full", event.status === "tentative" ? "border border-fg-3" : { neutral: "bg-fg-3", info: "bg-info", success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone])} />
        <div className="min-w-0">
          <Popover.Title className={cn("text-[14px] font-medium leading-snug tracking-[-0.015em] text-fg [overflow-wrap:anywhere]", event.status === "canceled" && "text-fg-3 line-through")}>{event.title}</Popover.Title>
          <Popover.Description className="mt-0.5 text-[12.5px] text-fg-2 tabular">
            {fmt.long.format(event.start)}
            <br />
            {isAllDay(event) ? "All day" : timeRange(event.start, event.end)}
          </Popover.Description>
        </div>
      </div>
      {event.location && (
        <p className="flex items-start gap-2 pl-[13px] text-[12.5px] text-fg-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-px shrink-0 text-fg-3">
            <path d="M8 14s4.5-4.1 4.5-7.75a4.5 4.5 0 0 0-9 0C3.5 9.9 8 14 8 14z" />
            <circle cx="8" cy="6.25" r="1.5" />
          </svg>
          <span className="min-w-0 [overflow-wrap:anywhere]">{event.location}</span>
        </p>
      )}
      {(event.status === "tentative" || event.status === "canceled") && <p className="pl-[13px] text-[12.5px] text-fg-3">{event.status === "tentative" ? "Tentative" : "Canceled"}</p>}
      {event.description && <p className="line-clamp-3 pl-[13px] text-[12.5px] leading-relaxed text-fg-3">{event.description}</p>}
      {!readOnly && !isAllDay(event) && <p className="pl-[13px] text-[11.5px] text-fg-4">Drag to move or resize</p>}
      <Popover.Close
        aria-label="Close"
        className="absolute right-2 top-2 grid size-7 place-items-center rounded-md text-fg-3 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.92] before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden"
      >
        <X size={14} />
      </Popover.Close>
    </div>
  );
}
