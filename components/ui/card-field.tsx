"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Alert, CreditCard } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * Card rules. Formatting and validation only: this component never sends card data anywhere.
 * -----------------------------------------------------------------------------------------------*/

export type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "unknown";

export type CardValue = {
  /** Digits only. */
  number: string;
  /** Digits only, MMYY. */
  expiry: string;
  cvc: string;
};

const brandName: Record<CardBrand, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", discover: "Discover", unknown: "" };
const brandTag: Record<CardBrand, string> = { visa: "VISA", mastercard: "MC", amex: "AMEX", discover: "DISC", unknown: "" };

/** The card network from the leading digits, as soon as they are enough to tell. */
export function detectCardBrand(digits: string): CardBrand {
  if (/^4/.test(digits)) return "visa";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return "mastercard";
  if (/^(6011|65|64[4-9])/.test(digits)) return "discover";
  return "unknown";
}

const numberLength = (brand: CardBrand) => (brand === "amex" ? 15 : brand === "unknown" ? 19 : 16);
const cvcLength = (brand: CardBrand) => (brand === "amex" ? 4 : 3);

/** The Luhn checksum every card number carries. */
export function isValidCardNumber(digits: string) {
  if (digits.length < 12) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Groups digits the way they are printed on the card: 4-6-5 for Amex, fours for the rest. */
export function formatCardNumber(digits: string, brand = detectCardBrand(digits)) {
  const groups = brand === "amex" ? [4, 6, 5] : [4, 4, 4, 4, 3];
  const out: string[] = [];
  let i = 0;
  for (const g of groups) {
    if (i >= digits.length) break;
    out.push(digits.slice(i, i + g));
    i += g;
  }
  return out.join(" ");
}

const noop = () => () => {};
// The first day of this month, as a stable number so the store snapshot doesn't change every render.
const currentMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
};

const formatExpiry = (d: string) => (d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d);

type Segment = "number" | "expiry" | "cvc";

function numberComplete(digits: string, brand: CardBrand) {
  return brand === "unknown" ? digits.length >= 16 : digits.length === numberLength(brand);
}

/** The first thing wrong with each segment, or "" when it is fine. `strict` also flags incomplete input. */
function problems(value: CardValue, brand: CardBrand, now: Date | null, strict: Record<Segment, boolean>): Record<Segment, string> {
  const { number, expiry, cvc } = value;
  const out: Record<Segment, string> = { number: "", expiry: "", cvc: "" };

  if (numberComplete(number, brand) && !isValidCardNumber(number)) out.number = "That card number isn’t valid. Check the digits.";
  else if (strict.number && !numberComplete(number, brand)) out.number = number ? "The card number is incomplete." : "Enter a card number.";

  const month = Number(expiry.slice(0, 2));
  if (expiry.length >= 2 && (month < 1 || month > 12)) out.expiry = "Enter a month from 01 to 12.";
  else if (expiry.length === 4 && now) {
    const year = 2000 + Number(expiry.slice(2));
    const end = new Date(year, month, 1);
    if (end <= now) out.expiry = `That card expired in ${expiry.slice(0, 2)}/${expiry.slice(2)}.`;
    else if (year > now.getFullYear() + 20) out.expiry = "Check the expiry year.";
  } else if (strict.expiry && expiry.length < 4) out.expiry = expiry ? "The expiry date is incomplete." : "Enter the expiry date.";

  if (strict.cvc && cvc.length < cvcLength(brand)) out.cvc = cvc ? "The security code is incomplete." : "Enter the security code.";
  return out;
}

/* -------------------------------------------------------------------------------------------------
 * CardField
 * -----------------------------------------------------------------------------------------------*/

export type CardFieldProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  value?: CardValue;
  defaultValue?: CardValue;
  onValueChange?: (value: CardValue) => void;
  /** Called when the whole card becomes valid or stops being valid. */
  onCompleteChange?: (complete: boolean, details: { brand: CardBrand; last4: string }) => void;
  /** Visible label above the field. */
  label?: React.ReactNode;
  /** An error from outside, like a decline. Clear it when the card changes. */
  error?: string;
  disabled?: boolean;
  /** Prefix for the three inputs' names when submitted in a form. */
  name?: string;
};

const empty: CardValue = { number: "", expiry: "", cvc: "" };

export function CardField({
  value: valueProp,
  defaultValue = empty,
  onValueChange,
  onCompleteChange,
  label = "Card information",
  error: externalError,
  disabled = false,
  name,
  className,
  ...rest
}: CardFieldProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const reduce = useReducedMotion();
  const id = useId();
  const brand = detectCardBrand(value.number);
  const [focus, setFocus] = useState<Segment | null>(null);
  const [touched, setTouched] = useState<Record<Segment, boolean>>({ number: false, expiry: false, cvc: false });
  // The clock is only read on the client, so server and client render the same markup.
  const month = useSyncExternalStore(noop, currentMonth, () => null);
  const now = month == null ? null : new Date(month);

  const numberRef = useRef<HTMLInputElement>(null);
  const expiryRef = useRef<HTMLInputElement>(null);
  const cvcRef = useRef<HTMLInputElement>(null);
  const caret = useRef<{ el: HTMLInputElement; pos: number } | null>(null);
  useLayoutEffect(() => {
    const c = caret.current;
    caret.current = null;
    if (c && document.activeElement === c.el) c.el.setSelectionRange(c.pos, c.pos);
  });

  const issues = problems(value, brand, now, touched);
  const order: Segment[] = ["number", "expiry", "cvc"];
  const first = order.find((s) => issues[s]);
  const message = externalError || (first ? issues[first] : "");
  const complete =
    numberComplete(value.number, brand) &&
    isValidCardNumber(value.number) &&
    value.expiry.length === 4 &&
    value.cvc.length === cvcLength(brand) &&
    !problems(value, brand, now, { number: true, expiry: true, cvc: true }).expiry;

  const completeRef = useRef(false);
  useEffect(() => {
    if (completeRef.current === complete) return;
    completeRef.current = complete;
    onCompleteChange?.(complete, { brand, last4: value.number.slice(-4) });
  }, [complete, brand, value.number, onCompleteChange]);

  const update = (patch: Partial<CardValue>) => setValue({ ...value, ...patch });
  const move = (to: Segment, at: "start" | "end") => {
    const el = (to === "number" ? numberRef : to === "expiry" ? expiryRef : cvcRef).current;
    if (!el) return;
    el.focus();
    const pos = at === "start" ? 0 : el.value.length;
    el.setSelectionRange(pos, pos);
  };

  // Arrow keys and Backspace cross the seams between segments, like one long field.
  const seams = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const seg = el.dataset.segment as Segment;
    const i = order.indexOf(seg);
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const atEnd = el.selectionStart === el.value.length;
    if ((e.key === "Backspace" && atStart) || (e.key === "ArrowLeft" && atStart)) {
      if (i > 0) {
        e.preventDefault();
        move(order[i - 1], "end");
      }
    } else if (e.key === "ArrowRight" && atEnd && i < order.length - 1) {
      e.preventDefault();
      move(order[i + 1], "start");
    }
  };

  const onNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const raw = el.value;
    const before = raw.slice(0, el.selectionStart ?? raw.length).replace(/\D/g, "").length;
    const nextBrand = detectCardBrand(raw.replace(/\D/g, ""));
    const digits = raw.replace(/\D/g, "").slice(0, numberLength(nextBrand));
    const formatted = formatCardNumber(digits, nextBrand);
    // Keep the caret after the same digit it followed, whatever spaces were added or removed.
    let pos = 0;
    for (let seen = 0; pos < formatted.length && seen < before; pos++) if (/\d/.test(formatted[pos])) seen++;
    caret.current = { el, pos };
    // A shorter security code limit (switching away from Amex) trims the CVC too.
    update({ number: digits, cvc: value.cvc.slice(0, cvcLength(nextBrand)) });
    if (numberComplete(digits, nextBrand) && isValidCardNumber(digits) && pos === formatted.length) move("expiry", "start");
    else if (numberComplete(digits, nextBrand) && !isValidCardNumber(digits)) setTouched((t) => ({ ...t, number: true }));
  };

  const onExpiry = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    let digits = raw.replace(/\D/g, "");
    // Deleting the " / " separator deletes the digit before it.
    if (digits === value.expiry && raw.length < formatExpiry(value.expiry).length) digits = digits.slice(0, -1);
    // A first digit of 2–9 can only be a single-digit month, so pad it; "1/" becomes "01".
    if (digits.length === 1 && Number(digits) > 1) digits = `0${digits}`;
    if (digits.length === 1 && raw.includes("/")) digits = `0${digits}`;
    digits = digits.slice(0, 4);
    caret.current = null;
    update({ expiry: digits });
    if (digits.length === 4) {
      const p = problems({ ...value, expiry: digits }, brand, now, touched);
      if (!p.expiry) move("cvc", "start");
      else setTouched((t) => ({ ...t, expiry: true }));
    }
  };

  const onCvc = (e: React.ChangeEvent<HTMLInputElement>) => update({ cvc: e.target.value.replace(/\D/g, "").slice(0, cvcLength(brand)) });

  const segmentClass = (seg: Segment) =>
    cn(
      "tabular h-9 min-w-0 bg-transparent text-base outline-none placeholder:text-fg-4 sm:text-[13px]",
      "disabled:cursor-not-allowed",
      issues[seg] ? "text-danger" : "text-fg",
    );
  const invalid = !!message;
  const errorId = `${id}-error`;
  const describe = (seg: Segment) => (externalError || (first === seg && issues[seg]) ? errorId : undefined);
  const blur = (seg: Segment) => () => {
    setFocus((f) => (f === seg ? null : f));
    // Only judge a segment once it has something in it, or on the way out of the whole field.
    setTouched((t) => ({ ...t, [seg]: t[seg] || (seg === "number" ? value.number : seg === "expiry" ? value.expiry : value.cvc).length > 0 }));
  };

  return (
    <div className={cn("@container flex flex-col gap-1.5", className)} data-complete={complete ? "" : undefined} {...rest}>
      {label && (
        <span id={`${id}-label`} className="text-[12.5px] font-medium text-fg-2">
          {label}
        </span>
      )}
      <div
        role="group"
        aria-labelledby={label ? `${id}-label` : undefined}
        data-invalid={invalid ? "" : undefined}
        data-disabled={disabled ? "" : undefined}
        className={cn(
          "flex flex-wrap items-center overflow-hidden rounded-lg border bg-raised shadow-[var(--shadow)]",
          "transition-[border-color,box-shadow] duration-150",
          invalid
            ? "border-danger/70 focus-within:ring-3 focus-within:ring-danger/15"
            : "border-line-2 hover:border-fg-4 focus-within:border-fg-4 focus-within:ring-3 focus-within:ring-fg/10",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <div className="flex min-w-0 basis-full items-center gap-2.5 pl-2.5 pr-2 @min-[340px]:flex-1 @min-[340px]:basis-0">
          <BrandMark brand={brand} back={focus === "cvc"} reduce={!!reduce} />
          <input
            ref={numberRef}
            data-segment="number"
            name={name ? `${name}-number` : undefined}
            value={formatCardNumber(value.number, brand)}
            onChange={onNumber}
            onKeyDown={seams}
            onFocus={() => setFocus("number")}
            onBlur={blur("number")}
            disabled={disabled}
            placeholder="1234 1234 1234 1234"
            aria-label={brand === "unknown" ? "Card number" : `Card number, ${brandName[brand]}`}
            aria-invalid={!!issues.number || !!externalError || undefined}
            aria-describedby={describe("number")}
            inputMode="numeric"
            autoComplete="cc-number"
            autoCorrect="off"
            spellCheck={false}
            className={cn(segmentClass("number"), "flex-1 tracking-[0.01em]")}
          />
          {/* A tick draws once every segment is valid. */}
          <span aria-hidden className="grid size-4 shrink-0 place-items-center text-success">
            <AnimatePresence>
              {complete && !externalError && (
                <motion.svg
                  key="ok"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                >
                  <motion.path
                    d="M3.5 8.5 6.5 11.5 12.5 4.5"
                    initial={{ pathLength: reduce ? 1 : 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: reduce ? 0 : 0.32, ease: ease.out, delay: 0.04 }}
                  />
                </motion.svg>
              )}
            </AnimatePresence>
          </span>
        </div>
        <div className="flex min-w-0 basis-full items-center border-t border-line @min-[340px]:flex-none @min-[340px]:basis-auto @min-[340px]:border-t-0">
          <input
            ref={expiryRef}
            data-segment="expiry"
            name={name ? `${name}-expiry` : undefined}
            value={formatExpiry(value.expiry)}
            onChange={onExpiry}
            onKeyDown={seams}
            onFocus={() => setFocus("expiry")}
            onBlur={blur("expiry")}
            disabled={disabled}
            placeholder="MM / YY"
            aria-label="Expiry date, month and year"
            aria-invalid={!!issues.expiry || undefined}
            aria-describedby={describe("expiry")}
            inputMode="numeric"
            autoComplete="cc-exp"
            className={cn(segmentClass("expiry"), "flex-1 px-2.5 @min-[340px]:w-[76px] @min-[340px]:flex-none @min-[340px]:px-2")}
          />
          <span aria-hidden className="h-5 w-px shrink-0 bg-line @min-[340px]:hidden" />
          <input
            ref={cvcRef}
            data-segment="cvc"
            name={name ? `${name}-cvc` : undefined}
            value={value.cvc}
            onChange={onCvc}
            onKeyDown={seams}
            onFocus={() => setFocus("cvc")}
            onBlur={blur("cvc")}
            disabled={disabled}
            placeholder={brand === "amex" ? "CVC · 4" : "CVC"}
            aria-label={`Security code, ${cvcLength(brand)} digits`}
            aria-invalid={!!issues.cvc || undefined}
            aria-describedby={describe("cvc")}
            inputMode="numeric"
            autoComplete="cc-csc"
            className={cn(segmentClass("cvc"), "flex-1 px-2.5 @min-[340px]:w-[64px] @min-[340px]:flex-none @min-[340px]:pl-1.5 @min-[340px]:pr-2.5")}
          />
        </div>
      </div>
      {/* The first problem only, under the field, and it closes as soon as it's fixed. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-in-out-quart",
          message ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <p id={errorId} role="alert" className="flex min-h-0 items-start gap-1.5 overflow-hidden text-[12px] leading-[1.45] text-danger">
          {message && <Alert size={13} className="mt-[2px] shrink-0" />}
          <span>{message}</span>
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * The brand slot: a small card that names the network, and turns over to show where the
 * security code is while that segment has focus.
 * -----------------------------------------------------------------------------------------------*/

function BrandMark({ brand, back, reduce }: { brand: CardBrand; back: boolean; reduce: boolean }) {
  // Amex prints its code on the front, so the card doesn't turn over for it.
  const side = back && brand !== "amex" ? "back" : "front";
  const key = side === "back" ? "back" : `front-${brand}-${back ? "cvc" : ""}`;
  return (
    <span aria-hidden className="relative grid h-[18px] w-[26px] shrink-0 place-items-center [perspective:240px]">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={key}
          className="absolute inset-0 grid place-items-center"
          initial={reduce ? { opacity: 0 } : side === "back" || key.includes("cvc") ? { rotateY: 90, opacity: 0.6 } : { opacity: 0, scale: 0.7, filter: "blur(2px)" }}
          animate={{ rotateY: 0, opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { rotateY: -90, opacity: 0.6, transition: { duration: 0.12 } }}
          transition={reduce ? { duration: 0.12 } : spring.pop}
        >
          {side === "back" ? <CardBack /> : brand === "unknown" ? <CreditCard size={18} className="text-fg-3" /> : <CardFront brand={brand} cvc={back} />}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function CardFront({ brand, cvc }: { brand: Exclude<CardBrand, "unknown">; cvc: boolean }) {
  return (
    <span className="relative grid h-[18px] w-[26px] place-items-center rounded-[4px] border border-line-2 bg-hover">
      <span className="font-mono text-[7px] font-semibold leading-none tracking-[0.02em] text-fg-2">{brandTag[brand]}</span>
      {cvc && <span className="absolute right-[2px] top-[2px] h-[4px] w-[7px] rounded-[1px] bg-fg" />}
    </span>
  );
}

function CardBack() {
  return (
    <span className="relative block h-[18px] w-[26px] overflow-hidden rounded-[4px] border border-line-2 bg-hover">
      <span className="absolute inset-x-0 top-[3px] h-[3px] bg-fg-4" />
      <span className="absolute left-[3px] top-[9px] h-[4px] w-[12px] rounded-[1px] bg-line-2" />
      <span className="absolute left-[16px] top-[8.5px] h-[5px] w-[7px] rounded-[1px] bg-fg" />
    </span>
  );
}
