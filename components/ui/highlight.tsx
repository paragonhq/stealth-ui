"use client";
import { createContext, use, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const tones = {
  neutral: "[--hl:color-mix(in_oklab,var(--fg)_15%,transparent)]",
  warning: "[--hl:color-mix(in_oklab,var(--warning)_26%,transparent)]",
  success: "[--hl:color-mix(in_oklab,var(--success)_22%,transparent)]",
  danger: "[--hl:color-mix(in_oklab,var(--danger)_22%,transparent)]",
  info: "[--hl:color-mix(in_oklab,var(--info)_22%,transparent)]",
} as const;

/** Pen speed in px per second, and the shortest and longest a stroke may take, in seconds. */
const PACE = { speed: 520, min: 0.4, max: 1.2 };

/** Seconds a stroke takes: from its real length across every line it covers, like a pen at a steady pace. */
function strokeTime(el: HTMLElement) {
  const fixed = Number(el.dataset.duration);
  if (fixed > 0) return fixed;
  const length = Array.from(el.getClientRects()).reduce((sum, r) => sum + r.width, 0);
  return Math.min(PACE.max, Math.max(PACE.min, length / PACE.speed));
}

function pace(el: HTMLElement, seconds: number, delay?: number) {
  el.style.setProperty("--hl-in", `${seconds}s`);
  el.style.setProperty("--hl-out", `${Math.max(0.2, seconds * 0.6)}s`);
  if (delay !== undefined) el.style.setProperty("--hl-delay", `${delay}s`);
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Once when it scrolls into view. Scrolled past unseen counts as seen. */
function useSeen(ref: React.RefObject<HTMLElement | null>, enabled: boolean) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const above = entry.boundingClientRect.bottom < (entry.rootBounds?.top ?? 0);
        if (!entry.isIntersecting && !above) return;
        io.disconnect();
        setSeen(true);
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, enabled]);
  return seen;
}

const Group = createContext<{ on: boolean } | null>(null);

type Trigger = {
  /** Draw once when it scrolls into view, or only when `active` says so. */
  trigger?: "view" | "manual";
  /** Controls it from outside. true draws, false wipes back out. Wins over `trigger`. */
  active?: boolean;
};

export type HighlightProps = Omit<React.HTMLAttributes<HTMLElement>, "children"> &
  Trigger & {
    children: React.ReactNode;
    /** A full-height marker behind the text, or a low stroke under it. */
    variant?: "marker" | "underline";
    /** Neutral emphasis, or a meaning: attention, added, removed, a note. */
    tone?: keyof typeof tones;
    /** Seconds before drawing. Ignored inside a HighlightGroup, which sequences for you. */
    delay?: number;
    /** Seconds to draw. By default it follows the length of the stroke. */
    duration?: number;
    /** Called when it has finished drawing in. */
    onDrawn?: () => void;
    ref?: React.Ref<HTMLElement>;
  };

/**
 * A marker stroke drawn behind text, left to right in reading order. It is a
 * background on the inline element, not a box behind it, so when the phrase
 * wraps the stroke finishes the first line and carries on along the next.
 */
export function Highlight({
  children,
  trigger = "view",
  active,
  variant = "marker",
  tone = "neutral",
  delay = 0,
  duration,
  onDrawn,
  className,
  style,
  ref,
  ...rest
}: HighlightProps) {
  const group = use(Group);
  const self = useRef<HTMLElement>(null);
  const seen = useSeen(self, !group && active === undefined && trigger === "view");
  const on = group ? group.on : (active ?? (trigger === "view" && seen));
  const drawn = useRef(onDrawn);
  useEffect(() => {
    drawn.current = onDrawn;
  });

  // Paced while it's off, ready for the next draw: measuring after it turns on
  // would flush styles and start the transition before its timing is set. The
  // stroke's length doesn't depend on its state. In a group, the group paces.
  useIsoLayoutEffect(() => {
    const el = self.current;
    if (!el) return;
    if (!on && !group) pace(el, strokeTime(el));
    // With reduced motion nothing transitions, so there is no transitionend to wait for.
    if (on && reducedMotion()) drawn.current?.();
  }, [on, duration, group]);

  return (
    <>
      <mark
        ref={(node: HTMLElement | null) => {
          self.current = node;
          if (typeof ref === "function") return ref(node);
          if (ref) (ref as React.RefObject<HTMLElement | null>).current = node;
        }}
        data-highlight=""
        data-state={on ? "on" : "off"}
        data-variant={variant}
        data-tone={tone}
        data-duration={duration}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && e.propertyName === "background-size" && on) drawn.current?.();
        }}
        className={cn(
          // Zero-specificity reset of the browser's black-on-yellow, so any colour class you pass wins.
          "bg-transparent [:where(&)]:text-inherit",
          tones[tone],
          variant === "underline" && tone === "neutral" && "[--hl:color-mix(in_oklab,var(--fg)_30%,transparent)]",
          // Slice (the default) lays the background out along the whole phrase as if it were
          // one line, which is what makes a growing width draw line after line in order.
          "bg-[linear-gradient(var(--hl),var(--hl))] bg-no-repeat [box-decoration-break:slice]",
          variant === "marker"
            ? "-mx-[0.12em] rounded-[0.2em] px-[0.12em] [background-position:0_50%] data-[state=off]:[background-size:0%_100%] data-[state=on]:[background-size:100%_100%]"
            : "[background-position:0_90%] data-[state=off]:[background-size:0%_0.36em] data-[state=on]:[background-size:100%_0.36em]",
          // Draws in on the soft ease-out after its delay; wipes back out faster, all at once.
          // Colour rides along so a data-[state=on]: text colour eases with the stroke.
          "transition-[background-size,color] ease-out-quart duration-(--hl-out,0.3s) data-[state=on]:delay-(--hl-delay,0s) data-[state=on]:duration-(--hl-in,0.6s)",
          "motion-reduce:transition-none",
          className,
        )}
        style={group ? style : ({ "--hl-delay": `${delay}s`, ...style } as React.CSSProperties)}
        {...rest}
      >
        {children}
      </mark>
      {!group && trigger === "view" && active === undefined && (
        <noscript>
          <style>{"[data-highlight][data-state=off]{background-size:100% 100%!important}"}</style>
        </noscript>
      )}
    </>
  );
}

export type HighlightGroupProps = React.HTMLAttributes<HTMLElement> &
  Trigger & {
    as?: "div" | "p" | "section" | "article" | "span";
    /** Seconds before the first stroke. */
    delay?: number;
    /** Seconds between one stroke finishing and the next starting. */
    gap?: number;
    ref?: React.Ref<HTMLElement>;
  };

/**
 * Draws every Highlight inside it one after another, in reading order: each
 * stroke starts as the one before it finishes, whatever their lengths. Wiping
 * out happens all at once.
 */
export function HighlightGroup({ as: Tag = "div", trigger = "view", active, delay = 0, gap = 0.06, className, children, ref, ...rest }: HighlightGroupProps) {
  const self = useRef<HTMLElement>(null);
  const seen = useSeen(self, active === undefined && trigger === "view");
  const on = active ?? (trigger === "view" && seen);

  // Pace and chain the marks while they're off, ready for the next draw (see Highlight).
  useIsoLayoutEffect(() => {
    const el = self.current;
    if (!el || on) return;
    let at = delay;
    for (const mark of el.querySelectorAll<HTMLElement>("[data-highlight]")) {
      const seconds = strokeTime(mark);
      pace(mark, seconds, at);
      at += seconds + gap;
    }
  }, [on, delay, gap]);

  return (
    <Group value={{ on }}>
      <Tag
        ref={(node: HTMLElement | null) => {
          self.current = node;
          if (typeof ref === "function") return ref(node);
          if (ref) (ref as React.RefObject<HTMLElement | null>).current = node;
        }}
        data-highlight-group=""
        data-state={on ? "on" : "off"}
        className={className}
        {...rest}
      >
        {children}
      </Tag>
      {trigger === "view" && active === undefined && (
        <noscript>
          <style>{"[data-highlight-group] [data-highlight]{background-size:100% 100%!important}"}</style>
        </noscript>
      )}
    </Group>
  );
}
