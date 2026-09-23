"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { useCopy } from "@/components/ui/copy-button";
import { cn } from "@/lib/cn";
import { ArrowUpRight, Copy, Loader, Pencil } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

type ListContext = { divided: boolean };
const Ctx = createContext<ListContext>({ divided: true });

/* -------------------------------------------------------------------------------------------------
 * List
 * -----------------------------------------------------------------------------------------------*/

export type KeyValueListProps = React.ComponentProps<"dl"> & {
  /** Hairlines between rows. */
  divided?: boolean;
  /** Width of the label column. Under a 384px container, labels stack above values instead. */
  labelWidth?: number;
};

export function KeyValueList({ divided = true, labelWidth = 128, className, style, children, ...rest }: KeyValueListProps) {
  return (
    <Ctx.Provider value={{ divided }}>
      <dl
        style={{ "--kv-label": `${labelWidth}px`, ...style } as React.CSSProperties}
        className={cn("@container flex w-full min-w-0 flex-col text-[13px]", className)}
        {...rest}
      >
        {children}
      </dl>
    </Ctx.Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Row
 * -----------------------------------------------------------------------------------------------*/

export type KeyValueProps = Omit<React.ComponentProps<"div">, "children" | "onCopy"> & {
  label: React.ReactNode;
  children?: React.ReactNode;
  /** Text to put on the clipboard. Pass it to show a copy button beside the value. */
  copyValue?: string;
  /** Monospace, for IDs, hashes, keys and hostnames. */
  mono?: boolean;
  /** "middle" keeps the end of a long string ID visible: dpl_8fK2…Ta9c. Needs a string child. */
  truncate?: "end" | "middle" | "none";
  /** Turns the value into a link; external URLs get an arrow and open in a new tab. */
  href?: string;
  /** Makes the value editable in place. Resolve to save; throw to keep the field open with an error. */
  onSave?: (next: string) => void | Promise<unknown>;
  /** The raw text being edited. Defaults to children when it's a string. */
  editValue?: string;
  /** Returns an error message, or null when the draft is fine. */
  validate?: (draft: string) => string | null;
  /** Shown in place of an empty value. */
  emptyLabel?: string;
};

export function KeyValue({
  label,
  children,
  copyValue,
  mono = false,
  truncate = "end",
  href,
  onSave,
  editValue,
  validate,
  emptyLabel = "Not set",
  className,
  ...rest
}: KeyValueProps) {
  const { divided } = useContext(Ctx);
  const [editing, setEditing] = useState(false);
  // Each copy or save bumps a counter; the flash replays on every bump.
  const [flash, setFlash] = useState({ n: 0, tone: "copied" as "copied" | "saved" });
  const editRef = useRef<HTMLButtonElement>(null);
  const empty = children == null || children === "" || children === false;
  const text = typeof children === "string" ? children : undefined;

  const valueNode = empty ? (
    <span className="text-fg-4" aria-label={emptyLabel}>
      —
    </span>
  ) : truncate === "middle" && text && text.length > 14 ? (
    // The head shrinks with an ellipsis; the last six characters never do.
    <span className="flex min-w-0" title={text}>
      <span className="truncate">{text.slice(0, -6)}</span>
      <span className="shrink-0">{text.slice(-6)}</span>
    </span>
  ) : (
    <span className={cn("min-w-0", truncate === "none" ? "break-words [overflow-wrap:anywhere]" : "truncate")} title={truncate === "end" && text ? text : undefined}>
      {children}
    </span>
  );

  const external = href ? /^https?:\/\//.test(href) : false;

  return (
    <div
      data-editing={editing || undefined}
      className={cn(
        "group/kv relative grid min-h-10 grid-cols-[var(--kv-label)_minmax(0,1fr)] items-center gap-x-4 py-1.5",
        "@max-sm:grid-cols-1 @max-sm:gap-y-0.5 @max-sm:py-2",
        divided && "border-b border-line last:border-b-0",
        className,
      )}
      {...rest}
    >
      <dt className="self-start truncate pt-[5px] text-[12.5px] text-fg-3 @max-sm:pt-0">{label}</dt>
      <dd className="flex min-h-7 min-w-0 items-center gap-1">
        {editing && onSave ? (
          <InlineEditor
            initial={editValue ?? text ?? ""}
            label={typeof label === "string" ? label : "Value"}
            mono={mono}
            validate={validate}
            onSave={onSave}
            onDone={(didSave) => {
              setEditing(false);
              if (didSave) setFlash((f) => ({ n: f.n + 1, tone: "saved" }));
              // Hand focus back to the pencil so the keyboard user is where they started.
              requestAnimationFrame(() => editRef.current?.focus());
            }}
          />
        ) : (
          <>
            <span className={cn("relative isolate flex min-w-0 items-center", mono ? "font-mono text-[12px] tracking-[0.01em] text-fg" : "text-fg")}>
              {href && !empty ? (
                <a
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  className="group/link flex min-w-0 items-center gap-0.5 rounded-sm underline decoration-fg-4 underline-offset-[3px] outline-none transition-[text-decoration-color] duration-150 hover:decoration-fg-2 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
                >
                  {valueNode}
                  {external && (
                    <ArrowUpRight size={12} className="shrink-0 text-fg-3 transition-transform duration-150 ease-out group-hover/link:-translate-y-px group-hover/link:translate-x-px" />
                  )}
                </a>
              ) : (
                valueNode
              )}
              <Flash token={flash.n} tone={flash.tone} />
            </span>
            {(copyValue || onSave) && (
              <span className="flex shrink-0 items-center">
                {copyValue && !empty && (
                  <CopyAction text={copyValue} label={typeof label === "string" ? label : "value"} onCopied={() => setFlash((f) => ({ n: f.n + 1, tone: "copied" }))} />
                )}
                {onSave && (
                  <RowAction ref={editRef} aria-label={`Edit ${typeof label === "string" ? label.toLowerCase() : "value"}`} onClick={() => setEditing(true)}>
                    <Pencil size={13} />
                  </RowAction>
                )}
              </span>
            )}
          </>
        )}
      </dd>
    </div>
  );
}

// Row actions stay hidden until the row is hovered or focused, and are always there on touch.
function RowAction({ className, ...rest }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "relative grid size-6 place-items-center rounded-md text-fg-3 outline-none",
        "opacity-0 transition-[opacity,background-color,color,scale] duration-150 group-hover/kv:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100",
        "hover:bg-hover hover:text-fg active:scale-[0.9] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
        "before:absolute before:-inset-2.5 before:content-[''] pointer-fine:before:hidden",
        className,
      )}
      {...rest}
    />
  );
}

function CopyAction({ text, label, onCopied }: { text: string; label: string; onCopied: () => void }) {
  const { state, copy } = useCopy({ timeout: 1600, onCopied });
  const reduce = useReducedMotion();
  const name = state === "copied" ? "Copied" : state === "failed" ? "Couldn’t copy" : `Copy ${label.toLowerCase()}`;
  return (
    <>
      <RowAction
        aria-label={name}
        title={name}
        onClick={() => copy(text)}
        data-state={state}
        className={cn(state !== "idle" && "opacity-100", state === "copied" && "text-fg", state === "failed" && "text-danger hover:text-danger")}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={state}
            className="grid place-items-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
            transition={reduce ? { duration: 0.12 } : spring.pop}
          >
            {state === "copied" ? <DrawnMark d="M3.5 8.5 6.5 11.5 12.5 4.5" /> : state === "failed" ? <DrawnMark d="m4.5 4.5 7 7M11.5 4.5l-7 7" /> : <Copy size={13} />}
          </motion.span>
        </AnimatePresence>
      </RowAction>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? `${label} copied` : state === "failed" ? "Couldn’t copy. Select the text and copy it instead." : ""}
      </span>
    </>
  );
}

function DrawnMark({ d }: { d: string }) {
  const reduce = useReducedMotion();
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <motion.path d={d} initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.28, ease: ease.out, delay: 0.04 }} />
    </svg>
  );
}

// The value washes once and fades, right where you're looking: like a text selection after
// a copy, green after a save. It says what just happened to which value.
function Flash({ token, tone }: { token: number; tone: "copied" | "saved" }) {
  const reduce = useReducedMotion();
  if (!token) return null;
  return (
    <motion.span
      key={token}
      aria-hidden
      className={cn("pointer-events-none absolute -inset-x-1 -inset-y-0.5 -z-1 rounded-md", tone === "saved" ? "bg-success-soft" : "bg-fg/12")}
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: reduce ? 0.3 : 0.9, ease: ease.outQuart, delay: 0.2 }}
    />
  );
}

/* -------------------------------------------------------------------------------------------------
 * Inline editor
 * -----------------------------------------------------------------------------------------------*/

function InlineEditor({
  initial,
  label,
  mono,
  validate,
  onSave,
  onDone,
}: {
  initial: string;
  label: string;
  mono: boolean;
  validate?: (draft: string) => string | null;
  onSave: (next: string) => void | Promise<unknown>;
  onDone: (saved: boolean) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  // Focus and select once on open, so typing replaces the old value.
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = async () => {
    if (busy) return;
    const next = draft.trim();
    if (next === initial.trim()) return onDone(false);
    const problem = validate?.(next) ?? null;
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await onSave(next);
      onDone(true);
    } catch {
      setBusy(false);
      setError("Couldn’t save. Try again.");
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div
        className={cn(
          "relative flex h-7 items-center rounded-md border bg-frame transition-[border-color,box-shadow] duration-150",
          error ? "border-danger ring-2 ring-danger-soft" : "border-fg-4 ring-2 ring-fg/10",
        )}
      >
        <input
          ref={inputRef}
          value={draft}
          readOnly={busy}
          aria-label={label}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? errorId : undefined}
          aria-busy={busy || undefined}
          onChange={(e) => (setDraft(e.target.value), error && setError(null))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onDone(false);
            }
          }}
          // Clicking away keeps the edit: saving is what people expect when they leave a field they changed.
          onBlur={() => {
            if (!error) submit();
          }}
          className={cn(
            "h-full min-w-0 flex-1 bg-transparent px-2 text-base text-fg outline-none sm:text-[13px]",
            mono && "font-mono sm:text-[12px]",
            busy && "text-fg-2",
          )}
        />
        <AnimatePresence initial={false}>
          {busy && (
            <motion.span
              initial={{ opacity: 0, scale: reduce ? 1 : 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14, delay: 0.12 }}
              className="mr-2 grid place-items-center text-fg-3"
            >
              <Loader size={13} className="animate-spin-slow" />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={errorId}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.18, ease: ease.out }}
            className="text-[12px] text-danger"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      <span className="sr-only">Enter to save, Escape to cancel.</span>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Status value
 * -----------------------------------------------------------------------------------------------*/

export type KeyValueStatusProps = React.ComponentProps<"span"> & {
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  /** A soft ring pulses on the dot while the state is still changing (building, syncing). */
  live?: boolean;
};

const dot = { neutral: "bg-fg-3", success: "bg-success", warning: "bg-warning", danger: "bg-danger", info: "bg-info" } as const;

export function KeyValueStatus({ tone = "neutral", live = false, className, children, ...rest }: KeyValueStatusProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-fg", className)} {...rest}>
      <span aria-hidden className="relative grid size-2 place-items-center">
        {live && <span className={cn("absolute inset-0 rounded-full motion-safe:animate-ping-soft", dot[tone])} />}
        <span className={cn("relative size-1.5 rounded-full", dot[tone])} />
      </span>
      {children}
    </span>
  );
}
