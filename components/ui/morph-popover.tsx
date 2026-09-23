"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, use, useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useControllableState } from "@/lib/use-controllable-state";
import { ease, spring } from "@/lib/motion";
import { Loader, X } from "@/lib/icons";

type Ctx = {
  open: boolean;
  titleId: string;
  /** Close and put focus back on the button. */
  close: () => void;
  /** Close with the success tick on the button, e.g. after a form was sent. */
  complete: () => void;
  draft: string;
  setDraft: (v: string) => void;
};
const MorphContext = createContext<Ctx | null>(null);

/** Close, complete and the kept draft, for content you build yourself. */
export function useMorphPopover() {
  const ctx = use(MorphContext);
  if (!ctx) throw new Error("useMorphPopover must be used inside <MorphPopover>");
  return ctx;
}

const FOCUSABLE = 'textarea, input, select, button:not([data-morph-close]), [href], [tabindex]:not([tabindex="-1"])';

export type MorphPopoverProps = Omit<React.ComponentProps<"div">, "title" | "children"> & {
  /** The button's content while closed. */
  label: React.ReactNode;
  /** Shown on the button, with a drawn tick, for a moment after complete(). */
  successLabel?: string;
  /** Heading of the panel, and its accessible name. */
  title: React.ReactNode;
  /** Which way the panel grows from the button. */
  side?: "top" | "bottom";
  /** Which edge of the button stays put: "end" grows leftwards, "start" rightwards. */
  align?: "start" | "end";
  /** Panel width in px. Capped to the room between the anchored edge and the viewport, less 16px. */
  width?: number;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Milliseconds the success label stays before the button returns to rest. */
  successDuration?: number;
  children: React.ReactNode;
};

export function MorphPopover({
  label,
  successLabel = "Sent",
  title,
  side = "bottom",
  align = "end",
  width = 320,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  successDuration = 1800,
  className,
  children,
  ...rest
}: MorphPopoverProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const [done, setDone] = useState(false);
  const [draft, setDraft] = useState("");
  const [panelW, setPanelW] = useState(width);
  const [panelH, setPanelH] = useState<number | null>(null);
  // Escape closes on the same frame; everything else morphs.
  const [instant, setInstant] = useState(false);
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const doneTimer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(doneTimer.current), []);

  const show = () => {
    window.clearTimeout(doneTimer.current);
    setDone(false);
    setInstant(false);
    // Never wider than the room between the anchored edge and the far side of the viewport.
    const box = rootRef.current?.getBoundingClientRect();
    const room = box ? (align === "end" ? box.right - 16 : window.innerWidth - box.left - 16) : window.innerWidth - 32;
    setPanelW(Math.max(box?.width ?? 0, Math.min(width, room)));
    setOpen(true);
  };

  const close = useCallback(
    (opts: { restore?: boolean; instant?: boolean } = {}) => {
      restoreFocus.current = opts.restore ?? true;
      setInstant(!!opts.instant);
      setOpen(false);
    },
    [setOpen],
  );

  const complete = useCallback(() => {
    setDraft("");
    setDone(true);
    close();
    window.clearTimeout(doneTimer.current);
    doneTimer.current = window.setTimeout(() => setDone(false), successDuration);
  }, [close, successDuration]);

  // Focus follows the surface: into the panel's first field on open, back to the button on close.
  useEffect(() => {
    if (open) {
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      buttonRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  // Outside presses close without stealing focus from wherever the press landed.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close({ restore: false });
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, close]);

  // The panel's natural height, so the surface can spring to an exact number.
  useEffect(() => {
    const el = panelRef.current;
    if (!open || !el) return;
    const ro = new ResizeObserver(([entry]) => setPanelH(entry.borderBoxSize[0].blockSize + 2));
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const sizeTransition = reduce || instant ? { duration: 0 } : open ? spring.soft : spring.snappy;
  const fade = (delay: number, d = 0.2) => ({ duration: reduce ? 0.12 : d, delay: reduce || instant ? 0 : delay, ease: ease.out });
  const blur = reduce ? {} : { filter: "blur(4px)" };
  const corner = cn(side === "bottom" ? "top-0" : "bottom-0", align === "end" ? "right-0" : "left-0");
  // The button is the closed surface's full outer box, overlapping the 1px border so its label centers exactly.
  const buttonCorner = cn(side === "bottom" ? "-top-px" : "-bottom-px", align === "end" ? "-right-px" : "-left-px");
  const buttonText = done ? successLabel : label;

  const ctx: Ctx = { open, titleId, close: () => close(), complete, draft, setDraft };

  return (
    <MorphContext value={ctx}>
      <div ref={rootRef} data-state={open ? "open" : "closed"} className={cn("relative inline-grid", className)} {...rest}>
        {/* Holds the closed button's footprint in the layout, sized for both labels, so nothing around it moves. */}
        <span aria-hidden className="invisible col-start-1 row-start-1 inline-grid h-8 items-center px-3 text-[12.5px] font-medium">
          <span className="col-start-1 row-start-1 flex items-center gap-2 whitespace-nowrap">{label}</span>
          <span className="col-start-1 row-start-1 flex items-center gap-2 whitespace-nowrap">
            <span className="size-4" />
            {successLabel}
          </span>
        </span>

        <motion.div
          initial={false}
          animate={{
            width: open ? panelW : "100%",
            height: open ? (panelH ?? "100%") : "100%",
            borderRadius: open ? 14 : 8,
          }}
          transition={sizeTransition}
          className={cn(
            "absolute z-(--z-popover) overflow-hidden border border-line-2 bg-raised text-fg",
            // Press and focus live on the surface, so the whole button squashes and the ring isn't clipped.
            "transition-[box-shadow,scale,border-color] duration-200 has-[>button:active]:scale-[0.97] has-[>button:active]:duration-75",
            "has-[>button:focus-visible]:outline-solid has-[>button:focus-visible]:outline-1 has-[>button:focus-visible]:outline-offset-2 has-[>button:focus-visible]:outline-fg-3",
            open ? "shadow-pop" : "shadow-[var(--shadow)] has-[>button:hover]:border-fg-4",
            corner,
          )}
        >
          <AnimatePresence initial={false}>
            {!open ? (
              <motion.button
                key="button"
                ref={buttonRef}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={false}
                onClick={show}
                initial={{ opacity: 0, ...blur }}
                animate={{ opacity: 1, filter: "blur(0px)", transition: fade(0.12, 0.18) }}
                exit={{ opacity: 0, ...blur, transition: fade(0, 0.1) }}
                className={cn(
                  "group/morph absolute inline-grid h-8 items-center justify-items-center whitespace-nowrap px-3 text-[12.5px] font-medium tracking-[-0.005em] outline-none",
                  "transition-[background-color] duration-150 hover:bg-hover",
                  buttonCorner,
                )}
              >
                {/* Both labels reserve the cell (same as the spacer) so the live one stays centered; the swap pops, the tick draws. */}
                <span aria-hidden className="invisible col-start-1 row-start-1 flex items-center gap-2">
                  {label}
                </span>
                <span aria-hidden className="invisible col-start-1 row-start-1 flex items-center gap-2">
                  <span className="size-4" />
                  {successLabel}
                </span>
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    key={done ? "done" : "rest"}
                    className="col-start-1 row-start-1 flex items-center gap-2"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" }}
                    transition={{ duration: reduce ? 0.12 : 0.22, ease: ease.out }}
                  >
                    {done && <Tick reduce={!!reduce} />}
                    {buttonText}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            ) : (
              <motion.div
                key="panel"
                ref={panelRef}
                role="dialog"
                aria-labelledby={titleId}
                style={{ width: panelW - 2 }}
                initial={{ opacity: 0, ...blur }}
                animate={{ opacity: 1, filter: "blur(0px)", transition: fade(0.07) }}
                exit={{ opacity: 0, ...blur, transition: fade(0, 0.1) }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    close({ instant: true });
                  }
                }}
                onBlur={(e) => {
                  // Tabbing out of the panel closes it, like any non-modal popover.
                  const next = e.relatedTarget as Node | null;
                  if (next && !rootRef.current?.contains(next)) close({ restore: false });
                }}
                className={cn("absolute flex flex-col gap-3 p-3", corner)}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 id={titleId} className="min-w-0 truncate pl-0.5 text-[13.5px] font-medium tracking-[-0.01em] text-fg">
                    {title}
                  </h2>
                  <button
                    type="button"
                    data-morph-close
                    aria-label="Close"
                    onClick={() => close()}
                    className={cn(
                      "relative -my-1 -mr-1 grid size-7 shrink-0 place-items-center rounded-md text-fg-3 outline-none",
                      "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
                      "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                      "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
                    )}
                  >
                    <X size={14} />
                  </button>
                </div>
                {children}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        <span role="status" aria-live="polite" className="sr-only">
          {done ? successLabel : ""}
        </span>
      </div>
    </MorphContext>
  );
}

function Tick({ reduce }: { reduce: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-success">
      <motion.path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.34, ease: ease.out, delay: 0.16 }}
      />
    </svg>
  );
}

export type MorphPopoverFormProps = Omit<React.ComponentProps<"form">, "onSubmit"> & {
  /** Receives the trimmed text. Resolve to finish with the tick; reject to keep the panel open with an error. */
  onSubmit: (text: string) => void | Promise<void>;
  placeholder?: string;
  submitLabel?: string;
  /** Accessible label of the text field. */
  fieldLabel?: string;
  errorMessage?: string;
  maxLength?: number;
};

/** A short text form for the panel: ⌘↵ to send, busy in place, the draft survives closing. */
export function MorphPopoverForm({
  onSubmit,
  placeholder = "What could be better?",
  submitLabel = "Send",
  fieldLabel = "Message",
  errorMessage = "Couldn’t send. Try again.",
  maxLength = 1000,
  className,
  ...rest
}: MorphPopoverFormProps) {
  const { draft, setDraft, complete } = useMorphPopover();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const errorId = useId();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => void (alive.current = false);
  }, []);
  const empty = !draft.trim();

  const send = async () => {
    if (busy || empty) return;
    setBusy(true);
    setFailed(false);
    try {
      await onSubmit(draft.trim());
      if (alive.current) complete();
    } catch {
      if (alive.current) setFailed(true);
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const near = draft.length > maxLength * 0.9;

  return (
    <form
      className={cn("flex flex-col gap-2.5", className)}
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      {...rest}
    >
      <label className="sr-only" htmlFor={errorId + "field"}>
        {fieldLabel}
      </label>
      <textarea
        id={errorId + "field"}
        value={draft}
        maxLength={maxLength}
        placeholder={placeholder}
        readOnly={busy}
        aria-invalid={failed || undefined}
        aria-describedby={failed ? errorId : undefined}
        onChange={(e) => {
          setDraft(e.target.value);
          if (failed) setFailed(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
        }}
        rows={4}
        className={cn(
          "min-h-24 w-full resize-none rounded-lg border border-line-2 bg-frame px-2.5 py-2 text-base leading-5 text-fg outline-none placeholder:text-fg-4 sm:text-[13px]",
          "transition-[border-color,box-shadow] duration-150 focus:border-fg-4 focus:ring-3 focus:ring-fg/10",
          "aria-invalid:border-danger/60 read-only:text-fg-2",
        )}
      />
      <div className="flex min-h-8 items-center justify-between gap-3">
        <p id={errorId} role={failed ? "alert" : undefined} className={cn("min-w-0 truncate pl-0.5 text-[12px]", failed ? "text-danger" : "text-fg-4")}>
          {failed ? (
            errorMessage
          ) : near ? (
            <span className="tabular">
              {draft.length}/{maxLength}
            </span>
          ) : (
            <span className="hidden pointer-fine:inline">
              <kbd className="font-sans">⌘↵</kbd> to send
            </span>
          )}
        </p>
        <button
          type="submit"
          aria-disabled={empty || undefined}
          aria-busy={busy || undefined}
          className={cn(
            "relative inline-grid h-8 shrink-0 place-items-center rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame outline-none",
            "transition-[background-color,opacity,scale] duration-150 hover:bg-fg/90 active:scale-[0.97] active:duration-75",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "aria-disabled:pointer-events-none aria-disabled:opacity-40 aria-busy:pointer-events-none",
          )}
        >
          <span className={cn("col-start-1 row-start-1 transition-opacity duration-150", busy && "opacity-0")}>{submitLabel}</span>
          {busy && <Loader size={14} className="col-start-1 row-start-1 animate-spin" />}
        </button>
      </div>
    </form>
  );
}
