"use client";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* ------------------------------------------------------------------ */
/* Plain-date helpers. Every Date here is local midnight; math goes    */
/* through the calendar fields, never milliseconds, so DST can't bite. */
/* ------------------------------------------------------------------ */

export type DateRange = { start: Date; end: Date | null };

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
/** Adds months and clamps the day, so Jan 31 + 1 month is Feb 28, not Mar 3. */
export function addMonths(d: Date, n: number) {
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), daysInMonth(first.getFullYear(), first.getMonth())));
}
const dayNum = (d: Date) => d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
export const compareDays = (a: Date, b: Date) => dayNum(a) - dayNum(b);
export const isSameDay = (a: Date | null | undefined, b: Date | null | undefined) => !!a && !!b && dayNum(a) === dayNum(b);
/** Whole days from a to b, DST-safe. */
export const diffDays = (a: Date, b: Date) =>
  Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5);
const pad = (n: number, w = 2) => String(n).padStart(w, "0");
export const toISODate = (d: Date) => `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function parseISODate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getMonth() === +m[2] - 1 ? d : null;
}
const clampDate = (d: Date, min?: Date, max?: Date) =>
  min && compareDays(d, min) < 0 ? startOfDay(min) : max && compareDays(d, max) > 0 ? startOfDay(max) : d;
const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();

// Regions whose week starts on Sunday or Saturday, for browsers without Intl week info.
const SUNDAY = new Set("AG AS BD BR BS BT BW BZ CA CN CO DM DO ET GT GU HK HN ID IL IN JM JP KE KH KR LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PT PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW".split(" "));
const SATURDAY = new Set("AE AF BH DJ DZ EG IQ IR JO KW LY OM QA SD SY".split(" "));

/** First day of the week for a locale, 0 = Sunday. */
export function getWeekStart(locale: string): number {
  try {
    const l = new Intl.Locale(locale) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
    const info = l.getWeekInfo?.() ?? l.weekInfo;
    if (info) return info.firstDay % 7;
    const region = l.maximize().region ?? "";
    return SUNDAY.has(region) ? 0 : SATURDAY.has(region) ? 6 : 1;
  } catch {
    return 0;
  }
}

/* Today and the viewer's locale are only known in the browser. Both read  */
/* null / en-US on the server and settle on hydration without a mismatch. */

function subscribeToday(notify: () => void) {
  let timer = 0;
  const arm = () => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    timer = window.setTimeout(() => (notify(), arm()), midnight.getTime() - now.getTime() + 50);
  };
  arm();
  const onVisible = () => document.visibilityState === "visible" && notify();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

/** Today at local midnight, rolling over at midnight. Null during server render. */
export function useToday(): Date | null {
  const key = useSyncExternalStore(subscribeToday, () => toISODate(new Date()), () => null);
  return useMemo(() => (key ? parseISODate(key) : null), [key]);
}

function subscribeLanguage(notify: () => void) {
  window.addEventListener("languagechange", notify);
  return () => window.removeEventListener("languagechange", notify);
}

/** The locale prop, or the browser's language once hydrated. */
export function useResolvedLocale(locale?: string) {
  const browser = useSyncExternalStore(subscribeLanguage, () => navigator.language, () => "en-US");
  return locale ?? browser;
}

/* ------------------------------------------------------------------ */

type Base = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "children" | "dir"> & {
  /** First visible month (controlled). */
  month?: Date;
  defaultMonth?: Date;
  onMonthChange?: (month: Date) => void;
  /** Months shown side by side. They stack under 640px. */
  numberOfMonths?: number;
  min?: Date;
  max?: Date;
  /** Return true for days that can't be picked (booked, weekends, holidays). */
  isDateDisabled?: (date: Date) => boolean;
  /** BCP 47 tag. Defaults to the browser's language. Drives names, digits and the week start. */
  locale?: string;
  /** Override the locale's first day of the week, 0 = Sunday. */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Faint days from the neighboring months. Defaults to on for one month, off for several. */
  showOutsideDays?: boolean;
  /** Always six rows, so the height never jumps between months. */
  fixedWeeks?: boolean;
  showWeekNumbers?: boolean;
  disabled?: boolean;
  /** Navigable and readable, but days can't be picked. */
  readOnly?: boolean;
  /** Move focus to the selected (or today's) day on mount. Use inside popovers. */
  autoFocus?: boolean;
  /** Drop the card chrome, for use inside a popover or another surface. */
  bare?: boolean;
  /** Visible and accessible strings, for translation. */
  labels?: { today?: string; previousMonth?: string; nextMonth?: string };
};

export type CalendarSingleProps = Base & {
  mode?: "single";
  value?: Date | null;
  defaultValue?: Date | null;
  onValueChange?: (date: Date | null) => void;
  maxDays?: never;
};

export type CalendarRangeProps = Base & {
  mode: "range";
  /** end is null while the second day is being picked. */
  value?: DateRange | null;
  defaultValue?: DateRange | null;
  onValueChange?: (range: DateRange | null) => void;
  /** Longest range allowed, in days. Days further from the start are disabled while picking the end. */
  maxDays?: number;
};

export type CalendarProps = CalendarSingleProps | CalendarRangeProps;

type AnyValue = Date | DateRange | null;
type Band = { kind: "mid" | "start" | "end"; roundL: boolean; roundR: boolean; preview: boolean; delay: number } | null;
type Cell = {
  date: Date;
  key: string;
  label: string;
  numeral: string;
  outside: boolean;
  hidden: boolean;
  today: boolean;
  selected: boolean;
  endpoint: boolean;
  disabled: boolean;
  /** Disabled by isDateDisabled (booked, closed), not merely outside min/max. */
  unavailable: boolean;
  tabbable: boolean;
  band: Band;
  /** The end of a swept range lands once the band reaches it. */
  landsLate: boolean;
};

type Slide = { dir: number; instant: boolean; reduce: boolean };
const DISTANCE = 28;
const gridVariants = {
  enter: (c: Slide) => (c.instant ? { opacity: 1, x: 0 } : c.reduce ? { opacity: 0, x: 0 } : { opacity: 0, x: c.dir * DISTANCE }),
  center: (c: Slide) => ({ opacity: 1, x: 0, transition: { duration: c.instant ? 0 : c.reduce ? 0.15 : 0.26, ease: ease.out } }),
  exit: (c: Slide) =>
    c.instant
      ? { opacity: 0, transition: { duration: 0 } }
      : c.reduce
        ? { opacity: 0, transition: { duration: 0.1 } }
        : { opacity: 0, x: c.dir * -DISTANCE, transition: { duration: 0.16, ease: ease.out } },
};
const captionVariants = {
  enter: (c: Slide) => (c.instant ? { opacity: 1, x: 0 } : c.reduce ? { opacity: 0 } : { opacity: 0, x: c.dir * 10, filter: "blur(2px)" }),
  center: (c: Slide) => ({ opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: c.instant ? 0 : 0.24, ease: ease.out } }),
  exit: (c: Slide) =>
    c.instant ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: c.reduce ? 0 : c.dir * -10, filter: c.reduce ? "blur(0px)" : "blur(2px)", transition: { duration: 0.14, ease: ease.in } },
};

const SWEEP_CSS = "@keyframes stealth-calendar-sweep{from{opacity:0}}";
/** How long a swept range takes to travel from its first day to its last, in ms. */
const SWEEP_MS = 280;

export function Calendar(props: CalendarProps) {
  const {
    mode = "single",
    value: valueProp,
    defaultValue,
    onValueChange,
    month: monthProp,
    defaultMonth,
    onMonthChange,
    numberOfMonths = 1,
    min,
    max,
    isDateDisabled,
    maxDays,
    locale: localeProp,
    weekStartsOn,
    showOutsideDays = numberOfMonths === 1,
    fixedWeeks = true,
    showWeekNumbers = false,
    disabled = false,
    readOnly = false,
    autoFocus = false,
    bare = false,
    labels,
    className,
    onPointerDown,
    ...rest
  } = props as Base & {
    mode?: "single" | "range";
    value?: AnyValue;
    defaultValue?: AnyValue;
    onValueChange?: (v: AnyValue) => void;
    maxDays?: number;
  };

  const uid = useId();
  const reduce = !!useReducedMotion();
  const today = useToday();
  const locale = useResolvedLocale(localeProp);
  const weekStart = useMemo(() => weekStartsOn ?? getWeekStart(locale), [weekStartsOn, locale]);
  const fmt = useMemo(
    () => ({
      caption: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
      day: new Intl.DateTimeFormat(locale, { day: "numeric" }),
      full: new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      weekShort: new Intl.DateTimeFormat(locale, { weekday: "short" }),
      weekLong: new Intl.DateTimeFormat(locale, { weekday: "long" }),
      num: new Intl.NumberFormat(locale),
    }),
    [locale],
  );

  const [value, setValue] = useControllableState<AnyValue>({ value: valueProp, defaultValue: defaultValue ?? null, onChange: onValueChange });
  const single = mode === "single" ? (value as Date | null) : null;
  const range = mode === "range" ? (value as DateRange | null) : null;

  const [monthState, setMonthState] = useControllableState<Date | null>({
    value: monthProp,
    defaultValue: defaultMonth ? startOfMonth(defaultMonth) : null,
    onChange: onMonthChange ? (m) => m && onMonthChange(m) : undefined,
  });
  const anchor = single ?? range?.start ?? today;
  const month = monthState ? startOfMonth(monthState) : anchor ? startOfMonth(anchor) : null;
  const lastMonth = month ? addMonths(month, numberOfMonths - 1) : null;
  const inView = (d: Date) => !!month && !!lastMonth && monthIndex(d) >= monthIndex(month) && monthIndex(d) <= monthIndex(lastMonth);

  // Direction of travel, derived whenever the visible month changes, whoever changed it.
  const mKey = month ? monthIndex(month) : null;
  const [nav, setNav] = useState<{ key: number | null; dir: number }>({ key: mKey, dir: 1 });
  if (nav.key !== mKey) setNav({ key: mKey, dir: nav.key == null || mKey == null ? 1 : Math.sign(mKey - nav.key) || 1 });
  // Keyboard-driven month changes render instantly; pointer ones slide.
  const [instant, setInstant] = useState(false);
  const slide: Slide = { dir: nav.key !== mKey && nav.key != null && mKey != null ? Math.sign(mKey - nav.key) || 1 : nav.dir, instant, reduce };

  const isDisabled = (d: Date) =>
    (min && compareDays(d, min) < 0) ||
    (max && compareDays(d, max) > 0) ||
    !!isDateDisabled?.(d) ||
    (!!maxDays && !!range && !range.end && Math.abs(diffDays(range.start, d)) >= maxDays);

  // Roving focus: one day is tabbable. Falls back to the selection, then today, then the 1st.
  const [focusedState, setFocused] = useState<Date | null>(null);
  const selectedAnchor = single ?? range?.start ?? null;
  const focused = month
    ? focusedState && inView(focusedState)
      ? focusedState
      : clampDate(selectedAnchor && inView(selectedAnchor) ? selectedAnchor : today && inView(today) ? today : month, min, max)
    : null;
  const [keyboard, setKeyboard] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ key: string; n: number } | null>(autoFocus ? { key: "", n: 1 } : null);

  // Range preview: while the end is being picked, the band follows the pointer (or keyboard focus).
  const [hover, setHover] = useState<Date | null>(null);
  const pendingStart = range && !range.end ? range.start : null;
  const previewEnd = pendingStart ? (hover ?? (keyboard ? focused : null)) : null;
  let bandFrom: Date | null = null;
  let bandTo: Date | null = null;
  if (range?.end) [bandFrom, bandTo] = [range.start, range.end];
  else if (pendingStart && previewEnd) [bandFrom, bandTo] = compareDays(previewEnd, pendingStart) < 0 ? [previewEnd, pendingStart] : [pendingStart, previewEnd];
  const previewing = !!pendingStart;

  // A range that arrives from outside (a preset, a typed value) sweeps in from its start.
  // Ranges the person just drew with the pointer were already visible as a preview, so they don't.
  const rangeKey = range ? `${toISODate(range.start)}:${range.end ? toISODate(range.end) : ""}` : "";
  const [own, setOwn] = useState<string | null>(null);
  const [seen, setSeen] = useState(rangeKey);
  const [sweep, setSweep] = useState<{ id: number; key: string } | null>(null);
  if (seen !== rangeKey) {
    setSeen(rangeKey);
    if (range?.end && rangeKey !== own && !isSameDay(range.start, range.end)) setSweep({ id: (sweep?.id ?? 0) + 1, key: rangeKey });
  }
  useEffect(() => {
    if (!sweep) return;
    const t = window.setTimeout(() => setSweep(null), 700);
    return () => window.clearTimeout(t);
  }, [sweep]);
  const sweeping = !reduce && sweep?.key === rangeKey;
  const sweepSpan = bandFrom && bandTo ? Math.max(1, diffDays(bandFrom, bandTo)) : 1;

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusRequest) return;
    const root = rootRef.current;
    const el = focusRequest.key
      ? root?.querySelector<HTMLElement>(`[data-present="true"] [data-day="${focusRequest.key}"]:not([data-outside])`)
      : root?.querySelector<HTMLElement>(`[data-present="true"] [data-day][tabindex="0"]`);
    el?.focus();
  }, [focusRequest]);

  function go(delta: number) {
    if (!month) return;
    setInstant(false);
    setKeyboard(false);
    setMonthState(addMonths(month, delta));
    setFocused((f) => (f ? addMonths(f, delta) : null));
  }

  function goToday() {
    if (!today) return;
    setInstant(false);
    setMonthState(addMonths(startOfMonth(today), -(numberOfMonths - 1)));
    setFocused(today);
  }

  function moveFocus(target: Date) {
    if (!month) return;
    const t = clampDate(target, min, max);
    setKeyboard(true);
    setFocused(t);
    setFocusRequest((r) => ({ key: toISODate(t), n: (r?.n ?? 0) + 1 }));
    if (!inView(t)) {
      setInstant(true);
      setMonthState(compareDays(t, month) < 0 ? startOfMonth(t) : addMonths(startOfMonth(t), -(numberOfMonths - 1)));
    }
  }

  function select(d: Date, outside: boolean) {
    setFocused(d);
    if (outside) {
      setInstant(false);
      setMonthState(compareDays(d, month!) < 0 ? startOfMonth(d) : addMonths(startOfMonth(d), -(numberOfMonths - 1)));
    }
    if (readOnly || disabled || isDisabled(d)) return;
    if (mode === "single") {
      if (!isSameDay(single, d)) setValue(d);
      return;
    }
    let next: DateRange;
    if (!range || range.end) next = { start: d, end: null };
    else next = compareDays(d, range.start) < 0 ? { start: d, end: range.start } : { start: range.start, end: d };
    setOwn(`${toISODate(next.start)}:${next.end ? toISODate(next.end) : ""}`);
    setHover(null);
    setValue(next);
  }

  function onGridKeyDown(e: React.KeyboardEvent) {
    if (!focused || e.altKey || e.metaKey || e.ctrlKey) return;
    const col = (focused.getDay() - weekStart + 7) % 7;
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      PageUp: () => addMonths(focused, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focused, e.shiftKey ? 12 : 1),
      Home: () => addDays(focused, -col),
      End: () => addDays(focused, 6 - col),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    moveFocus(move());
  }

  function buildMonth(m: Date): Cell[][] {
    const first = startOfMonth(m);
    const offset = (first.getDay() - weekStart + 7) % 7;
    const count = daysInMonth(m.getFullYear(), m.getMonth());
    const weeks = fixedWeeks ? 6 : Math.ceil((offset + count) / 7);
    const rows: Cell[][] = [];
    for (let w = 0; w < weeks; w++) {
      const row: Cell[] = [];
      for (let c = 0; c < 7; c++) {
        const date = addDays(first, w * 7 + c - offset);
        const outside = date.getMonth() !== m.getMonth();
        const dis = !!isDisabled(date);
        const unavailable = !!isDateDisabled?.(date);
        const isToday = isSameDay(date, today);
        let selected = false;
        let endpoint = false;
        let band: Band = null;
        if (!outside) {
          if (single) selected = isSameDay(date, single);
          if (range) {
            const isStart = isSameDay(date, range.start) || (previewing && isSameDay(date, bandFrom));
            const isEnd = isSameDay(date, range.end) || (previewing && isSameDay(date, bandTo));
            selected = isSameDay(date, range.start) || isSameDay(date, range.end);
            endpoint = isStart || isEnd;
            if (bandFrom && bandTo && !isSameDay(bandFrom, bandTo) && compareDays(date, bandFrom) >= 0 && compareDays(date, bandTo) <= 0) {
              const edgeL = c === 0 || date.getDate() === 1;
              const edgeR = c === 6 || date.getDate() === count;
              const kind = isSameDay(date, bandFrom) ? "start" : isSameDay(date, bandTo) ? "end" : "mid";
              // A start at the end of a row (or an end at the start of one) has nothing to connect to.
              if (!((kind === "start" && edgeR) || (kind === "end" && edgeL))) {
                band = { kind, roundL: edgeL, roundR: edgeR, preview: previewing, delay: (diffDays(bandFrom, date) / sweepSpan) * SWEEP_MS };
              }
            }
          }
        }
        const key = toISODate(date);
        row.push({
          date,
          key,
          label: fmt.full.format(date),
          // Just the day part: ja-JP formats a bare day as 22日, which crowds the grid.
          numeral: fmt.day.formatToParts(date).find((p) => p.type === "day")?.value ?? String(date.getDate()),
          outside,
          hidden: outside && !showOutsideDays,
          today: isToday,
          selected,
          endpoint,
          disabled: dis,
          unavailable,
          tabbable: !disabled && !outside && isSameDay(date, focused),
          band,
          landsLate: sweeping && !!range?.end && isSameDay(date, range.end),
        });
      }
      rows.push(row);
    }
    return rows;
  }

  const weekdays = useMemo(() => {
    // Jan 4 2026 is a Sunday; walk from the locale's first day.
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2026, 0, 4 + ((weekStart + i) % 7));
      return { short: fmt.weekShort.format(d), long: fmt.weekLong.format(d) };
    });
  }, [weekStart, fmt]);

  const canPrev = !!month && !(min && monthIndex(month) <= monthIndex(min));
  const canNext = !!lastMonth && !(max && monthIndex(lastMonth) >= monthIndex(max));
  const todayInView = !!today && inView(today);
  const multi = numberOfMonths > 1;

  return (
    <div
      ref={rootRef}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
      data-mode={mode}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        setKeyboard(false);
      }}
      className={cn(
        "inline-flex select-none flex-col text-fg",
        !bare && "rounded-xl border border-line bg-raised p-3 shadow-[var(--shadow)]",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      {...rest}
    >
      {/* Hoisted and deduped by React: the one keyframe the range sweep needs. */}
      <style href="stealth-calendar" precedence="default">
        {SWEEP_CSS}
      </style>
      <div className={cn("flex flex-col gap-5", multi && "sm:flex-row sm:gap-6")}>
        {Array.from({ length: numberOfMonths }, (_, i) => {
          const m = month ? addMonths(month, i) : null;
          const first = i === 0;
          const last = i === numberOfMonths - 1;
          const captionId = `${uid}-caption-${i}`;
          return (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex h-8 items-center gap-1">
                {multi && (first ? <NavButton side="prev" label={labels?.previousMonth} disabled={!canPrev || disabled} onClick={() => go(-1)} /> : <span className="size-7 shrink-0 pointer-coarse:size-10" />)}
                <div className={cn("relative h-5 min-w-0 flex-1 overflow-hidden", multi ? "text-center" : "pl-1.5")}>
                  <AnimatePresence initial={false} custom={slide} mode="popLayout">
                    {m && (
                      <motion.div
                        key={monthIndex(m)}
                        id={captionId}
                        custom={slide}
                        variants={captionVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        aria-live={first ? "polite" : undefined}
                        className="truncate text-[13px] font-medium leading-5 tracking-[-0.01em]"
                      >
                        {fmt.caption.format(m)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {!multi && (
                  <AnimatePresence initial={false}>
                    {today && !todayInView && (
                      <motion.button
                        type="button"
                        key="today"
                        onClick={goToday}
                        disabled={disabled}
                        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, filter: "blur(2px)" }}
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
                        transition={{ duration: 0.2, ease: ease.out }}
                        className="h-7 shrink-0 rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.95] active:duration-75 pointer-coarse:h-10"
                      >
                        {labels?.today ?? "Today"}
                      </motion.button>
                    )}
                  </AnimatePresence>
                )}
                {!multi && <NavButton side="prev" label={labels?.previousMonth} disabled={!canPrev || disabled} onClick={() => go(-1)} />}
                {(!multi || last) && <NavButton side="next" label={labels?.nextMonth} disabled={!canNext || disabled} onClick={() => go(1)} />}
                {multi && !last && <span className="size-7 shrink-0 pointer-coarse:size-10" />}
              </div>

              <div>
              {/* Weekday names stay put while the days slide under them. The grid keeps its own (visually hidden)
                  column headers for screen readers. */}
              <div aria-hidden className="flex">
                {showWeekNumbers && <span className="grid h-7 w-7 place-items-center font-mono text-[10px] uppercase tracking-[0.06em] text-fg-4">Wk</span>}
                {weekdays.map((d) => (
                  <span key={d.long} className="grid h-7 w-9 place-items-center text-[11px] text-fg-3 pointer-coarse:w-11">
                    {d.short}
                  </span>
                ))}
              </div>
              <div className="relative -m-1 overflow-hidden p-1">
                {m ? (
                  <AnimatePresence initial={false} custom={slide} mode="popLayout">
                    <MonthGrid
                      key={monthIndex(m)}
                      slide={slide}
                      rows={buildMonth(m)}
                      weekdays={weekdays}
                      captionId={captionId}
                      weekNumbers={showWeekNumbers}
                      num={fmt.num}
                      sweeping={sweeping}
                      sweepId={sweep?.id ?? 0}
                      readOnly={readOnly}
                      onKeyDown={onGridKeyDown}
                      onSelect={select}
                      onHover={previewing ? setHover : undefined}
                    />
                  </AnimatePresence>
                ) : (
                  <GridPlaceholder weekNumbers={showWeekNumbers} />
                )}
              </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NavButton({ side, label, disabled, onClick }: { side: "prev" | "next"; label?: string; disabled: boolean; onClick: () => void }) {
  const Icon = side === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label ?? (side === "prev" ? "Previous month" : "Next month")}
      className={cn(
        "group/nav grid size-7 shrink-0 place-items-center rounded-md text-fg-2 outline-none pointer-coarse:size-10",
        "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "disabled:pointer-events-none disabled:opacity-35",
      )}
    >
      {/* The chevron leans a pixel toward where it will take you. */}
      <Icon
        className={cn(
          "transition-transform duration-200 ease-out-expo",
          side === "prev" ? "group-hover/nav:-translate-x-px group-active/nav:-translate-x-0.5" : "group-hover/nav:translate-x-px group-active/nav:translate-x-0.5",
        )}
      />
    </button>
  );
}

type GridProps = {
  ref?: React.Ref<HTMLTableElement>;
  slide: Slide;
  rows: Cell[][];
  weekdays: { short: string; long: string }[];
  captionId: string;
  weekNumbers: boolean;
  num: Intl.NumberFormat;
  sweeping: boolean;
  sweepId: number;
  readOnly: boolean;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSelect: (d: Date, outside: boolean) => void;
  onHover?: (d: Date | null) => void;
};

function MonthGrid({ ref, slide, rows, weekdays, captionId, weekNumbers, num, sweeping, sweepId, readOnly, onKeyDown, onSelect, onHover }: GridProps) {
  // Exiting grids linger for their exit animation; they must not take focus or clicks.
  const present = useIsPresent();
  return (
    <motion.table
      ref={ref}
      role="grid"
      aria-labelledby={captionId}
      aria-readonly={readOnly || undefined}
      data-present={present}
      inert={!present}
      custom={slide}
      variants={gridVariants}
      initial="enter"
      animate="center"
      exit="exit"
      onKeyDown={onKeyDown}
      onPointerLeave={() => onHover?.(null)}
      className="border-separate border-spacing-x-0 border-spacing-y-0.5"
    >
      <thead>
        <tr>
          {weekNumbers && (
            <th scope="col" abbr="Week" className="sr-only">
              Wk
            </th>
          )}
          {weekdays.map((d) => (
            <th key={d.long} scope="col" abbr={d.long} className="sr-only">
              {d.long}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {weekNumbers && (
              <th scope="row" className="h-9 w-7 text-center align-middle font-mono text-[10px] font-normal tabular text-fg-4 pointer-coarse:h-11">
                {num.format(isoWeek(row[3].date))}
              </th>
            )}
            {row.map((cell) => (
              <DayCell key={cell.key} cell={cell} sweeping={sweeping} sweepId={sweepId} readOnly={readOnly} onSelect={onSelect} onHover={onHover} />
            ))}
          </tr>
        ))}
      </tbody>
    </motion.table>
  );
}

function DayCell({
  cell,
  sweeping,
  sweepId,
  readOnly,
  onSelect,
  onHover,
}: {
  cell: Cell;
  sweeping: boolean;
  sweepId: number;
  readOnly: boolean;
  onSelect: (d: Date, outside: boolean) => void;
  onHover?: (d: Date | null) => void;
}) {
  const { band } = cell;
  if (cell.hidden) return <td role="presentation" className="size-9 p-0 pointer-coarse:size-11" />;
  return (
    <td role="gridcell" aria-selected={cell.outside ? undefined : cell.selected} className="relative size-9 p-0 pointer-coarse:size-11">
      {band && (
        <span
          // Remounted per sweep so the keyframe replays even over days that were already in range.
          key={sweeping ? `s${sweepId}` : "band"}
          aria-hidden
          data-preview={band.preview || undefined}
          style={sweeping ? { animationDelay: `${Math.round(band.delay)}ms` } : undefined}
          className={cn(
            "pointer-events-none absolute inset-y-0 transition-colors duration-150",
            band.kind === "start" ? "left-1/2 right-0" : band.kind === "end" ? "left-0 right-1/2" : "inset-x-0",
            band.kind === "mid" && band.roundL && "rounded-l-lg",
            band.kind === "mid" && band.roundR && "rounded-r-lg",
            band.preview ? "bg-fg/[0.05]" : "bg-fg/[0.09]",
            sweeping && "animate-[stealth-calendar-sweep_220ms_var(--ease-out-quart)_both]",
          )}
        />
      )}
      <button
        type="button"
        data-day={cell.key}
        data-outside={cell.outside || undefined}
        data-selected={cell.selected || undefined}
        data-today={cell.today || undefined}
        data-disabled={cell.disabled || undefined}
        tabIndex={cell.tabbable ? 0 : -1}
        aria-label={cell.label}
        aria-current={cell.today ? "date" : undefined}
        aria-disabled={cell.disabled || undefined}
        onClick={() => onSelect(cell.date, cell.outside)}
        onPointerEnter={onHover && !cell.outside && !cell.disabled ? () => onHover(cell.date) : undefined}
        className={cn(
          "group/day relative grid size-9 place-items-center rounded-lg text-[13px] tabular outline-none pointer-coarse:size-11",
          "transition-[color,scale] duration-150 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
          cell.outside ? "text-fg-4" : "text-fg",
          cell.today && "font-medium",
          cell.selected && "text-frame",
          cell.endpoint && !cell.selected && "text-fg",
          cell.disabled
            ? cn("cursor-not-allowed text-fg-4", cell.unavailable && "line-through decoration-fg-4")
            : cn(!readOnly && "active:scale-[0.92] active:duration-75", !cell.selected && !readOnly && "hover:bg-hover"),
          cell.disabled && cell.selected && "text-frame",
        )}
      >
        {/* The fill pops from 60% when picked and fades faster when it leaves. CSS transitions don't run on mount, so
            navigating to a month that already holds the selection shows it at rest. */}
        <span
          aria-hidden
          data-on={cell.selected}
          style={cell.landsLate ? { transitionDelay: `${SWEEP_MS - 60}ms` } : undefined}
          className="absolute inset-0 scale-[0.6] rounded-lg bg-fg opacity-0 transition-[scale,opacity] duration-100 ease-out data-[on=true]:scale-100 data-[on=true]:opacity-100 data-[on=true]:duration-200 data-[on=true]:ease-out-expo"
        />
        {/* A pending range end, previewed under the pointer, gets an outline instead of a fill. */}
        {cell.endpoint && !cell.selected && <span aria-hidden className="absolute inset-0 rounded-lg border border-fg-3" />}
        <span className="relative">{cell.numeral}</span>
        {cell.today && <span aria-hidden className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current opacity-70 pointer-coarse:bottom-1.5" />}
      </button>
    </td>
  );
}

function GridPlaceholder({ weekNumbers }: { weekNumbers: boolean }) {
  // Same footprint as a real month, for the moment before the browser says what today is.
  return (
    <div aria-hidden className="grid gap-y-0.5 pt-0.5" style={{ gridTemplateColumns: `repeat(${weekNumbers ? 8 : 7}, auto)` }}>
      {Array.from({ length: (weekNumbers ? 8 : 7) * 6 }, (_, i) => (
        <span key={i} className={cn("h-9 pointer-coarse:h-11", weekNumbers && i % 8 === 0 ? "w-7" : "w-9 pointer-coarse:w-11")} />
      ))}
    </div>
  );
}

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
}
