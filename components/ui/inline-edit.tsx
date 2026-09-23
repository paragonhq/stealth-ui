"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Alert, Loader, Pencil } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

type Mode = "idle" | "editing" | "saving" | "saved";
type SaveResult = void | string | undefined | null;

export type InlineEditProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "children"> & {
  /** The saved text, when controlled. Only changes after a save succeeds. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Names the field for assistive tech, e.g. "Project name". */
  label: string;
  /** Persist the new text. Return or resolve a string, or throw, to stay in edit mode with that message. */
  onSave?: (next: string) => SaveResult | Promise<SaveResult>;
  /** Runs before saving. Return a message to keep editing. */
  validate?: (next: string) => string | undefined | null;
  /** Shown in the quiet style when the value is empty. */
  placeholder?: string;
  /** Trims whitespace before validating and saving. */
  trim?: boolean;
  maxLength?: number;
  disabled?: boolean;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function InlineEdit({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  label,
  onSave,
  validate,
  placeholder = "Empty",
  trim = true,
  maxLength,
  disabled,
  className,
  ...rest
}: InlineEditProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const [mode, setMode] = useState<Mode>("idle");
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const reduce = useReducedMotion();
  const input = useRef<HTMLInputElement>(null);
  const display = useRef<HTMLButtonElement>(null);
  // Where focus should land after leaving edit mode: back on the text for Enter and Escape, nowhere for blur.
  const refocus = useRef(false);
  // True only while the input is live, so a blur that follows Enter, Escape or unmounting can't save twice.
  const live = useRef(false);
  const focusOnEdit = useRef(true);
  const savedTimer = useRef<number>(undefined);
  const errorId = useId();
  const hintId = useId();

  useEffect(() => () => window.clearTimeout(savedTimer.current), []);

  useEffect(() => {
    if (mode === "editing") {
      const el = input.current;
      if (el && focusOnEdit.current && document.activeElement !== el) {
        el.focus();
        el.select();
        // Selecting scrolls a long value to its end; keep the start where the text just was.
        el.scrollLeft = 0;
      }
      focusOnEdit.current = true;
    } else if (refocus.current) {
      refocus.current = false;
      display.current?.focus();
    }
  }, [mode]);

  const startEditing = () => {
    if (disabled || mode === "saving") return;
    window.clearTimeout(savedTimer.current);
    live.current = true;
    setDraft(value);
    setError(null);
    setMode("editing");
  };

  const cancel = () => {
    live.current = false;
    refocus.current = true;
    setError(null);
    setMode("idle");
  };

  const commit = async (raw: string, fromKeyboard: boolean) => {
    if (!live.current) return;
    const next = trim ? raw.trim() : raw;
    if (next === value) {
      live.current = false;
      refocus.current = fromKeyboard;
      setError(null);
      setMode("idle");
      return;
    }
    const invalid = validate?.(next);
    if (invalid) {
      // Stays open with the message. Focus is left where the person put it; Enter already has it here.
      setError(invalid);
      return;
    }

    // Optimistic: the new text shows at once, with a spinner only if the save is slow.
    live.current = false;
    refocus.current = fromKeyboard;
    setPending(next);
    setError(null);
    setMode("saving");
    const started = performance.now();
    const slowTimer = window.setTimeout(() => setSlow(true), 150);
    let failure: string | null = null;
    try {
      const result = await onSave?.(next);
      if (typeof result === "string" && result) failure = result;
    } catch (e) {
      failure = e instanceof Error && e.message ? e.message : "Couldn't save. Try again.";
    }
    window.clearTimeout(slowTimer);
    // A spinner that appeared stays at least 300ms, so it never reads as a flicker.
    const elapsed = performance.now() - started;
    if (elapsed > 150) await wait(Math.max(0, 450 - elapsed));
    setSlow(false);
    setPending(null);

    if (failure) {
      refocus.current = false;
      // Reopen with the message; take focus back only if they were still here (Enter), never after they moved on.
      focusOnEdit.current = fromKeyboard;
      live.current = true;
      setDraft(next);
      setError(failure);
      setMode("editing");
      return;
    }
    setValue(next);
    setMode("saved");
    savedTimer.current = window.setTimeout(() => setMode((m) => (m === "saved" ? "idle" : m)), 1600);
  };

  const shown = pending ?? value;
  const editing = mode === "editing";

  // Both states share this box and inherit the root's type (set it with className): same font, padding,
  // border width and line box, so the text never moves when it turns into an input.
  const box = "w-full min-w-0 rounded-md border px-2 py-[5px] text-left [font:inherit] [letter-spacing:inherit] outline-none pointer-coarse:[font-size:max(16px,1em)]";

  return (
    <div
      data-slot="inline-edit"
      data-state={mode}
      data-invalid={error ? "" : undefined}
      data-disabled={disabled || undefined}
      className={cn("group/inline relative -mx-2 flex min-w-0 flex-col", className)}
      {...rest}
    >
      {editing ? (
        <input
          ref={input}
          value={draft}
          maxLength={maxLength}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          enterKeyHint="done"
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              commit(e.currentTarget.value, true);
            } else if (e.key === "Escape") {
              // Handled here so a surrounding dialog doesn't close along with the edit.
              e.preventDefault();
              e.stopPropagation();
              cancel();
            }
          }}
          onBlur={(e) => commit(e.currentTarget.value, false)}
          className={cn(
            box,
            "block bg-raised text-fg shadow-[var(--shadow)] ring-3 transition-[border-color,box-shadow] duration-150 ease-out",
            error ? "border-danger/70 ring-danger/15" : "border-line-2 ring-fg/8",
          )}
        />
      ) : (
        <button
          ref={display}
          type="button"
          disabled={disabled}
          aria-label={`${label}: ${shown || placeholder}`}
          aria-describedby={hintId}
          aria-busy={mode === "saving" || undefined}
          onClick={startEditing}
          onKeyDown={(e) => {
            if (e.key === "F2") {
              e.preventDefault();
              startEditing();
            }
          }}
          className={cn(
            box,
            "group/display relative flex items-center gap-1.5 border-transparent pr-8",
            "transition-[background-color,color] duration-150 ease-out hover:bg-hover",
            "focus-visible:bg-hover focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
            mode === "saving" && "cursor-progress",
          )}
        >
          <span className={cn("min-w-0 truncate", shown ? "text-fg" : "text-fg-4")}>{shown || placeholder}</span>

          {/* Spinner and tick share one slot right after the text, so the result lands where the eye already is. */}
          <span aria-hidden className="relative grid size-3.5 shrink-0 place-items-center text-fg-3">
            <AnimatePresence initial={false}>
              {mode === "saving" && slow && (
                <motion.span
                  key="spin"
                  className="absolute inset-0 grid place-items-center"
                  initial={{ opacity: 0, scale: reduce ? 1 : 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: reduce ? 1 : 0.6, transition: { duration: 0.1 } }}
                  transition={reduce ? { duration: 0.12 } : spring.pop}
                >
                  <Loader size={14} className="animate-spin" />
                </motion.span>
              )}
              {mode === "saved" && (
                <motion.span
                  key="tick"
                  className="absolute inset-0 grid place-items-center text-success"
                  initial={{ opacity: 0, scale: reduce ? 1 : 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  transition={reduce ? { duration: 0.12 } : spring.pop}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <motion.path
                      d="M3.5 8.5 6.5 11.5 12.5 4.5"
                      initial={reduce ? false : { pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.32, ease: ease.out, delay: 0.04 }}
                    />
                  </svg>
                </motion.span>
              )}
            </AnimatePresence>
          </span>

          {/* The pencil only surfaces on hover or keyboard focus; on touch it stays faintly visible. */}
          <span
            aria-hidden
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 text-fg-4 opacity-0 transition-[opacity,translate] duration-150 ease-out",
              "-translate-x-0.5 group-hover/display:translate-x-0 group-hover/display:opacity-100 group-focus-visible/display:translate-x-0 group-focus-visible/display:opacity-100",
              "pointer-coarse:translate-x-0 pointer-coarse:opacity-60",
              (mode === "saving" || disabled) && "hidden",
            )}
          >
            <Pencil size={14} />
          </span>
        </button>
      )}

      <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-out-quart data-[open]:grid-rows-[1fr] motion-reduce:transition-none" data-open={error ? "" : undefined}>
        <div className="min-h-0 overflow-hidden">
          <AnimatePresence initial={false}>
            {error && (
              <motion.p
                key="error"
                id={errorId}
                className="flex items-start gap-1.5 px-2 pt-1.5 font-sans text-[12px] font-normal leading-4 tracking-normal text-danger"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.2, ease: ease.out }}
              >
                <Alert size={14} className="mt-px size-3.5 shrink-0" />
                <span className="min-w-0">{error}</span>
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      <span id={hintId} className="sr-only">
        Press Enter to edit
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {mode === "saved" ? `${label} saved` : error ?? ""}
      </span>
    </div>
  );
}
