"use client";
import { animate, AnimatePresence, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { useControllableState } from "@/lib/use-controllable-state";
import { ease, spring } from "@/lib/motion";

const noop = () => () => {};
function useLocale(locale?: string) {
  const detected = useSyncExternalStore(noop, () => Intl.DateTimeFormat().resolvedOptions().locale, () => "en-US");
  return locale ?? detected;
}

const DAY = 86_400_000;
/** "2026-03-04" to a UTC timestamp, so a day never shifts with the reader's time zone. */
const parse = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export type ContributionDay = { date: string; count: number };

export type ContributionGraphProps = Omit<React.ComponentProps<"div">, "children" | "onSelect"> & {
  /** One entry per day with activity, as ISO dates. Missing days count as zero. */
  data: ContributionDay[];
  /** The last day shown, as an ISO date. Defaults to the latest date in data. */
  endDate?: string;
  /** How many weeks to show, ending with endDate's week. */
  weeks?: number;
  /** 0 for Sunday, 1 for Monday. */
  weekStartsOn?: 0 | 1;
  /** Lower bounds for levels 1–4. Defaults to quarters of the busiest day. */
  thresholds?: [number, number, number, number];
  /** Singular and plural nouns for the tooltip and labels. */
  unit?: [string, string];
  /** Names the graph for screen readers. */
  label?: string;
  locale?: string;
  /** The selected day (controlled), as an ISO date. */
  selected?: string | null;
  defaultSelected?: string | null;
  onSelectedChange?: (date: string | null) => void;
  /** Largest cell size in pixels. Cells shrink to fit the width down to 9px; below that the graph scrolls sideways, pinned to the latest week. */
  cellSize?: number;
  legend?: boolean;
  loading?: boolean;
  /** Fade the weeks in, oldest first, the first time it scrolls into view. */
  animated?: boolean;
};

// Level 0 is a visible empty cell; 1–4 step the foreground up.
const levelClass = ["bg-fg/[0.06]", "bg-fg/25", "bg-fg/45", "bg-fg/70", "bg-fg/95"];

export function ContributionGraph({
  data,
  endDate,
  weeks = 53,
  weekStartsOn = 0,
  thresholds,
  unit = ["contribution", "contributions"],
  label = "Activity",
  locale: localeProp,
  selected: selectedProp,
  defaultSelected = null,
  onSelectedChange,
  cellSize: maxCell = 12,
  legend = true,
  loading = false,
  animated = true,
  className,
  ...rest
}: ContributionGraphProps) {
  const locale = useLocale(localeProp);
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { once: true, amount: 0.3 });
  const [selected, setSelected] = useControllableState({ value: selectedProp, defaultValue: defaultSelected, onChange: onSelectedChange });
  const [active, setActive] = useState<string | null>(null);
  const [rover, setRover] = useState<string | null>(null);
  const [tip, setTip] = useState<{ date: string; keyboard: boolean } | null>(null);
  const tipId = useId();
  // Fit the year to the width: cells shrink to the space available, never below 9px.
  const [avail, setAvail] = useState(0);
  const [clipped, setClipped] = useState(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAvail(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const gap = 3;
  const cellSize = avail ? Math.max(9, Math.min(maxCell, Math.floor((avail + gap) / weeks) - gap)) : maxCell;
  const step = cellSize + gap;

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of data) m.set(d.date, (m.get(d.date) ?? 0) + d.count);
    return m;
  }, [data]);

  const end = useMemo(() => parse(endDate ?? data.reduce((max, d) => (d.date > max ? d.date : max), "1970-01-01")), [endDate, data]);
  // The grid starts on the first day of the week, `weeks - 1` weeks before endDate's week.
  const endDow = (new Date(end).getUTCDay() - weekStartsOn + 7) % 7;
  const start = end - endDow * DAY - (weeks - 1) * 7 * DAY;

  const max = Math.max(0, ...Array.from(counts.values()));
  const bounds = thresholds ?? [1, Math.max(2, Math.ceil(max * 0.25)), Math.max(3, Math.ceil(max * 0.5)), Math.max(4, Math.ceil(max * 0.75))];
  const levelOf = (c: number) => (c <= 0 ? 0 : c >= bounds[3] ? 4 : c >= bounds[2] ? 3 : c >= bounds[1] ? 2 : 1);

  const long = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }), [locale]);
  const short = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }), [locale]);
  const month = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }), [locale]);
  const weekday = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }), [locale]);
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const say = (c: number) => (c === 0 ? `No ${unit[1]}` : `${nf.format(c)} ${c === 1 ? unit[0] : unit[1]}`);

  // Month labels sit over the first week that contains the 1st, unless that would crowd the previous label.
  const months: { col: number; text: string }[] = [];
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const t = start + (w * 7 + d) * DAY;
      if (t > end) break;
      if (new Date(t).getUTCDate() === 1 || (w === 0 && d === 0)) {
        const last = months[months.length - 1];
        const text = month.format(t);
        if (!last || w - last.col >= 3) months.push({ col: w, text });
        else if (w === 0 || new Date(t).getUTCDate() === 1) months[months.length - 1] = { col: w, text };
        break;
      }
    }
  }
  // A first label for a partial month that gets crowded out is dropped instead.
  if (months.length > 1 && months[1].col - months[0].col < 3) months.shift();

  const total = Array.from(counts.entries()).reduce((s, [d, c]) => (parse(d) >= start && parse(d) <= end ? s + c : s), 0);
  const focusDate = rover && parse(rover) >= start && parse(rover) <= end ? rover : (selected ?? iso(end));

  // Land on the latest week: the right end of the graph is the part people read first.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks, cellSize, avail]);

  // One tooltip for the whole graph, glided between cells.
  const tx = useMotionValue(0);
  const ty = useMotionValue(0);
  // Shifting by the same share of its own width keeps the tooltip inside the graph at both ends.
  const shift = useTransform(tx, (x) => `${-Math.min(1, Math.max(0, x / (root.current?.clientWidth || 1))) * 100}%`);
  const shown = useRef(false);
  const place = (el: HTMLElement, instant: boolean) => {
    const box = root.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!box) return;
    const x = r.left - box.left + r.width / 2;
    const y = r.top - box.top;
    if (instant || !shown.current || reduce) {
      tx.jump(x);
      ty.jump(y);
    } else {
      animate(tx, x, spring.follow);
      animate(ty, y, spring.follow);
    }
    shown.current = true;
  };
  const hide = () => {
    shown.current = false;
    setTip(null);
    setActive(null);
  };

  const cellFrom = (e: React.SyntheticEvent) => (e.target as HTMLElement).closest<HTMLElement>("[data-date]");

  const move = (from: string, key: string) => {
    const byKey: Record<string, number> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1, PageUp: -28, PageDown: 28 };
    if (!(key in byKey)) return null;
    return iso(Math.min(end, Math.max(start, parse(from) + byKey[key] * DAY)));
  };

  const shownGrid = !animated || (inView && avail > 0);
  const rows = Array.from({ length: 7 }, (_, d) => d);
  const labelCol = 28;

  return (
    <div
      ref={root}
      data-slot="contribution-graph"
      data-state={loading ? "loading" : "ready"}
      aria-busy={loading || undefined}
      className={cn("relative flex w-full min-w-0 flex-col gap-2 text-fg", className)}
      {...rest}
    >
      <div className="flex">
        {/* Weekday labels sit outside the scroller, so they stay put while the weeks scroll. */}
        <div aria-hidden className="relative shrink-0" style={{ width: labelCol }}>
          {rows.map((d) =>
            d % 2 === 1 ? (
              <div key={d} className="absolute left-0 text-2xs leading-none text-fg-3" style={{ top: 18 + d * step + cellSize / 2 - 5 }}>
                {weekday.format(start + d * DAY)}
              </div>
            ) : null,
          )}
        </div>
      <div
        ref={scroller}
        onScroll={(e) => setClipped(e.currentTarget.scrollLeft > 1)}
        // When earlier weeks are scrolled out of view, the left edge fades so the cut reads as "more this way".
        className={cn(
          "min-w-0 flex-1 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin]",
          clipped && "[mask-image:linear-gradient(to_right,transparent,black_20px)]",
        )}
      >
        <div className="relative flex w-max">
          <div className="flex flex-col">
            <div aria-hidden className="relative h-[18px] text-2xs text-fg-3">
              {months.map((m) => (
                <span key={`${m.col}-${m.text}`} className="absolute top-0 whitespace-nowrap" style={{ left: m.col * step }}>
                  {m.text}
                </span>
              ))}
            </div>

            <div
              role="grid"
              aria-label={`${label}: ${say(total)} from ${short.format(start)} to ${short.format(end)}`}
              aria-describedby={tip ? tipId : undefined}
              aria-readonly
              className="flex flex-col outline-none"
              style={{ gap }}
              onPointerOver={(e) => {
                const cell = cellFrom(e);
                if (!cell || loading) return;
                const date = cell.dataset.date!;
                setActive(date);
                setTip({ date, keyboard: false });
                place(cell, e.pointerType !== "mouse");
              }}
              onPointerLeave={hide}
              onClick={(e) => {
                const cell = cellFrom(e);
                if (!cell || loading) return;
                const date = cell.dataset.date!;
                setRover(date);
                setSelected(selected === date ? null : date);
              }}
              onFocus={(e) => {
                const cell = cellFrom(e);
                if (!cell) return;
                const date = cell.dataset.date!;
                setRover(date);
                if (cell.matches(":focus-visible")) {
                  setActive(date);
                  setTip({ date, keyboard: true });
                  place(cell, true);
                }
              }}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) hide();
              }}
              onKeyDown={(e) => {
                const cell = cellFrom(e);
                if (!cell) return;
                const date = cell.dataset.date!;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(selected === date ? null : date);
                  return;
                }
                if (e.key === "Escape") {
                  if (tip) hide();
                  else if (selected) setSelected(null);
                  return;
                }
                let next: string | null = null;
                const dow = (new Date(parse(date)).getUTCDay() - weekStartsOn + 7) % 7;
                // Home and End run along the weekday's row; with Ctrl or Cmd, to the first and last day.
                if (e.key === "Home") next = iso(e.ctrlKey || e.metaKey ? start : Math.max(start, start + dow * DAY));
                else if (e.key === "End") next = iso(e.ctrlKey || e.metaKey ? end : Math.min(end, start + (weeks - 1) * 7 * DAY + dow * DAY));
                else next = move(date, e.key);
                if (!next || next === date) {
                  if (next === date) e.preventDefault();
                  return;
                }
                e.preventDefault();
                const target = e.currentTarget.querySelector<HTMLElement>(`[data-date="${next}"]`);
                if (!target) return;
                target.focus({ preventScroll: true });
                target.scrollIntoView({ block: "nearest", inline: "nearest" });
              }}
            >
              {rows.map((d) => (
                <div role="row" key={d} className="flex" style={{ gap }}>
                  {Array.from({ length: weeks }, (_, w) => {
                    const t = start + (w * 7 + d) * DAY;
                    if (t > end) return <span key={w} aria-hidden style={{ width: cellSize, height: cellSize }} className="shrink-0" />;
                    const date = iso(t);
                    const c = counts.get(date) ?? 0;
                    const level = levelOf(c);
                    const isSel = selected === date;
                    return (
                      <div
                        key={w}
                        role="gridcell"
                        data-date={date}
                        data-level={level}
                        data-state={isSel ? "selected" : undefined}
                        aria-selected={isSel}
                        aria-label={`${say(c)} on ${long.format(t)}`}
                        tabIndex={date === focusDate ? 0 : -1}
                        className={cn(
                          "relative shrink-0 rounded-[2px] outline-none",
                          "transition-[opacity,scale,background-color] duration-300 ease-out-expo",
                          "outline-1 outline-offset-1",
                          "before:absolute before:-inset-[2px] before:content-['']",
                          loading ? "bg-fg/[0.06] motion-safe:animate-pulse-soft" : levelClass[level],
                          active === date && "outline-solid outline-fg-3",
                          isSel && "outline-solid outline-fg",
                          "focus-visible:outline-solid focus-visible:outline-fg-2",
                          shownGrid ? "scale-100 opacity-100" : "scale-50 opacity-0",
                          "motion-reduce:scale-100",
                        )}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          // Weeks arrive oldest to newest in a quick wave, once.
                          transitionDelay: shownGrid && !reduce ? `${Math.min(w * 8 + d * 6, 520)}ms, ${Math.min(w * 8 + d * 6, 520)}ms, 0ms` : "0ms",
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      </div>

      {legend && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-2xs text-fg-3" style={{ paddingLeft: labelCol, maxWidth: labelCol + weeks * step - gap }}>
          <span className="whitespace-nowrap tabular">
            {loading ? "Loading activity…" : `${say(total)} in ${weeks >= 52 ? "the last year" : `the last ${weeks} weeks`}`}
          </span>
          <span aria-hidden className="flex items-center gap-1">
            Less
            {levelClass.map((c, i) => (
              <span key={i} className={cn("rounded-[2px]", c)} style={{ width: cellSize - 1, height: cellSize - 1 }} />
            ))}
            More
          </span>
        </div>
      )}

      <AnimatePresence>
        {tip && (
          <motion.div
            key="tip"
            id={tipId}
            role="tooltip"
            className="pointer-events-none absolute left-0 top-0 z-(--z-tooltip)"
            style={{ x: tx, y: ty }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ duration: 0.12, ease: ease.out }}
          >
            <motion.div className="-translate-y-full pb-2" style={{ x: shift }}>
              <div className="whitespace-nowrap rounded-md border border-line-2 bg-raised px-2 py-1 text-[11.5px] shadow-pop">
                <span className="font-medium text-fg tabular">{say(counts.get(tip.date) ?? 0)}</span>
                <span className="text-fg-3"> · {short.format(parse(tip.date))}</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
