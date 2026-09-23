"use client";
import { Combobox } from "@base-ui/react/combobox";
import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Check, ChevronsUpDown, Globe, Search } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

/* ------------------------------------------------------------------ */
/* Zones, from Intl alone.                                             */
/* ------------------------------------------------------------------ */

export type TimeZoneInfo = {
  /** The IANA id, exactly as the engine reports it. */
  id: string;
  /** "Kolkata", "New York", "UTC". */
  city: string;
  /** "Argentina" for America/Argentina/Salta; empty when there's no middle part. */
  area: string;
  /** "India Standard Time", "Pacific Time". */
  name: string;
  region: string;
  /** Minutes ahead of UTC right now. */
  offset: number;
  /** Everything a search can match, folded to lowercase ASCII. */
  haystack: string;
};

const REGIONS: [string, string][] = [
  ["America", "Americas"],
  ["Europe", "Europe"],
  ["Africa", "Africa"],
  ["Asia", "Asia"],
  ["Australia", "Australia"],
  ["Pacific", "Pacific"],
  ["Atlantic", "Atlantic"],
  ["Indian", "Indian Ocean"],
  ["Antarctica", "Antarctica"],
  ["Arctic", "Arctic"],
  ["Other", "Other"],
];
// Old spellings some engines still hand back, shown by their current names and found by both.
const RENAMED: Record<string, string> = { Calcutta: "Kolkata", Saigon: "Ho Chi Minh City", Katmandu: "Kathmandu", Kiev: "Kyiv", Rangoon: "Yangon", Godthab: "Nuuk", Ashkhabad: "Ashgabat", Chongqing: "Chongqing", Faeroe: "Faroe" };
// What people type that no zone is called.
const ALIASES: Record<string, string> = {
  "America/Los_Angeles": "pst pdt pt pacific san francisco seattle california",
  "America/New_York": "est edt et eastern boston washington miami toronto",
  "America/Chicago": "cst cdt ct central dallas houston",
  "America/Denver": "mst mdt mt mountain",
  "America/Phoenix": "arizona",
  "Europe/London": "gmt bst uk britain england",
  "Europe/Paris": "cet cest france",
  "Europe/Berlin": "cet cest germany",
  "Asia/Kolkata": "ist india mumbai delhi bangalore bengaluru",
  "Asia/Calcutta": "ist india mumbai delhi bangalore bengaluru",
  "Asia/Tokyo": "jst japan",
  "Asia/Shanghai": "china beijing",
  "Asia/Singapore": "sgt",
  "Asia/Hong_Kong": "hkt",
  "Australia/Sydney": "aest aedt melbourne canberra",
  "Asia/Dubai": "gst uae",
  "America/Sao_Paulo": "brt brazil",
  UTC: "utc gmt zulu coordinated universal",
};
const FALLBACK = "America/Los_Angeles America/Denver America/Chicago America/New_York America/Sao_Paulo Europe/London Europe/Paris Europe/Berlin Europe/Kyiv Africa/Lagos Africa/Johannesburg Asia/Dubai Asia/Kolkata Asia/Singapore Asia/Shanghai Asia/Tokyo Australia/Sydney Pacific/Auckland".split(" ");

export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

const nameFmt = new Map<string, Intl.DateTimeFormat>();
function zonePart(at: Date, timeZone: string, style: "longGeneric" | "shortOffset", locale = "en-US") {
  const key = `${locale}|${timeZone}|${style}`;
  let f = nameFmt.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: style });
    nameFmt.set(key, f);
  }
  return f.formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "";
}

/** Minutes the zone is ahead of UTC at that instant. */
export function zoneOffset(timeZone: string, at = new Date()) {
  const label = zonePart(at, timeZone, "shortOffset");
  const m = /GMT([+-−])(\d{1,2})(?::(\d{2}))?/.exec(label);
  if (!m) return 0;
  return (m[1] === "+" ? 1 : -1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** "GMT+5:30", "GMT−3", "GMT". A real minus sign, so columns of offsets read cleanly. */
export function formatOffset(minutes: number) {
  if (minutes === 0) return "GMT";
  const a = Math.abs(minutes);
  return `GMT${minutes > 0 ? "+" : "−"}${Math.floor(a / 60)}${a % 60 ? `:${String(a % 60).padStart(2, "0")}` : ""}`;
}

export function zoneCity(id: string) {
  if (id === "UTC" || id === "Etc/UTC") return "UTC";
  const last = (id.split("/").pop() ?? id).replace(/_/g, " ");
  return RENAMED[last.replace(/ /g, "")] ?? last;
}

let cache: { at: number; zones: TimeZoneInfo[] } | null = null;

/** Every zone the engine knows, with its current offset and generic name. Rebuilt at most once a minute. */
export function getTimeZones(now = new Date()): TimeZoneInfo[] {
  const minute = Math.floor(now.getTime() / 60000);
  if (cache && cache.at === minute) return cache.zones;
  let ids: string[];
  try {
    ids = (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
  } catch {
    ids = FALLBACK;
  }
  if (!ids.includes("UTC")) ids = [...ids, "UTC"];
  const zones = ids.map((id) => {
    const parts = id.split("/");
    const region = parts.length > 1 && REGIONS.some(([k]) => k === parts[0]) ? parts[0] : "Other";
    const city = zoneCity(id);
    const area = parts.length > 2 ? parts.slice(1, -1).join(" / ").replace(/_/g, " ") : "";
    const name = id === "UTC" ? "Coordinated Universal Time" : zonePart(now, id, "longGeneric");
    const offset = zoneOffset(id, now);
    const raw = (parts.pop() ?? "").replace(/_/g, " ");
    return { id, city, area, name, region, offset, haystack: fold([city, raw, area, name, id, ALIASES[id] ?? ""].join(" ")) };
  });
  cache = { at: minute, zones };
  return zones;
}

/** Reads "+5:30", "gmt-3", "UTC+9", "−4" as an offset in minutes. */
function parseOffset(q: string): number | null {
  const m = /^(?:utc|gmt)?\s*([+\-−])\s*(\d{1,2})(?::?(\d{2}))?$/.exec(q.trim());
  if (!m) return null;
  return (m[1] === "+" ? 1 : -1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

function rank(zone: TimeZoneInfo, q: string) {
  const city = fold(zone.city);
  if (city === q) return 0;
  if (city.startsWith(q)) return 1;
  if (zone.haystack.split(/[\s/]+/).some((w) => w.startsWith(q))) return 2;
  return 3;
}

export function filterTimeZones(zones: TimeZoneInfo[], query: string) {
  const q = fold(query.trim());
  if (!q) return zones;
  const offset = parseOffset(q);
  if (offset !== null) return zones.filter((z) => z.offset === offset);
  const terms = q.split(/\s+/);
  // Every term has to start a word, so "new y" finds New York and not Papua New Guinea.
  return zones
    .filter((z) => {
      const words = z.haystack.split(/[\s/()-]+/);
      return terms.every((t) => words.some((w) => w.startsWith(t)));
    })
    .map((z) => ({ z, r: rank(z, terms[0]) }))
    .sort((a, b) => a.r - b.r)
    .map(({ z }) => z);
}

/* ------------------------------------------------------------------ */
/* Browser-only clocks.                                                */
/* ------------------------------------------------------------------ */

// Ticks on the minute boundary; stops while the tab is hidden and catches up when it returns.
function subscribeMinute(notify: () => void) {
  let timer = 0;
  const arm = () => {
    window.clearTimeout(timer);
    if (document.visibilityState === "hidden") return;
    timer = window.setTimeout(() => (notify(), arm()), 60000 - (Date.now() % 60000) + 20);
  };
  const onVisible = () => (notify(), arm());
  arm();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
/** The current minute, live. Null during server render. */
export function useMinute() {
  return useSyncExternalStore(subscribeMinute, () => Math.floor(Date.now() / 60000), () => null);
}
const noop = () => () => {};
/** The viewer's zone. Null during server render. */
export function useDetectedTimeZone() {
  return useSyncExternalStore(noop, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => null);
}
function useLocale(locale?: string) {
  const browser = useSyncExternalStore(noop, () => navigator.language, () => "en-US");
  return locale ?? browser;
}
function prefers12h(locale: string) {
  try {
    const cycle = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hourCycle;
    return cycle === "h11" || cycle === "h12";
  } catch {
    return false;
  }
}

const timeCache = new Map<string, Intl.DateTimeFormat>();
function timeFormat(locale: string, hour12: boolean, timeZone: string) {
  const key = `${locale}|${hour12}|${timeZone}`;
  let f = timeCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", hour12, timeZone });
    timeCache.set(key, f);
  }
  return f;
}

/** Wall-clock hour, minute and day in a zone. */
function clockIn(timeZone: string, at: Date) {
  const shifted = new Date(at.getTime() + zoneOffset(timeZone, at) * 60000);
  return { h: shifted.getUTCHours(), m: shifted.getUTCMinutes(), day: Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) / 864e5 };
}

/* ------------------------------------------------------------------ */

type Group = { value: string; label: string; items: TimeZoneInfo[] };

export type TimezoneSelectProps = {
  /** The IANA id, when controlled. */
  value?: string | null;
  /** Defaults to the viewer's zone, once it's known. */
  defaultValue?: string | null;
  onValueChange?: (timeZone: string) => void;
  /** Restrict the list, e.g. to the zones your product supports. */
  timeZones?: string[];
  locale?: string;
  hour12?: boolean;
  /** Pin the viewer's zone at the top of the list. */
  showDetected?: boolean;
  label?: React.ReactNode;
  "aria-label"?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  name?: string;
  container?: Combobox.Portal.Props["container"];
  className?: string;
};

export function TimezoneSelect({
  value: valueProp,
  defaultValue,
  onValueChange,
  timeZones,
  locale: localeProp,
  hour12: hour12Prop,
  showDetected = true,
  label,
  "aria-label": ariaLabel = "Time zone",
  size = "md",
  disabled,
  name,
  container,
  className,
}: TimezoneSelectProps) {
  const reduce = !!useReducedMotion();
  const minute = useMinute();
  const detected = useDetectedTimeZone();
  const locale = useLocale(localeProp);
  const hour12 = hour12Prop ?? prefers12h(locale);
  const [inner, setInner] = useState<string | null | undefined>(defaultValue);
  const current = valueProp !== undefined ? valueProp : (inner ?? detected);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const now = useMemo(() => (minute === null ? null : new Date(minute * 60000)), [minute]);
  // The full list is only built on the client, and only rebuilt when the minute (and so maybe an offset) changes.
  const zones = useMemo(() => {
    if (!now) return [];
    const all = getTimeZones(now);
    const allowed = timeZones ? new Set(timeZones) : null;
    return all.filter((z) => !allowed || allowed.has(z.id));
  }, [now, timeZones]);

  const selected = useMemo(() => zones.find((z) => z.id === current) ?? (current && now ? makeInfo(current, now) : null), [zones, current, now]);
  const home = useMemo(() => (detected && now ? (zones.find((z) => z.id === detected) ?? makeInfo(detected, now)) : null), [zones, detected, now]);

  const groups = useMemo<Group[]>(() => {
    const matched = filterTimeZones(zones, query);
    const searching = !!query.trim();
    const out: Group[] = [];
    if (showDetected && home && !searching) out.push({ value: "detected", label: "Your time zone", items: [home] });
    for (const [key, title] of REGIONS) {
      const items = matched.filter((z) => z.region === key);
      // Browsing: west to east within a region. Searching: best match first.
      if (!searching) items.sort((a, b) => a.offset - b.offset || a.city.localeCompare(b.city));
      if (items.length) out.push({ value: key, label: title, items });
    }
    // One group of best matches reads better than scattered hits when searching.
    if (searching) return out.length ? [{ value: "results", label: `${matched.length} ${matched.length === 1 ? "match" : "matches"}`, items: matched }] : [];
    return out;
  }, [zones, query, showDetected, home]);

  const choose = (z: TimeZoneInfo | null) => {
    if (!z) return;
    if (valueProp === undefined) setInner(z.id);
    onValueChange?.(z.id);
  };

  const timeIn = (id: string) => (now ? timeFormat(locale, hour12, id).format(now) : "");
  const homeDay = detected && now ? clockIn(detected, now).day : null;
  const dayShift = (id: string) => (now && homeDay !== null ? clockIn(id, now).day - homeDay : 0);

  const { setList, y, height, opacity } = useGlide(reduce);
  const clock = selected && now ? clockIn(selected.id, now) : null;

  return (
    <Combobox.Root<TimeZoneInfo>
      items={groups}
      filteredItems={groups}
      value={selected}
      onValueChange={choose}
      inputValue={query}
      onInputValueChange={setQuery}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      autoHighlight
      isItemEqualToValue={(a, b) => a.id === b.id}
      itemToStringLabel={(z) => z.city}
      itemToStringValue={(z) => z.id}
      disabled={disabled}
      name={name}
    >
      <div className={cn("flex w-full min-w-0 max-w-[340px] flex-col gap-1.5", className)}>
        {label && <Combobox.Label className="w-fit cursor-default text-[12.5px] font-medium text-fg-2 select-none">{label}</Combobox.Label>}
        <Combobox.Trigger
          aria-label={label ? undefined : ariaLabel}
          data-size={size}
          className={cn(
            "group/trigger relative flex w-full min-w-0 items-center border border-line-2 bg-raised text-left text-fg shadow-[var(--shadow)] select-none",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "transition-[background-color,border-color,scale] duration-150 ease-out hover:border-fg-4 hover:bg-hover active:scale-[0.985] active:duration-75",
            "data-popup-open:border-fg-4 data-popup-open:bg-hover data-disabled:pointer-events-none data-disabled:opacity-50",
            size === "sm" ? "h-7 gap-1.5 rounded-md pr-1.5 pl-2 text-[12.5px]" : "h-8 gap-2 rounded-lg pr-2 pl-2.5 text-[13px]",
          )}
        >
          <Globe size={size === "sm" ? 14 : 16} className="shrink-0 text-fg-3" />
          <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden py-1">
            <AnimatePresence initial={false}>
              <motion.span
                key={selected?.id ?? "none"}
                className="col-start-1 row-start-1 flex min-w-0 items-baseline gap-1.5"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(2px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(2px)" }}
                transition={{ duration: reduce ? 0.12 : 0.22, ease: ease.out }}
              >
                {selected ? (
                  <>
                    <span className="truncate">{selected.city}</span>
                    <span className="shrink-0 font-mono text-2xs text-fg-4">{formatOffset(selected.offset)}</span>
                  </>
                ) : (
                  <span className="my-0.5 h-3 w-28 rounded bg-hover" />
                )}
              </motion.span>
            </AnimatePresence>
          </span>
          {/* The clock rolls rather than swaps: a new zone moves the hours, a new minute moves the minutes. */}
          <span className="shrink-0 text-[12.5px] text-fg-3 tabular" aria-hidden>
            {clock ? (
              <NumberFlowGroup>
                <span className="inline-flex items-baseline">
                  <NumberFlow value={hour12 ? clock.h % 12 || 12 : clock.h} format={{ minimumIntegerDigits: hour12 ? 1 : 2 }} />
                  <span>:</span>
                  <NumberFlow value={clock.m} format={{ minimumIntegerDigits: 2 }} />
                  {hour12 && <span className="ml-1">{clock.h < 12 ? "AM" : "PM"}</span>}
                </span>
              </NumberFlowGroup>
            ) : (
              <span className="inline-block h-3 w-10 rounded bg-hover align-middle" />
            )}
          </span>
          <ChevronsUpDown size={size === "sm" ? 14 : 16} className="shrink-0 text-fg-3 transition-colors duration-150 group-hover/trigger:text-fg-2" />
        </Combobox.Trigger>
      </div>

      <Combobox.Portal container={container}>
        <Combobox.Positioner align="start" sideOffset={6} collisionPadding={8} className="z-(--z-popover) outline-none">
          <Combobox.Popup
            aria-label="Choose a time zone"
            className={cn(
              "flex w-[max(var(--anchor-width),22rem)] max-w-(--available-width) origin-(--transform-origin) flex-col overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
              "transition-[opacity,scale] duration-160 ease-out-expo data-ending-style:duration-100 data-ending-style:ease-out",
              "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0",
              "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
            )}
          >
            <div className="relative flex items-center border-b border-line">
              <Search size={14} className="pointer-events-none absolute left-3 text-fg-3" />
              <Combobox.Input
                placeholder="City, zone or offset like +5:30"
                aria-label="Search time zones"
                className="h-10 w-full bg-transparent pr-3 pl-8 text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]"
              />
            </div>
            <Combobox.Empty className="empty:hidden">
              <div className="flex flex-col gap-0.5 px-3 py-6 text-center">
                <p className="truncate text-[13px] text-fg-2">No time zones match “{query.trim()}”</p>
                <p className="text-[12px] text-fg-3">Try a city, a country’s zone name or an offset.</p>
              </div>
            </Combobox.Empty>
            <Combobox.List
              ref={setList}
              className="relative max-h-[min(calc(var(--available-height)-2.5rem),20rem)] scroll-pt-8 scroll-pb-1 overflow-y-auto overscroll-contain px-1 pb-1 outline-none empty:hidden"
            >
              <motion.div aria-hidden style={{ y, height, opacity }} className="pointer-events-none absolute inset-x-1 top-0 rounded-lg bg-line" />
              {groups.map((group) => (
                <Combobox.Group key={group.value} items={group.items} className="block">
                  <Combobox.GroupLabel className="sticky top-0 z-[2] flex h-8 items-end bg-raised px-2 pb-1.5 font-mono text-2xs tracking-[0.08em] text-fg-3 uppercase select-none">
                    {group.label}
                  </Combobox.GroupLabel>
                  <Combobox.Collection>
                    {(z: TimeZoneInfo) => {
                      const shift = dayShift(z.id);
                      return (
                        <Combobox.Item
                          key={`${group.value}:${z.id}`}
                          value={z}
                          className="group/item relative z-[1] flex h-8 cursor-default scroll-my-1 items-center gap-2 rounded-lg pr-2 pl-2 text-[13px] outline-none select-none pointer-coarse:h-10"
                        >
                          <span className="grid size-4 shrink-0 place-items-center">
                            <Combobox.ItemIndicator>
                              <Check size={14} />
                            </Combobox.ItemIndicator>
                          </span>
                          <span className="flex min-w-0 flex-1 items-baseline gap-2">
                            <span className="shrink-0 truncate text-fg">
                              <Highlight text={z.city} query={query} />
                            </span>
                            <span className="min-w-0 truncate text-[12px] text-fg-3">{z.area ? `${z.area} · ${z.name}` : z.name}</span>
                          </span>
                          <span className="w-[4.25rem] shrink-0 text-right font-mono text-2xs text-fg-4">{formatOffset(z.offset)}</span>
                          <span className="flex w-[4.75rem] shrink-0 items-baseline justify-end gap-1 text-[12.5px] text-fg-2 tabular">
                            {timeIn(z.id)}
                            {shift !== 0 && (
                              <sup className="font-mono text-[9.5px] text-fg-3" aria-label={shift > 0 ? "next day" : "previous day"}>
                                {shift > 0 ? "+1" : "−1"}
                              </sup>
                            )}
                          </span>
                        </Combobox.Item>
                      );
                    }}
                  </Combobox.Collection>
                </Combobox.Group>
              ))}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

function makeInfo(id: string, now: Date): TimeZoneInfo {
  const parts = id.split("/");
  return { id, city: zoneCity(id), area: "", name: zonePart(now, id, "longGeneric"), region: parts.length > 1 ? parts[0] : "Other", offset: zoneOffset(id, now), haystack: fold(id) };
}

/** The matched run of a city in the primary color, the rest a step quieter. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = fold(query.trim());
  if (!q || parseOffset(q) !== null) return <>{text}</>;
  // The whole query when the city holds it ("new y" in New York), else its first word.
  const run = fold(text).includes(q) ? q : q.split(/\s+/)[0];
  const at = fold(text).indexOf(run);
  if (at < 0) return <>{text}</>;
  const end = at + run.length;
  return (
    <>
      <span className="text-fg-2">{text.slice(0, at)}</span>
      <mark className="bg-transparent font-medium text-fg">{text.slice(at, end)}</mark>
      <span className="text-fg-2">{text.slice(end)}</span>
    </>
  );
}

// One highlight for the list: glides after the pointer, jumps for arrow keys and typing.
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
      let top = 0;
      for (let n: HTMLElement | null = el; n && n !== list; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
      if (!shown || keyboard || reduce) {
        y.jump(top);
        height.jump(el.offsetHeight);
      } else {
        running.push(animate(y, top, spring.follow), animate(height, el.offsetHeight, spring.follow));
      }
      opacity.jump(1);
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
