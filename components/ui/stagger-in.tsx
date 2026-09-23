"use client";
import { useEffect, useRef, useState } from "react";

/**
 * The entrance is plain CSS so it runs on the server-rendered HTML at first
 * paint, before hydration, with nothing hidden if scripts never load. Each
 * direct child reads its place from :nth-child, so there is no index to pass
 * and no wrapper per item. Once the first wave has played the rule is removed:
 * rows added, filtered or re-sorted later simply appear.
 */
// Positions past the cap all share its delay, so rules are only needed up to the largest cap.
const MAX_CAP = 16;
const CSS = `
@keyframes stealth-stagger-in { from { opacity: 0; transform: translateY(var(--stagger-distance)); } }
@keyframes stealth-stagger-fade { from { opacity: 0; } }
[data-stagger-in="play"] > * {
  animation: stealth-stagger-in var(--stagger-duration) var(--ease-out-expo) backwards;
  animation-delay: calc(var(--stagger-delay) + min(var(--stagger-i, 0), var(--stagger-tail)) * var(--stagger-step));
}
${Array.from({ length: MAX_CAP - 1 }, (_, i) => `[data-stagger-in="play"] > :nth-child(${i + 2}) { --stagger-i: ${i + 1}; }`).join("\n")}
[data-stagger-in="play"] > :nth-child(n + ${MAX_CAP + 1}) { --stagger-i: ${MAX_CAP - 1}; }
@media (prefers-reduced-motion: reduce) {
  [data-stagger-in="play"] > * { animation-name: stealth-stagger-fade; animation-duration: 160ms; animation-delay: 0ms; }
}
`;

export type StaggerInProps = React.ComponentProps<"div"> & {
  /** The list element to render. Every direct child is one staggered item. */
  as?: "div" | "ul" | "ol" | "section" | "tbody";
  /** Milliseconds between one item and the next. */
  step?: number;
  /** Items after this many arrive together with the last staggered one, so a long list never makes the reader wait for its tail. 1–16. */
  cap?: number;
  /** Milliseconds before the first item starts. */
  delay?: number;
  /** Milliseconds each item takes to arrive. */
  duration?: number;
  /** Pixels each item rises from. */
  distance?: number;
  /** Skip the entrance entirely, e.g. when the list is restored from a cache the user has already seen. */
  disabled?: boolean;
};

/** The delay for item `index` under the same capped stagger, in seconds, for Motion-driven items. */
export function staggerDelay(index: number, { step = 22, cap = 8, delay = 0 }: { step?: number; cap?: number; delay?: number } = {}) {
  return (delay + Math.min(index, cap - 1) * step) / 1000;
}

type Phase = "play" | "done";

/**
 * Plays a capped stagger the first time items appear in it: on mount if it
 * mounts with data, or when the first rows arrive after a loading state.
 * Remount it (change its key) to play it again.
 */
export function StaggerIn({
  as: Tag = "div",
  step = 22,
  cap = 8,
  delay = 0,
  duration = 360,
  distance = 6,
  disabled = false,
  className,
  style,
  children,
  onAnimationStart,
  ...rest
}: StaggerInProps) {
  const tail = Math.min(Math.max(Math.round(cap), 1), MAX_CAP) - 1;
  const [phase, setPhase] = useState<Phase>(disabled ? "done" : "play");
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // The first item to start opens a window just long enough for the whole wave;
  // anything that mounts inside it joins the wave, anything after it doesn't animate.
  const handleStart = (e: React.AnimationEvent<HTMLDivElement>) => {
    onAnimationStart?.(e);
    if (e.animationName !== "stealth-stagger-in" && e.animationName !== "stealth-stagger-fade") return;
    // Only this list's own items; a nested StaggerIn runs its own wave.
    if ((e.target as Element).parentElement !== e.currentTarget) return;
    if (timer.current !== undefined) return;
    const wave = delay + tail * step + duration + 60;
    timer.current = window.setTimeout(() => setPhase("done"), wave);
  };

  const Comp = Tag as "div";
  return (
    <Comp
      data-stagger-in={disabled ? "done" : phase}
      className={className}
      style={
        {
          "--stagger-step": `${step}ms`,
          "--stagger-delay": `${delay}ms`,
          "--stagger-duration": `${duration}ms`,
          "--stagger-distance": `${distance}px`,
          "--stagger-tail": tail,
          ...style,
        } as React.CSSProperties
      }
      onAnimationStart={handleStart}
      {...rest}
    >
      <style href="stealth-stagger-in" precedence="default">
        {CSS}
      </style>
      {children}
    </Comp>
  );
}
