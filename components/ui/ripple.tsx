"use client";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

type Wave = {
  id: number;
  /** Centre of the wave in the host's own (unscaled) coordinates. */
  x: number;
  y: number;
  /** Distance to the host's farthest corner, so the wave always covers it. */
  r: number;
  held: boolean;
  /** Seconds to wait before fading, so a quick tap is still seen to spread. */
  hold: number;
  born: number;
};

export type RippleIntensity = "soft" | "default" | "strong";

export type RippleProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** Every press ripples from the centre, for icon buttons, chips and radios where the pointer position means nothing. */
  centered?: boolean;
  /** Stops new ripples. The host being `:disabled` or `aria-disabled="true"` does the same on its own. */
  disabled?: boolean;
  /** Peak opacity of the wave: 5%, 8% or 12% of the host's text color. */
  intensity?: RippleIntensity;
};

const peak: Record<RippleIntensity, number> = { soft: 0.05, default: 0.08, strong: 0.12 };

// A touch that turns into a scroll shouldn't flash a ripple. Wait this long for
// the browser to claim the gesture (it fires pointercancel) before drawing.
const TOUCH_INTENT_MS = 70;
// Waves beyond this are dropped oldest-first when someone hammers the surface.
const MAX_WAVES = 4;

const isBlocked = (el: Element) => el.matches(':disabled, [aria-disabled="true"], [data-disabled]');

/**
 * Drop it inside any positioned surface (a button, a row, a card) and it listens
 * to that surface: presses ripple from the pointer, Enter and Space from the
 * centre. The wave takes the surface's text color, so it reads on a light row,
 * a dark primary button or a danger button without configuration.
 */
export function Ripple({ centered = false, disabled = false, intensity = "default", className, ref, ...rest }: RippleProps) {
  const layer = useRef<HTMLSpanElement | null>(null);
  const [waves, setWaves] = useState<Wave[]>([]);
  const reduce = !!useReducedMotion();

  const setRef = useCallback(
    (node: HTMLSpanElement | null) => {
      layer.current = node;
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    },
    [ref],
  );

  useEffect(() => {
    const host = layer.current?.parentElement;
    if (!host || disabled) return;

    let seq = 0;
    let touchTimer: number | undefined;
    const live = new Set<number>();

    const spawn = (clientX?: number, clientY?: number) => {
      const rect = host.getBoundingClientRect();
      const w = host.offsetWidth;
      const h = host.offsetHeight;
      if (!w || !h) return 0;
      // The host may itself be scaled mid-press; map the pointer back into its own box.
      const sx = rect.width / w || 1;
      const sy = rect.height / h || 1;
      const fromCentre = centered || clientX === undefined || clientY === undefined;
      const x = fromCentre ? w / 2 : Math.min(Math.max((clientX - rect.left) / sx, 0), w);
      const y = fromCentre ? h / 2 : Math.min(Math.max((clientY - rect.top) / sy, 0), h);
      const r = Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
      const id = ++seq;
      live.add(id);
      setWaves((all) => [...all.slice(-(MAX_WAVES - 1)), { id, x, y, r, held: true, hold: 0, born: performance.now() }]);
      return id;
    };

    const release = (id: number) => {
      if (!live.delete(id)) return;
      const now = performance.now();
      setWaves((all) =>
        all.map((wave) => (wave.id === id ? { ...wave, held: false, hold: Math.max(0, 0.09 - (now - wave.born) / 1000) } : wave)),
      );
    };
    const releaseAll = () => live.forEach(release);

    /* Pointer -------------------------------------------------------------- */

    let pointerWave = 0;
    const endPointer = () => {
      window.clearTimeout(touchTimer);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      host.removeEventListener("pointerleave", onLeave);
    };
    const onUp = (e: PointerEvent) => {
      // A tap shorter than the touch-intent wait still gets its ripple, then lets go.
      if (!pointerWave && touchTimer !== undefined) pointerWave = spawn(e.clientX, e.clientY);
      endPointer();
      release(pointerWave);
    };
    // The browser took the touch for a scroll: never draw, or fade what was drawn.
    const onCancel = () => {
      endPointer();
      release(pointerWave);
    };
    // Dragging off the surface lets go, the same way the click would be abandoned.
    const onLeave = () => {
      endPointer();
      release(pointerWave);
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || isBlocked(host)) return;
      endPointer();
      pointerWave = 0;
      touchTimer = undefined;
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      host.addEventListener("pointerleave", onLeave);
      if (e.pointerType === "touch") {
        const { clientX, clientY } = e;
        touchTimer = window.setTimeout(() => {
          touchTimer = undefined;
          pointerWave = spawn(clientX, clientY);
        }, TOUCH_INTENT_MS);
      } else {
        pointerWave = spawn(e.clientX, e.clientY);
      }
    };

    /* Keyboard ------------------------------------------------------------- */

    const keys = new Map<string, number>();
    const onKeyDown = (e: KeyboardEvent) => {
      // Only when the surface itself has focus, never from a field inside it.
      if (e.target !== host || e.repeat || isBlocked(host)) return;
      if (e.key !== "Enter" && e.key !== " ") return;
      if (keys.has(e.key)) return;
      keys.set(e.key, spawn());
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const id = keys.get(e.key);
      if (id === undefined) return;
      keys.delete(e.key);
      release(id);
    };
    const onBlur = () => {
      keys.clear();
      releaseAll();
    };

    host.addEventListener("pointerdown", onDown);
    host.addEventListener("keydown", onKeyDown);
    host.addEventListener("keyup", onKeyUp);
    host.addEventListener("blur", onBlur);
    return () => {
      endPointer();
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("keydown", onKeyDown);
      host.removeEventListener("keyup", onKeyUp);
      host.removeEventListener("blur", onBlur);
    };
  }, [centered, disabled]);

  const remove = (id: number) => setWaves((all) => all.filter((wave) => wave.id !== id));
  const opacity = peak[intensity];

  return (
    <span
      ref={setRef}
      aria-hidden
      data-slot="ripple"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] [contain:strict] forced-colors:hidden",
        className,
      )}
      {...rest}
    >
      {waves.map((wave) =>
        reduce ? (
          // Reduced motion: no spreading circle, a flat wash of the whole surface that fades.
          <motion.span
            key={wave.id}
            className="absolute inset-0 bg-current"
            initial={{ opacity: opacity * 0.8 }}
            animate={{ opacity: wave.held ? opacity * 0.8 : 0 }}
            transition={{ duration: 0.2, delay: wave.hold, ease: "linear" }}
            onAnimationComplete={() => !wave.held && remove(wave.id)}
          />
        ) : (
          <motion.span
            key={wave.id}
            className="absolute rounded-full bg-current will-change-transform"
            style={{ left: wave.x - wave.r, top: wave.y - wave.r, width: wave.r * 2, height: wave.r * 2 }}
            // Starts at full strength and small: the growth is the entrance, and a tap that's
            // released on the same frame (touch) still shows before it fades.
            initial={{ scale: 0.12, opacity }}
            animate={{ scale: 1, opacity: wave.held ? opacity : 0 }}
            transition={{
              // Bigger surfaces take a little longer, so the wave's speed feels the same on a chip and a card.
              scale: { duration: Math.min(0.62, 0.3 + wave.r * 0.0011), ease: ease.out },
              opacity: { duration: 0.34, delay: wave.hold, ease: ease.outQuart },
            }}
            onAnimationComplete={() => !wave.held && remove(wave.id)}
          />
        ),
      )}
    </span>
  );
}
