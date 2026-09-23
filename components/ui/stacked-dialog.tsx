"use client";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { createContext, useContext, useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { ChevronLeft, X } from "@/lib/icons";
import { useControllableState } from "@/lib/use-controllable-state";

type Stack = {
  /** 1 for the first dialog, 2 for one opened from it, and so on. */
  depth: number;
  /** Title of the dialog this one was opened from, for the back button. */
  parentTitle: React.ReactNode | null;
  register: (close: () => void) => () => void;
  closeAll: () => void;
  closeSelf: () => void;
};
const StackCtx = createContext<Stack | null>(null);

type Level = { depth: number; title: React.ReactNode | null; close: () => void };
const LevelCtx = createContext<Level | null>(null);

export type StackedDialogProps = Omit<BaseDialog.Root.Props, "open" | "defaultOpen" | "onOpenChange"> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * One level of a stack. Nest another StackedDialog inside a StackedDialogContent
 * and opening it pushes this one back; closing it brings this one forward again.
 */
export function StackedDialog({ open: openProp, defaultOpen = false, onOpenChange, children, ...rest }: StackedDialogProps) {
  const outer = useContext(StackCtx);
  const level = useContext(LevelCtx);
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const closers = useRef(new Set<() => void>());

  const depth = (level?.depth ?? 0) + 1;
  // The outermost level owns the registry; every level below registers with it.
  const register = outer?.register ?? ((close: () => void) => {
    closers.current.add(close);
    return () => closers.current.delete(close);
  });
  const closeAll = outer?.closeAll ?? (() => {
    for (const close of closers.current) close();
    setOpen(false);
  });

  useEffect(() => {
    if (!outer) return;
    return outer.register(() => setOpen(false));
  }, [outer, setOpen]);

  return (
    <StackCtx.Provider value={{ depth, parentTitle: level?.title ?? null, register, closeAll, closeSelf: () => setOpen(false) }}>
      <BaseDialog.Root open={open} onOpenChange={(next) => setOpen(next)} {...rest}>
        {children}
      </BaseDialog.Root>
    </StackCtx.Provider>
  );
}

/** Depth, and ways out: close this level, or the whole stack at once (after a final save, say). */
export function useStackedDialog() {
  const stack = useContext(StackCtx);
  const level = useContext(LevelCtx);
  return { depth: level?.depth ?? stack?.depth ?? 0, close: level?.close ?? (() => {}), closeAll: stack?.closeAll ?? (() => {}) };
}

export type StackedDialogTriggerProps = BaseDialog.Trigger.Props;

export function StackedDialogTrigger(props: StackedDialogTriggerProps) {
  return <BaseDialog.Trigger {...props} />;
}

export type StackedDialogContentProps = Omit<BaseDialog.Popup.Props, "className" | "title"> & {
  className?: string;
  /** Names the dialog, and becomes the back label of any dialog opened from it. */
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** Render into this element instead of document.body. */
  container?: BaseDialog.Portal.Props["container"];
  closeLabel?: string;
};

const widths = { sm: "max-w-[400px]", md: "max-w-[480px]", lg: "max-w-[640px]" };

export function StackedDialogContent({
  title,
  description,
  size = "md",
  container,
  closeLabel = "Close",
  className,
  children,
  ...rest
}: StackedDialogContentProps) {
  const stack = useContext(StackCtx);
  const depth = stack?.depth ?? 1;
  const parentTitle = stack?.parentTitle ?? null;
  const contained = container != null;

  return (
    <BaseDialog.Portal container={container}>
      {/* Only the first level draws a backdrop; the ones above dim the dialog they cover instead. */}
      <BaseDialog.Backdrop
        className={cn(
          contained ? "absolute" : "fixed",
          "inset-0 z-(--z-overlay) bg-overlay transition-opacity duration-200 ease-out-quart",
          "data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-150",
        )}
      />
      <BaseDialog.Viewport
        className={cn(
          contained ? "absolute" : "fixed",
          // Top-anchored so every level shares a top edge and the ones behind peek above it.
          "inset-0 z-(--z-dialog) flex items-start justify-center px-4 pt-[max(48px,12vh)] pb-4",
        )}
      >
        <BaseDialog.Popup
          data-depth={depth}
          className={cn(
            "group/stack relative flex max-h-[calc(100%-8px)] w-full min-w-0 flex-col rounded-2xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
            widths[size],
            "origin-top",
            // Pushed back by each level opened above it: rises 12px and shrinks 5% per level.
            "translate-y-[calc(var(--nested-dialogs,0)*-12px)] scale-[calc(1-var(--nested-dialogs,0)*0.05)]",
            "transition-[opacity,scale,translate] duration-[280ms] ease-out-expo",
            // A new level arrives from 8px below; leaving, it drops back 4px and fades, faster.
            "data-starting-style:translate-y-2 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
            "data-ending-style:translate-y-1 data-ending-style:opacity-0 data-ending-style:duration-[180ms] data-ending-style:ease-out-quart",
            // More than two levels back, a dialog fades out of the pile entirely.
            "data-nested-dialog-open:opacity-[calc(1-max(0,var(--nested-dialogs,0)-2))]",
            // The dim that sits on a pushed-back level.
            "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-overlay after:opacity-0 after:transition-opacity after:duration-[280ms] data-nested-dialog-open:after:opacity-100",
            className,
          )}
          {...rest}
        >
          <LevelCtx.Provider value={{ depth, title, close: () => stack?.closeSelf() }}>
            <div className="flex shrink-0 flex-col gap-1 px-5 pb-3 pt-4 pr-12">
              {depth > 1 && parentTitle != null && (
                <BaseDialog.Close
                  className={cn(
                    "group/back relative -ml-1.5 mb-1 inline-flex h-6 max-w-full items-center gap-0.5 self-start rounded-md pl-0.5 pr-1.5 text-[12px] text-fg-3",
                    "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                    "transition-[background-color,color,scale] duration-150 ease-out-quart hover:bg-hover hover:text-fg active:scale-[0.97]",
                    "before:absolute before:-inset-y-2.5 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
                  )}
                >
                  <ChevronLeft size={14} className="shrink-0 transition-transform duration-150 ease-out-quart group-hover/back:-translate-x-0.5" />
                  <span className="sr-only">Back to </span>
                  <span className="truncate">{parentTitle}</span>
                </BaseDialog.Close>
              )}
              <BaseDialog.Title className="text-[15px] font-medium leading-[1.3] tracking-[-0.015em] text-fg text-balance">{title}</BaseDialog.Title>
              {description && <BaseDialog.Description className="text-[13px] leading-[1.5] text-fg-2 text-pretty">{description}</BaseDialog.Description>}
            </div>
            {children}
          </LevelCtx.Provider>
          <BaseDialog.Close
            aria-label={closeLabel}
            onClick={() => {
              // The × on a nested level leaves the whole flow; the back link steps down one level.
              if (depth > 1) stack?.closeAll();
            }}
            className={cn(
              "absolute right-3 top-3 grid size-7 place-items-center rounded-md text-fg-3",
              "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              "transition-[background-color,color,scale] duration-150 ease-out-quart hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
              "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
            )}
          >
            <X size={16} />
          </BaseDialog.Close>
        </BaseDialog.Popup>
      </BaseDialog.Viewport>
    </BaseDialog.Portal>
  );
}

export type StackedDialogBodyProps = React.ComponentProps<"div">;

export function StackedDialogBody({ className, ...rest }: StackedDialogBodyProps) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-1", className)} {...rest} />;
}

export type StackedDialogFooterProps = React.ComponentProps<"div">;

export function StackedDialogFooter({ className, ...rest }: StackedDialogFooterProps) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-end gap-2 px-5 pb-5 pt-4 max-sm:grid max-sm:auto-cols-fr max-sm:grid-flow-col max-sm:*:h-10", className)}
      {...rest}
    />
  );
}

export type StackedDialogCloseProps = Omit<BaseDialog.Close.Props, "className"> & {
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
};

/** Closes this level only, returning to the one below. */
export function StackedDialogClose({ variant = "secondary", className, ...rest }: StackedDialogCloseProps) {
  return (
    <BaseDialog.Close
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
