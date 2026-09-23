"use client";
import { NavigationMenu } from "@base-ui/react/navigation-menu";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ArrowRight, ChevronDown } from "@/lib/icons";
import { spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * Root: the trigger row, the one pill under it, and the one panel that morphs between menus
 * -----------------------------------------------------------------------------------------------*/

type PillContextValue = { enter: (el: HTMLElement) => void };
const PillContext = createContext<PillContextValue | null>(null);

export type MegaMenuProps = Omit<NavigationMenu.Root.Props, "value" | "defaultValue" | "onValueChange" | "className"> & {
  className?: string;
  /** The open item's value, or null when closed. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  /** Distance from the trigger row to the panel, in px. */
  sideOffset?: number;
  /** Render the panel inside this element instead of the body. */
  container?: React.RefObject<HTMLElement | null>;
  /**
   * What the panel hangs from. "row" keeps it under the start of the trigger row, so wide
   * panels never run off the edge and only the size changes between menus. "trigger"
   * slides it along the row to sit under each trigger.
   */
  anchorTo?: "row" | "trigger";
  /** How the panel lines up with its anchor. */
  align?: "start" | "center" | "end";
};

export function MegaMenu({
  value,
  defaultValue = null,
  onValueChange,
  sideOffset = 8,
  container,
  anchorTo = "row",
  align = "start",
  delay = 80,
  closeDelay = 160,
  className,
  children,
  ...rest
}: MegaMenuProps) {
  const [open, setOpen] = useControllableState<string | null>({ value, defaultValue, onChange: onValueChange });
  const reduce = !!useReducedMotion();
  const listRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const width = useMotionValue(0);
  const [on, setOn] = useState(false);
  const shown = useRef(false);
  const hovering = useRef(false);
  const openedAt = useRef(0);

  // One pill for the whole row. It follows the pointer across triggers and links,
  // and when the pointer leaves the row it rests on the trigger whose panel is open,
  // so you always know which menu you are reading.
  const moveTo = useCallback(
    (el: HTMLElement | null) => {
      const list = listRef.current;
      if (!el || !list) {
        shown.current = false;
        setOn(false);
        return;
      }
      const left = el.getBoundingClientRect().left - list.getBoundingClientRect().left;
      if (shown.current && !reduce) {
        animate(x, left, spring.follow);
        animate(width, el.offsetWidth, spring.follow);
      } else {
        x.jump(left);
        width.jump(el.offsetWidth);
      }
      shown.current = true;
      setOn(true);
    },
    [reduce, x, width],
  );
  const home = useCallback(() => moveTo(listRef.current?.querySelector<HTMLElement>("[data-popup-open]") ?? null), [moveTo]);

  useLayoutEffect(() => {
    if (!hovering.current) home();
  }, [open, home]);

  return (
    <NavigationMenu.Root
      value={open}
      onValueChange={(next, details) => {
        // A press that lands just after hover already opened this panel is the person
        // confirming what they see, not asking to close it. Without this, a quick click on
        // a trigger races the hover delay and shuts the menu under the pointer.
        if (next == null && details.reason === "trigger-press" && performance.now() - openedAt.current < 450) {
          details.cancel();
          return;
        }
        if (next != null && next !== open) openedAt.current = performance.now();
        setOpen((next as string | null) ?? null);
      }}
      delay={delay}
      closeDelay={closeDelay}
      className={cn("relative min-w-0 text-fg", className)}
      {...rest}
    >
      <PillContext.Provider value={{ enter: (el) => ((hovering.current = true), moveTo(el)) }}>
        <div
          ref={listRef}
          className="relative"
          onPointerLeave={() => {
            hovering.current = false;
            home();
          }}
        >
          <motion.span
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 h-8 rounded-full bg-hover"
            style={{ x, width }}
            initial={false}
            animate={{ opacity: on ? 1 : 0 }}
            transition={{ duration: on ? 0.12 : 0.15, ease: "easeOut" }}
          />
          <NavigationMenu.List className="relative flex items-center">{children}</NavigationMenu.List>
        </div>
      </PillContext.Provider>

      <NavigationMenu.Portal container={container}>
        <NavigationMenu.Positioner
          sideOffset={sideOffset}
          align={align}
          alignOffset={align === "center" ? 0 : -4}
          anchor={anchorTo === "row" ? listRef : undefined}
          collisionPadding={{ top: 8, bottom: 8, left: 16, right: 16 }}
          collisionAvoidance={{ side: "none" }}
          className={cn(
            "z-(--z-dropdown) h-(--positioner-height) w-(--positioner-width) max-w-(--available-width)",
            // The panel slides along the row to sit under each trigger it opens for.
            "transition-[top,left,right,bottom] duration-300 ease-out-expo data-instant:transition-none",
            // A bridge over the gap, so the pointer can travel from trigger to panel without closing it.
            "before:absolute before:inset-x-0 before:-top-(--gap) before:h-(--gap) before:content-['']",
          )}
          style={{ ["--gap" as string]: `${sideOffset + 2}px` }}
        >
          <NavigationMenu.Popup
            className={cn(
              "relative h-(--popup-height) w-(--popup-width) origin-(--transform-origin) overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
              // Between menus the panel morphs its size instead of closing and reopening.
              "transition-[width,height,opacity,scale] duration-300 ease-out-expo",
              "data-starting-style:scale-96 data-starting-style:opacity-0",
              "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:ease-out-quart",
              "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
            )}
          >
            <NavigationMenu.Viewport className="relative size-full overflow-hidden" />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Row parts
 * -----------------------------------------------------------------------------------------------*/

const rowItem = cn(
  "relative flex h-8 select-none items-center gap-1 whitespace-nowrap rounded-full px-2 text-[13px] text-fg-2 no-underline outline-none sm:px-3",
  "transition-[color,scale] duration-150 hover:text-fg active:scale-[0.97] active:duration-75 data-popup-open:text-fg aria-[current=page]:text-fg",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
  "before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] pointer-fine:before:hidden",
);

function usePillEnter() {
  const pill = useContext(PillContext);
  return (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "touch") pill?.enter(e.currentTarget);
  };
}

export type MegaMenuItemProps = NavigationMenu.Item.Props;

/** One entry in the row: a trigger with its content, or a plain link. */
export function MegaMenuItem(props: MegaMenuItemProps) {
  return <NavigationMenu.Item {...props} />;
}

export type MegaMenuTriggerProps = Omit<NavigationMenu.Trigger.Props, "className"> & { className?: string };

export function MegaMenuTrigger({ className, children, onPointerEnter, ...rest }: MegaMenuTriggerProps) {
  const enter = usePillEnter();
  return (
    <NavigationMenu.Trigger
      className={cn(rowItem, "group/trigger", className)}
      onPointerEnter={(e) => {
        onPointerEnter?.(e);
        enter(e);
      }}
      {...rest}
    >
      {children}
      <NavigationMenu.Icon className="-mr-1 grid size-3.5 place-items-center text-fg-3 transition-[rotate,color] duration-200 ease-out-expo group-hover/trigger:text-fg-2 data-popup-open:rotate-180 data-popup-open:text-fg-2">
        <ChevronDown size={12} />
      </NavigationMenu.Icon>
    </NavigationMenu.Trigger>
  );
}

export type MegaMenuTopLinkProps = Omit<NavigationMenu.Link.Props, "className"> & { className?: string };

/** A link in the row that opens nothing, such as Pricing. */
export function MegaMenuTopLink({ className, onPointerEnter, ...rest }: MegaMenuTopLinkProps) {
  const enter = usePillEnter();
  return (
    <NavigationMenu.Link
      className={cn(rowItem, className)}
      onPointerEnter={(e) => {
        onPointerEnter?.(e);
        enter(e);
      }}
      {...rest}
    />
  );
}

export type MegaMenuContentProps = Omit<NavigationMenu.Content.Props, "className"> & { className?: string };

/**
 * What a trigger opens. Moving to a neighbor slides the old content out and the new
 * in from the side you moved toward, while the panel resizes around them.
 */
export function MegaMenuContent({ className, ...rest }: MegaMenuContentProps) {
  return (
    <NavigationMenu.Content
      className={cn(
        "h-full w-[calc(100vw-32px)] p-2 sm:w-max",
        "transition-[opacity,translate,filter] duration-300 ease-out-expo data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-200",
        "data-[activation-direction=right]:data-starting-style:translate-x-6 data-[activation-direction=left]:data-starting-style:-translate-x-6",
        "data-[activation-direction=right]:data-ending-style:-translate-x-6 data-[activation-direction=left]:data-ending-style:translate-x-6",
        "motion-reduce:translate-x-0",
        className,
      )}
      {...rest}
    />
  );
}

/* -------------------------------------------------------------------------------------------------
 * Panel parts
 * -----------------------------------------------------------------------------------------------*/

export type MegaMenuLinkProps = Omit<NavigationMenu.Link.Props, "className" | "title"> & {
  className?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** A 16px icon, drawn in a small tile. */
  icon?: React.ReactNode;
};

/** A destination inside a panel: an icon tile, a title and one line of description. */
export function MegaMenuLink({ title, description, icon, className, closeOnClick = true, ...rest }: MegaMenuLinkProps) {
  return (
    <NavigationMenu.Link
      closeOnClick={closeOnClick}
      className={cn(
        "group/link flex min-w-0 items-start gap-3 rounded-lg p-2.5 text-left no-underline outline-none",
        "transition-[background-color,scale] duration-150 hover:bg-hover active:scale-[0.985] active:duration-75 data-active:bg-hover",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
        className,
      )}
      {...rest}
    >
      {icon && (
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-md border border-line-2 bg-frame text-fg-2 shadow-[var(--shadow)] transition-colors duration-150 group-hover/link:text-fg [&_svg]:size-4"
        >
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-0.5 pt-px">
        <span className="text-[13px] font-medium leading-[18px] tracking-[-0.005em] text-fg">{title}</span>
        {description && <span className="line-clamp-2 text-[12px] leading-4 text-fg-3">{description}</span>}
      </span>
    </NavigationMenu.Link>
  );
}

export type MegaMenuSectionProps = Omit<React.ComponentProps<"div">, "title"> & { title?: string };

/** A labeled column of links. */
export function MegaMenuSection({ title, className, children, ...rest }: MegaMenuSectionProps) {
  return (
    <div className={cn("flex min-w-0 flex-col", className)} {...rest}>
      {title && <p className="px-2.5 pb-1.5 pt-2 font-mono text-[10.5px] uppercase leading-none tracking-[0.08em] text-fg-3">{title}</p>}
      <ul className="flex flex-col">
        {Array.isArray(children) ? children.map((c, i) => <li key={i}>{c}</li>) : <li>{children}</li>}
      </ul>
    </div>
  );
}

export type MegaMenuFooterLinkProps = Omit<NavigationMenu.Link.Props, "className"> & { className?: string; label?: React.ReactNode };

/** A strip along the bottom of a panel: "What's new", "All integrations". The arrow nudges on hover. */
export function MegaMenuFooterLink({ label, className, children, closeOnClick = true, ...rest }: MegaMenuFooterLinkProps) {
  return (
    <NavigationMenu.Link
      closeOnClick={closeOnClick}
      className={cn(
        "group/foot -mx-2 -mb-2 mt-2 flex min-w-0 items-center gap-2 border-t border-line bg-frame/60 px-4.5 py-3 text-[12.5px] text-fg-2 no-underline outline-none",
        "transition-colors duration-150 hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-fg-3",
        className,
      )}
      {...rest}
    >
      {label && <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-3">{label}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <ArrowRight size={14} className="shrink-0 text-fg-3 transition-[translate,color] duration-200 ease-out-expo group-hover/foot:translate-x-0.5 group-hover/foot:text-fg-2" />
    </NavigationMenu.Link>
  );
}
