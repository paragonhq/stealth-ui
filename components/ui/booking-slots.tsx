"use client";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { AnimatePresence, LayoutGroup, motion, useIsPresent, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ArrowRight, ChevronLeft, ChevronRight, Globe, Loader, Refresh } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* ------------------------------------------------------------------ */
/* Plain days. Every Date used as a day is local midnight and stands    */
/* for a calendar date in the display time zone; math goes through the  */
/* calendar fields, never milliseconds, so DST can't move a day.        */
/* ------------------------------------------------------------------ */

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const dayNum = (d: Date) => d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
const compareDays = (a: Date, b: Date) => dayNum(a) - dayNum(b);
const sameDay = (a: Date | null | undefined, b: Date | null | undefined) => !!a && !!b && dayNum(a) === dayNum(b);
const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();
const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const dayKey = (d: Date) => `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromDayKey = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/* ------------------------------------------------------------------ */
/* Time zones, through Intl only.                                      */
/* ------------------------------------------------------------------ */

const partsCache = new Map<string, Intl.DateTimeFormat>();
function zoneParts(at: Date, timeZone: string) {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
    partsCache.set(timeZone, f);
  }
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(at)) if (part.type !== "literal") p[part.type] = Number(part.value);
  return p;
}

/** Minutes the zone is ahead of UTC at that instant (London in summer is 60). */
export function zoneOffset(at: Date, timeZone: string) {
  const p = zoneParts(at, timeZone);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return Math.round((asUTC - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/**
 * The instant a wall-clock time happens on a day in a zone: `atZonedTime(day, 9 * 60 + 30, "Europe/London")`
 * is 9:30 in London that day. Re-checks the offset at the result, so days that change clocks land right.
 */
export function atZonedTime(day: Date, minutes: number, timeZone: string) {
  const guess = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes);
  const first = zoneOffset(new Date(guess), timeZone);
  const second = zoneOffset(new Date(guess - first * 60000), timeZone);
  return new Date(guess - second * 60000);
}

// Old names some engines still hand back, shown by their current ones.
const RENAMED: Record<string, string> = { Calcutta: "Kolkata", Saigon: "Ho Chi Minh City", Katmandu: "Kathmandu", Kiev: "Kyiv", Rangoon: "Yangon", Godthab: "Nuuk" };
function zoneCity(timeZone: string) {
  if (timeZone === "UTC" || timeZone === "Etc/UTC") return "UTC";
  const last = (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ");
  return RENAMED[last.replace(/ /g, "")] ?? last;
}
function zoneOffsetLabel(timeZone: string, at: Date) {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName");
    return part?.value ?? "";
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/* Browser-only facts: today, the viewer's zone and language. Each     */
/* reads null on the server and settles on hydration without mismatch. */
/* ------------------------------------------------------------------ */

function subscribeToday(notify: () => void) {
  let timer = 0;
  const arm = () => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    timer = window.setTimeout(() => (notify(), arm()), midnight.getTime() - now.getTime() + 50);
  };
  arm();
  document.addEventListener("visibilitychange", notify);
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", notify);
  };
}
const noop = () => () => {};
function useToday() {
  const key = useSyncExternalStore(subscribeToday, () => dayKey(new Date()), () => null);
  return useMemo(() => (key ? fromDayKey(key) : null), [key]);
}
function useViewerZone() {
  return useSyncExternalStore(noop, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => null);
}
function useLocale(locale?: string) {
  const browser = useSyncExternalStore(noop, () => navigator.language, () => "en-US");
  return locale ?? browser;
}

function weekStartOf(locale: string): number {
  try {
    const l = new Intl.Locale(locale) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
    const info = l.getWeekInfo?.() ?? l.weekInfo;
    if (info) return info.firstDay % 7;
    return ["US", "CA", "JP", "BR", "MX", "IN", "IL", "KR", "PH", "AU"].includes(l.maximize().region ?? "") ? 0 : 1;
  } catch {
    return 1;
  }
}
function prefers12h(locale: string) {
  try {
    const cycle = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hourCycle;
    return cycle === "h11" || cycle === "h12";
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */

export type BookingSlot = {
  start: Date;
  /** Taken or blocked slots are skipped: they're never drawn and never reached with the keyboard. */
  available?: boolean;
};

type SlotsResult = (Date | BookingSlot)[];

export type BookingSlotsProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "children"> & {
  /** Times for a day. Sync or async; a rejected promise shows a retry. The day is local midnight for that date. */
  getSlots: (day: Date) => SlotsResult | Promise<SlotsResult>;
  /** Days that can be opened at all. Others are drawn faint and skipped by "next available". */
  isDateAvailable?: (day: Date) => boolean;
  /** The open day, when controlled. */
  date?: Date | null;
  defaultDate?: Date | null;
  onDateChange?: (day: Date) => void;
  /** The picked (not yet confirmed) slot. */
  value?: Date | null;
  defaultValue?: Date | null;
  onValueChange?: (slot: Date | null) => void;
  /** Called by Confirm. Return a promise to show progress; reject (with a message, optionally) to report it. */
  onConfirm?: (slot: Date) => void | Promise<void>;
  /** Meeting length in minutes, for the end time and the announcements. */
  duration?: number;
  /** IANA zone the times are shown in. Defaults to the viewer's. */
  timeZone?: string;
  /** 12-hour clock. Defaults to the locale's habit; the footer toggle changes it. */
  hour12?: boolean;
  defaultHour12?: boolean;
  onHour12Change?: (hour12: boolean) => void;
  /** Earliest bookable day. Defaults to today. */
  min?: Date;
  max?: Date;
  locale?: string;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Replaces the zone name in the footer, e.g. with a time zone picker. */
  timeZoneControl?: React.ReactNode;
  confirmLabel?: string;
  disabled?: boolean;
};

type Loaded = { key: string; status: "ready"; slots: Date[] } | { key: string; status: "error"; message: string };
type Slide = { dir: number; reduce: boolean };
type Status = { kind: "idle" } | { kind: "busy"; at: number } | { kind: "error"; at: number; message: string };

const gridVariants = {
  enter: (c: Slide) => (c.reduce ? { opacity: 0 } : { opacity: 0, x: c.dir * 20 }),
  center: (c: Slide) => ({ opacity: 1, x: 0, transition: { duration: c.reduce ? 0.15 : 0.24, ease: ease.out } }),
  exit: (c: Slide) => (c.reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, x: c.dir * -20, transition: { duration: 0.15, ease: ease.out } }),
};

/**
 * Loads the slots for one day. A spinner-free wait: nothing for the first 150ms, then a skeleton
 * that stays at least 300ms so it never flickers. Results are cached per day.
 */
function useDaySlots(getSlots: BookingSlotsProps["getSlots"], day: Date | null) {
  const key = day ? dayKey(day) : null;
  const [cache, setCache] = useState<Record<string, Loaded>>({});
  const [skeletonFor, setSkeletonFor] = useState<string | null>(null);
  const getRef = useRef(getSlots);
  useEffect(() => {
    getRef.current = getSlots;
  });
  const cached = key ? cache[key] : undefined;
  // A failed day stays failed until Try again clears it; it doesn't hammer the server on every visit.
  const needsLoad = !!key && !cached;

  useEffect(() => {
    if (!key || !needsLoad) return;
    let live = true;
    let shownAt = 0;
    let hold = 0;
    const show = window.setTimeout(() => {
      shownAt = performance.now();
      setSkeletonFor(key);
    }, 150);
    const settle = (entry: Loaded) => {
      window.clearTimeout(show);
      const wait = shownAt ? Math.max(0, 300 - (performance.now() - shownAt)) : 0;
      hold = window.setTimeout(() => {
        if (!live) return;
        setCache((c) => ({ ...c, [key]: entry }));
        setSkeletonFor((k) => (k === key ? null : k));
      }, wait);
    };
    Promise.resolve()
      .then(() => getRef.current(fromDayKey(key)))
      .then(
        (result) => {
          const slots = result
            .filter((s) => (s instanceof Date ? true : s.available !== false))
            .map((s) => (s instanceof Date ? s : s.start))
            .sort((a, b) => a.getTime() - b.getTime());
          if (live) settle({ key, status: "ready", slots });
        },
        (error: unknown) => {
          if (live) settle({ key, status: "error", message: error instanceof Error && error.message ? error.message : "" });
        },
      );
    return () => {
      live = false;
      window.clearTimeout(show);
      window.clearTimeout(hold);
    };
  }, [key, needsLoad]);

  const retry = useCallback(() => {
    if (!key) return;
    setCache((c) => {
      const next = { ...c };
      delete next[key];
      return next;
    });
  }, [key]);

  // Days we've learned are fully booked, so the month can say so and "next available" can skip them.
  const full = useMemo(() => new Set(Object.values(cache).flatMap((e) => (e.status === "ready" && e.slots.length === 0 ? [e.key] : []))), [cache]);
  return { loaded: cached, skeleton: !cached && skeletonFor === key, retry, full };
}

export function BookingSlots({
  getSlots,
  isDateAvailable,
  date: dateProp,
  defaultDate,
  onDateChange,
  value: valueProp,
  defaultValue = null,
  onValueChange,
  onConfirm,
  duration = 30,
  timeZone: zoneProp,
  hour12: hour12Prop,
  defaultHour12,
  onHour12Change,
  min: minProp,
  max,
  locale: localeProp,
  weekStartsOn,
  timeZoneControl,
  confirmLabel = "Confirm",
  disabled = false,
  className,
  ...rest
}: BookingSlotsProps) {
  const reduce = !!useReducedMotion();
  const uid = useId();
  const today = useToday();
  const viewerZone = useViewerZone();
  const locale = useLocale(localeProp);
  const timeZone = zoneProp ?? viewerZone;
  const min = minProp ? startOfDay(minProp) : today;

  const canOpen = useCallback(
    (d: Date) => !(min && compareDays(d, min) < 0) && !(max && compareDays(d, max) > 0) && (isDateAvailable?.(d) ?? true),
    [min, max, isDateAvailable],
  );
  const nextOpen = useCallback(
    (from: Date, skipFirst = false, skip?: Set<string>) => {
      for (let i = skipFirst ? 1 : 0; i < 120; i++) {
        const d = addDays(from, i);
        if (max && compareDays(d, max) > 0) return null;
        if (canOpen(d) && !skip?.has(dayKey(d))) return d;
      }
      return null;
    },
    [canOpen, max],
  );

  // With no date given, open the first bookable day once today is known.
  const autoDate = useMemo(() => (today && min ? nextOpen(min) : null), [today, min, nextOpen]);
  const [dateInner, setDateInner] = useState<Date | null>(defaultDate ? startOfDay(defaultDate) : null);
  const date = dateProp !== undefined ? dateProp && startOfDay(dateProp) : (dateInner ?? autoDate);

  const [value, setValue] = useControllableState<Date | null>({ value: valueProp, defaultValue, onChange: onValueChange });
  const [hour12Inner, setHour12Inner] = useState<boolean | undefined>(defaultHour12);
  const hour12 = hour12Prop ?? hour12Inner ?? prefers12h(locale);
  const setHour12 = (next: boolean) => {
    if (hour12Prop === undefined) setHour12Inner(next);
    onHour12Change?.(next);
  };

  const [monthInner, setMonthInner] = useState<Date | null>(null);
  const month = monthInner ?? (date ? startOfMonth(date) : today ? startOfMonth(today) : null);
  // 1 forward, -1 back, 0 for keyboard moves that should land on the same frame.
  const [dir, setDir] = useState(1);
  const slide = useMemo<Slide>(() => ({ dir, reduce }), [dir, reduce]);
  const [focusDay, setFocusDay] = useState<Date | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [booked, setBooked] = useState<Date | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const { loaded, skeleton, retry, full } = useDaySlots(getSlots, date);

  const fmt = useMemo(() => {
    const tz = timeZone ?? undefined;
    return {
      caption: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
      weekShort: new Intl.DateTimeFormat(locale, { weekday: "short" }),
      weekLong: new Intl.DateTimeFormat(locale, { weekday: "long" }),
      dayLong: new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }),
      dayShort: new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }),
      heading: new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }),
      num: new Intl.NumberFormat(locale),
      time: new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", hour12, timeZone: tz }),
    };
  }, [locale, hour12, timeZone]);
  const weekStart = weekStartsOn ?? weekStartOf(locale);

  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        // Jan 4 2026 is a Sunday; walk from the locale's first day.
        const d = new Date(2026, 0, 4 + ((weekStart + i) % 7));
        return { short: fmt.weekShort.format(d), long: fmt.weekLong.format(d) };
      }),
    [weekStart, fmt],
  );

  const rows = useMemo(() => {
    if (!month) return null;
    const lead = (month.getDay() - weekStart + 7) % 7;
    const first = addDays(month, -lead);
    // Always six weeks, so the card never changes height between months.
    return Array.from({ length: 6 }, (_, r) => Array.from({ length: 7 }, (_, c) => addDays(first, r * 7 + c)));
  }, [month, weekStart]);

  const selectDate = (d: Date) => {
    if (disabled || !canOpen(d)) return;
    setFocusDay(d);
    if (sameDay(d, date)) return;
    if (dateProp === undefined) setDateInner(d);
    onDateChange?.(d);
    setValue(null);
    setStatus({ kind: "idle" });
    if (month && monthIndex(d) !== monthIndex(month)) showMonth(startOfMonth(d));
  };

  const showMonth = (m: Date) => {
    if (!month) return;
    setDir(monthIndex(m) > monthIndex(month) ? 1 : -1);
    setMonthInner(m);
  };

  const canPrev = !!month && !(min && monthIndex(month) <= monthIndex(min));
  const canNext = !!month && !(max && monthIndex(month) >= monthIndex(max));

  // The day that takes Tab in the grid: the focused one if it's in view, else the open day, else the first.
  const tabDay = useMemo(() => {
    if (!month || !rows) return null;
    const inView = (d: Date | null) => !!d && monthIndex(d) === monthIndex(month);
    if (inView(focusDay)) return focusDay;
    if (inView(date)) return date;
    return month;
  }, [month, rows, focusDay, date]);

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (!tabDay || !month) return;
    const map: Record<string, () => Date> = {
      ArrowLeft: () => addDays(tabDay, -1),
      ArrowRight: () => addDays(tabDay, 1),
      ArrowUp: () => addDays(tabDay, -7),
      ArrowDown: () => addDays(tabDay, 7),
      Home: () => addDays(tabDay, -((tabDay.getDay() - weekStart + 7) % 7)),
      End: () => addDays(tabDay, 6 - ((tabDay.getDay() - weekStart + 7) % 7)),
      PageUp: () => new Date(tabDay.getFullYear(), tabDay.getMonth() - 1, Math.min(tabDay.getDate(), 28)),
      PageDown: () => new Date(tabDay.getFullYear(), tabDay.getMonth() + 1, Math.min(tabDay.getDate(), 28)),
    };
    const go = map[e.key];
    if (!go) return;
    e.preventDefault();
    let next = go();
    if (min && compareDays(next, min) < 0) next = min;
    if (max && compareDays(next, max) > 0) next = startOfDay(max);
    setKeyboard(true);
    setFocusDay(next);
    if (monthIndex(next) !== monthIndex(month)) {
      // Arrow keys render the new month on the same frame: motion here reads as lag.
      setDir(0);
      setMonthInner(startOfMonth(next));
    }
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLElement>(`[data-day="${dayKey(next)}"]`)?.focus());
  };

  /* Slots ------------------------------------------------------------ */

  const slots = loaded?.status === "ready" ? loaded.slots : null;
  const selectedKey = value ? value.getTime() : null;
  const [focusSlot, setFocusSlot] = useState<number | null>(null);
  const tabSlot = slots?.some((s) => s.getTime() === focusSlot) ? focusSlot : slots?.some((s) => s.getTime() === selectedKey) ? selectedKey : (slots?.[0]?.getTime() ?? null);

  const pick = (slot: Date) => {
    if (disabled || status.kind === "busy") return;
    setStatus({ kind: "idle" });
    setValue(value && value.getTime() === slot.getTime() ? null : slot);
  };

  const confirm = async (slot: Date) => {
    if (status.kind === "busy") return;
    const at = slot.getTime();
    if (!onConfirm) {
      setBooked(slot);
      return;
    }
    setStatus({ kind: "busy", at });
    try {
      await onConfirm(slot);
      setStatus({ kind: "idle" });
      setBooked(slot);
    } catch (error) {
      setStatus({ kind: "error", at, message: error instanceof Error && error.message ? error.message : "" });
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("[data-slot]"));
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape" && value) {
      e.preventDefault();
      const el = buttons.find((b) => Number(b.dataset.slot) === value.getTime());
      setValue(null);
      setStatus({ kind: "idle" });
      el?.focus();
      return;
    }
    if (at < 0) return;
    const cols = Math.max(1, Math.round(e.currentTarget.clientWidth / buttons[0].closest("li")!.clientWidth));
    const target =
      e.key === "ArrowDown" ? at + cols : e.key === "ArrowUp" ? at - cols : e.key === "ArrowRight" && cols > 1 ? at + 1 : e.key === "ArrowLeft" && cols > 1 ? at - 1 : e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : null;
    if (target === null) return;
    e.preventDefault();
    buttons[Math.max(0, Math.min(buttons.length - 1, target))]?.focus();
  };

  const zoneLabel = timeZone ? zoneCity(timeZone) : null;
  const offsetLabel = timeZone && today ? zoneOffsetLabel(timeZone, date ?? today) : null;
  const next = date && slots && slots.length === 0 ? nextOpen(date, true, full) : null;
  const heading = date ? fmt.heading.format(date) : null;
  // "11:00 – 11:30 AM": formatRange drops the repeated day period where the locale does.
  const timeRange = (slot: Date) => fmt.time.formatRange(slot, new Date(slot.getTime() + duration * 60000));

  const announce = booked
    ? `Booked ${fmt.dayLong.format(date ?? booked)}, ${timeRange(booked)}`
    : status.kind === "error"
      ? `Couldn't book ${fmt.time.format(new Date(status.at))}`
      : slots && heading
        ? slots.length
          ? `${slots.length} ${slots.length === 1 ? "time" : "times"} available on ${heading}`
          : `No times left on ${heading}`
        : loaded?.status === "error"
          ? "Couldn't load times"
          : "";

  return (
    <div
      data-disabled={disabled || undefined}
      data-state={booked ? "booked" : value ? "picked" : "picking"}
      className={cn(
        "@container flex w-full max-w-[520px] select-none flex-col overflow-hidden rounded-xl border border-line bg-raised text-fg shadow-[var(--shadow)]",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      onPointerDown={() => setKeyboard(false)}
      {...rest}
    >
      <div className="flex flex-col @min-[500px]:flex-row">
        {/* Month ---------------------------------------------------- */}
        <div
          inert={!!booked}
          className={cn(
            "flex shrink-0 justify-center p-3 transition-opacity duration-200 @min-[500px]:border-r @min-[500px]:border-line",
            booked && "opacity-40",
          )}
        >
          <div className="flex flex-col gap-2">
            <div className="flex h-8 items-center gap-1">
              <div className="relative h-5 min-w-0 flex-1 overflow-hidden pl-1.5">
                <AnimatePresence initial={false} custom={slide} mode="popLayout">
                  {month && (
                    <motion.div
                      key={monthIndex(month)}
                      id={`${uid}-caption`}
                      custom={slide}
                      initial={slide.dir === 0 ? false : { opacity: 0, x: reduce ? 0 : slide.dir * 8 }}
                      animate={{ opacity: 1, x: 0, transition: { duration: 0.22, ease: ease.out } }}
                      exit={slide.dir === 0 ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: reduce ? 0 : slide.dir * -8, transition: { duration: 0.12 } }}
                      aria-live="polite"
                      className="truncate text-[13px] font-medium leading-5 tracking-[-0.01em]"
                    >
                      {fmt.caption.format(month)}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <NavButton side="prev" disabled={!canPrev} onClick={() => month && showMonth(addMonths(month, -1))} />
              <NavButton side="next" disabled={!canNext} onClick={() => month && showMonth(addMonths(month, 1))} />
            </div>

            <div>
              <div aria-hidden className="flex">
                {weekdays.map((d) => (
                  <span key={d.long} className="grid h-7 w-9 place-items-center text-[11px] text-fg-3 pointer-coarse:w-10">
                    {d.short}
                  </span>
                ))}
              </div>
              <div ref={gridRef} className="relative -m-1 overflow-hidden p-1">
                {month && rows ? (
                  <AnimatePresence initial={false} custom={slide} mode="popLayout">
                    <MonthGrid key={monthIndex(month)} slide={slide} captionId={`${uid}-caption`} weekdays={weekdays} onKeyDown={onGridKeyDown}>
                      {rows.map((row, r) => (
                        <tr key={r}>
                          {row.map((d) => {
                            const outside = monthIndex(d) !== monthIndex(month);
                            if (outside) return <td key={dayKey(d)} role="presentation" className="size-9 p-0 pointer-coarse:size-10" />;
                            const open = canOpen(d);
                            const isFull = open && full.has(dayKey(d));
                            const selected = sameDay(d, date);
                            const isToday = sameDay(d, today);
                            return (
                              <td key={dayKey(d)} role="gridcell" aria-selected={selected} className="relative size-9 p-0 pointer-coarse:size-10">
                                <button
                                  type="button"
                                  data-day={dayKey(d)}
                                  data-open={open || undefined}
                                  tabIndex={sameDay(d, tabDay) ? 0 : -1}
                                  aria-label={`${fmt.dayLong.format(d)}${!open ? ", unavailable" : isFull ? ", fully booked" : ""}`}
                                  aria-current={isToday ? "date" : undefined}
                                  aria-disabled={!open || undefined}
                                  onClick={() => selectDate(d)}
                                  onFocus={() => setFocusDay(d)}
                                  className={cn(
                                    "group/day relative grid size-9 place-items-center rounded-lg text-[13px] tabular outline-none pointer-coarse:size-10",
                                    "transition-[background-color,color,scale] duration-150 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                                    !open
                                      ? "cursor-default text-fg-4"
                                      : selected
                                        ? "font-medium text-frame"
                                        : isFull
                                          ? "text-fg-3 line-through decoration-fg-4 hover:bg-hover active:scale-[0.92] active:duration-75"
                                          : "bg-fg/[0.06] font-medium text-fg hover:bg-fg/[0.11] active:scale-[0.92] active:duration-75",
                                  )}
                                >
                                  {selected && (
                                    <motion.span
                                      layoutId="day"
                                      aria-hidden
                                      className="absolute inset-0 rounded-lg bg-fg"
                                      transition={reduce || keyboard ? { duration: 0 } : spring.snappy}
                                    />
                                  )}
                                  <span className="relative">{fmt.num.format(d.getDate())}</span>
                                  {isToday && <span aria-hidden className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current opacity-70" />}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </MonthGrid>
                  </AnimatePresence>
                ) : (
                  <div aria-hidden className="h-[228px] w-[252px] pointer-coarse:h-[252px] pointer-coarse:w-[280px]" />
                )}
              </div>
          </div>
          </div>
        </div>

        {/* Times ---------------------------------------------------- */}
        <div className="relative min-h-0 min-w-0 flex-1 border-t border-line @min-[500px]:border-t-0">
          <div className="flex flex-col @min-[500px]:absolute @min-[500px]:inset-0">
            <div className="flex h-14 shrink-0 flex-col justify-center px-3">
              <p className="truncate text-[13px] font-medium leading-5 tracking-[-0.01em]" suppressHydrationWarning>
                {heading ?? " "}
              </p>
              <p className="text-[12px] leading-4 text-fg-3 tabular">
                {fmt.num.format(duration)} min
                {slots && slots.length > 0 && !booked && (
                  <span className="text-fg-4">
                    {" · "}
                    {slots.length} open
                  </span>
                )}
              </p>
            </div>

            <div className="relative min-h-0 flex-1">
              <AnimatePresence initial={false} mode="popLayout">
                {booked ? (
                  <Booked
                    key="booked"
                    reduce={reduce}
                    range={timeRange(booked)}
                    zone={zoneLabel}
                    onChange={() => {
                      setBooked(null);
                      setValue(null);
                    }}
                  />
                ) : slots ? (
                  slots.length ? (
                    <motion.ul
                      key={`list-${loaded?.key}`}
                      role="list"
                      aria-label={heading ? `Available times, ${heading}` : "Available times"}
                      onKeyDown={onListKeyDown}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      className={cn(
                        "grid max-h-[232px] grid-cols-[repeat(auto-fill,minmax(148px,1fr))] content-start gap-1.5 overflow-y-auto overscroll-contain px-3 pt-1 pb-6 @min-[500px]:absolute @min-[500px]:inset-0 @min-[500px]:max-h-none",
                        "[mask-image:linear-gradient(to_bottom,var(--fg)_calc(100%-28px),transparent)]",
                      )}
                    >
                      {slots.map((slot, i) => {
                        const at = slot.getTime();
                        const selected = at === selectedKey;
                        const busy = status.kind === "busy" && status.at === at;
                        const failed = status.kind === "error" && status.at === at;
                        const label = fmt.time.format(slot);
                        return (
                          <motion.li
                            key={at}
                            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            transition={{ duration: reduce ? 0.15 : 0.26, ease: ease.out, delay: Math.min(i, 8) * 0.02 }}
                            className="flex flex-col"
                          >
                            <SlotRow
                              at={at}
                              label={label}
                              selected={selected}
                              busy={busy}
                              failed={failed}
                              tabbable={at === tabSlot}
                              confirmLabel={failed ? "Try again" : confirmLabel}
                              confirmName={`${failed ? "Try again" : confirmLabel}: ${heading}, ${timeRange(slot)}`}
                              slotName={`${label}, ${heading}`}
                              onPick={() => pick(slot)}
                              onConfirm={() => confirm(slot)}
                              onFocus={() => setFocusSlot(at)}
                            />
                            <AnimatePresence initial={false}>
                              {failed && (
                                <motion.p
                                  role="alert"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0, transition: { duration: 0.12 } }}
                                  transition={{ duration: 0.2, ease: ease.out }}
                                  className="overflow-hidden text-[12px] leading-4 text-danger"
                                >
                                  <span className="block pt-1.5 pb-0.5">{status.kind === "error" && status.message ? status.message : "Couldn’t book this time. Pick another or try again."}</span>
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </motion.li>
                        );
                      })}
                    </motion.ul>
                  ) : (
                    <Message key={`empty-${loaded?.key}`} reduce={reduce} title="No times left on this day">
                      {next ? (
                        <button type="button" onClick={() => selectDate(next)} className={cn(secondaryButton, "gap-1.5")}>
                          Next available, {fmt.dayShort.format(next)}
                          <ArrowRight size={14} className="text-fg-3 transition-transform duration-200 ease-out-expo group-hover/btn:translate-x-0.5" />
                        </button>
                      ) : (
                        <p className="text-[12px] text-fg-3">Nothing else is open yet.</p>
                      )}
                    </Message>
                  )
                ) : loaded?.status === "error" ? (
                  <Message key="error" reduce={reduce} title="Couldn’t load times" tone="danger" detail={loaded.message || "Check your connection and try again."}>
                    <button type="button" onClick={retry} className={cn(secondaryButton, "gap-1.5")}>
                      <Refresh size={14} className="text-fg-3 transition-transform duration-300 ease-out-expo group-active/btn:-rotate-45" />
                      Try again
                    </button>
                  </Message>
                ) : skeleton ? (
                  <motion.div
                    key="skeleton"
                    aria-hidden
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] content-start gap-1.5 px-3 pt-1"
                  >
                    {Array.from({ length: 5 }, (_, i) => (
                      <span key={i} className="h-9 animate-pulse-soft rounded-lg bg-hover" style={{ animationDelay: `${i * 120}ms` }} />
                    ))}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Zone ------------------------------------------------------- */}
      <div className="flex min-h-10 items-center gap-2 border-t border-line py-1 pr-1.5 pl-3">
        <Globe size={14} className="shrink-0 text-fg-3" />
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px]">
          {timeZoneControl ?? (
            <>
              <span className="truncate text-fg-2">
                {zoneLabel ? (
                  <>
                    Times in <span className="text-fg">{zoneLabel}</span>
                  </>
                ) : (
                  <span className="inline-block h-3 w-28 rounded bg-hover align-middle" />
                )}
              </span>
              {offsetLabel && <span className="shrink-0 font-mono text-2xs text-fg-4">{offsetLabel}</span>}
            </>
          )}
        </div>
        <HourToggle hour12={hour12} onChange={setHour12} reduce={reduce} />
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const secondaryButton = cn(
  "group/btn inline-flex h-8 items-center rounded-lg border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg shadow-[var(--shadow)]",
  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
  "transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75",
);

function MonthGrid({
  slide,
  captionId,
  weekdays,
  onKeyDown,
  children,
}: {
  slide: Slide;
  captionId: string;
  weekdays: { short: string; long: string }[];
  onKeyDown: (e: React.KeyboardEvent) => void;
  children: React.ReactNode;
}) {
  // A grid on its way out lingers for its exit; it must not take focus or clicks.
  const present = useIsPresent();
  const instant = slide.dir === 0;
  return (
    <LayoutGroup id={captionId + String(present)}>
      <motion.table
        role="grid"
        aria-labelledby={captionId}
        inert={!present}
        custom={slide}
        variants={gridVariants}
        initial={instant ? false : "enter"}
        animate="center"
        exit={instant ? { opacity: 0, transition: { duration: 0 } } : "exit"}
        onKeyDown={onKeyDown}
        className="border-separate border-spacing-0"
      >
        <thead className="sr-only">
          <tr>
            {weekdays.map((d) => (
              <th key={d.long} scope="col" abbr={d.long}>
                {d.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </motion.table>
    </LayoutGroup>
  );
}

function NavButton({ side, disabled, onClick }: { side: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  const Icon = side === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "prev" ? "Previous month" : "Next month"}
      className={cn(
        "group/nav grid size-7 shrink-0 place-items-center rounded-md text-fg-2 outline-none pointer-coarse:size-10",
        "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "disabled:pointer-events-none disabled:opacity-35",
      )}
    >
      <Icon
        className={cn(
          "transition-transform duration-200 ease-out-expo",
          side === "prev" ? "group-hover/nav:-translate-x-px group-active/nav:-translate-x-0.5" : "group-hover/nav:translate-x-px group-active/nav:translate-x-0.5",
        )}
      />
    </button>
  );
}

/**
 * One slot. Picking it splits the row in place: the time slides into the left half and Confirm
 * opens in the right, by transitioning the grid's second track from 0fr to 1fr. Real widths, so
 * nothing is stretched mid-flight and nothing around the row moves.
 */
function SlotRow({
  at,
  label,
  selected,
  busy,
  failed,
  tabbable,
  confirmLabel,
  confirmName,
  slotName,
  onPick,
  onConfirm,
  onFocus,
}: {
  at: number;
  label: string;
  selected: boolean;
  busy: boolean;
  failed: boolean;
  tabbable: boolean;
  confirmLabel: string;
  confirmName: string;
  slotName: string;
  onPick: () => void;
  onConfirm: () => void;
  onFocus: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  return (
    <div
      data-selected={selected || undefined}
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_minmax(0,0fr)] transition-[grid-template-columns] duration-200 ease-out-quart",
        "data-selected:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] data-selected:duration-[320ms] data-selected:ease-out-expo",
      )}
    >
      <button
        type="button"
        data-slot={at}
        aria-pressed={selected}
        aria-label={slotName}
        tabIndex={tabbable ? 0 : -1}
        onFocus={onFocus}
        onClick={onPick}
        onKeyDown={(e) => {
          // Enter on a picked slot moves straight to Confirm, so booking is two presses.
          if (selected && e.key === "Enter") {
            e.preventDefault();
            confirmRef.current?.focus();
          }
        }}
        disabled={busy}
        className={cn(
          "relative h-9 min-w-0 rounded-lg border text-[13px] font-medium tabular outline-none pointer-coarse:h-10",
          "transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.97] active:duration-75",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          selected ? "border-transparent bg-fg/[0.08] text-fg-2" : "border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover",
          "disabled:active:scale-100",
        )}
      >
        <span className="block truncate px-2">{label}</span>
      </button>
      <div className="min-w-0 overflow-hidden">
        <div className="pl-1.5">
          <button
            ref={confirmRef}
            type="button"
            inert={!selected}
            aria-hidden={!selected || undefined}
            aria-label={confirmName}
            aria-busy={busy || undefined}
            tabIndex={selected ? 0 : -1}
            onClick={onConfirm}
            data-busy={busy || undefined}
            className={cn(
              "group/confirm relative grid h-9 w-full min-w-0 place-items-center rounded-lg text-[13px] font-medium outline-none pointer-coarse:h-10",
              "transition-[background-color,opacity,translate,scale] duration-200 ease-out-expo active:scale-[0.97] active:duration-75",
              // The half it lives in clips, so its focus ring is drawn inside the fill instead of around it.
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-4 focus-visible:outline-frame/80",
              "bg-fg text-frame hover:bg-fg/90",
              // It arrives a beat after the split starts, from the seam, and leaves at once.
              selected ? "translate-x-0 opacity-100 delay-75" : "-translate-x-2 opacity-0 duration-100",
              "data-busy:pointer-events-none",
            )}
          >
            <span className="col-start-1 row-start-1 truncate px-2 transition-opacity duration-150 group-data-busy/confirm:opacity-0 group-data-busy/confirm:delay-150">{confirmLabel}</span>
            <span className="col-start-1 row-start-1 opacity-0 transition-opacity duration-150 group-data-busy/confirm:opacity-100 group-data-busy/confirm:delay-150">
              <Loader size={14} className="animate-spin" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Message({ title, detail, tone, reduce, children }: { title: string; detail?: string; tone?: "danger"; reduce: boolean; children?: React.ReactNode }) {
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
      transition={{ duration: 0.22, ease: ease.out }}
      className="flex flex-col items-start gap-3 px-3 pt-1 pb-4"
    >
      <div className="flex flex-col gap-0.5">
        <p className={cn("text-[13px] leading-5", tone === "danger" ? "text-danger" : "text-fg-2")}>{title}</p>
        {detail && <p className="text-[12px] leading-4 text-fg-3">{detail}</p>}
      </div>
      {children}
    </motion.div>
  );
}

function Booked({ range, zone, reduce, onChange }: { range: string; zone: string | null; reduce: boolean; onChange: () => void }) {
  const draw = reduce ? {} : { initial: { pathLength: 0 }, animate: { pathLength: 1 } };
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, filter: "blur(2px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
      transition={{ duration: 0.26, ease: ease.out }}
      className="flex flex-col items-start gap-3 px-3 pt-1 pb-4"
    >
      <span className="grid size-8 place-items-center rounded-full bg-success-soft text-success">
        <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" {...draw} transition={{ duration: 0.34, ease: ease.out, delay: 0.12 }} />
        </svg>
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-[13px] font-medium leading-5">Booked</p>
        <p className="text-[12.5px] leading-[18px] text-fg-2 tabular">
          {range}
          {zone && <span className="text-fg-3"> · {zone}</span>}
        </p>
      </div>
      <button type="button" onClick={onChange} className={secondaryButton}>
        Change time
      </button>
    </motion.div>
  );
}

/** 12h / 24h, with one pill that slides between the two. */
function HourToggle({ hour12, onChange, reduce }: { hour12: boolean; onChange: (v: boolean) => void; reduce: boolean }) {
  const id = useId();
  return (
    <ToggleGroup
      value={[hour12 ? "12" : "24"]}
      onValueChange={(v) => v[0] && onChange(v[0] === "12")}
      aria-label="Clock format"
      className="relative flex h-7 shrink-0 items-center rounded-md bg-fg/[0.05] p-0.5"
    >
      {(["12", "24"] as const).map((v) => {
        const on = (v === "12") === hour12;
        return (
          <Toggle
            key={v}
            value={v}
            aria-label={v === "12" ? "12-hour clock" : "24-hour clock"}
            className={cn(
              "relative h-6 rounded-[5px] px-2 font-mono text-2xs outline-none",
              "transition-[color,scale] duration-150 active:scale-[0.94] active:duration-75",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
              "pointer-coarse:after:absolute pointer-coarse:after:-inset-2 pointer-coarse:after:content-['']",
              on ? "text-fg" : "text-fg-3 hover:text-fg-2",
            )}
          >
            {on && (
              <motion.span
                layoutId={`${id}-pill`}
                aria-hidden
                className="absolute inset-0 rounded-[5px] border border-line-2 bg-raised shadow-[var(--shadow)]"
                transition={reduce ? { duration: 0 } : spring.snappy}
              />
            )}
            <span className="relative">{v}h</span>
          </Toggle>
        );
      })}
    </ToggleGroup>
  );
}
