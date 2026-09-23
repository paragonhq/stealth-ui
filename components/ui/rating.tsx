"use client";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

type Size = "sm" | "md" | "lg";
const SIZES: Record<Size, { icon: number; gap: number; text: string }> = {
  sm: { icon: 14, gap: 2, text: "text-[12px]" },
  md: { icon: 18, gap: 4, text: "text-[12.5px]" },
  lg: { icon: 24, gap: 4, text: "text-[13px]" },
};

/** A filled star on the 16px grid. The stroke rounds its points. */
export function StarIcon() {
  return (
    <svg viewBox="0 0 16 16" width="100%" height="100%" aria-hidden focusable={false}>
      <path
        d="m8 1.9 1.8 3.7 4.05.58-2.93 2.86.7 4.03L8 11.17l-3.62 1.9.7-4.03L2.15 6.18l4.05-.58z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

export type RatingProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "children"> & {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  /** Number of icons. */
  max?: number;
  /** 1 for whole icons, 0.5 to allow halves. */
  step?: 0.5 | 1;
  /** Pressing the current value again clears the rating to 0. */
  clearable?: boolean;
  /** Display only. Shows any fraction (4.3 fills 30% of the fifth icon) and is not focusable. */
  readOnly?: boolean;
  disabled?: boolean;
  size?: Size;
  /** Replace the star. Draw it filled with currentColor on a square viewBox. */
  icon?: React.ReactNode;
  /** One word per whole value ("Poor" … "Excellent"), shown beside the icons and read out. */
  labels?: string[];
  /** Shown beside the icons while nothing is rated, when labels are used. */
  placeholder?: string;
  /** Posts the value with a form. */
  name?: string;
  /** Screen reader text for a value. Defaults to "4 out of 5", with the label first when labels are set. */
  getValueText?: (value: number, max: number) => string;
};

export function Rating({
  value: valueProp,
  defaultValue = 0,
  onValueChange,
  max = 5,
  step = 1,
  clearable = true,
  readOnly = false,
  disabled = false,
  size = "md",
  icon,
  labels,
  placeholder = "",
  name,
  getValueText,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...rest
}: RatingProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const [hover, setHover] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduce = useReducedMotion();
  const valueId = useId();
  // Pointer bookkeeping that never needs a render.
  const press = useRef<{ x: number; moved: boolean } | null>(null);
  const muted = useRef<number | null>(null);

  const s = SIZES[size];
  const interactive = !readOnly && !disabled;
  const shown = interactive && hover !== null ? hover : value;
  const previewing = interactive && hover !== null && hover !== value;
  const labelFor = (v: number) => (labels && v > 0 ? labels[Math.min(labels.length, Math.ceil(v)) - 1] ?? "" : "");
  const valueText = (v: number) =>
    getValueText ? getValueText(v, max) : v === 0 ? "Not rated" : [labelFor(v), `${v} out of ${max}`].filter(Boolean).join(", ");

  // Map a pointer position to a value, snapping to the step. Gaps belong to the icon on their left.
  const fromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const x = rtl ? rect.right - e.clientX : e.clientX - rect.left;
    const cell = s.icon + s.gap;
    const index = clamp(Math.floor(x / cell), 0, max - 1);
    const within = clamp((x - index * cell) / s.icon, 0, 1);
    return index + (step === 0.5 && within <= 0.5 ? 0.5 : 1);
  };

  const pop = (v: number) => {
    if (reduce || !scope.current) return;
    const stars = Array.from(scope.current.querySelectorAll<HTMLElement>("[data-icon]")).slice(0, Math.ceil(v));
    stars.forEach((el, i) => {
      const last = i === stars.length - 1;
      animate(el, { scale: [1, last ? 1.3 : 1.1, 1] }, { duration: last ? 0.42 : 0.32, times: [0, 0.35, 1], ease: [ease.out, ease.inOut], delay: i * 0.035 });
    });
  };

  const commit = (v: number, from: "pointer" | "keyboard") => {
    if (clearable && from === "pointer" && v === value) {
      setValue(0);
      setAnnouncement("Rating cleared");
      // Keep the cleared state visible until the pointer moves to a different value.
      muted.current = v;
      setHover(null);
      return;
    }
    setValue(v);
    setAnnouncement("");
    if (from === "pointer") pop(v);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const map: Record<string, number> = {
      ArrowRight: rtl ? -step : step,
      ArrowUp: step,
      ArrowLeft: rtl ? step : -step,
      ArrowDown: -step,
    };
    let next: number | null = null;
    if (e.key in map) next = clamp(roundTo(value + map[e.key], step), 0, max);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = max;
    else if (/^[0-9]$/.test(e.key) && Number(e.key) <= max) next = Number(e.key);
    else if ((e.key === "Backspace" || e.key === "Delete") && clearable) next = 0;
    if (next === null) return;
    // The key is ours: keep page-level single-key shortcuts (digits especially) from also firing.
    e.preventDefault();
    e.stopPropagation();
    setHover(null);
    commit(next, "keyboard");
  };

  const icons = (
    <div
      ref={scope}
      className="relative flex items-center after:absolute after:-inset-y-3 after:inset-x-0 after:content-['']"
      style={{ gap: s.gap }}
    >
      {Array.from({ length: max }, (_, i) => {
        const fill = clamp(shown - i, 0, 1);
        return (
          <span key={i} data-icon="" className="relative block shrink-0" style={{ width: s.icon, height: s.icon }}>
            <span className="absolute inset-0 text-fg-4">{icon ?? <StarIcon />}</span>
            <span
              className={cn(
                "absolute inset-0 transition-[clip-path,color] duration-100 ease-out motion-reduce:transition-none",
                previewing ? "text-fg-2" : "text-fg",
              )}
              style={{ clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)` }}
            >
              {icon ?? <StarIcon />}
            </span>
          </span>
        );
      })}
    </div>
  );

  const label = labels ? (
    // Every label shares one grid cell, so the row is as wide as the longest and never shifts.
    <span aria-hidden className={cn("grid select-none overflow-hidden py-0.5", s.text)}>
      {[placeholder, ...labels].map((l, i) => (
        <span key={i} className="invisible col-start-1 row-start-1 whitespace-nowrap">
          {l || " "}
        </span>
      ))}
      <AnimatePresence initial={false}>
        <motion.span
          key={labelFor(shown) || "none"}
          className={cn(
            "col-start-1 row-start-1 whitespace-nowrap transition-colors duration-100",
            shown === 0 ? "text-fg-3" : previewing ? "text-fg-2" : "text-fg",
          )}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 5, filter: "blur(2px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -5, filter: "blur(2px)", transition: { duration: 0.1 } }}
          transition={{ duration: reduce ? 0.12 : 0.18, ease: ease.out }}
        >
          {labelFor(shown) || placeholder || " "}
        </motion.span>
      </AnimatePresence>
    </span>
  ) : null;

  if (readOnly) {
    return (
      <div
        role="img"
        aria-label={ariaLabel ? `${ariaLabel}: ${valueText(value)}` : valueText(value)}
        // aria-labelledby wins over aria-label, so point it at the value too or the number is lost.
        aria-labelledby={ariaLabelledBy ? `${ariaLabelledBy} ${valueId}` : undefined}
        data-readonly=""
        data-size={size}
        className={cn("inline-flex items-center gap-2", className)}
        {...rest}
      >
        {icons}
        {label}
        {ariaLabelledBy && (
          <span id={valueId} hidden>
            {valueText(value)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      data-size={size}
      data-disabled={disabled ? "" : undefined}
      className={cn("inline-flex items-center gap-2.5 data-disabled:opacity-50", className)}
      {...rest}
    >
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText(value)}
        aria-disabled={disabled || undefined}
        data-disabled={disabled ? "" : undefined}
        data-previewing={previewing ? "" : undefined}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          if (!interactive || e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          press.current = { x: e.clientX, moved: false };
          muted.current = null;
          setHover(fromPointer(e));
        }}
        onPointerMove={(e) => {
          if (!interactive) return;
          const v = fromPointer(e);
          if (press.current && Math.abs(e.clientX - press.current.x) > 4) press.current.moved = true;
          if (muted.current !== null) {
            if (muted.current === v) return;
            muted.current = null;
          }
          // Mouse previews on hover; touch and pen preview only while pressed, so a scrub works.
          if (press.current || e.pointerType === "mouse") setHover(v);
        }}
        onPointerUp={(e) => {
          if (!press.current) return;
          const v = fromPointer(e);
          const scrubbed = press.current.moved;
          press.current = null;
          // A scrub that ends on the current value keeps it; only a tap clears.
          if (scrubbed && v === value) return setHover(e.pointerType === "mouse" ? v : null);
          commit(v, "pointer");
          if (e.pointerType !== "mouse") setHover(null);
        }}
        onPointerCancel={() => {
          press.current = null;
          setHover(null);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse" && !press.current) {
            muted.current = null;
            setHover(null);
          }
        }}
        className={cn(
          "relative touch-pan-y select-none rounded-md",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          interactive && "cursor-pointer",
          disabled && "pointer-events-none",
        )}
      >
        {icons}
      </div>
      {label}
      {name && <input type="hidden" name={name} value={value} disabled={disabled} />}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
