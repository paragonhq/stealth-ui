"use client";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

export type ScrollRevealProps = React.HTMLAttributes<HTMLElement> & {
  /** The element to render. Children are revealed, not the element itself. */
  as?: "div" | "section" | "ul" | "ol" | "article";
  /** Reveal each child as it enters, instead of the whole group at once. Use it for long lists and grids. */
  each?: boolean;
  /** Seconds between children arriving together. */
  stagger?: number;
  /** After this many children, the rest arrive with the last one's delay, so a long list never trails. */
  staggerCap?: number;
  /** Seconds for each child's entrance. */
  duration?: number;
  /** Seconds before the first child. */
  delay?: number;
  /** Rise in px. */
  distance?: number;
  /** Starting blur in px. 0 turns it off for large or image-heavy children. */
  blur?: number;
  /** The scroll container, when it isn't the page. */
  root?: React.RefObject<Element | null>;
  /** Fraction of each child that must be visible to reveal it (with each). A group reveals as its top edge enters. */
  threshold?: number;
  rootMargin?: string;
  ref?: React.Ref<HTMLElement>;
};

/**
 * Reveals its children once, as they scroll into view: a fade, an 8px rise and
 * a blur that clears. It never plays again. With reduced motion, or without
 * JavaScript, the children are simply there.
 */
export function ScrollReveal({
  as: Tag = "div",
  each = false,
  stagger = 0.05,
  staggerCap = 6,
  duration = 0.6,
  delay = 0,
  distance = 8,
  blur = 4,
  root,
  threshold = 0.2,
  rootMargin = "0px 0px -8% 0px",
  className,
  children,
  ref,
  ...rest
}: ScrollRevealProps) {
  const reduce = useReducedMotion();
  const self = useRef<HTMLElement>(null);
  const opts = useRef({ each, stagger, staggerCap, duration, delay, distance, blur });
  useEffect(() => {
    opts.current = { each, stagger, staggerCap, duration, delay, distance, blur };
  });

  useEffect(() => {
    const el = self.current;
    if (!el) return;
    const pending = () => Array.from(el.children).filter((c): c is HTMLElement => c instanceof HTMLElement && !c.hasAttribute("data-revealed"));

    // Nothing to animate: mark everything shown so the hiding rule lets go.
    if (reduce) {
      pending().forEach((c) => c.setAttribute("data-revealed", ""));
      return;
    }

    const play = (targets: HTMLElement[]) => {
      const o = opts.current;
      targets.forEach((child, i) => {
        child.setAttribute("data-revealed", "");
        // Web Animations with fill "backwards": hidden through its delay, and
        // nothing left behind afterwards to fight the child's own styles.
        child.animate(
          [
            { opacity: 0, transform: `translateY(${o.distance}px)`, filter: o.blur ? `blur(${o.blur}px)` : "none" },
            { opacity: 1, transform: "none", filter: o.blur ? "blur(0px)" : "none" },
          ],
          { duration: o.duration * 1000, delay: (o.delay + Math.min(i, o.staggerCap) * o.stagger) * 1000, easing: `cubic-bezier(${ease.out.join(",")})`, fill: "backwards" },
        );
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        const arriving: HTMLElement[] = [];
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          const above = entry.boundingClientRect.bottom < (entry.rootBounds?.top ?? 0);
          if (!entry.isIntersecting && !above) continue;
          io.unobserve(target);
          const kids = target === el ? pending() : [target];
          // Jumped past it (an anchor link, End, a restored scroll): show it without a show.
          if (above) kids.forEach((k) => k.setAttribute("data-revealed", ""));
          else arriving.push(...kids);
        }
        // Children arriving in the same frame stagger in document order.
        arriving.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
        if (arriving.length) play(arriving);
      },
      { root: root?.current ?? null, threshold: each ? threshold : 0, rootMargin },
    );

    const watch = () => {
      if (opts.current.each) pending().forEach((c) => io.observe(c));
      else io.observe(el);
    };
    watch();

    // Children added later (the next page of a feed) reveal as they enter, one by one.
    const mo = new MutationObserver(() => pending().forEach((c) => io.observe(c)));
    mo.observe(el, { childList: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
    // Observers are built once; the options above are read live.
  }, [reduce, root, threshold, rootMargin]);

  return (
    <>
      <Tag
        ref={(node: HTMLElement | null) => {
          self.current = node;
          if (typeof ref === "function") return ref(node);
          if (ref) (ref as React.RefObject<HTMLElement | null>).current = node;
        }}
        data-scroll-reveal=""
        className={cn(
          // Hidden until revealed, but only when motion is welcome; reduced motion never hides anything.
          "motion-safe:[&>*:not([data-revealed])]:opacity-0 print:[&>*]:opacity-100!",
          className,
        )}
        {...rest}
      >
        {children}
      </Tag>
      {/* Without JavaScript nothing would ever reveal, so nothing hides. */}
      <noscript>
        <style>{"[data-scroll-reveal]>*{opacity:1!important}"}</style>
      </noscript>
    </>
  );
}
