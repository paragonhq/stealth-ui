"use client";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/* ------------------------------------------------------------------------ */
/* Calendar days in local time. Everything is a Date at local midnight.      */

const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const startOfWeek = (d: Date, first: Weekday) => addDays(day(d), -((d.getDay() - first + 7) % 7));

// Where Intl can't say (older engines), these regions start the week on Sunday.
const SUNDAY_FIRST = new Set([
  "US",
  "CA",
  "MX",
  "BR",
  "AR",
  "CO",
  "PE",
  "VE",
  "GT",
  "PR",
  "JP",
  "KR",
  "TW",
  "HK",
  "MO",
  "PH",
  "TH",
  "ID",
  "IN",
  "IL",
  "SA",
  "ZA",
  "KE",
]);
function firstDayOf(locale: string): Weekday {
  try {
    const l = new Intl.Locale(locale) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
    const info = l.getWeekInfo?.() ?? l.weekInfo;
    if (info?.firstDay) return (info.firstDay % 7) as Weekday;
    return SUNDAY_FIRST.has(l.maximize().region ?? "") ? 0 : 1;
  } catch {
    return 1;
  }
}

/* ------------------------------------------------------------------------ */
/* The server knows neither the reader's day nor their locale; both arrive   */
/* on the client right after hydration, without a mismatch.                  */

const noop = () => () => {};
let todayCache: { key: string; date: Date } | null = null;
function readToday() {
  const now = day(new Date());
  const key = keyOf(now);
  if (todayCache?.key !== key) todayCache = { key, date: now };
  return todayCache.date;
}
// Rolls over at midnight so "today" is never stale in a tab left open overnight.
function subscribeToday(notify: () => void) {
  let timer = 0;
  const arm = () => {
    const now = new Date();
    timer = window.setTimeout(
      () => {
        notify();
        arm();
      },
      addDays(day(now), 1).getTime() - now.getTime() + 50,
    );
  };
  arm();
  const onVisible = () => !document.hidden && notify();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
function useToday() {
  return useSyncExternalStore(subscribeToday, readToday, () => null);
}
function useLocale(locale?: string) {
  const detected = useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().locale,
    () => "en-US",
  );
  return locale ?? detected;
}

/* ------------------------------------------------------------------------ */

export type WeekStripProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "children"> & {
  /** The selected day. Any time of day is ignored. */
  value?: Date | null;
  defaultValue?: Date | null;
  onValueChange?: (date: Date) => void;
  /** How many dots to show under a day (up to 3), for days with events. */
  markers?: (date: Date) => number;
  /** 0 is Sunday. By default it follows the locale. */
  weekStartsOn?: Weekday;
  /** Earliest selectable day. */
  min?: Date;
  /** Latest selectable day. */
  max?: Date;
  isDateDisabled?: (date: Date) => boolean;
  /** How a day's dots are read out: "3 events". */
  markerLabel?: (count: number) => string;
  /** Month label, week arrows and a Today button above the days. */
  header?: boolean;
  locale?: string;
};

type Nav = { source: "key" | "pointer"; tick: number };

export function WeekStrip({
  value,
  defaultValue = null,
  onValueChange,
  markers,
  weekStartsOn,
  min,
  max,
  isDateDisabled,
  markerLabel = (n) => (n === 1 ? "1 event" : `${n} events`),
  header = true,
  locale: localeProp,
  className,
  ...rest
}: WeekStripProps) {
  const id = useId();
  const reduce = useReducedMotion();
  const locale = useLocale(localeProp);
  const today = useToday();
  const first = weekStartsOn ?? firstDayOf(locale);

  const [picked, setPicked] = useControllableState<Date | null>({
    value,
    defaultValue,
    onChange: (d) => d && onValueChange?.(d),
  });
  const selected = picked ? day(picked) : today;
  const weekStart = selected ? startOfWeek(selected, first) : null;
  const weekKey = weekStart ? keyOf(weekStart) : "pending";

  const [nav, setNav] = useState<Nav>({ source: "pointer", tick: 0 });
  // Direction of the last week change, so the new week slides in from the side it came from.
  const [view, setView] = useState({ key: weekKey, dir: 0 });
  if (view.key !== weekKey) setView({ key: weekKey, dir: view.key === "pending" || weekKey === "pending" ? 0 : weekKey > view.key ? 1 : -1 });
  const instant = nav.source === "key" || !!reduce;

  const rowRef = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);

  const disabled = (d: Date) => (min != null && d < day(min)) || (max != null && d > day(max)) || !!isDateDisabled?.(d);

  const fmt = useMemo(
    () => ({
      weekday: new Intl.DateTimeFormat(locale, { weekday: "short" }),
      full: new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      num: new Intl.DateTimeFormat(locale, { day: "numeric" }),
      month: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
      range: new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }),
    }),
    [locale],
  );

  const days = weekStart ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : [];
  const monthLabel = weekStart ? (weekStart.getMonth() === days[6].getMonth() ? fmt.month.format(weekStart) : fmt.range.formatRange(weekStart, days[6])) : " ";

  function select(next: Date, source: Nav["source"]) {
    if (disabled(next)) return;
    setNav((n) => ({ source, tick: n.tick + 1 }));
    if (!selected || keyOf(next) !== keyOf(selected)) setPicked(next);
  }

  /** Step by `by` days, skipping disabled ones, for arrows and paging. */
  function move(by: number, source: Nav["source"]) {
    if (!selected) return;
    let next = addDays(selected, by);
    const unit = Math.sign(by);
    for (let i = 0; i < 14 && disabled(next); i++) next = addDays(next, unit);
    if (!disabled(next)) select(next, source);
  }

  /** Previous or next week, keeping the weekday like a phone calendar does. */
  function page(dir: 1 | -1, source: Nav["source"]) {
    if (!selected || !weekStart) return;
    const target = addDays(selected, dir * 7);
    if (!disabled(target)) return select(target, source);
    const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, dir * 7 + i));
    const open = week.filter((d) => !disabled(d));
    if (open.length) select(dir > 0 ? open[0] : open[open.length - 1], source);
  }
  const canPage = (dir: 1 | -1) => !!weekStart && Array.from({ length: 7 }, (_, i) => addDays(weekStart, dir * 7 + i)).some((d) => !disabled(d));

  // Keyboard moves render instantly; once the new day exists, focus follows it.
  const selectedKey = selected ? keyOf(selected) : null;
  useEffect(() => {
    if (nav.source !== "key" || !selectedKey) return;
    rowRef.current?.querySelector<HTMLElement>(`[data-date="${selectedKey}"]`)?.focus();
  }, [nav, selectedKey]);

  function onKeyDown(e: React.KeyboardEvent) {
    const map: Record<string, () => void> = {
      ArrowRight: () => move(1, "key"),
      ArrowLeft: () => move(-1, "key"),
      PageDown: () => page(1, "key"),
      PageUp: () => page(-1, "key"),
      Home: () => weekStart && select(days.find((d) => !disabled(d)) ?? weekStart, "key"),
      End: () => weekStart && select([...days].reverse().find((d) => !disabled(d)) ?? days[6], "key"),
    };
    const run = map[e.key];
    if (!run) return;
    e.preventDefault();
    e.stopPropagation();
    run();
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    const swipe = info.offset.x + info.velocity.x * 0.15;
    if (swipe < -60 && canPage(1)) page(1, "pointer");
    else if (swipe > 60 && canPage(-1)) page(-1, "pointer");
  }

  const showToday = !!today && !!selected && keyOf(today) !== keyOf(selected);
  const slide = {
    enter: (c: { dir: number; instant: boolean }) => (c.instant || !c.dir ? { x: 0, opacity: 1 } : { x: `${c.dir * 36}%`, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (c: { dir: number; instant: boolean }) =>
      c.instant || !c.dir ? { opacity: 0, transition: { duration: 0 } } : { x: `${c.dir * -36}%`, opacity: 0, transition: { duration: 0.2, ease: ease.out } },
  };
  const custom = { dir: view.dir, instant };
  const iconButton = cn(
    "relative grid size-7 place-items-center rounded-md text-fg-2 outline-none",
    "transition-[background-color,color,scale,opacity] duration-150 ease-out hover:bg-fg/6 hover:text-fg active:scale-[0.92] active:duration-75",
    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
    "disabled:pointer-events-none disabled:opacity-35 after:absolute after:-inset-1.5 after:content-['']",
  );

  return (
    <div data-state={selected ? "ready" : "pending"} className={cn("flex w-full min-w-0 flex-col gap-2", className)} {...rest}>
      {header && (
        <div className="flex h-7 items-center justify-between gap-2">
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <AnimatePresence initial={false} mode="popLayout" custom={custom}>
              <motion.h3
                key={monthLabel}
                id={`${id}-label`}
                custom={custom}
                variants={{
                  enter: (c: typeof custom) => (c.instant || !c.dir ? { opacity: 1 } : { y: c.dir * 8, opacity: 0, filter: "blur(2px)" }),
                  center: { y: 0, opacity: 1, filter: "blur(0px)" },
                  exit: (c: typeof custom) =>
                    c.instant || !c.dir
                      ? { opacity: 0, transition: { duration: 0 } }
                      : { y: c.dir * -8, opacity: 0, filter: "blur(2px)", transition: { duration: 0.15 } },
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.24, ease: ease.out }}
                className="truncate text-[14px] font-medium tracking-[-0.015em] text-fg"
              >
                {monthLabel}
              </motion.h3>
            </AnimatePresence>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <AnimatePresence initial={false}>
              {showToday && (
                <motion.button
                  key="today"
                  type="button"
                  onClick={() => today && select(today, "pointer")}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, filter: "blur(2px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: reduce ? 1 : 0.95, transition: { duration: 0.12 } }}
                  transition={spring.pop}
                  className={cn(
                    "mr-1 h-7 rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none",
                    "transition-[background-color,border-color] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97]",
                    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                  )}
                >
                  Today
                </motion.button>
              )}
            </AnimatePresence>
            <button type="button" aria-label="Previous week" disabled={!canPage(-1)} onClick={() => page(-1, "pointer")} className={iconButton}>
              <ChevronLeft />
            </button>
            <button type="button" aria-label="Next week" disabled={!canPage(1)} onClick={() => page(1, "pointer")} className={iconButton}>
              <ChevronRight />
            </button>
          </div>
        </div>
      )}

      <div ref={rowRef} className="relative -mx-1 overflow-hidden px-1 py-1">
        <AnimatePresence initial={false} mode="popLayout" custom={custom}>
          <motion.div
            key={weekKey}
            role="radiogroup"
            aria-labelledby={header ? `${id}-label` : undefined}
            aria-label={header ? undefined : "Week"}
            custom={custom}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ x: reduce ? { duration: 0 } : spring.soft, opacity: { duration: 0.18 } }}
            drag={selected ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.35}
            dragMomentum={false}
            onDragStart={() => {
              dragged.current = true;
            }}
            onDragEnd={onDragEnd}
            onPointerDownCapture={() => {
              dragged.current = false;
            }}
            onKeyDown={onKeyDown}
            className="grid touch-pan-y grid-cols-7 gap-1"
          >
            {selected
              ? days.map((d) => {
                  const k = keyOf(d);
                  const isSelected = k === keyOf(selected);
                  const isToday = !!today && k === keyOf(today);
                  const isPast = !!today && d < today;
                  const off = disabled(d);
                  const count = Math.min(3, Math.max(0, markers?.(d) ?? 0));
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-current={isToday ? "date" : undefined}
                      aria-label={count ? `${fmt.full.format(d)}, ${markerLabel(count)}` : fmt.full.format(d)}
                      tabIndex={isSelected ? 0 : -1}
                      disabled={off}
                      data-date={k}
                      data-selected={isSelected || undefined}
                      data-today={isToday || undefined}
                      onClick={() => {
                        if (!dragged.current) select(d, "pointer");
                      }}
                      className={cn(
                        "group/day relative flex h-[60px] min-w-0 select-none flex-col items-center justify-center gap-1 rounded-xl outline-none",
                        "transition-[scale,opacity] duration-150 ease-out active:scale-[0.95] active:duration-75",
                        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                        "disabled:pointer-events-none disabled:opacity-35",
                      )}
                    >
                      {isSelected && (
                        <motion.span
                          layoutId={`${id}-pill-${weekKey}`}
                          transition={instant ? { duration: 0 } : spring.snappy}
                          className="absolute inset-0 rounded-xl bg-fg shadow-[var(--shadow)]"
                        />
                      )}
                      {!isSelected && (
                        <span
                          className={cn(
                            "absolute inset-0 rounded-xl transition-colors duration-150 group-hover/day:bg-fg/6",
                            isToday && "border border-line-2",
                          )}
                        />
                      )}
                      <span
                        className={cn(
                          "relative text-[10.5px] font-medium uppercase leading-none tracking-[0.06em] transition-colors duration-150",
                          isSelected ? "text-frame/70" : isToday ? "text-fg" : "text-fg-3",
                        )}
                      >
                        {fmt.weekday.format(d)}
                      </span>
                      <span
                        className={cn(
                          "relative text-[16px] font-medium leading-none tracking-[-0.01em] tabular transition-colors duration-150",
                          isSelected ? "text-frame" : isPast ? "text-fg-3" : "text-fg",
                        )}
                      >
                        {fmt.num.format(d)}
                      </span>
                      <span aria-hidden className="relative flex h-1 items-center gap-[3px]">
                        {/* A dot added while you watch pops in; dots already there when a week arrives don't. */}
                        <AnimatePresence initial={false}>
                          {Array.from({ length: count }, (_, i) => (
                            <motion.span
                              key={i}
                              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, transition: { duration: 0.1 } }}
                              transition={spring.pop}
                              className={cn("size-1 rounded-full transition-colors duration-150", isSelected ? "bg-frame/60" : "bg-fg-3")}
                            />
                          ))}
                        </AnimatePresence>
                      </span>
                    </button>
                  );
                })
              : Array.from({ length: 7 }, (_, i) => <span key={i} aria-hidden className="h-[60px] rounded-xl bg-fg/[0.03]" />)}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
