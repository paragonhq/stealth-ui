"use client";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { cn } from "@/lib/cn";
import { X } from "@/lib/icons";

type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

export type PopoverProps = BasePopover.Root.Props;

/** Owns the open state. Uncontrolled with `defaultOpen`, controlled with `open` + `onOpenChange`. */
export function Popover(props: PopoverProps) {
  return <BasePopover.Root {...props} />;
}

export type PopoverTriggerProps = Omit<BasePopover.Trigger.Props, "className"> & {
  className?: string;
  /** "bare" drops the button chrome and keeps only focus and press feedback, for icon or text triggers you style yourself. */
  variant?: "secondary" | "ghost" | "bare";
  size?: "sm" | "md";
};

export function PopoverTrigger({ variant = "secondary", size = "md", className, ...rest }: PopoverTriggerProps) {
  return (
    <BasePopover.Trigger
      data-variant={variant}
      data-size={size}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center font-medium tracking-[-0.005em]",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.97] active:duration-75",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        variant !== "bare" && (size === "sm" ? "h-7 gap-1.5 rounded-md px-2 text-[12px]" : "h-8 gap-2 rounded-lg px-2.5 text-[12.5px]"),
        // The trigger stays visibly pressed for as long as its popover is open.
        variant === "secondary" &&
          "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover data-popup-open:border-fg-4 data-popup-open:bg-hover",
        variant === "ghost" && "text-fg-2 hover:bg-hover hover:text-fg data-popup-open:bg-hover data-popup-open:text-fg",
        className,
      )}
      {...rest}
    />
  );
}

const widths = { auto: "w-max", sm: "w-64", md: "w-80", lg: "w-96" } as const;

export type PopoverContentProps = Omit<BasePopover.Popup.Props, "className"> & {
  className?: string;
  side?: Side;
  align?: Align;
  /** Gap between trigger and popup in px. Defaults to 10 with the arrow, 6 without. */
  sideOffset?: number;
  alignOffset?: number;
  /** Space kept from the viewport edge before the popup flips or shifts. */
  collisionPadding?: number;
  /** Draw the arrow that points at the trigger. */
  arrow?: boolean;
  /** Fixed widths keep forms from reflowing as you type; "auto" fits the content. */
  size?: keyof typeof widths;
  /** Where to portal the popup. Defaults to document.body. */
  container?: BasePopover.Portal.Props["container"];
};

export function PopoverContent({
  side = "bottom",
  align = "center",
  sideOffset,
  alignOffset = 0,
  collisionPadding = 8,
  arrow = true,
  size = "md",
  container,
  className,
  children,
  ...rest
}: PopoverContentProps) {
  return (
    <BasePopover.Portal container={container}>
      <BasePopover.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset ?? (arrow ? 10 : 6)}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
        arrowPadding={14}
        className="z-(--z-popover)"
      >
        <BasePopover.Popup
          className={cn(
            "relative flex max-w-[var(--available-width)] flex-col gap-3 rounded-xl border border-line-2 bg-raised p-4 text-[13px] text-fg shadow-pop outline-none",
            widths[size],
            // Grows out of the trigger: the origin is the arrow tip, and it travels 4px away from the trigger as it scales up.
            "origin-[var(--transform-origin)] transition-[opacity,scale,translate,filter] duration-200 ease-out-expo",
            "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-starting-style:blur-[2px]",
            "data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1",
            "data-[side=left]:data-starting-style:translate-x-1 data-[side=right]:data-starting-style:-translate-x-1",
            // Leaving is quicker and simpler: a short fade with a hint of scale, no travel.
            "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:ease-out-quart",
            // Escape and other keyboard dismissals close on the same frame.
            "data-instant:transition-none",
            "motion-reduce:data-starting-style:translate-0 motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:blur-none motion-reduce:data-ending-style:scale-100",
            className,
          )}
          {...rest}
        >
          {arrow && <PopoverArrow />}
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}

// One curved arrow drawn as fill plus stroke, so it joins the popup's hairline border
// without a seam. Its base overlaps the border by 1px to hide the line underneath.
function PopoverArrow() {
  return (
    <BasePopover.Arrow
      className={cn(
        "pointer-events-none flex h-2.5 w-5",
        "data-[side=bottom]:-top-[9px]",
        "data-[side=top]:-bottom-[9px] data-[side=top]:rotate-180",
        "data-[side=left]:-right-3.5 data-[side=left]:rotate-90",
        "data-[side=right]:-left-3.5 data-[side=right]:-rotate-90",
      )}
    >
      <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden className="block overflow-visible">
        <path d="M0 10c3.6 0 5.7-1.4 7.4-5.2L8.2 3c.8-1.6 2.8-1.6 3.6 0l.8 1.8c1.7 3.8 3.8 5.2 7.4 5.2z" className="fill-raised" />
        <path d="M0 10c3.6 0 5.7-1.4 7.4-5.2L8.2 3c.8-1.6 2.8-1.6 3.6 0l.8 1.8c1.7 3.8 3.8 5.2 7.4 5.2" className="stroke-line-2" vectorEffect="non-scaling-stroke" />
      </svg>
    </BasePopover.Arrow>
  );
}

export type PopoverHeaderProps = Omit<React.ComponentProps<"div">, "title"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Show the close button. On by default so touch and screen reader users always have a way out. */
  closable?: boolean;
  closeLabel?: string;
};

export function PopoverHeader({ title, description, closable = true, closeLabel = "Close", className, children, ...rest }: PopoverHeaderProps) {
  return (
    <div className={cn("flex items-start gap-3", className)} {...rest}>
      <div className="min-w-0 flex-1">
        <PopoverTitle>{title}</PopoverTitle>
        {description && <PopoverDescription className="mt-0.5">{description}</PopoverDescription>}
        {children}
      </div>
      {closable && <PopoverClose label={closeLabel} className="-mr-1.5 -mt-1" />}
    </div>
  );
}

export type PopoverTitleProps = Omit<BasePopover.Title.Props, "className"> & { className?: string };

export function PopoverTitle({ className, ...rest }: PopoverTitleProps) {
  return <BasePopover.Title className={cn("text-[14px] font-medium leading-5 tracking-[-0.015em] text-fg [overflow-wrap:anywhere]", className)} {...rest} />;
}

export type PopoverDescriptionProps = Omit<BasePopover.Description.Props, "className"> & { className?: string };

export function PopoverDescription({ className, ...rest }: PopoverDescriptionProps) {
  return <BasePopover.Description className={cn("text-[12.5px] leading-[18px] text-fg-2 text-pretty", className)} {...rest} />;
}

export type PopoverCloseProps = Omit<BasePopover.Close.Props, "className"> & {
  className?: string;
  /** Accessible name of the icon-only close button. */
  label?: string;
};

/** Icon-only close. Pass children to render your own button content instead of the X. */
export function PopoverClose({ label = "Close", className, children, ...rest }: PopoverCloseProps) {
  const iconOnly = children === undefined;
  return (
    <BasePopover.Close
      aria-label={iconOnly ? label : undefined}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-md text-fg-3 outline-none",
        "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
        iconOnly && "size-7 before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
        className,
      )}
      {...rest}
    >
      {iconOnly ? <X size={14} /> : children}
    </BasePopover.Close>
  );
}

export type PopoverFooterProps = React.ComponentProps<"div">;

/** A hairline-separated strip along the bottom edge, for secondary actions and link settings. */
export function PopoverFooter({ className, ...rest }: PopoverFooterProps) {
  return <div className={cn("-mx-4 -mb-4 mt-1 flex items-center gap-2 rounded-b-xl border-t border-line px-4 py-2.5", className)} {...rest} />;
}
