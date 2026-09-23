"use client";
import { Menu } from "@base-ui/react/menu";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { createContext, useContext } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

const ReduceContext = createContext(false);

export type SpeedDialProps = {
  /** What the button does, e.g. "Create". Its accessible name, and a hint beside it on hover. */
  label: string;
  /** The actions, as SpeedDialAction elements, listed top to bottom. */
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Where the button sits. `fixed` pins it to the viewport's bottom-right corner above the
   * safe area; `absolute` to the nearest positioned ancestor's; `inline` leaves it in the flow.
   */
  placement?: "fixed" | "absolute" | "inline";
  /** Render the actions into this element instead of document.body. */
  container?: HTMLElement | React.RefObject<HTMLElement | null> | null;
  /** The glyph on the button. Rotates 45° when open, so a plus becomes a cross. */
  icon?: React.ReactNode;
  /** Dim what's behind the actions so their labels stay readable. */
  scrim?: boolean;
  className?: string;
  disabled?: boolean;
};

export function SpeedDial({
  label,
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placement = "fixed",
  container,
  icon,
  scrim = true,
  className,
  disabled,
}: SpeedDialProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const reduce = !!useReducedMotion();

  // Nearest action first on the way out, a quicker reverse on the way back.
  const list: Variants = {
    open: { transition: { staggerChildren: reduce ? 0 : 0.035, staggerDirection: -1 } },
    closed: { transition: { staggerChildren: reduce ? 0 : 0.02, staggerDirection: 1 } },
  };

  return (
    <ReduceContext.Provider value={reduce}>
      <Menu.Root open={open} onOpenChange={(next) => setOpen(next)} modal={false} disabled={disabled}>
        <div
          className={cn(
            "group/dial isolate",
            // Above the scrim, so the button that closes the dial is never dimmed.
            placement === "fixed" && "fixed bottom-[max(24px,env(safe-area-inset-bottom))] right-6 z-(--z-dropdown)",
            placement === "absolute" && "absolute bottom-4 right-4 z-(--z-dropdown)",
            placement === "inline" && "relative z-(--z-dropdown) inline-flex",
            className,
          )}
        >
          <Menu.Trigger
            aria-label={label}
            className={cn(
              "relative grid size-12 place-items-center rounded-full bg-fg text-frame shadow-pop outline-none",
              "transition-[background-color,scale] duration-150 ease-out hover:bg-fg/90 active:scale-[0.94] active:duration-75",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              "data-disabled:pointer-events-none data-disabled:opacity-50",
            )}
          >
            <motion.span
              aria-hidden
              className="grid place-items-center"
              initial={false}
              animate={{ rotate: open ? 45 : 0 }}
              transition={reduce ? { duration: 0 } : spring.snappy}
            >
              {icon ?? (
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
                  <path d="M8 3.5v9M3.5 8h9" />
                </svg>
              )}
            </motion.span>
          </Menu.Trigger>
          {/* A quiet name beside the button on hover; the button already carries it as its label. */}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-md border border-line-2 bg-raised px-2 py-1 text-[12px] font-medium text-fg opacity-0 shadow-pop",
              "transition-[opacity,translate] duration-150 ease-out",
              !open && "group-hover/dial:translate-x-0 group-hover/dial:opacity-100 group-hover/dial:delay-300",
            )}
          >
            {label}
          </span>
        </div>

        <AnimatePresence>
          {open && (
            <Menu.Portal keepMounted container={container}>
              {scrim && (
                <Menu.Backdrop
                  className={cn(container ? "absolute" : "fixed", "inset-0 z-(--z-sticky) bg-frame/80")}
                  render={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.14 } }} transition={{ duration: 0.2, ease: ease.out }} />}
                />
              )}
              <Menu.Positioner side="top" align="end" sideOffset={12} className="z-(--z-dropdown) outline-none">
                <Menu.Popup
                  className="flex flex-col items-end gap-2.5 pr-1 outline-none"
                  render={<motion.div variants={list} initial="closed" animate="open" exit="closed" />}
                >
                  {children}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          )}
        </AnimatePresence>
      </Menu.Root>
    </ReduceContext.Provider>
  );
}

export type SpeedDialActionProps = {
  /** The action's name, shown in a pill beside its button. */
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  disabled?: boolean;
  /** Keep the dial open after this action, e.g. for toggles. */
  closeOnClick?: boolean;
  className?: string;
};

export function SpeedDialAction({ children, icon, onClick, disabled, closeOnClick = true, className }: SpeedDialActionProps) {
  const reduce = useContext(ReduceContext);
  const row: Variants = reduce
    ? { closed: { opacity: 0, transition: { duration: 0.1 } }, open: { opacity: 1, transition: { duration: 0.15 } } }
    : {
        closed: { opacity: 0, y: 10, scale: 0.8, transition: { duration: 0.12, ease: ease.in } },
        open: { opacity: 1, y: 0, scale: 1, transition: spring.snappy },
      };
  // The label trails its button slightly, sliding in from the button's side.
  const pill: Variants = reduce
    ? { closed: {}, open: {} }
    : { closed: { opacity: 0, x: 8, transition: { duration: 0.1 } }, open: { opacity: 1, x: 0, transition: { ...spring.snappy, delay: 0.04 } } };

  return (
    <Menu.Item
      disabled={disabled}
      closeOnClick={closeOnClick}
      onClick={onClick}
      render={<motion.div variants={row} style={{ originX: 1, originY: 1 }} />}
      className={cn(
        "group/action flex cursor-default select-none items-center gap-3 outline-none",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
    >
      <motion.span
        variants={pill}
        className={cn(
          "whitespace-nowrap rounded-lg border border-line-2 bg-raised px-2.5 py-1.5 text-[12.5px] font-medium leading-none text-fg-2 shadow-pop",
          "transition-[color,border-color] duration-150",
          "group-data-highlighted/action:border-fg-4 group-data-highlighted/action:text-fg",
        )}
      >
        {children}
      </motion.span>
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full border border-line-2 bg-raised text-fg-2 shadow-pop",
          "transition-[background-color,color,border-color,scale] duration-150 ease-out group-active/action:scale-[0.92]",
          "group-data-highlighted/action:border-fg-4 group-data-highlighted/action:bg-hover group-data-highlighted/action:text-fg",
        )}
      >
        {icon}
      </span>
    </Menu.Item>
  );
}
