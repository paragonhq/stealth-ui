"use client";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Alert } from "@/lib/icons";
import { spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type TagInputProps = Omit<React.ComponentProps<"div">, "children" | "defaultValue" | "onChange"> & {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (tags: string[]) => void;
  label?: React.ReactNode;
  /** One line under the field. Replaced by a validation message while there is one. */
  description?: React.ReactNode;
  /** An error from outside (for example, from the server). */
  error?: React.ReactNode;
  placeholder?: string;
  /** Most tags allowed. The count appears once you're within two of it. */
  max?: number;
  /** Clean up what was typed before it becomes a tag. Defaults to trimming. */
  normalize?: (raw: string) => string;
  /** Return a message to reject a tag and keep the text for fixing. */
  validate?: (tag: string) => string | null | undefined;
  /** Treat "Design" and "design" as the same tag. */
  caseSensitive?: boolean;
  /** Turn what's left in the field into a tag when focus leaves. */
  addOnBlur?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** Submits the tags as one comma-separated value under this name. */
  name?: string;
  inputProps?: Omit<React.ComponentProps<"input">, "value" | "defaultValue">;
};

const SPLIT = /[,\n\t;]+/;

export function TagInput({
  value: valueProp,
  defaultValue = [],
  onValueChange,
  label,
  description,
  error: errorProp,
  placeholder = "Add a tag",
  max = Infinity,
  normalize = (s) => s.trim(),
  validate,
  caseSensitive = false,
  addOnBlur = true,
  disabled,
  readOnly,
  name,
  inputProps,
  className,
  ...rest
}: TagInputProps) {
  const reduce = useReducedMotion();
  const id = useId();
  const inputId = inputProps?.id ?? `${id}-input`;
  const descId = `${id}-desc`;
  const [tags, setTags] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);

  const key = (t: string) => (caseSensitive ? t : t.toLocaleLowerCase());
  const error = problem ?? errorProp;
  const message = error ?? description;
  const locked = disabled || readOnly;

  // A duplicate doesn't get added; the one that already exists answers instead.
  const flash = (el: Element | null | undefined) => {
    if (!(el instanceof HTMLElement)) return;
    el.dataset.flash = "";
    window.setTimeout(() => delete el.dataset.flash, 650);
    if (!reduce) animate(el, { scale: [1, 1.1, 1] }, { duration: 0.36, ease: [0.16, 1, 0.3, 1] });
  };

  /** Adds each candidate in order; returns what couldn't be added so it can stay in the field. */
  const add = (candidates: string[]) => {
    let next = [...tags];
    const added: string[] = [];
    let rejected = "";
    for (const raw of candidates) {
      const tag = normalize(raw);
      if (!tag) continue;
      const existing = next.findIndex((t) => key(t) === key(tag));
      if (existing >= 0) {
        flash(rootRef.current?.querySelector(`[data-tag-index="${existing}"]`));
        setAnnouncement(`${tag} is already added`);
        continue;
      }
      if (next.length >= max) {
        flash(counterRef.current);
        setProblem(`You can add up to ${max}. Remove one to add another.`);
        rejected = rejected ? `${rejected}, ${raw.trim()}` : raw.trim();
        continue;
      }
      const invalid = validate?.(tag);
      if (invalid) {
        setProblem(invalid);
        rejected = rejected ? `${rejected}, ${raw.trim()}` : raw.trim();
        continue;
      }
      next = [...next, tag];
      added.push(tag);
    }
    if (added.length) {
      setTags(next);
      setAnnouncement(added.length === 1 ? `Added ${added[0]}` : `Added ${added.length} tags`);
    }
    return rejected;
  };

  const commit = () => {
    if (!draft.trim()) return;
    setDraft(add([draft]));
  };

  const remove = (index: number, via: "keyboard" | "pointer") => {
    const tag = tags[index];
    setTags(tags.filter((_, i) => i !== index));
    setProblem(null);
    setAnnouncement(`Removed ${tag}`);
    // Removing the last chip hands focus back to the field, so a held Backspace can't
    // run through every tag. From the middle, focus moves to the chip that took its place.
    if (via === "keyboard" && index < tags.length - 1) {
      requestAnimationFrame(() => chipButton(index)?.focus());
    } else inputRef.current?.focus();
  };

  const chipButton = (i: number) => rootRef.current?.querySelector<HTMLButtonElement>(`[data-tag-index="${i}"] button`);

  const onChipKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      remove(i, "keyboard");
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      chipButton(Math.max(0, i - 1))?.focus();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (i + 1 < tags.length) chipButton(i + 1)?.focus();
      else inputRef.current?.focus();
    } else if (e.key === "Escape" || e.key === "End") {
      e.preventDefault();
      inputRef.current?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      chipButton(0)?.focus();
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      // Typing on a chip goes to the field, the way it would if focus had never left.
      inputRef.current?.focus();
    }
  };

  const showCount = Number.isFinite(max) && tags.length >= max - 2;

  return (
    <div
      data-disabled={disabled || undefined}
      data-invalid={error ? "" : undefined}
      className={cn("group/tags flex w-full min-w-0 flex-col gap-1.5", className)}
      {...rest}
    >
      {label && (
        <label htmlFor={inputId} className="w-fit text-[12.5px] font-medium leading-4 text-fg group-data-[disabled]/tags:text-fg-3">
          {label}
        </label>
      )}
      <div
        ref={rootRef}
        onMouseDown={(e) => {
          // A press on the field's padding focuses the text box, like any input.
          if (e.target === e.currentTarget) {
            e.preventDefault();
            inputRef.current?.focus();
          }
        }}
        className={cn(
          "relative flex min-h-8 cursor-text flex-wrap items-center gap-1 rounded-lg border border-line-2 bg-raised p-[3px]",
          "transition-[border-color,box-shadow] duration-150 ease-out",
          "hover:border-fg-4 focus-within:border-fg-3 focus-within:ring-3 focus-within:ring-fg/8 focus-within:hover:border-fg-3",
          "group-data-[invalid]/tags:border-danger/60 group-data-[invalid]/tags:focus-within:border-danger/80 group-data-[invalid]/tags:focus-within:ring-danger/15",
          "group-data-[disabled]/tags:pointer-events-none group-data-[disabled]/tags:opacity-50",
          readOnly && "bg-hover",
          showCount && "pr-11",
        )}
      >
        <ul role="list" aria-label={typeof label === "string" ? label : "Tags"} className="contents">
          <AnimatePresence initial={false} mode="popLayout">
            {tags.map((tag, i) => (
              <motion.li
                key={key(tag)}
                layout={reduce ? false : "position"}
                data-tag-index={i}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, filter: "blur(2px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0, transition: { duration: 0.08 } } : { opacity: 0, scale: 0.8, filter: "blur(2px)", transition: { duration: 0.12 } }}
                transition={reduce ? { duration: 0.12 } : { ...spring.pop, layout: spring.snappy }}
                className={cn(
                  "group/chip flex h-6 max-w-full min-w-0 items-center rounded-md bg-fg/8 pl-2 text-[12.5px] text-fg",
                  "transition-[background-color,color] duration-150",
                  // Selected by keyboard: the chip inverts, so Backspace clearly has a target.
                  "has-[button:focus-visible]:bg-fg has-[button:focus-visible]:text-frame",
                  "data-[flash]:bg-warning-soft data-[flash]:text-warning",
                  locked ? "pr-2" : "pr-0.5",
                )}
              >
                <span className="truncate">{tag}</span>
                {!locked && (
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`Remove ${tag}`}
                    onKeyDown={(e) => onChipKey(e, i)}
                    onClick={(e) => remove(i, e.detail === 0 ? "keyboard" : "pointer")}
                    className={cn(
                      "relative ml-0.5 grid size-5 shrink-0 place-items-center rounded-[5px] text-fg-3 outline-none",
                      "transition-[background-color,color,scale] duration-150 hover:bg-fg/10 hover:text-fg active:scale-[0.88]",
                      "group-has-[button:focus-visible]/chip:text-frame/70",
                      "after:absolute after:-inset-1.5 after:content-['']",
                    )}
                  >
                    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
                      <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
                    </svg>
                  </button>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <motion.input
          layout={reduce ? false : "position"}
          transition={spring.snappy}
          {...(inputProps as object)}
          ref={inputRef}
          id={inputId}
          value={draft}
          disabled={disabled}
          readOnly={readOnly}
          placeholder={tags.length ? undefined : placeholder}
          aria-describedby={message ? descId : undefined}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="enter"
          onChange={(e) => {
            const v = e.target.value;
            setProblem(null);
            // Typing a comma (or pasting on phones that don't fire paste) commits what came before it.
            if (SPLIT.test(v)) {
              const parts = v.split(SPLIT);
              const tail = parts.pop() ?? "";
              const left = add(parts);
              setDraft(left ? `${left}, ${tail}` : tail);
            } else setDraft(v);
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (!SPLIT.test(text)) return;
            e.preventDefault();
            const left = add(text.split(SPLIT));
            setDraft(left);
          }}
          onKeyDown={(e) => {
            inputProps?.onKeyDown?.(e);
            if (e.defaultPrevented || e.nativeEvent.isComposing) return;
            const el = e.currentTarget;
            const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
            if (e.key === "Enter") {
              if (!draft.trim()) return;
              e.preventDefault();
              commit();
            } else if ((e.key === "Backspace" || e.key === "ArrowLeft") && atStart && tags.length) {
              e.preventDefault();
              chipButton(tags.length - 1)?.focus();
            } else if (e.key === "Escape" && draft) {
              e.preventDefault();
              setDraft("");
              setProblem(null);
            }
          }}
          onBlur={(e) => {
            inputProps?.onBlur?.(e);
            if (addOnBlur && !rootRef.current?.contains(e.relatedTarget as Node)) commit();
          }}
          className={cn(
            "h-6 min-w-[8ch] flex-1 bg-transparent px-1.5 text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]",
            "disabled:cursor-not-allowed",
          )}
        />

        {showCount && (
          <span
            ref={counterRef}
            aria-hidden
            className="pointer-events-none absolute bottom-[7px] right-2 font-mono text-[11px] leading-4 tabular text-fg-4 transition-colors duration-150 data-[flash]:text-danger"
          >
            {tags.length}/{max}
          </span>
        )}
      </div>

      {message && (
        <p id={descId} className={cn("flex items-start gap-1.5 text-[12px] leading-4", error ? "text-danger" : "text-fg-3")}>
          {error && <Alert size={14} className="mt-px shrink-0" />}
          <span className="min-w-0">{message}</span>
        </p>
      )}
      {name && <input type="hidden" name={name} value={tags.join(",")} />}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
