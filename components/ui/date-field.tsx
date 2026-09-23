"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

type Seg = "day" | "month" | "year";
type Parts = Record<Seg, string>;
type Layout = ({ kind: "seg"; seg: Seg } | { kind: "sep"; text: string })[];

const EMPTY: Parts = { day: "", month: "", year: "" };
const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const iso = (d: Date) => `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysIn = (y: number, m: number) => new Date(y, m, 0).getDate();
const fromDate = (d: Date | null): Parts => (d ? { day: String(d.getDate()), month: String(d.getMonth() + 1), year: String(d.getFullYear()) } : EMPTY);
const cmp = (a: Date, b: Date) => iso(a).localeCompare(iso(b));

/** The date the parts spell, or null when a part is missing or the day doesn't exist in that month. */
function toDate(p: Parts): Date | null {
  if (!p.day || !p.month || p.year.length !== 4) return null;
  const y = +p.year;
  const m = +p.month;
  const d = +p.day;
  if (m < 1 || m > 12 || d < 1 || d > daysIn(y, m)) return null;
  const date = new Date(y, m - 1, d);
  date.setFullYear(y);
  return date;
}

const LIMITS: Record<Seg, [number, number]> = { day: [1, 31], month: [1, 12], year: [1, 9999] };

function subscribeLanguage(notify: () => void) {
  window.addEventListener("languagechange", notify);
  return () => window.removeEventListener("languagechange", notify);
}

export type DateFieldProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "children"> & {
  value?: Date | null;
  defaultValue?: Date | null;
  /** Called with a complete, valid date, or null when the field is emptied or can't form one. */
  onValueChange?: (date: Date | null) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  min?: Date;
  max?: Date;
  /** BCP 47 tag. Decides the segment order, separators and names. Defaults to the browser's language. */
  locale?: string;
  /** Placeholder letters per segment. */
  placeholders?: Partial<Record<Seg, string>>;
  /** A quiet weekday after a complete date, so "is the 14th a Friday?" is answered in place. */
  showWeekday?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  invalid?: boolean;
  errorMessage?: React.ReactNode;
  /** Submits the value as YYYY-MM-DD under this name. */
  name?: string;
  size?: "sm" | "md";
};

export function DateField({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  label,
  description,
  min,
  max,
  locale: localeProp,
  placeholders,
  showWeekday = true,
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
}: DateFieldProps) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const messageId = `${uid}-message`;
  const reduce = useReducedMotion();
  const browser = useSyncExternalStore(subscribeLanguage, () => navigator.language, () => "en-US");
  const locale = localeProp ?? browser;

  const [value, setValue] = useControllableState<Date | null>({ value: valueProp, defaultValue, onChange: onValueChange });
  const [parts, setParts] = useState<Parts>(() => fromDate(value));
  // Keep the segments in step with a value set from outside, without wiping a half-typed date.
  const vKey = value ? iso(value) : "";
  const [seen, setSeen] = useState(vKey);
  if (seen !== vKey) {
    setSeen(vKey);
    const shown = toDate(parts);
    if ((shown ? iso(shown) : "") !== vKey) setParts(fromDate(value));
  }

  // Digits typed into the focused segment since it took focus.
  const [entry, setEntry] = useState<{ seg: Seg; digits: string } | null>(null);
  // The direction of the last arrow step, for the digit tick. 0 while typing.
  const [spin, setSpin] = useState<{ seg: Seg; dir: number; n: number } | null>(null);
  const [touched, setTouched] = useState(false);
  const [focusedSeg, setFocusedSeg] = useState<Seg | null>(null);

  const segRefs = useRef<Partial<Record<Seg, HTMLSpanElement | null>>>({});
  const groupRef = useRef<HTMLDivElement>(null);

  const { layout, names, monthName, weekday, full } = useMemo(() => {
    const parts = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date(2026, 10, 22));
    const layout: Layout = [];
    for (const p of parts) {
      if (p.type === "day" || p.type === "month" || p.type === "year") layout.push({ kind: "seg", seg: p.type });
      else if (p.type === "literal" && layout.length && layout.length < 5) layout.push({ kind: "sep", text: p.value.trim() || p.value });
    }
    let names: Record<Seg, string> = { day: "Day", month: "Month", year: "Year" };
    try {
      const dn = new Intl.DisplayNames(locale, { type: "dateTimeField" });
      names = { day: dn.of("day") ?? "Day", month: dn.of("month") ?? "Month", year: dn.of("year") ?? "Year" };
    } catch {}
    return {
      layout,
      names,
      monthName: new Intl.DateTimeFormat(locale, { month: "long" }),
      weekday: new Intl.DateTimeFormat(locale, { weekday: "short" }),
      full: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }),
    };
  }, [locale]);
  const order = layout.flatMap((l) => (l.kind === "seg" ? [l.seg] : []));
  const ph: Record<Seg, string> = { day: "dd", month: "mm", year: "yyyy", ...placeholders };

  const date = toDate(parts);
  const filled = order.filter((s) => parts[s]).length;
  const refusal = date
    ? min && cmp(date, min) < 0
      ? `Pick ${full.format(min)} or later`
      : max && cmp(date, max) > 0
        ? `Pick ${full.format(max)} or earlier`
        : null
    : null;
  // A day the month doesn't have, said in words: "February 2027 has 28 days".
  const noSuchDay =
    !date && parts.day && parts.month && parts.year.length === 4 && +parts.month >= 1 && +parts.month <= 12
      ? `${new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(+parts.year, +parts.month - 1, 1))} has ${daysIn(+parts.year, +parts.month)} days`
      : null;
  const incomplete = touched && filled > 0 && filled < 3 && !focusedSeg ? "Enter a full date" : null;
  const problem = refusal ?? noSuchDay ?? incomplete;
  const invalid = invalidProp || !!problem;
  const message = invalidProp && errorMessage ? { kind: "error", node: errorMessage } : problem ? { kind: "error", node: problem } : description ? { kind: "description", node: description } : null;

  function write(next: Parts) {
    setParts(next);
    const d = toDate(next);
    const ok = d && !(min && cmp(d, min) < 0) && !(max && cmp(d, max) > 0) ? d : null;
    const key = ok ? iso(ok) : "";
    if (key !== vKey) {
      setSeen(key);
      setValue(ok);
    }
  }

  const focusSeg = (seg: Seg | undefined) => seg && segRefs.current[seg]?.focus();
  const neighbor = (seg: Seg, step: number) => order[order.indexOf(seg) + step];

  function typeDigit(seg: Seg, d: string) {
    const prev = entry?.seg === seg ? entry.digits : "";
    let digits = prev + d;
    const [lo, hi] = LIMITS[seg];
    let done = false;
    if (seg === "year") {
      done = digits.length >= 4;
      digits = digits.slice(-4);
    } else {
      // A second digit that would overflow starts the segment again instead.
      if (digits.length === 2 && (+digits > hi || +digits < lo)) digits = d;
      const max1 = seg === "day" ? 3 : 1;
      done = digits.length === 2 || +digits > max1;
    }
    setSpin(null);
    setEntry(done ? null : { seg, digits });
    write({ ...parts, [seg]: digits });
    if (done) focusSeg(neighbor(seg, 1));
  }

  function step(seg: Seg, dir: number, big = false) {
    const now = new Date();
    const current = parts[seg] ? +parts[seg] : null;
    const [lo] = LIMITS[seg];
    let hi = LIMITS[seg][1];
    if (seg === "day" && parts.month) hi = daysIn(parts.year.length === 4 ? +parts.year : 2024, +parts.month);
    let next: number;
    if (current === null) next = seg === "day" ? now.getDate() : seg === "month" ? now.getMonth() + 1 : now.getFullYear();
    else if (seg === "year") next = Math.min(9999, Math.max(1, current + dir * (big ? 10 : 1)));
    else {
      const span = hi - lo + 1;
      next = ((((current + dir * (big ? (seg === "day" ? 7 : 3) : 1) - lo) % span) + span) % span) + lo;
    }
    setEntry(null);
    setSpin((s) => ({ seg, dir: current === null ? 0 : dir, n: (s?.n ?? 0) + 1 }));
    write({ ...parts, [seg]: String(next) });
  }

  function onKeyDown(seg: Seg, e: React.KeyboardEvent<HTMLSpanElement>) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Tab" || e.key === "Escape") return;
    e.preventDefault();
    if (readOnly || disabled) {
      if (e.key === "ArrowLeft") focusSeg(neighbor(seg, -1));
      if (e.key === "ArrowRight") focusSeg(neighbor(seg, 1));
      return;
    }
    if (/^\d$/.test(e.key)) typeDigit(seg, e.key);
    else if (e.key === "ArrowUp") step(seg, 1, e.shiftKey);
    else if (e.key === "ArrowDown") step(seg, -1, e.shiftKey);
    else if (e.key === "PageUp") step(seg, 1, true);
    else if (e.key === "PageDown") step(seg, -1, true);
    else if (e.key === "Home" && seg !== "year") write({ ...parts, [seg]: String(LIMITS[seg][0]) });
    else if (e.key === "End" && seg !== "year") write({ ...parts, [seg]: String(seg === "day" && parts.month ? daysIn(+parts.year || 2024, +parts.month) : LIMITS[seg][1]) });
    else if (e.key === "ArrowLeft") focusSeg(neighbor(seg, -1));
    else if (e.key === "ArrowRight") focusSeg(neighbor(seg, 1));
    else if (e.key === "Backspace" || e.key === "Delete") {
      if (!parts[seg]) return void (e.key === "Backspace" && focusSeg(neighbor(seg, -1)));
      const digits = e.key === "Delete" ? "" : parts[seg].slice(0, -1);
      setEntry(digits ? { seg, digits } : null);
      setSpin(null);
      write({ ...parts, [seg]: digits });
    } else if (/^[\s/.\-,]$/.test(e.key) && parts[seg]) focusSeg(neighbor(seg, 1));
  }

  // Phone keyboards often skip keydown for digits and send beforeinput instead.
  const handlers = useRef({ typeDigit, readOnly, disabled });
  useEffect(() => {
    handlers.current = { typeDigit, readOnly, disabled };
  });
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const onBeforeInput = (e: InputEvent) => {
      const seg = ((e.target as HTMLElement).closest?.("[data-segment]") as HTMLElement | null)?.dataset.segment as Seg | undefined;
      e.preventDefault();
      if (!seg || handlers.current.readOnly || handlers.current.disabled) return;
      for (const ch of e.data ?? "") if (/\d/.test(ch)) handlers.current.typeDigit(seg, ch);
    };
    group.addEventListener("beforeinput", onBeforeInput);
    return () => group.removeEventListener("beforeinput", onBeforeInput);
  }, []);

  function onPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    if (readOnly || disabled) return;
    const text = e.clipboardData.getData("text").trim();
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
    if (m) return write({ year: m[1], month: String(+m[2]), day: String(+m[3]) });
    const nums = text.split(/[^\d]+/).filter(Boolean);
    if (nums.length === 3) {
      const next = { ...EMPTY };
      order.forEach((s, i) => (next[s] = s === "year" && nums[i].length === 2 ? `20${nums[i]}` : String(+nums[i])));
      write(next);
    }
  }

  function display(seg: Seg) {
    const v = parts[seg];
    if (!v) return { typed: "", rest: ph[seg] };
    if (seg === "year") {
      // A year still being typed shows what's left to type as placeholder.
      const typing = entry?.seg === "year" && v.length < 4;
      return typing ? { typed: v, rest: ph.year.slice(v.length) } : { typed: pad(+v, 4), rest: "" };
    }
    return { typed: pad(+v), rest: "" };
  }

  const sm = size === "sm";

  return (
    <div data-invalid={invalid || undefined} data-disabled={disabled || undefined} className={cn("flex w-full min-w-0 flex-col gap-1.5", className)} {...rest}>
      {label && (
        <span
          id={labelId}
          onClick={() => focusSeg(order.find((s) => !parts[s]) ?? order[0])}
          className={cn("w-fit text-[12.5px] font-medium leading-4", disabled ? "text-fg-3" : "text-fg")}
        >
          {label}
          {required && <span aria-hidden className="text-fg-3"> *</span>}
        </span>
      )}

      <div
        ref={groupRef}
        id={idProp}
        role="group"
        aria-labelledby={label ? labelId : undefined}
        aria-describedby={message ? messageId : undefined}
        aria-invalid={invalid || undefined}
        aria-disabled={disabled || undefined}
        data-invalid={invalid || undefined}
        data-disabled={disabled || undefined}
        data-readonly={readOnly || undefined}
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest("[data-segment]") || disabled) return;
          e.preventDefault();
          focusSeg(order.find((s) => !parts[s]) ?? order[order.length - 1]);
        }}
        onPaste={onPaste}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setFocusedSeg(null);
            setTouched(true);
            // Two typed digits of year mean this century.
            if (parts.year.length > 0 && parts.year.length <= 2) write({ ...parts, year: String(2000 + +parts.year) });
          }
        }}
        className={cn(
          "relative flex w-full min-w-0 cursor-text items-center border border-line-2 bg-raised text-fg shadow-[var(--shadow)]",
          "transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:border-fg-4",
          "focus-within:border-fg-3 focus-within:ring-3 focus-within:ring-fg/8 hover:focus-within:border-fg-3",
          "data-invalid:border-danger/70 data-invalid:hover:border-danger data-invalid:focus-within:border-danger data-invalid:focus-within:ring-danger/15",
          "data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:shadow-none data-disabled:hover:border-line-2",
          "data-readonly:bg-frame data-readonly:shadow-none data-readonly:hover:border-line-2",
          // Mono, so dd, 07, yyyy and 2026 are all the same width: filling a segment never nudges the next one.
          "font-mono tracking-[-0.01em]",
          sm ? "h-7 rounded-md px-1.5 text-base sm:text-[12px]" : "h-8 rounded-lg px-2 text-base sm:text-[12.5px]",
        )}
      >
        {layout.map((part, i) => {
          if (part.kind === "sep") {
            return (
              <span key={i} aria-hidden className={cn("px-px transition-colors duration-150", filled ? "text-fg-3" : "text-fg-4")}>
                {part.text}
              </span>
            );
          }
          const { seg } = part;
          const v = parts[seg];
          const shown = display(seg);
          const ticking = !reduce && spin?.seg === seg && spin.dir !== 0;
          return (
            <span
              key={seg}
              ref={(el) => {
                segRefs.current[seg] = el;
              }}
              data-segment={seg}
              data-placeholder={!v || undefined}
              role="spinbutton"
              tabIndex={disabled ? -1 : 0}
              contentEditable={!disabled}
              suppressContentEditableWarning
              inputMode="numeric"
              enterKeyHint="next"
              spellCheck={false}
              autoCorrect="off"
              aria-label={names[seg]}
              aria-valuenow={v ? +v : undefined}
              aria-valuemin={LIMITS[seg][0]}
              aria-valuemax={seg === "day" && parts.month ? daysIn(+parts.year || 2024, +parts.month) : LIMITS[seg][1]}
              aria-valuetext={!v ? "Empty" : seg === "month" && +v >= 1 && +v <= 12 ? `${+v}, ${monthName.format(new Date(2026, +v - 1, 1))}` : v}
              aria-readonly={readOnly || undefined}
              aria-required={required || undefined}
              onKeyDown={(e) => onKeyDown(seg, e)}
              onFocus={() => {
                setFocusedSeg(seg);
                setEntry(null);
              }}
              className={cn(
                "relative inline-grid overflow-hidden rounded-[4px] px-0.5 text-center tabular leading-6 caret-transparent outline-none",
                "transition-[background-color,color] duration-100 [&::selection]:bg-transparent [&_*::selection]:bg-transparent",
                "focus:bg-fg focus:text-frame",
                "data-placeholder:text-fg-4 data-placeholder:focus:text-frame/70",
              )}
            >
              {/* Sized by whichever is wider, the placeholder or the digits, so filling it never shifts the row. */}
              <span aria-hidden className="invisible col-start-1 row-start-1">{ph[seg]}</span>
              <span aria-hidden className="invisible col-start-1 row-start-1">{seg === "year" ? "0000" : "00"}</span>
              {/* The digits tick up or down with the arrow that changed them; typing replaces them in place. */}
              <motion.span
                key={`${shown.typed}${shown.rest}-${ticking ? spin!.n : 0}`}
                initial={ticking ? { y: spin!.dir * -7, opacity: 0 } : false}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.14, ease: ease.out }}
                aria-hidden
                className="col-start-1 row-start-1 whitespace-pre"
              >
                {shown.typed}
                {shown.rest && <span className={cn(shown.typed && "text-fg-4 [[data-segment]:focus_&]:text-frame/60")}>{shown.rest}</span>}
              </motion.span>
            </span>
          );
        })}

        <AnimatePresence initial={false}>
          {showWeekday && date && !refusal && (
            <motion.span
              key={iso(date)}
              aria-hidden
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.2, ease: ease.out }}
              className="ml-auto pl-2 font-sans text-[12px] text-fg-3"
            >
              {weekday.format(date)}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div
        id={messageId}
        aria-live="polite"
        className={cn("relative text-[12px] leading-4", (message || !(readOnly || disabled)) && "min-h-4")}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {message && (
            <motion.p
              key={`${message.kind}:${typeof message.node === "string" ? message.node : ""}`}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.2, ease: ease.out }}
              className={cn("flex items-start gap-1.5", message.kind === "error" ? "text-danger" : "text-fg-3")}
            >
              {message.kind === "error" && (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden className="mt-0.5 shrink-0">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3.5" />
                  <circle cx="8" cy="11" r=".6" fill="currentColor" stroke="none" />
                </svg>
              )}
              <span className="min-w-0">{message.node}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {name && <input type="hidden" name={name} value={date && !refusal ? iso(date) : ""} />}
    </div>
  );
}
