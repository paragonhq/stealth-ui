"use client";
import { Popover } from "@base-ui/react/popover";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type TourTarget = string | React.RefObject<HTMLElement | null> | (() => HTMLElement | null);

export type TourStep = {
  /** A CSS selector (resolved inside `container` when given), a ref, or a function. Leave it out for a centered step. */
  target?: TourTarget;
  title: React.ReactNode;
  content?: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  /** Space between the target and the edge of the cutout, in px. */
  padding?: number;
  /** Corner radius of the cutout, in px. */
  radius?: number;
};

export type TourFinishReason = "completed" | "skipped";

export type ProductTourProps = {
  steps: TourStep[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  step?: number;
  defaultStep?: number;
  onStepChange?: (step: number) => void;
  /** Called once when the tour ends: by Done on the last step, or by Skip / Escape before it. */
  onFinish?: (reason: TourFinishReason) => void;
  /** Keep the overlay and card inside this element (it must be positioned). Defaults to the viewport. */
  container?: HTMLElement | null;
  labels?: { next?: string; back?: string; done?: string; skip?: string };
  className?: string;
};

function resolve(target: TourTarget | undefined, root: HTMLElement | null | undefined): HTMLElement | null {
  if (!target || typeof document === "undefined") return null;
  if (typeof target === "string") return (root ?? document).querySelector<HTMLElement>(target);
  if (typeof target === "function") return target();
  return target.current;
}

const subscribe = () => () => {};
const useHydrated = () => useSyncExternalStore(subscribe, () => true, () => false);

/**
 * A guided walk through the interface. One overlay stays up for the whole
 * tour and its cutout travels from target to target, so the eye is carried
 * rather than asked to find the next thing.
 */
export function ProductTour({
  steps,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  step: stepProp,
  defaultStep = 0,
  onStepChange,
  onFinish,
  container,
  labels,
  className,
}: ProductTourProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const [rawStep, setStep] = useControllableState({ value: stepProp, defaultValue: defaultStep, onChange: onStepChange });
  const [moving, setMoving] = useState(false);
  const [instant, setInstant] = useState(false);
  const moveTimer = useRef<number>(undefined);
  const nextRef = useRef<HTMLButtonElement>(null);
  const returnRef = useRef<HTMLElement | null>(null);
  const hydrated = useHydrated();
  const reduce = useReducedMotion();
  const titleId = useId();

  const count = steps.length;
  const index = Math.min(Math.max(rawStep, 0), Math.max(count - 1, 0));
  const current = steps[index];
  const last = index === count - 1;
  const text = { next: "Next", back: "Back", done: "Done", skip: "Skip tour", ...labels };

  // Remember what had focus before the tour, to hand it back at the end.
  useEffect(() => {
    if (!open) return;
    returnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [open]);
  useEffect(() => () => window.clearTimeout(moveTimer.current), []);

  // Back leaves on the first step and Skip on the last. If focus was on one of them,
  // hand it to Next instead of letting it fall to the card or the page.
  useEffect(() => {
    const active = document.activeElement;
    const popup = nextRef.current?.closest("[role=dialog]");
    if (open && popup && (active === popup || active === document.body)) nextRef.current?.focus();
  }, [index, open]);

  // Bring the target into view before the cutout lands on it.
  useEffect(() => {
    if (!open) return;
    const el = resolve(current?.target, container);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const box = container?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight };
    if (r.top < box.top + 16 || r.bottom > box.bottom - 16) el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [open, index, current, container, reduce]);

  // A fresh virtual anchor per step makes the positioner re-measure; its rect is
  // read lazily from the live target, so it follows scrolling and resizing.
  const anchor = useMemo(() => {
    const target = current?.target;
    return {
      getBoundingClientRect: () => {
        const el = resolve(target, container);
        if (el) return el.getBoundingClientRect();
        const box = container?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
        return new DOMRect(box.left + box.width / 2, box.top + box.height / 2, 0, 0);
      },
      get contextElement() {
        return resolve(target, container) ?? container ?? undefined;
      },
    };
  }, [current, container]);

  const finish = (reason: TourFinishReason) => {
    setOpen(false);
    onFinish?.(reason);
  };

  const go = (to: number, via: "pointer" | "key") => {
    if (to < 0) return;
    if (to >= count) return finish("completed");
    window.clearTimeout(moveTimer.current);
    // Arrow keys are shortcuts: the new step lands on the same frame. Buttons glide.
    const glide = via === "pointer" && !reduce;
    setInstant(!glide);
    setMoving(glide);
    if (glide) moveTimer.current = window.setTimeout(() => setMoving(false), 460);
    setStep(to);
  };

  if (!hydrated || !current) return null;
  const centered = !current.target;
  const pad = current.padding ?? 6;

  return (
    <>
      {createPortal(
        <AnimatePresence>
          {open && (
            <Spotlight
              key="spotlight"
              getTarget={() => resolve(current.target, container)}
              stepKey={index}
              instant={instant}
              contained={!!container}
              container={container}
              padding={pad}
              radius={current.radius ?? 10}
              className={className}
            />
          )}
        </AnimatePresence>,
        container ?? document.body,
      )}
      <Popover.Root
        open={open}
        modal={false}
        onOpenChange={(next, details) => {
          if (next) return setOpen(true);
          // Only an explicit choice ends the tour: Escape counts as Skip, a stray click outside does not.
          if (details.reason === "escape-key") return finish("skipped");
          details.cancel();
        }}
      >
        <Popover.Portal container={container ?? undefined}>
          <Popover.Positioner
            anchor={anchor}
            side={centered ? "bottom" : (current.side ?? "bottom")}
            align={current.align ?? "center"}
            sideOffset={centered ? ({ positioner }) => -positioner.height / 2 : pad + 10}
            collisionPadding={12}
            arrowPadding={16}
            data-moving={moving ? "" : undefined}
            className={cn(
              "z-(--z-popover)",
              // While travelling between targets the card glides with the cutout; otherwise it tracks scroll exactly.
              "data-moving:transition-transform data-moving:duration-[420ms] data-moving:ease-in-out-quart",
            )}
          >
            <Popover.Popup
              initialFocus={nextRef}
              finalFocus={returnRef}
              aria-labelledby={titleId}
              onKeyDown={(e) => {
                // Tab cycles inside the card: the tour holds focus until it's finished or skipped.
                if (e.key === "Tab") {
                  const items = [...e.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input, [tabindex]:not([tabindex='-1'])")];
                  const at = items.indexOf(document.activeElement as HTMLElement);
                  const to = e.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : at === items.length - 1 ? 0 : at + 1;
                  if (items[to]) {
                    e.preventDefault();
                    items[to].focus();
                  }
                  return;
                }
                if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  go(index + 1, "key");
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  go(index - 1, "key");
                }
              }}
              className={cn(
                "relative w-[300px] max-w-[var(--available-width)] rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
                "origin-[var(--transform-origin)] transition-[opacity,scale,filter] duration-[240ms] ease-out-expo",
                "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-starting-style:blur-[2px]",
                "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:ease-out-quart",
                "data-instant:transition-none",
                "motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:blur-none motion-reduce:data-ending-style:scale-100",
              )}
            >
              {!centered && <TourArrow moving={moving} />}
              <AutoHeight instant={instant || !!reduce}>
                <div className="p-4 pb-3.5">
                  <div className="mb-1.5 flex h-5 items-center justify-between gap-3">
                    <p className="tabular text-[11px] tracking-[0.02em] text-fg-3">
                      {index + 1} of {count}
                    </p>
                    {!last && (
                      <button
                        type="button"
                        onClick={() => finish("skipped")}
                        className={cn(
                          "relative -mr-1.5 inline-flex h-6 items-center rounded-md px-1.5 text-[12px] text-fg-3 outline-none",
                          "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.96] active:duration-75",
                          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                          "before:absolute before:-inset-2.5 before:content-[''] pointer-fine:before:hidden",
                        )}
                      >
                        {text.skip}
                      </button>
                    )}
                  </div>
                  {/* The words change with the step; the card around them stays put and resizes smoothly. */}
                  <motion.div
                    key={index}
                    aria-live="polite"
                    initial={instant || reduce ? false : { opacity: 0, filter: "blur(2px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    transition={{ duration: 0.26, ease: ease.out, delay: 0.08 }}
                  >
                    <Popover.Title id={titleId} className="text-[14px] font-medium leading-[1.3] tracking-[-0.015em] text-fg text-balance">
                      {current.title}
                    </Popover.Title>
                    {current.content && (
                      <Popover.Description className="mt-1 text-[12.5px] leading-[1.5] text-fg-2 text-pretty">{current.content}</Popover.Description>
                    )}
                  </motion.div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <Dots count={count} index={index} />
                    <div className="flex items-center gap-1.5">
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => go(index - 1, "pointer")} className={cn(button, "border border-line-2 bg-raised text-fg hover:border-fg-4 hover:bg-hover")}>
                          {text.back}
                        </button>
                      )}
                      <button ref={nextRef} type="button" onClick={() => go(index + 1, "pointer")} className={cn(button, "bg-fg text-frame hover:bg-fg/90")}>
                        {/* Next and Done share a cell so the button never changes width on the last step. */}
                        <span className="grid">
                          <span aria-hidden className="invisible col-start-1 row-start-1">{text.next}</span>
                          <span aria-hidden className="invisible col-start-1 row-start-1">{text.done}</span>
                          <span className="col-start-1 row-start-1">{last ? text.done : text.next}</span>
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </AutoHeight>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}

const button = cn(
  "inline-flex h-7 shrink-0 items-center justify-center rounded-md px-2.5 text-[12px] font-medium shadow-[var(--shadow)] outline-none",
  "transition-[background-color,border-color,scale] duration-150 active:scale-[0.97] active:duration-75",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
);

// The active dot stretches into a pill; passed steps stay a step brighter than the ones ahead.
function Dots({ count, index }: { count: number; index: number }) {
  return (
    <div aria-hidden className="flex items-center gap-1">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-[width,background-color] duration-300 ease-in-out-quart",
            i === index ? "w-4 bg-fg" : i < index ? "w-1.5 bg-fg-3" : "w-1.5 bg-fg-4",
          )}
        />
      ))}
    </div>
  );
}

// Animates the card's height when a step has more or fewer words than the last.
function AutoHeight({ children, instant }: { children: React.ReactNode; instant: boolean }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize[0]?.blockSize ?? el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <motion.div
      initial={false}
      animate={{ height }}
      transition={instant ? { duration: 0 } : { duration: 0.32, ease: ease.inOut }}
      className="overflow-hidden rounded-[inherit]"
    >
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

function TourArrow({ moving }: { moving: boolean }) {
  return (
    <Popover.Arrow
      className={cn(
        "pointer-events-none z-[1] flex h-2.5 w-5",
        moving && "transition-[left,top] duration-[420ms] ease-in-out-quart",
        "data-[side=bottom]:-top-[9px]",
        "data-[side=top]:-bottom-[9px] data-[side=top]:rotate-180",
        "data-[side=left]:-right-3.5 data-[side=left]:rotate-90",
        "data-[side=right]:-left-3.5 data-[side=right]:-rotate-90",
      )}
    >
      <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden className="block overflow-visible">
        <path d="M0 10c3.6 0 5.7-1.4 7.4-5.2L8.2 3c.8-1.6 2.8-1.6 3.6 0l.8 1.8c1.7 3.8 3.8 5.2 7.4 5.2z" className="fill-raised" />
        <path d="M0 10c3.6 0 5.7-1.4 7.4-5.2L8.2 3c.8-1.6 2.8-1.6 3.6 0l.8 1.8c1.7 3.8 3.8 5.2 7.4 5.2" className="stroke-line-2" vectorEffect="non-scaling-stroke" />
      </svg>
    </Popover.Arrow>
  );
}

type Box = { x: number; y: number; w: number; h: number; r: number };

/**
 * The dimmed layer with a hole over the target. Its rect is re-read from the
 * live target every frame, and on a step change it blends from where it was to
 * where the new target is, so it lands correctly even if the page scrolls mid-move.
 */
function Spotlight({
  getTarget,
  stepKey,
  instant,
  contained,
  container,
  padding,
  radius,
  className,
}: {
  getTarget: () => HTMLElement | null;
  stepKey: number;
  instant: boolean;
  contained: boolean;
  container?: HTMLElement | null;
  padding: number;
  radius: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const w = useMotionValue(0);
  const h = useMotionValue(0);
  const r = useMotionValue(radius);
  const W = useMotionValue(0);
  const H = useMotionValue(0);
  const progress = useMotionValue(1);
  const from = useRef<Box | null>(null);
  const live = useRef({ getTarget, padding, radius });
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    live.current = { getTarget, padding, radius };
  });

  useEffect(() => {
    // The first step appears in place; later ones travel from the current cutout.
    const first = from.current === null;
    from.current = { x: x.get(), y: y.get(), w: w.get(), h: h.get(), r: r.get() };
    if (first || instant || reduce) return progress.set(1);
    progress.set(0);
    const controls = animate(progress, 1, { duration: 0.42, ease: ease.inOut });
    return () => controls.stop();
  }, [stepKey, instant, reduce, progress, x, y, w, h, r]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const { getTarget, padding, radius } = live.current;
      const box = container?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
      W.set(box.width);
      H.set(box.height);
      const el = getTarget();
      const rect = el?.getBoundingClientRect();
      const to: Box = rect
        ? { x: rect.left - box.left - padding, y: rect.top - box.top - padding, w: rect.width + padding * 2, h: rect.height + padding * 2, r: radius }
        : { x: box.width / 2, y: box.height / 2, w: 0, h: 0, r: 0 };
      const f = from.current ?? to;
      const p = progress.get();
      const mix = (a: number, b: number) => a + (b - a) * p;
      x.set(mix(f.x, to.x));
      y.set(mix(f.y, to.y));
      w.set(mix(f.w, to.w));
      h.set(mix(f.h, to.h));
      r.set(mix(f.r, to.r));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [container, progress, x, y, w, h, r, W, H]);

  // Outer rectangle, then the rounded hole; evenodd leaves the hole unpainted, so the target stays clickable.
  const d = useTransform(() => {
    const [X, Y, Wd, Ht] = [x.get(), y.get(), Math.max(w.get(), 0), Math.max(h.get(), 0)];
    const R = Math.min(r.get(), Wd / 2, Ht / 2);
    const outer = `M0 0H${W.get()}V${H.get()}H0Z`;
    if (Wd === 0 || Ht === 0) return outer;
    return `${outer}M${X + R} ${Y}H${X + Wd - R}A${R} ${R} 0 0 1 ${X + Wd} ${Y + R}V${Y + Ht - R}A${R} ${R} 0 0 1 ${X + Wd - R} ${Y + Ht}H${X + R}A${R} ${R} 0 0 1 ${X} ${Y + Ht - R}V${Y + R}A${R} ${R} 0 0 1 ${X + R} ${Y}Z`;
  });
  const ringW = useTransform(() => Math.max(w.get(), 0));
  const ringH = useTransform(() => Math.max(h.get(), 0));

  return (
    <motion.svg
      aria-hidden
      data-tour-overlay=""
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.16, ease: ease.out } }}
      transition={{ duration: reduce ? 0.12 : 0.24, ease: ease.out }}
      className={cn(contained ? "absolute" : "fixed", "inset-0 z-(--z-overlay) h-full w-full overflow-visible", className)}
    >
      {/* A click on the dim layer doesn't end the tour; the ring pings to say where to look. */}
      <motion.path d={d} fillRule="evenodd" className="fill-overlay" onPointerDown={() => setPulse((p) => p + 1)} />
      <motion.rect x={x} y={y} width={ringW} height={ringH} rx={r} className="pointer-events-none fill-none stroke-fg/25" strokeWidth={1} />
      {pulse > 0 && !reduce && (
        <motion.rect
          key={pulse}
          x={x}
          y={y}
          width={ringW}
          height={ringH}
          rx={r}
          className="pointer-events-none fill-none stroke-fg"
          strokeWidth={1.5}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
          initial={{ opacity: 0.7, scale: 1 }}
          animate={{ opacity: 0, scale: 1.14 }}
          transition={{ duration: 0.6, ease: ease.out }}
        />
      )}
    </motion.svg>
  );
}
