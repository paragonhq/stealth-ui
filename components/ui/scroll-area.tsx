"use client";
import { ScrollArea as BaseScrollArea } from "@base-ui/react/scroll-area";
import { cn } from "@/lib/cn";

type Axis = "vertical" | "horizontal" | "both";

type Edge = "top" | "bottom" | "left" | "right";

// Edge fades read how far the viewport is from each edge (Base UI writes those as
// CSS variables on scroll), so a fade grows in over the first 24px of travel
// instead of switching on. Before the first measure, only the far edges fade.
const FADE = "24px";
function edgeMask(axis: "x" | "y", start: boolean, end: boolean) {
  const dir = axis === "y" ? "to bottom" : "to right";
  const a = start ? `min(${FADE}, var(--scroll-area-overflow-${axis}-start, 0px))` : "0px";
  const b = end ? `min(${FADE}, var(--scroll-area-overflow-${axis}-end, ${FADE}))` : "0px";
  // Any opaque color works in a mask; only its alpha is read.
  return `linear-gradient(${dir}, transparent 0, var(--fg) ${a}, var(--fg) calc(100% - ${b}), transparent 100%)`;
}

export type ScrollAreaProps = Omit<BaseScrollArea.Root.Props, "className" | "children"> & {
  children: React.ReactNode;
  /** Which way the content overflows. Only the scrollbars you ask for are drawn. */
  axis?: Axis;
  /**
   * Fade the edges where there's more to scroll to. Pass the edges to fade when some
   * shouldn't, such as a sticky header on top: `fade={["bottom", "right"]}`.
   */
  fade?: boolean | Edge[];
  /** Classes for the outer box: give it a height (or max-height) here. */
  className?: string;
  /** Classes for the scrolling element itself. */
  viewportClassName?: string;
  /** Classes for the content wrapper inside the viewport (padding lives well here). */
  contentClassName?: string;
  /** Names the scroll region for screen readers when it holds more than a list or table can say. */
  "aria-label"?: string;
};

/**
 * A native scroll container, so wheel, touch, keyboard, find-in-page and momentum
 * all behave as the platform does, with thin scrollbars drawn over the content.
 * They show while the pointer is over the area or it's scrolling, then get out of the way.
 */
export function ScrollArea({ children, axis = "vertical", fade = true, className, viewportClassName, contentClassName, "aria-label": label, ...rest }: ScrollAreaProps) {
  const y = axis !== "horizontal";
  const x = axis !== "vertical";
  const edges = new Set<Edge>(fade === true ? ["top", "bottom", "left", "right"] : fade || []);
  const layers = [
    y && (edges.has("top") || edges.has("bottom")) && edgeMask("y", edges.has("top"), edges.has("bottom")),
    x && (edges.has("left") || edges.has("right")) && edgeMask("x", edges.has("left"), edges.has("right")),
  ].filter(Boolean);
  const mask = layers.length ? layers.join(", ") : undefined;

  return (
    <BaseScrollArea.Root
      data-axis={axis}
      className={cn(
        "group/scroll relative flex min-h-0 min-w-0 flex-col overflow-hidden",
        // The viewport takes focus for keyboard scrolling; the ring belongs to the whole area, drawn just inside it.
        "rounded-[inherit] has-[[data-scroll-viewport]:focus-visible]:outline-solid has-[[data-scroll-viewport]:focus-visible]:outline-1 has-[[data-scroll-viewport]:focus-visible]:-outline-offset-1 has-[[data-scroll-viewport]:focus-visible]:outline-fg-3",
        className,
      )}
      {...rest}
    >
      <BaseScrollArea.Viewport
        data-scroll-viewport=""
        aria-label={label}
        role={label ? "region" : undefined}
        style={mask ? { maskImage: mask, WebkitMaskImage: mask, maskComposite: "intersect", WebkitMaskComposite: "source-in" } : undefined}
        className={cn("min-h-0 flex-1 overscroll-contain rounded-[inherit] outline-none", viewportClassName)}
      >
        <BaseScrollArea.Content className={cn(x ? "min-w-fit" : "min-w-0", contentClassName)}>{children}</BaseScrollArea.Content>
      </BaseScrollArea.Viewport>
      {y && <ScrollBar orientation="vertical" />}
      {x && <ScrollBar orientation="horizontal" />}
      {y && x && <BaseScrollArea.Corner className="bg-transparent" />}
    </BaseScrollArea.Root>
  );
}

export type ScrollBarProps = Omit<BaseScrollArea.Scrollbar.Props, "className"> & { className?: string };

/**
 * A 10px lane with a 4px thumb that thickens to 6px under the pointer. Hidden and
 * click-through at rest; it appears at once and fades out on its own.
 */
export function ScrollBar({ orientation = "vertical", className, ...rest }: ScrollBarProps) {
  const vertical = orientation === "vertical";
  return (
    <BaseScrollArea.Scrollbar
      orientation={orientation}
      className={cn(
        "group/bar z-10 flex touch-none select-none p-0.5",
        vertical ? "w-2.5 justify-center" : "h-2.5 flex-col justify-center",
        // Leaving: a short beat, then a slow fade. Arriving: at once.
        "pointer-events-none opacity-0 transition-opacity delay-150 duration-300 ease-out",
        "data-hovering:pointer-events-auto data-hovering:opacity-100 data-hovering:delay-0 data-hovering:duration-100",
        "data-scrolling:pointer-events-auto data-scrolling:opacity-100 data-scrolling:delay-0 data-scrolling:duration-100",
        className,
      )}
      {...rest}
    >
      <BaseScrollArea.Thumb
        className={cn(
          "relative rounded-full bg-fg/25 duration-150 ease-out",
          "group-hover/bar:bg-fg/40 active:bg-fg/55",
          // A generous invisible grip, so a 4px thumb is still easy to catch.
          "before:absolute before:-inset-1.5 before:content-['']",
          // Only the cross axis animates: the length follows the scroll position and must never lag it.
          vertical ? "w-1 transition-[width,background-color] group-hover/bar:w-1.5 active:w-1.5" : "h-1 transition-[height,background-color] group-hover/bar:h-1.5 active:h-1.5",
        )}
      />
    </BaseScrollArea.Scrollbar>
  );
}
