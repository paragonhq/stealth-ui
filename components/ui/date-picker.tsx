"use client";
import { Popover } from "@base-ui/react/popover";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useMemo, useRef, useState } from "react";
import { Calendar, addDays, addMonths, compareDays, toISODate, useResolvedLocale, useToday } from "@/components/ui/calendar";
import { cn } from "@/lib/cn";
import { Calendar as CalendarIcon, X } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* ------------------------------------------------------------------ */
/* Parsing what people actually type into a date field.                */
/* ------------------------------------------------------------------ */

const EN = "en-US";
const UNITS: Record<string, "d" | "w" | "m" | "y"> = {
  d: "d", day: "d", days: "d",
  w: "w", wk: "w", wks: "w", week: "w", weeks: "w",
  m: "m", mo: "m", mos: "m", month: "m", months: "m",
  y: "y", yr: "y", yrs: "y", year: "y", years: "y",
};

function names(locale: string, kind: "month" | "weekday") {
  const out: string[][] = [];
  for (const loc of new Set([locale, EN])) {
    const long = new Intl.DateTimeFormat(loc, { [kind]: "long" });
    const short = new Intl.DateTimeFormat(loc, { [kind]: "short" });
    for (let i = 0; i < (kind === "month" ? 12 : 7); i++) {
      // Jan 4 2026 is a Sunday, so weekday i lands on day 4 + i.
      const d = kind === "month" ? new Date(2026, i, 1) : new Date(2026, 0, 4 + i);
      (out[i] ??= []).push(long.format(d), short.format(d));
    }
  }
  return out.map((list) => [...new Set(list.map((n) => n.toLowerCase().replace(/\./g, "")))]);
}

function matchName(token: string, table: string[][]) {
  if (token.length < 2 || /\d/.test(token)) return -1;
  return table.findIndex((list) => list.some((n) => n.startsWith(token) || (n.length >= 3 && token.startsWith(n))));
}

/** The locale's numeric order of day, month and year, e.g. ["month", "day", "year"] for en-US. */
function numericOrder(locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric", year: "numeric" })
    .formatToParts(new Date(2026, 10, 22))
    .map((p) => p.type)
    .filter((t): t is "day" | "month" | "year" => t === "day" || t === "month" || t === "year");
}

function build(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1 || y > 9999) return null;
  const date = new Date(y, m - 1, d);
  date.setFullYear(y);
  return date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

const fullYear = (s: string, fallback: number) => (!s ? fallback : s.length <= 2 ? 2000 + +s : +s);

/**
 * Reads a typed date: ISO (2026-03-12), the locale's numeric order (03/12, 12.03.26), month names in the
 * locale or English (12 Mar, March 12 2026), and relative words (today, tomorrow, in 3 days, +2w, next fri).
 * Returns null when it can't be read. Relative words are English only.
 */
export function parseDateInput(text: string, { locale = EN, today }: { locale?: string; today: Date }): Date | null {
  const s = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return null;
  if (/^(today|tod|now)$/.test(s)) return today;
  if (/^(tomorrow|tmr|tmrw|tom)$/.test(s)) return addDays(today, 1);
  if (/^(yesterday|yday)$/.test(s)) return addDays(today, -1);

  let m = /^(in )?([+-])? ?(\d{1,3}) ?([a-z]+)( ago)?$/.exec(s);
  if (m && UNITS[m[4]]) {
    const n = +m[3] * (m[2] === "-" || m[5] ? -1 : 1);
    const unit = UNITS[m[4]];
    return unit === "d" ? addDays(today, n) : unit === "w" ? addDays(today, n * 7) : addMonths(today, unit === "m" ? n : n * 12);
  }

  m = /^(next |this |last )?([a-z\u00c0-\uffff]+)$/.exec(s);
  if (m) {
    const wd = matchName(m[2], names(locale, "weekday"));
    if (wd >= 0) {
      const ahead = (wd - today.getDay() + 7) % 7 || 7;
      return m[1] === "last " ? addDays(today, ahead - 7 === 0 ? -7 : ahead - 7) : addDays(today, ahead);
    }
  }

  m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) return build(+m[1], +m[2], +m[3]);

  const year = today.getFullYear();
  const tokens = s.split(/[\s,/.\-]+/).filter(Boolean).map((t) => t.replace(/^(\d+)(st|nd|rd|th|er|e|º)$/, "$1"));
  const monthTable = names(locale, "month");
  const monthAt = tokens.findIndex((t) => matchName(t, monthTable) >= 0);
  if (monthAt >= 0) {
    const nums = tokens.filter((_, i) => i !== monthAt);
    if (nums.length > 2 || nums.some((t) => !/^\d+$/.test(t))) return null;
    const dayTok = nums.find((t) => t.length <= 2);
    const yearTok = nums.find((t) => t !== dayTok);
    if (!dayTok) return null;
    return build(fullYear(yearTok ?? "", year), matchName(tokens[monthAt], monthTable) + 1, +dayTok);
  }

  if (tokens.every((t) => /^\d+$/.test(t))) {
    const order = numericOrder(locale);
    if (tokens.length === 1 && tokens[0].length === 8) {
      // 12032026 in the locale's order.
      const t = tokens[0];
      const parts: Record<string, string> = {};
      let i = 0;
      for (const k of order) {
        const w = k === "year" ? 4 : 2;
        parts[k] = t.slice(i, i + w);
        i += w;
      }
      return build(+parts.year, +parts.month, +parts.day);
    }
    if (tokens.length === 1 && tokens[0].length <= 2) return build(year, today.getMonth() + 1, +tokens[0]);
    if (tokens.length === 2) {
      const dm = order.filter((k) => k !== "year");
      const v = { [dm[0]]: +tokens[0], [dm[1]]: +tokens[1] } as Record<string, number>;
      return build(year, v.month, v.day);
    }
    if (tokens.length === 3) {
      const v = {} as Record<string, string>;
      order.forEach((k, i) => (v[k] = tokens[i]));
      return build(fullYear(v.year, year), +v.month, +v.day);
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */

export type DatePickerShortcut = { label: string; date: (today: Date) => Date };

export type DatePickerProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "children"> & {
  value?: Date | null;
  defaultValue?: Date | null;
  onValueChange?: (date: Date | null) => void;
  label?: React.ReactNode;
  /** A hint under the field. Replaced by the parse preview while typing, and by errors. */
  description?: React.ReactNode;
  /** Defaults to the locale's numeric pattern, e.g. mm/dd/yyyy. */
  placeholder?: string;
  min?: Date;
  max?: Date;
  isDateDisabled?: (date: Date) => boolean;
  locale?: string;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** How a committed date is written back into the field. */
  formatOptions?: Intl.DateTimeFormatOptions;
  /** Quick picks above the calendar, e.g. Today, Tomorrow, Next Monday. */
  shortcuts?: DatePickerShortcut[];
  /** Shows a clear button while there's a value. */
  clearable?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  /** Marks the field invalid from outside, e.g. after a failed submit. */
  invalid?: boolean;
  /** Shown under the field while invalid. */
  errorMessage?: React.ReactNode;
  /** Submits the value as YYYY-MM-DD under this name. */
  name?: string;
  size?: "sm" | "md";
};

const DEFAULT_FORMAT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

export function DatePicker({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  label,
  description,
  placeholder,
  min,
  max,
  isDateDisabled,
  locale: localeProp,
  weekStartsOn,
  formatOptions = DEFAULT_FORMAT,
  shortcuts,
  clearable = true,
  disabled = false,
  readOnly = false,
  required,
  invalid: invalidProp = false,
  errorMessage,
  name,
  size = "md",
  className,
  id: idProp,
  ...rest
}: DatePickerProps) {
  const uid = useId();
  const inputId = idProp ?? `${uid}-input`;
  const messageId = `${uid}-message`;
  const reduce = useReducedMotion();
  const today = useToday();
  const locale = useResolvedLocale(localeProp);

  const [value, setValue] = useControllableState<Date | null>({ value: valueProp, defaultValue, onChange: onValueChange });
  // null: the field shows the committed value. A string: what the person is typing.
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const viaPointer = useRef(false);
  const closeTimer = useRef(0);

  const fmt = useMemo(() => new Intl.DateTimeFormat(locale, formatOptions), [locale, formatOptions]);
  const longFmt = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }), [locale]);
  const hintFmt = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" }), [locale]);
  const briefFmt = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }), [locale]);
  // Messages sit in a narrow line under the field: drop the year when it's this year.
  const brief = (d: Date) => (today && d.getFullYear() === today.getFullYear() ? briefFmt.format(d) : fmt.format(d));
  const pattern = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" })
        .formatToParts(new Date(2026, 10, 22))
        .map((p) => (p.type === "day" ? "dd" : p.type === "month" ? "mm" : p.type === "year" ? "yyyy" : p.value))
        .join(""),
    [locale],
  );

  const text = draft ?? (value ? fmt.format(value) : "");
  const parsed = draft && today ? parseDateInput(draft, { locale, today }) : null;

  function refusal(d: Date): string | null {
    if (min && compareDays(d, min) < 0) return `Pick ${brief(min)} or later`;
    if (max && compareDays(d, max) > 0) return `Pick ${brief(max)} or earlier`;
    if (isDateDisabled?.(d)) return `${brief(d)} isn’t available. Pick another day.`;
    return null;
  }

  /** Reads the draft and either commits it or explains why not. Returns whether the field is settled. */
  function commit(): boolean {
    if (draft === null) return true;
    if (!draft.trim()) {
      setDraft(null);
      setError(null);
      if (value) setValue(null);
      return true;
    }
    if (!parsed) {
      setError(`Couldn’t read that. Try “${today ? brief(today) : pattern}” or “tomorrow”.`);
      return false;
    }
    const why = refusal(parsed);
    if (why) {
      setError(why);
      return false;
    }
    setDraft(null);
    setError(null);
    setValue(parsed);
    return true;
  }

  function pick(d: Date) {
    window.clearTimeout(closeTimer.current);
    setDraft(null);
    setError(null);
    setValue(d);
    // Let a pointer see the day fill before the popover goes; a key press closes on the same frame.
    if (viaPointer.current && !reduce) closeTimer.current = window.setTimeout(() => setOpen(false), 140);
    else setOpen(false);
  }

  function onOpenChange(next: boolean) {
    window.clearTimeout(closeTimer.current);
    if (next) {
      if (disabled || readOnly) return;
      commit();
    }
    setOpen(next);
  }

  const invalid = invalidProp || !!error;
  const message: { kind: string; node: React.ReactNode } | null =
    invalidProp && errorMessage
      ? { kind: "error", node: errorMessage }
      : error
        ? { kind: "error", node: error }
        : parsed && draft !== null && !refusal(parsed)
          ? {
              kind: "hint",
              node: (
                <>
                  {hintFmt.format(parsed)}
                  <span className="sr-only">. Press Enter to set.</span>
                  <kbd aria-hidden className="ml-1.5 inline-grid h-4 min-w-4 place-items-center rounded-[4px] border border-line-2 px-1 font-mono text-[10px] text-fg-3">↵</kbd>
                </>
              ),
            }
          : description
            ? { kind: "description", node: description }
            : null;
  const showClear = clearable && !!text && !disabled && !readOnly;
  const sm = size === "sm";

  return (
    <div
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      data-open={open || undefined}
      className={cn("group/picker flex w-full min-w-0 flex-col gap-1.5", className)}
      {...rest}
    >
      {label && (
        <label htmlFor={inputId} className={cn("w-fit text-[12.5px] font-medium leading-4", disabled ? "text-fg-3" : "text-fg")}>
          {label}
          {required && <span aria-hidden className="text-fg-3"> *</span>}
        </label>
      )}

      <Popover.Root open={open} onOpenChange={onOpenChange}>
        <div
          ref={anchorRef}
          data-invalid={invalid || undefined}
          data-disabled={disabled || undefined}
          data-readonly={readOnly || undefined}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest("input, button") || disabled) return;
            e.preventDefault();
            inputRef.current?.focus();
          }}
          className={cn(
            "group/box relative flex w-full min-w-0 items-center border border-line-2 bg-raised text-fg shadow-[var(--shadow)]",
            "transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:border-fg-4",
            "focus-within:border-fg-3 focus-within:ring-3 focus-within:ring-fg/8 hover:focus-within:border-fg-3",
            "group-data-open/picker:border-fg-3 group-data-open/picker:ring-3 group-data-open/picker:ring-fg/8",
            "data-invalid:border-danger/70 data-invalid:hover:border-danger data-invalid:focus-within:border-danger data-invalid:focus-within:ring-danger/15",
            "data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:shadow-none data-disabled:hover:border-line-2",
            "data-readonly:bg-frame data-readonly:shadow-none data-readonly:hover:border-line-2",
            sm ? "h-7 gap-1 rounded-md pl-2 pr-0.5" : "h-8 gap-1 rounded-lg pl-2.5 pr-0.5",
          )}
        >
          <input
            ref={inputRef}
            id={inputId}
            value={text}
            placeholder={placeholder ?? pattern}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
            aria-invalid={invalid || undefined}
            aria-describedby={message ? messageId : undefined}
            aria-haspopup="dialog"
            aria-expanded={open}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            onBlur={() => commit()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Only swallow Enter when there's something to read, so a settled field still submits its form.
                if (draft !== null) {
                  e.preventDefault();
                  commit();
                }
              } else if (e.key === "Escape" && (draft !== null || error)) {
                e.preventDefault();
                setDraft(null);
                setError(null);
              } else if (e.key === "ArrowDown" && !readOnly) {
                e.preventDefault();
                onOpenChange(true);
              }
            }}
            className={cn(
              "h-full min-w-0 flex-1 bg-transparent tabular outline-none placeholder:text-fg-4 disabled:cursor-not-allowed read-only:cursor-default",
              sm ? "text-base sm:text-[12.5px]" : "text-base sm:text-[13px]",
            )}
          />

          {clearable && (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Clear date"
              inert={!showClear}
              data-state={showClear ? "visible" : "hidden"}
              onClick={() => {
                setDraft(null);
                setError(null);
                setValue(null);
                inputRef.current?.focus();
              }}
              className={cn(
                "relative grid size-5 shrink-0 place-items-center rounded-[5px] text-fg-3 outline-none",
                "before:absolute before:-inset-1.5 before:content-[''] pointer-coarse:before:-inset-3",
                "hover:bg-hover hover:text-fg active:scale-[0.88]",
                "transition-[opacity,scale,filter,background-color,color] duration-100 ease-out",
                "pointer-events-none scale-75 opacity-0 blur-[2px] motion-reduce:scale-100 motion-reduce:blur-none",
                "data-[state=visible]:group-hover/box:pointer-events-auto data-[state=visible]:group-hover/box:scale-100 data-[state=visible]:group-hover/box:opacity-100 data-[state=visible]:group-hover/box:blur-none",
                "data-[state=visible]:group-focus-within/box:pointer-events-auto data-[state=visible]:group-focus-within/box:scale-100 data-[state=visible]:group-focus-within/box:opacity-100 data-[state=visible]:group-focus-within/box:blur-none",
                "data-[state=visible]:duration-200 data-[state=visible]:ease-out-expo",
              )}
            >
              <X size={sm ? 12 : 14} />
            </button>
          )}

          <Popover.Trigger
            disabled={disabled || readOnly}
            aria-label={value ? `Choose date, ${longFmt.format(value)}` : "Choose date"}
            className={cn(
              "group/trigger relative grid shrink-0 place-items-center rounded-md text-fg-3 outline-none",
              "before:absolute before:-inset-1 before:content-[''] pointer-coarse:before:-inset-2",
              "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
              "data-popup-open:bg-hover data-popup-open:text-fg disabled:pointer-events-none disabled:text-fg-4",
              sm ? "size-6" : "size-7",
            )}
          >
            {/* The page of the calendar icon lifts a pixel while its popover is open. */}
            <CalendarIcon size={sm ? 14 : 16} className="transition-transform duration-200 ease-out-expo group-data-popup-open/trigger:-translate-y-px" />
          </Popover.Trigger>
        </div>

        <Popover.Portal>
          <Popover.Positioner anchor={anchorRef} side="bottom" align="start" sideOffset={6} collisionPadding={8} className="z-(--z-popover)">
            <Popover.Popup
              initialFocus={false}
              finalFocus={(type) => (type === "touch" ? false : inputRef.current)}
              onPointerDownCapture={() => (viaPointer.current = true)}
              onKeyDownCapture={() => (viaPointer.current = false)}
              className={cn(
                "flex flex-col rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
                "origin-[var(--transform-origin)] transition-[opacity,scale,translate] duration-200 ease-out-expo",
                "data-starting-style:-translate-y-1 data-starting-style:scale-[0.96] data-starting-style:opacity-0",
                "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:ease-out",
                "motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:scale-100",
              )}
            >
              {shortcuts && shortcuts.length > 0 && today && (
                <div role="group" aria-label="Shortcuts" className="flex flex-wrap gap-1 border-b border-line p-2">
                  {shortcuts.map((s) => {
                    const d = s.date(today);
                    const why = refusal(d);
                    const on = !!value && compareDays(value, d) === 0;
                    return (
                      <button
                        key={s.label}
                        type="button"
                        disabled={!!why}
                        aria-pressed={on}
                        title={why ?? longFmt.format(d)}
                        onClick={() => pick(d)}
                        className={cn(
                          "h-7 rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150",
                          "hover:bg-hover hover:text-fg active:scale-[0.95] active:duration-75 disabled:pointer-events-none disabled:opacity-40",
                          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                          "aria-pressed:bg-fg/[0.08] aria-pressed:text-fg",
                        )}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              )}
              <Calendar
                bare
                autoFocus
                className="p-3"
                value={value}
                defaultMonth={value ?? undefined}
                onValueChange={(d) => d && pick(d)}
                min={min}
                max={max}
                isDateDisabled={isDateDisabled}
                locale={locale}
                weekStartsOn={weekStartsOn}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {/* One reserved line: the description, the live read of what's typed, or the error, swapped in place. */}
      {/* A read-only or disabled field with nothing to say doesn't hold the line open. */}
      <div id={messageId} aria-live="polite" className={cn("relative text-[12px] leading-4", (message || !(readOnly || disabled)) && "min-h-4")}>
        <AnimatePresence initial={false} mode="popLayout">
          {message && (
            <motion.p
              key={message.kind === "hint" ? "hint" : `${message.kind}:${typeof message.node === "string" ? message.node : ""}`}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.2, ease: ease.out }}
              className={cn(
                "flex items-start gap-1.5",
                message.kind === "error" ? "text-danger" : message.kind === "hint" ? "text-fg-2" : "text-fg-3",
              )}
            >
              {message.kind === "error" && <ErrorGlyph />}
              <span className="min-w-0">{message.node}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {name && <input type="hidden" name={name} value={value ? toISODate(value) : ""} />}
    </div>
  );
}

function ErrorGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden className="mt-0.5 shrink-0">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3.5" />
      <circle cx="8" cy="11" r=".6" fill="currentColor" stroke="none" />
    </svg>
  );
}
