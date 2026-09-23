"use client";
import { useReducedMotion } from "motion/react";
import { Children, createContext, use, useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

type Ctx = { index: number; top: number; peek: number };
const CardContext = createContext<Ctx | null>(null);

export type StackingCardsProps = React.ComponentProps<"ol"> & {
  /** The scroll container. Leave it out when the page itself scrolls. */
  root?: React.RefObject<HTMLElement | null>;
  /** Where the first card sticks, in px from the top of the scroll area. */
  top?: number;
  /** How much of each card behind shows above the next one, in px. */
  peek?: number;
  /** How much each card shrinks per card stacked on it. */
  scaleStep?: number;
  /** How much each card dims per card stacked on it (0–1). */
  dimStep?: number;
  /** Past this many cards on top, a card stops shrinking and dimming. */
  maxDepth?: number;
};

/**
 * Cards that stick as they reach the top and stack, the ones behind shrinking
 * and dimming as each new card slides over them. Tied to the scroll itself:
 * scroll back and the stack comes apart the same way.
 */
export function StackingCards({ root, top = 16, peek = 12, scaleStep = 0.045, dimStep = 0.14, maxDepth = 3, className, children, ...rest }: StackingCardsProps) {
  const reduce = useReducedMotion();
  const list = useRef<HTMLOListElement>(null);
  const opts = useRef({ top, peek, scaleStep, dimStep, maxDepth, reduce });
  useEffect(() => {
    opts.current = { top, peek, scaleStep, dimStep, maxDepth, reduce };
  });

  useEffect(() => {
    const ol = list.current;
    if (!ol) return;
    const scroller = root?.current ?? null;
    const target: HTMLElement | Window = scroller ?? window;
    const scrollTop = () => (scroller ? scroller.scrollTop : window.scrollY);
    const cards = () => Array.from(ol.children) as HTMLElement[];

    // Where each card sits in the flow, measured once per resize rather than per frame.
    let natural: number[] = [];
    let heights: number[] = [];
    let viewport = 0;
    const measure = () => {
      const els = cards();
      const rootTop = scroller ? scroller.getBoundingClientRect().top : 0;
      const gap = parseFloat(getComputedStyle(ol).rowGap) || 0;
      let y = ol.getBoundingClientRect().top - rootTop + scrollTop();
      natural = [];
      heights = els.map((el) => el.offsetHeight);
      els.forEach((_, i) => {
        natural.push(y);
        y += heights[i] + gap;
      });
      viewport = scroller ? scroller.clientHeight : window.innerHeight;
      paint();
    };

    const paint = () => {
      const { top: t, peek: pk, scaleStep: ss, dimStep: ds, maxDepth: md, reduce: r } = opts.current;
      const y = scrollTop();
      const els = cards();
      // How far each card has slid over the one before it: 0 below, 1 stuck on top.
      const arrived = natural.map((n, j) => {
        if (j === 0) return 0;
        const stick = n - (t + j * pk);
        const travel = Math.max(1, Math.min(heights[j - 1] ?? 1, viewport * 0.6));
        return Math.max(0, Math.min(1, 1 - (stick - y) / travel));
      });
      let depth = 0;
      for (let i = els.length - 1; i >= 0; i--) {
        const d = Math.min(md, depth);
        els[i].style.transform = r || d === 0 ? "" : `scale(${1 - d * ss})`;
        els[i].style.setProperty("--stack-dim", String(Math.min(0.6, d * ds)));
        els[i].toggleAttribute("data-covered", d > 0.5);
        depth += arrived[i] ?? 0;
      }
    };

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(paint);
    };
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    ro.observe(ol);
    cards().forEach((c) => ro.observe(c));
    if (scroller) ro.observe(scroller);
    target.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    measure();

    // Tabbing into a card that sits under others brings it back on top.
    const onFocusIn = (e: FocusEvent) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>("[data-stack-card]");
      if (!card?.hasAttribute("data-covered")) return;
      const i = cards().indexOf(card);
      const to = natural[i] - (opts.current.top + i * opts.current.peek);
      if (scroller) scroller.scrollTop = to;
      else window.scrollTo({ top: to });
    };
    ol.addEventListener("focusin", onFocusIn);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      ol.removeEventListener("focusin", onFocusIn);
    };
  }, [root, reduce]);

  return (
    <ol ref={list} className={cn("flex flex-col gap-4", className)} {...rest}>
      {Children.toArray(children).map((child, index) => (
        <CardContext key={(child as { key?: React.Key }).key ?? index} value={{ index, top, peek }}>
          {child}
        </CardContext>
      ))}
    </ol>
  );
}

export type StackingCardProps = React.ComponentProps<"li">;

/** One card. Style the surface with className; it keeps its radius when dimmed. */
export function StackingCard({ className, style, children, ...rest }: StackingCardProps) {
  const ctx = use(CardContext);
  if (!ctx) throw new Error("<StackingCard> must be inside <StackingCards>");
  return (
    <li
      data-stack-card=""
      className={cn(
        "sticky origin-top rounded-2xl border border-line-2 bg-raised shadow-pop will-change-transform [--stack-dim:0]",
        // The dim is a wash of the page color over the card, so it reads as receding in both themes.
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-page after:opacity-(--stack-dim) after:content-['']",
        className,
      )}
      style={{ top: ctx.top + ctx.index * ctx.peek, ...style }}
      {...rest}
    >
      {children}
    </li>
  );
}
