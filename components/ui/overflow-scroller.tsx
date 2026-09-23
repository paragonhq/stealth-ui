"use client";
import { animate, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { spring } from "@/lib/motion";

/**
 * Whether a horizontal scroller has more content before or after what is in
 * view. Re-measures on scroll, resize and when the content changes size.
 */
export function useScrollEdges(ref: React.RefObject<HTMLElement | null>) {
  const [edges, setEdges] = useState({ start: false, end: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const read = () => {
      const max = el.scrollWidth - el.clientWidth;
      const next = { start: el.scrollLeft > 1, end: el.scrollLeft < max - 1 };
      setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(read);
    };
    const ro = new ResizeObserver(onScroll);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    el.addEventListener("scroll", onScroll, { passive: true });
    read();
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
    };
  }, [ref]);
  return edges;
}

export type OverflowScrollerProps = Omit<React.ComponentProps<"div">, "children"> & {
  children: React.ReactNode;
  /** Names the list for screen readers, e.g. "Filters". */
  label?: string;
  /** Width of the edge fade in px. The arrows sit inside it. */
  fade?: number;
  /** Arrow buttons for pointers that can't swipe. "none" keeps only the fades. */
  controls?: "arrows" | "none";
  size?: "sm" | "md";
  /** On mount, bring the selected item (aria-pressed, aria-selected, aria-current or data-active) into view. */
  revealActive?: boolean;
  /** Class for the inner row that holds the items (gap, padding, alignment). */
  trackClassName?: string;
};

const MASK =
  "linear-gradient(to right, transparent calc(var(--fade-start, 0px) * 0.55), var(--fg) var(--fade-start, 0px), var(--fg) calc(100% - var(--fade-end, 0px)), transparent calc(100% - var(--fade-end, 0px) * 0.55))";

export function OverflowScroller({
  children,
  label,
  fade = 56,
  controls = "arrows",
  size = "md",
  revealActive = true,
  trackClassName,
  className,
  ...rest
}: OverflowScrollerProps) {
  const reduce = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const glide = useRef<AnimationPlaybackControls | null>(null);
  const target = useRef<number | null>(null);
  const edges = useScrollEdges(scroller);
  const id = useId();

  // The fades grow with the distance from each end instead of popping in, so
  // the first pixel of scroll starts a 1px fade, not a 40px one.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const paint = () => {
      const max = el.scrollWidth - el.clientWidth;
      el.style.setProperty("--fade-start", `${Math.min(fade, Math.max(0, el.scrollLeft))}px`);
      el.style.setProperty("--fade-end", `${Math.min(fade, Math.max(0, max - el.scrollLeft))}px`);
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(paint);
    };
    const stop = () => {
      glide.current?.stop();
      glide.current = null;
      target.current = null;
    };
    const ro = new ResizeObserver(onScroll);
    ro.observe(el);
    if (track.current) ro.observe(track.current);
    el.addEventListener("scroll", onScroll, { passive: true });
    // A hand on the scroller takes over from a glide in flight.
    el.addEventListener("wheel", stop, { passive: true });
    el.addEventListener("touchstart", stop, { passive: true });
    el.addEventListener("pointerdown", stop);
    paint();
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", stop);
      el.removeEventListener("touchstart", stop);
      el.removeEventListener("pointerdown", stop);
      glide.current?.stop();
    };
  }, [fade]);

  // The selected chip might start off screen: center it once, without motion.
  useEffect(() => {
    const el = scroller.current;
    if (!revealActive || !el) return;
    const active = el.querySelector<HTMLElement>('[aria-pressed="true"], [aria-selected="true"], [aria-current]:not([aria-current="false"]), [data-active]');
    if (!active) return;
    const left = active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2;
    el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, left));
    // Mount only: later selections were made by the person looking at them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollTo = useCallback(
    (to: number) => {
      const el = scroller.current;
      if (!el) return;
      const left = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, to));
      glide.current?.stop();
      if (reduce) {
        el.scrollLeft = left;
        return;
      }
      target.current = left;
      glide.current = animate(el.scrollLeft, left, {
        ...spring.sheet,
        restDelta: 0.5,
        onUpdate: (v) => (el.scrollLeft = v),
        onComplete: () => {
          glide.current = null;
          target.current = null;
        },
      });
    },
    [reduce],
  );

  // Page-wise, landing on an item boundary: the first item cut off at the far
  // edge becomes the first fully visible one, so nothing is skipped and no
  // chip starts the new page sliced in half.
  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    const row = track.current;
    if (!el || !row) return;
    const x = target.current ?? el.scrollLeft;
    const width = el.clientWidth;
    const items = Array.from(row.children) as HTMLElement[];
    const inset = fade;
    let to: number | null = null;
    if (dir > 0) {
      const edge = x + width - inset;
      const cut = items.find((it) => it.offsetLeft + it.offsetWidth > edge + 1);
      if (cut) to = cut.offsetLeft - inset;
    } else {
      const edge = x + inset;
      const cut = items.findLast((it) => it.offsetLeft < edge - 1);
      if (cut) to = cut.offsetLeft + cut.offsetWidth - width + inset;
    }
    // One item wider than the view, or nothing cut: fall back to 80% of a page.
    if (to === null || (dir > 0 ? to <= x + 8 : to >= x - 8)) to = x + dir * width * 0.8;
    scrollTo(to);
  };

  const hasArrows = controls === "arrows";

  return (
    <div
      role={label ? "group" : undefined}
      aria-label={label}
      data-size={size}
      data-overflow-start={edges.start || undefined}
      data-overflow-end={edges.end || undefined}
      className={cn("group/os relative min-w-0", className)}
      {...rest}
    >
      <div
        ref={scroller}
        id={id}
        // Keyboard focus lands clear of the fades, instantly.
        onFocus={(e) => {
          if (e.target !== e.currentTarget && !e.currentTarget.matches(":active")) (e.target as HTMLElement).scrollIntoView({ block: "nearest", inline: "nearest" });
        }}
        // Pressing an item that's half under a fade glides it fully into view.
        onClick={(e) => {
          const el = scroller.current;
          const item = (e.target as HTMLElement).closest<HTMLElement>("[data-os-track] > *");
          if (!el || !item || !track.current?.contains(item)) return;
          const x = el.scrollLeft;
          if (item.offsetLeft < x + fade) scrollTo(item.offsetLeft - fade);
          else if (item.offsetLeft + item.offsetWidth > x + el.clientWidth - fade) scrollTo(item.offsetLeft + item.offsetWidth - el.clientWidth + fade);
        }}
        // The 4px bleed on every side gives focus rings and shadows room inside the clip.
        className="relative -m-1 overflow-x-auto overscroll-x-contain p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        // The first 55% of each fade is fully clear, so nothing reads through under the arrow.
        style={
          {
            scrollPaddingInline: fade,
            maskImage: MASK,
            WebkitMaskImage: MASK,
          } as React.CSSProperties
        }
      >
        <div ref={track} data-os-track="" className={cn("flex w-max min-w-full items-center gap-1.5", trackClassName)}>
          {children}
        </div>
      </div>

      {hasArrows && (
        <>
          <Arrow side="start" size={size} shown={edges.start} controls={id} onPress={() => page(-1)} />
          <Arrow side="end" size={size} shown={edges.end} controls={id} onPress={() => page(1)} />
        </>
      )}
    </div>
  );
}

function Arrow({ side, size, shown, controls, onPress }: { side: "start" | "end"; size: "sm" | "md"; shown: boolean; controls: string; onPress: () => void }) {
  const Icon = side === "start" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      // Out of the tab order: keyboard users move through the items themselves,
      // and focus scrolls them into view. The arrows are for mice.
      tabIndex={-1}
      aria-label={side === "start" ? "Scroll back" : "Scroll forward"}
      aria-controls={controls}
      aria-hidden={!shown || undefined}
      data-shown={shown || undefined}
      onClick={onPress}
      className={cn(
        "group/arrow absolute top-1/2 grid place-items-center rounded-full border border-line-2 bg-raised text-fg-2 shadow-[var(--shadow)] outline-none",
        "transition-[opacity,translate,scale,background-color,border-color,color] duration-200 ease-out-expo hover:border-fg-4 hover:bg-hover hover:text-fg",
        "active:scale-[0.92] active:duration-75 data-shown:active:scale-[0.92]",
        // Hidden: faded, shrunk and tucked 4px towards its edge; shown: in place.
        "pointer-events-none -translate-y-1/2 scale-90 opacity-0 data-shown:pointer-events-auto data-shown:scale-100 data-shown:opacity-100",
        "pointer-coarse:hidden",
        size === "sm" ? "size-6" : "size-7",
        side === "start" ? "left-0 -translate-x-1 data-shown:translate-x-0" : "right-0 translate-x-1 data-shown:translate-x-0",
      )}
    >
      <Icon
        size={size === "sm" ? 12 : 14}
        className={cn("transition-transform duration-200 ease-out-expo", side === "start" ? "group-hover/arrow:-translate-x-px" : "group-hover/arrow:translate-x-px")}
      />
    </button>
  );
}
