"use client";
import { Checkbox } from "@base-ui/react/checkbox";
import { Popover } from "@base-ui/react/popover";
import { Select } from "@base-ui/react/select";
import { Switch } from "@base-ui/react/switch";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Check, Copy, Plus, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* ------------------------------------------------------------------ */
/* The data. Times are "HH:mm" wall-clock strings, "24:00" for the end  */
/* of the day, so the value round-trips through JSON and APIs as is.    */
/* ------------------------------------------------------------------ */

export type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export type TimeRange = { start: string; end: string };
export type DayHours = { enabled: boolean; ranges: TimeRange[] };
export type WeeklyHours = Record<DayKey, DayHours>;

export const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY = 24 * 60;

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
const toTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Nine to five on weekdays, weekends off. A sensible first value. */
export function defaultWeeklyHours(range: TimeRange = { start: "09:00", end: "17:00" }): WeeklyHours {
  return Object.fromEntries(DAY_KEYS.map((d) => [d, { enabled: d !== "sun" && d !== "sat", ranges: [{ ...range }] }])) as WeeklyHours;
}

export type RangeIssue = { day: DayKey; index: number; kind: "overlap" | "order"; with?: TimeRange };

/** Every problem in a week: ranges that overlap another, or end before they start. Empty means valid. */
export function validateWeeklyHours(value: WeeklyHours): RangeIssue[] {
  const issues: RangeIssue[] = [];
  for (const day of DAY_KEYS) {
    const hours = value[day];
    if (!hours?.enabled) continue;
    const sorted = hours.ranges.map((r, index) => ({ r, index, s: toMinutes(r.start), e: toMinutes(r.end) })).sort((a, b) => a.s - b.s || a.e - b.e);
    let reach: (typeof sorted)[number] | null = null;
    for (const item of sorted) {
      if (item.e <= item.s) issues.push({ day, index: item.index, kind: "order" });
      else if (reach && item.s < reach.e) issues.push({ day, index: item.index, kind: "overlap", with: reach.r });
      if (item.e > item.s && (!reach || item.e > reach.e)) reach = item;
    }
  }
  return issues;
}

/** Minutes of availability in a week, counting overlapping ranges once. */
export function weeklyMinutes(value: WeeklyHours) {
  let total = 0;
  for (const day of DAY_KEYS) {
    const hours = value[day];
    if (!hours?.enabled) continue;
    const spans = hours.ranges.map((r) => [toMinutes(r.start), toMinutes(r.end)]).filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
    let end = -1;
    for (const [s, e] of spans) {
      total += Math.max(0, e - Math.max(s, end));
      end = Math.max(end, e);
    }
  }
  return total;
}

/* ------------------------------------------------------------------ */

const noop = () => () => {};
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
const span = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
};

export type AvailabilityEditorProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "children"> & {
  value?: WeeklyHours;
  defaultValue?: WeeklyHours;
  onValueChange?: (value: WeeklyHours) => void;
  /** Minutes between the times offered. */
  step?: 5 | 10 | 15 | 20 | 30 | 60;
  /** The range a day gets when it's switched on with nothing kept from before. */
  defaultRange?: TimeRange;
  /** BCP 47 tag for day names, the clock and the week start. Defaults to the browser's. */
  locale?: string;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** 12-hour clock. Defaults to the locale's habit. */
  hour12?: boolean;
  /** Hide the weekly total in the header. */
  hideTotal?: boolean;
  disabled?: boolean;
  /** Portal target for the time lists and the copy popover. */
  container?: Popover.Portal.Props["container"];
};

type Flash = { days: DayKey[]; id: number };

export function AvailabilityEditor({
  value: valueProp,
  defaultValue,
  onValueChange,
  step = 15,
  defaultRange = { start: "09:00", end: "17:00" },
  locale: localeProp,
  weekStartsOn,
  hour12: hour12Prop,
  hideTotal = false,
  disabled = false,
  container,
  className,
  ...rest
}: AvailabilityEditorProps) {
  const reduce = !!useReducedMotion();
  const uid = useId();
  const locale = useLocale(localeProp);
  const hour12 = hour12Prop ?? prefers12h(locale);
  const [initial] = useState(() => defaultValue ?? defaultWeeklyHours(defaultRange));
  const [value, setValue] = useControllableState<WeeklyHours>({ value: valueProp, defaultValue: initial, onChange: onValueChange });

  // Stable keys for ranges, so removing the middle one animates the right row. Rebuilt by index if
  // the value's shape changes from outside.
  const [ids, setIds] = useState<Partial<Record<DayKey, string[]>>>({});
  const seq = useRef(0);
  const idsFor = (day: DayKey) => {
    const list = ids[day];
    return list && list.length === value[day].ranges.length ? list : value[day].ranges.map((_, i) => `${day}-${i}`);
  };
  // Days the previous edit touched from elsewhere (Copy), washed once so the change is seen.
  const [flash, setFlash] = useState<Flash | null>(null);
  const [announce, setAnnounce] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const weekStart = weekStartsOn ?? weekStartOf(locale);
  const days = useMemo(() => {
    const long = new Intl.DateTimeFormat(locale, { weekday: "long" });
    return Array.from({ length: 7 }, (_, i) => {
      const index = (weekStart + i) % 7;
      // Jan 4 2026 is a Sunday.
      return { key: DAY_KEYS[index], name: long.format(new Date(2026, 0, 4 + index)) };
    });
  }, [locale, weekStart]);
  const nameOf = (key: DayKey) => days.find((d) => d.key === key)?.name ?? key;

  const timeFmt = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", hour12, timeZone: "UTC" }), [locale, hour12]);
  const label = (min: number) => (min >= DAY && !hour12 ? "24:00" : timeFmt.format(new Date(Date.UTC(2026, 0, 1, 0, min % DAY))));

  const issues = useMemo(() => validateWeeklyHours(value), [value]);
  const issueAt = (day: DayKey, index: number) => issues.find((i) => i.day === day && i.index === index);
  const total = weeklyMinutes(value);

  const focusLater = (selector: string) => requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>(selector)?.focus());

  const setDay = (day: DayKey, next: DayHours, nextIds?: string[]) => {
    setValue((v) => ({ ...v, [day]: next }));
    if (nextIds) setIds((m) => ({ ...m, [day]: nextIds }));
  };

  const toggle = (day: DayKey, on: boolean) => {
    const hours = value[day];
    // Switching off keeps the ranges, so switching back on restores them.
    const ranges = on && hours.ranges.length === 0 ? [{ ...defaultRange }] : hours.ranges;
    setDay(day, { enabled: on, ranges }, ranges === hours.ranges ? undefined : ranges.map(() => `${day}-n${++seq.current}`));
  };

  const addRange = (day: DayKey) => {
    const hours = value[day];
    const lastEnd = Math.max(0, ...hours.ranges.map((r) => toMinutes(r.end)));
    if (lastEnd + step > DAY) return;
    // An hour's break after the last range, an hour long, pulled back to fit before midnight.
    const start = Math.min(lastEnd + (hours.ranges.length ? 60 : 0), DAY - 60 < lastEnd ? lastEnd : DAY - 60);
    const end = Math.min(start + 60, DAY);
    const id = `${day}-n${++seq.current}`;
    setDay(day, { enabled: true, ranges: [...hours.ranges, { start: toTime(start), end: toTime(end) }] }, [...idsFor(day), id]);
    focusLater(`[data-range="${id}"] [data-edge="start"]`);
  };

  const removeRange = (day: DayKey, index: number) => {
    const hours = value[day];
    const list = idsFor(day);
    const ranges = hours.ranges.filter((_, i) => i !== index);
    // Removing the last range turns the day off, and keeps a range ready for when it comes back on.
    if (ranges.length === 0) {
      setDay(day, { enabled: false, ranges: hours.ranges });
      focusLater(`[data-day="${day}"] [role="switch"]`);
      return;
    }
    setDay(day, { ...hours, ranges }, list.filter((_, i) => i !== index));
    const neighbor = list[index - 1] ?? list[index + 1];
    focusLater(`[data-range="${neighbor}"] [data-edge="end"]`);
  };

  const setEdge = (day: DayKey, index: number, edge: "start" | "end", time: string) => {
    const hours = value[day];
    const ranges = hours.ranges.map((r, i) => {
      if (i !== index) return r;
      if (edge === "end") return { ...r, end: time };
      // Moving the start past the end carries the end along, keeping the length.
      const s = toMinutes(time);
      const length = Math.max(step, toMinutes(r.end) - toMinutes(r.start));
      return { start: time, end: toMinutes(r.end) > s ? r.end : toTime(Math.min(DAY, s + length)) };
    });
    setDay(day, { ...hours, ranges });
  };

  const copyTo = (from: DayKey, targets: DayKey[]) => {
    if (!targets.length) return;
    const source = value[from];
    setValue((v) => {
      const next = { ...v };
      for (const t of targets) next[t] = { enabled: source.enabled, ranges: source.ranges.map((r) => ({ ...r })) };
      return next;
    });
    setIds((m) => {
      const next = { ...m };
      for (const t of targets) next[t] = source.ranges.map(() => `${t}-n${++seq.current}`);
      return next;
    });
    setFlash({ days: targets, id: ++seq.current });
    setAnnounce(`Copied ${nameOf(from)}’s hours to ${targets.length === 1 ? nameOf(targets[0]) : `${targets.length} days`}`);
  };

  const hours = total / 60;

  return (
    <div
      ref={rootRef}
      data-disabled={disabled || undefined}
      data-invalid={issues.length > 0 || undefined}
      aria-labelledby={`${uid}-title`}
      role="group"
      className={cn(
        "@container flex w-full max-w-[520px] flex-col rounded-xl border border-line bg-raised text-fg shadow-[var(--shadow)]",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      {...rest}
    >
      <div className="flex h-12 items-center justify-between gap-3 border-b border-line px-4">
        <h3 id={`${uid}-title`} className="text-[14px] font-medium tracking-[-0.015em]">
          Weekly hours
        </h3>
        {!hideTotal && (
          <p className="flex items-baseline gap-1 text-[12.5px] text-fg-3">
            <NumberFlow value={hours} format={{ maximumFractionDigits: 2 }} locales={locale} className="font-medium text-fg-2 tabular" />
            <span>{hours === 1 ? "hour" : "hours"} a week</span>
          </p>
        )}
      </div>

      <ul className="flex flex-col py-1.5">
        {days.map(({ key, name }) => {
          const day = value[key];
          const list = idsFor(key);
          const lastEnd = Math.max(0, ...day.ranges.map((r) => toMinutes(r.end)));
          const full = lastEnd + step > DAY;
          const flashIndex = flash?.days.indexOf(key) ?? -1;
          return (
            <li
              key={key}
              data-day={key}
              data-enabled={day.enabled || undefined}
              className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-4 py-1.5 @min-[460px]:grid-cols-[7.5rem_minmax(0,1fr)_auto]"
            >
              {flashIndex >= 0 && flash && (
                <motion.span
                  key={flash.id}
                  aria-hidden
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: reduce ? 0.4 : 0.9, ease: ease.outQuart, delay: reduce ? 0 : flashIndex * 0.04 }}
                  className="pointer-events-none absolute inset-x-1.5 inset-y-0.5 rounded-lg bg-fg/[0.06]"
                />
              )}
              <label className="relative col-start-1 row-start-1 flex h-8 w-fit min-w-0 cursor-default items-center gap-2.5 select-none">
                <DaySwitch checked={day.enabled} onCheckedChange={(on) => toggle(key, on)} disabled={disabled} />
                <span className={cn("text-[13px] font-medium transition-colors duration-150", day.enabled ? "text-fg" : "text-fg-3")}>{name}</span>
              </label>

              <div className="col-span-2 col-start-1 row-start-2 min-w-0 pl-[42px] @min-[460px]:col-span-1 @min-[460px]:col-start-2 @min-[460px]:row-start-1 @min-[460px]:pl-0">
                <AnimatePresence initial={false} mode="popLayout">
                  {day.enabled ? (
                    <motion.ul
                      key="ranges"
                      aria-label={`${name} hours`}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, x: -4, filter: "blur(2px)" }}
                      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      transition={{ duration: 0.2, ease: ease.out }}
                      className="flex flex-col"
                    >
                      <AnimatePresence initial={false}>
                        {day.ranges.map((range, i) => {
                          const issue = issueAt(key, i);
                          return (
                            <RangeRow
                              key={list[i]}
                              id={list[i]}
                              first={i === 0}
                              range={range}
                              step={step}
                              hour12={hour12}
                              label={label}
                              issue={issue ? (issue.kind === "order" ? "Ends before it starts" : `Overlaps ${label(toMinutes(issue.with!.start))} – ${label(toMinutes(issue.with!.end))}`) : null}
                              dayName={name}
                              reduce={reduce}
                              container={container}
                              onEdge={(edge, t) => setEdge(key, i, edge, t)}
                              onRemove={() => removeRange(key, i)}
                            />
                          );
                        })}
                      </AnimatePresence>
                    </motion.ul>
                  ) : (
                    <motion.p
                      key="off"
                      initial={reduce ? { opacity: 0 } : { opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      transition={{ duration: 0.2, ease: ease.out }}
                      // On a phone the switch already says it; the row stays one line tall.
                      className="hidden h-8 items-center text-[13px] text-fg-4 @min-[460px]:flex"
                    >
                      Unavailable
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="col-start-2 row-start-1 flex h-8 items-center gap-0.5 @min-[460px]:col-start-3">
                <IconButton label={full ? `No time left on ${name}` : `Add hours to ${name}`} onClick={() => addRange(key)} disabled={disabled || full}>
                  <Plus className="transition-transform duration-200 ease-out-expo group-active/icon:rotate-90" />
                </IconButton>
                <CopyHours
                  from={key}
                  fromName={name}
                  days={days.filter((d) => d.key !== key)}
                  disabled={disabled}
                  container={container}
                  onApply={(targets) => copyTo(key, targets)}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RangeRow({
  id,
  first,
  range,
  step,
  hour12,
  label,
  issue,
  dayName,
  reduce,
  container,
  onEdge,
  onRemove,
}: {
  id: string;
  first: boolean;
  range: TimeRange;
  step: number;
  hour12: boolean;
  label: (min: number) => string;
  issue: string | null;
  dayName: string;
  reduce: boolean;
  container?: Popover.Portal.Props["container"];
  onEdge: (edge: "start" | "end", time: string) => void;
  onRemove: () => void;
}) {
  const errorId = useId();
  const s = toMinutes(range.start);
  const starts = useMemo(() => Array.from({ length: DAY / step }, (_, i) => i * step), [step]);
  const ends = useMemo(() => Array.from({ length: DAY / step }, (_, i) => (i + 1) * step).filter((m) => m > s), [step, s]);
  const invalid = !!issue;

  return (
    <motion.li
      data-range={id}
      // Grows open from nothing and closes back down, so the rows below slide rather than jump.
      initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: -4, filter: "blur(2px)" }}
      animate={{ opacity: 1, height: "auto", y: 0, filter: "blur(0px)" }}
      exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, height: 0, filter: "blur(2px)", transition: { duration: 0.18, ease: ease.inOut } }}
      transition={{ duration: 0.24, ease: ease.out }}
      // The negative margin gives focus rings room inside the clip that the height animation needs.
      className="-mx-1 -mb-1 flex flex-col overflow-hidden px-1 pb-1"
    >
      <div className={cn("flex items-center gap-1.5", !first && "pt-1.5")}>
        <TimeSelect
          edge="start"
          value={s}
          options={starts}
          label={label}
          hour12={hour12}
          invalid={invalid}
          describedBy={invalid ? errorId : undefined}
          name={`${dayName}, start`}
          container={container}
          onChange={(m) => onEdge("start", toTime(m))}
        />
        <span aria-hidden className="w-2 text-center text-[13px] text-fg-4">
          –
        </span>
        <TimeSelect
          edge="end"
          value={toMinutes(range.end)}
          options={ends}
          label={label}
          hour12={hour12}
          invalid={invalid}
          describedBy={invalid ? errorId : undefined}
          name={`${dayName}, end`}
          hint={(m) => span(m - s)}
          container={container}
          onChange={(m) => onEdge("end", toTime(m))}
        />
        <IconButton label={`Remove ${label(s)} – ${label(toMinutes(range.end))} on ${dayName}`} onClick={onRemove} quiet>
          <X size={14} />
        </IconButton>
      </div>
      <AnimatePresence initial={false}>
        {issue && (
          <motion.p
            id={errorId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: ease.out }}
            className="overflow-hidden text-[12px] leading-4 text-danger"
          >
            <span className="block pt-1">{issue}</span>
          </motion.p>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/** A time from a list at `step` minutes. A short list under the trigger, scrolled to the current time, rather than a column the height of the screen. */
function TimeSelect({
  edge,
  value,
  options,
  label,
  hour12,
  invalid,
  describedBy,
  name,
  hint,
  container,
  onChange,
}: {
  edge: "start" | "end";
  value: number;
  options: number[];
  label: (min: number) => string;
  hour12: boolean;
  invalid: boolean;
  describedBy?: string;
  name: string;
  hint?: (min: number) => string;
  container?: Popover.Portal.Props["container"];
  onChange: (min: number) => void;
}) {
  const reduce = !!useReducedMotion();
  const items = useMemo(() => options.map((m) => ({ value: m, label: label(m) })), [options, label]);
  const { list, setList, y, height, opacity } = useGlide(reduce);
  // Open with the current time in the middle of the list, so earlier and later are both a short
  // scroll away. Two frames, so it lands after the list's own scroll-into-view.
  useEffect(() => {
    if (!list) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        const el = list.querySelector<HTMLElement>("[data-selected]");
        if (el) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.offsetHeight / 2;
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [list]);
  return (
    <Select.Root<number>
      items={items}
      value={value}
      onValueChange={(v) => v !== null && onChange(v)}
    >
      <Select.Trigger
        data-edge={edge}
        aria-label={name}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(
          "group/trigger relative flex h-8 items-center rounded-lg border border-line-2 bg-raised px-2.5 text-left text-[13px] tabular text-fg shadow-[var(--shadow)] select-none",
          hour12 ? "w-[6rem]" : "w-[4.75rem]",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75",
          "data-popup-open:border-fg-4 data-popup-open:bg-hover",
          "aria-invalid:border-danger/70 aria-invalid:hover:border-danger",
          "pointer-coarse:after:absolute pointer-coarse:after:-inset-y-1.5 pointer-coarse:after:inset-x-0",
        )}
      >
        <Select.Value className="truncate">{(v: number) => label(v)}</Select.Value>
      </Select.Trigger>
      <Select.Portal container={container}>
        <Select.Positioner alignItemWithTrigger={false} side="bottom" align="start" sideOffset={6} collisionPadding={8} className="z-(--z-popover) outline-none select-none">
          <Select.Popup
            className={cn(
              "relative min-w-(--anchor-width) origin-(--transform-origin) overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
              "transition-[opacity,scale] duration-160 ease-out-expo data-ending-style:duration-100 data-ending-style:ease-out",
              "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0",
              "data-[side=none]:data-starting-style:scale-100 data-[side=none]:data-ending-style:scale-100",
              "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
            )}
          >
            <Select.List ref={setList} className="relative max-h-[min(var(--available-height),16rem)] scroll-py-1 overflow-y-auto overscroll-contain p-1 outline-none">
              <motion.div aria-hidden style={{ y, height, opacity }} className="pointer-events-none absolute inset-x-1 top-0 rounded-lg bg-line" />
              {items.map((item) => (
                <Select.Item
                  key={item.value}
                  value={item.value}
                  className="group/item relative z-[1] flex h-8 cursor-default items-center gap-3 rounded-lg px-2.5 text-[13px] tabular text-fg-2 outline-none select-none data-highlighted:text-fg data-selected:text-fg pointer-coarse:h-10"
                >
                  <Select.ItemText className="flex-1 whitespace-nowrap">{item.label}</Select.ItemText>
                  {hint && <span className="font-mono text-2xs text-fg-4">{hint(item.value)}</span>}
                  <Select.ItemIndicator className="-mr-1 flex text-fg">
                    <Check size={14} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

/** Copy one day's hours onto others. Every other day starts ticked, so "to all days" is one press. */
function CopyHours({
  from,
  fromName,
  days,
  disabled,
  container,
  onApply,
}: {
  from: DayKey;
  fromName: string;
  days: { key: DayKey; name: string }[];
  disabled: boolean;
  container?: Popover.Portal.Props["container"];
  onApply: (targets: DayKey[]) => void;
}) {
  const reduce = !!useReducedMotion();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<DayKey[]>([]);
  const [done, setDone] = useState<number | null>(null);
  const all = picked.length === days.length;
  const some = picked.length > 0 && !all;

  // The icon holds a tick for a moment after copying.
  useEffect(() => {
    if (done === null) return;
    const t = window.setTimeout(() => setDone(null), 1400);
    return () => window.clearTimeout(t);
  }, [done]);

  const toggleDay = (key: DayKey, on: boolean) => setPicked((p) => (on ? [...p, key] : p.filter((k) => k !== key)));

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setPicked(days.map((d) => d.key));
        setOpen(next);
      }}
    >
      <Popover.Trigger
        disabled={disabled}
        aria-label={`Copy ${fromName}’s hours to other days`}
        data-from={from}
        className={cn(iconButton, "data-popup-open:bg-hover data-popup-open:text-fg")}
      >
        <span className="relative grid size-4 place-items-center">
          <AnimatePresence initial={false}>
            <motion.span
              key={done !== null ? `done-${done}` : "copy"}
              className="absolute inset-0 grid place-items-center"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(3px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(3px)" }}
              transition={reduce ? { duration: 0.12 } : spring.pop}
            >
              {done !== null ? <Check size={15} /> : <Copy size={15} />}
            </motion.span>
          </AnimatePresence>
        </span>
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={8} className="z-(--z-popover)">
          <Popover.Popup
            className={cn(
              "w-56 origin-(--transform-origin) rounded-xl border border-line-2 bg-raised p-1 text-fg shadow-pop outline-none",
              "transition-[opacity,scale] duration-160 ease-out-expo data-ending-style:duration-100 data-ending-style:ease-out",
              "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0",
              "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
            )}
          >
            <Popover.Title className="px-2.5 pt-2 pb-1.5 font-mono text-2xs tracking-[0.08em] text-fg-3 uppercase">Copy {fromName} to</Popover.Title>
            <div className="flex flex-col">
              <CheckRow
                label="All days"
                checked={all}
                indeterminate={some}
                onChange={(on) => setPicked(on ? days.map((d) => d.key) : [])}
                strong
              />
              <div aria-hidden className="mx-2.5 my-1 h-px bg-line" />
              {days.map((d) => (
                <CheckRow key={d.key} label={d.name} checked={picked.includes(d.key)} onChange={(on) => toggleDay(d.key, on)} />
              ))}
            </div>
            <div className="p-1 pt-2">
              <button
                type="button"
                disabled={!picked.length}
                onClick={() => {
                  onApply(days.filter((d) => picked.includes(d.key)).map((d) => d.key));
                  setDone((d) => (d ?? 0) + 1);
                  setOpen(false);
                }}
                className={cn(
                  "grid h-8 w-full place-items-center rounded-lg bg-fg text-[12.5px] font-medium text-frame",
                  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                  "transition-[background-color,opacity,scale] duration-150 hover:bg-fg/90 active:scale-[0.97] active:duration-75",
                  "disabled:pointer-events-none disabled:opacity-40",
                )}
              >
                <span className="tabular">{picked.length ? `Copy to ${picked.length === 1 ? "1 day" : `${picked.length} days`}` : "Pick a day"}</span>
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function CheckRow({ label, checked, indeterminate, strong, onChange }: { label: string; checked: boolean; indeterminate?: boolean; strong?: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="group/row flex h-8 cursor-default items-center gap-2.5 rounded-lg px-2.5 text-[13px] select-none hover:bg-hover pointer-coarse:h-10">
      <Checkbox.Root
        checked={checked}
        indeterminate={indeterminate}
        onCheckedChange={onChange}
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-[5px] border border-line-2 bg-raised text-frame",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[background-color,border-color,scale] duration-150 group-active/row:scale-[0.9] group-hover/row:border-fg-4",
          "data-checked:border-fg data-checked:bg-fg data-indeterminate:border-fg data-indeterminate:bg-fg",
        )}
      >
        <Checkbox.Indicator keepMounted className="grid place-items-center transition-[opacity,scale] duration-150 ease-out-expo data-unchecked:scale-50 data-unchecked:opacity-0">
          {indeterminate ? (
            <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden>
              <path d="M2.5 5h5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
            </svg>
          ) : (
            <Check size={12} strokeWidth={1.8} />
          )}
        </Checkbox.Indicator>
      </Checkbox.Root>
      <span className={cn(strong ? "font-medium text-fg" : "text-fg-2 group-hover/row:text-fg")}>{label}</span>
    </label>
  );
}

/** The day switch. The thumb stretches toward where it will go while pressed. */
function DaySwitch({ checked, onCheckedChange, disabled }: { checked: boolean; onCheckedChange: (on: boolean) => void; disabled: boolean }) {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        "group/switch relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full p-0.5",
        "bg-fg/15 data-checked:bg-fg",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color] duration-200 ease-out",
        "before:absolute before:-inset-x-1.5 before:-inset-y-3 before:content-[''] pointer-fine:before:hidden",
      )}
    >
      <Switch.Thumb
        className={cn(
          "block h-3.5 w-3.5 rounded-full bg-fg-2 data-checked:bg-frame",
          "transition-[translate,width,background-color] duration-200 ease-out-expo",
          "data-checked:translate-x-3.5 group-active/switch:w-[17px] group-active/switch:data-checked:translate-x-[11px]",
          "motion-reduce:transition-none",
        )}
      />
    </Switch.Root>
  );
}

const iconButton = cn(
  "group/icon relative grid size-7 place-items-center rounded-md text-fg-3 outline-none",
  "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
  "disabled:pointer-events-none disabled:opacity-35",
  "after:absolute after:-inset-2 after:content-[''] pointer-fine:after:hidden",
);

function IconButton({ label, onClick, disabled, quiet, children }: { label: string; onClick: () => void; disabled?: boolean; quiet?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={cn(iconButton, quiet && "text-fg-4 hover:text-fg-2")}>
      {children}
    </button>
  );
}

// One highlight for the time list: glides after the pointer, jumps for arrow keys.
function useGlide(reduce: boolean) {
  const [list, setList] = useState<HTMLDivElement | null>(null);
  const y = useMotionValue(0);
  const height = useMotionValue(32);
  const opacity = useMotionValue(0);

  useEffect(() => {
    if (!list) return;
    let keyboard = false;
    let shown = false;
    let running: AnimationPlaybackControls[] = [];
    const stop = () => {
      running.forEach((c) => c.stop());
      running = [];
    };
    const place = () => {
      const el = list.querySelector<HTMLElement>("[data-highlighted]");
      stop();
      if (!el) {
        shown = false;
        running.push(animate(opacity, 0, { duration: reduce ? 0 : 0.12 }));
        return;
      }
      const top = el.offsetTop;
      if (!shown || keyboard || reduce) {
        y.jump(top);
        height.jump(el.offsetHeight);
        opacity.jump(1);
      } else {
        running.push(animate(y, top, spring.follow), animate(height, el.offsetHeight, spring.follow));
        opacity.jump(1);
      }
      shown = true;
    };
    const onKey = () => (keyboard = true);
    const onPointer = () => (keyboard = false);
    const observer = new MutationObserver(place);
    observer.observe(list, { subtree: true, attributes: true, attributeFilter: ["data-highlighted"] });
    document.addEventListener("keydown", onKey, true);
    list.addEventListener("pointermove", onPointer);
    place();
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKey, true);
      list.removeEventListener("pointermove", onPointer);
      stop();
    };
  }, [list, reduce, y, height, opacity]);

  return { list, setList, y, height, opacity };
}
