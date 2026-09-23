"use client";
import { Field as BaseField } from "@base-ui/react/field";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Alert } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

type Size = "sm" | "md" | "lg";
const FieldContext = createContext<{ required: boolean; size: Size }>({ required: false, size: "md" });

/** The field's size and required flag, for controls composed inside it. */
export const useFieldContext = () => useContext(FieldContext);

export type FieldProps = Omit<BaseField.Root.Props, "className"> & {
  className?: string;
  /** Marks the label and makes the control required, so the rule is written once. */
  required?: boolean;
  /** Height of the control inside: 28, 32 or 36px. */
  size?: Size;
};

/**
 * Groups a label, a control, a description and an error. Validates when focus
 * leaves the control (not on every keystroke) and on submit inside a Base UI Form;
 * once an error shows, fixing the value clears it as you type.
 */
export function Field({ required = false, size = "md", validationMode = "onBlur", className, children, ...rest }: FieldProps) {
  return (
    <FieldContext value={{ required, size }}>
      <BaseField.Root
        data-size={size}
        data-required={required || undefined}
        validationMode={validationMode}
        className={cn("group/field flex w-full min-w-0 flex-col gap-1.5", className)}
        {...rest}
      >
        {children}
      </BaseField.Root>
    </FieldContext>
  );
}

export type FieldLabelProps = Omit<BaseField.Label.Props, "className"> & {
  className?: string;
  /** Says "Optional" beside the label. Use it instead of marking every other field required. */
  optional?: boolean;
};

export function FieldLabel({ optional = false, className, children, ...rest }: FieldLabelProps) {
  const { required } = useFieldContext();
  return (
    <BaseField.Label
      className={cn(
        "flex w-fit select-none items-baseline gap-1 text-[12.5px] font-medium tracking-[-0.005em] text-fg-2",
        "transition-colors duration-150 group-data-focused/field:text-fg group-data-disabled/field:text-fg-4",
        className,
      )}
      {...rest}
    >
      {children}
      {/* The input's own required state is what a screen reader hears; the mark is for the eye. */}
      {required && (
        <span aria-hidden className="text-fg-3 transition-colors duration-150 group-data-invalid/field:text-danger">
          *
        </span>
      )}
      {optional && !required && <span className="text-[12px] font-normal text-fg-3">Optional</span>}
    </BaseField.Label>
  );
}

export type FieldControlProps = Omit<BaseField.Control.Props, "className" | "size"> & {
  className?: string;
  /** Classes for the inner input; `className` styles the box around it. */
  inputClassName?: string;
  /** Leading content: an icon or a fixed part like "https://". */
  start?: React.ReactNode;
  /** Trailing content: a unit, a status or a button. */
  end?: React.ReactNode;
  /** Draws a brief tick when a value that was invalid becomes valid. */
  confirmFix?: boolean;
  size?: Size;
};

// The box carries the border and the halo, so start, value and end read as one control.
// Every state is read from the input's own attributes, so the box and Base UI never disagree.
const box = cn(
  "relative flex w-full min-w-0 items-center border border-line-2 bg-raised text-fg shadow-[var(--shadow)]",
  "transition-[border-color,box-shadow,background-color] duration-150 ease-out",
  "hover:border-fg-4 focus-within:border-fg-3 focus-within:ring-3 focus-within:ring-fg/8 hover:focus-within:border-fg-3",
  "has-[input[data-invalid]]:border-danger/70 has-[input[data-invalid]]:hover:border-danger",
  "has-[input[data-invalid]]:focus-within:border-danger has-[input[data-invalid]]:focus-within:ring-danger/15",
  "has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50 has-[input:disabled]:shadow-none has-[input:disabled]:hover:border-line-2",
  "has-[input:read-only]:bg-frame has-[input:read-only]:shadow-none has-[input:read-only]:hover:border-line-2 has-[input:read-only]:focus-within:border-line-2 has-[input:read-only]:focus-within:ring-0",
);

const sizes: Record<Size, string> = {
  sm: "h-7 gap-1.5 rounded-md px-2 text-base sm:text-[12.5px] [&_[data-slot=affix]_svg]:size-3.5",
  md: "h-8 gap-2 rounded-lg px-2.5 text-base sm:text-[13px]",
  lg: "h-9 gap-2 rounded-lg px-3 text-base sm:text-[13px]",
};

export function FieldControl({
  start,
  end,
  confirmFix = true,
  size: sizeProp,
  required: requiredProp,
  className,
  inputClassName,
  ref,
  ...rest
}: FieldControlProps) {
  const ctx = useFieldContext();
  const size = sizeProp ?? ctx.size;
  const inner = useRef<HTMLInputElement | null>(null);
  const setRef = useCallback(
    (node: HTMLInputElement | null) => {
      inner.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  return (
    <div
      data-slot="field-control"
      data-size={size}
      className={cn(box, sizes[size], className)}
      // Pressing the padding or an affix puts the caret in the field, as a single native control would.
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest("input, button, a, [role=button]")) return;
        e.preventDefault();
        inner.current?.focus();
      }}
    >
      {start != null && <Affix side="start">{start}</Affix>}
      <BaseField.Control
        ref={setRef}
        required={requiredProp ?? ctx.required}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent text-inherit outline-none placeholder:text-fg-4",
          "disabled:cursor-not-allowed read-only:cursor-default",
          "autofill:shadow-[inset_0_0_0_1000px_var(--raised)] autofill:[-webkit-text-fill-color:var(--fg)]",
          inputClassName,
        )}
        {...rest}
      />
      {end != null && <Affix side="end">{end}</Affix>}
      {confirmFix && <BaseField.Validity>{(s) => <FixedTick valid={s.validity.valid} />}</BaseField.Validity>}
    </div>
  );
}

function Affix({ side, children }: { side: "start" | "end"; children: React.ReactNode }) {
  // Text before the value sits tight against it, so "stealth.pm/" + "northwind" reads as one address.
  const tight = side === "start" && (typeof children === "string" || typeof children === "number");
  return (
    <span
      data-slot="affix"
      className={cn(
        "flex shrink-0 select-none items-center whitespace-nowrap text-fg-3 tabular transition-colors duration-150 group-data-focused/field:text-fg-2",
        tight && "-mr-1.5 group-data-[size=sm]/field:-mr-1",
      )}
    >
      {children}
    </span>
  );
}

// Answers the moment an error is fixed: the tick draws, holds, and leaves on its own.
// It only ever follows an error, so it never decorates a field that was simply filled in.
function FixedTick({ valid }: { valid: boolean | null }) {
  const reduce = useReducedMotion();
  const [prev, setPrev] = useState(valid);
  const [shown, setShown] = useState(false);
  if (prev !== valid) {
    setPrev(valid);
    setShown(prev === false && valid === true);
  }
  useEffect(() => {
    if (!shown) return;
    const t = window.setTimeout(() => setShown(false), 1600);
    return () => window.clearTimeout(t);
  }, [shown]);

  return (
    <AnimatePresence initial={false}>
      {shown && (
        <motion.span
          aria-hidden
          className="grid shrink-0 place-items-center overflow-hidden text-success"
          initial={reduce ? { opacity: 0 } : { opacity: 0, width: 0, scale: 0.6 }}
          animate={{ opacity: 1, width: 16, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, width: 0, scale: 0.8, transition: { duration: 0.16, ease: ease.in } }}
          transition={reduce ? { duration: 0.15 } : spring.pop}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <motion.path
              d="M3.5 8.5 6.5 11.5 12.5 4.5"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3, ease: ease.out, delay: 0.05 }}
            />
          </svg>
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export type FieldDescriptionProps = Omit<BaseField.Description.Props, "className"> & { className?: string };

export function FieldDescription({ className, ...rest }: FieldDescriptionProps) {
  return (
    <BaseField.Description
      className={cn("text-[12px] leading-[1.45] text-fg-3 [text-wrap:pretty] group-data-disabled/field:text-fg-4", className)}
      {...rest}
    />
  );
}

type ValidityKey = Exclude<keyof BaseField.Validity.State["validity"], "valid">;

export type FieldErrorProps = Omit<BaseField.Error.Props, "className" | "render"> & {
  className?: string;
  /**
   * Your wording for native failures, e.g. `{ valueMissing: "Enter an email", typeMismatch: "Include an @" }`.
   * Anything not listed falls back to the validation message, and custom `validate` errors always show as returned.
   */
  messages?: Partial<Record<ValidityKey, React.ReactNode>>;
};

/**
 * The message under the control. Grows open from zero height (canceling the
 * field's gap as it goes, so nothing below jumps), fades and settles 4px down,
 * and collapses faster than it arrived, still showing the last message while it leaves.
 */
export function FieldError({ className, messages, ...rest }: FieldErrorProps) {
  return (
    <BaseField.Error
      className={cn(
        "group/error grid grid-rows-[1fr] text-[12px] leading-[1.45] text-danger",
        "transition-[grid-template-rows,opacity,margin-top] duration-[240ms] ease-out-expo",
        "data-starting-style:-mt-1.5 data-starting-style:grid-rows-[0fr] data-starting-style:opacity-0",
        "data-ending-style:-mt-1.5 data-ending-style:grid-rows-[0fr] data-ending-style:opacity-0 data-ending-style:duration-[160ms] data-ending-style:ease-in-out-quart",
        className,
      )}
      render={(props) => (
        <div {...props}>
          <div className="min-h-0 overflow-hidden">
            <div
              className={cn(
                "flex items-start gap-1.5 transition-transform duration-[240ms] ease-out-expo",
                "group-data-starting-style/error:-translate-y-1",
                "[&_ul]:flex [&_ul]:flex-col [&_ul]:gap-0.5",
              )}
            >
              <Alert size={14} className="mt-[1.5px] shrink-0" />
              <div className="min-w-0 [text-wrap:pretty]">
                {messages ? (
                  <BaseField.Validity>{(s) => <Worded messages={messages} validity={s.validity} fallback={props.children} />}</BaseField.Validity>
                ) : (
                  <Held>{props.children}</Held>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      // Children are left out unless given, so Base UI can fill in the validation message.
      {...rest}
    />
  );
}

// Keeps the last text message on screen while the error collapses, for callers who
// pass the message as children and clear it the moment the field is valid.
function Held({ children }: { children: React.ReactNode }) {
  const text = typeof children === "string" && children ? children : null;
  const [last, setLast] = useState<string | null>(text);
  if (text && text !== last) setLast(text);
  return <>{children || last}</>;
}

// Picks the wording for the failing constraint, and keeps the last one while the error collapses.
function Worded({
  messages,
  validity,
  fallback,
}: {
  messages: Partial<Record<ValidityKey, React.ReactNode>>;
  validity: BaseField.Validity.State["validity"];
  fallback: React.ReactNode;
}) {
  // Remember which wording was showing (a key, not the node) so the collapse keeps it.
  const failing = validity.valid === false;
  const key = failing && !validity.customError ? (Object.keys(messages) as ValidityKey[]).find((k) => validity[k] && messages[k]) : undefined;
  const [last, setLast] = useState<ValidityKey | undefined>(key);
  if (failing && key !== last) setLast(key);
  const shown = failing ? key : last;
  return <>{shown ? messages[shown] : fallback}</>;
}
