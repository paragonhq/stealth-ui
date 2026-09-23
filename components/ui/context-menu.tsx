"use client";
import { ContextMenu as Base } from "@base-ui/react/context-menu";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { DropdownMenuPopup, type DropdownMenuPopupProps } from "@/components/ui/dropdown-menu";

// Rows, groups, submenus and shortcuts are the dropdown menu's own parts: a context
// menu is the same list, opened from a different place.
export {
  DropdownMenuItem as ContextMenuItem,
  DropdownMenuLinkItem as ContextMenuLinkItem,
  DropdownMenuCheckboxItem as ContextMenuCheckboxItem,
  DropdownMenuRadioGroup as ContextMenuRadioGroup,
  DropdownMenuRadioItem as ContextMenuRadioItem,
  DropdownMenuGroup as ContextMenuGroup,
  DropdownMenuLabel as ContextMenuLabel,
  DropdownMenuSeparator as ContextMenuSeparator,
  DropdownMenuSub as ContextMenuSub,
  DropdownMenuSubTrigger as ContextMenuSubTrigger,
  DropdownMenuSubContent as ContextMenuSubContent,
  DropdownMenuShortcut as ContextMenuShortcut,
} from "@/components/ui/dropdown-menu";
export type {
  DropdownMenuItemProps as ContextMenuItemProps,
  DropdownMenuCheckboxItemProps as ContextMenuCheckboxItemProps,
  DropdownMenuRadioItemProps as ContextMenuRadioItemProps,
  DropdownMenuSubTriggerProps as ContextMenuSubTriggerProps,
} from "@/components/ui/dropdown-menu";

export type ContextMenuProps = Base.Root.Props;

/** Groups a region and the menu it opens on right-click or long-press. */
export function ContextMenu(props: ContextMenuProps) {
  return <Base.Root {...props} />;
}

export type ContextMenuTriggerProps = Base.Trigger.Props & {
  /** Open from the keyboard with Shift+F10 or the Menu key while the region has focus. */
  keyboard?: boolean;
};

/**
 * The region that owns the menu. On touch it sinks slightly while a long-press
 * is registering, so the half-second hold never feels like nothing is happening.
 */
export function ContextMenuTrigger({ keyboard = true, className, onKeyDown, onTouchStart, onTouchMove, onTouchEnd, onTouchCancel, ...rest }: ContextMenuTriggerProps) {
  const [pressing, setPressing] = useState<{ x: number; y: number } | null>(null);

  return (
    <Base.Trigger
      data-pressing={pressing ? "" : undefined}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (!keyboard || e.defaultPrevented || e.target !== e.currentTarget) return;
        if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
          e.preventDefault();
          // Open where a pointer would have: near the start of the region, just under it.
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.dispatchEvent(
            new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + Math.min(24, r.width / 2), clientY: r.bottom - 4 }),
          );
        }
      }}
      onTouchStart={(e) => {
        onTouchStart?.(e);
        const t = e.touches[0];
        setPressing(e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY } : null);
      }}
      onTouchMove={(e) => {
        onTouchMove?.(e);
        const t = e.touches[0];
        // Same 10px tolerance Base UI uses before it gives up on the long-press.
        if (pressing && t && Math.hypot(t.clientX - pressing.x, t.clientY - pressing.y) > 10) setPressing(null);
      }}
      onTouchEnd={(e) => {
        onTouchEnd?.(e);
        setPressing(null);
      }}
      onTouchCancel={(e) => {
        onTouchCancel?.(e);
        setPressing(null);
      }}
      className={(state) =>
        cn(
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "pointer-coarse:select-none",
          "transition-[scale] duration-200 ease-out-expo",
          "motion-safe:data-pressing:not-data-popup-open:scale-[0.985] data-pressing:not-data-popup-open:duration-500 data-pressing:not-data-popup-open:ease-out",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...rest}
    />
  );
}

export type ContextMenuContentProps = DropdownMenuPopupProps & {
  collisionPadding?: Base.Positioner.Props["collisionPadding"];
  /** Where the menu is portaled. Defaults to the body. */
  container?: Base.Portal.Props["container"];
};

/**
 * The menu, opened with its corner tucked under the pointer. It grows out of that
 * exact point, and flips to stay on screen near the edges.
 */
export function ContextMenuContent({ collisionPadding = 8, container, ...rest }: ContextMenuContentProps) {
  return (
    <Base.Portal container={container}>
      <Base.Positioner collisionPadding={collisionPadding} className="z-(--z-dropdown) outline-none">
        <DropdownMenuPopup {...rest} />
      </Base.Positioner>
    </Base.Portal>
  );
}
