"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ArrowUp } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

type Target = React.RefObject<HTMLElement | null>;
type Scroller = HTMLElement | null; // null means the page

// The native scroll-driven timeline, where the browser has it. Not in the DOM typings yet.
type ScrollTimelineCtor = new (options: { source: Element; axis?: "block" | "inline" }) => AnimationTimeline;
const nativeScrollTimeline = () => (window as unknown as { ScrollTimeline?: ScrollTimelineCtor }).ScrollTimeline;

const readY = (s: Scroller) => (s ? s.scrollTop : window.scrollY);
const maxY = (s: Scroller) => (s ? s.scrollHeight - s.clientHeight : document.documentElement.scrollHeight - window.innerHeight);
const viewH = (s: Scroller) => (s ? s.clientHeight : window.innerHeight);

function goTop(s: Scroller, smooth: boolean) {
  (s ?? window).scrollTo({ top: 0, behavior: smooth ? "smooth" : "instant" });
}

/** Moves focus to the start of the content without scrolling, making it focusable if it isn't. */
function focusStart(el: HTMLElement) {
  if (el.tabIndex < 0 && !el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
}

export type BackToTopProps = Omit<React.ComponentProps<"button">, "children"> & {
  /** The scroll container. Defaults to the page. */
  scrollRoot?: Target;
  /** Pixels scrolled before it appears. Defaults to one screen of the container. */
  threshold?: number;
  /** Where keyboard focus lands once the top is reached. Defaults to the container, or the page's main. */
  focusTarget?: Target;
  /** Accessible name, and the visible text when showLabel is on. */
  label?: string;
  /** A pill with the label beside the ring, instead of a round icon button. */
  showLabel?: boolean;
  /** fixed sits in the viewport corner; absolute in the nearest positioned parent's. */
  position?: "fixed" | "absolute";
};

export function BackToTop({
  scrollRoot,
  threshold,
  focusTarget,
  label = "Back to top",
  showLabel = false,
  position = "fixed",
  className,
  onClick,
  ...rest
}: BackToTopProps) {
  const reduce = useReducedMotion();
  const scroller = useRef<Scroller>(null);
  const [visible, setVisible] = useState(false);
  const [launches, setLaunches] = useState(0);
  // Set while a trip to the top is under way; cleared on arrival or if the user takes over.
  const trip = useRef(false);

  useEffect(() => {
    const s = scrollRoot?.current ?? null;
    scroller.current = s;
    const source: HTMLElement | Window = s ?? window;
    let frame = 0;
    let shown = false;

    const update = () => {
      frame = 0;
      const y = readY(s);
      const show = threshold ?? viewH(s);
      if (trip.current && y <= 1) {
        trip.current = false;
        focusStart(focusTarget?.current ?? s ?? document.querySelector("main") ?? document.body);
      }
      // Shown past the threshold; once shown it stays until half of it, so it
      // doesn't flicker for someone reading right at the line. On a trip it
      // rides all the way up and leaves at the top.
      shown = trip.current ? shown : shown ? y > show / 2 : y > show;
      setVisible(shown);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // Any hand on the wheel, screen or keys during the trip means they've taken over.
    const takeOver = () => {
      trip.current = false;
    };
    source.addEventListener("scroll", onScroll, { passive: true });
    source.addEventListener("wheel", takeOver, { passive: true });
    source.addEventListener("touchstart", takeOver, { passive: true });
    source.addEventListener("keydown", takeOver);
    frame = requestAnimationFrame(update);
    return () => {
      source.removeEventListener("scroll", onScroll);
      source.removeEventListener("wheel", takeOver);
      source.removeEventListener("touchstart", takeOver);
      source.removeEventListener("keydown", takeOver);
      cancelAnimationFrame(frame);
    };
  }, [scrollRoot, threshold, focusTarget]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          key="back-to-top"
          type="button"
          aria-label={showLabel ? undefined : label}
          data-position={position}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 8, filter: "blur(2px)" }}
          animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, scale: 0.92, y: 4, filter: "blur(2px)", transition: { duration: 0.16, ease: ease.in } }}
          transition={reduce ? { duration: 0.16 } : spring.snappy}
          onClick={(e) => {
            onClick?.(e);
            if (e.defaultPrevented) return;
            trip.current = true;
            setLaunches((n) => n + 1);
            goTop(scroller.current, !reduce);
          }}
          className={cn(
            "group/top z-(--z-sticky) inline-flex items-center justify-center rounded-full bg-raised text-fg shadow-pop",
            "bottom-[max(16px,env(safe-area-inset-bottom))] right-4",
            position === "fixed" ? "fixed" : "absolute",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            // 40px drawn, 48px to a finger.
            "before:absolute before:-inset-1 before:rounded-full before:content-[''] pointer-fine:before:hidden",
            "transition-[background-color,border-color] duration-150 hover:bg-hover",
            // Press is handled by Motion so it composes with the entrance transform.
            // As a pill it has a border; as a circle the ring itself is the edge.
            showLabel ? "h-10 gap-2 border border-line-2 pl-1 pr-3.5 text-[12.5px] font-medium hover:border-fg-4" : "size-10",
            className,
          )}
          whileTap={reduce ? undefined : { scale: 0.92, transition: { duration: 0.08 } }}
          {...(rest as React.ComponentProps<typeof motion.button>)}
        >
          {!showLabel && <ProgressRing scroller={scroller} className="absolute inset-0 size-10" />}
          <span className="relative grid size-8 place-items-center">
            {showLabel && <ProgressRing scroller={scroller} className="absolute inset-0 size-8" />}
            <span className="relative grid size-4 place-items-center overflow-hidden transition-transform duration-200 ease-out-expo group-hover/top:-translate-y-px motion-reduce:transition-none">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={launches}
                  className="grid place-items-center"
                  // Each press sends the arrow up and out, and a fresh one rises into place.
                  initial={reduce ? { opacity: 0 } : { y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { y: -14, opacity: 0, transition: { duration: 0.16, ease: ease.in } }}
                  transition={reduce ? { duration: 0.12 } : { ...spring.pop, delay: 0.06 }}
                >
                  <ArrowUp />
                </motion.span>
              </AnimatePresence>
            </span>
          </span>
          {showLabel && label}
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/**
 * How far down the container is, drawn around the arrow. A native scroll
 * timeline drives it where supported; otherwise the scroll position scrubs it.
 */
function ProgressRing({ scroller, className }: { scroller: React.RefObject<Scroller>; className?: string }) {
  const arc = useRef<SVGCircleElement>(null);
  useEffect(() => {
    const el = arc.current;
    if (!el) return;
    const s = scroller.current;
    const keyframes = [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }];
    const TL = nativeScrollTimeline();
    if (TL) {
      const anim = el.animate(keyframes, { fill: "both", timeline: new TL({ source: s ?? document.documentElement, axis: "block" }) } as KeyframeAnimationOptions);
      return () => anim.cancel();
    }
    const anim = el.animate(keyframes, { duration: 1000, fill: "both" });
    anim.pause();
    const source: HTMLElement | Window = s ?? window;
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = maxY(s);
      anim.currentTime = max > 0 ? Math.min(1, readY(s) / max) * 1000 : 0;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    source.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      source.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      anim.cancel();
    };
  }, [scroller]);

  return (
    <svg viewBox="0 0 40 40" className={cn("pointer-events-none -rotate-90", className)} aria-hidden>
      <circle cx="20" cy="20" r="19.25" fill="none" strokeWidth="1.5" className="stroke-line-2 transition-[stroke] duration-150 group-hover/top:stroke-fg-4" />
      <circle ref={arc} cx="20" cy="20" r="19.25" fill="none" strokeWidth="1.5" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} className="stroke-fg" />
    </svg>
  );
}
