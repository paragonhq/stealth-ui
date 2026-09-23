"use client";
import { Tooltip } from "@base-ui/react/tooltip";
import NumberFlow from "@number-flow/react";
import { useReducedMotion } from "motion/react";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

type Unit = "second" | "minute" | "hour" | "day" | "week" | "month" | "year";
type DateInput = Date | string | number;

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30.4375 * DAY;
const YEAR = 365.25 * DAY;
/** Each band: below `until` of elapsed time, count in `unit`, changing every `every` ms. */
const BANDS: { until: number; unit: Unit; size: number; every: number }[] = [
  { until: MIN, unit: "second", size: SEC, every: 10 * SEC },
  { until: HOUR, unit: "minute", size: MIN, every: MIN },
  { until: DAY, unit: "hour", size: HOUR, every: HOUR },
  { until: WEEK, unit: "day", size: DAY, every: DAY },
  { until: 5 * WEEK, unit: "week", size: WEEK, every: WEEK },
  { until: YEAR, unit: "month", size: MONTH, every: MONTH },
  { until: Infinity, unit: "year", size: YEAR, every: YEAR },
];
// A timestamp a few seconds in the future is almost always clock skew, not a plan.
const SKEW = 30 * SEC;

const toTime = (d: DateInput) => (d instanceof Date ? d.getTime() : typeof d === "number" ? d : Date.parse(d));

export type RelativeTimeFormat = "long" | "short" | "narrow";

type Resolved =
  | {
      kind: "relative";
      unit: Unit;
      value: number;
      future: boolean;
      next: number | null;
    }
  | { kind: "absolute"; next: number | null };

/** Which words to show at `now`, and how many ms until they change. */
function resolve(at: number, now: number, absoluteAfter: number): Resolved {
  const diff = at - now;
  const future = diff > SKEW;
  const abs = future ? diff : Math.max(0, -diff);
  if (abs >= absoluteAfter) return { kind: "absolute", next: future ? abs - absoluteAfter + 1 : null };
  const band = BANDS.find((b) => abs < b.until)!;
  // Seconds count in tens: "now", "10 seconds ago", "20 seconds ago".
  const bucket = band.unit === "second" ? band.every : band.size;
  const value = band.unit === "second" ? Math.floor(abs / bucket) * 10 : Math.floor(abs / bucket);
  let next = future ? abs % bucket || bucket : bucket - (abs % bucket);
  if (!future) next = Math.min(next, absoluteAfter - abs);
  return {
    kind: "relative",
    unit: band.unit,
    value,
    future,
    next: Math.min(next + 5, HOUR),
  };
}

/* ------------------------------------------------------------------------ */
/* One clock per instance. It only wakes when the words would change, sleeps */
/* while the tab is hidden, and catches up the moment the tab comes back.    */

const noop = () => () => {};
const stamp = () => ({ now: Date.now() });

function useNow(at: number, live: boolean, absoluteAfter: number) {
  const [clock] = useState(stamp);
  const subscribe = useCallback(
    (notify: () => void) => {
      let timer = 0;
      const tick = () => {
        window.clearTimeout(timer);
        clock.now = Date.now();
        notify();
        if (!live || document.hidden || Number.isNaN(at)) return;
        const next = resolve(at, clock.now, absoluteAfter).next;
        if (next != null) timer = window.setTimeout(tick, next);
      };
      const onVisibility = () => (document.hidden ? window.clearTimeout(timer) : tick());
      tick();
      document.addEventListener("visibilitychange", onVisibility);
      return () => {
        window.clearTimeout(timer);
        document.removeEventListener("visibilitychange", onVisibility);
      };
    },
    [clock, at, live, absoluteAfter],
  );
  // The server can't know the reader's clock: it renders a fixed date, and the
  // client swaps in the relative words right after hydration without a mismatch.
  return useSyncExternalStore(
    subscribe,
    () => clock.now,
    () => null,
  );
}

function useLocale(locale?: string) {
  const detected = useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().locale,
    () => "en-US",
  );
  return locale ?? detected;
}

export type UseRelativeTimeOptions = {
  format?: RelativeTimeFormat;
  numeric?: "auto" | "always";
  absoluteAfter?: number;
  live?: boolean;
  locale?: string;
};

/** The words on their own: `{ text, parts, absolute, full, iso }`, updating on the same schedule. */
export function useRelativeTime(
  date: DateInput,
  { format = "long", numeric = "auto", absoluteAfter = WEEK, live = true, locale: localeProp }: UseRelativeTimeOptions = {},
) {
  const at = toTime(date);
  const locale = useLocale(localeProp);
  const now = useNow(at, live, absoluteAfter);

  return useMemo(() => {
    const valid = !Number.isNaN(at);
    const d = new Date(valid ? at : 0);
    const iso = valid ? d.toISOString() : undefined;
    if (!valid)
      return {
        text: "Unknown date",
        parts: null,
        absolute: "Unknown date",
        full: null,
        iso,
        unit: null,
      };
    if (now == null) {
      const text = new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(d);
      return { text, parts: null, absolute: text, full: null, iso, unit: null };
    }
    const sameYear = new Date(now).getFullYear() === d.getFullYear();
    const absolute = new Intl.DateTimeFormat(locale, sameYear ? { month: "short", day: "numeric" } : { dateStyle: "medium" }).format(d);
    const zone = new Intl.DateTimeFormat(locale, { timeZoneName: "long" }).formatToParts(d).find((p) => p.type === "timeZoneName")?.value;
    const offset = new Intl.DateTimeFormat(locale, {
      timeZoneName: "shortOffset",
    })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value;
    const full = {
      date: new Intl.DateTimeFormat(locale, {
        dateStyle: "full",
        timeStyle: "short",
      }).format(d),
      zone: [zone, offset].filter(Boolean).join(" · "),
    };
    const r = resolve(at, now, absoluteAfter);
    if (r.kind === "absolute") return { text: absolute, parts: null, absolute, full, iso, unit: null };

    const rtf = new Intl.RelativeTimeFormat(locale, { style: format, numeric });
    const signed = r.future ? r.value : -r.value;
    const raw = rtf.formatToParts(signed === 0 ? 0 : signed, r.unit);
    // Split around the number so it can roll while the words stay put: ["", 3, " minutes ago"].
    const first = raw.findIndex((p) => p.type !== "literal");
    let last = -1;
    raw.forEach((p, i) => {
      if (p.type !== "literal") last = i;
    });
    const parts =
      first < 0
        ? null
        : {
            before: raw
              .slice(0, first)
              .map((p) => p.value)
              .join(""),
            value: r.value,
            after: raw
              .slice(last + 1)
              .map((p) => p.value)
              .join(""),
          };
    return {
      text: raw.map((p) => p.value).join(""),
      parts,
      absolute,
      full,
      iso,
      unit: r.unit,
    };
  }, [at, now, locale, format, numeric, absoluteAfter]);
}

/* ------------------------------------------------------------------------ */

export type RelativeTimeProps = Omit<React.ComponentProps<"time">, "children" | "dateTime"> & {
  /** A Date, a timestamp in ms, or anything Date.parse reads (ISO strings). */
  date: DateInput;
  /** How much to spell out: "3 minutes ago", "3 min. ago", "3m ago". */
  format?: RelativeTimeFormat;
  /** "auto" says "yesterday" and "now"; "always" says "1 day ago" and "0 seconds ago". */
  numeric?: "auto" | "always";
  /** Milliseconds after which it shows the date instead ("12 Sep"). Pass Infinity to stay relative. */
  absoluteAfter?: number;
  /** Keep the words current. Off, it renders once. */
  live?: boolean;
  /** Show the full date, time and zone on hover and focus. */
  tooltip?: boolean;
  locale?: string;
};

export function RelativeTime({
  date,
  format = "long",
  numeric = "auto",
  absoluteAfter = WEEK,
  live = true,
  tooltip = true,
  locale,
  className,
  ...rest
}: RelativeTimeProps) {
  const reduce = useReducedMotion();
  const t = useRelativeTime(date, {
    format,
    numeric,
    absoluteAfter,
    live,
    locale,
  });

  const body = (
    <time
      dateTime={t.iso}
      data-state={t.unit ? "relative" : "absolute"}
      data-unit={t.unit ?? undefined}
      className={cn("tabular whitespace-nowrap", className)}
      {...rest}
    >
      {t.parts ? (
        <>
          {t.parts.before}
          {/* Keyed by unit: 50 seconds becoming 1 minute swaps, it doesn't roll backwards. */}
          {/* NumberFlow's mask makes it taller than the line; a line-high box keeps rows from growing. */}
          <span className="inline-flex h-[1lh] items-center align-top">
            <NumberFlow
              key={t.unit}
              aria-hidden
              value={t.parts.value}
              locales={locale}
              animated={!reduce}
              transformTiming={{
                duration: 420,
                easing: `cubic-bezier(${ease.out.join(",")})`,
              }}
              spinTiming={{
                duration: 420,
                easing: `cubic-bezier(${ease.out.join(",")})`,
              }}
              opacityTiming={{ duration: 180, easing: "ease-out" }}
            />
          </span>
          <span className="sr-only">{t.parts.value}</span>
          {t.parts.after}
        </>
      ) : (
        t.text
      )}
    </time>
  );

  if (!tooltip || !t.full) return body;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={500} render={body} />
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" sideOffset={6} className="z-(--z-tooltip)">
          <Tooltip.Popup
            className={cn(
              "origin-(--transform-origin) rounded-lg border border-line-2 bg-raised px-2.5 py-1.5 text-left shadow-pop",
              "transition-[opacity,scale,filter] duration-150 ease-out-expo",
              "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-starting-style:blur-[2px]",
              "data-ending-style:opacity-0 data-ending-style:duration-100 data-instant:transition-none",
              "motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:blur-none",
            )}
          >
            <p className="whitespace-nowrap text-[12px] leading-4 text-fg">{t.full.date}</p>
            {t.full.zone && <p className="mt-0.5 whitespace-nowrap text-[11px] leading-4 text-fg-3">{t.full.zone}</p>}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
