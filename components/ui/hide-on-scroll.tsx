"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/** The nearest ancestor that scrolls vertically, or null for the page itself. */
function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let node = el?.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
    if (/(auto|scroll|overlay)/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}

type Target = React.RefObject<HTMLElement | null>;

function jumpTo(scroller: HTMLElement | null, y: number) {
  if (scroller) scroller.scrollTop = y;
  else window.scrollTo({ top: y, behavior: "instant" });
}

export type HideOnScrollOptions = {
  /** The scroll container. Defaults to the nearest scrolling ancestor, or the page. */
  scrollRoot?: Target;
  /** Pixels of continuous downward scroll before it hides. */
  hideAfter?: number;
  /** Pixels of continuous upward scroll before it returns. */
  revealAfter?: number;
  /** An upward flick faster than this (px per ms) brings it back at once. */
  revealVelocity?: number;
  /** Always shown within this many px of the top. Defaults to the element's own height. */
  topZone?: number;
  /** Come back when the scroll reaches the end, where there's nothing left to read. */
  revealAtEnd?: boolean;
  /** Keep it shown, e.g. while a menu inside it is open. */
  pinned?: boolean;
};

/**
 * The hide/reveal decision on its own. Downward travel accumulates until
 * `hideAfter`; upward travel needs `revealAfter`, unless it's a fast flick,
 * so slow reading drift never pops the bar back over the text.
 */
export function useHideOnScroll(
  ref: Target,
  { scrollRoot, hideAfter = 16, revealAfter = 56, revealVelocity = 0.9, topZone, revealAtEnd = true, pinned = false }: HideOnScrollOptions = {},
) {
  const [hidden, setHidden] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const scroller = scrollRoot?.current ?? getScrollParent(el);
    const source: HTMLElement | Window = scroller ?? window;
    const read = () => (scroller ? scroller.scrollTop : window.scrollY);
    const limit = () => (scroller ? scroller.scrollHeight - scroller.clientHeight : document.documentElement.scrollHeight - window.innerHeight);

    let lastY = read();
    let lastT = performance.now();
    let travel = 0;
    let velocity = 0;
    let frame = 0;
    let hiddenNow = false;
    const hide = (next: boolean) => {
      hiddenNow = next;
      setHidden(next);
    };

    const update = () => {
      frame = 0;
      const max = Math.max(0, limit());
      // Clamp so iOS rubber-banding past either end isn't read as a direction change.
      const y = Math.min(Math.max(read(), 0), max);
      const now = performance.now();
      const dy = y - lastY;
      const dt = Math.max(1, now - lastT);
      // A pause longer than 100ms starts a new gesture; otherwise smooth the speed.
      velocity = dt > 100 ? dy / dt : velocity * 0.5 + (dy / dt) * 0.5;
      lastY = y;
      lastT = now;

      const zone = topZone ?? el.offsetHeight;
      setAtTop(y <= 1);
      if (y <= zone || (revealAtEnd && max > zone && y >= max - 2)) {
        travel = 0;
        hide(false);
        return;
      }
      if (dy === 0) return;
      // Travel resets whenever the direction flips.
      travel = Math.sign(dy) === Math.sign(travel) ? travel + dy : dy;
      if (travel > hideAfter) hide(true);
      else if (travel < -revealAfter || velocity < -revealVelocity) hide(false);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    // Keyboard users tabbing into a hidden bar get it back, and keep it while inside.
    // The browser has already scrolled to bring the off-screen control into view;
    // undo that jump, since the bar is coming back to where they are.
    const onIn = () => {
      if (hiddenNow && read() !== lastY) jumpTo(scroller, lastY);
      travel = 0;
      hide(false);
      setFocused(true);
    };
    const onOut = (e: FocusEvent) => {
      if (!el.contains(e.relatedTarget as Node | null)) setFocused(false);
    };

    source.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("focusin", onIn);
    el.addEventListener("focusout", onOut);
    // Read the starting position on the next frame, e.g. after scroll restoration.
    frame = requestAnimationFrame(update);
    return () => {
      source.removeEventListener("scroll", onScroll);
      el.removeEventListener("focusin", onIn);
      el.removeEventListener("focusout", onOut);
      cancelAnimationFrame(frame);
    };
  }, [ref, scrollRoot, hideAfter, revealAfter, revealVelocity, topZone, revealAtEnd]);

  return { hidden: hidden && !pinned && !focused, atTop };
}

export type HideOnScrollProps = React.ComponentProps<"div"> &
  HideOnScrollOptions & {
    /** Which edge it lives on. A top bar slides up and away; a bottom bar slides down. */
    edge?: "top" | "bottom";
    /** Called when it hides or returns. */
    onHiddenChange?: (hidden: boolean) => void;
  };

export function HideOnScroll({
  edge = "top",
  scrollRoot,
  hideAfter,
  revealAfter,
  revealVelocity,
  topZone,
  revealAtEnd,
  pinned,
  onHiddenChange,
  className,
  children,
  ref,
  ...rest
}: HideOnScrollProps) {
  const el = useRef<HTMLDivElement>(null);
  const { hidden, atTop } = useHideOnScroll(el, { scrollRoot, hideAfter, revealAfter, revealVelocity, topZone, revealAtEnd, pinned });

  const notify = useRef(onHiddenChange);
  const last = useRef(false);
  useEffect(() => {
    notify.current = onHiddenChange;
  });
  useEffect(() => {
    if (hidden === last.current) return;
    last.current = hidden;
    notify.current?.(hidden);
  }, [hidden]);

  return (
    <div
      ref={(node) => {
        el.current = node;
        if (typeof ref === "function") return ref(node);
        if (ref) ref.current = node;
      }}
      data-edge={edge}
      data-hidden={hidden ? "" : undefined}
      data-at-top={atTop ? "" : undefined}
      className={cn(
        "sticky z-(--z-sticky)",
        edge === "top" ? "top-0 border-b" : "bottom-0 border-t",
        // Returning is an entrance: 320ms expo ease-out. Leaving moves on screen, so
        // it's quicker and eases in and out: 220ms.
        "transition-[translate,background-color,border-color] duration-320 ease-out-expo",
        "data-hidden:duration-220 data-hidden:ease-in-out-quart",
        edge === "top" ? "data-hidden:-translate-y-[calc(100%+2px)]" : "data-hidden:translate-y-[calc(100%+2px)]",
        // Translucent over a blur. Bottom bars sit under the thumb and small labels, so
        // they are more opaque. A top bar is plain at the very top and gains its
        // surface once content is beneath.
        "border-line bg-[color-mix(in_oklab,var(--hide-on-scroll-bg,var(--frame))_97%,transparent)] supports-backdrop-filter:backdrop-blur-md supports-backdrop-filter:backdrop-saturate-150",
        edge === "top"
          ? "supports-backdrop-filter:bg-[color-mix(in_oklab,var(--hide-on-scroll-bg,var(--frame))_80%,transparent)]"
          : "supports-backdrop-filter:bg-[color-mix(in_oklab,var(--hide-on-scroll-bg,var(--frame))_90%,transparent)]",
        edge === "top" && "data-at-top:border-transparent data-at-top:bg-transparent",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
