"use client";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { spring } from "@/lib/motion";

/** Width of the edge fades, and the scroll padding that keeps a focused or active link clear of them. */
const FADE = 40;

/** Marks which edges of a horizontal scroller have more to show, on the element itself, so scrolling never re-renders. */
function useOverflowEdges(ref: React.RefObject<HTMLElement | null>, target: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    const host = target.current;
    if (!el || !host) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = Math.abs(el.scrollLeft);
        const max = el.scrollWidth - el.clientWidth;
        const start = x > 1;
        const end = max - x > 1;
        el.style.setProperty("--fade-start", start ? `${FADE}px` : "0px");
        el.style.setProperty("--fade-end", end ? `${FADE}px` : "0px");
        host.toggleAttribute("data-overflow-start", start);
        host.toggleAttribute("data-overflow-end", end);
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [ref, target]);
}

const reducedNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Scrolls the strip, sideways only, until the element clears the fades. The page itself never moves. */
function reveal(scroller: HTMLElement, el: HTMLElement, smooth: boolean) {
  if (scroller.scrollWidth <= scroller.clientWidth) return;
  const left = el.offsetLeft - FADE;
  const right = el.offsetLeft + el.offsetWidth + FADE - scroller.clientWidth;
  const target = scroller.scrollLeft > left ? left : scroller.scrollLeft < right ? right : null;
  if (target !== null) scroller.scrollTo({ left: target, behavior: smooth && !reducedNow() ? "smooth" : "auto" });
}

export type SubNavProps = React.ComponentProps<"nav"> & {
  /** Names the landmark ("Project", "Billing"). Required when a page has more than one nav. */
  "aria-label": string;
  /** Draw a hairline under the strip that the active bar sits on. */
  bordered?: boolean;
};

/**
 * A strip of page links that scrolls sideways when it runs out of room. One
 * hover pill follows the pointer; one bar marks the current page.
 */
export function SubNav({ bordered = true, className, children, ...rest }: SubNavProps) {
  const host = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useOverflowEdges(scroller, host);

  // The hover pill: one element, moved on a spring, placed without travel when the pointer first arrives.
  const hx = useMotionValue(0);
  const hw = useMotionValue(0);
  const ho = useMotionValue(0);
  const shown = useRef(false);

  const onPointerOver = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const link = (e.target as HTMLElement).closest<HTMLElement>("[data-subnav-item]");
    if (!link || link.hasAttribute("data-disabled")) return;
    const x = link.offsetLeft;
    const w = link.offsetWidth;
    if (!shown.current || reduce) {
      hx.jump(x);
      hw.jump(w);
    } else {
      animate(hx, x, spring.follow);
      animate(hw, w, spring.follow);
    }
    shown.current = true;
    animate(ho, 1, { duration: 0.12 });
  };
  const onPointerLeave = () => {
    shown.current = false;
    animate(ho, 0, { duration: 0.15 });
  };

  // The current-page bar and its scroll position follow aria-current, wherever it comes from.
  useEffect(() => {
    const s = scroller.current;
    const l = list.current;
    const b = bar.current;
    if (!s || !l || !b) return;
    let first = true;
    const place = () => {
      const active = l.querySelector<HTMLElement>("[aria-current=page]");
      b.style.opacity = active ? "1" : "0";
      if (!active) return;
      b.style.transitionDuration = first ? "0ms" : "";
      b.style.translate = `${active.offsetLeft + 8}px 0`;
      b.style.width = `${Math.max(active.offsetWidth - 16, 8)}px`;
      reveal(s, active, !first);
      first = false;
    };
    place();
    const mo = new MutationObserver(place);
    mo.observe(l, { subtree: true, childList: true, attributeFilter: ["aria-current"] });
    const ro = new ResizeObserver(place);
    ro.observe(l);
    return () => {
      mo.disconnect();
      ro.disconnect();
    };
  }, []);

  const scrollByPage = (dir: 1 | -1) => {
    const s = scroller.current;
    if (!s) return;
    s.scrollBy({ left: dir * s.clientWidth * 0.7, behavior: reducedNow() ? "auto" : "smooth" });
  };

  return (
    <nav ref={host} className={cn("group/subnav relative min-w-0", className)} {...rest}>
      {bordered && <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-line" />}
      <div
        ref={scroller}
        onPointerOver={onPointerOver}
        onPointerLeave={onPointerLeave}
        // Tabbing along the strip keeps the focused link clear of the fade and the arrows.
        onFocus={(e) => {
          const link = (e.target as HTMLElement).closest<HTMLElement>("[data-subnav-item] > *");
          if (link && scroller.current) reveal(scroller.current, link, false);
        }}
        className={cn(
          "relative overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "[mask-image:linear-gradient(to_right,transparent,var(--fg)_var(--fade-start,0px),var(--fg)_calc(100%-var(--fade-end,0px)),transparent)]",
          "scroll-px-10",
        )}
      >
        {/* Decoration sits beside the list, not in it, so the list holds only list items. */}
        <div className="relative isolate h-11 w-max min-w-full">
          <motion.span
            aria-hidden
            className="pointer-events-none absolute top-1.5 left-0 -z-10 h-8 rounded-lg bg-fg/[0.06]"
            style={{ x: hx, width: hw, opacity: ho }}
          />
          <ul ref={list} className="flex h-full items-center gap-0.5">
            {children}
          </ul>
          <span
            ref={bar}
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-fg opacity-0 transition-[translate,width,opacity] duration-[260ms] ease-in-out-quart"
          />
        </div>
      </div>
      <ScrollButton dir={-1} onClick={() => scrollByPage(-1)} />
      <ScrollButton dir={1} onClick={() => scrollByPage(1)} />
    </nav>
  );
}

// Mouse affordances only: keyboard users tab through the links, which scroll themselves into view.
function ScrollButton({ dir, onClick }: { dir: 1 | -1; onClick: () => void }) {
  const Icon = dir === 1 ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden
      onClick={onClick}
      className={cn(
        "absolute top-1/2 z-10 -mt-3 grid size-6 place-items-center rounded-full border border-line-2 bg-raised text-fg-2 shadow-[var(--shadow)] outline-none",
        "transition-[opacity,scale,background-color,color] duration-150 ease-out-quart hover:bg-hover hover:text-fg active:scale-[0.9] active:duration-75",
        "pointer-coarse:before:absolute pointer-coarse:before:-inset-2.5 pointer-coarse:before:content-['']",
        dir === 1
          ? "right-1 pointer-events-none scale-90 opacity-0 group-data-overflow-end/subnav:pointer-events-auto group-data-overflow-end/subnav:scale-100 group-data-overflow-end/subnav:opacity-100"
          : "left-1 pointer-events-none scale-90 opacity-0 group-data-overflow-start/subnav:pointer-events-auto group-data-overflow-start/subnav:scale-100 group-data-overflow-start/subnav:opacity-100",
      )}
    >
      <Icon size={14} />
    </button>
  );
}

export type SubNavItemProps = useRender.ComponentProps<"a"> & {
  /** The current page. Sets aria-current and moves the bar here. */
  active?: boolean;
  /** Shown dimmed and not followable, for pages that aren't available yet. */
  disabled?: boolean;
  /** A count after the label ("Issues 12"). */
  count?: number;
  /** 16px icon before the label. */
  icon?: React.ReactNode;
};

export function SubNavItem({ active = false, disabled = false, count, icon, render, className, children, ...rest }: SubNavItemProps) {
  const element = useRender({
    defaultTagName: "a",
    render,
    props: mergeProps<"a">(
      {
        "aria-current": active ? "page" : undefined,
        "aria-disabled": disabled || undefined,
        tabIndex: disabled ? -1 : undefined,
        onClick: disabled ? (e: React.MouseEvent) => e.preventDefault() : undefined,
        className: cn(
          "group/item relative flex h-8 shrink-0 select-none items-center gap-2 rounded-lg px-2.5 text-[13px] whitespace-nowrap",
          "cursor-pointer touch-manipulation outline-none [-webkit-tap-highlight-color:transparent]",
          "text-fg-3 transition-colors duration-150 hover:text-fg aria-[current=page]:text-fg",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
          "aria-disabled:pointer-events-none aria-disabled:text-fg-4",
          className,
        ),
        children: (
          <span className="flex items-center gap-2 transition-[scale] duration-150 ease-out-quart group-active/item:scale-[0.97] group-active/item:duration-75">
            {icon && <span className="-ml-0.5 flex shrink-0 text-fg-4 transition-colors duration-150 group-hover/item:text-fg-3 group-aria-[current=page]/item:text-fg-2 [&_svg]:size-4">{icon}</span>}
            {children}
            {count !== undefined && (
              <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-fg/[0.06] px-1.5 text-[11px] leading-none text-fg-3 tabular">
                <span className="sr-only">(</span>
                {count}
                <span className="sr-only">)</span>
              </span>
            )}
          </span>
        ),
      },
      rest,
    ),
  });

  return (
    <li className="flex" data-subnav-item="" data-disabled={disabled || undefined}>
      {element}
    </li>
  );
}
