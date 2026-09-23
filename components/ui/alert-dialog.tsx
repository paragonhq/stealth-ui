"use client";
import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

type Tone = "default" | "danger";

type Ctx = {
  pending: boolean;
  error: string | null;
  cancelRef: React.RefObject<HTMLButtonElement | null>;
  fieldRef: React.RefObject<HTMLInputElement | null>;
  /** AlertDialogAction registers itself so Enter in the confirm field can run it. */
  registerAction: (fn: (() => void) | null) => void;
  submit: () => void;
  armed: boolean;
  setRequirement: (met: boolean | null) => void;
  run: (fn: () => unknown, describe: (error: unknown) => string) => Promise<void>;
};
const AlertCtx = createContext<Ctx | null>(null);
const useAlert = () => {
  const ctx = useContext(AlertCtx);
  if (!ctx) throw new Error("AlertDialog parts must be inside <AlertDialog>");
  return ctx;
};
const ToneCtx = createContext<Tone>("default");

export type AlertDialogProps = Omit<BaseAlertDialog.Root.Props, "open" | "defaultOpen" | "onOpenChange"> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * A confirm for the irreversible. It only closes by a choice (never an outside
 * click), refuses to close while its action is running, and keeps the dialog
 * open with the reason when the action fails.
 */
export function AlertDialog({ open: openProp, defaultOpen = false, onOpenChange, children, ...rest }: AlertDialogProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requirement, setRequirement] = useState<boolean | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const actionRef = useRef<(() => void) | null>(null);

  const registerAction = (fn: (() => void) | null) => {
    actionRef.current = fn;
  };
  const submit = () => actionRef.current?.();

  const run: Ctx["run"] = async (fn, describe) => {
    setError(null);
    const result = fn();
    // A plain function closes at once; a promise holds the dialog open until it settles.
    if (!(result instanceof Promise)) return setOpen(false);
    setPending(true);
    try {
      await result;
      setPending(false);
      setOpen(false);
    } catch (e) {
      setPending(false);
      setError(describe(e));
    }
  };

  return (
    <AlertCtx.Provider
      value={{ pending, error, cancelRef, fieldRef, registerAction, submit, armed: requirement !== false, setRequirement, run }}
    >
      <BaseAlertDialog.Root
        open={open}
        onOpenChange={(next, details) => {
          if (!next && pending) {
            details.cancel();
            return;
          }
          if (next) setError(null);
          setOpen(next);
        }}
        {...rest}
      >
        {children}
      </BaseAlertDialog.Root>
    </AlertCtx.Provider>
  );
}

export type AlertDialogTriggerProps = BaseAlertDialog.Trigger.Props;

export function AlertDialogTrigger(props: AlertDialogTriggerProps) {
  return <BaseAlertDialog.Trigger {...props} />;
}

export type AlertDialogContentProps = Omit<BaseAlertDialog.Popup.Props, "className"> & {
  className?: string;
  /** Danger turns the action red and the icon tile with it. */
  tone?: Tone;
  /** A 16px glyph shown in a tile above the title. */
  icon?: React.ReactNode;
  /** Render into this element instead of document.body. */
  container?: BaseAlertDialog.Portal.Props["container"];
};

export function AlertDialogContent({ tone = "default", icon, container, className, children, ...rest }: AlertDialogContentProps) {
  const { cancelRef, fieldRef } = useAlert();
  const contained = container != null;
  return (
    <ToneCtx.Provider value={tone}>
      <BaseAlertDialog.Portal container={container}>
        <BaseAlertDialog.Backdrop
          className={cn(
            contained ? "absolute" : "fixed",
            "inset-0 z-(--z-overlay) bg-overlay transition-opacity duration-200 ease-out-quart",
            "data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-150",
          )}
        />
        <BaseAlertDialog.Viewport
          className={cn(
            contained ? "absolute" : "fixed",
            "inset-0 z-(--z-dialog) flex items-center justify-center p-4",
            "max-sm:items-end max-sm:p-2 max-sm:pb-[max(8px,env(safe-area-inset-bottom))]",
          )}
        >
          <BaseAlertDialog.Popup
            // A typed confirmation is the safe place to start; otherwise Cancel, never the destructive verb.
            initialFocus={() => fieldRef.current ?? cancelRef.current ?? true}
            data-tone={tone}
            className={cn(
              "relative flex w-full max-w-[400px] flex-col rounded-2xl border border-line-2 bg-raised p-5 text-fg shadow-pop outline-none",
              "origin-center transition-[opacity,scale,translate] duration-[260ms] ease-out-expo",
              "data-starting-style:translate-y-1.5 data-starting-style:scale-[0.97] data-starting-style:opacity-0",
              "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-[160ms] data-ending-style:ease-out-quart",
              "max-sm:data-starting-style:translate-y-4 max-sm:data-starting-style:scale-100",
              className,
            )}
            {...rest}
          >
            {icon && (
              <span
                aria-hidden
                className={cn(
                  "mb-4 grid size-9 place-items-center rounded-full [&_svg]:size-4",
                  tone === "danger" ? "bg-danger-soft text-danger" : "bg-hover text-fg-2",
                )}
              >
                {icon}
              </span>
            )}
            {children}
          </BaseAlertDialog.Popup>
        </BaseAlertDialog.Viewport>
      </BaseAlertDialog.Portal>
    </ToneCtx.Provider>
  );
}

export type AlertDialogTitleProps = Omit<BaseAlertDialog.Title.Props, "className"> & { className?: string };

export function AlertDialogTitle({ className, ...rest }: AlertDialogTitleProps) {
  return (
    <BaseAlertDialog.Title
      className={cn("text-[15px] font-medium leading-[1.3] tracking-[-0.015em] text-fg text-balance", className)}
      {...rest}
    />
  );
}

export type AlertDialogDescriptionProps = Omit<BaseAlertDialog.Description.Props, "className"> & { className?: string };

export function AlertDialogDescription({ className, ...rest }: AlertDialogDescriptionProps) {
  return <BaseAlertDialog.Description className={cn("mt-1.5 text-[13px] leading-[1.5] text-fg-2 text-pretty", className)} {...rest} />;
}

export type AlertDialogConfirmFieldProps = Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> & {
  /** The exact text to type before the action unlocks, usually the name of the thing being deleted. */
  match: string;
  /** Label above the field. Defaults to “Type <match> to confirm”. */
  label?: React.ReactNode;
};

/** Typed confirmation for the highest stakes: the action stays locked until the text matches. */
export function AlertDialogConfirmField({ match, label, className, ...rest }: AlertDialogConfirmFieldProps) {
  const { fieldRef, setRequirement, submit, pending } = useAlert();
  const [text, setText] = useState("");
  const reduce = useReducedMotion();
  const id = useId();
  const met = text === match;

  useEffect(() => {
    setRequirement(met);
  }, [met, setRequirement]);
  useEffect(() => () => setRequirement(null), [setRequirement]);

  return (
    <div className="mt-4">
      <label htmlFor={id} className="mb-1.5 block text-[12.5px] text-fg-2">
        {label ?? (
          <>
            Type <span className="select-all rounded bg-hover px-1 py-px font-mono text-[12px] text-fg">{match}</span> to confirm
          </>
        )}
      </label>
      <div className="relative">
        <input
          ref={fieldRef}
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && met && !pending) {
              e.preventDefault();
              submit();
            }
          }}
          readOnly={pending}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          className={cn(
            "h-9 w-full rounded-lg border border-line-2 bg-raised pl-3 pr-9 font-mono text-base text-fg shadow-[var(--shadow)] outline-none sm:text-[13px]",
            "transition-[border-color,box-shadow] duration-150 ease-out-quart hover:border-fg-4 focus:border-fg-3 focus:ring-3 focus:ring-fg/8",
            "read-only:opacity-60",
            className,
          )}
          {...rest}
        />
        {/* A tick draws in once the text matches: the unlock is visible before the button is. */}
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-success">
          <AnimatePresence initial={false}>
            {met && (
              <motion.svg
                key="tick"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ opacity: 0, scale: reduce ? 1 : 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: reduce ? 0.12 : 0.2, ease: ease.out }}
              >
                <motion.path
                  d="M3.5 8.5 6.5 11.5 12.5 4.5"
                  initial={{ pathLength: reduce ? 1 : 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.28, ease: ease.out, delay: 0.04 }}
                />
              </motion.svg>
            )}
          </AnimatePresence>
        </span>
      </div>
    </div>
  );
}

export type AlertDialogFooterProps = React.ComponentProps<"div">;

/** The actions, with the failure message opening above them when the action throws. */
export function AlertDialogFooter({ className, children, ...rest }: AlertDialogFooterProps) {
  const { error } = useAlert();
  return (
    <div className="mt-5 flex flex-col">
      <div
        data-open={error ? "" : undefined}
        className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-in-out-quart data-open:grid-rows-[1fr]"
      >
        <div className="min-h-0 overflow-hidden">
          <p role="alert" className="mb-3 flex gap-2 rounded-lg bg-danger-soft px-3 py-2 text-[12.5px] leading-[1.45] text-danger">
            {error && (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden className="mt-px shrink-0">
                  <circle cx="8" cy="8" r="5.75" />
                  <path d="M8 5v3.5" />
                  <circle cx="8" cy="10.9" r=".6" fill="currentColor" stroke="none" />
                </svg>
                <span>{error}</span>
              </>
            )}
          </p>
        </div>
      </div>
      <div
        className={cn(
          "flex items-center justify-end gap-2",
          "max-sm:grid max-sm:auto-cols-fr max-sm:grid-flow-col max-sm:*:h-10",
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    </div>
  );
}

const base = cn(
  "relative inline-flex h-8 shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg px-2.5 text-[12.5px] font-medium tracking-[-0.005em]",
  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
  "transition-[background-color,border-color,color,opacity,scale] duration-150 ease-out-quart active:scale-[0.97] active:duration-75",
);

export type AlertDialogCancelProps = Omit<BaseAlertDialog.Close.Props, "className"> & { className?: string };

/** Closes without acting. Receives focus on open, and is locked while the action runs. */
export function AlertDialogCancel({ className, disabled, children = "Cancel", ...rest }: AlertDialogCancelProps) {
  const { cancelRef, pending } = useAlert();
  return (
    <BaseAlertDialog.Close
      ref={cancelRef}
      disabled={disabled || pending}
      className={cn(
        base,
        "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </BaseAlertDialog.Close>
  );
}

export type AlertDialogActionProps = Omit<React.ComponentProps<"button">, "onClick" | "children"> & {
  /** The verb: “Delete”, “Revoke”, “Remove member”. Never “OK” or “Yes”. */
  children: string;
  /** Runs on press. Return a promise to hold the dialog open, busy, until it settles. */
  onAction?: () => void | Promise<unknown>;
  /** Shown with a spinner while the promise runs, e.g. “Deleting…”. */
  pendingLabel?: string;
  /** Turns a rejection into the message shown above the buttons. */
  errorMessage?: (error: unknown) => string;
};

export function AlertDialogAction({
  children,
  onAction,
  pendingLabel,
  errorMessage = () => "That didn’t go through. Try again.",
  disabled,
  className,
  ...rest
}: AlertDialogActionProps) {
  const { run, pending, armed, registerAction } = useAlert();
  const tone = useContext(ToneCtx);
  const reduce = useReducedMotion();
  const busyLabel = pendingLabel ?? `${children}…`;
  const locked = disabled || !armed;

  const fire = () => {
    if (pending || locked) return;
    void run(() => onAction?.(), errorMessage);
  };
  useEffect(() => {
    registerAction(fire);
    return () => registerAction(null);
  });

  const t = { duration: reduce ? 0.12 : 0.2, ease: ease.out };
  return (
    <button
      type="button"
      data-tone={tone}
      aria-busy={pending || undefined}
      aria-disabled={locked || undefined}
      disabled={locked}
      onClick={fire}
      className={cn(
        base,
        "disabled:pointer-events-none disabled:opacity-45 aria-busy:cursor-progress aria-busy:active:scale-100",
        tone === "danger"
          ? "bg-danger text-frame shadow-[var(--shadow)] hover:bg-danger/90"
          : "bg-fg text-frame shadow-[var(--shadow)] hover:bg-fg/90",
        className,
      )}
      {...rest}
    >
      {/* Both labels share one grid cell, so the button is as wide as the longer and never jumps. */}
      <span className="grid overflow-hidden py-1">
        <span aria-hidden className="invisible col-start-1 row-start-1">{children}</span>
        <span aria-hidden className="invisible col-start-1 row-start-1 pl-[22px]">{busyLabel}</span>
        <AnimatePresence initial={false}>
          <motion.span
            key={pending ? "busy" : "idle"}
            className="col-start-1 row-start-1 flex items-center justify-center gap-1.5"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(2px)" }}
            transition={t}
          >
            {pending && <Spinner />}
            {pending ? busyLabel : children}
          </motion.span>
        </AnimatePresence>
      </span>
      <span role="status" className="sr-only">
        {pending ? busyLabel : ""}
      </span>
    </button>
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0 animate-[spin_0.7s_linear_infinite]">
      <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <path d="M8 2.25A5.75 5.75 0 0 1 13.75 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
