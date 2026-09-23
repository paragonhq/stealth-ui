"use client";
import NumberFlow from "@number-flow/react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls, type MotionValue } from "motion/react";
import { createContext, use, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { spring } from "@/lib/motion";

type Nav = "button" | "key" | "dot" | "drag";

type Ctx = {
  viewport: React.RefObject<HTMLDivElement | null>;
  track: React.RefObject<HTMLDivElement | null>;
  count: number;
  active: number;
  atStart: boolean;
  atEnd: boolean;
  dragging: boolean;
  /** Continuous page position: 1.5 is halfway between the second and third page. */
  progress: MotionValue<number>;
  go: (page: number, via: Nav) => void;
  step: (dir: 1 | -1, via: Nav) => void;
  label: string;
  viewportId: string;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onClickCapture: (e: React.MouseEvent<HTMLDivElement>) => void;
  reveal: (slide: HTMLElement) => void;
};

const CarouselContext = createContext<Ctx | null>(null);
function useCarousel(part: string) {
  const ctx = use(CarouselContext);
  if (!ctx) throw new Error(`<${part}> must be inside <SnapCarousel>`);
  return ctx;
}

/** Scroll offsets the viewport can rest at, one per page, measured from the slides. */
function measurePages(viewport: HTMLElement) {
  const max = viewport.scrollWidth - viewport.clientWidth;
  const pad = parseFloat(getComputedStyle(viewport).scrollPaddingInlineStart) || 0;
  const pages: number[] = [];
  for (const slide of viewport.querySelectorAll<HTMLElement>("[data-carousel-slide]")) {
    const at = Math.max(0, Math.min(max, slide.offsetLeft - pad));
    // Slides near the end all clamp to the last offset; they share one page.
    if (!pages.length || at - pages[pages.length - 1] > 2) pages.push(at);
  }
  if (!pages.length) pages.push(0);
  return { pages, max };
}

export type SnapCarouselProps = React.ComponentProps<"section"> & {
  /** Names the carousel for screen readers, e.g. "Templates". */
  label: string;
  /** Controlled page index (a page is one resting position, which may show several slides). */
  page?: number;
  defaultPage?: number;
  onPageChange?: (page: number) => void;
  /** Click-and-drag with a mouse. Touch and trackpads always scroll natively. */
  draggable?: boolean;
};

/**
 * Root. Size slides and spacing with CSS variables on it:
 * --slide-size (default 100%), --slide-gap (12px), --gutter (0px, inset at both ends).
 */
export function SnapCarousel({ label, page, defaultPage = 0, onPageChange, draggable = true, className, children, ...rest }: SnapCarouselProps) {
  const reduce = useReducedMotion();
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const progress = useMotionValue(defaultPage);
  const [count, setCount] = useState(1);
  const [active, setActive] = useState(defaultPage);
  const [edges, setEdges] = useState({ start: defaultPage === 0, end: false });
  const [dragging, setDragging] = useState(false);
  const [announce, setAnnounce] = useState("");
  const viewportId = useId();

  const pagesRef = useRef<number[]>([0]);
  const glide = useRef<AnimationPlaybackControls | null>(null);
  const drag = useRef<{ id: number; x: number; left: number; moved: boolean; t: number; v: number; last: number } | null>(null);
  const activeRef = useRef(defaultPage);
  const onChangeRef = useRef(onPageChange);
  useEffect(() => {
    onChangeRef.current = onPageChange;
  });

  // Reads the scroll position once per frame: the dots and counter follow it
  // continuously, React only hears about it when the page actually changes.
  const sync = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    const pages = pagesRef.current;
    const x = el.scrollLeft;
    let p = pages.length - 1;
    for (let i = 0; i < pages.length - 1; i++) {
      if (x < pages[i + 1]) {
        p = i + Math.max(0, (x - pages[i]) / (pages[i + 1] - pages[i] || 1));
        break;
      }
    }
    progress.set(p);
    const nearest = Math.round(p);
    if (nearest !== activeRef.current) {
      activeRef.current = nearest;
      setActive(nearest);
      onChangeRef.current?.(nearest);
    }
    const max = el.scrollWidth - el.clientWidth;
    setEdges((prev) => {
      const next = { start: x <= 1, end: x >= max - 1 };
      return prev.start === next.start && prev.end === next.end ? prev : next;
    });
  }, [progress]);

  const measure = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    pagesRef.current = measurePages(el).pages;
    setCount(pagesRef.current.length);
    sync();
  }, [sync]);

  const stopGlide = () => {
    glide.current?.stop();
    glide.current = null;
    viewport.current?.removeAttribute("data-gliding");
  };

  // Scroll to an offset on a spring. Snapping is paused while it runs, or the
  // browser would re-snap every frame and fight it. Reduced motion jumps.
  const scrollToX = useCallback(
    (target: number, velocity = 0, done?: () => void) => {
      const el = viewport.current;
      if (!el) return;
      glide.current?.stop();
      if (reduce) {
        el.scrollLeft = target;
        done?.();
        return;
      }
      el.setAttribute("data-gliding", "");
      glide.current = animate(el.scrollLeft, target, {
        ...spring.sheet,
        velocity,
        restDelta: 0.5,
        onUpdate: (v) => (el.scrollLeft = v),
        onComplete: () => {
          el.removeAttribute("data-gliding");
          glide.current = null;
          done?.();
        },
      });
    },
    [reduce],
  );

  // Where a glide is heading, so pressing Next three times fast moves three pages.
  const target = useRef(defaultPage);
  const go = useCallback(
    (to: number, via: Nav) => {
      const pages = pagesRef.current;
      const i = Math.max(0, Math.min(pages.length - 1, to));
      target.current = i;
      // Settled: tell screen readers where they landed, once.
      scrollToX(pages[i], 0, () => setAnnounce(via === "drag" ? "" : `Page ${i + 1} of ${pages.length}`));
    },
    [scrollToX],
  );

  // Next/previous from wherever the scroll is now, even mid-swipe between pages.
  const step = useCallback(
    (dir: 1 | -1, via: Nav) => {
      const el = viewport.current;
      if (!el) return;
      const pages = pagesRef.current;
      const x = glide.current ? pages[target.current] : el.scrollLeft;
      const i = dir > 0 ? pages.findIndex((p) => p > x + 2) : pages.findLastIndex((p) => p < x - 2);
      if (i >= 0) go(i, via);
    },
    [go],
  );

  // Tabbing into a slide that is cut off at an edge moves to the page that
  // shows all of it. Keyboard-driven, so it jumps rather than glides.
  const reveal = useCallback((slide: HTMLElement) => {
    const el = viewport.current;
    if (!el || drag.current) return;
    const pad = parseFloat(getComputedStyle(el).scrollPaddingInlineStart) || 0;
    const start = slide.offsetLeft - pad;
    const end = start + slide.offsetWidth;
    const x = el.scrollLeft;
    if (start >= x - 1 && end <= x + el.clientWidth - 2 * pad + 1) return;
    // The smallest move that shows all of it: forward to the first page whose
    // right edge clears it, or back to the last page that starts before it.
    const pages = pagesRef.current;
    const span = el.clientWidth - 2 * pad;
    let i = pages.length - 1;
    if (start < x) {
      i = 0;
      for (let k = 0; k < pages.length; k++) if (pages[k] <= start + 1) i = k;
    } else {
      const k = pages.findIndex((p) => p + span >= end - 1);
      if (k >= 0) i = k;
    }
    glide.current?.stop();
    glide.current = null;
    el.removeAttribute("data-gliding");
    target.current = i;
    el.scrollLeft = pages[i];
  }, []);

  // Controlled page: follow the prop when it changes from outside.
  useEffect(() => {
    if (page === undefined || page === activeRef.current) return;
    go(page, "button");
  }, [page, go]);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    if (defaultPage) {
      pagesRef.current = measurePages(el).pages;
      el.scrollLeft = pagesRef.current[Math.min(defaultPage, pagesRef.current.length - 1)];
    }
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };
    // Any hand on the scroller cancels a glide in flight.
    const interrupt = () => stopGlide();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    if (track.current) ro.observe(track.current);
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", interrupt, { passive: true });
    el.addEventListener("touchstart", interrupt, { passive: true });
    measure();
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", interrupt);
      el.removeEventListener("touchstart", interrupt);
      glide.current?.stop();
    };
    // Mount-only: defaultPage is an initial value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, sync]);

  // Mouse drag. Nothing happens until the pointer travels 5px, so clicks on
  // links inside slides still work. Past either end the track rubber-bands.
  const suppressClick = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = viewport.current;
    if (!draggable || !el || e.pointerType !== "mouse" || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable], [data-carousel-nodrag]")) return;
    stopGlide();
    drag.current = { id: e.pointerId, x: e.clientX, left: el.scrollLeft, moved: false, t: e.timeStamp, v: 0, last: e.clientX };

    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d || ev.pointerId !== d.id) return;
      const dx = ev.clientX - d.x;
      if (!d.moved) {
        if (Math.abs(dx) < 5) return;
        d.moved = true;
        el.setPointerCapture(d.id);
        el.setAttribute("data-dragging", "");
        setDragging(true);
      }
      const dt = Math.max(1, ev.timeStamp - d.t);
      d.v = 0.8 * ((ev.clientX - d.last) / dt) * 1000 + 0.2 * d.v;
      d.t = ev.timeStamp;
      d.last = ev.clientX;
      const max = el.scrollWidth - el.clientWidth;
      const want = d.left - dx;
      el.scrollLeft = want;
      // Rubber band: the overshoot moves the track at a third of the pointer's speed.
      const over = want < 0 ? want : want > max ? want - max : 0;
      if (track.current) track.current.style.transform = over ? `translateX(${-over * 0.3}px)` : "";
    };

    const up = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d || ev.pointerId !== d.id) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      drag.current = null;
      if (!d.moved) return;
      suppressClick.current = true;
      el.removeAttribute("data-dragging");
      setDragging(false);
      const t = track.current;
      if (t?.style.transform) {
        const from = parseFloat(t.style.transform.slice(11)) || 0;
        if (reduce) t.style.transform = "";
        else animate(from, 0, { ...spring.snappy, onUpdate: (v) => (t.style.transform = v ? `translateX(${v}px)` : "") });
      }
      // Project where the throw would land, then settle on the nearest page.
      const pages = pagesRef.current;
      const velocity = ev.type === "pointercancel" || ev.timeStamp - d.t > 80 ? 0 : d.v;
      const projected = el.scrollLeft - velocity * 0.2;
      let best = 0;
      for (let i = 1; i < pages.length; i++) if (Math.abs(pages[i] - projected) < Math.abs(pages[best] - projected)) best = i;
      // A flick always moves at least one page in the direction thrown.
      const from = activeRef.current;
      if (Math.abs(velocity) > 300 && best === from) best = Math.max(0, Math.min(pages.length - 1, from + (velocity < 0 ? 1 : -1)));
      target.current = best;
      scrollToX(pages[best], -velocity);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  // A drag that ends over a link must not also follow it.
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const ctx = useMemo<Ctx>(
    () => ({ viewport, track, count, active, atStart: edges.start, atEnd: edges.end, dragging, progress, go, step, label, viewportId, onPointerDown, onClickCapture, reveal }),
    // onPointerDown and onClickCapture only read refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, active, edges, dragging, progress, go, step, label, viewportId, reveal],
  );

  return (
    <CarouselContext value={ctx}>
      <section aria-roledescription="carousel" aria-label={label} data-dragging={dragging || undefined} className={cn("relative min-w-0", className)} {...rest}>
        {children}
        <span role="status" aria-live="polite" className="sr-only">
          {announce}
        </span>
      </section>
    </CarouselContext>
  );
}

export type SnapCarouselViewportProps = React.ComponentProps<"div">;

/** The scroll container. Holds the slides. */
export function SnapCarouselViewport({ className, children, onKeyDown, onFocus, ...rest }: SnapCarouselViewportProps) {
  const { viewport, track, step, go, count, viewportId, onPointerDown, onClickCapture, label, reveal } = useCarousel("SnapCarouselViewport");
  return (
    <div
      ref={viewport}
      id={viewportId}
      tabIndex={0}
      role="group"
      aria-label={`${label} slides`}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
      onDragStart={(e) => e.preventDefault()}
      onFocus={(e) => {
        onFocus?.(e);
        const slide = (e.target as HTMLElement).closest<HTMLElement>("[data-carousel-slide]");
        if (slide && e.target !== e.currentTarget) reveal(slide);
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented || e.target !== e.currentTarget || e.altKey || e.metaKey || e.ctrlKey) return;
        const map: Record<string, () => void> = {
          ArrowRight: () => step(1, "key"),
          ArrowLeft: () => step(-1, "key"),
          Home: () => go(0, "key"),
          End: () => go(count - 1, "key"),
        };
        if (!map[e.key]) return;
        e.preventDefault();
        map[e.key]();
      }}
      className={cn(
        "relative flex overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "snap-x snap-mandatory scroll-px-[var(--gutter,0px)] data-dragging:snap-none data-gliding:snap-none",
        "pointer-fine:cursor-grab data-dragging:cursor-grabbing data-dragging:select-none",
        "rounded-xl outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        className,
      )}
      {...rest}
    >
      <div ref={track} className="flex shrink-0 gap-[var(--slide-gap,12px)] px-[var(--gutter,0px)] will-change-auto" style={{ minWidth: "100%" }}>
        {children}
      </div>
    </div>
  );
}

export type SnapCarouselSlideProps = React.ComponentProps<"div">;

export function SnapCarouselSlide({ className, children, ...rest }: SnapCarouselSlideProps) {
  return (
    <div
      data-carousel-slide
      role="group"
      aria-roledescription="slide"
      className={cn("w-[var(--slide-size,100%)] min-w-0 shrink-0 snap-start snap-always", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

type ArrowProps = Omit<React.ComponentProps<"button">, "children"> & { size?: "sm" | "md"; children?: React.ReactNode };

function Arrow({ towards: dir, size = "md", className, onClick, children, ...rest }: ArrowProps & { towards: 1 | -1 }) {
  const { step, atStart, atEnd, viewportId } = useCarousel(dir > 0 ? "SnapCarouselNext" : "SnapCarouselPrevious");
  const off = dir > 0 ? atEnd : atStart;
  const Icon = dir > 0 ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      aria-controls={viewportId}
      aria-label={dir > 0 ? "Next page" : "Previous page"}
      // aria-disabled, not disabled: keyboard focus stays on the button when it reaches the end.
      aria-disabled={off || undefined}
      data-size={size}
      onClick={(e) => {
        onClick?.(e);
        if (!off && !e.defaultPrevented) step(dir, "button");
      }}
      className={cn(
        "group/arrow relative grid shrink-0 place-items-center rounded-full border border-line-2 bg-raised text-fg shadow-[var(--shadow)]",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color,border-color,color,opacity,scale] duration-150 ease-out active:scale-[0.92] active:duration-75",
        "hover:border-fg-4 hover:bg-hover",
        "aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:shadow-none aria-disabled:hover:border-line-2 aria-disabled:hover:bg-raised aria-disabled:active:scale-100",
        "before:absolute before:-inset-1.5 before:content-[''] pointer-coarse:before:-inset-2.5",
        size === "sm" ? "size-7" : "size-8",
        className,
      )}
      {...rest}
    >
      {children ?? (
        <Icon
          size={size === "sm" ? 14 : 16}
          className={cn(
            "transition-transform duration-200 ease-out-expo group-aria-disabled/arrow:translate-x-0!",
            dir > 0 ? "group-hover/arrow:translate-x-px" : "group-hover/arrow:-translate-x-px",
          )}
        />
      )}
    </button>
  );
}

export type SnapCarouselPreviousProps = ArrowProps;
export function SnapCarouselPrevious(props: SnapCarouselPreviousProps) {
  return <Arrow towards={-1} {...props} />;
}
export type SnapCarouselNextProps = ArrowProps;
export function SnapCarouselNext(props: SnapCarouselNextProps) {
  return <Arrow towards={1} {...props} />;
}

const DOT = 6;
const STEP = 14;

export type SnapCarouselDotsProps = React.ComponentProps<"div">;

/**
 * One dot per page. The indicator is tied to the scroll position itself, so
 * it travels with the finger and stretches across the gap between two pages.
 */
export function SnapCarouselDots({ className, ...rest }: SnapCarouselDotsProps) {
  const { count, active, go, progress, viewportId } = useCarousel("SnapCarouselDots");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // Between two pages the leading edge runs ahead to the next dot, then the
  // trailing edge catches up: at f = 0.5 the pill spans both dots.
  const frac = (p: number) => {
    const c = Math.max(0, Math.min(count - 1, p));
    return { k: Math.floor(c), f: c % 1 };
  };
  const tx = useTransform(progress, (p) => {
    const { k, f } = frac(p);
    return k * STEP + STEP * Math.max(0, f * 2 - 1);
  });
  const width = useTransform(progress, (p) => {
    const { f } = frac(p);
    return DOT + STEP * Math.min(1, f * 2) - STEP * Math.max(0, f * 2 - 1);
  });
  if (count < 2) return null;

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const to = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? count - 1 : null;
    if (to === null) return;
    e.preventDefault();
    const next = Math.max(0, Math.min(count - 1, to));
    refs.current[next]?.focus();
    go(next, "dot");
  };

  return (
    <div role="group" aria-label="Choose page" className={cn("flex items-center", className)} {...rest}>
      <div className="relative flex items-center">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          tabIndex={i === active ? 0 : -1}
          aria-label={`Page ${i + 1} of ${count}`}
          aria-current={i === active || undefined}
          aria-controls={viewportId}
          onClick={() => go(i, "dot")}
          onKeyDown={(e) => onKeyDown(e, i)}
          className={cn(
            "group/dot relative grid h-6 place-items-center outline-none",
            "before:absolute before:inset-x-0 before:-inset-y-2.5 before:content-[''] pointer-fine:before:hidden",
            "focus-visible:[&>span]:outline-solid focus-visible:[&>span]:outline-1 focus-visible:[&>span]:outline-offset-2 focus-visible:[&>span]:outline-fg-3",
          )}
          style={{ width: STEP }}
        >
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-fg-4 transition-[background-color,scale] duration-150 ease-out group-hover/dot:bg-fg-3 group-active/dot:scale-75"
          />
        </button>
      ))}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-fg"
        style={{ left: (STEP - DOT) / 2, x: tx, width }}
      />
      </div>
    </div>
  );
}

export type SnapCarouselCounterProps = Omit<React.ComponentProps<"span">, "children">;

/** "3 / 8", with the current page rolling rather than swapping. */
export function SnapCarouselCounter({ className, ...rest }: SnapCarouselCounterProps) {
  const { active, count } = useCarousel("SnapCarouselCounter");
  return (
    <span aria-hidden className={cn("inline-flex items-baseline gap-1 font-mono text-[11px] tabular text-fg-3", className)} {...rest}>
      <NumberFlow value={active + 1} className="text-fg" />
      <span className="text-fg-4">/</span>
      <span>{count}</span>
    </span>
  );
}

/** The carousel's state, for building your own controls inside <SnapCarousel>. */
export function useSnapCarousel() {
  const { active, count, atStart, atEnd, go, step, progress, dragging } = useCarousel("useSnapCarousel");
  return {
    page: active,
    pageCount: count,
    canPrevious: !atStart,
    canNext: !atEnd,
    dragging,
    progress,
    goTo: (page: number) => go(page, "button"),
    next: () => step(1, "button"),
    previous: () => step(-1, "button"),
  };
}
