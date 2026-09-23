"use client";
import { Combobox } from "@base-ui/react/combobox";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Check, ChevronsUpDown, Globe, Search } from "@/lib/icons";
import { ease, spring, stagger } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type LocaleOption = { code: string; currency: string };

/** The languages and regions most products ship, each with the currency its region uses. */
export const COMMON_LOCALES: LocaleOption[] = [
  { code: "en-US", currency: "USD" },
  { code: "en-GB", currency: "GBP" },
  { code: "en-IN", currency: "INR" },
  { code: "es-ES", currency: "EUR" },
  { code: "es-MX", currency: "MXN" },
  { code: "fr-FR", currency: "EUR" },
  { code: "fr-CA", currency: "CAD" },
  { code: "de-DE", currency: "EUR" },
  { code: "de-CH", currency: "CHF" },
  { code: "it-IT", currency: "EUR" },
  { code: "pt-BR", currency: "BRL" },
  { code: "pt-PT", currency: "EUR" },
  { code: "nl-NL", currency: "EUR" },
  { code: "sv-SE", currency: "SEK" },
  { code: "nb-NO", currency: "NOK" },
  { code: "da-DK", currency: "DKK" },
  { code: "fi-FI", currency: "EUR" },
  { code: "pl-PL", currency: "PLN" },
  { code: "cs-CZ", currency: "CZK" },
  { code: "tr-TR", currency: "TRY" },
  { code: "uk-UA", currency: "UAH" },
  { code: "el-GR", currency: "EUR" },
  { code: "he-IL", currency: "ILS" },
  { code: "ar-EG", currency: "EGP" },
  { code: "hi-IN", currency: "INR" },
  { code: "th-TH", currency: "THB" },
  { code: "id-ID", currency: "IDR" },
  { code: "vi-VN", currency: "VND" },
  { code: "ja-JP", currency: "JPY" },
  { code: "ko-KR", currency: "KRW" },
  { code: "zh-CN", currency: "CNY" },
  { code: "zh-TW", currency: "TWD" },
];

type Item = LocaleOption & { native: string; english: string; haystack: string };
type Group = { value: string; label: string; items: Item[] };

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function upperFirst(s: string, locale: string) {
  return s ? s.charAt(0).toLocaleUpperCase(locale) + s.slice(1) : s;
}

/** A locale's name in its own language and in the interface's, plus what search should match. */
export function describeLocale(option: LocaleOption, displayLocale = "en"): Item {
  let native = option.code;
  let english = option.code;
  try {
    native = upperFirst(new Intl.DisplayNames([option.code], { type: "language", languageDisplay: "standard" }).of(option.code) ?? option.code, option.code);
    english = new Intl.DisplayNames([displayLocale], { type: "language", languageDisplay: "standard" }).of(option.code) ?? option.code;
  } catch {}
  return { ...option, native, english, haystack: fold(`${native} ${english} ${option.code}`) };
}

// The browser's preferred languages, following changes. Null on the server.
const subscribeLanguages = (fn: () => void) => {
  window.addEventListener("languagechange", fn);
  return () => window.removeEventListener("languagechange", fn);
};
function useDeviceLanguages() {
  const joined = useSyncExternalStore(
    subscribeLanguages,
    () => (navigator.languages?.length ? navigator.languages : [navigator.language]).join(","),
    () => null,
  );
  return useMemo(() => (joined ? joined.split(",") : []), [joined]);
}

/** The best match in `options` for the device: an exact locale first, then the same language. */
function matchDevice(options: LocaleOption[], preferred: string[]) {
  for (const p of preferred) {
    const exact = options.find((o) => o.code.toLowerCase() === p.toLowerCase());
    if (exact) return exact.code;
  }
  for (const p of preferred) {
    const lang = p.split("-")[0].toLowerCase();
    const same = options.find((o) => o.code.split("-")[0].toLowerCase() === lang);
    if (same) return same.code;
  }
  return null;
}

// A fixed moment, formatted in UTC, so server and client agree on every sample.
const SAMPLE = new Date(Date.UTC(2026, 8, 22, 14, 30));

/** The four formats people actually notice when they change locale. */
export function formatSamples(option: LocaleOption, date: Date = SAMPLE) {
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(option.code, { timeZone: "UTC", ...o }).format(date);
  return {
    date: f({ dateStyle: "long" }),
    short: f({ dateStyle: "short" }),
    time: f({ timeStyle: "short" }),
    number: new Intl.NumberFormat(option.code).format(1234567.89),
    currency: new Intl.NumberFormat(option.code, { style: "currency", currency: option.currency }).format(1299.5),
  };
}

export type LocaleSelectProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (code: string) => void;
  /** Which locales to offer. Defaults to COMMON_LOCALES. */
  locales?: LocaleOption[];
  /** The language the English-side names are written in: your interface's language. */
  displayLocale?: string;
  /** Hides the live format preview at the bottom of the list. */
  hidePreview?: boolean;
  disabled?: boolean;
  name?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** Portal target for the list. */
  container?: Combobox.Portal.Props["container"];
};

/**
 * Language and region, searchable in any language it lists. Names appear in
 * their own language with yours beside them, the current and device locales
 * come first, and a footer previews dates and numbers for whichever row is
 * highlighted, before anything is committed.
 */
export function LocaleSelect({
  value,
  defaultValue,
  onValueChange,
  locales = COMMON_LOCALES,
  displayLocale = "en",
  hidePreview = false,
  disabled = false,
  name,
  className,
  "aria-label": ariaLabel = "Language and region",
  "aria-labelledby": labelledBy,
  container,
}: LocaleSelectProps) {
  const reduce = !!useReducedMotion();
  const device = useDeviceLanguages();
  const deviceCode = useMemo(() => matchDevice(locales, device), [locales, device]);
  const [code, setCode] = useControllableState<string | undefined>({ value, defaultValue, onChange: (c) => c && onValueChange?.(c) });
  const current = code ?? deviceCode ?? locales[0]?.code;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<Item | null>(null);

  const items = useMemo(() => locales.map((l) => describeLocale(l, displayLocale)), [locales, displayLocale]);
  const selected = items.find((i) => i.code === current) ?? null;

  const groups = useMemo<Group[]>(() => {
    const q = fold(query.trim());
    if (q) {
      // Prefix matches on a word beat matches in the middle.
      const starts = (i: Item) => (` ${i.haystack}`.includes(` ${q}`) ? 0 : 1);
      const hits = items.filter((i) => i.haystack.includes(q)).sort((a, b) => starts(a) - starts(b));
      return hits.length ? [{ value: "results", label: `${hits.length} ${hits.length === 1 ? "match" : "matches"}`, items: hits }] : [];
    }
    const top = [current, deviceCode].filter((c, i, a): c is string => !!c && a.indexOf(c) === i);
    const suggested = top.map((c) => items.find((i) => i.code === c)).filter((i): i is Item => !!i);
    const rest = items.filter((i) => !top.includes(i.code)).sort((a, b) => a.native.localeCompare(b.native, displayLocale));
    return [
      ...(suggested.length ? [{ value: "suggested", label: "Suggested", items: suggested }] : []),
      { value: "all", label: "All languages", items: rest },
    ];
  }, [items, query, current, deviceCode, displayLocale]);

  const preview = highlighted ?? selected;
  const samples = preview ? formatSamples(preview) : null;
  const { setList, y, height, opacity } = useGlide(reduce);

  return (
    <Combobox.Root<Item>
      items={groups}
      filteredItems={groups}
      filter={null}
      value={selected}
      onValueChange={(item) => item && setCode(item.code)}
      inputValue={query}
      onInputValueChange={setQuery}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
          setHighlighted(null);
        }
      }}
      onItemHighlighted={(item) => setHighlighted(item ?? null)}
      autoHighlight
      isItemEqualToValue={(a, b) => a.code === b.code}
      itemToStringLabel={(i) => i.native}
      itemToStringValue={(i) => i.code}
      disabled={disabled}
      name={name}
    >
      <Combobox.Trigger
        aria-label={labelledBy ? undefined : ariaLabel}
        aria-labelledby={labelledBy}
        className={cn(
          "group/trigger relative flex h-8 w-full min-w-0 max-w-[320px] items-center gap-2 rounded-lg border border-line-2 bg-raised pr-2 pl-2.5 text-left text-[13px] text-fg shadow-[var(--shadow)] select-none",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[background-color,border-color,scale] duration-150 ease-out hover:border-fg-4 hover:bg-hover active:scale-[0.985] active:duration-75",
          "data-popup-open:border-fg-4 data-popup-open:bg-hover data-disabled:pointer-events-none data-disabled:opacity-50",
          "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.5 pointer-coarse:after:content-['']",
          className,
        )}
      >
        <Globe size={16} className="shrink-0 text-fg-3" />
        <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden py-1">
          <AnimatePresence initial={false}>
            <motion.span
              key={selected?.code ?? "none"}
              className="col-start-1 row-start-1 flex min-w-0 items-baseline gap-2"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(2px)" }}
              transition={{ duration: reduce ? 0.12 : 0.22, ease: ease.out }}
            >
              {selected ? (
                <>
                  <span lang={selected.code} dir="auto" className="truncate" suppressHydrationWarning>
                    {selected.native}
                  </span>
                  <span className="shrink-0 font-mono text-2xs text-fg-4">{selected.code}</span>
                </>
              ) : (
                <span className="text-fg-4">Choose a language</span>
              )}
            </motion.span>
          </AnimatePresence>
        </span>
        <ChevronsUpDown size={16} className="shrink-0 text-fg-3 transition-colors duration-150 group-hover/trigger:text-fg-2" />
      </Combobox.Trigger>

      <Combobox.Portal container={container}>
        <Combobox.Positioner align="start" sideOffset={6} collisionPadding={8} className="z-(--z-popover) outline-none">
          <Combobox.Popup
            aria-label="Choose a language and region"
            className={cn(
              "flex w-(--anchor-width) max-w-(--available-width) sm:w-[max(var(--anchor-width),21rem)] origin-(--transform-origin) flex-col overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
              "transition-[opacity,scale] duration-150 ease-out-expo data-ending-style:duration-100",
              "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0",
              "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
            )}
          >
            <div className="relative flex items-center border-b border-line">
              <Search size={14} className="pointer-events-none absolute left-3 text-fg-3" />
              <Combobox.Input
                placeholder="Search in any language"
                aria-label="Search languages"
                className="h-10 w-full bg-transparent pr-3 pl-8 text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]"
              />
            </div>
            <Combobox.Empty className="empty:hidden">
              <div className="flex flex-col gap-0.5 px-3 py-6 text-center">
                <p className="truncate text-[13px] text-fg-2">No languages match “{query.trim()}”</p>
                <p className="text-[12px] text-fg-3">Try the name in English, in the language itself, or a code like pt-BR.</p>
              </div>
            </Combobox.Empty>
            <Combobox.List
              ref={setList}
              className="relative max-h-[min(calc(var(--available-height)-7rem),14rem)] scroll-pt-8 scroll-pb-1 overflow-y-auto overscroll-contain px-1 pb-1 outline-none empty:hidden"
            >
              <motion.div aria-hidden style={{ y, height, opacity }} className="pointer-events-none absolute inset-x-1 top-0 rounded-lg bg-line" />
              {groups.map((group) => (
                <Combobox.Group key={group.value} items={group.items} className="block">
                  <Combobox.GroupLabel className="sticky top-0 z-[2] flex h-8 items-end bg-raised px-2 pb-1.5 font-mono text-2xs tracking-[0.08em] text-fg-3 uppercase select-none">
                    {group.label}
                  </Combobox.GroupLabel>
                  <Combobox.Collection>
                    {(item: Item) => (
                      <Combobox.Item
                        key={`${group.value}:${item.code}`}
                        value={item}
                        className="group/item relative z-[1] flex h-8 cursor-default scroll-my-1 items-center gap-2 rounded-lg pr-2 pl-2 text-[13px] outline-none select-none pointer-coarse:h-10"
                      >
                        <span className="grid size-4 shrink-0 place-items-center">
                          <Combobox.ItemIndicator>
                            <Check size={14} />
                          </Combobox.ItemIndicator>
                        </span>
                        <span className="flex min-w-0 flex-1 items-baseline gap-2">
                          {/* Named in its own language, so the person who reads it can find it. */}
                          <span lang={item.code} dir="auto" className="shrink-0 truncate text-fg group-data-selected/item:font-medium">
                            {item.native}
                          </span>
                          {item.english !== item.native && <span className="min-w-0 truncate text-[12px] text-fg-3">{item.english}</span>}
                        </span>
                        {item.code === deviceCode && (
                          <span className="shrink-0 rounded-full border border-line-2 px-1.5 text-[10.5px] leading-4 text-fg-3">Device</span>
                        )}
                      </Combobox.Item>
                    )}
                  </Combobox.Collection>
                </Combobox.Group>
              ))}
            </Combobox.List>
            {!hidePreview && samples && preview && (
              // Follows the highlighted row, so formats can be compared before choosing. Instant: it moves with the arrow keys.
              <div aria-hidden className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 border-t border-line bg-frame px-3 py-2.5 text-[12px] leading-[18px]">
                <span className="text-fg-4">Date</span>
                <span lang={preview.code} dir="auto" className="truncate text-left text-fg-2 tabular">
                  {samples.date} · {samples.time}
                </span>
                <span className="text-fg-4">Number</span>
                <span lang={preview.code} dir="auto" className="truncate text-left text-fg-2 tabular">
                  {samples.number} · {samples.currency}
                </span>
              </div>
            )}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

export type LocalePreviewProps = Omit<React.ComponentProps<"dl">, "children"> & {
  /** A locale code from the list, or any BCP 47 tag with a currency. */
  locale: string | LocaleOption;
  locales?: LocaleOption[];
};

/** How dates, times and numbers will look in a locale. Values roll over when it changes. */
export function LocalePreview({ locale, locales = COMMON_LOCALES, className, ...rest }: LocalePreviewProps) {
  const reduce = !!useReducedMotion();
  const option = typeof locale === "string" ? (locales.find((l) => l.code === locale) ?? { code: locale, currency: "USD" }) : locale;
  const s = formatSamples(option);
  const rows: [string, string][] = [
    ["Date", s.date],
    ["Short date", s.short],
    ["Time", s.time],
    ["Number", s.number],
    ["Currency", s.currency],
  ];

  return (
    <dl className={cn("grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-[12.5px] leading-[18px]", className)} {...rest}>
      {rows.map(([label, text], i) => (
        <div key={label} className="contents">
          <dt className="text-fg-3">{label}</dt>
          <dd className="grid min-w-0 grid-cols-[minmax(0,1fr)] overflow-hidden text-fg tabular">
            <AnimatePresence initial={false}>
              <motion.span
                key={`${option.code}:${text}`}
                lang={option.code}
                dir="auto"
                suppressHydrationWarning
                className="col-start-1 row-start-1 truncate text-left"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.22, ease: ease.out, delay: reduce ? 0 : i * stagger.items } }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.out } }}
              >
                {text}
              </motion.span>
            </AnimatePresence>
          </dd>
        </div>
      ))}
    </dl>
  );
}

// One highlight for the whole list: it glides after the pointer on a spring and
// jumps for arrow keys, where motion would read as lag.
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
      // offsetTop ignores the popup's entrance scale, which would skew a measured rect.
      let top = 0;
      for (let n: HTMLElement | null = el; n && n !== list; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
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
    observer.observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-highlighted"] });
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

  return { setList, y, height, opacity };
}
