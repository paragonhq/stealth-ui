"use client";
import { Drawer } from "@base-ui/react/drawer";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { X } from "@/lib/icons";
import { useControllableState } from "@/lib/use-controllable-state";

export type SheetSide = "right" | "left";

const SideContext = createContext<SheetSide>("right");

export type SheetProps = Omit<Drawer.Root.Props, "swipeDirection" | "snapPoints" | "snapPoint" | "defaultSnapPoint" | "onSnapPointChange"> & {
  /** The edge it slides from. Swiping back toward that edge dismisses it. */
  side?: SheetSide;
};

/** A side panel. On touch it follows the finger and can be swiped away. */
export function Sheet({ side = "right", ...rest }: SheetProps) {
  return (
    <SideContext.Provider value={side}>
      <Drawer.Root swipeDirection={side} {...rest} />
    </SideContext.Provider>
  );
}

export type SheetTriggerProps = Drawer.Trigger.Props;

export function SheetTrigger(props: SheetTriggerProps) {
  return <Drawer.Trigger {...props} />;
}

export type SheetContentProps = Omit<Drawer.Popup.Props, "className" | "style"> & {
  className?: string;
  style?: React.CSSProperties;
  /** Render into this element instead of document.body. Backdrop and panel become absolute to it. */
  container?: Drawer.Portal.Props["container"];
  /** Adds a drag handle on the inner edge. Arrow keys resize it too; double-click resets. */
  resizable?: boolean;
  /** Width in px. Controlled; pair with onWidthChange. */
  width?: number;
  defaultWidth?: number;
  onWidthChange?: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
  /** Hide the backdrop, e.g. for an inspector used with the page (set modal={false} on Sheet). */
  backdrop?: boolean;
};

export function SheetContent({
  container,
  resizable = false,
  width: widthProp,
  defaultWidth = 400,
  onWidthChange,
  minWidth = 320,
  maxWidth = 720,
  backdrop = true,
  className,
  style,
  children,
  ...rest
}: SheetContentProps) {
  const side = useContext(SideContext);
  const contained = container != null;
  const [width, setWidth] = useControllableState({ value: widthProp, defaultValue: defaultWidth, onChange: onWidthChange });
  const [resizing, setResizing] = useState(false);

  return (
    <Drawer.Portal container={container}>
      {backdrop && (
        <Drawer.Backdrop
          className={cn(
            contained ? "absolute" : "fixed",
            "inset-0 z-(--z-overlay) bg-overlay",
            // Tracks the swipe: the page comes back as the panel leaves.
            "opacity-[calc(1-var(--drawer-swipe-progress,0))] transition-opacity duration-300 ease-drawer",
            "data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-200 data-swiping:duration-0",
          )}
        />
      )}
      <Drawer.Viewport
        className={cn(
          contained ? "absolute" : "fixed",
          "inset-0 z-(--z-dialog) flex p-2",
          side === "right" ? "justify-end" : "justify-start",
          !backdrop && "pointer-events-none",
        )}
      >
        <Drawer.Popup
          data-side={side}
          data-resizing={resizing ? "" : undefined}
          style={{ ...style, "--sheet-width": `${width}px` } as React.CSSProperties}
          className={cn(
            "group/sheet pointer-events-auto relative flex h-full w-(--sheet-width) max-w-full flex-col rounded-2xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
            // Slides from its edge on the drawer curve; follows the finger 1:1 while swiped;
            // a fast flick shortens the exit.
            "transition-[transform,width] duration-[320ms] ease-drawer data-swiping:duration-0 data-resizing:transition-none",
            side === "right"
              ? "[transform:translateX(var(--drawer-swipe-movement-x,0px))] data-starting-style:[transform:translateX(calc(100%+8px))] data-ending-style:[transform:translateX(calc(100%+8px))]"
              : "[transform:translateX(var(--drawer-swipe-movement-x,0px))] data-starting-style:[transform:translateX(calc(-100%-8px))] data-ending-style:[transform:translateX(calc(-100%-8px))]",
            "data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*240ms)]",
            "data-swiping:select-none",
            className,
          )}
          {...rest}
        >
          {children}
          {/* Last in the DOM so it never takes initial focus; it sits on the inner edge visually. */}
          {resizable && (
            <ResizeHandle
              side={side}
              width={width}
              min={minWidth}
              max={maxWidth}
              reset={defaultWidth}
              onResize={setWidth}
              onResizingChange={setResizing}
            />
          )}
        </Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  );
}

/**
 * The inner-edge grip. Pointer drag resizes with a little give past the limits
 * (30% of the overshoot) and springs back on release; arrows step by 16px
 * (64px with Shift); Home/End jump to the limits; double-click or Enter resets.
 */
function ResizeHandle({
  side,
  width,
  min,
  max,
  reset,
  onResize,
  onResizingChange,
}: {
  side: SheetSide;
  width: number;
  min: number;
  max: number;
  reset: number;
  onResize: (w: number) => void;
  onResizingChange: (r: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; w: number; max: number } | null>(null);

  // The available room depends on where the sheet is rendered.
  const limit = () => {
    const room = ref.current?.closest("[data-side]")?.parentElement?.clientWidth;
    return room ? Math.max(min, Math.min(max, room - 16)) : max;
  };
  const clamp = (w: number, hi = limit()) => Math.round(Math.min(hi, Math.max(min, w)));

  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      data-base-ui-swipe-ignore=""
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, w: width, max: limit() };
        onResizingChange(true);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const delta = side === "right" ? d.x - e.clientX : e.clientX - d.x;
        const raw = d.w + delta;
        // Rubber-band past either limit instead of a hard stop.
        const over = raw > d.max ? (raw - d.max) * 0.3 : raw < min ? (raw - min) * 0.3 : 0;
        onResize(Math.round(Math.min(d.max, Math.max(min, raw)) + over));
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        if (!d) return;
        drag.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
        onResizingChange(false);
        onResize(clamp(width, d.max));
      }}
      onPointerCancel={() => {
        drag.current = null;
        onResizingChange(false);
        onResize(clamp(width));
      }}
      onDoubleClick={() => onResize(clamp(reset))}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 64 : 16;
        const grow = side === "right" ? "ArrowLeft" : "ArrowRight";
        const shrink = side === "right" ? "ArrowRight" : "ArrowLeft";
        let next: number | null = null;
        if (e.key === grow) next = width + step;
        else if (e.key === shrink) next = width - step;
        else if (e.key === "Home") next = min;
        else if (e.key === "End") next = limit();
        else if (e.key === "Enter") next = reset;
        if (next === null) return;
        e.preventDefault();
        onResize(clamp(next));
      }}
      className={cn(
        "group/handle absolute inset-y-0 z-2 flex w-4 cursor-ew-resize touch-none items-center justify-center outline-none pointer-coarse:hidden",
        side === "right" ? "-left-2" : "-right-2",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-10 w-1 rounded-full bg-fg-4 opacity-0 transition-[opacity,background-color,scale] duration-150 ease-out-quart",
          "group-hover/handle:opacity-100 group-focus-visible/handle:opacity-100 group-focus-visible/handle:bg-fg-2",
          "group-data-resizing/sheet:scale-y-125 group-data-resizing/sheet:bg-fg-2 group-data-resizing/sheet:opacity-100",
        )}
      />
    </div>
  );
}

export type SheetHeaderProps = React.ComponentProps<"div"> & {
  /** The × at the end of the header. */
  showCloseButton?: boolean;
  closeLabel?: string;
};

export function SheetHeader({ showCloseButton = true, closeLabel = "Close", className, children, ...rest }: SheetHeaderProps) {
  return (
    <div className={cn("flex shrink-0 items-start gap-3 px-5 pb-3 pt-4", className)} {...rest}>
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1">{children}</div>
      {showCloseButton && (
        <Drawer.Close
          aria-label={closeLabel}
          className={cn(
            "relative -mr-1.5 grid size-7 shrink-0 place-items-center rounded-md text-fg-3",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "transition-[background-color,color,scale] duration-150 ease-out-quart hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
            "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
          )}
        >
          <X size={16} />
        </Drawer.Close>
      )}
    </div>
  );
}

export type SheetTitleProps = Omit<Drawer.Title.Props, "className"> & { className?: string };

export function SheetTitle({ className, ...rest }: SheetTitleProps) {
  return <Drawer.Title className={cn("text-[15px] font-medium leading-[1.3] tracking-[-0.015em] text-fg text-balance", className)} {...rest} />;
}

export type SheetDescriptionProps = Omit<Drawer.Description.Props, "className"> & { className?: string };

export function SheetDescription({ className, ...rest }: SheetDescriptionProps) {
  return <Drawer.Description className={cn("text-[12.5px] leading-[1.5] text-fg-2 text-pretty", className)} {...rest} />;
}

export type SheetBodyProps = React.ComponentProps<"div">;

/** Scrolls on its own; hairlines show at the edges only while content is hidden past them. Text in here selects instead of swiping. */
export function SheetBody({ className, children, ...rest }: SheetBodyProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = wrap.current;
    const el = scroller.current;
    if (!root || !el) return;
    const update = () => {
      const max = el.scrollHeight - el.clientHeight;
      root.toggleAttribute("data-overflow-top", el.scrollTop > 1);
      root.toggleAttribute("data-overflow-bottom", max - el.scrollTop > 1);
      if (max > 1) el.setAttribute("tabindex", "0");
      else el.removeAttribute("tabindex");
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (content.current) ro.observe(content.current);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrap} className="group/body relative flex min-h-0 flex-1 flex-col">
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-1 h-px bg-line-2 opacity-0 transition-opacity duration-150 group-data-overflow-top/body:opacity-100" />
      <Drawer.Content
        ref={scroller}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3 outline-none",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-4",
          className,
        )}
        {...rest}
      >
        <div ref={content}>{children}</div>
      </Drawer.Content>
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-1 h-px bg-line-2 opacity-0 transition-opacity duration-150 group-data-overflow-bottom/body:opacity-100" />
    </div>
  );
}

export type SheetFooterProps = React.ComponentProps<"div">;

export function SheetFooter({ className, ...rest }: SheetFooterProps) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-end gap-2 px-5 pb-4 pt-3 max-sm:grid max-sm:auto-cols-fr max-sm:grid-flow-col max-sm:*:h-10", className)}
      {...rest}
    />
  );
}

export type SheetCloseProps = Omit<Drawer.Close.Props, "className"> & {
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
};

export function SheetClose({ variant = "secondary", className, ...rest }: SheetCloseProps) {
  return (
    <Drawer.Close
      className={cn(
        "relative inline-flex h-8 shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg px-2.5 text-[12.5px] font-medium tracking-[-0.005em]",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color,border-color,color,scale] duration-150 ease-out-quart active:scale-[0.97] active:duration-75",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        variant === "primary" && "bg-fg text-frame shadow-[var(--shadow)] hover:bg-fg/90",
        variant === "secondary" && "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover",
        variant === "ghost" && "text-fg-2 hover:bg-hover hover:text-fg",
        className,
      )}
      {...rest}
    />
  );
}
