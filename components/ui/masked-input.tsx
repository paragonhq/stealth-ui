"use client";
import { Field } from "@base-ui/react/field";
import { Input } from "@base-ui/react/input";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Alert } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

/* ───────────────────────── Pattern engine ─────────────────────────
   A pattern is a string where # is a digit, A a letter, * either, and
   anything else a literal the mask types for you: "(###) ###-####". */

const SLOT = /[#A*]/;
const fits = (ch: string, token: string) =>
  token === "#" ? /\d/.test(ch) : token === "A" ? /\p{L}/u.test(ch) : token === "*" ? /[\p{L}\d]/u.test(ch) : false;
const slotCount = (pattern: string) => [...pattern].filter((c) => SLOT.test(c)).length;

/** Pull the characters the pattern accepts out of whatever is in the field, in order. */
export function unmask(text: string, pattern: string) {
  const slots = [...pattern].filter((c) => SLOT.test(c));
  let out = "";
  for (const ch of text) {
    if (out.length >= slots.length) break;
    if (fits(ch, slots[out.length])) out += ch;
  }
  return out;
}

/**
 * Lay raw characters into the pattern. Literals appear only once a character
 * follows them, unless `trailing` is set, which types the next separator for
 * you as soon as a group is full ("04" becomes "04/" while typing forward).
 */
export function applyMask(raw: string, pattern: string, trailing = false) {
  let out = "";
  let i = 0;
  for (const token of pattern) {
    if (SLOT.test(token)) {
      if (i >= raw.length) break;
      out += raw[i++];
    } else {
      if (i >= raw.length && !trailing) break;
      out += token;
    }
  }
  return out;
}

/** Where the caret belongs once `count` raw characters sit before it. */
function caretAfter(formatted: string, pattern: string, count: number) {
  if (count === 0) {
    let p = 0;
    while (p < formatted.length && !SLOT.test(pattern[p])) p++;
    return p;
  }
  let seen = 0;
  for (let p = 0; p < formatted.length; p++) {
    if (SLOT.test(pattern[p])) seen++;
    if (seen === count) {
      // Hop over separators that follow, so the next keystroke lands in a slot.
      let q = p + 1;
      while (q < formatted.length && !SLOT.test(pattern[q])) q++;
      return q;
    }
  }
  return formatted.length;
}

/* ───────────────────────── Presets ───────────────────────── */

export type CardBrand = "visa" | "mastercard" | "amex" | "discover" | null;
const brandNames: Record<Exclude<CardBrand, null>, string> = { visa: "Visa", mastercard: "Mastercard", amex: "Amex", discover: "Discover" };

export function cardBrand(digits: string): CardBrand {
  if (/^4/.test(digits)) return "visa";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return "mastercard";
  if (/^(6011|65|64[4-9])/.test(digits)) return "discover";
  return null;
}

export function luhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return digits.length > 0 && sum % 10 === 0;
}

type Preset = {
  pattern: (raw: string) => string;
  ghost: (raw: string) => string;
  inputMode: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  /** Fix up raw input before it's laid out. */
  refine?: (raw: string) => string;
  check?: (raw: string) => boolean;
  invalidMessage?: (raw: string, locale: string) => string;
};

const presets: Record<"card" | "phone" | "date", Preset> = {
  card: {
    pattern: (raw) => (cardBrand(raw) === "amex" ? "#### ###### #####" : "#### #### #### ####"),
    ghost: (raw) => (cardBrand(raw) === "amex" ? "0000 000000 00000" : "0000 0000 0000 0000"),
    inputMode: "numeric",
    autoComplete: "cc-number",
    check: luhn,
    invalidMessage: () => "Check the card number for a typo",
  },
  phone: {
    pattern: () => "(###) ###-####",
    ghost: () => "(000) 000-0000",
    inputMode: "tel",
    autoComplete: "tel-national",
  },
  date: {
    pattern: () => "##/##/####",
    ghost: () => "MM/DD/YYYY",
    inputMode: "numeric",
    // A 4 in the month can only mean April; a 5 in the day, the 5th.
    refine: (raw) => {
      let r = raw;
      if (/^[2-9]/.test(r)) r = `0${r}`;
      if (/^\d{2}[4-9]/.test(r)) r = `${r.slice(0, 2)}0${r.slice(2)}`;
      return r.slice(0, 8);
    },
    check: (raw) => parseDate(raw) !== null,
    // Say exactly what's wrong: "April has 30 days" beats "invalid date".
    invalidMessage: (raw, locale) => {
      const m = Number(raw.slice(0, 2)), d = Number(raw.slice(2, 4)), y = Number(raw.slice(4));
      if (m < 1 || m > 12) return "Months go from 01 to 12";
      if (y <= 1900) return "Check the year";
      const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const month = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
      return d < 1 ? "Days start at 01" : `${month} ${y} has ${days} days`;
    },
  },
};

function parseDate(raw: string) {
  if (raw.length !== 8) return null;
  const m = Number(raw.slice(0, 2)), d = Number(raw.slice(2, 4)), y = Number(raw.slice(4));
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d && y > 1900 ? date : null;
}

/* ───────────────────────── Currency ───────────────────────── */

function currencyParts(locale: string, currency: string) {
  const parts = new Intl.NumberFormat(locale, { style: "currency", currency }).formatToParts(1234.5);
  const symbol = parts.find((p) => p.type === "currency")?.value ?? currency;
  const decimal = parts.find((p) => p.type === "decimal")?.value ?? ".";
  const prefix = parts.findIndex((p) => p.type === "currency") < parts.findIndex((p) => p.type === "integer");
  const fraction = new Intl.NumberFormat(locale, { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return { symbol, decimal, prefix, fraction, group: new Intl.NumberFormat(locale, { maximumFractionDigits: 0, useGrouping: true }) };
}

/** Raw is a plain decimal string ("1250.5"); returns what the field shows. */
function formatCurrency(raw: string, c: ReturnType<typeof currencyParts>) {
  if (!raw) return "";
  const [int, frac] = raw.split(".");
  const grouped = int === "" ? "0" : c.group.format(BigInt(int));
  return frac === undefined ? grouped : `${grouped}${c.decimal}${frac}`;
}

/** Reads digits and one decimal separator from the field, in order. */
function parseCurrency(text: string, c: ReturnType<typeof currencyParts>) {
  let int = "", frac: string | undefined;
  for (const ch of text) {
    if (/\d/.test(ch)) {
      if (frac === undefined) {
        if (int.length < 12) int += ch;
      } else if (frac.length < c.fraction) frac += ch;
    } else if ((ch === c.decimal || ch === ".") && frac === undefined && c.fraction > 0) frac = "";
  }
  int = int.replace(/^0+(?=\d)/, "");
  return frac === undefined ? int : `${int || "0"}.${frac}`;
}

/* ───────────────────────── Component ───────────────────────── */

export type MaskKind = "card" | "phone" | "date" | "currency";

export type MaskDetails = {
  formatted: string;
  /** Every slot is filled (for currency: there is an amount). */
  complete: boolean;
  /** Complete and passes the preset's check: Luhn for cards, a real date for dates. */
  valid: boolean;
  brand?: CardBrand;
  /** For dates, the ISO form (YYYY-MM-DD) once valid. */
  iso?: string;
};

export type MaskedInputProps = Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "size" | "type" | "children"> & {
  /** A preset, or your own pattern: # digit, A letter, * either, anything else is typed for you. */
  mask: MaskKind | (string & {});
  /** The raw value: digits only for card, phone and date; a plain decimal for currency. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (raw: string, details: MaskDetails) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  /** An error from outside. Built-in checks (card number, date) show their own message on blur. */
  error?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** ISO 4217 code for the currency preset. */
  currency?: string;
  /** Locale for currency grouping and symbols. Fixed by default so server and client agree. */
  locale?: string;
  /** Ghost text for a custom pattern; defaults to the pattern with slots shown as 0. */
  ghost?: string;
};

const sizes = {
  sm: { box: "h-7 rounded-md", pad: "px-2", text: "text-base sm:text-[12.5px]" },
  md: { box: "h-8 rounded-lg", pad: "px-2.5", text: "text-base sm:text-[13px]" },
  lg: { box: "h-9 rounded-lg", pad: "px-3", text: "text-base sm:text-[13px]" },
};

export function MaskedInput({
  mask,
  value: valueProp,
  defaultValue = "",
  onValueChange,
  label,
  description,
  error: errorProp,
  size = "md",
  currency = "USD",
  locale = "en-US",
  ghost: ghostProp,
  className,
  disabled,
  readOnly,
  onBlur,
  onFocus,
  onKeyDown,
  ref,
  ...rest
}: MaskedInputProps) {
  const reduce = useReducedMotion();
  const isCurrency = mask === "currency";
  const preset: Preset | null = mask === "card" || mask === "phone" || mask === "date" ? presets[mask as keyof typeof presets] : null;
  const money = useMemo(() => (isCurrency ? currencyParts(locale, currency) : null), [isCurrency, locale, currency]);

  const [inner, setInner] = useState(defaultValue);
  const raw = valueProp ?? inner;
  // Trailing separators are shown only right after typing forward; stored so a re-render keeps them.
  const [trailing, setTrailing] = useState(false);
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingCaret = useRef<number | null>(null);

  const pattern = preset ? preset.pattern(raw) : isCurrency ? "" : mask;
  const formatted = money ? formatCurrency(raw, money) : applyMask(raw, pattern, trailing);
  const slots = pattern ? slotCount(pattern) : 0;
  const complete = money ? raw !== "" : raw.length === slots;
  const valid = complete && (preset?.check ? preset.check(raw) : true);
  const brand = mask === "card" ? cardBrand(raw) : undefined;
  const date = mask === "date" && valid ? parseDate(raw) : null;

  // The ghost is whatever of the template hasn't been typed yet, drawn behind the text.
  const ghostFull = preset ? preset.ghost(raw) : ghostProp ?? pattern.replace(/[#*]/g, "0");
  const ghostRest = money
    ? raw === ""
      ? ""
      : raw.includes(".")
        ? "0".repeat(money.fraction - (raw.split(".")[1]?.length ?? 0))
        : money.fraction > 0
          ? `${money.decimal}${"0".repeat(money.fraction)}`
          : ""
    : ghostFull.slice(formatted.length);

  const builtInError = touched && !focused && complete && !valid ? preset?.invalidMessage?.(raw, locale) : undefined;
  const error = errorProp ?? builtInError;

  const commit = (nextRaw: string, caret: number | null, forward: boolean) => {
    pendingCaret.current = caret;
    setTrailing(forward);
    if (valueProp === undefined) setInner(nextRaw);
    if (nextRaw !== raw || forward !== trailing) {
      const nextPattern = preset ? preset.pattern(nextRaw) : pattern;
      const nextFormatted = money ? formatCurrency(nextRaw, money) : applyMask(nextRaw, nextPattern, forward);
      const nextComplete = money ? nextRaw !== "" : nextRaw.length === slotCount(nextPattern);
      const nextValid = nextComplete && (preset?.check ? preset.check(nextRaw) : true);
      const d = mask === "date" && nextValid ? parseDate(nextRaw) : null;
      onValueChange?.(nextRaw, {
        formatted: nextFormatted,
        complete: nextComplete,
        valid: nextValid,
        brand: mask === "card" ? cardBrand(nextRaw) : undefined,
        iso: d ? d.toISOString().slice(0, 10) : undefined,
      });
    }
  };

  // Re-derive raw + caret from whatever the browser just put in the field.
  const handle = (text: string, caretIn: number, forward: boolean) => {
    if (money) {
      const nextRaw = parseCurrency(text, money);
      const countBefore = (s: string) => [...s].filter((ch) => /\d/.test(ch) || ch === money.decimal || ch === ".").length;
      const want = countBefore(text.slice(0, caretIn));
      const out = formatCurrency(nextRaw, money);
      let p = 0, seen = 0;
      while (p < out.length && seen < want) {
        if (/\d/.test(out[p]) || out[p] === money.decimal) seen++;
        p++;
      }
      commit(nextRaw, p, forward);
      return;
    }
    const before = unmask(text.slice(0, caretIn), pattern).length;
    let nextRaw = unmask(text, preset ? preset.pattern(unmask(text, "*".repeat(40))) : pattern);
    let shift = 0;
    if (preset?.refine) {
      const refined = preset.refine(nextRaw);
      shift = refined.length - nextRaw.length;
      nextRaw = refined;
    }
    const nextPattern = preset ? preset.pattern(nextRaw) : pattern;
    const out = applyMask(nextRaw, nextPattern, forward);
    commit(nextRaw, caretAfter(out, nextPattern, Math.min(nextRaw.length, before + Math.max(0, shift))), forward);
  };

  useLayoutEffect(() => {
    const input = inputRef.current;
    const caret = pendingCaret.current;
    if (!input || caret === null || document.activeElement !== input) return;
    pendingCaret.current = null;
    input.setSelectionRange(caret, caret);
  });

  const s = sizes[size];
  const adornStart = money?.prefix ? money.symbol : null;
  const adornEnd = money && !money.prefix ? money.symbol : null;
  const trailingHint =
    mask === "card" && brand ? brandNames[brand] : date ? new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(date) : null;

  return (
    <Field.Root invalid={Boolean(error) || undefined} disabled={disabled} data-size={size} className={cn("group/field flex w-full min-w-0 flex-col gap-1.5", className)}>
      {label && <Field.Label className="w-fit text-[12.5px] font-medium leading-4 text-fg group-data-[disabled]/field:text-fg-3">{label}</Field.Label>}
      <div
        data-slot="control"
        data-complete={complete || undefined}
        className={cn(
          "relative flex items-center border border-line-2 bg-raised",
          "transition-[border-color,box-shadow] duration-150 ease-out",
          "hover:border-fg-4 focus-within:border-fg-3 focus-within:ring-3 focus-within:ring-fg/8 focus-within:hover:border-fg-3",
          "group-data-[invalid]/field:border-danger/60 group-data-[invalid]/field:focus-within:border-danger/80 group-data-[invalid]/field:focus-within:ring-danger/15",
          "group-data-[disabled]/field:pointer-events-none group-data-[disabled]/field:opacity-50",
          readOnly && "bg-hover",
          s.box,
        )}
      >
        {adornStart && <span aria-hidden className={cn("shrink-0 select-none pl-2.5 text-fg-3 tabular", s.text)}>{adornStart}</span>}
        <div className="relative flex h-full min-w-0 flex-1 items-center">
          {/* The ghost sits exactly under the text: the typed part invisible, the rest faint. */}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre tabular",
              adornStart ? "pl-1" : s.pad,
              s.text,
            )}
          >
            <span className="invisible">{formatted}</span>
            <span className="text-fg-4">{ghostRest}</span>
          </span>
          <Input
            {...rest}
            ref={(node: HTMLInputElement | null) => {
              inputRef.current = node;
              if (typeof ref === "function") ref(node);
              else if (ref) ref.current = node;
            }}
            type="text"
            value={formatted}
            disabled={disabled}
            readOnly={readOnly}
            inputMode={money ? "decimal" : preset?.inputMode ?? rest.inputMode}
            autoComplete={rest.autoComplete ?? preset?.autoComplete ?? (money ? "transaction-amount" : "off")}
            spellCheck={false}
            onChange={(e) => {
              const ev = e.nativeEvent as InputEvent;
              const forward = !ev.inputType || ev.inputType.startsWith("insert");
              handle(e.target.value, e.target.selectionStart ?? e.target.value.length, forward);
            }}
            onKeyDown={(e) => {
              onKeyDown?.(e);
              if (e.defaultPrevented || money) return;
              const el = e.currentTarget;
              const start = el.selectionStart ?? 0;
              if (start !== el.selectionEnd) return;
              // Deleting across a separator deletes the character on its far side,
              // instead of the separator popping straight back.
              if (e.key === "Backspace" && start > 0 && !SLOT.test(pattern[start - 1] ?? "#")) {
                let j = start - 1;
                while (j >= 0 && !SLOT.test(pattern[j])) j--;
                e.preventDefault();
                if (j < 0) return;
                handle(formatted.slice(0, j) + formatted.slice(j + 1), j, false);
              } else if (e.key === "Delete" && start < formatted.length && !SLOT.test(pattern[start] ?? "#")) {
                let j = start;
                while (j < formatted.length && !SLOT.test(pattern[j])) j++;
                e.preventDefault();
                if (j >= formatted.length) return;
                handle(formatted.slice(0, j) + formatted.slice(j + 1), start, false);
              }
            }}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              setTouched(true);
              // Leaving the field drops a dangling separator ("04/" becomes "04").
              if (trailing) setTrailing(false);
              onBlur?.(e);
            }}
            className={cn(
              "relative h-full w-full min-w-0 bg-transparent text-fg tabular outline-none placeholder:text-fg-4",
              adornStart ? "pl-1" : s.pad,
              adornEnd || trailingHint || valid ? "pr-1" : s.pad.replace("px", "pr"),
              s.text,
              "disabled:cursor-not-allowed",
            )}
          />
        </div>
        {adornEnd && <span aria-hidden className={cn("shrink-0 select-none pr-2.5 text-fg-3", s.text)}>{adornEnd}</span>}

        {(trailingHint || (valid && !money)) && (
          <span aria-hidden className="flex shrink-0 items-center gap-1.5 pr-2.5">
            <AnimatePresence initial={false} mode="popLayout">
              {trailingHint && (
                <motion.span
                  key={trailingHint}
                  layout={reduce ? false : "position"}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)", transition: { duration: 0.12 } }}
                  transition={{ duration: reduce ? 0.12 : 0.2, ease: ease.out }}
                  className="text-[11.5px] font-medium text-fg-3"
                >
                  {trailingHint}
                </motion.span>
              )}
            </AnimatePresence>
            {/* initial={false}: a value that's already valid on load shows its tick without drawing it. */}
            <AnimatePresence initial={false}>{valid && !money && <Tick key="tick" reduce={!!reduce} />}</AnimatePresence>
          </span>
        )}
      </div>

      <MessageSlot description={description} error={error} />
      <span role="status" aria-live="polite" className="sr-only">
        {valid && mask === "card" && brand ? `${brandNames[brand]} card number complete` : date ? new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" }).format(date) : ""}
      </span>
    </Field.Root>
  );
}

function Tick({ reduce }: { reduce: boolean }) {
  return (
    <motion.svg
      width={14}
      height={14}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-success"
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
      transition={reduce ? { duration: 0.12 } : spring.pop}
    >
      <motion.path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: ease.out, delay: 0.05 }}
      />
    </motion.svg>
  );
}

function MessageSlot({ description, error }: { description?: React.ReactNode; error?: React.ReactNode }) {
  if (!description && !error) return null;
  return (
    <div className="grid text-[12px] leading-4">
      {description && (
        <Field.Description className="col-start-1 row-start-1 text-fg-3 transition-opacity duration-150 group-data-[invalid]/field:invisible group-data-[invalid]/field:opacity-0">
          {description}
        </Field.Description>
      )}
      <Field.Error
        match={error ? true : undefined}
        className="col-start-1 row-start-1 flex items-start gap-1.5 text-danger transition-[opacity,translate] duration-200 ease-out-expo data-[starting-style]:-translate-y-1 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 data-[ending-style]:duration-100 motion-reduce:translate-y-0"
      >
        {error ? (
          <>
            <Alert size={14} className="mt-px shrink-0" />
            <span>{error}</span>
          </>
        ) : undefined}
      </Field.Error>
    </div>
  );
}
