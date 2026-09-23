"use client";
import { animate, AnimatePresence, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease, spring, stagger } from "@/lib/motion";

const noop = () => () => {};
function useLocale(locale?: string) {
  const detected = useSyncExternalStore(noop, () => Intl.NumberFormat().resolvedOptions().locale, () => "en-US");
  return locale ?? detected;
}

/** Tracks an element's content width. 0 until the browser has measured it. */
function useWidth() {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!node) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);
  return [setNode, width] as const;
}

/** Round tick values (0, 2.5k, 5k…) that cover [min, max], always including zero. */
export function niceTicks(min: number, max: number, count = 4) {
  const lo0 = Math.min(0, min);
  let hi0 = Math.max(0, max);
  if (hi0 === lo0) hi0 = lo0 + 1;
  const raw = (hi0 - lo0) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(lo0 / step) * step;
  const hi = Math.ceil(hi0 / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

// A bar from its baseline edge to its data end, rounded only at the data end.
// The command structure never changes, so Motion can morph one bar into another.
function barPath(vertical: boolean, band0: number, band1: number, base: number, end: number, radius: number) {
  const size = Math.abs(end - base);
  const r = Math.max(0, Math.min(radius, size, (band1 - band0) / 2));
  const dir = end < base ? -1 : 1;
  const e = end;
  const er = end - dir * r;
  const f = (n: number) => n.toFixed(2);
  if (vertical)
    return `M${f(band0)} ${f(base)}L${f(band0)} ${f(er)}Q${f(band0)} ${f(e)} ${f(band0 + r)} ${f(e)}L${f(band1 - r)} ${f(e)}Q${f(band1)} ${f(e)} ${f(band1)} ${f(er)}L${f(band1)} ${f(base)}Z`;
  return `M${f(base)} ${f(band0)}L${f(er)} ${f(band0)}Q${f(e)} ${f(band0)} ${f(e)} ${f(band0 + r)}L${f(e)} ${f(band1 - r)}Q${f(e)} ${f(band1)} ${f(er)} ${f(band1)}L${f(base)} ${f(band1)}Z`;
}

// Series share one ink, stepped by opacity. Override per series with className (e.g. "text-info").
const inks = [0.9, 0.5, 0.28, 0.14];

export type BarSeries = {
  /** The field in each datum that holds this series' value. */
  key: string;
  label: string;
  /** Text-color class for this series' ink, e.g. "text-info". Defaults to the foreground at a stepped opacity. */
  className?: string;
};

export type BarChartProps<T extends Record<string, unknown>> = Omit<React.ComponentProps<"div">, "children" | "onSelect"> & {
  data: T[];
  /** The field that names each bar or group: a month, a referrer, a region. */
  categoryKey: keyof T & string;
  series: BarSeries[];
  /** vertical draws columns up from the x axis; horizontal draws ranked rows. */
  layout?: "vertical" | "horizontal";
  /** Stack series on top of each other instead of side by side. Positive values only. */
  stacked?: boolean;
  /** Names the chart for screen readers. */
  label: string;
  /** Plot height in pixels for vertical charts. Horizontal charts grow with their rows. */
  height?: number;
  /** Row height in pixels for horizontal charts. */
  rowHeight?: number;
  formatValue?: (value: number) => string;
  formatCategory?: (category: string) => string;
  locale?: string;
  /** Print each bar's value at its end. Defaults on for horizontal, off for vertical. */
  valueLabels?: boolean;
  /** A target or average line across the plot. */
  reference?: { value: number; label: string };
  /** Bars become buttons: Enter, Space or a click calls this with the datum. */
  onBarClick?: (datum: T, index: number) => void;
  /** Loading: a skeleton with no data, or the last data dimmed while it refreshes. */
  loading?: boolean;
  /** Shown in the plot when data is empty. */
  emptyLabel?: string;
  /** Grow the bars from the baseline the first time the chart scrolls into view. */
  animated?: boolean;
  /** A key above the plot. Defaults on when there is more than one series. */
  legend?: boolean;
};

export function BarChart<T extends Record<string, unknown>>({
  data,
  categoryKey,
  series,
  layout = "vertical",
  stacked = false,
  label,
  height = 220,
  rowHeight = 28,
  formatValue,
  formatCategory = (c) => c,
  locale: localeProp,
  valueLabels,
  reference,
  onBarClick,
  loading = false,
  emptyLabel = "No data for this period",
  animated = true,
  legend,
  className,
  ...rest
}: BarChartProps<T>) {
  const vertical = layout === "vertical";
  const locale = useLocale(localeProp);
  const reduce = useReducedMotion();
  const [measure, width] = useWidth();
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { once: true, amount: 0.35 });
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const tooltipId = useId();
  const showValues = valueLabels ?? !vertical;

  const fmt = useMemo(() => {
    const nf = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
    return formatValue ?? ((v: number) => nf.format(v));
  }, [formatValue, locale]);

  const num = (d: T, key: string) => {
    const v = Number(d[key]);
    return Number.isFinite(v) ? v : 0;
  };
  const totals = data.map((d) => series.reduce((s, x) => s + Math.max(0, num(d, x.key)), 0));
  const values = data.flatMap((d) => series.map((s) => num(d, s.key)));
  const lo = stacked ? 0 : Math.min(0, ...values);
  const hi = stacked ? Math.max(0, ...totals) : Math.max(0, ...values, reference?.value ?? 0);
  const ticks = niceTicks(lo, Math.max(hi, reference?.value ?? 0), vertical ? 4 : 3);
  // Rows that print their own values don't need an axis: direct labels beat gridlines.
  const axis = vertical || !showValues;
  const t0 = ticks[0];
  const t1 = ticks[ticks.length - 1];

  // Layout, in pixels. Gutters are estimated from the longest label rather than measured.
  const tickWidth = Math.max(...ticks.map((t) => fmt(t).length)) * 6.4 + 10;
  const catNeed = vertical ? 0 : Math.max(...data.map((d) => formatCategory(String(d[categoryKey])).length), 4) * 6.6 + 14;
  // On a narrow chart, row names move above their bars instead of truncating.
  const labelsAbove = !vertical && width > 0 && catNeed > width * 0.34;
  const catWidth = vertical || labelsAbove ? 0 : catNeed;
  const valueWidth = !vertical && showValues ? Math.max(...values.map((v) => fmt(v).length), stacked ? Math.max(...totals.map((v) => fmt(v).length)) : 0, 3) * 6.6 + 10 : 0;
  const m = vertical
    ? { top: showValues ? 20 : 10, right: reference ? Math.max(reference.label.length, fmt(reference.value).length) * 6.2 + 14 : 4, bottom: 26, left: tickWidth }
    : { top: reference ? 20 : 4, right: valueWidth + 4, bottom: axis ? 22 : 4, left: catWidth };
  const labelBand = labelsAbove ? 16 : 0;
  const plotH = vertical ? height : (data.length || 5) * (labelsAbove ? rowHeight - 6 + labelBand : rowHeight);
  const totalH = plotH + m.top + m.bottom;
  const plotW = Math.max(0, width - m.left - m.right);
  const extent = vertical ? plotH : plotW;
  const scale = (v: number) => {
    const p = (v - t0) / (t1 - t0 || 1);
    return vertical ? m.top + plotH - p * plotH : m.left + p * plotW;
  };
  const baseline = scale(0);
  const bandSize = (vertical ? plotW : plotH) / Math.max(1, data.length);
  const bandStart = (i: number) => (vertical ? m.left : m.top) + i * bandSize;
  const barCenter = (i: number) => bandStart(i) + labelBand + (bandSize - labelBand) / 2;
  // Bars never fill the band: at most 24px (per series when grouped), the rest is air.
  const groupSlots = stacked ? 1 : series.length;
  const barThick = Math.max(2, Math.min(vertical ? 24 : 16, ((bandSize - labelBand) * (vertical ? 0.62 : 0.6)) / groupSlots));
  const groupThick = barThick * groupSlots + (groupSlots - 1) * 2;
  const gap = 2;

  // d0 is the same bar collapsed onto the baseline: where the first grow starts.
  type Seg = { key: string; si: number; d: string; d0: string; value: number; end: number };
  const bars: Seg[][] = data.map((d, i) => {
    const c = barCenter(i);
    const g0 = c - groupThick / 2;
    if (stacked) {
      let acc = 0;
      const visible = series.map((s) => Math.max(0, num(d, s.key)));
      const topIndex = visible.reduce((top, v, si) => (v > 0 ? si : top), -1);
      return series.map((s, si) => {
        const v = visible[si];
        const from = scale(acc);
        acc += v;
        const to = scale(acc);
        // A 2px surface gap between segments, taken from the segment above.
        const start = si > 0 && v > 0 && acc - v > 0 ? from + (vertical ? -gap : gap) : from;
        const end = vertical ? Math.min(start, to) : Math.max(start, to);
        const r = si === topIndex ? 4 : 0;
        return { key: s.key, si, value: v, end, d: barPath(vertical, g0, g0 + barThick, start, end, r), d0: barPath(vertical, g0, g0 + barThick, baseline, baseline, r) };
      });
    }
    return series.map((s, si) => {
      const v = num(d, s.key);
      const b0 = g0 + si * (barThick + 2);
      const end = scale(v);
      return { key: s.key, si, value: v, end, d: barPath(vertical, b0, b0 + barThick, baseline, end, 4), d0: barPath(vertical, b0, b0 + barThick, baseline, baseline, 4) };
    });
  });

  const empty = !loading && data.length === 0;
  const skeleton = loading && data.length === 0;
  const grown = !animated || inView;
  // The first grow is staggered and slower; every later change morphs in place.
  const [settled, setSettled] = useState(!animated);
  useEffect(() => {
    if (!grown || settled) return;
    const t = window.setTimeout(() => setSettled(true), 1000);
    return () => window.clearTimeout(t);
  }, [grown, settled]);
  const active = hover ?? focus;
  const clickable = !!onBarClick;

  const indexAt = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const pos = vertical ? e.clientX - r.left - m.left : e.clientY - r.top - m.top;
    const i = Math.floor(pos / bandSize);
    return i >= 0 && i < data.length ? i : null;
  };

  // A tap pins the tooltip on touch; the next tap outside the chart lets it go.
  useEffect(() => {
    if (!pinned) return;
    const off = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setPinned(false);
        setHover(null);
      }
    };
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [pinned]);

  // Tooltip anchor. Columns: beside the bar, on the side with more room, so it never
  // covers the bar it describes. Rows: above the row, at the bar's end.
  const tx = useMotionValue(0);
  const ty = useMotionValue(0);
  const ts = useMotionValue(0);
  const tipLeft = useTransform(tx, (v) => `${v}px`);
  const tipTop = useTransform(ty, (v) => `${v}px`);
  const tipShift = useTransform(ts, (v) => `${-v * 100}%`);
  const anchor = (i: number) => {
    const c = barCenter(i);
    if (vertical) {
      const right = c < width / 2;
      return { x: right ? c + groupThick / 2 + 10 : c - groupThick / 2 - 10, y: m.top, s: right ? 0 : 1 };
    }
    const far = Math.max(...bars[i].map((b) => b.end), baseline);
    const x = Math.min(far, width);
    return { x, y: c - groupThick / 2 - 6, s: Math.min(1, Math.max(0, x / (width || 1))) };
  };
  // Rows that already print their value only need a tooltip when there's more than one series.
  const tipWanted = vertical || series.length > 1 || !showValues;
  const tipVisible = tipWanted && active != null && !skeleton && !empty && active < data.length;
  const target = tipVisible && active != null ? anchor(active) : null;
  const ax = target?.x ?? null;
  const ay = target?.y ?? null;
  const as = target?.s ?? null;
  const wasVisible = useRef(false);
  const keyboard = focus != null && hover == null;
  useEffect(() => {
    if (ax == null || ay == null || as == null) {
      wasVisible.current = false;
      return;
    }
    // The first appearance lands in place; after that it glides between bars. Keys jump.
    if (!wasVisible.current || reduce || keyboard) {
      tx.jump(ax);
      ty.jump(ay);
      ts.jump(as);
    } else {
      animate(tx, ax, spring.follow);
      animate(ty, ay, spring.follow);
      animate(ts, as, spring.follow);
    }
    wasVisible.current = true;
  }, [ax, ay, as, reduce, keyboard, tx, ty, ts]);

  const inkOf = (si: number) => (series[si]?.className ? 1 : inks[Math.min(si, inks.length - 1)]);
  const catLabel = (i: number) => formatCategory(String(data[i][categoryKey]));
  const describe = (i: number) => {
    const parts = series.map((s, si) => `${s.label} ${fmt(bars[i][si].value)}`);
    if (stacked && series.length > 1) parts.push(`total ${fmt(totals[i])}`);
    return `${catLabel(i)}: ${parts.join(", ")}`;
  };

  // Category labels thin out when they'd collide: every 2nd, 3rd… label, always keeping the last.
  const labelEvery = vertical ? Math.max(1, Math.ceil((Math.max(...data.map((_, i) => catLabel(i).length), 1) * 6.4 + 12) / Math.max(bandSize, 1))) : 1;

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const next = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let to: number | undefined;
    if (next) to = Math.min(data.length - 1, Math.max(0, i + next));
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = data.length - 1;
    else if ((e.key === "Enter" || e.key === " ") && onBarClick) {
      e.preventDefault();
      onBarClick(data[i], i);
      return;
    } else if (e.key === "Escape") {
      setFocus(null);
      return;
    }
    if (to == null) return;
    e.preventDefault();
    const target = e.currentTarget.parentElement?.querySelector<SVGElement>(`[data-index="${to}"]`);
    target?.focus();
  };

  // One tab stop for the whole chart: the focused bar, or the first.
  const [rover, setRover] = useState(0);
  const tabbable = Math.min(rover, Math.max(0, data.length - 1));

  return (
    <div
      ref={root}
      data-slot="bar-chart"
      data-layout={layout}
      data-state={skeleton ? "loading" : empty ? "empty" : loading ? "refreshing" : "ready"}
      aria-busy={loading || undefined}
      className={cn("flex w-full min-w-0 select-none flex-col gap-3 text-fg", className)}
      {...rest}
    >
      {(legend ?? series.length > 1) && (
        <ul aria-label="Legend" className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11.5px] text-fg-2">
          {series.map((s, si) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-[2px] bg-current", s.className ?? "text-fg")} style={{ opacity: inkOf(si) }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div ref={measure} className="relative w-full" style={{ height: totalH }}>
      {width > 0 && (
        <>
          <svg
            width={width}
            height={totalH}
            role="group"
            aria-label={label}
            aria-roledescription="bar chart"
            className={cn("block overflow-visible transition-opacity duration-200", loading && data.length > 0 && "opacity-50")}
            onPointerMove={(e) => {
              if (skeleton || empty) return;
              if (e.pointerType === "mouse" || !pinned) setHover(indexAt(e));
            }}
            onPointerDown={(e) => {
              if (e.pointerType === "mouse" || skeleton || empty) return;
              setHover(indexAt(e));
              setPinned(true);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") setHover(null);
            }}
            onClick={(e) => {
              if (!onBarClick) return;
              const r = e.currentTarget.getBoundingClientRect();
              const pos = vertical ? e.clientX - r.left - m.left : e.clientY - r.top - m.top;
              const i = Math.floor(pos / bandSize);
              if (i >= 0 && i < data.length) onBarClick(data[i], i);
            }}
          >
            {/* Grid: hairlines at each tick, the zero line one step stronger. */}
            {/* Ticks slide with the bars when the scale changes, so the grid never disagrees with the data mid-flight. */}
            <g aria-hidden>
              <AnimatePresence initial={false}>
                {ticks.filter((t) => axis || (t === 0 && !labelsAbove && data.length > 0)).map((t) => {
                  const p = Math.round(scale(t)) + 0.5;
                  const at = vertical ? { y1: p, y2: p } : { x1: p, x2: p };
                  return (
                    <motion.line
                      key={t}
                      {...(vertical ? { x1: m.left, x2: width - m.right } : { y1: m.top, y2: m.top + plotH })}
                      className={t === 0 ? "stroke-line-2" : "stroke-line"}
                      strokeWidth={1}
                      initial={{ opacity: 0, ...at }}
                      animate={{ opacity: 1, ...at }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={{ duration: reduce ? 0 : 0.45, ease: ease.inOut }}
                    />
                  );
                })}
              </AnimatePresence>
            </g>

            {skeleton && (
              <g aria-hidden className="motion-safe:animate-pulse-soft">
                {Array.from({ length: vertical ? 8 : 5 }, (_, i) => {
                  const n = vertical ? 8 : 5;
                  const size = (vertical ? plotW : plotH) / n;
                  const b0 = (vertical ? m.left : m.top) + i * size + size / 2 - Math.min(vertical ? 24 : 16, size * 0.6) / 2;
                  const b1 = b0 + Math.min(vertical ? 24 : 16, size * 0.6);
                  const frac = [0.45, 0.62, 0.38, 0.7, 0.55, 0.8, 0.5, 0.66][i];
                  const end = vertical ? baseline - frac * extent * 0.9 : m.left + frac * plotW * 0.9;
                  return <path key={i} d={barPath(vertical, b0, b1, baseline, end, 4)} className="fill-fg/[0.06]" />;
                })}
              </g>
            )}

            {bars.map((segs, i) => {
              const dim = active != null && active !== i;
              return (
                <g
                  key={String(data[i][categoryKey])}
                  data-index={i}
                  tabIndex={i === tabbable ? 0 : -1}
                  role={clickable ? "button" : "img"}
                  aria-label={describe(i)}
                  aria-describedby={active === i ? tooltipId : undefined}
                  className={cn("outline-none transition-opacity duration-150", clickable && "cursor-pointer")}
                  style={{ opacity: dim ? 0.35 : 1 }}
                  onFocus={(e) => {
                    setRover(i);
                    if ((e.currentTarget as Element).matches(":focus-visible")) setFocus(i);
                  }}
                  onBlur={() => setFocus(null)}
                  onKeyDown={(e) => onKey(e, i)}
                >
                  {/* The hit area is the whole band, not just the painted bar. */}
                  <rect
                    x={vertical ? bandStart(i) : m.left}
                    y={vertical ? m.top : bandStart(i)}
                    width={vertical ? bandSize : plotW}
                    height={vertical ? plotH : bandSize}
                    fill="transparent"
                  />
                  {focus === i && (
                    <rect
                      aria-hidden
                      x={vertical ? bandStart(i) + 2 : m.left - 4}
                      y={vertical ? m.top - 4 : bandStart(i) + 1}
                      width={vertical ? bandSize - 4 : plotW + 8}
                      height={vertical ? plotH + 8 : bandSize - 2}
                      rx={6}
                      fill="none"
                      className="stroke-fg-3"
                      strokeWidth={1}
                    />
                  )}
                  {segs.map((s) => (
                    <motion.path
                      key={s.key}
                      className={series[s.si].className}
                      fill="currentColor"
                      fillOpacity={inkOf(s.si)}
                      initial={false}
                      animate={{ d: grown ? s.d : s.d0 }}
                      transition={
                        reduce
                          ? { duration: 0 }
                          : !settled
                            ? { duration: 0.6, ease: ease.out, delay: Math.min(i, 8) * stagger.items * 2 }
                            : { duration: 0.45, ease: ease.inOut }
                      }
                    />
                  ))}
                </g>
              );
            })}

            {reference && data.length > 0 && (
              <g aria-hidden>
                <motion.line
                  {...(vertical ? { x1: m.left, x2: width - m.right } : { y1: m.top, y2: m.top + plotH })}
                  className="stroke-fg-3"
                  strokeWidth={1}
                  initial={false}
                  animate={vertical ? { y1: Math.round(scale(reference.value)) + 0.5, y2: Math.round(scale(reference.value)) + 0.5 } : { x1: Math.round(scale(reference.value)) + 0.5, x2: Math.round(scale(reference.value)) + 0.5 }}
                  transition={{ duration: reduce ? 0 : 0.45, ease: ease.inOut }}
                />
              </g>
            )}
          </svg>

          {/* Text is HTML so it inherits the type, truncates, and never scales with the SVG. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 text-2xs text-fg-3 tabular">
            <AnimatePresence initial={false}>
              {ticks.filter(() => axis && data.length > 0).map((t) => (
                <motion.span
                  key={t}
                  className={cn("absolute whitespace-nowrap", vertical ? "left-0 -translate-y-1/2 pr-2 text-right" : "-translate-x-1/2")}
                  style={vertical ? { width: m.left } : { top: m.top + plotH + 6 }}
                  initial={{ opacity: 0, ...(vertical ? { top: scale(t) } : { left: scale(t) }) }}
                  animate={{ opacity: 1, ...(vertical ? { top: scale(t) } : { left: scale(t) }) }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ duration: reduce ? 0 : 0.45, ease: ease.inOut }}
                >
                  {fmt(t)}
                </motion.span>
              ))}
            </AnimatePresence>
            {!skeleton &&
              data.map((_, i) => {
                const show = !vertical || i % labelEvery === 0 || (i === data.length - 1 && (data.length - 1) % labelEvery >= labelEvery / 2);
                if (!show) return null;
                const on = active === i;
                return vertical ? (
                  <span
                    key={i}
                    className={cn("absolute -translate-x-1/2 truncate text-center text-[11px] transition-colors duration-150", on ? "text-fg" : "text-fg-3")}
                    style={{ left: bandStart(i) + bandSize / 2, top: m.top + plotH + 8, maxWidth: bandSize * labelEvery }}
                  >
                    {catLabel(i)}
                  </span>
                ) : (
                  <span
                    key={i}
                    className={cn("absolute left-0 -translate-y-1/2 truncate pr-3 text-[12px] transition-colors duration-150", on ? "text-fg" : "text-fg-2")}
                    style={labelsAbove ? { top: bandStart(i) + labelBand / 2 + 2, width: "100%" } : { top: barCenter(i), width: m.left }}
                  >
                    {catLabel(i)}
                  </span>
                );
              })}
            {showValues &&
              !skeleton &&
              bars.map((segs, i) => {
                const v = stacked ? totals[i] : null;
                if (vertical) {
                  const top = Math.min(...segs.map((s) => s.end), baseline);
                  return (
                    <motion.span
                      key={i}
                      className="absolute -translate-x-1/2 -translate-y-full pb-1 text-[11px] text-fg-2"
                      style={{ left: bandStart(i) + bandSize / 2, top }}
                      initial={false}
                      animate={{ opacity: grown && (active == null || active === i) ? 1 : grown ? 0.35 : 0 }}
                      transition={{ duration: 0.2, delay: !settled && !reduce ? 0.5 : 0 }}
                    >
                      {fmt(v ?? segs[0].value)}
                    </motion.span>
                  );
                }
                return segs.map((s, si) =>
                  stacked && si > 0 ? null : (
                    <motion.span
                      key={`${i}-${s.key}`}
                      className="absolute -translate-y-1/2 whitespace-nowrap pl-2 text-[12px] text-fg-2"
                      style={{
                        top: stacked ? barCenter(i) : barCenter(i) - groupThick / 2 + si * (barThick + 2) + barThick / 2,
                        left: stacked ? Math.max(...segs.map((x) => x.end)) : s.end,
                      }}
                      initial={false}
                      animate={{ opacity: grown ? (active == null || active === i ? 1 : 0.35) : 0 }}
                      transition={{ duration: 0.2, delay: !settled && !reduce ? 0.45 : 0 }}
                    >
                      {fmt(v ?? s.value)}
                    </motion.span>
                  ),
                );
              })}
            {reference && data.length > 0 && (
              <motion.span
                className={cn("absolute flex whitespace-nowrap leading-[13px]", vertical ? "-translate-y-1/2 flex-col pl-2.5" : "-translate-x-1/2 gap-1")}
                style={vertical ? { left: width - m.right } : { top: 2 }}
                initial={false}
                animate={vertical ? { top: scale(reference.value) } : { left: scale(reference.value) }}
                transition={{ duration: reduce ? 0 : 0.45, ease: ease.inOut }}
              >
                <span className="text-fg-2">{reference.label}</span>
                <span className="text-fg-3">{fmt(reference.value)}</span>
              </motion.span>
            )}
          </div>

          {(empty || skeleton) && (
            <div
              className="absolute grid place-items-center text-[12.5px] text-fg-3"
              style={{ left: m.left, top: m.top, width: plotW, height: plotH }}
              role={empty ? "status" : undefined}
            >
              {empty ? emptyLabel : <span className="sr-only">Loading chart</span>}
            </div>
          )}

          <AnimatePresence>
            {tipVisible && active != null && (
              <motion.div
                key="tip"
                id={tooltipId}
                role="tooltip"
                className="pointer-events-none absolute z-(--z-tooltip)"
                style={{ left: tipLeft, top: tipTop, x: tipShift, y: vertical ? 0 : "-100%", transformOrigin: vertical ? undefined : "bottom center" }}
                initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.14, ease: ease.out }}
              >
                <div className="min-w-[132px] rounded-lg border border-line-2 bg-raised px-2.5 py-2 shadow-pop">
                  <div className="mb-1.5 text-[11.5px] text-fg-2">{catLabel(active)}</div>
                  <div className="flex flex-col gap-1">
                    {series.map((s, si) => (
                      <div key={s.key} className="flex items-center gap-2 text-[12px]">
                        <span className={cn("size-2 shrink-0 rounded-[2px] bg-current", s.className ?? "text-fg")} style={{ opacity: inkOf(si) }} />
                        <span className="min-w-0 flex-1 truncate text-fg-2">{s.label}</span>
                        <span className="pl-3 font-medium text-fg tabular">{fmt(bars[active][si].value)}</span>
                      </div>
                    ))}
                    {stacked && series.length > 1 && (
                      <div className="mt-0.5 flex items-center gap-2 border-t border-line pt-1.5 text-[12px]">
                        <span className="flex-1 text-fg-3">Total</span>
                        <span className="pl-3 font-medium text-fg tabular">{fmt(totals[active])}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
      </div>
    </div>
  );
}
