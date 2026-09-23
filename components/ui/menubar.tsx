"use client";
import { Menu } from "@base-ui/react/menu";
import { Menubar as Base } from "@base-ui/react/menubar";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { DropdownMenuContent, type DropdownMenuContentProps } from "@/components/ui/dropdown-menu";

// Rows, groups, submenus and shortcuts are the dropdown menu's own parts.
export {
  DropdownMenuItem as MenubarItem,
  DropdownMenuLinkItem as MenubarLinkItem,
  DropdownMenuCheckboxItem as MenubarCheckboxItem,
  DropdownMenuRadioGroup as MenubarRadioGroup,
  DropdownMenuRadioItem as MenubarRadioItem,
  DropdownMenuGroup as MenubarGroup,
  DropdownMenuLabel as MenubarLabel,
  DropdownMenuSeparator as MenubarSeparator,
  DropdownMenuSub as MenubarSub,
  DropdownMenuSubTrigger as MenubarSubTrigger,
  DropdownMenuSubContent as MenubarSubContent,
  DropdownMenuShortcut as MenubarShortcut,
} from "@/components/ui/dropdown-menu";

export type MenubarProps = Base.Props;

/**
 * A row of menus. Once one is open, hovering its neighbors opens them instead,
 * and the left and right arrow keys walk the bar.
 */
export function Menubar({ className, children, ...rest }: MenubarProps) {
  const id = useId();
  return (
    <Base
      data-menubar=""
      className={(state) =>
        cn("group/menubar relative flex items-center gap-0.5", typeof className === "function" ? className(state) : className)
      }
      {...rest}
    >
      <LayoutGroup id={id}>{children}</LayoutGroup>
    </Base>
  );
}

export type MenubarMenuProps = Menu.Root.Props;

/** One menu in the bar: a trigger and its content. */
export function MenubarMenu(props: MenubarMenuProps) {
  return <Menu.Root {...props} />;
}

export type MenubarTriggerProps = Menu.Trigger.Props;

/**
 * The menu's name in the bar. The open one sits on a pill that slides to the
 * next menu as the pointer or the arrow keys move along the bar.
 */
export function MenubarTrigger({ className, children, ...rest }: MenubarTriggerProps) {
  const reduce = useReducedMotion();
  return (
    <Menu.Trigger
      className={(state) =>
        cn(
          "relative isolate inline-flex h-7 shrink-0 select-none items-center rounded-md px-2.5 text-[13px] text-fg-2 outline-none",
          "transition-colors duration-150 touch-manipulation [-webkit-tap-highlight-color:transparent]",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
          // Hover is a one-step wash, but only while nothing is open: once a menu is,
          // the pill is the only background on the bar.
          "group-not-data-has-submenu-open/menubar:hover:bg-hover group-not-data-has-submenu-open/menubar:hover:text-fg",
          "data-popup-open:text-fg data-disabled:pointer-events-none data-disabled:opacity-50",
          typeof className === "function" ? className(state) : className,
        )
      }
      render={(props, state) => (
        <button type="button" {...props}>
          {state.open && (
            <motion.span
              aria-hidden
              layoutId="menubar-pill"
              transition={reduce ? { duration: 0 } : spring.snappy}
              className="absolute inset-0 -z-10 rounded-md bg-fg/[0.07]"
            />
          )}
          {props.children}
        </button>
      )}
      {...rest}
    >
      {children}
    </Menu.Trigger>
  );
}

export type MenubarContentProps = DropdownMenuContentProps;

/**
 * The open menu. Its labels start on the same line as the trigger's, and when the
 * bar hands off from one menu to the next the new one appears on the same frame.
 */
export function MenubarContent({ sideOffset = 6, alignOffset = -3, ...rest }: MenubarContentProps) {
  return <DropdownMenuContent side="bottom" align="start" sideOffset={sideOffset} alignOffset={alignOffset} {...rest} />;
}
