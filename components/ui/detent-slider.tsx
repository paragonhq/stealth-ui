"use client";
import { Slider as BaseSlider } from "@base-ui/react/slider";
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type DetentStop = { value: string; label: ReactNode; description?: ReactNode };

export type DetentSliderProps = Omit<
  ComponentProps<typeof BaseSlider.Root>,
  "value" | "defaultValue" | "onValueChange" | "onValueCommitted" | "children" | "className" | "render" | "min" | "max" | "step" | "largeStep" | "format"
> & {
  /** The named positions, in order. Two or more. */
  stops: DetentStop[];
  value?: string;
  defaultValue?: string;
  /** Called when the thumb settles on a different stop, not on every frame of a drag. */
  onValueChange?: (value: string) => void;
  /** Visible label. Without one, pass aria-label. */
  label?: ReactNode;
  /** Unlit ruler ticks between neighboring stops. */
  ticksBetween?: number;
  className?: string;
};

// Stops live at whole numbers; the drag moves through the gaps at this resolution.
const FINE = 0.001;
// The settle: fast, with a pixel or two of overshoot so the stop feels like it clicks in.
const settle = { type: "spring", stiffness: 640, damping: 31, mass: 0.6 } as const;

// Near a stop the thumb lags the pointer, then catches up as you leave: a detent
// you can feel. Offset from the nearest stop is eased by a power curve that meets
// the pointer again at the midpoint, so the motion never jumps.
function resist(raw: number) {
  const k = Math.round(raw);
  const o = raw - k;
  return k + Math.sign(o) * 0.5 * Math.pow(Math.abs(o) / 0.5, 1.6);
}

const spoken = (s?: DetentStop) => (s ? (typeof s.label === "string" ? s.label : s.value) : "");

export function DetentSlider({
  stops,
  value: valueProp,
  defaultValue,
  onValueChange,
  label,
  ticksBetween = 3,
  disabled,
  className,
  "aria-label": ariaLabel,
  ...rest
}: DetentSliderProps) {
  const last = stops.length - 1;
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue: defaultValue ?? stops[0].value, onChange: onValueChange });
  const index = Math.max(
    0,
    stops.findIndex((s) => s.value === value),
  );
  const reduce = useReducedMotion();

  // raw: where the pointer says the thumb is (Base UI's value). pos: where the thumb is drawn.
  const [raw, setRaw] = useState(index);
  const [dir, setDir] = useState(1);
  const [prevIndex, setPrevIndex] = useState(index);
  const pos = useMotionValue(index);
  const left = useTransform(pos, (v) => `${(v / last) * 100}%`);

  // A controlled value that changes from outside settles the thumb onto it.
  if (prevIndex !== index) {
    setPrevIndex(index);
    if (Math.round(raw) !== index) setRaw(index);
  }
  useEffect(() => {
    if (Math.abs(pos.get() - index) < 0.001 || pos.isAnimating()) return;
    if (reduce) pos.jump(index);
    else animate(pos, index, settle);
  }, [index, pos, reduce]);

  const per = ticksBetween + 1;
  const [lit, setLit] = useState(index * per);
  useMotionValueEvent(pos, "change", (v) => setLit(Math.floor(v * per + 0.02)));

  const nearest = Math.min(last, Math.max(0, Math.round(raw)));
  const settleTo = (i: number, instant = false) => {
    setRaw(i);
    setDir(i >= index ? 1 : -1);
    if (instant || reduce) pos.jump(i);
    else animate(pos, i, settle);
    setValue(stops[i].value);
  };

  return (
    <BaseSlider.Root
      value={raw}
      min={0}
      max={last}
      step={FINE}
      disabled={disabled}
      onValueChange={(next, details) => {
        const n = next as number;
        if (details.reason === "keyboard") {
          // Keys move a whole stop at a time, and instantly.
          const to = n <= 0 ? 0 : n >= last ? last : Math.min(last, Math.max(0, nearest + Math.sign(n - raw)));
          settleTo(to, true);
          return;
        }
        setDir(Math.round(n) >= nearest ? 1 : -1);
        setRaw(n);
        if (details.reason === "track-press" && !reduce) animate(pos, resist(n), settle);
        else pos.jump(resist(n));
      }}
      onValueCommitted={(v, details) => {
        if (details.reason !== "keyboard") settleTo(Math.min(last, Math.max(0, Math.round(v as number))));
      }}
      data-stop={stops[nearest].value}
      className={cn("group/detent flex w-full flex-col gap-2.5 data-disabled:opacity-50", className)}
      {...rest}
    >
      <div className="flex items-baseline justify-between gap-3">
        {label != null && <BaseSlider.Label className="min-w-0 truncate text-[12.5px] font-medium tracking-[-0.005em] text-fg">{label}</BaseSlider.Label>}
        <Swap reduce={!!reduce} dir={dir} active={nearest} className="ml-auto text-right text-[12.5px] text-fg-2">
          {stops.map((s) => s.label)}
        </Swap>
      </div>

      <div>
        <BaseSlider.Control className="group/control relative flex h-6 cursor-pointer touch-none select-none items-center group-data-disabled/detent:pointer-events-none">
          <BaseSlider.Track className="relative h-1.5 w-full rounded-full bg-fg/10 transition-colors duration-150 group-hover/control:bg-fg/14">
            <motion.div aria-hidden className="absolute inset-y-0 left-0 rounded-full bg-fg" style={{ width: left }} />
            {/* Base UI's thumb is the invisible hit target and focus stop; the drawn thumb follows pos. */}
            <BaseSlider.Thumb
              aria-label={ariaLabel}
              getAriaValueText={(_, v) => spoken(stops[Math.round(v)])}
              className="size-4 outline-none before:absolute before:-inset-3.5 before:content-['']"
            />
            <motion.span
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-1/2 z-[3] size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg shadow-[var(--shadow)]",
                "outline-offset-2 group-has-focus-visible/detent:outline-1 group-has-focus-visible/detent:outline-solid group-has-focus-visible/detent:outline-fg-3",
                "transition-[scale,box-shadow] duration-150 ease-out-expo motion-reduce:transition-none",
                "group-hover/control:scale-110 group-data-dragging/detent:scale-125 group-data-dragging/detent:ring-4 group-data-dragging/detent:ring-fg/10",
              )}
              style={{ left }}
            />
          </BaseSlider.Track>
        </BaseSlider.Control>

        {/* The ruler: every tick the thumb has passed is lit, stops brighter than the ones between. */}
        <div aria-hidden className="relative mt-1.5 h-2">
          {Array.from({ length: last * per + 1 }, (_, t) => {
            const major = t % per === 0;
            return (
              <span
                key={t}
                data-lit={t <= lit || undefined}
                className={cn(
                  "absolute top-0 w-px -translate-x-1/2 origin-top rounded-full transition-[background-color,scale] duration-150",
                  major ? "h-2 bg-fg/20 data-lit:bg-fg" : "h-1 bg-fg/15 data-lit:bg-fg-2",
                  "scale-y-75 data-lit:scale-y-100",
                )}
                style={{ left: `${(t / (last * per)) * 100}%` }}
              />
            );
          })}
        </div>

        {/* Stop names. Pointer shortcuts; the thumb covers them from the keyboard. */}
        <div aria-hidden className="relative mt-1 h-4">
          {stops.map((s, i) => (
            <button
              key={s.value}
              type="button"
              tabIndex={-1}
              disabled={disabled}
              data-current={i === nearest || undefined}
              onClick={() => settleTo(i)}
              className={cn(
                "absolute top-0 whitespace-nowrap rounded-sm px-1 text-[11px] leading-4 text-fg-3",
                "transition-[color,scale] duration-150 hover:text-fg-2 active:scale-95 data-current:text-fg disabled:pointer-events-none",
                i === 0 ? "-ml-1" : i === last ? "ml-1 -translate-x-full" : "-translate-x-1/2",
              )}
              style={{ left: `${(i / last) * 100}%` }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {stops.some((s) => s.description != null) && (
        <Swap reduce={!!reduce} dir={dir} active={nearest} wrap className="text-[12px] leading-[1.45] text-fg-3">
          {stops.map((s) => s.description ?? "")}
        </Swap>
      )}
    </BaseSlider.Root>
  );
}

// Content that changes with the stop, inside a box sized to the largest option so
// nothing around it moves. The new one slides in from the side the thumb is heading.
function Swap({
  children,
  active,
  dir,
  reduce,
  wrap,
  className,
}: {
  children: ReactNode[];
  active: number;
  dir: number;
  reduce: boolean;
  wrap?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative grid", wrap ? "" : "justify-items-end whitespace-nowrap", className)}>
      {children.map((c, i) => (
        <span key={i} aria-hidden className="invisible col-start-1 row-start-1">
          {c}
        </span>
      ))}
      <AnimatePresence initial={false} custom={dir}>
        <motion.span
          key={active}
          custom={dir}
          className="col-start-1 row-start-1"
          variants={{
            enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * 6, filter: "blur(2px)" }),
            center: { opacity: 1, x: 0, filter: "blur(0px)" },
            exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * -6, filter: "blur(2px)" }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduce ? 0.12 : 0.18, ease: ease.out }}
        >
          {children[active]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
