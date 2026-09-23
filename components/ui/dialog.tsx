"use client";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { useReducedMotion } from "motion/react";
import { createContext, useContext, useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { X } from "@/lib/icons";

type DialogContextValue = { setPopup: (node: HTMLDivElement | null) => void; nudge: () => void };
const DialogContext = createContext<DialogContextValue | null>(null);

/**
 * A small "I'm still here" push: the popup swells 1.5% and settles. Used when a
 * click outside is refused, so the refusal reads as intentional, not as lag.
 */
function nudgeElement(el: HTMLElement | null, reduce: boolean) {
  if (!el || reduce || typeof el.animate !== "function") return;
  el.animate([{ transform: "scale(1)" }, { transform: "scale(1.015)" }, { transform: "scale(1)" }], {
    duration: 280,
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  });
}

export type DialogProps = BaseDialog.Root.Props & {
  /**
   * Whether a click on the backdrop closes the dialog. When false the dialog
   * nudges instead, which is what you want once a form has unsaved input.
   * Escape and the close button still work.
   */
  dismissible?: boolean;
};

export function Dialog({ dismissible = true, onOpenChange, ...rest }: DialogProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const reduce = !!useReducedMotion();
  const nudge = () => nudgeElement(popupRef.current, reduce);
  const setPopup = (node: HTMLDivElement | null) => {
    popupRef.current = node;
  };
  return (
    <DialogContext.Provider value={{ setPopup, nudge }}>
      <BaseDialog.Root
        onOpenChange={(open, details) => {
          if (!open && !dismissible && details.reason === "outside-press") {
            details.cancel();
            nudge();
            return;
          }
          onOpenChange?.(open, details);
        }}
        {...rest}
      />
    </DialogContext.Provider>
  );
}

/** Nudge the open dialog from your own code, e.g. when you cancel a close in onOpenChange. */
export function useDialogNudge() {
  return useContext(DialogContext)?.nudge ?? (() => {});
}

export type DialogTriggerProps = BaseDialog.Trigger.Props;

/** Opens the dialog. Pass your own button with `render` to keep its look. */
export function DialogTrigger(props: DialogTriggerProps) {
  return <BaseDialog.Trigger {...props} />;
}

export type DialogSize = "sm" | "md" | "lg";

const widths: Record<DialogSize, string> = {
  sm: "max-w-[400px]",
  md: "max-w-[520px]",
  lg: "max-w-[720px]",
};

export type DialogContentProps = Omit<BaseDialog.Popup.Props, "className"> & {
  className?: string;
  /** 400px for a confirm, 520px for a form, 720px for content. */
  size?: DialogSize;
  /** The × in the top-right corner. */
  showCloseButton?: boolean;
  /** Accessible name of the close button. */
  closeLabel?: string;
  /** Render into this element instead of document.body. The backdrop then covers only the container. */
  container?: BaseDialog.Portal.Props["container"];
  backdropClassName?: string;
};

export function DialogContent({
  size = "md",
  showCloseButton = true,
  closeLabel = "Close",
  container,
  backdropClassName,
  className,
  children,
  ref,
  ...rest
}: DialogContentProps) {
  const ctx = useContext(DialogContext);
  const contained = container != null;
  return (
    <BaseDialog.Portal container={container}>
      <BaseDialog.Backdrop
        className={cn(
          contained ? "absolute" : "fixed",
          "inset-0 z-(--z-overlay) bg-overlay",
          // In fast, out faster. Opacity only: a backdrop has nothing to say about direction.
          "transition-opacity duration-200 ease-out-quart data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-150",
          backdropClassName,
        )}
      />
      <BaseDialog.Viewport
        className={cn(
          contained ? "absolute" : "fixed",
          "inset-0 z-(--z-dialog) flex items-center justify-center p-4",
          // On a phone the dialog sits at the bottom, under the thumb.
          "max-sm:items-end max-sm:p-2 max-sm:pb-[max(8px,env(safe-area-inset-bottom))]",
        )}
      >
        <BaseDialog.Popup
          ref={(node: HTMLDivElement | null) => {
            ctx?.setPopup(node);
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          data-size={size}
          data-closable={showCloseButton ? "" : undefined}
          className={cn(
            "group/dialog relative flex max-h-full w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
            widths[size],
            // Enter: fade, grow from .97 and rise 6px on the expo curve. Exit: faster and simpler, no travel.
            "origin-center transition-[opacity,scale,translate] duration-[260ms] ease-out-expo",
            "data-starting-style:translate-y-1.5 data-starting-style:scale-[0.97] data-starting-style:opacity-0",
            "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-[160ms] data-ending-style:ease-out-quart",
            // Phones: rise from the bottom edge instead of growing in the middle.
            "max-sm:data-starting-style:translate-y-4 max-sm:data-starting-style:scale-100",
            // A dialog opened on top of this one pushes it back and dims it.
            "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-overlay after:opacity-0 after:transition-opacity after:duration-200",
            "data-nested-dialog-open:scale-[0.96] data-nested-dialog-open:after:opacity-100",
            className,
          )}
          {...rest}
        >
          {children}
          {showCloseButton && (
            // Last in the DOM so initial focus lands on the content, first on screen.
            <BaseDialog.Close
              aria-label={closeLabel}
              className={cn(
                "absolute right-3 top-3 grid size-7 place-items-center rounded-md text-fg-3",
                "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                "transition-[background-color,color,scale] duration-150 ease-out-quart hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
                "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
              )}
            >
              <X size={16} />
            </BaseDialog.Close>
          )}
        </BaseDialog.Popup>
      </BaseDialog.Viewport>
    </BaseDialog.Portal>
  );
}

export type DialogHeaderProps = React.ComponentProps<"div">;

export function DialogHeader({ className, ...rest }: DialogHeaderProps) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex shrink-0 flex-col gap-1 px-5 pb-2 pt-5 group-data-closable/dialog:pr-12", className)}
      {...rest}
    />
  );
}

export type DialogTitleProps = Omit<BaseDialog.Title.Props, "className"> & { className?: string };

export function DialogTitle({ className, ...rest }: DialogTitleProps) {
  return (
    <BaseDialog.Title
      className={cn("text-[15px] font-medium leading-[1.3] tracking-[-0.015em] text-fg text-balance", className)}
      {...rest}
    />
  );
}

export type DialogDescriptionProps = Omit<BaseDialog.Description.Props, "className"> & { className?: string };

export function DialogDescription({ className, ...rest }: DialogDescriptionProps) {
  return <BaseDialog.Description className={cn("text-[13px] leading-[1.5] text-fg-2 text-pretty", className)} {...rest} />;
}

export type DialogBodyProps = React.ComponentProps<"div">;

/**
 * The part that scrolls. The header and footer stay put; a hairline appears on
 * each edge only while there is more content hidden past it.
 */
export function DialogBody({ className, children, ...rest }: DialogBodyProps) {
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
      // A region that scrolls must be reachable by keyboard when nothing inside it is.
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
    <div ref={wrap} data-slot="dialog-body" className="group/body relative flex min-h-0 flex-1 flex-col">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-1 h-px bg-line-2 opacity-0 transition-opacity duration-150 group-data-overflow-top/body:opacity-100"
      />
      <div
        ref={scroller}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-2 outline-none",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-4",
          className,
        )}
        {...rest}
      >
        <div ref={content}>{children}</div>
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-1 h-px bg-line-2 opacity-0 transition-opacity duration-150 group-data-overflow-bottom/body:opacity-100"
      />
    </div>
  );
}

export type DialogFooterProps = React.ComponentProps<"div">;

export function DialogFooter({ className, ...rest }: DialogFooterProps) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex shrink-0 items-center justify-end gap-2 px-5 pb-5 pt-4",
        // Phones: buttons share the row equally and grow to a thumb-sized 40px.
        "max-sm:grid max-sm:auto-cols-fr max-sm:grid-flow-col max-sm:*:h-10",
        className,
      )}
      {...rest}
    />
  );
}

export type DialogCloseProps = Omit<BaseDialog.Close.Props, "className"> & {
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
};

/** A button that closes the dialog, styled as a button unless you `render` your own. */
export function DialogClose({ variant = "secondary", className, ...rest }: DialogCloseProps) {
  return (
    <BaseDialog.Close
      data-variant={variant}
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
