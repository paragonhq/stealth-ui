"use client";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { ease, stagger as staggers } from "@/lib/motion";

type Tag = "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div";

export type TextRevealProps = Omit<React.HTMLAttributes<HTMLElement>, "children"> & {
  /** The text. Plain text only, so it can be split into words. */
  children: string;
  /** The element to render. A heading keeps its heading semantics. */
  as?: Tag;
  /** Reveal word by word (headings), or line by line as the text actually wraps (paragraphs). */
  by?: "word" | "line";
  /** Reveal when it scrolls into view, or as soon as it mounts (above the fold). */
  trigger?: "view" | "mount";
  /** Seconds before the first unit. */
  delay?: number;
  /** Seconds between units. Long text compresses it so the last unit never trails behind `maxSpread`. */
  stagger?: number;
  /** Seconds from the first unit starting to the last one starting, at most. */
  maxSpread?: number;
  /** Seconds for each unit's entrance. */
  duration?: number;
  /** How far each unit lifts, as a CSS length. Em keeps it proportional to the type size. */
  distance?: string;
  /** The blur it clears from, as a CSS length. */
  blur?: string;
  /** The scroll container, when it isn't the page. */
  root?: React.RefObject<Element | null>;
  /** Called once, when the last unit has settled. */
  onRevealed?: () => void;
  ref?: React.Ref<HTMLElement>;
};

/**
 * Words (or lines) lift out of a blur in reading order, once, on first view.
 * The whole string stays in the element for screen readers, find-in-page and
 * copy; the animated split is decoration on top. With reduced motion, or
 * without JavaScript, the text is simply there.
 */
export function TextReveal({
  children,
  as: Tag = "span",
  by = "word",
  trigger = "view",
  delay = 0,
  stagger,
  maxSpread = 0.6,
  duration,
  distance = "0.3em",
  blur = "0.2em",
  root,
  onRevealed,
  className,
  ref,
  ...rest
}: TextRevealProps) {
  const reduce = useReducedMotion();
  const self = useRef<HTMLElement>(null);
  const opts = useRef({ by, delay, stagger, maxSpread, duration, distance, blur, onRevealed });
  useEffect(() => {
    opts.current = { by, delay, stagger, maxSpread, duration, distance, blur, onRevealed };
  });

  useEffect(() => {
    const el = self.current;
    if (!el || el.hasAttribute("data-revealed")) return;
    const show = () => {
      el.setAttribute("data-revealed", "");
      opts.current.onRevealed?.();
    };
    if (reduce) return show();

    const running: Animation[] = [];
    const play = () => {
      const o = opts.current;
      const units = Array.from(el.querySelectorAll<HTMLElement>("[data-unit]"));
      // Lines are whatever the browser wrapped at this width, read at the moment
      // of playing, so a resize before the reveal never groups words wrongly.
      const groups: HTMLElement[][] = [];
      if (o.by === "line") {
        let top = 0;
        for (const u of units) {
          if (!groups.length || Math.abs(u.offsetTop - top) > 2) groups.push([]);
          top = u.offsetTop;
          groups[groups.length - 1].push(u);
        }
      } else units.forEach((u) => groups.push([u]));

      const each = o.stagger ?? (o.by === "line" ? staggers.lines : staggers.words);
      const step = groups.length > 1 ? Math.min(each, o.maxSpread / (groups.length - 1)) : 0;
      const length = (o.duration ?? (o.by === "line" ? 0.8 : 0.64)) * 1000;
      groups.forEach((group, i) =>
        group.forEach((u) =>
          running.push(
            // Web Animations with fill "backwards": held hidden through the delay,
            // and nothing left on the element afterwards.
            u.animate(
              [
                { opacity: 0, transform: `translateY(${o.distance})`, filter: `blur(${o.blur})` },
                { opacity: 1, transform: "none", filter: "blur(0px)" },
              ],
              { duration: length, delay: (o.delay + i * step) * 1000, easing: `cubic-bezier(${ease.out.join(",")})`, fill: "backwards" },
            ),
          ),
        ),
      );
      el.setAttribute("data-revealed", "");
      running.at(-1)?.finished.then(() => opts.current.onRevealed?.(), () => {});
    };

    if (trigger === "mount") {
      play();
      return () => running.forEach((a) => a.cancel());
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        // Scrolled past before it was seen (an anchor jump, a restored scroll): no show.
        const above = entry.boundingClientRect.bottom < (entry.rootBounds?.top ?? 0);
        if (!entry.isIntersecting && !above) return;
        io.disconnect();
        if (above) show();
        else play();
      },
      { root: root?.current ?? null, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      running.forEach((a) => a.cancel());
    };
  }, [reduce, trigger, root]);

  // Whitespace stays as real text between the word boxes, so the browser wraps
  // (and balances) the line exactly as it would the plain string.
  const parts = children.split(/(\s+)/).filter(Boolean);

  return (
    <>
      <Tag
        ref={(node: HTMLElement | null) => {
          self.current = node;
          if (typeof ref === "function") return ref(node);
          if (ref) (ref as React.RefObject<HTMLElement | null>).current = node;
        }}
        data-text-reveal=""
        data-by={by}
        className={cn(
          // Hidden until revealed, only when motion is welcome; reduced motion never hides anything.
          "motion-safe:[&:not([data-revealed])_[data-unit]]:opacity-0 print:[&_[data-unit]]:opacity-100!",
          className,
        )}
        {...rest}
      >
        <span className="sr-only select-none">{children}</span>
        <span aria-hidden>
          {parts.map((part, i) =>
            /^\s+$/.test(part) ? (
              part
            ) : (
              <span key={i} data-unit="" className="inline-block">
                {part}
              </span>
            ),
          )}
        </span>
      </Tag>
      {/* Without JavaScript nothing would ever reveal, so nothing hides. */}
      <noscript>
        <style>{"[data-text-reveal] [data-unit]{opacity:1!important}"}</style>
      </noscript>
    </>
  );
}
