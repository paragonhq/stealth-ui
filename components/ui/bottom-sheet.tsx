"use client";
import { Drawer } from "@base-ui/react/drawer";
import { createContext, useContext, useRef } from "react";
import { cn } from "@/lib/cn";
import { useControllableState } from "@/lib/use-controllable-state";

export type SnapPoint = number | string;

type Ctx = {
  points: SnapPoint[];
  snap: SnapPoint | null;
  setSnap: (s: SnapPoint) => void;
};
const SheetCtx = createContext<Ctx | null>(null);
const useSheet = () => {
  const ctx = useContext(SheetCtx);
  if (!ctx) throw new Error("BottomSheet parts must be inside <BottomSheet>");
  return ctx;
};

export type BottomSheetProps = Omit<
  Drawer.Root.Props,
  "swipeDirection" | "snapPoints" | "snapPoint" | "defaultSnapPoint" | "onSnapPointChange"
> & {
  /**
   * Resting heights, smallest first. 0–1 is a fraction of the container (or
   * viewport), larger numbers are px, strings take "px" or "rem".
   */
  snapPoints?: SnapPoint[];
  snapPoint?: SnapPoint | null;
  defaultSnapPoint?: SnapPoint;
  onSnapPointChange?: (snapPoint: SnapPoint | null) => void;
};

/** Peek, half, full: a sheet that rests where the content has natural stops. */
export function BottomSheet({
  snapPoints = ["148px", 0.55, 1],
  snapPoint,
  defaultSnapPoint,
  onSnapPointChange,
  onOpenChange,
  ...rest
}: BottomSheetProps) {
  const initial = defaultSnapPoint ?? snapPoints[Math.min(1, snapPoints.length - 1)] ?? null;
  const [snap, setSnap] = useControllableState<SnapPoint | null>({
    value: snapPoint,
    defaultValue: initial,
    onChange: onSnapPointChange,
  });
  return (
    <SheetCtx.Provider value={{ points: snapPoints, snap, setSnap }}>
      <Drawer.Root
        swipeDirection="down"
        snapPoints={snapPoints}
        snapPoint={snap}
        onSnapPointChange={(next) => setSnap(next)}
        onOpenChange={(open, details) => {
          // Every opening starts from the default rest, not wherever it was dismissed from.
          if (open) setSnap(initial);
          onOpenChange?.(open, details);
        }}
        {...rest}
      />
    </SheetCtx.Provider>
  );
}

export type BottomSheetTriggerProps = Drawer.Trigger.Props;

export function BottomSheetTrigger(props: BottomSheetTriggerProps) {
  return <Drawer.Trigger {...props} />;
}

export type BottomSheetContentProps = Omit<Drawer.Popup.Props, "className"> & {
  className?: string;
  /** Render into this element instead of document.body; snap fractions then measure the container. */
  container?: Drawer.Portal.Props["container"];
  /** Space left above the sheet at its full height, so the page behind still shows. */
  topGap?: number;
};

export function BottomSheetContent({ container, topGap = 24, className, style, children, ...rest }: BottomSheetContentProps) {
  const contained = container != null;
  const { points, snap, setSnap } = useSheet();
  const lastWheel = useRef(0);

  return (
    <Drawer.Portal container={container}>
      <Drawer.Backdrop
        className={cn(
          contained ? "absolute" : "fixed",
          "inset-0 z-(--z-overlay) bg-overlay",
          // Dims fully only at the top snap point and lightens as the sheet comes down.
          "opacity-[calc(1-var(--drawer-swipe-progress,0))] transition-opacity duration-[400ms] ease-drawer",
          "data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*300ms)] data-swiping:duration-0",
        )}
      />
      <Drawer.Viewport
        className={cn(contained ? "absolute" : "fixed", "inset-0 z-(--z-dialog) flex touch-none items-end justify-center overflow-hidden")}
      >
        <Drawer.Popup
          style={{ ...(style as React.CSSProperties), "--top-gap": `${topGap}px` } as React.CSSProperties}
          // Wheel down on a sheet that isn't fully open opens it a step, like a drag would.
          onWheel={(e) => {
            const i = points.findIndex((p) => Object.is(p, snap));
            if (e.deltaY <= 4 || i < 0 || i >= points.length - 1) return;
            const now = performance.now();
            if (now - lastWheel.current < 450) return;
            lastWheel.current = now;
            setSnap(points[i + 1]);
          }}
          className={cn(
            "group/sheet relative flex max-h-[calc(100%-var(--top-gap))] w-full max-w-[640px] flex-col rounded-t-2xl border border-b-0 border-line-2 bg-raised text-fg shadow-pop outline-none",
            // Snap offset plus live drag; transitions only between rests, 1:1 while dragging.
            "[transform:translateY(calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y,0px)))]",
            "transition-transform duration-[400ms] ease-drawer data-swiping:duration-0 data-swiping:select-none",
            "data-starting-style:[transform:translateY(100%)] data-ending-style:[transform:translateY(100%)]",
            "data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*300ms)]",
            // Fills the gap underneath when the sheet is pulled past the top and rubber-bands.
            "after:pointer-events-none after:absolute after:inset-x-[-1px] after:top-full after:h-16 after:border-x after:border-line-2 after:bg-inherit after:content-['']",
            className,
          )}
          {...rest}
        >
          {children}
        </Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  );
}

export type BottomSheetHandleProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** How each snap point is announced, smallest first. */
  snapLabels?: string[];
};

/**
 * The grabber. Drag it like the rest of the sheet; tap or press Enter to step up
 * through the snap points (wrapping to the smallest); arrows, Home and End move
 * between them. It is a slider to assistive tech: “Sheet height, Half”.
 */
export function BottomSheetHandle({ snapLabels, className, onClick, onKeyDown, onPointerDown, ...rest }: BottomSheetHandleProps) {
  const { points, snap, setSnap } = useSheet();
  const i = Math.max(0, points.findIndex((p) => Object.is(p, snap)));
  const last = points.length - 1;
  const labels = snapLabels ?? (points.length === 3 ? ["Collapsed", "Half", "Expanded"] : points.map((_, n) => `${n + 1} of ${points.length}`));
  const go = (n: number) => points.length && setSnap(points[Math.min(last, Math.max(0, n))]);

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Sheet height"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={last}
      aria-valuenow={i}
      aria-valuetext={labels[i]}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        if (e.button !== 0) return;
        const from = { x: e.clientX, y: e.clientY };
        // The sheet captures the pointer for the drag, so listen for the release on the window.
        // Only a tap steps; a drag already moved the sheet where it should be.
        const up = (u: PointerEvent) => {
          if (Math.hypot(u.clientX - from.x, u.clientY - from.y) <= 4) go(i === last ? 0 : i + 1);
        };
        window.addEventListener("pointerup", up, { once: true });
      }}
      onClick={(e) => {
        onClick?.(e);
        // Clicks synthesised by assistive tech (detail 0) step too.
        if (!e.defaultPrevented && e.detail === 0) go(i === last ? 0 : i + 1);
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        const next =
          e.key === "ArrowUp" || e.key === "ArrowRight" ? i + 1
          : e.key === "ArrowDown" || e.key === "ArrowLeft" ? i - 1
          : e.key === "Home" ? 0
          : e.key === "End" ? last
          : e.key === "Enter" || e.key === " " ? (i === last ? 0 : i + 1)
          : null;
        if (next === null) return;
        e.preventDefault();
        go(next);
      }}
      className={cn(
        "group/handle relative flex h-5 w-full shrink-0 cursor-grab touch-none select-none items-start justify-center pt-2 outline-none active:cursor-grabbing",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden
        className={cn(
          "h-[5px] w-9 rounded-full bg-fg-4 transition-[background-color,scale] duration-150 ease-out-quart",
          "group-hover/handle:bg-fg-3 group-focus-visible/handle:bg-fg-2 group-focus-visible/handle:outline-solid group-focus-visible/handle:outline-1 group-focus-visible/handle:outline-offset-3 group-focus-visible/handle:outline-fg-3",
          // The grabber widens a little while the sheet is held.
          "group-active/handle:scale-x-110 group-data-swiping/sheet:scale-x-125 group-data-swiping/sheet:bg-fg-3",
        )}
      />
    </div>
  );
}

export type BottomSheetHeaderProps = React.ComponentProps<"div">;

/** Sits under the handle and is the part you drag by; visible at every snap point. */
export function BottomSheetHeader({ className, ...rest }: BottomSheetHeaderProps) {
  return <div className={cn("flex shrink-0 flex-col gap-0.5 px-5 pb-3 pt-2 select-none", className)} {...rest} />;
}

export type BottomSheetTitleProps = Omit<Drawer.Title.Props, "className"> & { className?: string };

export function BottomSheetTitle({ className, ...rest }: BottomSheetTitleProps) {
  return <Drawer.Title className={cn("text-[15px] font-medium leading-[1.3] tracking-[-0.015em] text-fg", className)} {...rest} />;
}

export type BottomSheetDescriptionProps = Omit<Drawer.Description.Props, "className"> & { className?: string };

export function BottomSheetDescription({ className, ...rest }: BottomSheetDescriptionProps) {
  return <Drawer.Description className={cn("text-[12.5px] leading-[1.5] text-fg-3", className)} {...rest} />;
}

export type BottomSheetBodyProps = Omit<Drawer.Content.Props, "className"> & { className?: string };

/**
 * Scrolls only once the sheet is fully open. Below that a drag moves the sheet;
 * at the top a drag scrolls the list, and pulling down from the top of the
 * list hands the gesture back to the sheet. Keyboard focus inside opens it fully.
 */
export function BottomSheetBody({ className, onFocus, ...rest }: BottomSheetBodyProps) {
  const { points, setSnap } = useSheet();
  return (
    <Drawer.Content
      onFocus={(e) => {
        onFocus?.(e);
        if ((e.target as HTMLElement).matches?.(":focus-visible") && points.length) setSnap(points[points.length - 1]);
      }}
      className={cn(
        "min-h-0 flex-1 overflow-y-hidden overscroll-contain border-t border-line px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3",
        "group-data-expanded/sheet:touch-pan-y group-data-expanded/sheet:overflow-y-auto",
        className,
      )}
      {...rest}
    />
  );
}

export type BottomSheetCloseProps = Omit<Drawer.Close.Props, "className"> & { className?: string };

export function BottomSheetClose({ className, ...rest }: BottomSheetCloseProps) {
  return (
    <Drawer.Close
      className={cn(
        "relative inline-flex h-8 shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg px-2.5 text-[12.5px] font-medium tracking-[-0.005em] text-fg-2",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color,color,scale] duration-150 ease-out-quart hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75",
        "before:absolute before:-inset-x-1 before:-inset-y-1.5 before:content-[''] pointer-fine:before:hidden",
        className,
      )}
      {...rest}
    />
  );
}
