"use client";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { useId } from "react";
import { cn } from "@/lib/cn";

// Edges appear only where there is more to scroll. Where the browser has
// scroll-driven animations they are tied to the scroll position itself: the top
// edge fades in over the first `size` px, the bottom one fades out over the
// last, with no script and before hydration. Elsewhere the scroll area's own
// overflow attributes switch them with a short transition.
const css = `
[data-ss-root] { timeline-scope: var(--ss-y), var(--ss-x); }
[data-ss-viewport] { scroll-timeline: var(--ss-y) y, var(--ss-x) x; }

[data-ss-edge] { position: absolute; pointer-events: none; opacity: 0; transition: opacity 180ms var(--ease-out-quart); }
[data-ss-edge="top"] { inset: 0 0 auto 0; height: var(--ss-size); background: linear-gradient(to bottom, color-mix(in oklab, var(--ss-color) 90%, transparent), transparent); box-shadow: inset 0 1px 0 var(--line-2); }
[data-ss-edge="bottom"] { inset: auto 0 0 0; height: var(--ss-size); background: linear-gradient(to top, color-mix(in oklab, var(--ss-color) 90%, transparent), transparent); box-shadow: inset 0 -1px 0 var(--line-2); }
[data-ss-edge="left"] { inset: 0 auto 0 0; width: var(--ss-size); background: linear-gradient(to right, color-mix(in oklab, var(--ss-color) 90%, transparent), transparent); box-shadow: inset 1px 0 0 var(--line-2); }
[data-ss-edge="right"] { inset: 0 0 0 auto; width: var(--ss-size); background: linear-gradient(to left, color-mix(in oklab, var(--ss-color) 90%, transparent), transparent); box-shadow: inset -1px 0 0 var(--line-2); }
[data-ss-root][data-overflow-y-start] > [data-ss-edge="top"],
[data-ss-root][data-overflow-y-end] > [data-ss-edge="bottom"],
[data-ss-root][data-overflow-x-start] > [data-ss-edge="left"],
[data-ss-root][data-overflow-x-end] > [data-ss-edge="right"] { opacity: 1; }

@property --ss-fade-top { syntax: "<length>"; inherits: false; initial-value: 0px; }
@property --ss-fade-bottom { syntax: "<length>"; inherits: false; initial-value: 0px; }
@property --ss-fade-left { syntax: "<length>"; inherits: false; initial-value: 0px; }
@property --ss-fade-right { syntax: "<length>"; inherits: false; initial-value: 0px; }
[data-ss-variant="fade"] > [data-ss-viewport] {
  --ss-fade-top: min(var(--ss-size), var(--scroll-area-overflow-y-start, 0px));
  --ss-fade-bottom: min(var(--ss-size), var(--scroll-area-overflow-y-end, 0px));
  --ss-fade-left: min(var(--ss-size), var(--scroll-area-overflow-x-start, 0px));
  --ss-fade-right: min(var(--ss-size), var(--scroll-area-overflow-x-end, 0px));
  -webkit-mask-image: linear-gradient(to bottom, transparent, var(--fg) var(--ss-fade-top), var(--fg) calc(100% - var(--ss-fade-bottom)), transparent), linear-gradient(to right, transparent, var(--fg) var(--ss-fade-left), var(--fg) calc(100% - var(--ss-fade-right)), transparent);
  mask-image: linear-gradient(to bottom, transparent, var(--fg) var(--ss-fade-top), var(--fg) calc(100% - var(--ss-fade-bottom)), transparent), linear-gradient(to right, transparent, var(--fg) var(--ss-fade-left), var(--fg) calc(100% - var(--ss-fade-right)), transparent);
  -webkit-mask-composite: source-in;
  mask-composite: intersect;
}

@keyframes ss-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes ss-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes ss-fade-top { from { --ss-fade-top: 0px; } to { --ss-fade-top: var(--ss-size); } }
@keyframes ss-fade-bottom { from { --ss-fade-bottom: var(--ss-size); } to { --ss-fade-bottom: 0px; } }
@keyframes ss-fade-left { from { --ss-fade-left: 0px; } to { --ss-fade-left: var(--ss-size); } }
@keyframes ss-fade-right { from { --ss-fade-right: var(--ss-size); } to { --ss-fade-right: 0px; } }

@supports (animation-timeline: scroll()) {
  [data-ss-edge] { transition: none; animation-timing-function: linear; animation-fill-mode: both; animation-duration: auto; }
  [data-ss-edge="top"] { animation-name: ss-in; animation-timeline: var(--ss-y); animation-range: 0 var(--ss-size); }
  [data-ss-edge="bottom"] { animation-name: ss-out; animation-timeline: var(--ss-y); animation-range: calc(100% - var(--ss-size)) 100%; }
  [data-ss-edge="left"] { animation-name: ss-in; animation-timeline: var(--ss-x); animation-range: 0 var(--ss-size); }
  [data-ss-edge="right"] { animation-name: ss-out; animation-timeline: var(--ss-x); animation-range: calc(100% - var(--ss-size)) 100%; }
  [data-ss-variant="fade"] > [data-ss-viewport] {
    animation-name: ss-fade-top, ss-fade-bottom, ss-fade-left, ss-fade-right;
    animation-timing-function: linear;
    animation-fill-mode: both;
    animation-duration: auto;
    animation-timeline: var(--ss-y), var(--ss-y), var(--ss-x), var(--ss-x);
    animation-range: 0 var(--ss-size), calc(100% - var(--ss-size)) 100%, 0 var(--ss-size), calc(100% - var(--ss-size)) 100%;
  }
  /* These follow the scroll position; they are state, not motion, so reduced motion keeps them. */
  @media (prefers-reduced-motion: reduce) {
    [data-ss-root] [data-ss-edge], [data-ss-root][data-ss-variant="fade"] > [data-ss-viewport] { animation-duration: auto !important; }
  }
}
`;

const edgesFor = { vertical: ["top", "bottom"], horizontal: ["left", "right"], both: ["top", "bottom", "left", "right"] } as const;

export type ScrollShadowProps = Omit<ScrollArea.Root.Props, "children" | "className"> & {
  children?: React.ReactNode;
  className?: string;
  /** Which way it scrolls. */
  orientation?: "vertical" | "horizontal" | "both";
  /**
   * shadow draws a hairline and a soft shade at each edge with more content;
   * fade masks the content itself out toward those edges, for any background.
   */
  variant?: "shadow" | "fade";
  /** Depth of the shade or fade, and the scroll distance over which it arrives, in px. */
  size?: number;
  /** Show the thin overlay scrollbar while hovering or scrolling. */
  scrollbar?: boolean;
  /** Names the scroll region (role=region) for assistive tech. Set it whenever the region can take focus. */
  label?: string;
  viewportRef?: React.Ref<HTMLDivElement>;
  viewportClassName?: string;
};

export function ScrollShadow({
  orientation = "vertical",
  variant = "shadow",
  size = 20,
  scrollbar = true,
  label,
  viewportRef,
  viewportClassName,
  className,
  style,
  children,
  ...rest
}: ScrollShadowProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const vertical = orientation !== "horizontal";
  const horizontal = orientation !== "vertical";

  return (
    <ScrollArea.Root
      data-ss-root=""
      data-ss-variant={variant}
      data-orientation={orientation}
      className={cn("relative min-h-0 overflow-hidden", className)}
      style={{ "--ss-y": `--ss-y-${id}`, "--ss-x": `--ss-x-${id}`, "--ss-size": `${size}px`, "--ss-color": "var(--scroll-shadow-color, var(--page))", ...(style as React.CSSProperties) } as React.CSSProperties}
      {...rest}
    >
      <style href="stealth-scroll-shadow" precedence="default">
        {css}
      </style>
      <ScrollArea.Viewport
        ref={viewportRef}
        data-ss-viewport=""
        role={label ? "region" : undefined}
        aria-label={label}
        className={cn(
          "size-full overscroll-contain rounded-[inherit] outline-none",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
          !vertical && "overscroll-y-auto",
          viewportClassName,
        )}
      >
        <ScrollArea.Content
          className={cn(horizontal && !vertical && "h-full")}
          // Vertical-only content takes the viewport's width, so long rows truncate instead of scrolling sideways.
          style={horizontal ? undefined : { minWidth: 0 }}
        >
          {children}
        </ScrollArea.Content>
      </ScrollArea.Viewport>

      {variant === "shadow" && edgesFor[orientation].map((edge) => <span key={edge} data-ss-edge={edge} aria-hidden />)}

      {scrollbar && vertical && <Bar orientation="vertical" />}
      {scrollbar && horizontal && <Bar orientation="horizontal" />}
      {scrollbar && vertical && horizontal && <ScrollArea.Corner />}
    </ScrollArea.Root>
  );
}

// A thin overlay bar that shows while you hover or scroll, and thickens under the pointer.
function Bar({ orientation }: { orientation: "vertical" | "horizontal" }) {
  return (
    <ScrollArea.Scrollbar
      orientation={orientation}
      className={cn(
        "group/bar z-1 flex justify-center p-0.5 opacity-0 transition-opacity duration-200 ease-out-quart",
        "pointer-events-none data-hovering:pointer-events-auto data-hovering:opacity-100 data-scrolling:pointer-events-auto data-scrolling:opacity-100 data-scrolling:duration-75",
        orientation === "vertical" ? "w-2.5" : "h-2.5 flex-col",
      )}
    >
      <ScrollArea.Thumb
        className={cn(
          "rounded-full bg-fg-4 transition-[background-color,width,height] duration-150 group-hover/bar:bg-fg-3 active:bg-fg-2",
          orientation === "vertical" ? "w-1 group-hover/bar:w-1.5" : "h-1 group-hover/bar:h-1.5",
        )}
      />
    </ScrollArea.Scrollbar>
  );
}
