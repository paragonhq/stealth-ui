"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { ease } from "@/lib/motion";

/* -------------------------------------------------------------------------------------------------
 * State
 * -----------------------------------------------------------------------------------------------*/

export type UseBranchSwitcherOptions = {
  /** How many versions exist. */
  count: number;
  /** Controlled index, 0-based. */
  value?: number;
  /** Uncontrolled starting index. Defaults to the newest. */
  defaultValue?: number;
  onValueChange?: (index: number) => void;
  /** When a new version is added, show it. Uncontrolled only; a controlled parent decides for itself. */
  followNew?: boolean;
};

export type BranchSwitcherState = {
  index: number;
  count: number;
  /** 1 when the last move went to a later version, -1 when it went back. */
  direction: 1 | -1;
  go: (index: number) => void;
  prev: () => void;
  next: () => void;
};

/** The index, the direction of travel and the moves, without any UI. */
export function useBranchSwitcher({ count, value, defaultValue, onValueChange, followNew = true }: UseBranchSwitcherOptions): BranchSwitcherState {
  const [inner, setInner] = useState(defaultValue ?? Math.max(0, count - 1));
  const [seenCount, setSeenCount] = useState(count);
  const controlled = value !== undefined;

  // A regenerated reply is a new last version; take the reader to it (adjusting state during render).
  if (count !== seenCount) {
    setSeenCount(count);
    if (!controlled && followNew && count > seenCount) setInner(count - 1);
  }

  const index = clamp(controlled ? value : inner, count);
  const [track, setTrack] = useState<{ index: number; direction: 1 | -1 }>({ index, direction: 1 });
  if (track.index !== index) setTrack({ index, direction: index > track.index ? 1 : -1 });

  const go = useCallback(
    (next: number) => {
      const to = clamp(next, count);
      if (to === index) return;
      if (!controlled) setInner(to);
      onValueChange?.(to);
    },
    [count, index, controlled, onValueChange],
  );

  return { index, count, direction: track.direction, go, prev: () => go(index - 1), next: () => go(index + 1) };
}

const clamp = (i: number, count: number) => Math.min(Math.max(0, i), Math.max(0, count - 1));

/* -------------------------------------------------------------------------------------------------
 * Root
 * -----------------------------------------------------------------------------------------------*/

type Ctx = BranchSwitcherState & { noun: string };
const BranchContext = createContext<Ctx | null>(null);

function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error("BranchSwitcher parts must be inside <BranchSwitcher>");
  return ctx;
}

export type BranchSwitcherProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> &
  UseBranchSwitcherOptions & {
    /** What a version is called, for labels and announcements: "response", "message", "draft". */
    noun?: string;
  };

/** Holds which version is showing. Put the content and the control anywhere inside. */
export function BranchSwitcher({ count, value, defaultValue, onValueChange, followNew, noun = "response", className, children, ...rest }: BranchSwitcherProps) {
  const state = useBranchSwitcher({ count, value, defaultValue, onValueChange, followNew });
  return (
    <BranchContext value={{ ...state, noun }}>
      <div className={cn("min-w-0", className)} {...rest}>
        {children}
      </div>
    </BranchContext>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Content: the version that's showing, sliding the way you moved
 * -----------------------------------------------------------------------------------------------*/

export type BranchSwitcherContentProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Renders the version at an index. */
  children: (index: number) => React.ReactNode;
};

export function BranchSwitcherContent({ className, children, ...rest }: BranchSwitcherContentProps) {
  const { index, direction } = useBranch();
  const reduce = !!useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const last = useRef(0);
  const first = useRef(true);

  // Remember the height as content changes on its own (a reply streaming in), without animating it.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!el.style.height) last.current = el.offsetHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Only a change of version animates the height: from the old version's height to the new one's,
  // then back to auto so streaming text is never clipped by a height that's catching up.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      last.current = el.offsetHeight;
      return;
    }
    const from = last.current;
    el.style.height = "";
    const to = el.offsetHeight;
    last.current = to;
    if (reduce || from === to || !from) return;
    el.style.height = `${from}px`;
    const controls = animate(el, { height: [from, to] }, { duration: 0.28, ease: ease.inOut });
    controls.then(() => (el.style.height = ""));
    return () => {
      controls.stop();
      el.style.height = "";
    };
  }, [index, reduce]);

  return (
    <div
      ref={box}
      // Clip only vertically, so the height change is clean but the slide and focus rings aren't cut.
      className={cn("relative [overflow-x:visible] [overflow-y:clip]", className)}
      aria-live="off"
      {...rest}
    >
      <AnimatePresence initial={false} mode="popLayout" custom={direction}>
        <motion.div
          key={index}
          custom={direction}
          variants={{
            enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: 18 * d, filter: "blur(2px)" }),
            center: { opacity: 1, x: 0, filter: "blur(0px)" },
            exit: (d: number) => (reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, x: -14 * d, filter: "blur(2px)", transition: { duration: 0.16, ease: ease.in } }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduce ? 0.14 : 0.26, ease: ease.out }}
          className="w-full"
        >
          {children(index)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Control: ‹ 2 / 3 ›
 * -----------------------------------------------------------------------------------------------*/

export type BranchSwitcherControlProps = Omit<React.ComponentProps<"div">, "children"> & {
  size?: "sm" | "md";
  /** Keep the control on screen when there's only one version. Hidden by default. */
  showSingle?: boolean;
};

export function BranchSwitcherControl({ size = "sm", showSingle = false, className, onKeyDown, ...rest }: BranchSwitcherControlProps) {
  const { index, count, direction, prev, next, noun } = useBranch();
  const reduce = !!useReducedMotion();
  const [announced, setAnnounced] = useState("");
  const moved = useRef(false);

  // Announce only moves the reader made, not the first render or a new version arriving.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    setAnnounced(`${cap(noun)} ${index + 1} of ${count}`);
  }, [index, count, noun]);

  if (count < 2 && !showSingle) return null;

  const move = (fn: () => void) => {
    moved.current = true;
    fn();
  };
  const atStart = index === 0;
  const atEnd = index >= count - 1;

  return (
    <div
      role="group"
      aria-label={`${cap(noun)} ${index + 1} of ${count}`}
      data-size={size}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        // Arrows step between versions from either button, so a keyboard user can flip back and forth in place.
        if (e.key === "ArrowLeft" && !atStart) {
          e.preventDefault();
          move(prev);
        } else if (e.key === "ArrowRight" && !atEnd) {
          e.preventDefault();
          move(next);
        }
      }}
      className={cn("inline-flex select-none items-center text-fg-3", size === "sm" ? "h-7 gap-1 text-[12px]" : "h-8 gap-1.5 text-[12.5px]", className)}
      {...rest}
    >
      <StepButton label={`Previous ${noun}`} disabled={atStart} size={size} onPress={() => move(prev)}>
        <ChevronLeft size={size === "sm" ? 14 : 16} />
      </StepButton>
      <span aria-hidden className="flex min-w-[3ch] items-center justify-center gap-[0.3em] font-medium tabular text-fg-2">
        <NumberFlow value={index + 1} trend={direction} animated={!reduce} className="tabular" />
        <span className="text-fg-4">/</span>
        <NumberFlow value={count} trend={1} animated={!reduce} className="tabular" />
      </span>
      <StepButton label={`Next ${noun}`} disabled={atEnd} size={size} onPress={() => move(next)}>
        <ChevronRight size={size === "sm" ? 14 : 16} />
      </StepButton>
      <span role="status" aria-live="polite" className="sr-only">
        {announced}
      </span>
    </div>
  );
}

// aria-disabled rather than disabled: stepping to the last version must not throw focus to the body.
function StepButton({ label, disabled, size, onPress, children }: { label: string; disabled: boolean; size: "sm" | "md"; onPress: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={() => !disabled && onPress()}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-md text-fg-3 outline-none",
        "touch-manipulation [-webkit-tap-highlight-color:transparent]",
        "transition-[background-color,color,scale,opacity] duration-150 ease-out active:scale-[0.9] active:duration-75",
        "hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
        "aria-disabled:cursor-default aria-disabled:text-fg-4 aria-disabled:opacity-60 aria-disabled:hover:bg-transparent aria-disabled:active:scale-100",
        "before:absolute before:-inset-2.5 before:content-[''] pointer-fine:before:hidden motion-reduce:active:scale-100",
        size === "sm" ? "size-6" : "size-7",
      )}
    >
      {children}
    </button>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
