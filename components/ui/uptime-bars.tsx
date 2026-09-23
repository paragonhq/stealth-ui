"use client";
import NumberFlow from "@number-flow/react";
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

export type UptimeStatus = "up" | "degraded" | "down" | "none";

export type UptimeIncident = { title: string; /** Minutes it lasted. */ minutes?: number; status?: "degraded" | "down" };

export type UptimeDay = {
  /** ISO date, "2026-09-21". */
  date: string;
  /** Overrides the status derived from the minutes below. "none" means no data for the day. */
  status?: UptimeStatus;
  /** Minutes of full outage. Counts against uptime. */
  downtime?: number;
  /** Minutes of degraded service. Shown, but doesn't count against uptime. */
  degraded?: number;
  /** Overrides the day's uptime percentage (0–100). */
  uptime?: number;
  incidents?: UptimeIncident[];
};

const noop = () => () => {};
function useLocale(locale?: string) {
  const detected = useSyncExternalStore(noop, () => Intl.DateTimeFormat().resolvedOptions().locale, () => "en-US");
  return locale ?? detected;
}

export function dayStatus(d: UptimeDay): UptimeStatus {
  if (d.status) return d.status;
  if ((d.downtime ?? 0) > 0) return "down";
  if ((d.degraded ?? 0) > 0) return "degraded";
  return "up";
}
export const dayUptime = (d: UptimeDay) => d.uptime ?? Math.max(0, 100 - ((d.downtime ?? 0) / 1440) * 100);

const BAR: Record<UptimeStatus, string> = {
  up: "bg-success/75",
  degraded: "bg-warning",
  down: "bg-danger",
  none: "bg-fg/[0.08]",
};
const DOT: Record<UptimeStatus, string> = { up: "bg-success", degraded: "bg-warning", down: "bg-danger", none: "bg-fg-4" };
const WORD: Record<UptimeStatus, string> = { up: "Operational", degraded: "Degraded", down: "Outage", none: "No data" };
const CURRENT: Record<UptimeStatus, string> = { up: "Operational", degraded: "Degraded performance", down: "Outage", none: "No data" };

const duration = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${Math.max(1, Math.round(m))}m`);

export type UptimeBarsProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** One entry per day, oldest first. The last entry is today. */
  days: UptimeDay[];
  /** The service or component being tracked. */
  label: string;
  /** Status shown in the header. Defaults to today's. */
  current?: UptimeStatus;
  /** Most days to show. Narrow containers step down to 60, then 30. */
  maxDays?: number;
  /** Narrowest a bar may draw, in pixels, before fewer days are shown. */
  minBarWidth?: number;
  /** Hides the name, status and axis, for a denser list. */
  compact?: boolean;
  loading?: boolean;
  locale?: string;
};

export function UptimeBars({
  days,
  label,
  current,
  maxDays = 90,
  minBarWidth = 3,
  compact = false,
  loading = false,
  locale: localeProp,
  className,
  ...rest
}: UptimeBarsProps) {
  const locale = useLocale(localeProp);
  const reduce = useReducedMotion();
  const uid = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const [kb, setKb] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit the range to the width: 90 days, else 60, else 30, never drawing a bar thinner than minBarWidth.
  const gap = 2;
  const fits = width ? Math.floor((width + gap) / (minBarWidth + gap)) : maxDays;
  const count = [maxDays, 60, 30].filter((n) => n <= maxDays).find((n) => n <= fits) ?? Math.max(1, fits);
  const shown = useMemo(() => {
    const tail = days.slice(-count);
    // Pad the front with empty days, so a new service still reads as a full range.
    const pad = Array.from({ length: Math.max(0, count - tail.length) }, (): UptimeDay => ({ date: "", status: "none" }));
    return [...pad, ...tail];
  }, [days, count]);

  const measured = shown.filter((d) => d.date && dayStatus(d) !== "none");
  const uptime = measured.length ? measured.reduce((s, d) => s + dayUptime(d), 0) / measured.length : null;
  const today = days.length ? dayStatus(days[days.length - 1]) : "none";
  const now = current ?? today;

  const dateFmt = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }), [locale]);
  const longFmt = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }), [locale]);
  const pctFmt = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 0 }), [locale]);
  const fmtDate = (iso: string, f: Intl.DateTimeFormat) => (iso ? f.format(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))) : "");
  const pct = (v: number) => `${pctFmt.format(Math.floor(v * 100) / 100)}%`;

  const describe = (d: UptimeDay) => {
    if (!d.date) return "No data";
    const s = dayStatus(d);
    const parts = [fmtDate(d.date, longFmt), WORD[s]];
    if (s !== "none") parts.push(`${pct(dayUptime(d))} uptime`);
    for (const inc of d.incidents ?? []) parts.push(inc.minutes ? `${inc.title} for ${duration(inc.minutes)}` : inc.title);
    return parts.join(", ");
  };

  // One tooltip for the strip, glided between bars and kept inside it at both ends.
  const tx = useMotionValue(0);
  const shift = useTransform(tx, (x) => `${-Math.min(1, Math.max(0, x / (width || 1))) * 100}%`);
  const visible = useRef(false);
  const point = (i: number, instant: boolean) => {
    const x = ((i + 0.5) * (width + gap)) / shown.length - gap / 2;
    if (instant || !visible.current || reduce) tx.jump(x);
    else animate(tx, x, spring.follow);
    visible.current = true;
    setActive(i);
  };
  const hide = () => {
    visible.current = false;
    setActive(null);
    setPinned(false);
    setKb(false);
  };
  const indexAt = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.min(shown.length - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * shown.length)));
  };

  // A tap pins the tooltip on touch screens; the next tap elsewhere lets it go.
  useEffect(() => {
    if (!pinned) return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) {
        visible.current = false;
        setActive(null);
        setPinned(false);
      }
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [pinned]);

  const tipDay = active !== null ? shown[active] : null;
  const tipStatus = tipDay ? (tipDay.date ? dayStatus(tipDay) : "none") : "none";
  const cellId = (i: number) => `${uid}-d${i}`;

  return (
    <div
      data-slot="uptime-bars"
      data-state={loading ? "loading" : now}
      aria-busy={loading || undefined}
      className={cn("flex w-full min-w-0 flex-col text-fg", className)}
      {...rest}
    >
      {!compact && (
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-[13px] font-medium tracking-[-0.01em]">{label}</span>
          <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-fg-2">
            <span aria-hidden className="relative grid size-2 place-items-center">
              {!loading && (now === "down" || now === "degraded") && (
                <span className={cn("absolute inset-0 animate-ping-soft rounded-full motion-reduce:hidden", DOT[now])} />
              )}
              <span className={cn("size-1.5 rounded-full", loading ? "bg-fg-4" : DOT[now])} />
            </span>
            {loading ? "Checking…" : CURRENT[now]}
          </span>
        </div>
      )}

      <div ref={wrap} className="relative">
        <div
          role="grid"
          aria-label={`${label}, last ${count} days${uptime !== null ? `, ${pct(uptime)} uptime` : ""}`}
          aria-readonly
          aria-activedescendant={kb && active !== null ? cellId(active) : undefined}
          tabIndex={loading ? -1 : 0}
          data-hovering={active !== null || undefined}
          onPointerMove={(e) => {
            if (loading || e.pointerType !== "mouse" || pinned) return;
            const i = indexAt(e);
            if (i !== active) point(i, false);
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse" && !pinned && !kb) hide();
          }}
          onPointerDown={(e) => {
            if (loading || e.pointerType === "mouse") return;
            const i = indexAt(e);
            if (pinned && i === active) return hide();
            point(i, true);
            setPinned(true);
          }}
          onFocus={(e) => {
            if (!e.currentTarget.matches(":focus-visible") || loading) return;
            setKb(true);
            point(active ?? shown.length - 1, true);
          }}
          onBlur={hide}
          onKeyDown={(e) => {
            if (loading) return;
            const last = shown.length - 1;
            const from = active ?? last;
            const to =
              e.key === "ArrowLeft" ? Math.max(0, from - 1)
              : e.key === "ArrowRight" ? Math.min(last, from + 1)
              : e.key === "Home" ? 0
              : e.key === "End" ? last
              : e.key === "PageUp" ? Math.max(0, from - 7)
              : e.key === "PageDown" ? Math.min(last, from + 7)
              : null;
            if (e.key === "Escape") return hide();
            if (to === null) return;
            e.preventDefault();
            setKb(true);
            // Arrowing is a keyboard move: the tooltip lands, it doesn't glide.
            point(to, true);
          }}
          className={cn(
            "group/strip flex h-8 rounded-[3px] outline-none",
            "focus-visible:outline-1 focus-visible:outline-offset-[3px] focus-visible:outline-fg-3 focus-visible:outline-solid",
          )}
          style={{ gap }}
        >
          <div role="row" className="contents">
            {shown.map((d, i) => {
              const s = d.date ? dayStatus(d) : "none";
              const on = active === i;
              return (
                <div
                  key={d.date || `pad-${i}`}
                  id={cellId(i)}
                  role="gridcell"
                  aria-label={describe(d)}
                  data-status={s}
                  data-active={on || undefined}
                  className={cn(
                    "min-w-0 flex-1 origin-bottom rounded-[2px] transition-[opacity,scale] duration-150 ease-out",
                    loading ? "animate-pulse-soft bg-fg/[0.07]" : BAR[s],
                    // Pointing at one day quiets the rest, so its colour reads against them.
                    "group-data-hovering/strip:opacity-35 data-active:opacity-100 data-active:scale-y-[1.08] motion-reduce:data-active:scale-y-100",
                  )}
                />
              );
            })}
          </div>
        </div>

        <AnimatePresence>
          {tipDay && !loading && (
            <motion.div
              key="tip"
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 z-(--z-tooltip)"
              style={{ x: tx }}
              initial={{ opacity: 0, y: reduce ? 0 : 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              transition={{ duration: 0.14, ease: ease.out }}
            >
              <motion.div className="-translate-y-full pb-2.5" style={{ x: shift }}>
                <div className="w-max max-w-64 rounded-lg border border-line-2 bg-raised px-2.5 py-2 text-[12px] leading-4 shadow-pop">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-medium text-fg">{tipDay.date ? fmtDate(tipDay.date, dateFmt) : "Before tracking"}</span>
                    {tipStatus !== "none" && <span className="tabular font-mono text-[11px] text-fg-3">{pct(dayUptime(tipDay))}</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-fg-2">
                    <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", DOT[tipStatus])} />
                    {WORD[tipStatus]}
                    {tipStatus === "down" && tipDay.downtime && !tipDay.incidents?.length ? <span className="text-fg-3">· {duration(tipDay.downtime)} down</span> : null}
                    {tipStatus === "degraded" && tipDay.degraded && !tipDay.incidents?.length ? <span className="text-fg-3">· {duration(tipDay.degraded)}</span> : null}
                  </div>
                  {tipStatus === "up" && !tipDay.incidents?.length && <div className="mt-1 text-fg-3">No incidents</div>}
                  {tipDay.incidents?.map((inc, k) => (
                    <div key={k} className="mt-1.5 border-t border-line pt-1.5 text-fg-2 first-of-type:mt-2">
                      {inc.title}
                      {inc.minutes ? <span className="tabular text-fg-3"> · {duration(inc.minutes)}</span> : null}
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!compact && (
        <div className="mt-2 flex items-center gap-3 text-2xs text-fg-4">
          <span className="tabular shrink-0">{count} days ago</span>
          <span aria-hidden className="h-px flex-1 bg-line" />
          <span className="tabular shrink-0 text-fg-3">
            {loading ? (
              "Loading…"
            ) : uptime === null ? (
              "No data yet"
            ) : (
              <>
                <NumberFlow value={Math.floor(uptime * 100) / 10000} locales={locale} format={{ style: "percent", maximumFractionDigits: 2 }} animated={!reduce} willChange />{" "}
                uptime
              </>
            )}
          </span>
          <span aria-hidden className="h-px flex-1 bg-line" />
          <span className="shrink-0">Today</span>
        </div>
      )}
    </div>
  );
}
