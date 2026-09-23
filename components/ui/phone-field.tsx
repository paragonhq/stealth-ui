"use client";
import { Combobox } from "@base-ui/react/combobox";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Check, ChevronDown, Search } from "@/lib/icons";
import { ease, spring, swap } from "@/lib/motion";

/* ───────────────────────── countries ───────────────────────── */

export type PhoneCountry = {
  /** ISO 3166-1 alpha-2. */
  iso: string;
  name: string;
  /** Calling code without the plus. */
  dial: string;
  /** National format, # for a digit. The count of # is the maximum length. */
  pattern: string;
  /** Fewest national digits that make a complete number. Defaults to the pattern's length. */
  min?: number;
  /** Drops a leading 0 typed out of national habit (07400… becomes 7400…). */
  trunk?: boolean;
  /** A believable number for the placeholder. */
  example: string;
  /** Other formats chosen by leading digits, like London's 20 7946 0958 beside mobile 7400 123456. */
  formats?: { prefix: string; pattern: string }[];
};

// One line per country: iso|name|dial|pattern|example|min|trunk|prefix=pattern;…
const raw = `
US|United States|1|(###) ###-####|2015550123
CA|Canada|1|(###) ###-####|6135550123
GB|United Kingdom|44|#### ######|7400123456||t|20=## #### ####;23=## #### ####;24=## #### ####;28=## #### ####;29=## #### ####
IE|Ireland|353|## ### ####|851234567||t
DE|Germany|49|### ########|15123456789|9|t|30=## ########;40=## ########;69=## ########;89=## ########
FR|France|33|# ## ## ## ##|612345678||t
ES|Spain|34|### ## ## ##|612345678
IT|Italy|39|### ### ####|3123456789|9
PT|Portugal|351|### ### ###|912345678
NL|Netherlands|31|# ########|612345678||t
BE|Belgium|32|### ## ## ##|470123456|8|t
CH|Switzerland|41|## ### ## ##|781234567||t
AT|Austria|43|### #######|6641234567|9|t
SE|Sweden|46|##-### ## ##|701234567|7|t
NO|Norway|47|### ## ###|40612345
DK|Denmark|45|## ## ## ##|20123456
FI|Finland|358|## ### ####|412345678|6|t
PL|Poland|48|### ### ###|512345678
CZ|Czechia|420|### ### ###|601123456
GR|Greece|30|### ### ####|6912345678
TR|Türkiye|90|### ### ## ##|5012345678||t
UA|Ukraine|380|## ### ## ##|501234567||t
IL|Israel|972|##-###-####|501234567|8|t
AE|United Arab Emirates|971|## ### ####|501234567|8|t
SA|Saudi Arabia|966|## ### ####|512345678||t
EG|Egypt|20|### ### ####|1001234567||t
ZA|South Africa|27|## ### ####|711234567||t
NG|Nigeria|234|### ### ####|8021234567||t
KE|Kenya|254|### ######|712123456||t
IN|India|91|##### #####|8123456789||t
PK|Pakistan|92|### #######|3012345678||t
BD|Bangladesh|880|####-######|1812345678||t
CN|China|86|### #### ####|13123456789||t
JP|Japan|81|##-####-####|9012345678|9|t
KR|South Korea|82|##-####-####|1020000000|9|t
TW|Taiwan|886|### ### ###|912345678||t
HK|Hong Kong|852|#### ####|51234567
SG|Singapore|65|#### ####|81234567
MY|Malaysia|60|##-#### ####|123456789|9|t
TH|Thailand|66|## ### ####|812345678|8|t
VN|Vietnam|84|## ### ## ##|912345678||t
PH|Philippines|63|### ### ####|9051234567||t
ID|Indonesia|62|###-####-####|81234567890|9|t
AU|Australia|61|### ### ###|412345678||t|2=# #### ####;3=# #### ####;7=# #### ####;8=# #### ####
NZ|New Zealand|64|## ### ####|211234567|8|t
MX|Mexico|52|## #### ####|5512345678
BR|Brazil|55|(##) #####-####|11961234567|10|t
AR|Argentina|54|## ####-####|1123456789||t
CL|Chile|56|# #### ####|912345678
CO|Colombia|57|### ### ####|3211234567
PE|Peru|51|### ### ###|912345678`;

export const phoneCountries: PhoneCountry[] = raw
  .trim()
  .split("\n")
  .map((l) => {
    const [iso, name, dial, pattern, example, min, trunk, alt] = l.split("|");
    const formats = alt?.split(";").map((f) => {
      const [prefix, p] = f.split("=");
      return { prefix, pattern: p };
    });
    return { iso, name, dial, pattern, example, min: min ? Number(min) : undefined, trunk: trunk === "t", formats };
  });

const byIso = new Map(phoneCountries.map((c) => [c.iso, c]));
const maxDigits = (c: PhoneCountry) => [...c.pattern].filter((ch) => ch === "#").length;
const minDigits = (c: PhoneCountry) => c.min ?? maxDigits(c);

// North American numbers share +1; these area codes are Canadian.
const CA_AREAS = new Set("204 226 236 249 250 289 306 343 365 403 416 418 431 437 438 450 506 514 519 548 579 581 587 604 613 639 647 672 705 709 742 778 780 782 807 819 825 867 873 902 905".split(" "));

/** Regional indicator letters make the flag emoji for an ISO code. */
export const flagOf = (iso: string) => String.fromCodePoint(...[...iso.toUpperCase()].map((ch) => 0x1f1a5 + ch.charCodeAt(0)));

/** The pattern for these digits: the longest matching prefix format, or the country's default. */
export const patternFor = (c: PhoneCountry, digits: string) =>
  c.formats?.filter((f) => digits.startsWith(f.prefix)).sort((a, b) => b.prefix.length - a.prefix.length)[0]?.pattern ?? c.pattern;

/** Fills a pattern with digits, adding separators only between digits that exist. */
export function formatPhone(digits: string, pattern: string) {
  let out = "";
  let i = 0;
  for (const ch of pattern) {
    if (i >= digits.length) break;
    if (ch === "#") out += digits[i++];
    else out += ch;
  }
  return out + digits.slice(i);
}

/**
 * Reads an international number ("+44 (0)20 7946 0958", "0044…") into a country and
 * national digits. Uses the longest calling code that matches, and area codes for +1.
 */
export function parsePhone(input: string, countries = phoneCountries): { country: PhoneCountry; national: string } | null {
  const cleaned = input.replace(/\(0\)/g, "").trim();
  const intl = cleaned.startsWith("+") || cleaned.startsWith("00");
  if (!intl) return null;
  const digits = cleaned.replace(/\D/g, "").replace(/^00/, "");
  const hits = countries.filter((c) => digits.startsWith(c.dial)).sort((a, b) => b.dial.length - a.dial.length);
  if (!hits.length) return null;
  const dial = hits[0].dial;
  const national = digits.slice(dial.length);
  const group = hits.filter((c) => c.dial === dial);
  const country = dial === "1" && CA_AREAS.has(national.slice(0, 3)) ? group.find((c) => c.iso === "CA") ?? group[0] : group[0];
  return { country, national };
}

// A code that is typed so far is only safe to act on when no longer code starts with it.
const unambiguous = (digits: string, countries: PhoneCountry[]) =>
  countries.some((c) => c.dial === digits) && !countries.some((c) => c.dial.length > digits.length && c.dial.startsWith(digits));

/* ───────────────────────── the field ───────────────────────── */

export type PhoneFieldDetails = { country: PhoneCountry; national: string; complete: boolean };

export type PhoneFieldProps = Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "size" | "type"> & {
  /** E.164, like +14155550132. An empty string is no number. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (e164: string, details: PhoneFieldDetails) => void;
  /** ISO code of the country when there's no number yet. */
  defaultCountry?: string;
  /** Pinned to the top of the list, in this order. */
  preferredCountries?: string[];
  countries?: PhoneCountry[];
  size?: "sm" | "md";
  invalid?: boolean;
  /** Submits the E.164 value in a hidden input. */
  name?: string;
};

export function PhoneField({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  defaultCountry = "US",
  preferredCountries = [],
  countries = phoneCountries,
  size = "md",
  invalid = false,
  name,
  disabled,
  readOnly,
  className,
  id: idProp,
  onBlur,
  onKeyDown,
  onPaste,
  ...rest
}: PhoneFieldProps) {
  const uid = useId();
  const id = idProp ?? `${uid}-input`;
  const reduce = useReducedMotion();
  const initial = () => parsePhone(valueProp ?? defaultValue, countries) ?? { country: byIso.get(defaultCountry) ?? countries[0], national: "" };
  const [country, setCountry] = useState<PhoneCountry>(() => initial().country);
  const [national, setNational] = useState(() => initial().national);
  // Set by a + code; lets +1 settle on Canada once the area code arrives.
  const [auto, setAuto] = useState(false);
  // Raw "+4…" text while a code is still ambiguous.
  const [pendingIntl, setPendingIntl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pulse, setPulse] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const caret = useRef<number | null>(null);

  const e164 = national ? `+${country.dial}${national}` : "";

  // Follow a controlled value that changed from outside (a paste handler, a reset, saved data).
  const [seen, setSeen] = useState(valueProp);
  if (valueProp !== seen) {
    setSeen(valueProp);
    if (valueProp !== undefined && valueProp !== e164) {
      const parsed = parsePhone(valueProp, countries);
      if (parsed) {
        if (parsed.country.iso !== country.iso) setPulse((p) => p + 1);
        setCountry(parsed.country);
        setNational(parsed.national.slice(0, maxDigits(parsed.country)));
      } else setNational("");
      setPendingIntl(null);
    }
  }

  const emit = (c: PhoneCountry, n: string) => {
    const next = n ? `+${c.dial}${n}` : "";
    setSeen(next);
    onValueChange?.(next, { country: c, national: n, complete: n.length >= minDigits(c) && n.length <= maxDigits(c) });
  };

  const commit = (c: PhoneCountry, n: string, caretDigits: number | null, from: "type" | "code" | "pick") => {
    const clipped = n.slice(0, maxDigits(c));
    if (c.iso !== country.iso && from === "code") setPulse((p) => p + 1);
    setCountry(c);
    setNational(clipped);
    setPendingIntl(null);
    if (caretDigits !== null) caret.current = caretIndex(formatPhone(clipped, patternFor(c, clipped)), Math.min(caretDigits, clipped.length));
    emit(c, clipped);
  };

  useLayoutEffect(() => {
    if (caret.current === null || document.activeElement !== inputRef.current) return;
    inputRef.current?.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });

  const handleText = (text: string, caretPos: number | null) => {
    if (text.trim().startsWith("+") || text.trim().startsWith("00")) {
      const digits = text.replace(/\(0\)/g, "").replace(/\D/g, "").replace(/^00/, "");
      const parsed = parsePhone(text, countries);
      // Act when the code is certain: a whole number was pasted, or the code typed so far has no longer rival.
      if (parsed && (digits.length > parsed.country.dial.length || unambiguous(digits, countries))) {
        setAuto(true);
        return commit(parsed.country, parsed.national, parsed.national.length, "code");
      }
      setPendingIntl(`+${digits}`);
      return;
    }
    let digits = text.replace(/\D/g, "");
    const before = caretPos === null ? digits.length : text.slice(0, caretPos).replace(/\D/g, "").length;
    let shift = 0;
    if (country.trunk && digits.startsWith("0")) {
      digits = digits.slice(1);
      shift = 1;
    }
    let target = country;
    if (auto && country.dial === "1" && digits.length >= 3) {
      target = (CA_AREAS.has(digits.slice(0, 3)) ? countries.find((c) => c.iso === "CA") : countries.find((c) => c.iso === "US")) ?? country;
      if (target.iso !== country.iso) setPulse((p) => p + 1);
    }
    commit(target, digits, Math.max(0, before - shift), "type");
  };

  const shown = pendingIntl ?? formatPhone(national, patternFor(country, national));
  const complete = national.length >= minDigits(country);

  const filtered = useMemo(() => {
    const pinned = preferredCountries.map((iso) => countries.find((c) => c.iso === iso)).filter((c): c is PhoneCountry => !!c);
    const ordered = [...pinned, ...countries.filter((c) => !preferredCountries.includes(c.iso))];
    const q = query.trim().toLowerCase().replace(/^\+/, "");
    if (!q) return ordered;
    return countries.filter((c) => c.name.toLowerCase().includes(q) || c.iso.toLowerCase() === q || c.dial.startsWith(q.replace(/\D/g, "") || "_"));
  }, [countries, preferredCountries, query]);
  const lastPinned = query.trim() ? -1 : preferredCountries.filter((iso) => countries.some((c) => c.iso === iso)).length - 1;

  return (
    <div
      ref={fieldRef}
      data-size={size}
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      data-complete={complete || undefined}
      className={cn(
        "group/phone relative flex w-full min-w-0 items-stretch rounded-lg border border-line-2 bg-raised shadow-[var(--shadow)]",
        "transition-[border-color,box-shadow] duration-150 hover:border-fg-4 focus-within:border-fg-4 focus-within:ring-3 focus-within:ring-fg/10",
        "data-[invalid]:border-danger data-[invalid]:focus-within:ring-danger/15 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        size === "sm" ? "h-7" : "h-8",
        className,
      )}
    >
      <Combobox.Root<PhoneCountry>
        items={filtered}
        filteredItems={filtered}
        value={country}
        onValueChange={(c) => {
          if (!c) return;
          setAuto(false);
          commit(c, national, null, "pick");
        }}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
        inputValue={query}
        onInputValueChange={(q) => setQuery(q)}
        itemToStringLabel={(c) => c.name}
        itemToStringValue={(c) => c.iso}
        isItemEqualToValue={(a, b) => a.iso === b.iso}
        disabled={disabled}
        readOnly={readOnly}
        autoHighlight
      >
        <Combobox.Trigger
          aria-label={`Country: ${country.name}, +${country.dial}`}
          className={cn(
            "group/cc relative flex shrink-0 select-none items-center gap-1.5 rounded-l-[7px] border-r border-line pl-2.5 pr-2 outline-none",
            "transition-[background-color] duration-150 hover:bg-fg/[0.04] active:bg-fg/[0.07] data-[popup-open]:bg-fg/[0.05]",
            "focus-visible:bg-fg/[0.05] focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-fg-4",
          )}
        >
          <span className="relative grid size-4 place-items-center text-[15px] leading-none" aria-hidden>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={`${country.iso}-${pulse}`}
                initial={reduce ? { opacity: 0 } : swap.initial}
                animate={swap.animate}
                exit={reduce ? { opacity: 0 } : swap.exit}
                transition={reduce ? { duration: 0.12 } : spring.pop}
              >
                {flagOf(country.iso)}
              </motion.span>
            </AnimatePresence>
          </span>
          {/* Wide enough for +880, so the number never shifts when the code changes. */}
          <span className="relative grid min-w-[4ch] overflow-hidden font-mono text-[12px] tabular text-fg-2" aria-hidden>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={country.dial}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: ease.out }}
              >
                +{country.dial}
              </motion.span>
            </AnimatePresence>
          </span>
          <ChevronDown size={12} className="text-fg-4 transition-transform duration-200 ease-out group-data-[popup-open]/cc:rotate-180 motion-reduce:transition-none" />
        </Combobox.Trigger>

        <Combobox.Portal>
          <Combobox.Positioner anchor={fieldRef} align="start" sideOffset={6} collisionPadding={8} className="z-(--z-popover)">
            <Combobox.Popup
              aria-label="Choose a country"
              finalFocus={inputRef}
              className={cn(
                "flex w-(--anchor-width) min-w-[260px] max-w-(--available-width) origin-(--transform-origin) flex-col overflow-hidden rounded-xl border border-line-2 bg-raised shadow-pop outline-none",
                "transition-[opacity,scale] duration-180 ease-out-expo data-starting-style:scale-[0.97] data-starting-style:opacity-0",
                "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-120",
                "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
              )}
            >
              <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
                <Search size={14} className="shrink-0 text-fg-4" />
                <Combobox.Input
                  placeholder="Search countries or codes"
                  aria-label="Search countries or codes"
                  className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]"
                />
              </div>
              <Combobox.Empty className="empty:hidden">
                <p className="px-3 py-6 text-center text-[12.5px] text-fg-3">
                  No country matches <span className="text-fg">“{query.trim()}”</span>
                </p>
              </Combobox.Empty>
              <Combobox.List className="max-h-[min(280px,calc(var(--available-height)-48px))] scroll-py-1 overflow-y-auto overscroll-contain p-1 empty:p-0">
                {(c: PhoneCountry, index: number) => (
                  <Combobox.Item
                    key={c.iso}
                    value={c}
                    index={index}
                    data-last-pinned={index === lastPinned || undefined}
                    className={cn(
                      "relative flex h-8 cursor-default select-none items-center gap-2.5 rounded-md pl-2 pr-2 text-[13px] text-fg-2 outline-none",
                      "data-[highlighted]:bg-fg/[0.07] data-[highlighted]:text-fg data-[selected]:text-fg",
                      "data-[last-pinned]:mb-[9px] data-[last-pinned]:after:absolute data-[last-pinned]:after:inset-x-1 data-[last-pinned]:after:-bottom-[5px] data-[last-pinned]:after:h-px data-[last-pinned]:after:bg-line",
                    )}
                  >
                    <span className="text-[15px] leading-none" aria-hidden>{flagOf(c.iso)}</span>
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="shrink-0 font-mono text-[11.5px] tabular text-fg-3">+{c.dial}</span>
                    <span className="grid size-4 shrink-0 place-items-center">
                      <Combobox.ItemIndicator>
                        <Check size={14} className="text-fg" />
                      </Combobox.ItemIndicator>
                    </span>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>

      <input
        ref={inputRef}
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={shown}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={formatPhone(country.example, country.pattern)}
        aria-invalid={invalid || undefined}
        onChange={(e) => handleText(e.target.value, e.target.selectionStart)}
        onPaste={(e) => {
          onPaste?.(e);
          const text = e.clipboardData.getData("text");
          // A pasted number replaces the field outright, so its country can be read from it.
          if (/^\s*(\+|00)/.test(text) && !e.defaultPrevented) {
            e.preventDefault();
            handleText(text, null);
          }
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          const el = e.currentTarget;
          const at = el.selectionStart ?? 0;
          // Backspace just after a separator deletes the digit before it, instead of doing nothing.
          if (e.key === "Backspace" && at === el.selectionEnd && at > 0 && !pendingIntl && /\D/.test(shown[at - 1] ?? "")) {
            e.preventDefault();
            const digitsBefore = shown.slice(0, at).replace(/\D/g, "").length;
            if (digitsBefore === 0) return;
            commit(country, national.slice(0, digitsBefore - 1) + national.slice(digitsBefore), digitsBefore - 1, "type");
          }
        }}
        onBlur={(e) => {
          onBlur?.(e);
          setPendingIntl(null);
        }}
        className={cn(
          "min-w-0 flex-1 bg-transparent px-2.5 font-normal tabular text-fg outline-none placeholder:text-fg-4",
          size === "sm" ? "text-base sm:text-[12.5px]" : "text-base sm:text-[13px]",
        )}
        {...rest}
      />
      {name && <input type="hidden" name={name} value={e164} />}
      <span className="sr-only" role="status" aria-live="polite">
        {pulse ? `Country set to ${country.name}` : ""}
      </span>
    </div>
  );
}

function caretIndex(formatted: string, digits: number) {
  if (digits <= 0) return formatted.search(/\d/) === -1 ? formatted.length : 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]) && ++seen === digits) return i + 1;
  }
  return formatted.length;
}
