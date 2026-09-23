"use client";
import { Select } from "@base-ui/react/select";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

type Seg = "hour" | "minute" | "period";
type Cycle = 12 | 24;
/** A partly typed time. `h` is in the display cycle (1–12 or 0–23); `p` is 0 for AM, 1 for PM. */
type Draft = { h: number | null; m: number | null; p: 0 | 1 | null };
type Piece = { kind: "seg"; seg: Seg } | { kind: "lit"; text: string };
type Roll = { source: "step" | "pick" | "type"; seg?: Seg; trend?: 1 | -1 };

/* ------------------------------------------------------------------------ */
/* Time maths. Values are "HH:mm" in 24-hour time, like <input type="time">. */

const parse = (v: string | null | undefined) => {
  const m = v ? /^(\d{1,2}):(\d{2})/.exec(v) : null;
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
};
const pad = (n: number) => String(n).padStart(2, "0");
const toValue = (mins: number) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

function draftFrom(value: string | null, cycle: Cycle): Draft {
  const mins = parse(value);
  if (mins == null) return { h: null, m: null, p: null };
  const h24 = Math.floor(mins / 60);
  return cycle === 24 ? { h: h24, m: mins % 60, p: null } : { h: h24 % 12 || 12, m: mins % 60, p: h24 >= 12 ? 1 : 0 };
}

function valueFrom(d: Draft, cycle: Cycle): string | null {
  if (d.h == null || d.m == null) return null;
  if (cycle === 24) return toValue(d.h * 60 + d.m);
  if (d.p == null) return null;
  return toValue(((d.h % 12) + d.p * 12) * 60 + d.m);
}

const range = (seg: Seg, cycle: Cycle): [number, number] => (seg === "minute" ? [0, 59] : seg === "period" ? [0, 1] : cycle === 12 ? [1, 12] : [0, 23]);

const wrap = (n: number, [lo, hi]: [number, number]) => {
  const size = hi - lo + 1;
  return ((((n - lo) % size) + size) % size) + lo;
};

/* ------------------------------------------------------------------------ */
/* Locale. The server can't know the reader's locale, so it renders en-US and */
/* the client switches on hydration without a mismatch.                       */

const noop = () => () => {};
function useLocale(locale?: string) {
  const detected = useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().locale,
    () => "en-US",
  );
  return locale ?? detected;
}

function describeLocale(locale: string, forced?: Cycle) {
  const auto = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hourCycle;
  const cycle: Cycle = forced ?? (auto === "h11" || auto === "h12" ? 12 : 24);
  const format = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", hourCycle: cycle === 12 ? "h12" : "h23" });
  const at = (h: number, m = 45) => format.formatToParts(new Date(2000, 0, 1, h, m));

  // Segment order and separators come from the locale: "1:45 PM", "13:45", "13.45", "오후 1:45".
  let pieces: Piece[] = [];
  for (const part of at(13)) {
    if (part.type === "hour" || part.type === "minute") pieces.push({ kind: "seg", seg: part.type });
    else if (part.type === "dayPeriod" && cycle === 12) pieces.push({ kind: "seg", seg: "period" });
    else if (part.type === "literal") pieces.push({ kind: "lit", text: part.value.replace(/\s+/g, " ") });
  }
  while (pieces[0]?.kind === "lit") pieces.shift();
  while (pieces.at(-1)?.kind === "lit") pieces.pop();
  const segs = pieces.flatMap((p) => (p.kind === "seg" ? [p.seg] : []));
  if (!segs.includes("hour") || !segs.includes("minute") || (cycle === 12 && !segs.includes("period"))) {
    pieces = [
      { kind: "seg", seg: "hour" },
      { kind: "lit", text: ":" },
      { kind: "seg", seg: "minute" },
    ];
    if (cycle === 12) pieces.push({ kind: "lit", text: " " }, { kind: "seg", seg: "period" });
  }

  const periodOf = (h: number) => at(h).find((p) => p.type === "dayPeriod")?.value ?? (h < 12 ? "AM" : "PM");
  const periods: [string, string] = [periodOf(9), periodOf(21)];
  // 24-hour time always reads as 08:00; 12-hour follows the locale ("9:05 AM" in en-US).
  const padHour = cycle === 24 || (at(9, 5).find((p) => p.type === "hour")?.value.length ?? 1) > 1;

  let fieldNames: Record<Seg, string> = { hour: "Hour", minute: "Minute", period: "AM/PM" };
  try {
    const names = new Intl.DisplayNames(locale, { type: "dateTimeField" });
    fieldNames = { hour: names.of("hour") ?? "Hour", minute: names.of("minute") ?? "Minute", period: names.of("dayPeriod") ?? "AM/PM" };
  } catch {}

  return { cycle, format, pieces, periods, padHour, fieldNames };
}

/** "45 min", "1 hr", "1 hr 15 min", with each unit in the locale's words. */
function durationLabel(locale: string, mins: number) {
  const unit = (unit: "hour" | "minute", n: number) => new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "short" }).format(n);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h && unit("hour", h), (m || !h) && unit("minute", m)].filter(Boolean).join(" ");
}

const expo = `cubic-bezier(${ease.out.join(",")})`;
const rollTiming = { duration: 240, easing: expo };

/* ------------------------------------------------------------------------ */

export type TimePickerProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "children"> & {
  /** "HH:mm" in 24-hour time, or null when empty. */
  value?: string | null;
  defaultValue?: string | null;
  /** Called with a complete "HH:mm", or null when the field is cleared or only partly filled. */
  onValueChange?: (value: string | null) => void;
  /** Minutes between the suggested times in the list. */
  interval?: number;
  /** Minutes the arrow keys move the minute segment, snapping to that grid. */
  step?: number;
  /** Earliest allowed time, "HH:mm". The list starts here and earlier typed times are invalid. */
  min?: string;
  /** Latest allowed time, "HH:mm". */
  max?: string;
  /** Start time for an end-time field: the list starts after it and each option shows its duration. */
  durationFrom?: string | null;
  /** Grays out options in the list, for example times that are already booked. */
  isTimeDisabled?: (value: string) => boolean;
  /** Force 12 or 24-hour time. By default it follows the locale. */
  hourCycle?: Cycle;
  locale?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  readOnly?: boolean;
  /** Shows the error treatment. Times outside min and max are always invalid. */
  invalid?: boolean;
  /** Submits the value with a form, as "HH:mm". */
  name?: string;
  /** Accessible name of the list button. */
  listLabel?: string;
};

export function TimePicker({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  interval = 30,
  step = 1,
  min,
  max,
  durationFrom,
  isTimeDisabled,
  hourCycle,
  locale: localeProp,
  size = "md",
  disabled = false,
  readOnly = false,
  invalid: invalidProp = false,
  name,
  listLabel = "Show suggested times",
  className,
  onPointerDown,
  ...rest
}: TimePickerProps) {
  const locale = useLocale(localeProp);
  const info = useMemo(() => describeLocale(locale, hourCycle), [locale, hourCycle]);
  const { cycle } = info;
  const reduce = useReducedMotion();

  const [value, setValue] = useControllableState<string | null>({ value: valueProp, defaultValue, onChange: onValueChange });
  const [draft, setDraft] = useState<Draft>(() => draftFrom(value, cycle));
  const [synced, setSynced] = useState({ value, cycle });
  const [roll, setRoll] = useState<Roll>({ source: "type" });
  const [typed, setTyped] = useState<{ seg: Seg; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const segRefs = useRef<Partial<Record<Seg, HTMLDivElement | null>>>({});

  // Follow the value when it changes from outside (a controlled parent, the list,
  // a locale switch), without wiping a time that is still being typed.
  if (synced.value !== value || synced.cycle !== cycle) {
    setSynced({ value, cycle });
    if (synced.cycle !== cycle || valueFrom(draft, cycle) !== value) {
      setDraft(draftFrom(value, cycle));
      setRoll({ source: "pick" });
    }
  }

  const order = info.pieces.flatMap((p) => (p.kind === "seg" ? [p.seg] : []));
  const minM = parse(min);
  const maxM = parse(max);
  const fromM = parse(durationFrom);
  const current = parse(value);
  const outOfRange = current != null && ((minM != null && current < minM) || (maxM != null && current > maxM));
  const invalid = invalidProp || outOfRange;

  const slots = useMemo(() => {
    const first = fromM != null ? fromM + interval : (minM ?? 0);
    const last = Math.min(maxM ?? 1439, 1439);
    const out: { value: string; label: string; duration?: string; disabled: boolean }[] = [];
    for (let t = first; t <= last && interval > 0; t += interval) {
      const v = toValue(t);
      out.push({
        value: v,
        label: info.format.format(new Date(2000, 0, 1, Math.floor(t / 60), t % 60)),
        duration: fromM != null ? durationLabel(locale, t - fromM) : undefined,
        disabled: isTimeDisabled?.(v) ?? false,
      });
    }
    return out;
  }, [fromM, minM, maxM, interval, info, locale, isTimeDisabled]);
  const exact = slots.some((s) => s.value === value) ? value : null;

  // Opening centers the chosen time, or the nearest one when the typed time is off the grid.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      if (!list || !slots.length) return;
      const now = new Date();
      const target = current ?? now.getHours() * 60 + now.getMinutes();
      const nearest = slots.reduce((a, b) => (Math.abs(parse(b.value)! - target) < Math.abs(parse(a.value)! - target) ? b : a));
      const el = list.querySelector<HTMLElement>(`[data-time="${nearest.value}"]`);
      if (el) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.offsetHeight / 2;
    });
    return () => cancelAnimationFrame(frame);
  }, [open, current, slots]);

  function commit(next: Draft, r: Roll) {
    setDraft(next);
    setRoll(r);
    const v = valueFrom(next, cycle);
    setSynced({ value: v, cycle });
    if (v !== value) setValue(v);
  }

  const setSeg = (d: Draft, seg: Seg, n: number | null): Draft =>
    seg === "hour" ? { ...d, h: n } : seg === "minute" ? { ...d, m: n } : { ...d, p: n as 0 | 1 | null };
  const getSeg = (seg: Seg) => (seg === "hour" ? draft.h : seg === "minute" ? draft.m : draft.p);

  function focusSeg(seg: Seg, dir: 1 | -1) {
    const next = order[order.indexOf(seg) + dir];
    if (next) segRefs.current[next]?.focus();
  }

  function stepSeg(seg: Seg, dir: 1 | -1, big = false) {
    const r = range(seg, cycle);
    const now = getSeg(seg);
    let n: number;
    if (now == null) {
      // An empty segment starts from the current time, which is almost always nearer than midnight.
      const d = new Date();
      n = seg === "hour" ? (cycle === 12 ? d.getHours() % 12 || 12 : d.getHours()) : seg === "minute" ? 0 : d.getHours() >= 12 ? 1 : 0;
    } else if (seg === "minute") {
      const by = big ? 10 : step;
      n = by > 1 ? (dir > 0 ? Math.floor(now / by) * by + by : Math.ceil(now / by) * by - by) : now + dir;
      n = wrap(n, r);
    } else n = wrap(now + dir, r);
    let next = setSeg(draft, seg, n);
    // Filling the hour in a 12-hour field fills AM/PM too, so a time is never stuck half-done.
    if (seg === "hour" && cycle === 12 && next.p == null) next = { ...next, p: new Date().getHours() >= 12 ? 1 : 0 };
    commit(next, { source: "step", seg, trend: dir });
  }

  function typeDigit(seg: Seg, digit: string) {
    const [lo, hi] = range(seg, cycle);
    let text = typed?.seg === seg ? typed.text + digit : digit;
    if (text.length > 2 || Number(text) > hi) text = digit;
    const n = Number(text);
    if (n >= lo && n <= hi) {
      let next = setSeg(draft, seg, n);
      // A typed 12-hour time guesses its half of the day from working hours: 1–6 is afternoon, 7–11 morning.
      if (seg === "hour" && cycle === 12 && next.p == null) next = { ...next, p: n === 12 || n < 7 ? 1 : 0 };
      commit(next, { source: "type" });
    }
    // Stay for a second digit only while one could still fit; otherwise move on like a native field.
    if (text.length < 2 && n * 10 <= hi) setTyped({ seg, text });
    else {
      setTyped(null);
      focusSeg(seg, 1);
    }
  }

  const onSegKeyDown = (seg: Seg) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    const k = e.key;
    if (k === "ArrowLeft") focusSeg(seg, -1);
    else if (k === "ArrowRight") focusSeg(seg, 1);
    else if (e.altKey && k === "ArrowDown") setOpen(true);
    else if (readOnly) return;
    else if (k === "ArrowUp" || k === "ArrowDown") stepSeg(seg, k === "ArrowUp" ? 1 : -1);
    else if (k === "PageUp" || k === "PageDown") stepSeg(seg, k === "PageUp" ? 1 : -1, seg === "minute");
    else if (k === "Home" || k === "End") {
      const [lo, hi] = range(seg, cycle);
      commit(setSeg(draft, seg, k === "Home" ? lo : hi), { source: "type" });
    } else if (/^\d$/.test(k) && seg !== "period") typeDigit(seg, k);
    else if (k === "Backspace" || k === "Delete") {
      if (getSeg(seg) == null) focusSeg(seg, -1);
      else commit(setSeg(draft, seg, null), { source: "type" });
      setTyped(null);
    } else if (seg === "period" && k.length === 1 && /\p{L}/u.test(k)) {
      const key = k.toLowerCase();
      const [am, pm] = info.periods.map((p) => p.toLowerCase());
      const p = key === "a" || (am[0] === key && pm[0] !== key) ? 0 : key === "p" || (pm[0] === key && am[0] !== key) ? 1 : null;
      if (p == null) return;
      commit(setSeg(draft, seg, p), { source: "step", seg, trend: p ? 1 : -1 });
    } else if ([":", ".", " ", "h"].includes(k) && seg !== order.at(-1)) focusSeg(seg, 1);
    else return;
    // A handled key belongs to the field, like it would to an input: page shortcuts must not see it.
    e.preventDefault();
    e.stopPropagation();
  };

  const minutesForClock =
    draft.h != null && draft.m != null ? (cycle === 24 ? draft.h * 60 + draft.m : ((draft.h % 12) + (draft.p ?? 0) * 12) * 60 + draft.m) : null;
  const rollFor = (seg: Seg) => {
    const animated = !reduce && roll.source !== "type" && (roll.source === "pick" || roll.seg === seg);
    return { animated, trend: roll.source === "step" && roll.seg === seg ? roll.trend : undefined };
  };

  const segClass = cn(
    "relative inline-flex h-[22px] select-none items-center justify-center rounded-[4px] px-[3px] outline-none",
    "caret-transparent transition-colors duration-75",
    readOnly ? "focus:bg-hover focus:text-fg" : "focus:bg-fg focus:text-frame",
    !disabled && "hover:bg-fg/6",
  );

  return (
    <div
      ref={fieldRef}
      role="group"
      data-size={size}
      data-state={open ? "open" : "closed"}
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        // Touch has no keyboard for the segments, so a tap on the field opens the list instead.
        if (e.pointerType !== "touch" || disabled || readOnly || e.defaultPrevented) return;
        if ((e.target as HTMLElement).closest("[data-slot=time-trigger]")) return;
        e.preventDefault();
        setOpen(true);
      }}
      className={cn(
        "group/time inline-flex shrink-0 items-center gap-1 rounded-lg border border-line-2 bg-raised text-fg shadow-[var(--shadow)]",
        "transition-[border-color,box-shadow] duration-150 ease-out",
        "hover:border-fg-4 focus-within:border-fg-4 focus-within:ring-2 focus-within:ring-fg/10 data-[state=open]:border-fg-4",
        "data-invalid:border-danger/70 data-invalid:hover:border-danger data-invalid:focus-within:border-danger data-invalid:focus-within:ring-danger/15",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        size === "sm" ? "h-7 pl-1.5 pr-0.5 text-[12.5px]" : "h-8 pl-2 pr-1 text-[13px] pointer-coarse:h-10",
        className,
      )}
      {...rest}
    >
      {/* Every piece is laid over an invisible widest time, so the field never changes width. */}
      <div className="grid tabular tracking-[-0.003em]">
        <div aria-hidden className="invisible col-start-1 row-start-1 flex items-center whitespace-pre">
          {info.pieces.map((p, i) =>
            p.kind === "lit" ? (
              <span key={i}>{p.text}</span>
            ) : (
              <span key={i} className="px-[3px]">
                {p.seg === "period" ? (info.periods[0].length >= info.periods[1].length ? info.periods[0] : info.periods[1]) : "88"}
              </span>
            ),
          )}
        </div>
        <div className="col-start-1 row-start-1 flex items-center whitespace-pre">
          {info.pieces.map((p, i) => {
            if (p.kind === "lit")
              return (
                <span key={i} aria-hidden className="text-fg-3">
                  {p.text}
                </span>
              );
            const seg = p.seg;
            const n = getSeg(seg);
            const [lo, hi] = range(seg, cycle);
            const pending = typed?.seg === seg && Number(typed.text) !== n ? typed.text : null;
            const text = n == null ? null : seg === "period" ? info.periods[n] : seg === "minute" || info.padHour ? pad(n) : String(n);
            const r = rollFor(seg);
            return (
              <div
                key={seg}
                ref={(el) => {
                  segRefs.current[seg] = el;
                }}
                role="spinbutton"
                tabIndex={disabled ? -1 : 0}
                aria-label={info.fieldNames[seg]}
                aria-valuemin={lo}
                aria-valuemax={hi}
                aria-valuenow={n ?? undefined}
                aria-valuetext={text ?? "Empty"}
                aria-invalid={invalid || undefined}
                aria-readonly={readOnly || undefined}
                aria-disabled={disabled || undefined}
                data-seg={seg}
                data-placeholder={n == null ? "" : undefined}
                onKeyDown={onSegKeyDown(seg)}
                onFocus={() => setTyped(null)}
                onBlur={() => setTyped(null)}
                className={segClass}
              >
                {pending != null ? (
                  <span>{pending}</span>
                ) : n == null ? (
                  <span className={cn("text-fg-4", !readOnly && "in-focus:text-frame/60")}>––</span>
                ) : seg === "period" ? (
                  <PeriodLabel labels={info.periods} index={n as 0 | 1} animated={r.animated} />
                ) : (
                  <NumberFlow
                    aria-hidden
                    value={n}
                    locales={locale}
                    format={{ minimumIntegerDigits: seg === "minute" || info.padHour ? 2 : 1, useGrouping: false }}
                    digits={{ 1: { max: seg === "minute" ? 5 : cycle === 12 ? 1 : 2 } }}
                    trend={r.trend}
                    animated={r.animated}
                    transformTiming={rollTiming}
                    spinTiming={rollTiming}
                    opacityTiming={{ duration: 140, easing: "ease-out" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Select.Root
        value={exact}
        onValueChange={(v) => {
          if (typeof v === "string") commit(draftFrom(v, cycle), { source: "pick" });
        }}
        open={open}
        onOpenChange={setOpen}
        modal={false}
        disabled={disabled}
        readOnly={readOnly}
      >
        <Select.Trigger
          data-slot="time-trigger"
          aria-label={listLabel}
          className={cn(
            "relative ml-auto grid shrink-0 place-items-center rounded-md text-fg-3 outline-none",
            "transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.92] active:duration-75",
            "hover:bg-fg/6 hover:text-fg data-popup-open:bg-fg/6 data-popup-open:text-fg",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
            "after:absolute after:-inset-1.5 after:content-[''] data-readonly:hidden",
            size === "sm" ? "size-5" : "size-6",
          )}
        >
          <ClockGlyph minutes={minutesForClock} size={size === "sm" ? 14 : 16} />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner anchor={fieldRef} side="bottom" align="start" sideOffset={6} alignItemWithTrigger={false} className="z-(--z-popover) outline-none">
            <Select.Popup
              className={cn(
                "min-w-[max(var(--anchor-width),10rem)] origin-(--transform-origin) overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
                "transition-[opacity,scale,translate,filter] duration-200 ease-out-expo",
                "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-starting-style:blur-[2px] data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1",
                "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-150",
                "motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:blur-none",
              )}
            >
              <Select.List ref={listRef} className="relative max-h-[min(15.5rem,var(--available-height))] overflow-y-auto overscroll-contain p-1 outline-none">
                {slots.length === 0 && <div className="px-2 py-1.5 text-[12.5px] text-fg-3">No times in this range</div>}
                {slots.map((s) => (
                  <Select.Item
                    key={s.value}
                    value={s.value}
                    label={s.label}
                    disabled={s.disabled}
                    data-time={s.value}
                    className={cn(
                      "flex h-8 cursor-default select-none items-center gap-2 rounded-lg pl-1.5 pr-2.5 text-[13px] text-fg-2 outline-none tabular pointer-coarse:h-10",
                      "data-highlighted:bg-fg/6 data-highlighted:text-fg data-selected:text-fg data-disabled:text-fg-4",
                    )}
                  >
                    <span className="grid size-4 shrink-0 place-items-center">
                      <Select.ItemIndicator>
                        <DrawnCheck reduce={!!reduce} />
                      </Select.ItemIndicator>
                    </span>
                    <Select.ItemText className="whitespace-nowrap">{s.label}</Select.ItemText>
                    {s.duration && <span className="ml-auto whitespace-nowrap pl-3 text-[12px] text-fg-4">{s.duration}</span>}
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>

      {name && <input type="hidden" name={name} value={value ?? ""} disabled={disabled} />}
    </div>
  );
}

/** AM/PM swaps inside a box as wide as the longer label, sliding the way the value moved. */
function PeriodLabel({ labels, index, animated }: { labels: [string, string]; index: 0 | 1; animated: boolean }) {
  const dir = index === 1 ? 1 : -1;
  return (
    <span className="relative grid overflow-hidden">
      {labels.map((l) => (
        <span key={l} aria-hidden className="invisible col-start-1 row-start-1">
          {l}
        </span>
      ))}
      <AnimatePresence initial={false} custom={dir}>
        <motion.span
          key={index}
          custom={dir}
          className="col-start-1 row-start-1 text-center"
          variants={{
            enter: (d: number) => ({ y: d * 10, opacity: 0, filter: "blur(2px)" }),
            center: { y: 0, opacity: 1, filter: "blur(0px)" },
            exit: (d: number) => ({ y: d * -10, opacity: 0, filter: "blur(2px)" }),
          }}
          initial={animated ? "enter" : false}
          animate="center"
          exit={animated ? "exit" : { opacity: 0, transition: { duration: 0 } }}
          transition={{ duration: 0.2, ease: ease.out }}
        >
          {labels[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** A clock whose hands point at the chosen time and sweep the short way round when it changes. */
function ClockGlyph({ minutes, size }: { minutes: number | null; size: number }) {
  const hourAngle = minutes == null ? 300 : ((minutes / 60) % 12) * 30;
  const minuteAngle = minutes == null ? 60 : (minutes % 60) * 6;
  const [hands, setHands] = useState({ key: minutes, h: hourAngle, m: minuteAngle });
  if (hands.key !== minutes) {
    const turn = (from: number, to: number) => from + ((((to - from) % 360) + 540) % 360) - 180;
    setHands({ key: minutes, h: turn(hands.h, hourAngle), m: turn(hands.m, minuteAngle) });
  }
  const hand = "origin-[8px_8px] [transform-box:view-box] transition-transform duration-[420ms] ease-in-out-quart";
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 8V5.9" className={hand} style={{ transform: `rotate(${hands.h}deg)` }} />
      <path d="M8 8V3.9" className={hand} style={{ transform: `rotate(${hands.m}deg)` }} />
    </svg>
  );
}

function DrawnCheck({ reduce }: { reduce: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <motion.path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.28, ease: ease.out, delay: 0.04 }}
      />
    </svg>
  );
}
