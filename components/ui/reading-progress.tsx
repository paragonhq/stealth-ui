"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

/** The nearest ancestor that scrolls vertically, or null for the page itself. */
function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let node = el?.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
    if (/(auto|scroll|overlay)/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}

type Target = React.RefObject<HTMLElement | null>;

// The native scroll-driven timeline, where the browser has it. Not in the DOM typings yet.
type ViewTimelineCtor = new (options: { subject: Element; axis?: "block" | "inline" }) => AnimationTimeline;
const nativeViewTimeline = () => (typeof window === "undefined" ? undefined : (window as unknown as { ViewTimeline?: ViewTimelineCtor }).ViewTimeline);

export type ReadingProgressOptions = {
  /** The scroll container. Defaults to the nearest scrolling ancestor of the article, or the page. */
  scrollRoot?: Target;
  /** Reading speed used for the estimate. */
  wordsPerMinute?: number;
  /** A known reading time, in minutes, instead of counting words. Also lets the label render on the server. */
  minutes?: number;
};

type Visual = { ref: React.RefObject<Element | null>; keyframes: Keyframe[] };

/**
 * Tracks how far through an article the reader is: 0 when its top reaches the
 * top of the scroll container (below any scroll-padding, e.g. a sticky header),
 * 1 when its end reaches the bottom. The drawn indicator is driven by a native
 * view timeline where supported (off the main thread) and by the scroll
 * position otherwise; the number for the label and ARIA is always from script.
 */
function useProgressEngine(target: Target, { scrollRoot, wordsPerMinute = 230, minutes }: ReadingProgressOptions, visual?: Visual) {
  const [percent, setPercent] = useState(0);
  const [words, setWords] = useState(0);

  useEffect(() => {
    const article = target.current;
    if (!article) return;
    const scroller = scrollRoot?.current ?? getScrollParent(article);
    const source: HTMLElement | Window = scroller ?? window;
    const el = visual?.ref.current;
    const keyframes = visual?.keyframes ?? [];

    // One paused animation holds the indicator's keyframes. Script scrubs its
    // currentTime; a native timeline replaces the scrubbing entirely.
    let anim: Animation | undefined;
    let native = false;
    const TL = nativeViewTimeline();

    let padTop = 0;
    let padBottom = 0;
    let frame = 0;

    const view = () => {
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        return { top: r.top + scroller.clientTop + padTop, height: scroller.clientHeight - padTop - padBottom };
      }
      return { top: padTop, height: window.innerHeight - padTop - padBottom };
    };

    const measure = () => {
      const cs = getComputedStyle(scroller ?? document.documentElement);
      padTop = parseFloat(cs.scrollPaddingTop) || 0;
      padBottom = parseFloat(cs.scrollPaddingBottom) || 0;
      if (!minutes) setWords((article.textContent ?? "").trim().split(/\s+/).filter(Boolean).length);

      // A timeline only matches our maths when the article is taller than the view.
      const tall = article.offsetHeight > view().height;
      const wantNative = !!TL && !!el && tall;
      if (el && (!anim || wantNative !== native)) {
        anim?.cancel();
        native = wantNative;
        anim = native
          ? el.animate(keyframes, { fill: "both", timeline: new TL!({ subject: article, axis: "block" }), rangeStart: "contain 0%", rangeEnd: "contain 100%" } as KeyframeAnimationOptions)
          : el.animate(keyframes, { duration: 1000, fill: "both" });
        if (!native) anim.pause();
      }
    };

    const update = () => {
      frame = 0;
      const v = view();
      const r = article.getBoundingClientRect();
      const span = r.height - v.height;
      const p = span > 0 ? Math.min(1, Math.max(0, (v.top - r.top) / span)) : r.bottom <= v.top + v.height ? 1 : 0;
      if (anim && !native) anim.currentTime = p * 1000;
      // State changes at most 100 times over the whole article.
      setPercent(Math.round(p * 100));
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // Images loading and fonts swapping change the article's height; so do resizes.
    const ro = new ResizeObserver(() => {
      measure();
      onScroll();
    });
    ro.observe(article);
    if (scroller) ro.observe(scroller);
    source.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      ro.disconnect();
      source.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
      anim?.cancel();
    };
  }, [target, scrollRoot, minutes, visual?.ref, visual?.keyframes]);

  const total = minutes ?? (words ? Math.max(1, Math.round(words / wordsPerMinute)) : 0);
  const finished = percent >= 100;
  const minutesLeft = total ? (finished ? 0 : Math.max(1, Math.ceil(total * (1 - percent / 100)))) : 0;
  return { percent, totalMinutes: total, minutesLeft, finished };
}

/** Progress through an article, without any UI: { percent, totalMinutes, minutesLeft, finished }. */
export function useReadingProgress(target: Target, options: ReadingProgressOptions = {}) {
  return useProgressEngine(target, options);
}

const valueText = (percent: number, minutesLeft: number, finished: boolean, finishedLabel = "Finished") =>
  finished ? finishedLabel : minutesLeft ? `${percent}%, ${minutesLeft} min left` : `${percent}%`;

const barKeyframes: Keyframe[] = [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }];
const ringKeyframes: Keyframe[] = [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }];

export type ReadingProgressProps = Omit<React.ComponentProps<"div">, "children"> &
  ReadingProgressOptions & {
    /** The article being read. Progress runs from its top to its end. */
    target: Target;
    /** Accessible name. */
    label?: string;
  };

/** A hairline bar that fills as the article is read. Position it with className. */
export function ReadingProgress({ target, scrollRoot, wordsPerMinute, minutes, label = "Reading progress", className, ...rest }: ReadingProgressProps) {
  const fill = useRef<HTMLDivElement>(null);
  const { percent, minutesLeft, finished } = useProgressEngine(target, { scrollRoot, wordsPerMinute, minutes }, { ref: fill, keyframes: barKeyframes });
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={valueText(percent, minutesLeft, finished)}
      data-state={finished ? "finished" : percent > 0 ? "reading" : "idle"}
      className={cn("pointer-events-none h-0.5 w-full overflow-hidden", className)}
      {...rest}
    >
      <div ref={fill} style={{ transform: "scaleX(0)" }} className="size-full origin-left bg-fg rtl:origin-right" />
    </div>
  );
}

export type ReadingProgressRingProps = Omit<React.ComponentProps<"div">, "children"> &
  ReadingProgressOptions & {
    target: Target;
    /** Show "4 min left" beside the ring. */
    showTimeLeft?: boolean;
    /** Shown in place of the time once the end is reached. */
    finishedLabel?: string;
    label?: string;
  };

/** A small ring with the time left, for a header or a floating pill. Draws a tick at the end. */
export function ReadingProgressRing({
  target,
  scrollRoot,
  wordsPerMinute,
  minutes,
  showTimeLeft = true,
  finishedLabel = "Finished",
  label = "Reading progress",
  className,
  ...rest
}: ReadingProgressRingProps) {
  const arc = useRef<SVGCircleElement>(null);
  const reduce = useReducedMotion();
  const { percent, minutesLeft, totalMinutes, finished } = useProgressEngine(target, { scrollRoot, wordsPerMinute, minutes }, { ref: arc, keyframes: ringKeyframes });

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={valueText(percent, minutesLeft, finished, finishedLabel)}
      data-state={finished ? "finished" : percent > 0 ? "reading" : "idle"}
      className={cn("inline-flex items-center gap-2 text-[12px] text-fg-2", className)}
      {...rest}
    >
      <span className="relative grid size-[18px] shrink-0 place-items-center">
        <svg viewBox="0 0 18 18" className="absolute inset-0 -rotate-90 rtl:scale-x-[-1]" aria-hidden>
          <circle cx="9" cy="9" r="7.5" fill="none" strokeWidth="1.5" className="stroke-line-2" />
          <circle
            ref={arc}
            cx="9"
            cy="9"
            r="7.5"
            fill="none"
            strokeWidth="1.5"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1}
            className="stroke-fg"
          />
        </svg>
        <AnimatePresence initial={false}>
          {finished && (
            // The ring closes, then fills and a tick draws inside it.
            <motion.span
              key="done"
              className="absolute inset-0 grid place-items-center rounded-full bg-fg text-frame"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, transition: { duration: 0.14, ease: ease.in } }}
              transition={reduce ? { duration: 0.15 } : spring.pop}
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <motion.path
                  d="M3.5 8.5 6.5 11.5 12.5 4.5"
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.3, ease: ease.out, delay: 0.08 }}
                />
              </svg>
            </motion.span>
          )}
        </AnimatePresence>
      </span>

      {showTimeLeft && (
        // Both states share one grid cell, so the width never jumps between them.
        <span aria-hidden className="grid whitespace-nowrap text-left">
          <span className="invisible col-start-1 row-start-1 tabular">{`${Math.max(totalMinutes, 10)} min left`}</span>
          <span className="invisible col-start-1 row-start-1">{finishedLabel}</span>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={finished ? "finished" : totalMinutes ? "left" : "pending"}
              className="col-start-1 row-start-1"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)", transition: { duration: 0.14 } }}
              transition={{ duration: reduce ? 0.15 : 0.22, ease: ease.out }}
            >
              {finished ? (
                <span className="text-fg">{finishedLabel}</span>
              ) : totalMinutes ? (
                <NumberFlow value={minutesLeft} suffix=" min left" className="tabular" />
              ) : null}
            </motion.span>
          </AnimatePresence>
        </span>
      )}
    </div>
  );
}
