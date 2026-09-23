"use client";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Tooltip } from "@base-ui/react/tooltip";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { DeltaBadge, getDelta } from "@/components/ui/delta-badge";
import { NumberTicker, numberFormatOptions, useLocale, type NumberFormatShortcuts } from "@/components/ui/number-ticker";
import { cn } from "@/lib/cn";
import { Refresh } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type StatPoint = { label: string; value: number };
export type StatPeriod = { value: string; label: string };

// Every series is resampled to the same number of points, so switching periods
// morphs one line into the next instead of redrawing it.
const SAMPLES = 64;
const W = 320;
const H = 56;

function resample(values: number[], n = SAMPLES) {
  if (values.length === 0) return [];
  if (values.length === 1) return Array.from({ length: n }, () => values[0]);
  return Array.from({ length: n }, (_, i) => {
    const t = (i / (n - 1)) * (values.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(values.length - 1, lo + 1);
    return values[lo] + (values[hi] - values[lo]) * (t - lo);
  });
}

function geometry(values: number[]) {
  const pts = resample(values);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  // 6px of headroom above the peak, 4px above the floor, so the stroke never clips.
  const y = (v: number) => 6 + (1 - (v - min) / span) * (H - 10);
  const xs = pts.map((_, i) => (i / (pts.length - 1)) * W);
  const line = pts.map((v, i) => `${i ? "L" : "M"}${xs[i].toFixed(2)} ${y(v).toFixed(2)}`).join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  // Where the drawn line crosses a given 0–1 position, so the scrub dot sits on it exactly.
  const at = (p: number) => {
    const t = p * (pts.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(pts.length - 1, lo + 1);
    return y(pts[lo] + (pts[hi] - pts[lo]) * (t - lo));
  };
  return { line, area, at };
}

export type StatTileProps = Omit<React.ComponentProps<"div">, "children"> &
  NumberFormatShortcuts & {
    label: string;
    /** The headline value. null with loading shows the skeleton. */
    value: number | null;
    /** Change against the comparison period, in percentage points. */
    delta?: number | null;
    /** For metrics where down is good (churn, latency, cost). */
    inverse?: boolean;
    /** What the delta is measured against: "vs previous 30 days". */
    comparison?: string;
    /** The series behind the sparkline, oldest first. Labels are shown while scrubbing. */
    data?: StatPoint[];
    periods?: StatPeriod[];
    period?: string;
    defaultPeriod?: string;
    onPeriodChange?: (period: string) => void;
    /** Fetching. Skeleton when there's no value yet; otherwise the data stays and dims. */
    loading?: boolean;
    /** Couldn't load. Shown in place, with a retry when onRetry is given. */
    error?: string;
    onRetry?: () => void;
    locale?: string;
  };

export function StatTile({
  label,
  value,
  delta,
  inverse = false,
  comparison,
  data,
  periods,
  period: periodProp,
  defaultPeriod,
  onPeriodChange,
  loading = false,
  error,
  onRetry,
  currency,
  compact,
  decimals,
  format,
  locale: localeProp,
  className,
  ...rest
}: StatTileProps) {
  const locale = useLocale(localeProp);
  const reduce = useReducedMotion();
  const pill = useId();
  const labelId = useId();
  const [period, setPeriod] = useControllableState({ value: periodProp, defaultValue: defaultPeriod ?? periods?.[0]?.value ?? "", onChange: onPeriodChange });
  const [scrub, setScrub] = useState<number | null>(null);
  const [keyed, setKeyed] = useState(false);
  const head = useRef<HTMLSpanElement>(null);
  const prev = useRef({ value, period });

  // Tint the headline when the value itself changes, never when scrubbing moves it.
  useEffect(() => {
    const { value: last, period: lastPeriod } = prev.current;
    if (Object.is(last, value)) return;
    prev.current = { value, period };
    const el = head.current;
    // The first value after a period switch answers a different question; it isn't a rise or a fall.
    if (last == null || value == null || lastPeriod !== period || !el) return;
    const good = value > last !== inverse;
    const tint = `var(--${good ? "success" : "danger"})`;
    el.getAnimations().forEach((a) => a.id === "stat-tint" && a.cancel());
    el.animate(
      [
        { color: tint, offset: 0 },
        { color: tint, offset: 0.35 },
      ],
      { duration: 1400, easing: "ease-out", id: "stat-tint" },
    );
  }, [value, inverse, period]);

  const points = data ?? [];
  const skeleton = loading && value == null;
  const refreshing = loading && value != null;
  const point = scrub != null ? points[scrub] : undefined;

  const shortcuts = { currency, compact, decimals, format };
  const exact = new Intl.NumberFormat(locale, numberFormatOptions({ currency, decimals, format })).format(point?.value ?? value ?? 0);
  const pointText = (p: StatPoint) => `${p.label}: ${new Intl.NumberFormat(locale, numberFormatOptions(shortcuts)).format(p.value)}`;

  // While scrubbing, the badge measures from the start of the window to the point under the finger.
  const base = points[0]?.value;
  const shownDelta = point ? (base ? ((point.value - base) / Math.abs(base)) * 100 : null) : delta;
  const tone = getDelta(delta, { inverse }).tone;
  const geo = points.length ? geometry(points.map((p) => p.value)) : null;
  const scrubAt = scrub != null && points.length > 1 ? scrub / (points.length - 1) : null;

  const move = (clientX: number, rect: DOMRect) => {
    if (points.length < 2) return;
    const p = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setScrub(Math.round(p * (points.length - 1)));
    setKeyed(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (points.length < 2) return;
    const lastIndex = points.length - 1;
    const now = scrub ?? lastIndex;
    const next =
      e.key === "ArrowLeft" ? Math.max(0, scrub == null ? lastIndex : now - 1)
      : e.key === "ArrowRight" ? Math.min(lastIndex, scrub == null ? lastIndex : now + 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? lastIndex
      : e.key === "Escape" ? null
      : undefined;
    if (next === undefined) return;
    e.preventDefault();
    setScrub(next);
    setKeyed(true);
  };

  const headline = (
    // A fixed 32px line box: the rolling digits' mask may overflow it, the layout never does.
    <span ref={head} className="inline-flex h-8 items-center text-fg">
      <NumberTicker value={point?.value ?? value ?? 0} locale={locale} {...shortcuts} className="text-[28px] font-medium leading-none tracking-[-0.03em]" />
    </span>
  );

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-busy={loading || undefined}
      data-state={error ? "error" : skeleton ? "loading" : refreshing ? "refreshing" : "ready"}
      data-scrubbing={scrub != null || undefined}
      className={cn("flex w-full min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]", className)}
      {...rest}
    >
      <div className="flex h-6 box-content items-center justify-between gap-3 px-4 pt-3">
        <span id={labelId} className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-fg-2">
          <span className="truncate">{label}</span>
          {refreshing && (
            <>
              <Refresh size={12} className="shrink-0 text-fg-4 motion-safe:animate-spin-slow" />
              <span className="sr-only">Refreshing</span>
            </>
          )}
        </span>
        {periods && periods.length > 0 && (
          <RadioGroup
            value={period}
            onValueChange={(v) => {
              setPeriod(v as string);
              setScrub(null);
            }}
            aria-label={`${label} period`}
            className="-mr-1.5 flex h-6 shrink-0 rounded-md p-0.5"
          >
            {periods.map((p) => {
              const on = p.value === period;
              return (
                <Radio.Root
                  key={p.value}
                  value={p.value}
                  nativeButton
                  render={<button type="button" />}
                  className={cn(
                    // 20px drawn, 44px tappable on touch.
                    "group/period relative rounded-[5px] px-1.5 font-mono text-[10.5px] outline-none transition-colors duration-150",
                    "before:absolute before:-inset-x-0.5 before:-inset-y-3 before:content-[''] pointer-fine:before:hidden",
                    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
                    on ? "text-fg" : "text-fg-3 hover:text-fg-2",
                  )}
                >
                  {on && (
                    <motion.span
                      layoutId={pill}
                      aria-hidden
                      className="absolute inset-0 rounded-[5px] bg-hover ring-1 ring-line-2"
                      transition={reduce ? { duration: 0 } : spring.snappy}
                    />
                  )}
                  <span className="relative inline-block transition-[scale] duration-100 motion-safe:group-active/period:scale-[0.94]">{p.label}</span>
                </Radio.Root>
              );
            })}
          </RadioGroup>
        )}
      </div>

      <div className="flex flex-col gap-1.5 px-4 pb-2 pt-2">
        {skeleton ? (
          <>
            <span aria-hidden className="flex h-8 items-center">
              <span className="h-7 w-32 rounded-md bg-fg/[0.07] motion-safe:animate-pulse-soft" />
            </span>
            <span aria-hidden className="flex h-[18px] items-center">
              <span className="h-3 w-24 rounded-sm bg-fg/[0.07] motion-safe:animate-pulse-soft" />
            </span>
            <span className="sr-only">Loading {label}</span>
          </>
        ) : value == null && error ? (
          <div role="alert" className="flex h-14 items-center justify-between gap-3">
            <span className="text-[12.5px] text-fg-2">{error}</span>
            {onRetry && <RetryButton onClick={onRetry} />}
          </div>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-2">
              {compact ? (
                <Tooltip.Root>
                  <Tooltip.Trigger
                    delay={300}
                    render={<span tabIndex={0} role="img" aria-label={exact} />}
                    className="rounded-sm outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-fg-3"
                  >
                    {headline}
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Positioner side="top" align="start" sideOffset={8} collisionPadding={8} className="z-(--z-tooltip)">
                      <Tooltip.Popup className="origin-(--transform-origin) rounded-md border border-line-2 bg-raised px-2 py-1 font-mono text-[11.5px] text-fg shadow-pop tabular transition-[opacity,scale] duration-150 ease-out-expo data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-ending-style:duration-100 data-instant:transition-none data-starting-style:scale-[0.96] data-starting-style:opacity-0">
                        {exact}
                      </Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </Tooltip.Root>
              ) : (
                headline
              )}
              <DeltaBadge value={shownDelta} inverse={inverse} locale={locale} />
            </div>
            <span className="flex min-h-[18px] min-w-0 items-center gap-2 text-[12px] text-fg-3">
              {error ? (
                <>
                  <span className="truncate text-danger">{error}</span>
                  {onRetry && <RetryButton onClick={onRetry} small />}
                </>
              ) : (
                <span className="truncate tabular">{point ? `${point.label} · vs ${points[0].label}` : comparison}</span>
              )}
            </span>
          </>
        )}
      </div>

      <div
        tabIndex={points.length > 1 && !skeleton ? 0 : -1}
        role="img"
        aria-label={
          points.length > 1
            ? `${label} trend from ${points[0].label} to ${points[points.length - 1].label}. Use the arrow keys to read each point.`
            : `No ${label.toLowerCase()} data for this period`
        }
        onKeyDown={onKeyDown}
        onBlur={() => setScrub(null)}
        onPointerMove={(e) => move(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e.clientX, e.currentTarget.getBoundingClientRect());
        }}
        onPointerLeave={() => setScrub(null)}
        onPointerCancel={() => setScrub(null)}
        onPointerUp={(e) => e.pointerType !== "mouse" && setScrub(null)}
        className={cn(
          "relative h-14 touch-pan-y select-none rounded-b-[11px] outline-none transition-opacity duration-300",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-fg-3",
          tone === "good" ? "text-success" : tone === "bad" ? "text-danger" : "text-fg-2",
          refreshing && "opacity-50",
          points.length > 1 && !skeleton && "cursor-crosshair",
        )}
      >
        {skeleton ? (
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-8 bg-fg/[0.05] motion-safe:animate-pulse-soft [clip-path:polygon(0_70%,20%_55%,40%_62%,60%_30%,80%_40%,100%_10%,100%_100%,0_100%)]" />
        ) : geo ? (
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden className="absolute inset-0 size-full overflow-visible">
            <defs>
              <linearGradient id={`${pill}-fill`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="currentColor" stopOpacity="0.14" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.path
              initial={false}
              animate={{ d: geo.area }}
              transition={reduce ? { duration: 0 } : { duration: 0.5, ease: ease.inOut }}
              fill={`url(#${pill}-fill)`}
            />
            <motion.path
              initial={false}
              animate={{ d: geo.line }}
              transition={reduce ? { duration: 0 } : { duration: 0.5, ease: ease.inOut }}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : (
          <span className="absolute inset-0 grid place-items-center pb-2 text-[12px] text-fg-4">No data for this period</span>
        )}

        {geo && scrubAt != null && (
          // Hairline and dot are HTML, not SVG, so they stay round and 1px while the chart stretches.
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <span className="absolute inset-y-0 w-px -translate-x-1/2 bg-fg/15" style={{ left: `${scrubAt * 100}%` }} />
            <span
              className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current ring-2 ring-raised"
              style={{ left: `${scrubAt * 100}%`, top: `${(geo.at(scrubAt) / H) * 100}%` }}
            />
          </div>
        )}
      </div>
      <span aria-live="polite" className="sr-only">
        {keyed && point ? pointText(point) : ""}
      </span>
    </div>
  );
}

function RetryButton({ onClick, small }: { onClick: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md font-medium text-fg outline-none transition-[background-color,scale] duration-150 hover:bg-hover active:scale-[0.97]",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        small ? "-my-1 h-6 px-1.5 text-[12px]" : "h-7 border border-line-2 px-2.5 text-[12px] shadow-[var(--shadow)]",
      )}
    >
      <Refresh size={12} />
      Try again
    </button>
  );
}
