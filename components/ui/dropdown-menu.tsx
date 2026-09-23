"use client";
import { Menu } from "@base-ui/react/menu";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { createContext, useContext, useEffect, useId, useRef } from "react";
import { cn } from "@/lib/cn";
import { ChevronDown, ChevronRight } from "@/lib/icons";
import { spring } from "@/lib/motion";

/* -------------------------------------------------------------------------------------------------
 * Root and trigger
 * -----------------------------------------------------------------------------------------------*/

export type DropdownMenuProps = Menu.Root.Props;

/** Groups a trigger and its menu. Uncontrolled by default; pass `open` + `onOpenChange` to control it. */
export function DropdownMenu(props: DropdownMenuProps) {
  return <Menu.Root {...props} />;
}

export type DropdownMenuTriggerProps = Menu.Trigger.Props & {
  variant?: "secondary" | "ghost";
  size?: "sm" | "md";
  /** Square button with only an icon. Give it an aria-label. */
  iconOnly?: boolean;
  /** A chevron after the label that turns over while the menu is open. */
  chevron?: boolean;
};

/** A button that opens the menu. Styled by default; pass `render` to put the behavior on your own button. */
export function DropdownMenuTrigger({
  variant = "secondary",
  size = "md",
  iconOnly = false,
  chevron = false,
  className,
  children,
  ...rest
}: DropdownMenuTriggerProps) {
  return (
    <Menu.Trigger
      data-variant={variant}
      data-size={size}
      className={(state) => cn(
        "group/trigger relative inline-flex shrink-0 select-none items-center justify-center font-medium tracking-[-0.005em] outline-none",
        "touch-manipulation [-webkit-tap-highlight-color:transparent]",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.97] active:duration-75",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        size === "sm" ? "h-7 gap-1.5 rounded-md text-[12px] [&_svg]:size-3.5" : "h-8 gap-1.5 rounded-lg text-[12.5px] [&_svg]:size-4",
        iconOnly ? (size === "sm" ? "w-7 active:scale-[0.94]" : "w-8 active:scale-[0.94]") : size === "sm" ? "px-2" : "px-2.5",
        iconOnly && !chevron && "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
        chevron && !iconOnly && (size === "sm" ? "pe-1.5" : "pe-2"),
        variant === "secondary"
          ? "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover data-popup-open:border-fg-4 data-popup-open:bg-hover"
          : "text-fg-2 hover:bg-hover hover:text-fg data-popup-open:bg-hover data-popup-open:text-fg",
        typeof className === "function" ? className(state) : className,
      )}
      {...rest}
    >
      {children}
      {chevron && (
        <ChevronDown className="text-fg-3 transition-transform duration-200 ease-out-expo group-data-popup-open/trigger:rotate-180 motion-reduce:transition-none" />
      )}
    </Menu.Trigger>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Popup: the surface, its entrance, and the one highlight that glides between rows
 * -----------------------------------------------------------------------------------------------*/

// The popup grows out of whatever opened it (Base UI sets --transform-origin to the
// trigger edge, or to the pointer for context menus) and drifts 4px away from it.
// data-instant is set when the menu was opened or closed from the keyboard, or when
// a menubar hands off between menus: those render on the same frame.
const popupClass = cn(
  "group/menu relative isolate max-h-(--available-height) min-w-[max(12rem,var(--anchor-width))] max-w-[min(20rem,var(--available-width))]",
  "overflow-y-auto overscroll-contain rounded-xl border border-line-2 bg-raised p-1 text-fg shadow-pop outline-none",
  "[scrollbar-width:none] has-[[data-lead]]:[--menu-lead:26px]",
  "origin-(--transform-origin) transition-[opacity,scale,translate] duration-180 ease-out-expo",
  "data-starting-style:scale-96 data-starting-style:opacity-0",
  "data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1",
  "data-[side=right]:data-starting-style:-translate-x-1 data-[side=inline-end]:data-starting-style:-translate-x-1",
  "data-[side=left]:data-starting-style:translate-x-1 data-[side=inline-start]:data-starting-style:translate-x-1",
  "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-120",
  "data-instant:duration-0 motion-reduce:scale-100 motion-reduce:translate-none",
);

export type DropdownMenuPopupProps = Menu.Popup.Props;

/**
 * The styled menu surface. DropdownMenuContent wraps it in a portal and positioner;
 * use it directly inside another positioner (a context menu, a menubar).
 */
export function DropdownMenuPopup({ className, children, ref, ...rest }: DropdownMenuPopupProps) {
  const popupRef = useRef<HTMLDivElement | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const style = useGlidingHighlight(popupRef, highlightRef);

  return (
    <Menu.Popup
      ref={(node: HTMLDivElement | null) => {
        popupRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className={(state) => cn(popupClass, typeof className === "function" ? className(state) : className)}
      {...rest}
    >
      <motion.div
        ref={highlightRef}
        aria-hidden
        data-tone="default"
        style={style}
        className={cn(
          "pointer-events-none absolute inset-x-1 top-0 -z-10 rounded-lg bg-fg/[0.06] transition-[background-color] duration-100",
          "data-[tone=danger]:bg-danger-soft data-[tone=open]:bg-fg/[0.04] data-pressed:bg-fg/[0.1] data-[tone=danger]:data-pressed:bg-danger/[0.18]",
        )}
      />
      {children}
    </Menu.Popup>
  );
}

// One highlight for the whole list, moved to whichever row Base UI marks as
// highlighted. It springs after the pointer, jumps for arrow keys (keyboard
// navigation never animates), and fades rather than slides when it first appears
// so it never sweeps in from the top of the menu. Motion values keep all of this
// off React's render path.
function useGlidingHighlight(popupRef: React.RefObject<HTMLDivElement | null>, highlightRef: React.RefObject<HTMLDivElement | null>) {
  const reduce = useReducedMotion();
  const y = useMotionValue(0);
  const height = useMotionValue(0);
  const opacity = useMotionValue(0);

  useEffect(() => {
    const popup = popupRef.current;
    const hl = highlightRef.current;
    if (!popup || !hl) return;
    let input: "pointer" | "keyboard" = "pointer";
    let shown = false;

    const sync = () => {
      // Only rows that belong to this popup; submenus are portaled, so a plain query is enough.
      const row =
        popup.querySelector<HTMLElement>("[data-highlighted]") ??
        popup.querySelector<HTMLElement>("[data-popup-open][role=menuitem]");
      if (!row) {
        if (shown) animate(opacity, 0, { duration: 0.12 });
        shown = false;
        delete hl.dataset.pressed;
        return;
      }
      hl.dataset.tone = row.dataset.variant === "danger" ? "danger" : row.hasAttribute("data-highlighted") ? "default" : "open";
      const top = row.offsetTop;
      const h = row.offsetHeight;
      if (!shown || input === "keyboard" || reduce) {
        y.jump(top);
        height.jump(h);
      } else {
        animate(y, top, spring.follow);
        animate(height, h, spring.follow);
      }
      animate(opacity, row.hasAttribute("data-disabled") ? 0.5 : 1, { duration: shown ? 0.08 : 0.1 });
      shown = true;
    };

    const onKey = () => (input = "keyboard");
    const onMove = () => (input = "pointer");
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("[role^=menuitem]:not([data-disabled])")) hl.dataset.pressed = "";
    };
    const onUp = () => delete hl.dataset.pressed;

    const observer = new MutationObserver(sync);
    observer.observe(popup, { subtree: true, attributes: true, attributeFilter: ["data-highlighted", "data-popup-open"] });
    popup.addEventListener("keydown", onKey, true);
    popup.addEventListener("pointermove", onMove, true);
    popup.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    sync();
    return () => {
      observer.disconnect();
      popup.removeEventListener("keydown", onKey, true);
      popup.removeEventListener("pointermove", onMove, true);
      popup.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [popupRef, highlightRef, reduce, y, height, opacity]);

  return { y, height, opacity };
}

export type DropdownMenuContentProps = DropdownMenuPopupProps & {
  side?: Menu.Positioner.Props["side"];
  align?: Menu.Positioner.Props["align"];
  sideOffset?: number;
  alignOffset?: number;
  collisionPadding?: Menu.Positioner.Props["collisionPadding"];
  /** Position against this element instead of the trigger. */
  anchor?: Menu.Positioner.Props["anchor"];
  /** Where the menu is portaled. Defaults to the body. */
  container?: Menu.Portal.Props["container"];
};

/** The menu itself: portaled, positioned against the trigger, and grown out of it. */
export function DropdownMenuContent({
  side = "bottom",
  align = "start",
  sideOffset = 6,
  alignOffset = 0,
  collisionPadding = 8,
  anchor,
  container,
  ...rest
}: DropdownMenuContentProps) {
  return (
    <Menu.Portal container={container}>
      <Menu.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
        anchor={anchor}
        className="z-(--z-dropdown) outline-none"
      >
        <DropdownMenuPopup {...rest} />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Rows
 * -----------------------------------------------------------------------------------------------*/

// Rows carry no background of their own: the shared highlight paints it. Labels line
// up across the whole menu: once any row has a leading icon or indicator, rows
// without one are indented by the same 26px (--menu-lead, set on the popup).
const rowClass = cn(
  "group/item relative flex min-h-8 cursor-default select-none items-center gap-2.5 rounded-lg pe-2 text-[13px] leading-[18px] outline-none",
  "ps-[calc(0.5rem+var(--menu-lead,0px))] has-[[data-lead]]:ps-2 pointer-coarse:min-h-10",
  "data-disabled:opacity-50 data-[variant=danger]:text-danger",
);

const leadClass =
  "grid size-4 shrink-0 place-items-center text-fg-3 transition-colors duration-100 group-data-highlighted/item:text-fg-2 group-data-[variant=danger]/item:text-danger [&_svg]:size-4";
// Checkbox and radio indicators carry state, so they stay at full strength.
const indicatorClass = "grid size-4 shrink-0 place-items-center text-fg";
// With a description the row grows; the icon and keys stay on the first line.
const firstLine = "self-start mt-[7px]";

type RowContent = {
  /** A 16px icon before the label. */
  icon?: React.ReactNode;
  /** Keys shown at the end of the row, as glyphs: "⌘D", "⇧⌘C", "⌫". Display only. */
  shortcut?: string;
  /** A second, quieter line under the label. */
  description?: React.ReactNode;
};

function RowBody({ icon, shortcut, description, children }: RowContent & { children?: React.ReactNode }) {
  return (
    <>
      {icon && (
        <span data-lead aria-hidden className={cn(leadClass, description ? firstLine : undefined)}>
          {icon}
        </span>
      )}
      {description ? (
        <span className="flex min-w-0 flex-1 flex-col py-1.5">
          <span className="truncate">{children}</span>
          <span className="line-clamp-2 text-[12px] leading-4 text-fg-3">{description}</span>
        </span>
      ) : (
        <span className="min-w-0 flex-1 truncate">{children}</span>
      )}
      {shortcut && <DropdownMenuShortcut keys={shortcut} className={description ? "self-start mt-[10px]" : undefined} />}
    </>
  );
}

const textOf = (node: React.ReactNode) => (typeof node === "string" ? node : undefined);

export type DropdownMenuItemProps = Menu.Item.Props &
  RowContent & {
    /** Destructive: danger text, and the highlight turns danger when it lands here. */
    variant?: "default" | "danger";
  };

export function DropdownMenuItem({ icon, shortcut, description, variant = "default", className, children, label, ...rest }: DropdownMenuItemProps) {
  return (
    <Menu.Item
      data-variant={variant}
      label={label ?? textOf(children)}
      aria-keyshortcuts={toAriaShortcut(shortcut)}
      className={(state) => cn(rowClass, typeof className === "function" ? className(state) : className)}
      {...rest}
    >
      <RowBody icon={icon} shortcut={shortcut} description={description}>
        {children}
      </RowBody>
    </Menu.Item>
  );
}

export type DropdownMenuLinkItemProps = Menu.LinkItem.Props & RowContent;

/** A row that navigates. Renders an anchor, so it opens in a new tab like any link. */
export function DropdownMenuLinkItem({ icon, shortcut, description, className, children, label, ...rest }: DropdownMenuLinkItemProps) {
  return (
    <Menu.LinkItem
      label={label ?? textOf(children)}
      className={(state) => cn(rowClass, "text-fg no-underline", typeof className === "function" ? className(state) : className)}
      {...rest}
    >
      <RowBody icon={icon} shortcut={shortcut} description={description}>
        {children}
      </RowBody>
    </Menu.LinkItem>
  );
}

export type DropdownMenuCheckboxItemProps = Menu.CheckboxItem.Props & Omit<RowContent, "icon">;

/** Toggles a setting. The menu stays open and the tick draws itself in. */
export function DropdownMenuCheckboxItem({ shortcut, description, className, children, label, ...rest }: DropdownMenuCheckboxItemProps) {
  return (
    <Menu.CheckboxItem
      label={label ?? textOf(children)}
      aria-keyshortcuts={toAriaShortcut(shortcut)}
      className={(state) => cn(rowClass, typeof className === "function" ? className(state) : className)}
      {...rest}
    >
      <Menu.CheckboxItemIndicator keepMounted data-lead className={cn(indicatorClass, description ? firstLine : undefined)}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path
            d="M3.5 8.5 6.5 11.5 12.5 4.5"
            pathLength={1}
            className="[stroke-dasharray:1] [stroke-dashoffset:1] transition-[stroke-dashoffset] duration-120 ease-out in-data-checked:[stroke-dashoffset:0] in-data-checked:duration-280 in-data-checked:ease-out-expo motion-reduce:transition-none"
          />
        </svg>
      </Menu.CheckboxItemIndicator>
      <RowBody shortcut={shortcut} description={description}>
        {children}
      </RowBody>
    </Menu.CheckboxItem>
  );
}

const RadioDot = createContext<string | null>(null);

export type DropdownMenuRadioGroupProps = Menu.RadioGroup.Props;

/** One choice out of several. Controlled with value + onValueChange, or defaultValue. */
export function DropdownMenuRadioGroup(props: DropdownMenuRadioGroupProps) {
  const id = useId();
  return (
    <RadioDot.Provider value={id}>
      <Menu.RadioGroup {...props} />
    </RadioDot.Provider>
  );
}

export type DropdownMenuRadioItemProps = Menu.RadioItem.Props & Omit<RowContent, "icon">;

/** One option in a radio group. The dot glides from the old choice to the new one. */
export function DropdownMenuRadioItem({ shortcut, description, className, children, label, ...rest }: DropdownMenuRadioItemProps) {
  const dot = useContext(RadioDot);
  const reduce = useReducedMotion();
  return (
    <Menu.RadioItem
      label={label ?? textOf(children)}
      aria-keyshortcuts={toAriaShortcut(shortcut)}
      className={(state) => cn(rowClass, typeof className === "function" ? className(state) : className)}
      {...rest}
    >
      <Menu.RadioItemIndicator
        keepMounted
        data-lead
        className={cn(indicatorClass, description ? firstLine : undefined)}
        render={(props, state) => (
          <span {...props}>
            {state.checked && (
              <motion.span
                layoutId={dot ? `menu-radio-${dot}` : undefined}
                transition={reduce ? { duration: 0 } : spring.snappy}
                className="size-1.5 rounded-full bg-current"
              />
            )}
          </span>
        )}
      />
      <RowBody shortcut={shortcut} description={description}>
        {children}
      </RowBody>
    </Menu.RadioItem>
  );
}

export type DropdownMenuGroupProps = Menu.Group.Props;

export function DropdownMenuGroup(props: DropdownMenuGroupProps) {
  return <Menu.Group {...props} />;
}

export type DropdownMenuLabelProps = Menu.GroupLabel.Props;

/** A quiet heading for the group it sits in; screen readers announce it with the group. */
export function DropdownMenuLabel({ className, ...rest }: DropdownMenuLabelProps) {
  return (
    <Menu.GroupLabel
      className={(state) =>
        cn(
          "select-none pe-2 pb-1 pt-2 font-mono text-2xs uppercase tracking-[0.08em] text-fg-3",
          "ps-[calc(0.5rem+var(--menu-lead,0px))]",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...rest}
    />
  );
}

export type DropdownMenuSeparatorProps = Menu.Separator.Props;

export function DropdownMenuSeparator({ className, ...rest }: DropdownMenuSeparatorProps) {
  return <Menu.Separator className={(state) => cn("-mx-1 my-1 h-px bg-line", typeof className === "function" ? className(state) : className)} {...rest} />;
}

/* -------------------------------------------------------------------------------------------------
 * Submenus
 * -----------------------------------------------------------------------------------------------*/

export type DropdownMenuSubProps = Menu.SubmenuRoot.Props;

export function DropdownMenuSub(props: DropdownMenuSubProps) {
  return <Menu.SubmenuRoot {...props} />;
}

export type DropdownMenuSubTriggerProps = Menu.SubmenuTrigger.Props & Omit<RowContent, "shortcut">;

/** A row that opens a submenu on hover, click, or the right arrow key. */
export function DropdownMenuSubTrigger({ icon, description, className, children, label, ...rest }: DropdownMenuSubTriggerProps) {
  return (
    <Menu.SubmenuTrigger
      label={label ?? textOf(children)}
      className={(state) => cn(rowClass, typeof className === "function" ? className(state) : className)}
      {...rest}
    >
      <RowBody icon={icon} description={description}>
        {children}
      </RowBody>
      <ChevronRight
        size={14}
        className="-me-0.5 shrink-0 text-fg-3 transition-[translate,color] duration-150 ease-out group-data-highlighted/item:translate-x-0.5 group-data-highlighted/item:text-fg-2 group-data-popup-open/item:translate-x-0.5 motion-reduce:transition-none"
      />
    </Menu.SubmenuTrigger>
  );
}

export type DropdownMenuSubContentProps = DropdownMenuPopupProps & {
  sideOffset?: number;
  alignOffset?: number;
  container?: Menu.Portal.Props["container"];
};

/** The submenu surface. Its first row lines up with the row that opened it. */
export function DropdownMenuSubContent({ sideOffset = 6, alignOffset = -5, container, ...rest }: DropdownMenuSubContentProps) {
  return (
    <Menu.Portal container={container}>
      <Menu.Positioner side="inline-end" align="start" sideOffset={sideOffset} alignOffset={alignOffset} collisionPadding={8} className="z-(--z-dropdown) outline-none">
        <DropdownMenuPopup {...rest} />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Shortcut
 * -----------------------------------------------------------------------------------------------*/

const MODIFIERS = "⌃⌥⇧⌘";
const MODIFIER_NAMES: Record<string, string> = { "⌃": "Control", "⌥": "Alt", "⇧": "Shift", "⌘": "Meta" };

function splitKeys(keys: string) {
  let i = 0;
  while (i < keys.length && MODIFIERS.includes(keys[i])) i++;
  return [keys.slice(0, i), keys.slice(i)] as const;
}

function toAriaShortcut(keys?: string) {
  if (!keys) return undefined;
  const [mods, key] = splitKeys(keys);
  return [...[...mods].map((m) => MODIFIER_NAMES[m]), key.length === 1 ? key.toUpperCase() : key].join("+");
}

export type DropdownMenuShortcutProps = Omit<React.ComponentProps<"kbd">, "children"> & {
  /** Modifier glyphs then the key: "⇧⌘S". */
  keys: string;
};

/**
 * Keys at the end of a row. The key sits in its own column and modifiers stack
 * to its left, so ⌘S and ⇧⌘S line up on the S the way native menus do. Hidden on
 * touch screens, where there is no keyboard to press them on.
 */
export function DropdownMenuShortcut({ keys, className, ...rest }: DropdownMenuShortcutProps) {
  const [mods, key] = splitKeys(keys);
  return (
    <kbd
      aria-hidden
      className={cn(
        "ms-auto flex shrink-0 items-center ps-6 font-sans text-[12px] leading-none text-fg-3 tabular pointer-coarse:hidden",
        "group-data-highlighted/item:text-fg-2 group-data-[variant=danger]/item:text-danger/70",
        className,
      )}
      {...rest}
    >
      <span className="tracking-[0.04em]">{mods}</span>
      <span className="min-w-[1em] text-start">{key}</span>
    </kbd>
  );
}

