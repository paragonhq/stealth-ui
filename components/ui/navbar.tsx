"use client";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

/* -------------------------------------------------------------------------------------------------
 * Scroll state
 * -----------------------------------------------------------------------------------------------*/

export type NavbarScrollState = { compact: boolean; hidden: boolean };

/**
 * Whether a page has scrolled past `compactAfter`, and whether the bar should step
 * aside because the reader is scrolling down through content. Reads the window, or
 * `target` when the page scrolls inside an element. Updates at most once a frame and
 * only re-renders when either flag flips.
 */
export function useNavbarScroll({
  target,
  compactAfter = 8,
  hideOnScroll = false,
}: { target?: React.RefObject<HTMLElement | null>; compactAfter?: number; hideOnScroll?: boolean } = {}) {
  const [state, setState] = useState<NavbarScrollState>({ compact: false, hidden: false });

  useEffect(() => {
    const el = target?.current ?? null;
    const read = () => (el ? el.scrollTop : window.scrollY);
    let last = read();
    let travel = 0;
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = read();
      const delta = y - last;
      last = y;
      // Direction has to persist for a few pixels before the bar reacts, so a trackpad's
      // tremor at rest never flickers it.
      travel = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta;
      setState((prev) => {
        const compact = y > compactAfter;
        let hidden = prev.hidden;
        if (!hideOnScroll || y < 120) hidden = false;
        else if (travel > 12) hidden = true;
        else if (travel < -6) hidden = false;
        return prev.compact === compact && prev.hidden === hidden ? prev : { compact, hidden };
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const source: HTMLElement | Window = el ?? window;
    source.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      source.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [target, compactAfter, hideOnScroll]);

  return state;
}

/* -------------------------------------------------------------------------------------------------
 * Root
 * -----------------------------------------------------------------------------------------------*/

const NavbarContext = createContext<NavbarScrollState>({ compact: false, hidden: false });

export type NavbarProps = React.ComponentProps<"div"> & {
  /** The element the page scrolls in. Defaults to the window. */
  target?: React.RefObject<HTMLElement | null>;
  /** Pixels of scroll before the bar compacts and takes on its backdrop. */
  compactAfter?: number;
  /** Slide the bar away while scrolling down past 120px, and back on the first scroll up. */
  hideOnScroll?: boolean;
  /** Where the bar's content stops growing. */
  maxWidth?: number;
};

/**
 * A sticky top bar. It reserves 56px in the page, and when the page scrolls it
 * compacts to 48px inside that space, so nothing below it ever moves.
 */
export function Navbar({ target, compactAfter = 8, hideOnScroll = false, maxWidth = 1120, className, children, ...rest }: NavbarProps) {
  const scroll = useNavbarScroll({ target, compactAfter, hideOnScroll });
  const [focusWithin, setFocusWithin] = useState(false);
  const hidden = scroll.hidden && !focusWithin;

  return (
    <NavbarContext.Provider value={scroll}>
      <div className={cn("@container sticky top-0 z-(--z-sticky) h-14", className)} {...rest}>
        <header
          data-compact={scroll.compact || undefined}
          data-hidden={hidden || undefined}
          // A keyboard user tabbing into a hidden bar brings it back.
          onFocus={() => setFocusWithin(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false);
          }}
          className={cn(
            "group/nav absolute inset-x-0 top-0 flex h-14 items-center border-b border-transparent",
            // The backdrop never animates its blur; only the tint and the hairline fade in over it.
            "backdrop-blur-md backdrop-saturate-150 transition-[height,background-color,border-color,translate] duration-220 ease-out-quart",
            "data-compact:h-12 data-compact:border-line data-compact:bg-frame/80",
            "data-hidden:-translate-y-full data-hidden:duration-260 data-hidden:ease-in-out-quart",
          )}
        >
          <div className="mx-auto flex h-full w-full min-w-0 items-center gap-2 px-4 @min-[48rem]:px-6" style={{ maxWidth }}>
            {children}
          </div>
        </header>
      </div>
    </NavbarContext.Provider>
  );
}

/** Reads the bar's scroll state from inside it: `{ compact, hidden }`. */
export function useNavbar() {
  return useContext(NavbarContext);
}

/* -------------------------------------------------------------------------------------------------
 * Brand and actions
 * -----------------------------------------------------------------------------------------------*/

export type NavbarBrandProps = useRender.ComponentProps<"a">;

/** The logo link. It settles 6% smaller as the bar compacts. */
export function NavbarBrand({ render, className, ...rest }: NavbarBrandProps) {
  return useRender({
    defaultTagName: "a",
    render,
    props: mergeProps<"a">(
      {
        className: cn(
          "mr-2 flex shrink-0 origin-left items-center gap-2 rounded-md text-[14px] font-medium tracking-[-0.02em] text-fg no-underline outline-none",
          "transition-[scale] duration-220 ease-out-quart group-data-compact/nav:scale-[0.94] active:scale-[0.97]",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-fg-3",
          className,
        ),
      },
      rest,
    ),
  });
}

export type NavbarActionsProps = React.ComponentProps<"div">;

/** The right side: sign in, the primary call to action, an avatar. */
export function NavbarActions({ className, ...rest }: NavbarActionsProps) {
  return <div className={cn("ml-auto flex shrink-0 items-center gap-1.5", className)} {...rest} />;
}

export type NavbarMobileProps = React.ComponentProps<"div">;

/** Shown only when the bar is too narrow for its links: put your mobile menu here. */
export function NavbarMobile({ className, ...rest }: NavbarMobileProps) {
  return <div className={cn("flex shrink-0 items-center @min-[40rem]:hidden", className)} {...rest} />;
}

/* -------------------------------------------------------------------------------------------------
 * Links and the pill that follows the pointer
 * -----------------------------------------------------------------------------------------------*/

type PillContextValue = { enter: (el: HTMLElement) => void };
const PillContext = createContext<PillContextValue | null>(null);

export type NavbarLinksProps = React.ComponentProps<"ul"> & { "aria-label"?: string };

/**
 * The link row. One pill rests under the current page, follows the pointer across
 * the other links, and springs home when the pointer leaves. Hidden below 640px of
 * bar width, where NavbarMobile takes over.
 */
export function NavbarLinks({ className, children, "aria-label": label = "Main", ...rest }: NavbarLinksProps) {
  const reduce = !!useReducedMotion();
  const listRef = useRef<HTMLUListElement>(null);
  const x = useMotionValue(0);
  const width = useMotionValue(0);
  const [on, setOn] = useState(false);
  const shown = useRef(false);
  const hovering = useRef(false);

  const moveTo = useCallback(
    (el: HTMLElement | null) => {
      if (!el) {
        shown.current = false;
        setOn(false);
        return;
      }
      if (shown.current && !reduce) {
        animate(x, el.offsetLeft, spring.follow);
        animate(width, el.offsetWidth, spring.follow);
      } else {
        x.jump(el.offsetLeft);
        width.jump(el.offsetWidth);
      }
      shown.current = true;
      setOn(true);
    },
    [reduce, x, width],
  );

  const home = useCallback(() => moveTo(listRef.current?.querySelector<HTMLElement>("[aria-current=page]") ?? null), [moveTo]);

  // Whenever the current page changes (a click, a route change, a scroll spy), the
  // pill goes home, unless the pointer is holding it somewhere else right now.
  useLayoutEffect(() => {
    if (!hovering.current) home();
  });

  // Fonts loading or the bar resizing moves the links; keep the pill under them.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const ro = new ResizeObserver(() => {
      if (!hovering.current) home();
    });
    ro.observe(list);
    return () => ro.disconnect();
  }, [home]);

  return (
    <PillContext.Provider value={{ enter: (el) => ((hovering.current = true), moveTo(el)) }}>
      <nav aria-label={label} className="hidden min-w-0 @min-[40rem]:block">
        <ul
          ref={listRef}
          onPointerLeave={() => {
            hovering.current = false;
            home();
          }}
          className={cn("relative flex items-center", className)}
          {...rest}
        >
          <motion.li
            aria-hidden
            className="pointer-events-none absolute left-0 top-1/2 -mt-4 h-8 rounded-full bg-hover"
            style={{ x, width }}
            initial={false}
            animate={{ opacity: on ? 1 : 0 }}
            transition={{ duration: on ? 0.12 : 0.15, ease: "easeOut" }}
          />
          {children}
        </ul>
      </nav>
    </PillContext.Provider>
  );
}

export type NavbarLinkProps = useRender.ComponentProps<"a"> & {
  /** Marks the current page: aria-current, full-strength text, and the pill's home. */
  active?: boolean;
};

export function NavbarLink({ active = false, render, className, onPointerEnter, ...rest }: NavbarLinkProps) {
  const pill = useContext(PillContext);
  const element = useRender({
    defaultTagName: "a",
    render,
    props: mergeProps<"a">(
      {
        "aria-current": active ? "page" : undefined,
        onPointerEnter: (e: React.PointerEvent<HTMLAnchorElement>) => {
          onPointerEnter?.(e);
          if (e.pointerType !== "touch") pill?.enter(e.currentTarget);
        },
        className: cn(
          "relative flex h-8 items-center whitespace-nowrap rounded-full px-3 text-[13px] text-fg-2 no-underline outline-none",
          "transition-[color,scale] duration-150 hover:text-fg active:scale-[0.97] active:duration-75 aria-[current=page]:text-fg",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
          "before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] pointer-fine:before:hidden",
          className,
        ),
      },
      rest,
    ),
  });
  // The li stays unpositioned so the link measures against the list, where the pill lives.
  return <li>{element}</li>;
}
