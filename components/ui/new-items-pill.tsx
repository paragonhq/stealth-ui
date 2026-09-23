"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ArrowUp } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

const expo = `cubic-bezier(${ease.out.join(",")})`;
const digitTiming = {
  transformTiming: { duration: 420, easing: expo },
  spinTiming: { duration: 420, easing: expo },
  opacityTiming: { duration: 160, easing: "ease-out" },
};

type Key = string | number;

/**
 * Holds items that arrive at the top of a feed until the reader asks for them,
 * so nothing moves under someone who is reading. Items added anywhere else
 * (the next page at the bottom) flow straight in.
 */
export function useNewItems<T>(
  items: T[],
  { getKey, scrollRef, freshFor = 2400 }: { getKey: (item: T) => Key; scrollRef: React.RefObject<HTMLElement | null>; freshFor?: number },
) {
  const reduce = useReducedMotion();
  const [seen, setSeen] = useState(() => new Set(items.map(getKey)));
  const [fresh, setFresh] = useState<Set<Key>>(() => new Set());
  const timer = useRef(0);
  const frame = useRef(0);
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      cancelAnimationFrame(frame.current);
    },
    [],
  );

  // A feed that started empty takes its first batch straight away.
  if (seen.size === 0 && items.length > 0) setSeen(new Set(items.map(getKey)));

  // Pending is everything above the newest item already on screen.
  const firstSeen = items.findIndex((item) => seen.has(getKey(item)));
  const cut = firstSeen === -1 ? (seen.size ? items.length : 0) : firstSeen;
  const pending = items.slice(0, cut);
  const visible = items.slice(cut);

  const reveal = useCallback(() => {
    const scroller = scrollRef.current;
    const keys = pending.map(getKey);
    const hadFocus = !!(document.activeElement as HTMLElement | null)?.closest("[data-new-items-pill]");
    const commit = () => {
      setSeen(new Set(items.map(getKey)));
      setFresh(new Set(keys));
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setFresh(new Set()), freshFor);
      // The pill is about to leave; don't drop keyboard focus on the floor.
      if (hadFocus) scroller?.focus({ preventScroll: true });
    };
    if (!scroller || scroller.scrollTop <= 1) return commit();
    scroller.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    // Insert once the scroll has landed, so the new rows arrive in view instead of shoving the page mid-scroll.
    const started = performance.now();
    const wait = () => {
      if (scroller.scrollTop <= 1 || performance.now() - started > 700) return commit();
      frame.current = requestAnimationFrame(wait);
    };
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(wait);
  }, [pending, items, getKey, scrollRef, reduce, freshFor]);

  return { visible, pending, reveal, fresh };
}

export type NewItemsPillAuthor = { id: string; name: string };

export type NewItemsPillProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** How many items are waiting. The pill shows above 0. */
  count: number;
  /** Scroll to the top and insert the waiting items. `reveal` from useNewItems. */
  onReveal: () => void;
  /** The noun after the number, singular and plural. */
  noun?: { one: string; other: string };
  /** Who posted them. The latest three show as a stack of initials. */
  authors?: NewItemsPillAuthor[];
  /** absolute sits over the nearest positioned parent (the feed); fixed pins to the viewport. */
  position?: "absolute" | "fixed";
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function NewItemsPill({
  count,
  onReveal,
  noun = { one: "new update", other: "new updates" },
  authors = [],
  position = "absolute",
  className,
  ...rest
}: NewItemsPillProps) {
  const reduce = useReducedMotion();
  const [scope, animate] = useAnimate<HTMLButtonElement>();
  const previous = useRef(count);
  const word = count === 1 ? noun.one : noun.other;
  const faces = authors.slice(-3);

  // More arriving while it's already showing: a small nudge, not a second entrance.
  useEffect(() => {
    const was = previous.current;
    previous.current = count;
    if (reduce || was <= 0 || count <= was || !scope.current) return;
    animate(scope.current, { scale: 1.05 }, { duration: 0.09, ease: ease.out }).then(() => {
      if (scope.current) animate(scope.current, { scale: 1 }, spring.pop);
    });
  }, [count, reduce, animate, scope]);

  return (
    <div
      data-slot="new-items-pill"
      className={cn("pointer-events-none left-1/2 top-3 z-(--z-sticky) -translate-x-1/2", position === "fixed" ? "fixed" : "absolute", className)}
      {...rest}
    >
      <AnimatePresence>
        {count > 0 && (
          <motion.div
            key="pill"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.96, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, y: -12, scale: 0.98, transition: { duration: 0.16, ease: ease.in } }}
            transition={reduce ? { duration: 0.15 } : spring.snappy}
          >
            <button
              ref={scope}
              type="button"
              data-new-items-pill=""
              onClick={onReveal}
              className={cn(
                "group/pill pointer-events-auto relative flex h-8 items-center gap-2 whitespace-nowrap rounded-full bg-fg pl-2.5 pr-3 text-[12.5px] font-medium tracking-[-0.005em] text-frame shadow-pop",
                "outline-none transition-[background-color,scale] duration-150 hover:bg-fg/90 active:scale-[0.96] active:duration-75",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                // A 32px pill still gets a 44px target on touch.
                "before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
              )}
            >
              <ArrowUp size={14} className="shrink-0 transition-transform duration-200 ease-out group-hover/pill:-translate-y-px" />
              {faces.length > 0 && (
                <span aria-hidden className="flex -space-x-1">
                  <AnimatePresence initial={false} mode="popLayout">
                    {faces.map((a) => (
                      <motion.span
                        key={a.id}
                        layout={!reduce}
                        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, x: -6 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.12 } }}
                        transition={reduce ? { duration: 0.12 } : spring.pop}
                        className="grid size-5 place-items-center rounded-full bg-frame text-[9px] font-medium tracking-normal text-fg shadow-[0_0_0_1.5px_var(--fg)]"
                      >
                        {initials(a.name)}
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </span>
              )}
              <span className="flex items-center gap-[0.3em]">
                <NumberFlow value={count} {...digitTiming} className="tabular" />
                <span>{word}</span>
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <span role="status" aria-live="polite" className="sr-only">
        {count > 0 ? `${count} ${word}` : ""}
      </span>
    </div>
  );
}
