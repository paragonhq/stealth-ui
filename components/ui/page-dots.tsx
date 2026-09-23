"use client";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Pause, Play } from "@/lib/icons";
import { spring, swap } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

type Size = "sm" | "md";
// dot: resting diameter · pill: active width · gap: space between dots. Each button owns half the gap on either side.
const metrics: Record<Size, { dot: number; pill: number; gap: number }> = {
  sm: { dot: 5, pill: 16, gap: 6 },
  md: { dot: 6, pill: 22, gap: 8 },
};

/** Which run of dots is visible when there are more pages than fit. Moves only when the active dot reaches an edge. */
function nextWindow(start: number, active: number, count: number, max: number) {
  if (count <= max) return 0;
  const last = count - max;
  // Keep one dot of lookahead on each side while there is more beyond it.
  if (active <= start) start = active - 1;
  else if (active >= start + max - 1) start = active - max + 2;
  return Math.min(Math.max(start, 0), last);
}

const reducedQuery = "(prefers-reduced-motion: reduce)";
/** Reduced motion as hydration-safe state: false on the server and during hydration, the real answer right after. */
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(reducedQuery);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(reducedQuery).matches,
    () => false,
  );
}

export type PageDotsProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "dir"> & {
  /** How many pages there are. */
  count: number;
  /** The current page, zero-based. */
  value?: number;
  defaultValue?: number;
  onValueChange?: (index: number) => void;
  /** Advance on its own every this many milliseconds, with the time drawn into the active pill. */
  autoplay?: number;
  /** Hold autoplay, for instance while the user drags a slide. Hover, focus, a hidden tab and going off screen hold it too. */
  paused?: boolean;
  /** Show a pause / play button after the dots when autoplay is on. */
  showToggle?: boolean;
  /** At most this many dots show; the rest shrink away at the edges and slide in as you go. */
  max?: number;
  size?: Size;
  /** Plain dots, or dots on a small frosted chip for sitting over images. */
  variant?: "plain" | "contained";
  /** Names the group ("Slides", "Photos"). */
  "aria-label"?: string;
  /** The accessible name of each dot. */
  getLabel?: (index: number, count: number) => string;
};

export function PageDots({
  count,
  value: valueProp,
  defaultValue = 0,
  onValueChange,
  autoplay,
  paused: pausedProp = false,
  showToggle = true,
  max = 7,
  size = "md",
  variant = "plain",
  "aria-label": label = "Pages",
  getLabel = (i, n) => `Page ${i + 1} of ${n}`,
  className,
  ...rest
}: PageDotsProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const reduce = useReducedMotion();
  const m = metrics[size];
  const slot = m.dot + m.gap;
  const visible = Math.min(count, max);

  // The visible window follows the active dot (state adjusted during render, not in an effect).
  const [start, setStart] = useState(() => nextWindow(0, value, count, max));
  const nextStart = nextWindow(start, value, count, max);
  if (nextStart !== start) setStart(nextStart);

  // Autoplay: one progress value, drawn into the active pill, that advances the page when it fills.
  const root = useRef<HTMLDivElement>(null);
  const progress = useMotionValue(0);
  const controls = useRef<AnimationPlaybackControls | null>(null);
  const advance = useRef(() => {});
  useEffect(() => {
    advance.current = () => setValue((value + 1) % count);
  });

  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const [held, setHeld] = useState({ hover: false, focus: false, hidden: false, offscreen: false });
  // Reduced motion starts held: nothing moves on its own until the person presses play.
  const prefersReduced = usePrefersReducedMotion();
  const stopped = userPaused ?? prefersReduced;
  const paused = pausedProp || stopped || held.hover || held.focus || held.hidden || held.offscreen;

  useEffect(() => {
    if (!autoplay) return;
    progress.jump(0);
    const c = animate(progress, 1, { duration: autoplay / 1000, ease: "linear", onComplete: () => advance.current() });
    controls.current = c;
    return () => {
      c.stop();
      controls.current = null;
    };
  }, [autoplay, value, progress]);

  useEffect(() => {
    if (paused) controls.current?.pause();
    else controls.current?.play();
  }, [paused, value, autoplay]);

  useEffect(() => {
    if (!autoplay) return;
    const el = root.current;
    const onVisibility = () => setHeld((h) => ({ ...h, hidden: document.hidden }));
    document.addEventListener("visibilitychange", onVisibility);
    const io = new IntersectionObserver(([entry]) => setHeld((h) => ({ ...h, offscreen: !entry.isIntersecting })));
    if (el) io.observe(el);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      io.disconnect();
    };
  }, [autoplay]);

  const width = count > max ? (visible - 1) * slot + m.pill + m.gap : undefined;

  return (
    <div
      ref={root}
      data-variant={variant}
      data-size={size}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHeld((h) => ({ ...h, hover: true }))}
      onPointerLeave={() => setHeld((h) => ({ ...h, hover: false }))}
      className={cn(
        "group/dots inline-flex items-center",
        variant === "contained" && "rounded-full border border-line bg-frame/75 px-1 shadow-[var(--shadow)] backdrop-blur-md",
        className,
      )}
      {...rest}
    >
      <BaseTabs.Root
        value={value}
        onValueChange={(v) => setValue(v as number)}
        onKeyDownCapture={(e) => (e.currentTarget.dataset.nav = "key")}
        onPointerDownCapture={(e) => (e.currentTarget.dataset.nav = "pointer")}
        onFocusCapture={() => setHeld((h) => ({ ...h, focus: true }))}
        onBlurCapture={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHeld((h) => ({ ...h, focus: false }))}
        className="group/root"
      >
        {/* The viewport clips the run of dots past max. overflow: clip, not hidden, so focusing a far dot can never scroll it. */}
        <div className="overflow-clip pointer-coarse:-my-2.5 pointer-coarse:py-2.5" style={{ width }}>
          <BaseTabs.List
            aria-label={label}
            activateOnFocus
            className="flex transition-[translate] duration-300 ease-in-out-quart group-data-[nav=key]/root:duration-0"
            style={{ translate: `${-start * slot}px 0` }}
          >
            {Array.from({ length: count }, (_, i) => {
              const active = i === value;
              const moreLeft = start > 0;
              const moreRight = start + max < count;
              // Dots at a window edge with more beyond them shrink, hinting that the row continues.
              const edge = active
                ? 1
                : count > max && ((moreLeft && i === start) || (moreRight && i === start + max - 1))
                  ? 0.45
                  : count > max && ((moreLeft && i === start + 1) || (moreRight && i === start + max - 2))
                    ? 0.72
                    : i < start || i >= start + max
                      ? 0
                      : 1;
              return (
                <BaseTabs.Tab
                  key={i}
                  value={i}
                  aria-label={getLabel(i, count)}
                  className={cn(
                    "group/dot relative grid shrink-0 place-items-center outline-none",
                    "touch-manipulation [-webkit-tap-highlight-color:transparent]",
                    size === "sm" ? "h-5" : "h-6",
                    // Taller to the finger than to the eye.
                    "pointer-coarse:before:absolute pointer-coarse:before:inset-x-0 pointer-coarse:before:-inset-y-2.5 pointer-coarse:before:content-['']",
                  )}
                  style={{ paddingInline: m.gap / 2 }}
                >
                  <span
                    className={cn(
                      "relative block overflow-hidden rounded-full",
                      "transition-[width,scale,background-color] duration-300 ease-in-out-quart group-data-[nav=key]/root:duration-0",
                      "group-active/dot:scale-[0.8] group-active/dot:duration-100",
                      "group-focus-visible/dot:outline-solid group-focus-visible/dot:outline-1 group-focus-visible/dot:outline-offset-2 group-focus-visible/dot:outline-fg-3",
                      active ? (autoplay ? "bg-fg/25" : "bg-fg") : "bg-fg-4 group-hover/dot:bg-fg-3",
                    )}
                    style={{ width: active ? m.pill : m.dot, height: m.dot, scale: edge }}
                  >
                    {active && autoplay ? (
                      <motion.span aria-hidden className="absolute inset-0 origin-left rounded-full bg-fg" style={{ scaleX: progress }} />
                    ) : null}
                  </span>
                </BaseTabs.Tab>
              );
            })}
          </BaseTabs.List>
        </div>
      </BaseTabs.Root>

      {autoplay && showToggle && (
        <button
          type="button"
          aria-label={stopped ? "Play slideshow" : "Pause slideshow"}
          onClick={() => setUserPaused(!stopped)}
          className={cn(
            "relative ml-1 grid size-6 shrink-0 place-items-center rounded-full text-fg-3 outline-none",
            "transition-[background-color,color,scale] duration-150 ease-out-quart hover:bg-hover hover:text-fg active:scale-[0.9] active:duration-75",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
            "pointer-coarse:before:absolute pointer-coarse:before:-inset-2.5 pointer-coarse:before:content-['']",
          )}
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={stopped ? "play" : "pause"}
              className="grid place-items-center"
              initial={reduce ? { opacity: 0 } : swap.initial}
              animate={swap.animate}
              exit={reduce ? { opacity: 0 } : swap.exit}
              transition={reduce ? { duration: 0.12 } : spring.pop}
            >
              {stopped ? <Play size={12} className="translate-x-px" /> : <Pause size={12} />}
            </motion.span>
          </AnimatePresence>
        </button>
      )}
    </div>
  );
}
