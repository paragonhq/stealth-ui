"use client";
import { autoUpdate, computePosition, flip, hide, inline, offset, shift, type VirtualElement } from "@floating-ui/react";
import { Toolbar } from "@base-ui/react/toolbar";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { TooltipGroup, TooltipGroupTrigger } from "@/components/ui/tooltip";

/* -------------------------------------------------------------------------------------------------
 * Tracking the selection
 * -----------------------------------------------------------------------------------------------*/

export type TextSelection = { range: Range; text: string; /** How the selection was made. */ pointerType: "mouse" | "touch" | "pen" | "keyboard" };

const noop = () => () => {};

function selectionIn(el: HTMLElement | null, pointerType: TextSelection["pointerType"]): TextSelection | null {
  const sel = typeof window === "undefined" ? null : window.getSelection();
  if (!el || !sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  if (!el.contains(sel.anchorNode) || !el.contains(sel.focusNode)) return null;
  const text = sel.toString();
  if (!text.trim()) return null;
  return { range: sel.getRangeAt(0).cloneRange(), text, pointerType };
}

/**
 * The live, non-empty text selection inside `target`, or null. It waits for the pointer to be
 * released (so it doesn't chase a drag) and lets keyboard selections settle for 180ms.
 * While `frozen` is true it holds the last selection, e.g. while focus is in the toolbar.
 */
export function useTextSelection(
  target: React.RefObject<HTMLElement | null>,
  {
    frozen = false,
    settle = 180,
    holdWithin,
  }: {
    frozen?: boolean;
    settle?: number;
    /** While focus is inside this element (the toolbar), the selection is held rather than dropped. */
    holdWithin?: React.RefObject<HTMLElement | null>;
  } = {},
) {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const frozenRef = useRef(frozen);
  useEffect(() => {
    frozenRef.current = frozen;
  }, [frozen]);

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    let dragging = false;
    let timer = 0;
    let via: TextSelection["pointerType"] = "keyboard";
    const held = () => frozenRef.current || !!holdWithin?.current?.contains(document.activeElement);
    const read = () => {
      window.clearTimeout(timer);
      if (!held()) setSelection(selectionIn(el, via));
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      via = e.pointerType === "touch" || e.pointerType === "pen" ? e.pointerType : "mouse";
      // A new press inside the text starts over: the old toolbar leaves at once.
      if (!held()) setSelection(null);
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      // The selection finalizes after pointerup; read it on the next frame.
      requestAnimationFrame(read);
    };
    const onChange = () => {
      if (dragging || held()) return;
      window.clearTimeout(timer);
      const now = selectionIn(el, via);
      // Collapses hide immediately; growing or new selections settle first.
      if (!now) setSelection(null);
      else timer = window.setTimeout(read, settle);
    };
    const onKey = () => {
      via = "keyboard";
    };
    el.addEventListener("keydown", onKey);
    el.addEventListener("pointerdown", onDown);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    document.addEventListener("selectionchange", onChange);
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      document.removeEventListener("selectionchange", onChange);
    };
  }, [target, settle, holdWithin]);

  const clear = useCallback(() => setSelection(null), []);
  return { selection, clear };
}

/* -------------------------------------------------------------------------------------------------
 * Context for the parts
 * -----------------------------------------------------------------------------------------------*/

type Ctx = {
  /** The selected text when the toolbar opened. */
  text: string;
  /** Puts the saved selection back in the document, e.g. before applying a format from an input. */
  restoreSelection: () => void;
  /** Hides the toolbar until the next selection and returns focus to the text. */
  dismiss: () => void;
};
const SelectionToolbarContext = createContext<Ctx | null>(null);

/** Inside the toolbar: the selected text, a way to restore the selection, and a way to close. */
export function useSelectionToolbar() {
  const ctx = useContext(SelectionToolbarContext);
  if (!ctx) throw new Error("useSelectionToolbar must be used inside a SelectionToolbar");
  return ctx;
}

/* -------------------------------------------------------------------------------------------------
 * The toolbar
 * -----------------------------------------------------------------------------------------------*/

export type SelectionToolbarProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The element whose text selections summon the toolbar: a contentEditable, an article, a comment. */
  target: React.RefObject<HTMLElement | null>;
  /** Accessible name of the toolbar. */
  label?: string;
  /** Called when the toolbar appears or leaves, with the selected text. */
  onSelectionChange?: (text: string | null) => void;
  /** Where to portal the toolbar. Defaults to document.body. */
  container?: HTMLElement | null;
  children: React.ReactNode;
};

/**
 * A floating toolbar that follows the text selection inside `target`. It rises above the
 * first selected line, glides when the selection changes, and leaves when it collapses.
 * Alt+F10 in the text moves focus into it; Escape sends focus back with the selection intact.
 */
export function SelectionToolbar({ target, label = "Text formatting", onSelectionChange, container, className, children, ...rest }: SelectionToolbarProps) {
  const [frozen, setFrozen] = useState(false);
  const floatingRef = useRef<HTMLDivElement>(null);
  const { selection, clear } = useTextSelection(target, { frozen, holdWithin: floatingRef });
  const reduce = useReducedMotion();
  const open = selection !== null;

  const innerRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<Range | null>(null);
  const shown = useRef(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const width = useMotionValue<number | "auto">("auto");
  const [side, setSide] = useState<"top" | "bottom">("top");
  const [anchorHidden, setAnchorHidden] = useState(false);

  useEffect(() => {
    onSelectionChange?.(selection?.text ?? null);
  }, [selection, onSelectionChange]);

  // Position with floating-ui, but write the result into motion values so a new selection glides
  // on a spring while scroll and resize updates land on the same frame.
  const glideNext = useRef(false);
  useLayoutEffect(() => {
    // Kept for restoring, and for the rects below; a collapse keeps the last range for the exit.
    if (selection) rangeRef.current = selection.range;
    const floating = floatingRef.current;
    if (!open || !floating) return;
    const touch = selection?.pointerType === "touch";
    // The selection's rects, read live so scrolling and reflow keep it attached.
    const reference: VirtualElement = {
      getBoundingClientRect: () => rangeRef.current?.getBoundingClientRect() ?? new DOMRect(),
      getClientRects: () => rangeRef.current?.getClientRects() ?? ([] as unknown as DOMRectList),
      contextElement: target.current ?? undefined,
    };
    const update = () => {
      computePosition(reference, floating, {
        // On touch the system's own selection menu sits above the text, so the toolbar goes below.
        placement: touch ? "bottom" : "top",
        strategy: "fixed",
        middleware: [inline(), offset(touch ? 14 : 8), flip({ padding: 8 }), shift({ padding: 8 }), hide()],
      }).then((pos) => {
        const glide = glideNext.current && shown.current && !reduce;
        glideNext.current = false;
        if (glide) {
          animate(x, pos.x, spring.snappy);
          animate(y, pos.y, spring.snappy);
        } else {
          x.set(pos.x);
          y.set(pos.y);
        }
        shown.current = true;
        setSide(pos.placement.startsWith("bottom") ? "bottom" : "top");
        setAnchorHidden(!!pos.middlewareData.hide?.referenceHidden);
      });
    };
    glideNext.current = true;
    update();
    return autoUpdate(reference, floating, update, { animationFrame: false });
  }, [open, selection, target, x, y, reduce]);

  useEffect(() => {
    if (!open) shown.current = false;
  }, [open]);

  // The surface's width follows its content on a spring, so swapping buttons for an input morphs.
  useEffect(() => {
    const inner = innerRef.current;
    if (!open || !inner) return;
    let first = true;
    const ro = new ResizeObserver(() => {
      const w = inner.offsetWidth;
      if (first || reduce) width.set(w);
      else animate(width, w, spring.snappy);
      first = false;
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, [open, reduce, width]);

  const restoreSelection = () => {
    const range = rangeRef.current;
    const sel = window.getSelection();
    if (!range || !sel) return;
    target.current?.focus({ preventScroll: true });
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const dismiss = () => {
    setFrozen(false);
    restoreSelection();
    clear();
  };

  // Alt+F10 (the editor convention) jumps into the toolbar; Escape in the text hides it.
  useEffect(() => {
    const el = target.current;
    if (!el || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "F10") {
        e.preventDefault();
        floatingRef.current?.querySelector<HTMLElement>("button:not([disabled]),input")?.focus();
      } else if (e.key === "Escape") {
        clear();
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [target, open, clear]);

  const ctx: Ctx = { text: selection?.text ?? "", restoreSelection, dismiss };

  // Portals only exist on the client; the server renders nothing here, and so does hydration.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence onExitComplete={() => width.set("auto")}>
      {open && (
        <motion.div
          ref={floatingRef}
          style={{ x, y }}
          className="fixed left-0 top-0 z-(--z-popover)"
          data-side={side}
          // Focus inside the toolbar freezes the selection it belongs to.
          onFocus={() => setFrozen(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFrozen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setFrozen(false);
              restoreSelection();
            }
          }}
          // Pressing the toolbar must not collapse the selection it acts on.
          onMouseDown={(e) => {
            if (!(e.target as HTMLElement).closest("input,textarea")) e.preventDefault();
          }}
        >
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: side === "top" ? 4 : -4, filter: "blur(2px)" }}
            animate={{ opacity: anchorHidden ? 0 : 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.97, filter: "blur(1px)", transition: { duration: 0.11, ease: ease.in } }}
            transition={{ duration: reduce ? 0.12 : 0.18, ease: ease.out }}
            style={{ width, transformOrigin: side === "top" ? "50% 100%" : "50% 0%" }}
            className={cn(
              "overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop",
              anchorHidden && "pointer-events-none",
              className,
            )}
            {...(rest as React.ComponentProps<typeof motion.div>)}
          >
            <SelectionToolbarContext.Provider value={ctx}>
              <TooltipGroup side={side} sideOffset={10} delay={400}>
                <Toolbar.Root ref={innerRef} aria-label={label} className="flex h-9 w-max items-center gap-0.5 p-1">
                  {children}
                </Toolbar.Root>
              </TooltipGroup>
            </SelectionToolbarContext.Provider>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    container ?? document.body,
  );
}

/* -------------------------------------------------------------------------------------------------
 * Parts
 * -----------------------------------------------------------------------------------------------*/

export type SelectionToolbarButtonProps = Omit<Toolbar.Button.Props, "className" | "children"> & {
  /** Accessible name, and the tooltip. */
  label: string;
  shortcut?: string[];
  /** A toggle's current state, e.g. whether the selection is bold. */
  pressed?: boolean;
  /** Show the label as text beside the icon instead of only in the tooltip. */
  showLabel?: boolean;
  icon?: React.ReactNode;
  className?: string;
};

export function SelectionToolbarButton({ label, shortcut, pressed, showLabel = false, icon, className, ...rest }: SelectionToolbarButtonProps) {
  const button = (
    <Toolbar.Button
      aria-label={showLabel ? undefined : label}
      aria-pressed={pressed}
      className={cn(
        "relative inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-medium text-fg-2 outline-none",
        showLabel ? "px-2" : "w-7",
        "transition-[background-color,color,scale] duration-150 hover:bg-fg/[0.06] hover:text-fg active:scale-[0.92] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
        "aria-pressed:bg-fg/[0.11] aria-pressed:text-fg aria-pressed:hover:bg-fg/[0.14]",
        "data-disabled:pointer-events-none data-disabled:opacity-40",
        "[&_svg]:shrink-0",
        className,
      )}
      {...rest}
    >
      {icon}
      {showLabel && label}
    </Toolbar.Button>
  );
  if (showLabel && !shortcut) return button;
  return (
    <TooltipGroupTrigger content={label} shortcut={shortcut}>
      {button}
    </TooltipGroupTrigger>
  );
}

export function SelectionToolbarSeparator({ className, ...rest }: Omit<Toolbar.Separator.Props, "className"> & { className?: string }) {
  return <Toolbar.Separator className={cn("mx-1 h-4 w-px shrink-0 bg-line-2", className)} {...rest} />;
}

export type SelectionToolbarFieldProps = Omit<React.ComponentProps<"input">, "onSubmit"> & {
  /** Called with the value on Enter, after the saved selection has been put back. */
  onSubmit: (value: string) => void;
  /** Called on Escape, after the saved selection has been put back. */
  onCancel: () => void;
  /** Label for the submit button. */
  submitLabel?: string;
};

/** An input that swaps in for the buttons, e.g. a link URL. Enter applies, Escape backs out. */
export function SelectionToolbarField({ onSubmit, onCancel, submitLabel = "Apply", defaultValue, className, ...rest }: SelectionToolbarFieldProps) {
  const { restoreSelection } = useSelectionToolbar();
  const [value, setValue] = useState(typeof defaultValue === "string" ? defaultValue : "");
  const submit = () => {
    restoreSelection();
    onSubmit(value.trim());
  };
  return (
    <div className="flex items-center gap-1 pl-2">
      <Toolbar.Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            restoreSelection();
            onCancel();
          }
        }}
        className={cn(
          "h-7 w-52 min-w-0 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[12.5px]",
          className,
        )}
        {...rest}
      />
      <Toolbar.Button
        disabled={!value.trim()}
        focusableWhenDisabled={false}
        onClick={submit}
        className={cn(
          "inline-flex h-7 shrink-0 items-center rounded-lg bg-fg px-2.5 text-[12px] font-medium text-frame outline-none",
          "transition-[background-color,opacity,scale] duration-150 hover:bg-fg/90 active:scale-[0.96] active:duration-75",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "data-disabled:opacity-40",
        )}
      >
        {submitLabel}
      </Toolbar.Button>
    </div>
  );
}
