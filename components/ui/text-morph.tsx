"use client";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

/**
 * Stable keys per character: the nth "e" in one string is the nth "e" in the
 * next, so shared letters are the same element and glide to their new place.
 */
export function morphKeys(text: string) {
  const seen = new Map<string, number>();
  return Array.from(text).map((char) => {
    const n = seen.get(char) ?? 0;
    seen.set(char, n + 1);
    return { char, key: `${char === " " ? "space" : char}-${n}` };
  });
}

export type TextMorphProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & {
  /** The current text. Change it and shared characters move into place. Single line. */
  children: string;
  /** Animate the width too, so a button or pill around it resizes smoothly instead of snapping. */
  animateWidth?: boolean;
  ref?: React.Ref<HTMLSpanElement>;
};

/**
 * Morphs between two strings: letters both share slide to where they sit in
 * the new word, the rest blur out and in. For labels that change in place,
 * "Deploy" to "Deploying", "Draft" to "Published", "Follow" to "Following".
 */
export function TextMorph({ children, animateWidth = true, className, style, ref, ...rest }: TextMorphProps) {
  const reduce = useReducedMotion();
  const self = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  // "auto" until measured, so the server render and first paint are the plain width.
  const width = useMotionValue<number | "auto">("auto");
  const chars = morphKeys(children);

  // Follow the natural width of the string: the first measurement is applied as
  // is, every change after it springs, so the button around it resizes smoothly.
  useEffect(() => {
    const el = inner.current;
    if (!el || !animateWidth) return;
    let running: ReturnType<typeof animate> | undefined;
    const ro = new ResizeObserver(() => {
      const next = el.offsetWidth;
      const now = width.get();
      if (now === "auto" || reduce) return width.set(next);
      if (now === next) return;
      running?.stop();
      // While the width is moving, the trailing edge feathers so letters are
      // unveiled (or tucked away) softly instead of drawing over the padding.
      self.current?.setAttribute("data-resizing", "");
      const current = animate(width, next, spring.soft);
      running = current;
      current.then(() => {
        if (running === current) self.current?.removeAttribute("data-resizing");
      });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      running?.stop();
      width.set("auto");
    };
  }, [animateWidth, reduce, width]);

  const move = reduce ? { duration: 0 } : spring.soft;

  return (
    <motion.span
      ref={(node: HTMLSpanElement | null) => {
        self.current = node;
        if (typeof ref === "function") return ref(node);
        if (ref) (ref as React.RefObject<HTMLSpanElement | null>).current = node;
      }}
      data-text-morph=""
      style={{ ...style, width }}
      className={cn(
        "relative inline-block whitespace-nowrap align-bottom",
        "data-resizing:mask-r-from-[calc(100%-0.6em)] data-resizing:mask-r-to-100%",
        className,
      )}
      {...(rest as React.ComponentProps<typeof motion.span>)}
    >
      <span className="sr-only">{children}</span>
      <span ref={inner} aria-hidden className="relative inline-flex w-max">
        <AnimatePresence mode="popLayout" initial={false}>
          {chars.map(({ char, key }) => (
            <motion.span
              key={key}
              layout={reduce ? false : "position"}
              initial={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(3px)", scale: 0.85 }}
              animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
              exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, filter: "blur(3px)", scale: 0.85, transition: { duration: 0.14, ease: ease.in } }}
              transition={{
                layout: move,
                // New letters arrive a beat after the shared ones start moving, so the eye follows the move first.
                default: reduce ? { duration: 0.15 } : { duration: 0.26, ease: ease.out, delay: 0.06 },
              }}
              className="inline-block whitespace-pre"
            >
              {char}
            </motion.span>
          ))}
        </AnimatePresence>
      </span>
    </motion.span>
  );
}
