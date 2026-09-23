"use client";
import { Field } from "@base-ui/react/field";
import { Input } from "@base-ui/react/input";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Alert } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/**
 * Tracks Caps Lock from the events a field already receives. Browsers expose it
 * only on keyboard and mouse events, so the state is unknown until the first
 * key or click, and it is dropped on blur because the key can change elsewhere.
 */
export function useCapsLock() {
  const [on, setOn] = useState(false);
  const read = useCallback((e: React.KeyboardEvent | React.MouseEvent) => {
    // Some platforms fire synthetic events without the method.
    if (typeof e.getModifierState === "function") setOn(e.getModifierState("CapsLock"));
  }, []);
  const clear = useCallback(() => setOn(false), []);
  return { capsLock: on, handlers: { onKeyDown: read, onKeyUp: read, onMouseDown: read, onBlur: clear } };
}

type Size = "sm" | "md" | "lg";

export type PasswordFieldProps = Omit<React.ComponentProps<"input">, "type" | "size" | "children" | "defaultValue" | "value"> & {
  label?: React.ReactNode;
  /** One line under the field. Replaced in place by the error when there is one. */
  description?: React.ReactNode;
  /** Marks the field invalid and shows this message under it. */
  error?: React.ReactNode;
  /** `current` for sign-in, `new` for sign-up and change-password. Sets autocomplete so managers fill or generate correctly. */
  purpose?: "current" | "new";
  size?: Size;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Whether the password is shown as plain text. */
  revealed?: boolean;
  defaultRevealed?: boolean;
  onRevealedChange?: (revealed: boolean) => void;
  /** Show the Caps Lock pill while typing with it on. */
  capsLockWarning?: boolean;
};

const sizes: Record<Size, { box: string; input: string; toggle: string; icon: number }> = {
  sm: { box: "h-7 rounded-md", input: "pl-2 text-[12.5px]", toggle: "size-5 rounded-[5px] mr-1", icon: 14 },
  md: { box: "h-8 rounded-lg", input: "pl-2.5", toggle: "size-6 rounded-md mr-1", icon: 16 },
  lg: { box: "h-9 rounded-lg", input: "pl-3", toggle: "size-7 rounded-md mr-1", icon: 16 },
};

export function PasswordField({
  label,
  description,
  error,
  purpose = "current",
  size = "md",
  value,
  defaultValue,
  onValueChange,
  revealed: revealedProp,
  defaultRevealed = false,
  onRevealedChange,
  capsLockWarning = true,
  disabled,
  readOnly,
  className,
  id: idProp,
  name = "password",
  ref,
  onKeyDown,
  onKeyUp,
  onMouseDown,
  onBlur,
  onFocus,
  ...rest
}: PasswordFieldProps) {
  const reduce = useReducedMotion();
  const autoId = useId();
  const id = idProp ?? `pw-${autoId}`;
  const [revealed, setRevealed] = useControllableState({ value: revealedProp, defaultValue: defaultRevealed, onChange: onRevealedChange });
  const { capsLock, handlers } = useCapsLock();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Selection saved at press time, restored after the type swap, which resets it in some browsers.
  const pendingSelection = useRef<[number, number, "forward" | "backward" | "none"] | null>(null);
  const lastRevealed = useRef(revealed);

  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  useLayoutEffect(() => {
    if (lastRevealed.current === revealed) return;
    lastRevealed.current = revealed;
    const input = inputRef.current;
    if (!input) return;
    const sel = pendingSelection.current;
    pendingSelection.current = null;
    if (sel && document.activeElement === input) {
      // Chrome rebuilds the editor, and resets the caret, when styles recalc after a type change.
      // Reading layout forces that now, so the restore below lands after it, not before.
      void input.offsetWidth;
      input.setSelectionRange(sel[0], sel[1], sel[2]);
    }
    // The glyphs resolve out of a short blur so the swap reads as one change, not a flash.
    if (!reduce && typeof input.animate === "function") {
      input.animate([{ filter: "blur(3px)", opacity: 0.5 }, { filter: "blur(0px)", opacity: 1 }], { duration: 200, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
    }
  }, [revealed, reduce]);

  // Mask again when the form submits, so the browser offers to save it as a password
  // and the plain text is not left on screen behind a loading state.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onSubmit = () => setRevealed(false);
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [setRevealed]);

  const toggle = () => {
    const input = inputRef.current;
    if (input && document.activeElement === input && input.selectionStart !== null) {
      pendingSelection.current = [input.selectionStart, input.selectionEnd ?? input.selectionStart, input.selectionDirection ?? "none"];
    }
    setRevealed((r) => !r);
  };

  const s = sizes[size];
  const invalid = Boolean(error) || rest["aria-invalid"] === true || rest["aria-invalid"] === "true";
  const showCaps = capsLockWarning && capsLock && focused && !revealed;

  return (
    <Field.Root
      invalid={invalid || undefined}
      disabled={disabled}
      data-size={size}
      className={cn("group/field flex w-full min-w-0 flex-col gap-1.5", className)}
    >
      {label && (
        <Field.Label className="w-fit text-[12.5px] font-medium leading-4 text-fg group-data-[disabled]/field:text-fg-3">{label}</Field.Label>
      )}
      <div
        data-slot="control"
        data-state={revealed ? "revealed" : "masked"}
        className={cn(
          "relative flex items-center border border-line-2 bg-raised",
          "transition-[border-color,box-shadow] duration-150 ease-out",
          "hover:border-fg-4 focus-within:border-fg-3 focus-within:ring-3 focus-within:ring-fg/8 focus-within:hover:border-fg-3",
          "group-data-[invalid]/field:border-danger/60 group-data-[invalid]/field:focus-within:border-danger/80 group-data-[invalid]/field:focus-within:ring-danger/15",
          "group-data-[disabled]/field:pointer-events-none group-data-[disabled]/field:opacity-50",
          readOnly && "bg-hover",
          s.box,
        )}
      >
        <Input
          {...rest}
          ref={setRefs}
          id={id}
          name={name}
          type={revealed ? "text" : "password"}
          value={value}
          defaultValue={defaultValue}
          onValueChange={onValueChange ? (v) => onValueChange(v) : undefined}
          disabled={disabled}
          readOnly={readOnly}
          autoComplete={purpose === "new" ? "new-password" : "current-password"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onKeyDown={(e) => {
            handlers.onKeyDown(e);
            onKeyDown?.(e);
          }}
          onKeyUp={(e) => {
            handlers.onKeyUp(e);
            onKeyUp?.(e);
          }}
          onMouseDown={(e) => {
            handlers.onMouseDown(e);
            onMouseDown?.(e);
          }}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            handlers.onBlur();
            onBlur?.(e);
          }}
          className={cn(
            "h-full min-w-0 flex-1 bg-transparent pr-1 text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]",
            // Masked dots get a little air; revealed text keeps the family's own spacing.
            "[&[type=password]:not(:placeholder-shown)]:tracking-[0.12em]",
            "disabled:cursor-not-allowed",
            s.input,
          )}
        />

        <AnimatePresence initial={false}>
          {showCaps && (
            <motion.span
              key="caps"
              aria-hidden
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, filter: "blur(2px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.94, filter: "blur(1px)", transition: { duration: 0.12, ease: ease.in } }}
              transition={reduce ? { duration: 0.15 } : spring.pop}
              className={cn(
                "mr-1 inline-flex shrink-0 origin-right select-none items-center gap-1 rounded-full bg-warning-soft font-medium text-warning",
                size === "sm" ? "h-4.5 px-1.5 text-[10.5px]" : "h-5 px-2 text-[11px]",
              )}
            >
              <CapsGlyph />
              Caps lock
            </motion.span>
          )}
        </AnimatePresence>

        <button
          type="button"
          aria-label="Show password"
          aria-pressed={revealed}
          aria-controls={id}
          disabled={disabled}
          // A mouse press must not steal focus, or the caret and the keyboard go with it.
          onMouseDown={(e) => {
            if (document.activeElement === inputRef.current) e.preventDefault();
          }}
          onClick={toggle}
          className={cn(
            "relative grid shrink-0 place-items-center text-fg-3 outline-none",
            "transition-[background-color,color,scale] duration-150 ease-out hover:bg-fg/6 hover:text-fg active:scale-[0.92] active:duration-75",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
            "disabled:pointer-events-none",
            // A 44px target on touch without growing the drawn button.
            "after:absolute after:-inset-y-2 after:-left-1 after:-right-2 after:content-['']",
            s.toggle,
          )}
        >
          <EyeGlyph revealed={revealed} size={s.icon} reduce={!!reduce} />
        </button>
      </div>

      <MessageSlot description={description} error={error} />

      <span role="status" aria-live="polite" className="sr-only">
        {showCaps ? "Caps lock is on" : ""}
      </span>
    </Field.Root>
  );
}

/**
 * Description and error share one grid cell: the error replaces the hint in place,
 * so a field with a hint never pushes the form down when it turns invalid.
 */
function MessageSlot({ description, error }: { description?: React.ReactNode; error?: React.ReactNode }) {
  if (!description && !error) return <Field.Error className={errorClass} />;
  return (
    <div className="grid text-[12px] leading-4">
      {description && (
        <Field.Description
          className={cn(
            "col-start-1 row-start-1 text-fg-3 transition-opacity duration-150",
            "group-data-[invalid]/field:invisible group-data-[invalid]/field:opacity-0",
          )}
        >
          {description}
        </Field.Description>
      )}
      <Field.Error match={error ? true : undefined} className={cn(errorClass, "col-start-1 row-start-1")}>
        {error ? (
          <>
            <Alert size={14} className="mt-px shrink-0" />
            <span>{error}</span>
          </>
        ) : undefined}
      </Field.Error>
    </div>
  );
}

const errorClass =
  "flex items-start gap-1.5 text-[12px] leading-4 text-danger transition-[opacity,translate] duration-200 ease-out-expo data-[starting-style]:-translate-y-1 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 data-[ending-style]:duration-100 motion-reduce:translate-y-0";

// The slash draws across the eye, and a mask cuts the outline beside it so the
// two lines never touch, the way a well-drawn eye-off icon does.
function EyeGlyph({ revealed, size, reduce }: { revealed: boolean; size: number; reduce: boolean }) {
  const maskId = useId();
  const draw = reduce
    ? { duration: 0 }
    : revealed
      ? { duration: 0.24, ease: ease.out }
      : { duration: 0.16, ease: ease.in };
  // Opacity rides along because a zero-length path still paints its round cap as a dot.
  const slash = {
    initial: false as const,
    animate: { pathLength: revealed ? 1 : 0, opacity: revealed ? 1 : 0 },
    transition: { ...draw, opacity: { duration: reduce ? 0 : 0.08, delay: revealed || reduce ? 0 : 0.1 } },
  };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="16" height="16">
        <rect width="16" height="16" fill="white" stroke="none" />
        <motion.path d="M2.5 2.5l11 11" stroke="black" strokeWidth={3.6} {...slash} />
      </mask>
      <g mask={`url(#${maskId})`}>
        <path d="M1.75 8S4 3.75 8 3.75 14.25 8 14.25 8 12 12.25 8 12.25 1.75 8 1.75 8z" />
        <motion.circle
          cx="8"
          cy="8"
          r="2"
          initial={false}
          animate={{ scale: revealed ? 0.85 : 1 }}
          transition={reduce ? { duration: 0 } : spring.snappy}
          style={{ transformOrigin: "8px 8px" }}
        />
      </g>
      <motion.path d="M2.5 2.5l11 11" {...slash} />
    </svg>
  );
}

function CapsGlyph() {
  return (
    <svg width={11} height={11} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 2.5 2.75 8.25H5.5v3h5v-3h2.75z" />
      <path d="M5.5 13.75h5" />
    </svg>
  );
}
