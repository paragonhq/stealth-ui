"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

type Status = "idle" | "saving" | "saved" | "error";

/** Warns before the tab closes or reloads while there are unsaved changes. */
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}

export type SaveBarProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Whether the form differs from what's saved. The bar shows while true, and through the saved moment after. */
  dirty: boolean;
  /** Save. Return a promise and the bar shows Saving…, then a tick, then leaves. Reject to keep it with Try again. */
  onSave: () => unknown;
  /** Throw the changes away. The bar leaves once dirty turns false. */
  onDiscard: () => void;
  /** How many fields changed, when you know it. The count rolls as it changes. */
  changes?: number;
  /** Increment when someone tries to leave with unsaved changes; the bar pulses and says so. */
  nudgeKey?: number;
  /** fixed to the viewport (default) or absolute inside a positioned container. */
  position?: "fixed" | "absolute";
  /** Save on ⌘S / Ctrl+S while the bar is showing. */
  shortcut?: boolean;
  labels?: { unsaved?: string; save?: string; discard?: string; saving?: string; saved?: string; error?: string; nudge?: string };
};

const defaults = {
  unsaved: "Unsaved changes",
  save: "Save changes",
  discard: "Discard",
  saving: "Saving…",
  saved: "Saved",
  error: "Couldn’t save",
  nudge: "Save or discard first",
};

export function SaveBar({
  dirty,
  onSave,
  onDiscard,
  changes,
  nudgeKey = 0,
  position = "fixed",
  shortcut = true,
  labels: labelsProp,
  className,
  ...rest
}: SaveBarProps) {
  const labels = { ...defaults, ...labelsProp };
  const reduce = useReducedMotion();
  const [status, setStatus] = useState<Status>("idle");
  const [nudging, setNudging] = useState(false);
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Editing again after a save (or a failure) is a fresh set of changes.
  const [prevDirty, setPrevDirty] = useState(dirty);
  if (prevDirty !== dirty) {
    setPrevDirty(dirty);
    if (dirty && status !== "saving") setStatus("idle");
  }

  const visible = dirty || status === "saving" || status === "saved";

  const save = useCallback(async () => {
    if (status === "saving") return;
    let result: unknown;
    try {
      result = onSave();
    } catch {
      setStatus("error");
      return;
    }
    if (!result || typeof (result as Promise<unknown>).then !== "function") {
      setStatus("saved");
      return;
    }
    setStatus("saving");
    const started = performance.now();
    try {
      await result;
      // Hold the spinner long enough to read, so a fast save doesn't flash.
      const rest = 450 - (performance.now() - started);
      if (rest > 0) await new Promise((r) => setTimeout(r, rest));
      if (alive.current) setStatus("saved");
    } catch {
      if (alive.current) setStatus("error");
    }
  }, [onSave, status]);

  // The saved moment holds, then the bar leaves on its own.
  useEffect(() => {
    if (status !== "saved") return;
    const t = window.setTimeout(() => setStatus("idle"), 1400);
    return () => window.clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (!shortcut || !visible || status === "saved") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut, visible, status, save]);

  // A gentle pulse when someone tries to leave: the bar lifts and settles, and says why.
  const [prevNudge, setPrevNudge] = useState(nudgeKey);
  if (prevNudge !== nudgeKey) {
    setPrevNudge(nudgeKey);
    if (dirty) setNudging(true);
  }
  useEffect(() => {
    if (!nudging) return;
    if (scope.current && !reduce) {
      animate(scope.current, { y: [0, -6, 0, -2, 0], scale: [1, 1.025, 0.995, 1.005, 1] }, { duration: 0.6, ease: ease.out });
    }
    const t = window.setTimeout(() => setNudging(false), 2200);
    return () => window.clearTimeout(t);
  }, [nudging, nudgeKey, animate, scope, reduce]);

  const message =
    status === "saving" ? labels.saving : status === "saved" ? labels.saved : status === "error" ? labels.error : nudging ? labels.nudge : labels.unsaved;
  // Saving answers the nudge; the warning steps aside for the progress.
  const tone = status === "saved" ? "success" : status === "error" ? "danger" : nudging && status === "idle" ? "warning" : "neutral";
  const locked = status === "saving" || status === "saved";
  const mac = useIsMac();

  return (
    <div
      className={cn(
        "pointer-events-none inset-x-0 bottom-0 z-(--z-sticky) flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))]",
        position === "fixed" ? "fixed" : "absolute pb-4",
        className,
      )}
      {...rest}
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            key="bar"
            role="region"
            aria-label="Unsaved changes"
            data-status={status}
            data-tone={tone}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, y: 16, scale: 0.98, filter: "blur(2px)", transition: { duration: 0.2, ease: ease.in } }}
            transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
            className="@container/savebar pointer-events-auto w-full max-w-[440px]"
          >
            <div
              ref={scope}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-xl border bg-raised py-2 pr-2 pl-3.5 shadow-pop",
                // Too narrow for one row (a phone): the message keeps its line and the buttons share the next.
                "@max-[27rem]/savebar:flex-wrap @max-[27rem]/savebar:gap-y-2.5 @max-[27rem]/savebar:pt-3 @max-[27rem]/savebar:pl-3",
                "transition-[border-color,box-shadow] duration-300 ease-out",
                tone === "warning" ? "border-warning/50 ring-3 ring-warning/15" : "border-line-2 ring-0 ring-transparent",
              )}
            >
              <span className="relative grid size-4 shrink-0 place-items-center" aria-hidden>
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    key={tone === "success" ? "tick" : tone === "danger" ? "x" : "dot"}
                    className="absolute inset-0 grid place-items-center"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4, transition: { duration: 0.1 } }}
                    transition={reduce ? { duration: 0.15 } : spring.pop}
                  >
                    {tone === "success" ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="text-success">
                        <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: ease.out, delay: 0.05 }} />
                      </svg>
                    ) : tone === "danger" ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" className="text-danger">
                        <circle cx="8" cy="8" r="5.75" />
                        <path d="M8 5v3.5" />
                        <circle cx="8" cy="10.9" r=".6" fill="currentColor" stroke="none" />
                      </svg>
                    ) : (
                      <span className={cn("relative size-2 rounded-full", tone === "warning" ? "bg-warning" : "bg-fg-2")}>
                        {tone === "warning" && <span className="absolute inset-0 animate-ping-soft rounded-full bg-warning" />}
                      </span>
                    )}
                  </motion.span>
                </AnimatePresence>
              </span>

              {/* Every message sits in one grid cell, so the bar never changes width as it talks. */}
              <p className="grid min-w-0 flex-1 text-[13px] font-medium tracking-[-0.005em] text-fg">
                {[labels.unsaved, labels.saving, labels.saved, labels.error, labels.nudge].map((m) => (
                  <span key={m} aria-hidden className="invisible col-start-1 row-start-1 truncate">
                    {m}
                    {changes != null && m === labels.unsaved ? " · 00" : ""}
                  </span>
                ))}
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    key={message}
                    className="col-start-1 row-start-1 flex min-w-0 items-baseline gap-1.5"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)", transition: { duration: 0.12, ease: ease.in } }}
                    transition={{ duration: reduce ? 0.15 : 0.22, ease: ease.out }}
                  >
                    <span className="truncate">{message}</span>
                    {message === labels.unsaved && changes != null && changes > 0 && (
                      <span className="shrink-0 font-normal text-fg-3">
                        · <NumberFlow value={changes} className="tabular" />
                      </span>
                    )}
                  </motion.span>
                </AnimatePresence>
              </p>

              <div
                className={cn(
                  "flex shrink-0 items-center gap-1.5 transition-[opacity,translate] duration-200 ease-out",
                  "@max-[27rem]/savebar:w-full @max-[27rem]/savebar:*:flex-1 @max-[27rem]/savebar:*:justify-center",
                  status === "saved" && "pointer-events-none translate-x-1 opacity-0 @max-[27rem]/savebar:hidden",
                )}
                inert={status === "saved"}
              >
                <button
                  type="button"
                  onClick={onDiscard}
                  disabled={locked}
                  className={cn(
                    "inline-flex h-8 items-center whitespace-nowrap rounded-lg px-2.5 text-[12.5px] font-medium text-fg-2 outline-none",
                    "transition-[background-color,color,scale,opacity] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75",
                    "focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  {labels.discard}
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  aria-busy={status === "saving" || undefined}
                  aria-keyshortcuts={shortcut ? "Meta+S Control+S" : undefined}
                  className={cn(
                    "group/save relative inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame shadow-[var(--shadow)] outline-none",
                    "transition-[background-color,scale] duration-150 ease-out focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid",
                    status === "saving" ? "bg-fg/85" : "hover:bg-fg/90 active:scale-[0.97] active:duration-75",
                  )}
                >
                  {/* Label and spinner share a cell: the button keeps its width while it works. */}
                  <span className="grid place-items-center">
                    <span className={cn("col-start-1 row-start-1 transition-[opacity,scale] duration-150", status === "saving" && "scale-95 opacity-0")}>
                      {status === "error" ? "Try again" : labels.save}
                    </span>
                    <span aria-hidden className="invisible col-start-1 row-start-1">{labels.save}</span>
                    <span aria-hidden className="invisible col-start-1 row-start-1">Try again</span>
                    {status === "saving" && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden className="col-start-1 row-start-1 animate-spin [animation-duration:0.75s]">
                        <circle cx="8" cy="8" r="5.75" opacity="0.25" />
                        <path d="M8 2.25a5.75 5.75 0 0 1 5.75 5.75" />
                      </svg>
                    )}
                  </span>
                  {shortcut && (
                    <kbd
                      suppressHydrationWarning
                      className="hidden h-[18px] items-center rounded-[4px] bg-frame/15 px-1 font-mono text-[10.5px] font-normal text-frame/70 @min-[27rem]/savebar:pointer-fine:inline-flex"
                    >
                      {mac ? "⌘S" : "Ctrl S"}
                    </kbd>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <span role="status" aria-live="polite" className="sr-only">
        {visible ? message : ""}
      </span>
    </div>
  );
}

// The platform only matters for the shortcut hint; the server renders ⌘ and the client corrects it.
function useIsMac() {
  const [mac, setMac] = useState(true);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)));
    return () => window.cancelAnimationFrame(id);
  }, []);
  return mac;
}
