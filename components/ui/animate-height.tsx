"use client";
import { animate, motionValue, useReducedMotion, type AnimationPlaybackControlsWithThen, type Transition } from "motion/react";
import { useEffect, useImperativeHandle, useRef } from "react";
import { cn } from "@/lib/cn";

export type AnimateHeightProps = Omit<React.ComponentProps<"div">, "style"> & {
  style?: Omit<React.CSSProperties, "height">;
  /** Replace the default spring. Durations otherwise scale with the distance travelled. */
  transition?: Transition;
  /** Apply changes without animating while true, e.g. for keyboard-driven or bulk updates. */
  instant?: boolean;
  /** Classes for the inner, measured element. */
  contentClassName?: string;
  /** Called with the content's new height in px each time it changes. */
  onHeightChange?: (height: number) => void;
};

// Short moves stay quick, long ones get a little more time, never past 350ms.
const springFor = (distance: number): Transition => ({
  type: "spring",
  bounce: 0,
  visualDuration: 0.18 + (Math.min(distance, 400) / 400) * 0.17,
});

export function AnimateHeight({
  transition,
  instant = false,
  contentClassName,
  onHeightChange,
  className,
  style,
  children,
  ref,
  ...rest
}: AnimateHeightProps) {
  const reduce = useReducedMotion();
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const options = useRef({ transition, skip: false, onHeightChange });
  // The outer box is also the caller's ref; the observer needs its own handle on it.
  useImperativeHandle(ref, () => outerRef.current as HTMLDivElement, []);

  useEffect(() => {
    options.current = { transition, skip: instant || !!reduce, onHeightChange };
  });

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    // Height is "auto" at rest, so the box follows its content with no JavaScript in
    // the loop. It becomes a number only while a change is animating.
    const height = motionValue(0);
    const unsubscribe = height.on("change", (v) => {
      if (outer.dataset.animating !== undefined) outer.style.height = `${v}px`;
    });
    let last: number | null = null;
    let hidden = false;
    let controls: AnimationPlaybackControlsWithThen | undefined;

    const settle = () => {
      delete outer.dataset.animating;
      outer.style.height = "";
    };

    const observer = new ResizeObserver(([entry]) => {
      const next = entry.borderBoxSize?.[0]?.blockSize ?? inner.offsetHeight;
      const visible = outer.getClientRects().length > 0;
      const prev = last;
      const wasHidden = hidden;
      last = next;
      hidden = !visible;
      if (prev === null || prev === next) return;
      options.current.onHeightChange?.(next);
      // First measure, a hidden box, or a box that is just being shown: no animation.
      if (!visible || wasHidden || options.current.skip) {
        controls?.stop();
        settle();
        return;
      }
      const from = outer.dataset.animating !== undefined ? height.get() : prev;
      // Hold the old height before this frame paints (the observer runs after layout,
      // before paint), then animate. Retargeting mid-flight keeps the spring's velocity.
      if (outer.dataset.animating === undefined) height.jump(from);
      outer.dataset.animating = "";
      outer.style.height = `${from}px`;
      controls = animate(height, next, options.current.transition ?? springFor(Math.abs(next - from)));
      const mine = controls;
      mine.then(() => {
        if (controls === mine) settle();
      });
    });

    observer.observe(inner);
    return () => {
      observer.disconnect();
      controls?.stop();
      unsubscribe();
    };
  }, []);

  return (
    <div
      ref={outerRef}
      className={cn(
        // Content-box, so padding and borders on this element sit outside the animated height.
        // Clipped on the vertical axis only, and only while moving: side-to-side overflow
        // (focus rings, shadows, a sideways slide) is never cut.
        "box-content data-[animating]:overflow-y-clip",
        className,
      )}
      style={style}
      {...rest}
    >
      <div ref={innerRef} className={cn("flow-root", contentClassName)}>
        {children}
      </div>
    </div>
  );
}
