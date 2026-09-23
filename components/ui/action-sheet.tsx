"use client";
import { Drawer } from "@base-ui/react/drawer";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useId, useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

type Ctx = {
  close: () => void;
  busy: string | null;
  setBusy: (id: string | null) => void;
  contained: boolean;
};
const SheetContext = createContext<Ctx | null>(null);
const PortalTarget = createContext<HTMLElement | undefined>(undefined);
const useSheet = () => {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error("ActionSheet parts must be used inside <ActionSheet>");
  return ctx;
};

export type ActionSheetProps = Omit<Drawer.Root.Props, "open" | "defaultOpen" | "onOpenChange" | "swipeDirection" | "children"> & {
  children?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Render inside this element instead of over the page: the backdrop and sheet
   * fill it, and page scroll stays unlocked. Give it `position: relative` and
   * `overflow: hidden`.
   */
  container?: HTMLElement | null;
};

/** A list of actions that rises from the bottom edge: the phone's version of a menu. */
export function ActionSheet({ open, defaultOpen = false, onOpenChange, container, modal, children, ...rest }: ActionSheetProps) {
  const [isOpen, setOpen] = useControllableState({ value: open, defaultValue: defaultOpen, onChange: onOpenChange });
  const [busy, setBusy] = useState<string | null>(null);
  const contained = container !== undefined;
  return (
    <SheetContext.Provider value={{ close: () => setOpen(false), busy, setBusy, contained }}>
      <Drawer.Root
        open={isOpen}
        onOpenChange={(next) => setOpen(next)}
        onOpenChangeComplete={(next) => !next && setBusy(null)}
        swipeDirection="down"
        modal={modal ?? (contained ? "trap-focus" : true)}
        {...rest}
      >
        <PortalTarget.Provider value={container ?? undefined}>{children}</PortalTarget.Provider>
      </Drawer.Root>
    </SheetContext.Provider>
  );
}

export type ActionSheetTriggerProps = Drawer.Trigger.Props;

/** Opens the sheet. Unstyled: pass `render` to use your own button, or style it with className. */
export function ActionSheetTrigger(props: ActionSheetTriggerProps) {
  return <Drawer.Trigger {...props} />;
}

export type ActionSheetContentProps = Omit<Drawer.Popup.Props, "title"> & {
  /** A short line naming what the actions apply to. */
  title?: React.ReactNode;
  /** One more line of context under the title. */
  description?: React.ReactNode;
  /** Accessible name when there is no visible title. */
  label?: string;
  cancelLabel?: string;
};

/**
 * The sheet: a card of actions and, apart from it, Cancel, where the thumb rests.
 * Swipe it down, tap outside or press Escape to dismiss.
 */
export function ActionSheetContent({ title, description, label = "Actions", cancelLabel = "Cancel", className, children, ...rest }: ActionSheetContentProps) {
  const { contained } = useSheet();
  const container = useContext(PortalTarget);

  // Arrow keys walk the actions like a menu; Tab still works as in any dialog.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("[data-sheet-action]:not(:disabled):not([aria-disabled=true])")];
    if (!buttons.length) return;
    e.preventDefault();
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : e.key === "ArrowDown" ? (at + 1) % buttons.length : (at - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return (
    <Drawer.Portal container={container}>
      <Drawer.Backdrop
        className={cn(
          contained ? "absolute" : "fixed",
          "inset-0 z-(--z-overlay) bg-overlay opacity-[calc(1-var(--drawer-swipe-progress,0))]",
          "transition-opacity duration-400 ease-drawer data-swiping:duration-0",
          "data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*280ms)]",
        )}
      />
      <Drawer.Viewport className={cn(contained ? "absolute" : "fixed", "inset-0 z-(--z-dialog) flex items-end justify-center")}>
        <Drawer.Popup
          onKeyDown={onKeyDown}
          className={(state) =>
            cn(
              "pointer-events-none flex w-full max-w-[420px] flex-col gap-2 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] outline-none",
              // Follows the finger 1:1 while swiped; otherwise rides the sheet curve in and out.
              "[transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-400 ease-drawer data-swiping:duration-0 data-swiping:select-none",
              "data-starting-style:[transform:translateY(calc(100%+8px))] data-ending-style:[transform:translateY(calc(100%+8px))]",
              "data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*280ms)]",
              typeof className === "function" ? className(state) : className,
            )
          }
          {...rest}
        >
          <Drawer.Content className="pointer-events-auto overflow-hidden rounded-2xl border border-line-2 bg-raised shadow-pop">
            {title || description ? (
              <div className="flex flex-col items-center gap-0.5 border-b border-line px-5 py-3.5 text-center">
                {title && <Drawer.Title className="text-balance text-[13px] font-medium leading-[18px] text-fg-2">{title}</Drawer.Title>}
                {description && <Drawer.Description className="text-balance text-[12.5px] leading-[18px] text-fg-3">{description}</Drawer.Description>}
                {!title && <Drawer.Title className="sr-only">{label}</Drawer.Title>}
              </div>
            ) : (
              <Drawer.Title className="sr-only">{label}</Drawer.Title>
            )}
            <div role="group" aria-label={typeof title === "string" ? title : label} className="flex flex-col divide-y divide-line">
              {children}
            </div>
          </Drawer.Content>
          <Drawer.Close data-sheet-action="" className={cn(rowClass, "pointer-events-auto rounded-2xl text-fg border border-line-2 bg-raised font-medium shadow-pop")}>
            {cancelLabel}
          </Drawer.Close>
        </Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  );
}

const rowClass = cn(
  "relative flex min-h-13 w-full select-none flex-col items-center justify-center px-12 py-2 text-center text-[15px] leading-5 outline-none",
  "touch-manipulation [-webkit-tap-highlight-color:transparent] transition-colors duration-100",
  "hover:bg-fg/[0.04] active:bg-fg/[0.08] focus-visible:bg-fg/[0.04] focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-4 focus-visible:outline-fg-3",
  "disabled:opacity-40 disabled:hover:bg-transparent aria-disabled:opacity-40 aria-disabled:hover:bg-transparent aria-disabled:active:bg-transparent",
);

export type ActionSheetItemProps = Omit<React.ComponentProps<"button">, "onSelect"> & {
  /**
   * Runs the action. Return a promise to keep the sheet up with a spinner on this
   * row until it settles: it closes on success and says so on the row if it fails.
   */
  onSelect?: () => void | Promise<unknown>;
  /** Destructive: danger text. Put it last. */
  variant?: "default" | "danger";
  /** Shown under the label if the returned promise rejects without a message. */
  errorLabel?: string;
};

export function ActionSheetItem({ onSelect, variant = "default", errorLabel = "Couldn’t finish. Try again.", disabled, className, children, onClick, ...rest }: ActionSheetItemProps) {
  const { close, busy, setBusy } = useSheet();
  const id = useId();
  const reduce = useReducedMotion();
  const [error, setError] = useState<string | null>(null);
  const mine = busy === id;
  const blocked = busy !== null && !mine;

  return (
    <button
      type="button"
      data-sheet-action=""
      data-variant={variant}
      data-busy={mine ? "" : undefined}
      disabled={disabled}
      aria-disabled={blocked || undefined}
      aria-busy={mine || undefined}
      onClick={async (e) => {
        onClick?.(e);
        if (e.defaultPrevented || busy !== null) return;
        setError(null);
        const result = onSelect?.();
        if (!result || typeof (result as Promise<unknown>).then !== "function") return close();
        setBusy(id);
        try {
          await result;
          close();
        } catch (err) {
          setBusy(null);
          setError(err instanceof Error && err.message ? err.message : errorLabel);
        }
      }}
      className={cn(rowClass, variant === "danger" ? "text-danger" : "text-fg", mine && "cursor-progress bg-fg/[0.04]", className)}
      {...rest}
    >
      <span className="max-w-full truncate">{children}</span>
      <AnimatePresence initial={false}>
        {error && (
          <motion.span
            key="error"
            role="alert"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: ease.out }}
            className="block overflow-hidden text-[12.5px] leading-[18px] text-danger"
          >
            {error}
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {mine && (
          <motion.span
            key="busy"
            aria-hidden
            initial={{ opacity: 0, scale: reduce ? 1 : 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.18, ease: ease.out }}
            className="absolute end-4 top-1/2 -mt-2 grid size-4 place-items-center text-fg-3"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="animate-spin motion-reduce:animate-spin-slow" aria-hidden>
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
              <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
