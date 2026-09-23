"use client";
import { Toggle } from "@base-ui/react/toggle";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

type Save = (liked: boolean) => unknown;

/**
 * Optimistic like state with one request in flight at a time. Rapid toggles
 * settle on the last intent and send at most one follow-up; a failure puts the
 * interface back to the last state the server agreed with.
 */
export function useOptimisticLike({
  liked: likedProp,
  defaultLiked = false,
  onLikedChange,
  onSave,
  onError,
}: {
  liked?: boolean;
  defaultLiked?: boolean;
  onLikedChange?: (liked: boolean) => void;
  onSave?: Save;
  onError?: (error: unknown) => void;
}) {
  const [liked, setLiked] = useControllableState({ value: likedProp, defaultValue: defaultLiked, onChange: onLikedChange });
  const [failed, setFailed] = useState(false);
  const confirmed = useRef(liked);
  const desired = useRef(liked);
  const inflight = useRef(false);
  const alive = useRef(true);
  const timer = useRef<number>(undefined);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  const flush = async () => {
    if (!onSave) {
      confirmed.current = desired.current;
      return;
    }
    inflight.current = true;
    const target = desired.current;
    try {
      await onSave(target);
      confirmed.current = target;
    } catch (error) {
      inflight.current = false;
      if (!alive.current) return;
      desired.current = confirmed.current;
      setLiked(confirmed.current);
      setFailed(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setFailed(false), 2400);
      onError?.(error);
      return;
    }
    inflight.current = false;
    // Toggled again while we were waiting: send the latest intent, once.
    if (alive.current && desired.current !== confirmed.current) flush();
  };

  const toggle = (next: boolean) => {
    desired.current = next;
    setLiked(next);
    setFailed(false);
    if (!inflight.current) flush();
  };

  return { liked, toggle, failed };
}

export type LikeButtonProps = Omit<React.ComponentProps<"button">, "value" | "onChange" | "defaultValue"> & {
  /** Total likes when the page loaded, including the viewer's own if they had liked it. */
  count?: number;
  liked?: boolean;
  defaultLiked?: boolean;
  /** Fires on every change, including a rollback after a failed save. */
  onLikedChange?: (liked: boolean) => void;
  /** Persist the change. Return a promise; if it rejects the like is rolled back. */
  onSave?: Save;
  onError?: (error: unknown) => void;
  /** Accessible name. The pressed state says whether it is on. */
  label?: string;
  /** How the count is read out. */
  countLabel?: (count: number) => string;
  hideCount?: boolean;
  size?: "sm" | "md";
  locales?: Intl.LocalesArgument;
};

const DOTS = 7;

export function LikeButton({
  count = 0,
  liked: likedProp,
  defaultLiked = false,
  onLikedChange,
  onSave,
  onError,
  label = "Like",
  countLabel = (n) => (n === 1 ? "1 like" : `${n.toLocaleString("en-US")} likes`),
  hideCount = false,
  size = "md",
  locales = "en-US",
  disabled,
  className,
  ref,
  ...rest
}: LikeButtonProps) {
  const { liked, toggle, failed } = useOptimisticLike({ liked: likedProp, defaultLiked, onLikedChange, onSave, onError });
  const [initial] = useState(liked);
  const [burst, setBurst] = useState(0);
  const [heart, animateHeart] = useAnimate<HTMLSpanElement>();
  const reduce = useReducedMotion();
  const countId = useId();
  const total = Math.max(0, count - (initial ? 1 : 0) + (liked ? 1 : 0));
  const icon = size === "sm" ? 14 : 16;

  return (
    <>
      <Toggle
        ref={ref as React.Ref<HTMLButtonElement>}
        pressed={liked}
        disabled={disabled}
        aria-label={label}
        aria-describedby={hideCount ? undefined : countId}
        onPressedChange={(next) => {
          toggle(next);
          if (next && !reduce) {
            // Squash, stretch, settle: the heart takes the press like something soft.
            animateHeart(
              heart.current,
              { scaleX: [1, 1.22, 0.9, 1.04, 1], scaleY: [1, 0.78, 1.14, 0.98, 1] },
              { duration: 0.46, ease: ease.out, times: [0, 0.18, 0.46, 0.74, 1] },
            );
            setBurst((b) => b + 1);
          }
        }}
        data-size={size}
        data-failed={failed || undefined}
        className={cn(
          "group/like relative inline-flex shrink-0 select-none items-center rounded-full font-medium tracking-[-0.005em] text-fg-2",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.94] active:duration-75",
          "data-[pressed]:text-fg",
          // Stretch the hit area to 44px on touch without changing the drawing.
          "before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
          size === "sm" ? "h-7 gap-1 px-2 text-[12px]" : "h-8 gap-1.5 px-2.5 text-[12.5px]",
          hideCount && (size === "sm" ? "w-7 justify-center px-0" : "w-8 justify-center px-0"),
          disabled && "pointer-events-none opacity-50",
          className,
        )}
        {...rest}
      >
        <span className="relative grid place-items-center" style={{ width: icon, height: icon }}>
          {!reduce && burst > 0 && <Burst key={burst} />}
          <span ref={heart} className="relative grid place-items-center">
            <svg width={icon} height={icon} viewBox="0 0 16 16" fill="none" aria-hidden className={cn("transition-colors duration-200", failed ? "text-danger" : "")}>
              <path
                d="M8 13.25S2.25 10 2.25 6.1A2.85 2.85 0 0 1 8 4.9a2.85 2.85 0 0 1 5.75 1.2C13.75 10 8 13.25 8 13.25z"
                stroke="currentColor"
                strokeWidth={1.4}
                strokeLinejoin="round"
                className={cn("transition-opacity duration-150", liked && "opacity-0")}
              />
            </svg>
            {/* The fill grows from the center of the outline rather than switching on. */}
            <AnimatePresence initial={false}>
              {liked && (
                <motion.svg
                  key="fill"
                  width={icon}
                  height={icon}
                  viewBox="0 0 16 16"
                  aria-hidden
                  className="absolute inset-0 text-danger"
                  initial={reduce ? { opacity: 0 } : { scale: 0.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { scale: 0.5, opacity: 0, transition: { duration: 0.12, ease: ease.in } }}
                  transition={reduce ? { duration: 0.15 } : spring.pop}
                >
                  <path
                    d="M8 13.25S2.25 10 2.25 6.1A2.85 2.85 0 0 1 8 4.9a2.85 2.85 0 0 1 5.75 1.2C13.75 10 8 13.25 8 13.25z"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth={1.4}
                    strokeLinejoin="round"
                  />
                </motion.svg>
              )}
            </AnimatePresence>
          </span>
        </span>
        {!hideCount && (
          <span aria-hidden className={cn("tabular transition-colors duration-200", failed && "text-danger")}>
            <NumberFlow
              value={total}
              locales={locales}
              format={{ notation: total >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }}
              transformTiming={{ duration: 420, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}
              spinTiming={{ duration: 420, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}
            />
          </span>
        )}
      </Toggle>
      {!hideCount && (
        <span id={countId} className="sr-only">
          {countLabel(total)}
        </span>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {failed ? "Couldn’t save. Try again." : ""}
      </span>
    </>
  );
}

// Seven dots thrown out from under the heart, once per like. Small and quick,
// so it reads as the heart landing rather than a celebration.
function Burst() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      <motion.span
        className="absolute inset-0 rounded-full border border-danger"
        initial={{ scale: 0.4, opacity: 0.5 }}
        animate={{ scale: 1.9, opacity: 0 }}
        transition={{ duration: 0.42, ease: ease.out }}
      />
      {Array.from({ length: DOTS }, (_, i) => {
        const a = (i / DOTS) * Math.PI * 2 - Math.PI / 2;
        const r = 13 + (i % 2) * 2;
        return (
          <motion.span
            key={i}
            className={cn("absolute left-1/2 top-1/2 -ml-[1.5px] -mt-[1.5px] size-[3px] rounded-full", i % 2 ? "bg-danger/60" : "bg-danger")}
            initial={{ x: 0, y: 0, scale: 0.6, opacity: 0 }}
            animate={{ x: Math.cos(a) * r, y: Math.sin(a) * r, scale: [0.6, 1, 0], opacity: [0, 1, 0] }}
            transition={{ duration: 0.5, ease: ease.out, delay: 0.04, times: [0, 0.35, 1] }}
          />
        );
      })}
    </span>
  );
}
