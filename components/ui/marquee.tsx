"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

// Reduced motion changes the markup here (no repeats, a scrollable row), so it
// is read hydration-safely: the server and the hydrating render assume motion,
// then React re-renders with the real preference.
const query = "(prefers-reduced-motion: reduce)";
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export type MarqueeProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  orientation?: "horizontal" | "vertical";
  /** Pixels per second. The same speed whatever the content length. */
  speed?: number;
  /** Scroll right (or down) instead of left (or up). */
  reverse?: boolean;
  /** Space between items, and between the end of the content and its repeat, in px. */
  gap?: number;
  /** Length of the fade at each edge in px. 0 for hard edges. */
  fade?: number;
  /** Ease to a stop while a mouse is over it. It always stops while pressed or while focus is inside. */
  pauseOnHover?: boolean;
  /** Stop it from outside, for a visible pause control. It eases to a stop and back up. */
  paused?: boolean;
  ref?: React.Ref<HTMLDivElement>;
};

/**
 * A seamless, infinite row (or column) that eases to a stop under the pointer
 * instead of freezing mid-stride. It repeats its content only as many times as
 * the width needs, keeps the repeats out of the accessibility tree and the tab
 * order, and sleeps while off screen. With reduced motion it becomes a plain
 * scrollable row, so nothing is out of reach.
 */
export function Marquee({
  children,
  orientation = "horizontal",
  speed = 40,
  reverse = false,
  gap = 16,
  fade = 40,
  pauseOnHover = true,
  paused = false,
  className,
  style,
  ref,
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  onFocus,
  onBlur,
  ...rest
}: MarqueeProps) {
  const reduce = usePrefersReducedMotion();
  const vertical = orientation === "vertical";
  const self = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState(1);
  const [span, setSpan] = useState(0);

  /** How far in the loop starts: the fade plus a little air. */
  const lead = Math.max(0, fade) + 4;
  const anim = useRef<Animation | null>(null);
  const rate = useRef(1);
  const raf = useRef(0);
  const holds = useRef({ hover: false, press: false, focus: false, offscreen: false, paused });

  // Glide the playback rate toward 0 or 1 rather than stopping dead: an
  // exponential approach, about 350ms to rest and a little longer to get going.
  const steer = useCallback(() => {
    const a = anim.current;
    if (!a) return;
    const h = holds.current;
    cancelAnimationFrame(raf.current);
    if (h.offscreen) return a.pause();
    const target = h.paused || h.hover || h.press || h.focus ? 0 : 1;
    if (target === 1 && a.playState !== "running") a.play();
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      rate.current += (target - rate.current) * (1 - Math.exp(-dt / (target ? 200 : 110)));
      if (Math.abs(target - rate.current) < 0.004) rate.current = target;
      a.playbackRate = rate.current;
      if (rate.current === 0) return a.pause();
      if (rate.current !== target) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, []);

  const hold = useCallback(
    (key: "hover" | "press" | "focus" | "offscreen" | "paused", on: boolean) => {
      if (holds.current[key] === on) return;
      holds.current[key] = on;
      steer();
    },
    [steer],
  );

  useEffect(() => hold("paused", paused), [paused, hold]);

  // Tab onto an item sitting in the faded edge and the row jumps (no animation:
  // it's keyboard-driven) so the whole item is clear of the fade.
  const reveal = useCallback(
    (target: EventTarget) => {
      const a = anim.current;
      const root = self.current;
      const el = track.current;
      if (!a || !root || !el || !span || !(target instanceof HTMLElement) || !target.matches(":focus-visible")) return;
      // Keyboard focus stops it dead rather than gliding, so the item lands where it's put.
      cancelAnimationFrame(raf.current);
      rate.current = 0;
      a.playbackRate = 0;
      a.pause();
      const view = root.getBoundingClientRect();
      const box = target.getBoundingClientRect();
      const [start, end, size] = vertical ? [box.top - view.top, box.bottom - view.top, view.height] : [box.left - view.left, box.right - view.left, view.width];
      const shift = start < lead ? lead - start : end > size - lead ? size - lead - end : 0;
      if (!shift) return;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      const offset = (vertical ? matrix.m42 : matrix.m41) + shift;
      // The track runs from +lead to lead - span; find where in that loop this offset falls.
      const fraction = ((((lead - offset) / span) % 1) + 1) % 1;
      const duration = (span / speed) * 1000;
      a.currentTime = (reverse ? 1 - fraction : fraction) * duration;
    },
    [span, lead, vertical, speed, reverse],
  );

  // Measure one copy of the content and the viewport; repeat just enough to cover it.
  useEffect(() => {
    const root = self.current;
    const one = first.current;
    if (!root || !one || reduce) return;
    const ro = new ResizeObserver(() => {
      // Sub-pixel exact, or the loop would jump by the rounding at every wrap. Dividing
      // by the root's own drawn-vs-layout ratio cancels any scale on an ancestor.
      const box = root.getBoundingClientRect();
      const scale = (vertical ? box.height / root.offsetHeight : box.width / root.offsetWidth) || 1;
      const rect = one.getBoundingClientRect();
      const size = (vertical ? rect.height : rect.width) / scale;
      const view = vertical ? root.clientHeight : root.clientWidth;
      if (!size) return;
      setSpan(size + gap);
      setCopies(Math.max(1, Math.ceil(view / (size + gap))));
    });
    ro.observe(root);
    ro.observe(one);
    return () => ro.disconnect();
  }, [vertical, gap, reduce]);

  // One animation on the whole track, translating by exactly one copy plus a gap,
  // so the loop point is invisible. Rebuilt on resize, keeping its progress. The
  // loop starts `lead` px in, with an inert copy parked before the real items, so
  // any real item can be brought clear of the leading fade when it takes focus.
  useEffect(() => {
    const el = track.current;
    if (!el || !span || reduce) return;
    const axis = vertical ? "Y" : "X";
    const previous = anim.current;
    const progress = previous?.effect?.getComputedTiming().progress ?? 0;
    previous?.cancel();
    const duration = (span / speed) * 1000;
    const a = el.animate([{ transform: `translate${axis}(${lead}px)` }, { transform: `translate${axis}(${lead - span}px)` }], {
      duration,
      iterations: Infinity,
      direction: reverse ? "reverse" : "normal",
    });
    a.currentTime = (progress ?? 0) * duration;
    a.playbackRate = rate.current;
    anim.current = a;
    steer();
    return () => {
      cancelAnimationFrame(raf.current);
      a.cancel();
      if (anim.current === a) anim.current = null;
    };
  }, [span, lead, speed, reverse, vertical, reduce, steer]);

  // Nothing moves while nobody can see it.
  useEffect(() => {
    const root = self.current;
    if (!root || reduce) return;
    const io = new IntersectionObserver(([entry]) => hold("offscreen", !entry.isIntersecting));
    io.observe(root);
    return () => io.disconnect();
  }, [reduce, hold]);

  const group = cn("flex shrink-0", vertical ? "flex-col" : "flex-row items-center");
  const edge = `calc(100% - ${fade}px)`;

  return (
    <div
      ref={(node) => {
        self.current = node;
        if (typeof ref === "function") return ref(node);
        if (ref) ref.current = node;
      }}
      // A named region, so aria-label gives the strip a name (and, with reduced motion, the scrollable row a label).
      role="region"
      data-marquee=""
      data-orientation={orientation}
      data-state={reduce ? "static" : "running"}
      tabIndex={reduce ? 0 : undefined}
      className={cn(
        "relative",
        // Clip, not hidden: focusing a link in the row can't scroll it out of step.
        reduce
          ? cn("overscroll-contain rounded-lg outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3", vertical ? "overflow-y-auto" : "overflow-x-auto")
          : "overflow-clip",
        !reduce && fade > 0 && (vertical ? "mask-y-from-(--marquee-edge) mask-y-to-100%" : "mask-x-from-(--marquee-edge) mask-x-to-100%"),
        className,
      )}
      style={{ "--marquee-edge": edge, ...style } as React.CSSProperties}
      onPointerEnter={(e) => {
        onPointerEnter?.(e);
        if (pauseOnHover && e.pointerType === "mouse") hold("hover", true);
      }}
      onPointerLeave={(e) => {
        onPointerLeave?.(e);
        hold("hover", false);
        hold("press", false);
      }}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        // Press and hold to read, on touch as well as mouse.
        hold("press", true);
        const release = () => {
          hold("press", false);
          window.removeEventListener("pointerup", release);
          window.removeEventListener("pointercancel", release);
        };
        window.addEventListener("pointerup", release);
        window.addEventListener("pointercancel", release);
      }}
      onFocus={(e) => {
        onFocus?.(e);
        hold("focus", true);
        reveal(e.target);
      }}
      onBlur={(e) => {
        onBlur?.(e);
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hold("focus", false);
      }}
      {...rest}
    >
      <div
        ref={track}
        className={cn("relative flex", !reduce && "will-change-transform", vertical ? "flex-col" : "w-max flex-row")}
        // The server render already sits where the loop starts, so nothing jumps when it begins.
        style={
          reduce
            ? // Static and scrollable: a gutter so the first item doesn't sit on the edge.
              { gap, [vertical ? "paddingBlock" : "paddingInline"]: 16 }
            : { gap, transform: vertical ? `translateY(${lead}px)` : `translateX(${lead}px)` }
        }
      >
        {!reduce && (
          <div
            aria-hidden
            inert
            className={cn(group, "absolute", vertical ? "bottom-full left-0 w-full" : "right-full top-0 h-full")}
            style={{ gap, [vertical ? "marginBottom" : "marginRight"]: gap }}
          >
            {children}
          </div>
        )}
        <div ref={first} className={group} style={{ gap }}>
          {children}
        </div>
        {!reduce &&
          Array.from({ length: copies }, (_, i) => (
            // Repeats are decoration: hidden from assistive tech and unreachable by Tab.
            <div key={i} aria-hidden inert className={group} style={{ gap }}>
              {children}
            </div>
          ))}
      </div>
    </div>
  );
}
