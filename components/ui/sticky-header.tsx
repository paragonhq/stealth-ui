"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/** The nearest ancestor that scrolls vertically, or null for the page itself. */
function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let node = el?.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
    if (/(auto|scroll|overlay)/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}

type Target = React.RefObject<HTMLElement | null>;

/** Pads the scroller so anchors and focus land below the header. Returns the undo. */
function padScroller(scroller: HTMLElement, px: number) {
  const before = scroller.style.scrollPaddingTop;
  scroller.style.scrollPaddingTop = `${px}px`;
  return () => {
    scroller.style.scrollPaddingTop = before;
  };
}

/**
 * True once the element has scrolled up past a line `offset` px below the top
 * of its scroll container. One IntersectionObserver, no scroll listeners.
 */
export function useScrolledPast(ref: Target, { root, offset = 0, enabled = true }: { root?: Target; offset?: number; enabled?: boolean } = {}) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const rootEl = root?.current ?? getScrollParent(el);
    const io = new IntersectionObserver(
      ([entry]) => {
        const top = (entry.rootBounds?.top ?? 0);
        // Out of view below the fold is not "past"; only leaving over the top edge is.
        setPast(!entry.isIntersecting && entry.boundingClientRect.bottom <= top + 1);
      },
      { root: rootEl, rootMargin: `${-Math.max(0, Math.round(offset))}px 0px 0px 0px`, threshold: [0, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, root, offset, enabled]);
  return enabled && past;
}

type Ctx = { height: number; offset: number; root?: Target };
const StickyHeaderContext = createContext<Ctx>({ height: 0, offset: 0 });

export type StickyHeaderProps = React.ComponentProps<"header"> & {
  /** Distance from the top of the scroll container where the header sticks, in px. */
  offset?: number;
  /** The scroll container. Defaults to the nearest scrolling ancestor, or the page. */
  scrollRoot?: Target;
  /** Called when content starts or stops passing beneath the header. */
  onScrolledChange?: (scrolled: boolean) => void;
  /**
   * Sets scroll-padding-top on the scroll container to the header's height, so
   * anchor jumps and focused fields land below the header instead of under it.
   */
  scrollPadding?: boolean;
};

export function StickyHeader({ offset = 0, scrollRoot, onScrolledChange, scrollPadding = true, className, style, children, ref, ...rest }: StickyHeaderProps) {
  const sentinel = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const [height, setHeight] = useState(0);
  // The sentinel sits where the header would be if it didn't stick. Once it
  // passes the sticking line, content is sliding under the header.
  const scrolled = useScrolledPast(sentinel, { root: scrollRoot, offset });

  const notify = useRef(onScrolledChange);
  const last = useRef(false);
  useEffect(() => {
    notify.current = onScrolledChange;
  });
  useEffect(() => {
    if (scrolled === last.current) return;
    last.current = scrolled;
    notify.current?.(scrolled);
  }, [scrolled]);

  // Titles inside need the header's height to know when a heading has gone under it.
  useEffect(() => {
    const el = header.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!scrollPadding || !height) return;
    return padScroller(scrollRoot?.current ?? getScrollParent(header.current) ?? document.documentElement, height + offset);
  }, [scrollPadding, height, offset, scrollRoot]);

  return (
    <StickyHeaderContext value={{ height, offset, root: scrollRoot }}>
      <div ref={sentinel} aria-hidden className="pointer-events-none -mb-px h-px" />
      <header
        ref={(node) => {
          header.current = node;
          if (typeof ref === "function") return ref(node);
          if (ref) ref.current = node;
        }}
        data-scrolled={scrolled ? "" : undefined}
        style={{ top: offset, ...style }}
        className={cn(
          "sticky z-(--z-sticky) border-b border-transparent bg-transparent",
          // The surface fades in over 200ms; the blur switches on with it (a backdrop
          // filter is never animated) and is invisible until something is beneath.
          "transition-[background-color,border-color] duration-200 ease-out-quart",
          "data-scrolled:border-line data-scrolled:bg-[color-mix(in_oklab,var(--sticky-header-bg,var(--frame))_97%,transparent)]",
          "supports-backdrop-filter:data-scrolled:bg-[color-mix(in_oklab,var(--sticky-header-bg,var(--frame))_78%,transparent)] supports-backdrop-filter:data-scrolled:backdrop-blur-md supports-backdrop-filter:data-scrolled:backdrop-saturate-150",
          "contrast-more:data-scrolled:border-line-2 contrast-more:data-scrolled:bg-[var(--sticky-header-bg,var(--frame))]",
          className,
        )}
        {...rest}
      >
        {children}
      </header>
    </StickyHeaderContext>
  );
}

export type StickyHeaderTitleProps = Omit<React.ComponentProps<"span">, "aria-hidden"> & {
  /** The heading in the content. The title slides in once it has gone under the header. */
  watch: Target;
};

/**
 * A compact copy of the page title that rises into the header as the real
 * heading scrolls beneath it, and sinks back out when it returns.
 */
export function StickyHeaderTitle({ watch, className, children, ...rest }: StickyHeaderTitleProps) {
  const { height, offset, root } = useContext(StickyHeaderContext);
  const shown = useScrolledPast(watch, { root, offset: offset + height, enabled: height > 0 });
  return (
    <span
      // The heading itself is already in the reading order; this is its echo.
      aria-hidden
      data-state={shown ? "shown" : "hidden"}
      className={cn(
        "block min-w-0 truncate",
        "transition-[opacity,translate,filter] duration-200 ease-out-expo motion-reduce:translate-y-0 motion-reduce:blur-none",
        "data-[state=hidden]:pointer-events-none data-[state=hidden]:translate-y-1.5 data-[state=hidden]:opacity-0 data-[state=hidden]:blur-[2px] data-[state=hidden]:duration-150 data-[state=hidden]:ease-out-quart",
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
