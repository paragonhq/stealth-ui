"use client";
import NumberFlow, { type Format } from "@number-flow/react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

// The knob sweeps 270 degrees, leaving the gap at the bottom where hardware puts it.
const SWEEP = 270;
const START = -SWEEP / 2;

const SIZES = {
  sm: { box: 40, knob: 30, stroke: 1.75 },
  md: { box: 56, knob: 44, stroke: 2 },
  lg: { box: 72, knob: 58, stroke: 2 },
} as const;

// Digit roll timing for the readout, on the library's entrance curve.
const ROLL = { duration: 420, easing: `cubic-bezier(${ease.out.join(",")})` };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function snap(value: number, min: number, max: number, step: number) {
  const snapped = Math.round((value - min) / step) * step + min;
  // Trim float noise (0.1 + 0.2) so readouts and aria values stay clean.
  const decimals = (String(step).split(".")[1] ?? "").length;
  return clamp(Number(snapped.toFixed(decimals)), min, max);
}

/** Point on a circle, 0deg at twelve o'clock, clockwise. */
function polar(c: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return [c + r * Math.sin(a), c - r * Math.cos(a)] as const;
}

function arc(c: number, r: number, from: number, to: number) {
  const a = Math.min(from, to);
  const b = Math.max(from, to);
  if (b - a < 0.01) return "";
  const [x0, y0] = polar(c, r, a);
  const [x1, y1] = polar(c, r, b);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

/** A number that rolls with an optional prefix and suffix, or fixed text such as "C" for center. */
export type DialDisplay = { value: number; prefix?: string; suffix?: string } | string;

export type DialProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "children"> & {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  /** Fires once a gesture settles: pointer released, key pressed, wheel idle. */
  onValueCommitted?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Step for Shift+Arrow and Page Up/Down. Defaults to a tenth of the range. */
  largeStep?: number;
  /** Where the fill starts. Set it to the center (0 for pan or gain) for a bipolar dial. Defaults to min. */
  origin?: number;
  /** Value restored by double-click, Delete or Backspace. Defaults to defaultValue, then origin. */
  resetValue?: number;
  label?: React.ReactNode;
  size?: keyof typeof SIZES;
  /** Vertical: drag up or right to raise, like most audio tools. Circular: turn it around its center. */
  dragMode?: "vertical" | "circular";
  /** Pixels of vertical drag that cover the whole range. Shift divides the speed by ten. */
  sensitivity?: number;
  format?: Format;
  locale?: Intl.LocalesArgument;
  /** Short unit after the number, e.g. " dB" or "%". */
  unit?: string;
  /** Full control over the readout, e.g. turning -20 into L 20. */
  formatDisplay?: (value: number) => DialDisplay;
  /** Screen reader text for the value. Defaults to the readout as text. */
  getValueText?: (value: number) => string;
  disabled?: boolean;
  readOnly?: boolean;
  /** Submits the value with a form. */
  name?: string;
};

export function Dial({
  value: valueProp,
  defaultValue,
  onValueChange,
  onValueCommitted,
  min = 0,
  max = 100,
  step = 1,
  largeStep,
  origin,
  resetValue,
  label,
  size = "md",
  dragMode = "vertical",
  sensitivity = 200,
  format,
  locale,
  unit,
  formatDisplay,
  getValueText,
  disabled = false,
  readOnly = false,
  name,
  className,
  "aria-label": ariaLabel,
  ...rest
}: DialProps) {
  const initial = defaultValue ?? origin ?? min;
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue: initial, onChange: onValueChange });
  const reduce = useReducedMotion();
  const labelId = useId();
  const knobRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const range = max - min;
  const from = clamp(origin ?? min, min, max);
  const big = largeStep ?? Math.max(step, snap(range / 10, 0, range, step));
  const reset = clamp(resetValue ?? defaultValue ?? origin ?? min, min, max);
  const interactive = !disabled && !readOnly;
  const geo = SIZES[size];
  const c = geo.box / 2;
  const r = c - geo.stroke / 2 - 0.5;
  const toAngle = (v: number) => START + ((clamp(v, min, max) - min) / range) * SWEEP;
  const target = toAngle(value);

  // One motion value drives both the pointer and the arc, so a reset can glide
  // both together while drag and keys stay 1:1.
  const angle = useMotionValue(target);
  const stretch = useMotionValue(0);
  const rotate = useTransform(() => angle.get() + stretch.get());
  const fillPath = useTransform(angle, (a) => arc(c, r, toAngle(from), clamp(a, START, -START)));
  const glide = useRef(false);

  useLayoutEffect(() => {
    if (glide.current && !reduce) animate(angle, target, spring.soft);
    else angle.jump(target);
    glide.current = false;
  }, [target, angle, reduce]);

  // Live values the gesture handlers read without re-subscribing.
  const live = useRef({ value, setValue, min, max, step, range, interactive, reduce, onValueCommitted, sensitivity, dragMode });
  useLayoutEffect(() => {
    live.current = { value, setValue, min, max, step, range, interactive, reduce, onValueCommitted, sensitivity, dragMode };
  });

  const drag = useRef<{ x: number; y: number; t: number; angle: number; over: number; startValue: number; lastValue: number } | null>(null);
  const wheel = useRef({ t: 0, at: 0, timer: 0, start: 0 });

  const commit = (v: number) => onValueCommitted?.(v);
  const setFromT = (t: number) => {
    const { min: lo, max: hi, step: s, range: span } = live.current;
    const next = snap(lo + clamp(t, 0, 1) * span, lo, hi, s);
    setValue(next);
    return next;
  };

  // A small, springy end stop: pushing past a limit leans the pointer a few
  // degrees further, and it settles back when you let go or turn back.
  const lean = (excess: number) => {
    if (live.current.reduce) return;
    const deg = Math.sign(excess) * 6 * (1 - 1 / (1 + Math.abs(excess) * 4));
    stretch.set(deg);
  };
  const settle = () => {
    if (stretch.get() !== 0) animate(stretch, 0, spring.snappy);
  };

  // Wheel only acts while the dial has focus, so scrolling the page never gets caught on it.
  useEffect(() => {
    const el = knobRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const l = live.current;
      if (!l.interactive || document.activeElement !== el) return;
      e.preventDefault();
      const w = wheel.current;
      const now = performance.now();
      if (now - w.at > 400) {
        w.t = (l.value - l.min) / l.range;
        w.start = l.value;
      }
      w.at = now;
      const delta = -(e.deltaY || -e.deltaX) * (e.shiftKey ? 0.00006 : 0.0006);
      const raw = w.t + delta;
      w.t = clamp(raw, 0, 1);
      if (raw > 1 || raw < 0) lean((raw - w.t) * 3 + (raw > 1 ? 0.05 : -0.05));
      const { min: lo, max: hi, step: s, range: span } = l;
      const next = snap(lo + w.t * span, lo, hi, s);
      l.setValue(next);
      window.clearTimeout(w.timer);
      w.timer = window.setTimeout(() => {
        settle();
        if (next !== w.start) live.current.onValueCommitted?.(next);
        w.at = 0;
      }, 260);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.clearTimeout(wheel.current.timer);
    };
    // The handler reads everything it needs from `live`, so it binds once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pointerAngle = (e: React.PointerEvent) => {
    const box = knobRef.current!.getBoundingClientRect();
    return (Math.atan2(e.clientX - (box.left + box.width / 2), -(e.clientY - (box.top + box.height / 2))) * 180) / Math.PI;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || e.button !== 0) return;
    // Native mousedown focuses the knob (so the wheel and keys work next) without
    // showing the keyboard focus ring.
    e.currentTarget.setPointerCapture(e.pointerId);
    // The value never jumps on grab: the gesture moves it relative to where it was.
    drag.current = { x: e.clientX, y: e.clientY, t: (value - min) / range, angle: pointerAngle(e), over: 0, startValue: value, lastValue: value };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    let dt: number;
    if (live.current.dragMode === "circular") {
      const a = pointerAngle(e);
      let delta = a - d.angle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      d.angle = a;
      dt = (delta / SWEEP) * (e.shiftKey ? 0.1 : 1);
    } else {
      dt = ((e.clientX - d.x - (e.clientY - d.y)) / live.current.sensitivity) * (e.shiftKey ? 0.1 : 1);
    }
    d.x = e.clientX;
    d.y = e.clientY;

    const atEdge = (d.t >= 1 && dt > 0) || (d.t <= 0 && dt < 0);
    if (atEdge) {
      d.over += dt;
      lean(d.over);
      return;
    }
    // Turning back from a limit moves the value straight away; the lean springs home.
    if (d.over !== 0) {
      d.over = 0;
      settle();
    }
    d.t = clamp(d.t + dt, 0, 1);
    d.lastValue = setFromT(d.t);
  };

  const endDrag = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    settle();
    if (d.lastValue !== d.startValue) commit(d.lastValue);
  };

  const nudge = (next: number) => {
    const v = snap(next, min, max, step);
    if (v === value) return;
    setValue(v);
    commit(v);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const inc = e.shiftKey ? big : step;
    const map: Record<string, number | undefined> = {
      ArrowUp: value + inc,
      ArrowRight: value + inc,
      ArrowDown: value - inc,
      ArrowLeft: value - inc,
      PageUp: value + big,
      PageDown: value - big,
      Home: min,
      End: max,
      Delete: reset,
      Backspace: reset,
    };
    const next = map[e.key];
    if (next === undefined) return;
    e.preventDefault();
    nudge(next);
  };

  const onDoubleClick = () => {
    if (!interactive || value === reset) return;
    glide.current = true;
    setValue(reset);
    commit(reset);
  };

  const display = formatDisplay ? formatDisplay(value) : { value, suffix: unit };
  const valueText =
    getValueText?.(value) ??
    (typeof display === "string"
      ? display
      : `${display.prefix ?? ""}${new Intl.NumberFormat(locale, format).format(display.value)}${display.suffix ?? ""}`.trim());
  const readoutClass = cn(
    "tabular text-[12.5px] font-medium leading-[18px] tracking-[-0.005em] transition-colors duration-150",
    dragging ? "text-fg" : "text-fg-2 group-focus-within/dial:text-fg",
  );

  return (
    <div
      data-size={size}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
      data-dragging={dragging || undefined}
      className={cn("group/dial inline-flex w-max select-none flex-col items-center gap-2", disabled && "opacity-50", className)}
      {...rest}
    >
      <div className="relative grid place-items-center" style={{ width: geo.box, height: geo.box }}>
        <svg aria-hidden width={geo.box} height={geo.box} className="absolute inset-0 overflow-visible" fill="none" strokeLinecap="round">
          <path d={arc(c, r, START, -START)} strokeWidth={geo.stroke} className="stroke-line-2" />
          <motion.path d={fillPath} strokeWidth={geo.stroke} className={disabled ? "stroke-fg-4" : "stroke-fg"} />
          {from > min && from < max && (
            // The origin of a bipolar dial is printed just outside the ring, like hardware.
            <path
              d={`M ${polar(c, r + geo.stroke / 2 + 1.5, toAngle(from)).join(" ")} L ${polar(c, r + geo.stroke / 2 + 4, toAngle(from)).join(" ")}`}
              strokeWidth={1.25}
              className="stroke-fg-3"
            />
          )}
        </svg>

        <div
          ref={knobRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-labelledby={label ? labelId : undefined}
          aria-label={label ? undefined : ariaLabel}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={valueText}
          aria-orientation="vertical"
          aria-disabled={disabled || undefined}
          aria-readonly={readOnly || undefined}
          data-dragging={dragging || undefined}
          suppressHydrationWarning
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          onKeyDown={onKeyDown}
          onDoubleClick={onDoubleClick}
          style={{ width: geo.knob, height: geo.knob }}
          className={cn(
            "relative touch-none rounded-full border border-line-2 bg-raised shadow-[var(--shadow)]",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "transition-[scale,border-color] duration-150 ease-out motion-reduce:transition-none",
            // A 44px hit area even for the small knob.
            "before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full",
            interactive && (dragMode === "circular" ? "cursor-grab data-[dragging]:cursor-grabbing" : "cursor-ns-resize"),
            interactive && "hover:border-fg-4 data-[dragging]:scale-[0.96] data-[dragging]:border-fg-4 data-[dragging]:duration-75 motion-reduce:data-[dragging]:scale-100",
          )}
        >
          <motion.div aria-hidden className="absolute inset-0" style={{ rotate }}>
            <span
              className={cn(
                "absolute left-1/2 top-[11%] h-[28%] w-[2px] -translate-x-1/2 rounded-full",
                disabled ? "bg-fg-4" : "bg-fg",
              )}
            />
          </motion.div>
        </div>
      </div>

      <div className="flex flex-col items-center">
        {typeof display === "string" ? (
          <span aria-hidden className={readoutClass}>
            {display}
          </span>
        ) : (
          <NumberFlow
            value={display.value}
            prefix={display.prefix}
            suffix={display.suffix}
            format={format}
            locales={locale}
            // Digits roll for discrete changes (keys, wheel, reset). While dragging
            // they follow the hand exactly, because a rolling readout lags the gesture.
            animated={!dragging}
            transformTiming={ROLL}
            spinTiming={ROLL}
            aria-hidden
            className={readoutClass}
          />
        )}
        {label && (
          <span id={labelId} className="text-[11px] leading-[14px] text-fg-3">
            {label}
          </span>
        )}
      </div>

      {name && <input type="hidden" name={name} value={value} disabled={disabled} />}
    </div>
  );
}
