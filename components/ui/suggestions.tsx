"use client";
import { AnimatePresence, MotionConfig, motion, useReducedMotion, type Variants } from "motion/react";
import { Children, createContext, isValidElement, useContext, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ArrowRight } from "@/lib/icons";
import { ease, spring, stagger } from "@/lib/motion";

type Ctx = {
  layout: "chips" | "list";
  onPick?: (prompt: string) => void;
  reduce: boolean;
  group: string;
  hovered: string | null;
  setHovered: (id: string | null) => void;
};
const SuggestionsContext = createContext<Ctx | null>(null);
const IndexContext = createContext(0);

export type SuggestionsProps = React.ComponentProps<"div"> & {
  /** "chips" wrap, and scroll sideways when the space is narrow. "list" stacks full-width rows. */
  layout?: "chips" | "list";
  /** Suggestions are being generated: shows placeholder chips of the same shape. */
  loading?: boolean;
  /** Called with a suggestion's prompt when it's picked. Fill your input with it. */
  onPick?: (prompt: string) => void;
  /** The group's accessible name. */
  label?: string;
};

const container: Variants = { hidden: {}, show: {} };

/**
 * Prompt suggestions: the ways in when the box is empty, or the next question
 * after an answer. They arrive once with a short stagger; picking one hands its
 * full prompt to you to put in the input.
 */
export function Suggestions({ layout = "chips", loading = false, onPick, label = "Suggestions", className, children, ...rest }: SuggestionsProps) {
  const reduce = !!useReducedMotion();
  const group = useId();
  const [hovered, setHovered] = useState<string | null>(null);
  const row = useRef<HTMLUListElement>(null);

  // Mark which ends of a sideways-scrolling row have more beyond them.
  useEffect(() => {
    const el = row.current;
    if (!el || loading) return;
    const mark = () => {
      const end = el.scrollWidth - el.clientWidth - Math.abs(el.scrollLeft);
      el.toggleAttribute("data-more-start", Math.abs(el.scrollLeft) > 2);
      el.toggleAttribute("data-more-end", end > 2);
    };
    mark();
    el.addEventListener("scroll", mark, { passive: true });
    const ro = new ResizeObserver(mark);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", mark);
      ro.disconnect();
    };
  }, [loading, layout]);

  const chips = layout === "chips";

  return (
    <SuggestionsContext.Provider value={{ layout, onPick, reduce, group, hovered, setHovered }}>
      {/* Reduced motion: transforms jump to their end, the fade stays. The first frame is the same either way, so server and client agree. */}
      <MotionConfig reducedMotion="user">
      <div role="group" aria-label={label} aria-busy={loading || undefined} data-layout={layout} className={cn("@container relative min-w-0", className)} {...rest}>
        <AnimatePresence mode="popLayout">
          {loading ? (
            <motion.ul
              key="loading"
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              className={cn(chips ? "flex flex-wrap gap-2 @max-md:flex-nowrap @max-md:overflow-hidden" : "flex flex-col gap-1")}
            >
              {(chips ? [148, 188, 120, 164] : [0, 1, 2]).map((w, i) => (
                <li
                  key={i}
                  style={chips ? { width: w } : undefined}
                  className={cn("shrink-0 animate-pulse-soft rounded-full bg-fg/[0.06]", chips ? "h-8" : "h-10 w-full rounded-lg")}
                />
              ))}
            </motion.ul>
          ) : (
            <motion.ul
              key="ready"
              ref={row}
              variants={container}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              onPointerLeave={() => setHovered(null)}
              className={cn(
                chips
                  ? cn(
                      "flex flex-wrap gap-2",
                      // Narrow: one row that scrolls sideways and snaps, with the edges faded where there's more.
                      "@max-md:flex-nowrap @max-md:snap-x @max-md:snap-mandatory @max-md:overflow-x-auto @max-md:overscroll-x-contain @max-md:[scrollbar-width:none]",
                      // Room inside the scroller for focus rings and shadows.
                      "@max-md:-m-1 @max-md:p-1 @max-md:scroll-px-1",
                      "@max-md:data-more-end:[mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]",
                      "@max-md:data-more-start:[mask-image:linear-gradient(to_right,transparent,black_28px)]",
                      "@max-md:data-more-start:data-more-end:[mask-image:linear-gradient(to_right,transparent,black_28px,black_calc(100%-28px),transparent)]",
                    )
                  : "relative flex flex-col",
              )}
            >
              {Children.toArray(children).map((child, i) => (
                <IndexContext.Provider key={isValidElement(child) && child.key != null ? child.key : i} value={i}>
                  {child}
                </IndexContext.Provider>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
      </MotionConfig>
    </SuggestionsContext.Provider>
  );
}

export type SuggestionProps = Omit<React.ComponentProps<"button">, "children"> & {
  /** What the suggestion says. */
  children: React.ReactNode;
  /** The full prompt handed to onPick. Defaults to the label when it's a string. */
  prompt?: string;
  /** A 16px icon before the label. */
  icon?: React.ReactNode;
};

export function Suggestion({ children, prompt, icon, className, onClick, ...rest }: SuggestionProps) {
  const ctx = useContext(SuggestionsContext);
  if (!ctx) throw new Error("Suggestion must be used inside Suggestions");
  const { layout, onPick, reduce, group, hovered, setHovered } = ctx;
  const id = useId();
  const index = useContext(IndexContext);
  const full = prompt ?? (typeof children === "string" ? children : "");
  const chips = layout === "chips";

  // Arrive in order, 25ms apart; after the eighth nobody waits any longer.
  const delay = 0.04 + Math.min(index, 7) * stagger.items * 1.25;
  const item: Variants = {
    hidden: { opacity: 0, y: 6, scale: 0.97, filter: "blur(2px)" },
    show: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transition: { duration: reduce ? 0.16 : 0.32, ease: ease.out, delay } },
  };

  return (
    <motion.li variants={item} className={cn("relative min-w-0", chips ? "shrink-0 @max-md:snap-start" : "")}>
      {!chips && (
        <AnimatePresence>
          {hovered === id && (
            // One highlight for the whole list, gliding to whichever row is under the pointer.
            <motion.span
              layoutId={`${group}-highlight`}
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={reduce ? { duration: 0 } : spring.follow}
              className="pointer-events-none absolute inset-0 rounded-lg bg-hover"
            />
          )}
        </AnimatePresence>
      )}
      <button
        type="button"
        onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(id)}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented && full) onPick?.(full);
        }}
        className={cn(
          "group/suggestion relative flex min-w-0 select-none items-center outline-none",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "disabled:pointer-events-none disabled:opacity-50",
          chips
            ? cn(
                "h-8 max-w-[18rem] gap-1.5 rounded-full border border-line-2 bg-raised px-3 text-[12.5px] text-fg-2 shadow-[var(--shadow)]",
                "transition-[background-color,border-color,color,scale] duration-150 ease-out hover:border-fg-4 hover:bg-hover hover:text-fg active:scale-[0.96] active:duration-75",
                // 32px drawn, 44px to a finger.
                "before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
                icon ? "ps-2.5" : undefined,
              )
            : cn(
                "h-10 w-full gap-2.5 rounded-lg px-3 text-left text-[13px] text-fg-2",
                "transition-[color,scale] duration-150 ease-out hover:text-fg active:scale-[0.99] active:duration-75 pointer-coarse:active:bg-hover",
              ),
          className,
        )}
        {...rest}
      >
        {icon && (
          <span aria-hidden className="grid size-4 shrink-0 place-items-center text-fg-3 transition-colors duration-150 group-hover/suggestion:text-fg-2 [&_svg]:size-4">
            {icon}
          </span>
        )}
        <span className="min-w-0 truncate">{children}</span>
        {!chips && (
          <ArrowRight
            size={14}
            className="ms-auto shrink-0 text-fg-4 transition-[translate,color] duration-150 ease-out group-hover/suggestion:translate-x-0.5 group-hover/suggestion:text-fg-3 motion-reduce:transition-none"
          />
        )}
      </button>
    </motion.li>
  );
}
