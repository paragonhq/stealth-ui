"use client";
import { useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useControllableState } from "@/lib/use-controllable-state";

type Measure = { full: number; clamp: number };

/** The nearest ancestor that scrolls vertically, or null for the page itself. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const y = getComputedStyle(p).overflowY;
    if ((y === "auto" || y === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

export type ShowMoreProps = Omit<React.ComponentProps<"div">, "children"> & {
  children: React.ReactNode;
  /** Lines visible while collapsed. */
  lines?: number;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  moreLabel?: React.ReactNode;
  lessLabel?: React.ReactNode;
  /** Classes for the text box (type size and color live here). */
  contentClassName?: string;
};

/**
 * Clamps text to a number of lines and fades the last one out. The button exists
 * only when the text actually overflows, which is measured, not guessed from length.
 */
export function ShowMore({
  children,
  lines = 3,
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  moreLabel = "Show more",
  lessLabel = "Show less",
  className,
  contentClassName,
  style,
  ...rest
}: ShowMoreProps) {
  const [open, setOpen] = useControllableState({ value: expanded, defaultValue: defaultExpanded, onChange: onExpandedChange });
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  // null until measured: the server can't know whether the text overflows.
  const [m, setM] = useState<Measure | null>(null);
  // Height animates only for a toggle; a resize or a font swap snaps to the new size.
  const [moving, setMoving] = useState(false);
  const reduce = useReducedMotion();
  const id = useId();

  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const ro = new ResizeObserver(() => {
      const cs = getComputedStyle(o);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
      const next = { full: i.offsetHeight, clamp: Math.round(lh * lines) };
      setM((prev) => (prev && prev.full === next.full && prev.clamp === next.clamp ? prev : next));
    });
    ro.observe(i);
    return () => ro.disconnect();
  }, [lines]);

  const overflowing = m ? m.full > m.clamp + 1 : null;
  const clamped = overflowing !== false;
  const distance = m ? Math.abs(m.full - m.clamp) : 0;
  // Longer text travels further, so it gets a little longer, within 220–420ms.
  const duration = reduce ? 0 : Math.round(Math.min(420, Math.max(220, 180 + distance * 0.5)));

  const toggle = (next: boolean) => {
    if (next === open) return;
    if (!next && root.current) {
      // Collapsing from far down the text can strand the reader below the fold; bring the top back.
      const el = root.current;
      const parent = scrollParent(el);
      const top = parent ? parent.getBoundingClientRect().top : 0;
      if (el.getBoundingClientRect().top < top) el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    }
    if (!reduce) setMoving(true);
    setOpen(next);
  };

  return (
    <div ref={root} data-state={open ? "open" : "closed"} className={cn("flex min-w-0 scroll-mt-4 flex-col items-start", className)} style={style} {...rest}>
      <div
        ref={outer}
        id={id}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && e.propertyName === "height") setMoving(false);
        }}
        // A link hidden in the clamped lines can still take focus: open up so it is seen.
        onFocusCapture={(e) => {
          if (open || !overflowing || !m || !inner.current) return;
          const y = (e.target as HTMLElement).getBoundingClientRect().bottom - inner.current.getBoundingClientRect().top;
          if (y > m.clamp) toggle(true);
        }}
        style={
          {
            "--lines": lines,
            height: m && overflowing ? (open ? m.full : m.clamp) : undefined,
            transitionDuration: moving ? `${open ? duration : Math.round(duration * 0.8)}ms` : "0ms",
          } as React.CSSProperties
        }
        className={cn(
          "relative w-full overflow-clip text-[13px] leading-[1.6] text-fg-2 [overflow-anchor:none]",
          open ? "ease-out-quart" : "ease-in-out-quart",
          "transition-[height,mask-position]",
          // Before hydration, CSS clamps by line height so the server render already looks right.
          !m && !open && "max-h-[calc(var(--lines)*1lh)]",
          // The mask is taller than the box by the fade; sliding it down past the edge clears the fade as the text opens.
          clamped &&
            "[mask-image:linear-gradient(to_bottom,var(--fg)_calc(100%-1.2lh),transparent)] [mask-repeat:no-repeat] [mask-size:100%_calc(100%+1.2lh)]",
          clamped && (open ? "[mask-position:0_0]" : "[mask-position:0_100%]"),
          contentClassName,
        )}
      >
        <div ref={inner} className="text-pretty">
          {children}
        </div>
      </div>

      {overflowing !== false && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          // Unmeasured, the button holds its space invisibly so nothing jumps when it appears.
          className={cn(
            "group/more relative -mx-2 mt-1 flex h-8 select-none items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-fg-2",
            "touch-manipulation [-webkit-tap-highlight-color:transparent]",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
            "transition-[background-color,color,scale,opacity] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75",
            "pointer-coarse:before:absolute pointer-coarse:before:-inset-y-1.5 pointer-coarse:before:inset-x-0 pointer-coarse:before:content-['']",
            overflowing === null && "invisible opacity-0",
          )}
          onClick={() => toggle(!open)}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={cn(
              "shrink-0 text-fg-3 transition-[rotate,color] duration-[240ms] ease-in-out-quart motion-reduce:transition-none group-hover/more:text-fg-2",
              open && "rotate-180",
            )}
          >
            <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
          </svg>
          {/* Both labels share one cell so the button keeps its width; only the current one is visible to assistive tech. */}
          <span className="grid overflow-hidden py-0.5">
            <Swap show={!open}>{moreLabel}</Swap>
            <Swap show={open} from="below">
              {lessLabel}
            </Swap>
          </span>
        </button>
      )}
    </div>
  );
}

function Swap({ show, from = "above", children }: { show: boolean; from?: "above" | "below"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "col-start-1 row-start-1 whitespace-nowrap transition-[opacity,translate,visibility] duration-200 ease-out-expo motion-reduce:translate-y-0",
        show ? "visible translate-y-0 opacity-100" : cn("invisible opacity-0", from === "below" ? "translate-y-2" : "-translate-y-2"),
      )}
    >
      {children}
    </span>
  );
}
