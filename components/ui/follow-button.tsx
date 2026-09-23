"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

type Save = (following: boolean) => unknown;

/**
 * Optimistic follow state with one request in flight. Rapid toggles settle on the last intent and
 * send at most one follow-up; a failure puts the button back to what the server last agreed to.
 */
export function useOptimisticFollow({
  following: followingProp,
  defaultFollowing = false,
  onFollowingChange,
  onSave,
  onError,
}: {
  following?: boolean;
  defaultFollowing?: boolean;
  onFollowingChange?: (following: boolean) => void;
  onSave?: Save;
  onError?: (error: unknown) => void;
}) {
  const [following, setFollowing] = useControllableState({ value: followingProp, defaultValue: defaultFollowing, onChange: onFollowingChange });
  const [failed, setFailed] = useState<null | "follow" | "unfollow">(null);
  const confirmed = useRef(following);
  const desired = useRef(following);
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
      setFollowing(confirmed.current);
      setFailed(target ? "follow" : "unfollow");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setFailed(null), 2600);
      onError?.(error);
      return;
    }
    inflight.current = false;
    // Toggled again while we waited: send the latest intent, once.
    if (alive.current && desired.current !== confirmed.current) flush();
  };

  const toggle = (next: boolean) => {
    desired.current = next;
    setFollowing(next);
    setFailed(null);
    window.clearTimeout(timer.current);
    if (!inflight.current) flush();
  };

  return { following, toggle, failed };
}

type Mode = "follow" | "following" | "unfollow" | "failed";

export type FollowButtonProps = Omit<React.ComponentProps<"button">, "value" | "defaultValue" | "onChange"> & {
  following?: boolean;
  defaultFollowing?: boolean;
  /** Fires on every change, including a rollback after a failed save. */
  onFollowingChange?: (following: boolean) => void;
  /** Persist the change. Return a promise; if it rejects, the button rolls back and says so. */
  onSave?: Save;
  onError?: (error: unknown) => void;
  /** Who this follows. Completes the accessible name ("Follow Maya Okafor") and the failure message. */
  name?: string;
  label?: string;
  followingLabel?: string;
  unfollowLabel?: string;
  failedLabel?: string;
  size?: "sm" | "md";
};

/**
 * Follow becomes Following with a check that draws. Pointing at Following offers Unfollow in the
 * danger color, but only once the pointer has left and come back, so the click that followed
 * never lands on an unfollow. On touch, Unfollow asks for a second tap.
 */
export function FollowButton({
  following: followingProp,
  defaultFollowing = false,
  onFollowingChange,
  onSave,
  onError,
  name,
  label = "Follow",
  followingLabel = "Following",
  unfollowLabel = "Unfollow",
  failedLabel = "Try again",
  size = "md",
  disabled,
  className,
  onClick,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  ...rest
}: FollowButtonProps) {
  const { following, toggle, failed } = useOptimisticFollow({ following: followingProp, defaultFollowing, onFollowingChange, onSave, onError });
  const reduce = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // True right after following, until the pointer leaves or focus moves: no instant "Unfollow".
  const [settling, setSettling] = useState(false);
  // Touch has no hover, so the first tap on Following arms Unfollow and the second one does it.
  const [armed, setArmed] = useState(false);
  const pointer = useRef<string>("mouse");
  const armTimer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(armTimer.current), []);

  const offering = following && !settling && (hovered || focused || armed);
  const mode: Mode = failed ? "failed" : !following ? "follow" : offering ? "unfollow" : "following";
  const icon = size === "sm" ? 14 : 16;
  const who = name ? ` ${name}` : "";

  const enter = reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" };
  const leave = reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" };
  const texts = { follow: label, following: followingLabel, unfollow: unfollowLabel, failed: failedLabel };
  const gap = size === "sm" ? "gap-1.5" : "gap-2";

  return (
    <>
      <button
        type="button"
        data-state={mode}
        data-size={size}
        aria-pressed={following}
        aria-label={`${label}${who}`}
        disabled={disabled}
        onPointerDown={(e) => {
          onPointerDown?.(e);
          pointer.current = e.pointerType;
        }}
        onPointerEnter={(e) => {
          onPointerEnter?.(e);
          if (e.pointerType === "mouse") setHovered(true);
        }}
        onPointerLeave={(e) => {
          onPointerLeave?.(e);
          setHovered(false);
          setSettling(false);
        }}
        onFocus={(e) => {
          onFocus?.(e);
          // Only keyboard focus previews Unfollow; a mouse press focuses too, and that must not count.
          if (e.currentTarget.matches(":focus-visible")) setFocused(true);
        }}
        onBlur={(e) => {
          onBlur?.(e);
          setFocused(false);
          setSettling(false);
          setArmed(false);
        }}
        onClick={(e) => {
          onClick?.(e);
          if (e.defaultPrevented) return;
          window.clearTimeout(armTimer.current);
          if (!following) {
            toggle(true);
            setSettling(true);
            setArmed(false);
            return;
          }
          if (pointer.current === "touch" && !armed) {
            setArmed(true);
            armTimer.current = window.setTimeout(() => setArmed(false), 3000);
            return;
          }
          toggle(false);
          setArmed(false);
          pointer.current = "mouse";
        }}
        className={cn(
          "group/follow relative inline-flex shrink-0 select-none items-center justify-center border font-medium tracking-[-0.005em]",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[background-color,border-color,color,box-shadow,scale] duration-150 ease-out active:scale-[0.97] active:duration-75",
          "disabled:pointer-events-none disabled:opacity-50",
          size === "sm" ? "h-7 rounded-md px-2.5 text-[12px]" : "h-8 rounded-lg px-3 text-[12.5px]",
          // Follow is the one primary thing on a profile; once done, it steps back to a quiet outline.
          "data-[state=follow]:border-transparent data-[state=follow]:bg-fg data-[state=follow]:text-frame data-[state=follow]:hover:bg-fg/90",
          "data-[state=following]:border-line-2 data-[state=following]:bg-raised data-[state=following]:text-fg data-[state=following]:shadow-[var(--shadow)]",
          "data-[state=unfollow]:border-danger/35 data-[state=unfollow]:bg-danger-soft data-[state=unfollow]:text-danger",
          "data-[state=failed]:border-danger/35 data-[state=failed]:bg-raised data-[state=failed]:text-danger",
          className,
        )}
        {...rest}
      >
        {/* Every state is laid out in one grid cell, so the button is as wide as the widest and
            never shifts. Each state is centered in that width, icon and label together. */}
        <span className="grid place-items-center overflow-hidden py-1">
          {(["follow", "following", "unfollow", "failed"] as const).map((m) => (
            <span key={m} aria-hidden className={cn("invisible col-start-1 row-start-1 flex items-center", gap)}>
              <span className="shrink-0" style={{ width: icon, height: icon }} />
              {texts[m]}
            </span>
          ))}
          <AnimatePresence initial={false}>
            <motion.span
              key={mode}
              aria-hidden
              className={cn("col-start-1 row-start-1 flex items-center", gap)}
              variants={{ enter, show: { opacity: 1, y: 0, filter: "blur(0px)" }, leave }}
              initial="enter"
              animate="show"
              exit="leave"
              transition={{ duration: reduce ? 0.12 : 0.2, ease: ease.out }}
            >
              {/* Inherits the layer's variants, so it only pops on a change, never on first paint. */}
              <motion.span
                className="grid shrink-0 place-items-center"
                style={{ width: icon, height: icon }}
                variants={{
                  enter: reduce ? {} : { scale: 0.5, rotate: mode === "follow" ? -90 : 0 },
                  show: { scale: 1, rotate: 0, transition: reduce ? { duration: 0 } : spring.pop },
                  leave: {},
                }}
              >
                <Glyph mode={mode} size={icon} reduce={!!reduce} />
              </motion.span>
              {texts[mode]}
            </motion.span>
          </AnimatePresence>
        </span>
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {failed === "follow" ? `Couldn’t follow${who}. Try again.` : failed === "unfollow" ? `Couldn’t unfollow${who}. Try again.` : armed ? `Tap again to unfollow${who}` : ""}
      </span>
    </>
  );
}

function Glyph({ mode, size, reduce }: { mode: Mode; size: number; reduce: boolean }) {
  const common = { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  // Variants, not initial/animate: the tick draws when the state changes to Following, and is
  // simply there when a page loads already following.
  const draw = { variants: { enter: { pathLength: reduce ? 1 : 0 }, show: { pathLength: 1, transition: { duration: reduce ? 0 : 0.3, ease: ease.out, delay: 0.05 } }, leave: {} } };
  if (mode === "following")
    return (
      <svg {...common}>
        <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" {...draw} />
      </svg>
    );
  if (mode === "unfollow")
    return (
      <svg {...common}>
        <path d="M4 8h8" />
      </svg>
    );
  if (mode === "failed")
    return (
      <svg {...common}>
        <path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.75V5h-2.25" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}
