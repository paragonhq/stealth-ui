"use client";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

/* -------------------------------------------------------------------------------------------------
 * usePress: is this surface being held down right now?
 * -----------------------------------------------------------------------------------------------*/

const BLOCKED = ':disabled, [aria-disabled="true"], [data-disabled], [data-press-ignore]';
// What each key activates natively. Enter never presses a checkbox; Space never follows a link.
const ON_ENTER = 'button, a[href], summary, input[type="button"], input[type="submit"], input[type="reset"], [role="button"], [role="link"], [role="menuitem"], [role="tab"]';
const ON_SPACE = 'button, summary, input[type="button"], input[type="submit"], input[type="reset"], input[type="checkbox"], input[type="radio"], [role="button"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="menuitem"], [role="option"]';

export type UsePressOptions = {
  /** Ignore every press. */
  disabled?: boolean;
  onPressedChange?: (pressed: boolean) => void;
};

/**
 * Tracks whether a surface is held by a pointer or a key. Dragging off lets go and
 * dragging back on presses again, the same way a native button decides whether
 * the release counts as a click. A touch that becomes a scroll lets go at once.
 */
export function usePress(ref: React.RefObject<HTMLElement | null>, { disabled = false, onPressedChange }: UsePressOptions = {}) {
  const [pressed, setPressed] = useState(false);
  const notify = useRef(onPressedChange);
  useEffect(() => {
    notify.current = onPressedChange;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    let current = false;
    const set = (next: boolean) => {
      if (next === current) return;
      current = next;
      setPressed(next);
      notify.current?.(next);
    };
    const owns = (target: EventTarget | null) => {
      if (!(target instanceof Element) || !el.contains(target)) return false;
      if (target.closest(BLOCKED)) return false;
      // A pressable surface nested inside this one takes the press for itself.
      const nearest = target.closest("[data-press-depth]");
      if (nearest && nearest !== el && el.contains(nearest)) return false;
      return true;
    };

    /* Pointer: armed from down to up, pressed only while over the surface. */
    let armed = false;
    const disarm = () => {
      armed = false;
      set(false);
      window.removeEventListener("pointerup", disarm);
      window.removeEventListener("pointercancel", disarm);
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !owns(e.target)) return;
      armed = true;
      set(true);
      window.addEventListener("pointerup", disarm);
      window.addEventListener("pointercancel", disarm);
    };
    const onLeave = () => armed && set(false);
    const onEnter = (e: PointerEvent) => armed && e.buttons & 1 && set(true);

    /* Keyboard: held from keydown to keyup of the key that activates the focused control. */
    let key: string | null = null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || key || e.metaKey || e.ctrlKey || e.altKey || !owns(e.target)) return;
      const target = e.target as Element;
      if ((e.key === "Enter" && target.matches(ON_ENTER)) || (e.key === " " && target.matches(ON_SPACE))) {
        key = e.key;
        set(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== key) return;
      key = null;
      set(false);
    };
    const onFocusOut = () => {
      key = null;
      if (!armed) set(false);
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("keydown", onKeyDown);
    el.addEventListener("keyup", onKeyUp);
    el.addEventListener("focusout", onFocusOut);
    return () => {
      disarm();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("keyup", onKeyUp);
      el.removeEventListener("focusout", onFocusOut);
    };
  }, [ref, disabled]);

  return disabled ? false : pressed;
}

/* -------------------------------------------------------------------------------------------------
 * PressDepth
 * -----------------------------------------------------------------------------------------------*/

export type PressDepthDepth = "subtle" | "default" | "deep";

export type PressDepthProps = Omit<
  React.ComponentProps<"div">,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd"
> & {
  /** How far the surface's edges travel in: about 1.25px, 2px or 3px, whatever its size. */
  depth?: PressDepthDepth;
  /** Draws the surface's shadow on the wrapper so the press can flatten it. Use "flat" for surfaces with no shadow. */
  elevation?: "raised" | "flat";
  /** Controls the press: true holds it down (e.g. while its shortcut is held), false holds it up. Leave unset to follow the pointer and keys. */
  pressed?: boolean;
  /** Called when a pointer or key presses or releases the surface. */
  onPressedChange?: (pressed: boolean) => void;
  /** Stops the press. Targets that are disabled or inside `[data-press-ignore]` never press it either. */
  disabled?: boolean;
};

const travel: Record<PressDepthDepth, { edge: number; drop: number }> = {
  subtle: { edge: 1.25, drop: 0.5 },
  default: { edge: 2, drop: 1 },
  deep: { edge: 3, drop: 1.5 },
};

// Quick in, sprung out. The release overshoots by well under a pixel: felt, not seen.
const pressIn = { duration: 0.09, ease: ease.out };
const release = { type: "spring", stiffness: 500, damping: 21, mass: 0.6 } as const;

/**
 * Gives whatever it wraps a physical press: it sinks, drops a pixel and its
 * shadow flattens, then springs back on release. Scale is worked out from the
 * surface's size so a chip and a wide card move their edges the same distance.
 */
export function PressDepth({
  depth = "default",
  elevation = "raised",
  pressed: pressedProp,
  onPressedChange,
  disabled = false,
  className,
  children,
  ref,
  ...rest
}: PressDepthProps) {
  const el = useRef<HTMLDivElement | null>(null);
  const reduce = !!useReducedMotion();
  const [size, setSize] = useState(0);
  const tracked = usePress(el, { disabled, onPressedChange });
  // Controlled when `pressed` is set; otherwise it follows the pointer and keys.
  const pressed = !disabled && (pressedProp ?? tracked);

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      el.current = node;
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    },
    [ref],
  );

  // The untransformed size, kept current so the press never measures in the hot path.
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => {
      const box = entry.borderBoxSize?.[0];
      setSize(Math.max(box?.inlineSize ?? node.offsetWidth, box?.blockSize ?? node.offsetHeight));
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const { edge, drop } = travel[depth];
  const scale = size ? Math.min(0.992, Math.max(0.94, 1 - (edge * 2) / size)) : 0.97;
  const move = reduce ? { scale: 1, y: 0 } : pressed ? { scale, y: drop } : { scale: 1, y: 0 };

  return (
    <motion.div
      ref={setRef}
      data-press-depth=""
      data-pressed={pressed ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      className={cn("relative isolate [-webkit-tap-highlight-color:transparent]", className)}
      initial={false}
      animate={move}
      transition={pressed ? pressIn : release}
      {...rest}
    >
      {elevation === "raised" && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] shadow-[var(--shadow)]"
          initial={false}
          animate={{ opacity: pressed ? 0.3 : 1 }}
          transition={pressed ? { duration: 0.09, ease: "linear" } : { duration: 0.26, ease: ease.out }}
        />
      )}
      {children}
      {/* Without movement, the press still has to register: a faint wash while held.
          Always in the tree (hidden unless reduced) so server and client markup match. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit] bg-fg/[0.05] transition-opacity",
          reduce && pressed ? "opacity-100 duration-75" : "opacity-0 duration-200",
        )}
      />
    </motion.div>
  );
}
