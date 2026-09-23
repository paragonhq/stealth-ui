"use client";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { AnimatePresence, motion } from "motion/react";
import { createContext, use, useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { swap, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

type Orientation = "vertical" | "horizontal";
/** auto follows the autoplay prop (and reduced motion); the others are the viewer's own choice. */
type Mode = "auto" | "playing" | "stopped";

type Ctx = {
  orientation: Orientation;
  active: string;
  /** Advancing on its own. Stays true while merely paused. */
  playing: boolean;
  /** Frozen for now: hovered, focused from the keyboard, off screen or in a hidden tab. */
  paused: boolean;
  interval: number;
  advance: () => void;
  toggle: () => void;
};

const FeatureTabsContext = createContext<Ctx | null>(null);

// Reduced motion decides whether the tour starts, which changes the markup, so it
// must read "no preference" while hydrating and only then switch to the real value.
const reducedQuery = "(prefers-reduced-motion: reduce)";
function subscribeReduced(onChange: () => void) {
  const mq = window.matchMedia(reducedQuery);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeReduced, () => window.matchMedia(reducedQuery).matches, () => false);
}
const useFeatureTabs = () => {
  const ctx = use(FeatureTabsContext);
  if (!ctx) throw new Error("FeatureTabs parts must be used inside <FeatureTabs>");
  return ctx;
};

type ValueProps =
  | { value: string; onValueChange?: (value: string) => void; defaultValue?: never }
  | { defaultValue: string; onValueChange?: (value: string) => void; value?: undefined };

export type FeatureTabsProps = Omit<BaseTabs.Root.Props, "value" | "defaultValue" | "onValueChange" | "className" | "orientation"> &
  ValueProps & {
    /** vertical: the tabs stack beside the visual (below it on narrow containers). horizontal: a row of tabs over the visual. */
    orientation?: Orientation;
    /** Move to the next tab on its own. Off by default under reduced motion; the play button still starts it. */
    autoplay?: boolean;
    /** Milliseconds each tab stays before the next. */
    interval?: number;
    className?: string;
  };

/**
 * Tabs that walk through a product's features on their own. Each tab's rail
 * fills over `interval`, and the next tab takes over when it's full. Hovering,
 * keyboard focus, scrolling it off screen or leaving the browser tab freeze the
 * fill where it is; choosing a tab hands control to the reader for good.
 */
export function FeatureTabs({
  value: valueProp,
  defaultValue,
  onValueChange,
  orientation = "vertical",
  autoplay = true,
  interval = 6000,
  className,
  children,
  onKeyDownCapture,
  onPointerDownCapture,
  ...rest
}: FeatureTabsProps) {
  const [active, setActive] = useControllableState<string>({ value: valueProp, defaultValue: defaultValue ?? "", onChange: onValueChange });
  const reduce = usePrefersReducedMotion();
  const [mode, setMode] = useState<Mode>("auto");
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pageHidden, setPageHidden] = useState(false);
  const [el, setEl] = useState<HTMLDivElement | null>(null);

  const playing = mode === "playing" || (mode === "auto" && autoplay && !reduce);
  const paused = hovered || focused || !visible || pageHidden;

  // A loop nobody can see shouldn't keep time.
  useEffect(() => {
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting && e.intersectionRatio >= 0.25), { threshold: [0, 0.25] });
    io.observe(el);
    const onVis = () => setPageHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [el]);

  const advance = useCallback(() => {
    if (!el) return;
    // DOM order is the reading order, and disabled tabs are skipped.
    const tabs = [...el.querySelectorAll<HTMLElement>("[data-feature-tab]:not([data-disabled])")];
    if (tabs.length < 2) return;
    const i = tabs.findIndex((t) => t.dataset.featureTab === active);
    const next = tabs[(i + 1) % tabs.length]?.dataset.featureTab;
    if (next != null) setActive(next);
  }, [el, active, setActive]);

  const toggle = useCallback(() => setMode(playing ? "stopped" : "playing"), [playing]);

  return (
    <FeatureTabsContext value={{ orientation, active, playing, paused, interval, advance, toggle }}>
      <BaseTabs.Root
        ref={setEl}
        value={active}
        onValueChange={(next, details) => {
          // A tab chosen by hand is being read: stop the tour rather than take it away.
          // Automatic fallbacks (a tab removed or disabled) keep the tour going.
          if (details.reason === "none") setMode("stopped");
          setActive(String(next));
        }}
        orientation={orientation}
        data-slot="feature-tabs"
        data-orientation={orientation}
        data-playing={playing || undefined}
        data-paused={(playing && paused) || undefined}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={(e) => {
          // Only keyboard focus pauses; a click already stops the tour, and the play button must be able to play.
          if (e.target.matches(":focus-visible") && !e.target.closest("[data-feature-tabs-toggle]")) setFocused(true);
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
        }}
        // Arrow keys switch on the same frame; pointer switches crossfade.
        onKeyDownCapture={(e) => {
          e.currentTarget.dataset.nav = "key";
          onKeyDownCapture?.(e);
        }}
        onPointerDownCapture={(e) => {
          e.currentTarget.dataset.nav = "pointer";
          onPointerDownCapture?.(e);
        }}
        className={cn("group/ft @container/ft min-w-0", className)}
        {...rest}
      >
        <div
          className={cn(
            "grid min-w-0 gap-6",
            orientation === "vertical" ? "@[620px]/ft:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] @[620px]/ft:items-center @[620px]/ft:gap-8" : "grid-cols-1 gap-5",
          )}
        >
          {children}
        </div>
      </BaseTabs.Root>
    </FeatureTabsContext>
  );
}

export type FeatureTabsListProps = Omit<BaseTabs.List.Props, "className"> & { className?: string };

export function FeatureTabsList({ className, activateOnFocus = true, ...rest }: FeatureTabsListProps) {
  const { orientation } = useFeatureTabs();
  return (
    <BaseTabs.List
      activateOnFocus={activateOnFocus}
      className={cn(
        "relative flex min-w-0",
        orientation === "vertical"
          ? "flex-col"
          : "-mx-1 overflow-x-auto overscroll-x-contain px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      {...rest}
    />
  );
}

export type FeatureTabsTabProps = Omit<BaseTabs.Tab.Props, "className" | "children" | "value" | "title"> & {
  value: string;
  /** The feature's name. It is the tab's accessible name. */
  title: React.ReactNode;
  /** One or two sentences. Vertical tabs reveal it for the active tab only; horizontal tabs always show it. */
  children?: React.ReactNode;
  /** 16px icon before the title. */
  icon?: React.ReactNode;
  className?: string;
};

export function FeatureTabsTab({ value, title, icon, children, className, ...rest }: FeatureTabsTabProps) {
  const { orientation, active, playing, paused, interval, advance } = useFeatureTabs();
  const isActive = active === value;
  const vertical = orientation === "vertical";
  const titleId = useId();
  const descId = useId();
  const fill = useRef<HTMLSpanElement>(null);
  const run = useRef<Animation | null>(null);
  const pausedNow = useRef(paused);
  const advanceNow = useRef(advance);

  useEffect(() => {
    pausedNow.current = paused;
    advanceNow.current = advance;
    const anim = run.current;
    if (!anim || anim.playState === "finished") return;
    if (paused) anim.pause();
    else anim.play();
  }, [paused, advance]);

  // The fill is a Web Animation, so pausing freezes it exactly where it is and
  // the advance fires from the same clock the reader is watching. It animates
  // the `scale` property, the same one the resting classes set.
  useEffect(() => {
    const node = fill.current;
    if (!node || !isActive || !playing) return;
    const anim = node.animate([{ scale: vertical ? "1 0" : "0 1" }, { scale: "1 1" }], { duration: interval, easing: "linear", fill: "forwards" });
    if (pausedNow.current) anim.pause();
    anim.onfinish = () => advanceNow.current();
    run.current = anim;
    return () => {
      run.current = null;
      anim.onfinish = null;
      // Freeze the progress into an inline style, then decide where it goes from there.
      try {
        anim.commitStyles();
      } catch {
        return; // Unmounted: nothing left to tidy.
      }
      anim.cancel();
      if (node.closest("[data-feature-tab]")?.hasAttribute("data-active")) {
        // Still selected, just stopped: let the resting transition draw the rest of the rail.
        requestAnimationFrame(() => node.style.removeProperty("scale"));
        return;
      }
      // Handed off: the rail fades out where it stands, then resets unseen.
      const fade = node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: "ease-out", fill: "forwards" });
      fade.onfinish = () => {
        node.style.transition = "none";
        node.style.removeProperty("scale");
        void node.offsetWidth;
        node.style.removeProperty("transition");
        fade.cancel();
      };
    };
  }, [isActive, playing, interval, vertical]);

  return (
    <BaseTabs.Tab
      value={value}
      data-feature-tab={value}
      aria-labelledby={titleId}
      aria-describedby={children ? descId : undefined}
      className={cn(
        "group/tab relative flex min-w-0 select-none flex-col items-start text-left outline-none",
        "touch-manipulation [-webkit-tap-highlight-color:transparent]",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
        vertical ? "w-full rounded-r-lg py-3 pl-5 pr-3 focus-visible:-outline-offset-1" : "min-w-[168px] flex-1 rounded-t-lg px-1 pb-4 pt-1 focus-visible:outline-offset-2",
        className,
      )}
      {...rest}
    >
      {/* The rail: a hairline track with a fill that measures the time left on this tab. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute overflow-hidden rounded-full bg-line-2/70",
          vertical ? "inset-y-0 left-0 w-px" : "inset-x-1 bottom-0 h-px",
        )}
      >
        <span
          ref={fill}
          className={cn(
            "absolute inset-0 bg-fg",
            vertical ? "origin-top" : "origin-left",
            // Chosen by hand (or not playing): the rail draws in full, quickly, as a selection mark.
            isActive && !playing ? "scale-100" : vertical ? "scale-y-0" : "scale-x-0",
            "transition-[scale] duration-300 ease-out-expo group-data-[nav=key]/ft:duration-0",
          )}
        />
      </span>

      <span
        className={cn(
          "flex min-w-0 items-center gap-2.5 text-[13.5px] font-medium tracking-[-0.01em]",
          "text-fg-3 group-hover/tab:text-fg-2 group-data-active/tab:text-fg",
          "transition-[color,scale] duration-150 ease-out-quart group-active/tab:scale-[0.985] group-active/tab:duration-75",
        )}
      >
        {icon && (
          <span className="grid size-4 shrink-0 place-items-center text-fg-4 transition-colors duration-150 group-hover/tab:text-fg-3 group-data-active/tab:text-fg-2 [&_svg]:size-4">
            {icon}
          </span>
        )}
        <span id={titleId} className="min-w-0">
          {title}
        </span>
      </span>

      {children &&
        (vertical ? (
          // Height to content on a grid row, so the list reflows smoothly as one description closes and the next opens.
          <span
            className={cn(
              "grid w-full transition-[grid-template-rows,opacity] duration-300 ease-in-out-quart group-data-[nav=key]/ft:duration-0",
              isActive ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}
          >
            <span className="min-h-0 overflow-hidden">
              <span id={descId} className={cn("block pt-1.5 text-[12.5px] leading-[1.55] text-pretty text-fg-2", icon ? "pl-[26px]" : null)}>
                {children}
              </span>
            </span>
          </span>
        ) : (
          <span
            id={descId}
            className="mt-1.5 line-clamp-2 text-[12.5px] leading-[1.5] text-pretty text-fg-3 transition-colors duration-150 group-data-active/tab:text-fg-2"
          >
            {children}
          </span>
        ))}
    </BaseTabs.Tab>
  );
}

export type FeatureTabsPanelsProps = React.ComponentProps<"div">;

/**
 * The frame the visuals crossfade in. Every panel sits in the same grid cell, so
 * the outgoing and incoming visual overlap instead of stacking. Give it a fixed
 * aspect ratio (the default is 4:3) so the section never changes height between features.
 */
export function FeatureTabsPanels({ className, ...rest }: FeatureTabsPanelsProps) {
  return (
    <div
      data-slot="feature-tabs-panels"
      className={cn("relative isolate grid aspect-[4/3] min-w-0 overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]", className)}
      {...rest}
    />
  );
}

export type FeatureTabsPanelProps = Omit<BaseTabs.Panel.Props, "className" | "value"> & { value: string; className?: string };

export function FeatureTabsPanel({ className, ...rest }: FeatureTabsPanelProps) {
  return (
    <BaseTabs.Panel
      className={cn(
        "col-start-1 row-start-1 min-h-0 min-w-0 rounded-[inherit] outline-none",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-4 focus-visible:outline-fg-3",
        // In: fade up from 98.5% with a 4px blur that clears, 420ms. Out: a plain 220ms fade underneath it.
        "transition-[opacity,scale,filter] duration-[420ms] ease-out-quart",
        "data-starting-style:scale-[0.985] data-starting-style:opacity-0 data-starting-style:blur-[4px]",
        "data-ending-style:opacity-0 data-ending-style:duration-[220ms] data-ending-style:ease-out",
        "motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:blur-none",
        "group-data-[nav=key]/ft:transition-none",
        className,
      )}
      {...rest}
    />
  );
}

export type FeatureTabsPlayToggleProps = Omit<React.ComponentProps<"button">, "children" | "onClick"> & {
  pauseLabel?: string;
  playLabel?: string;
};

/**
 * Pauses or resumes the tour for good. Autoplay that runs longer than five seconds
 * needs a control like this; put it near the tabs.
 */
export function FeatureTabsPlayToggle({ pauseLabel = "Pause autoplay", playLabel = "Play autoplay", className, ...rest }: FeatureTabsPlayToggleProps) {
  const { playing, toggle } = useFeatureTabs();
  const reduce = usePrefersReducedMotion();
  return (
    <button
      type="button"
      data-feature-tabs-toggle=""
      data-state={playing ? "playing" : "stopped"}
      aria-label={playing ? pauseLabel : playLabel}
      onClick={toggle}
      className={cn(
        "relative inline-grid size-7 shrink-0 place-items-center rounded-full border border-line-2 bg-raised text-fg-2 shadow-[var(--shadow)]",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color,border-color,color,scale] duration-150 ease-out-quart hover:border-fg-4 hover:bg-hover hover:text-fg",
        "active:scale-[0.92] active:duration-75",
        "touch-manipulation [-webkit-tap-highlight-color:transparent] pointer-coarse:before:absolute pointer-coarse:before:-inset-2 pointer-coarse:before:content-['']",
        className,
      )}
      {...rest}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.svg
          key={playing ? "pause" : "play"}
          width={12}
          height={12}
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden
          focusable={false}
          initial={reduce ? { opacity: 0 } : swap.initial}
          animate={swap.animate}
          exit={reduce ? { opacity: 0 } : swap.exit}
          transition={reduce ? { duration: 0.12 } : spring.pop}
        >
          {playing ? (
            <>
              <rect x="4" y="3" width="2.75" height="10" rx="1" />
              <rect x="9.25" y="3" width="2.75" height="10" rx="1" />
            </>
          ) : (
            // Nudged right: a triangle looks centered when its mass is, not its box.
            <path d="M5.5 3.6v8.8a.8.8 0 0 0 1.2.7l7-4.4a.8.8 0 0 0 0-1.4l-7-4.4a.8.8 0 0 0-1.2.7z" transform="translate(-0.6 0)" />
          )}
        </motion.svg>
      </AnimatePresence>
    </button>
  );
}
