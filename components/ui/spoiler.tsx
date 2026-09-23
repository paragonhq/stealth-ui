"use client";
import { AnimatePresence, animate, motion, useMotionTemplate, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { cloneElement, Fragment, isValidElement, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { Eye, EyeOff } from "@/lib/icons";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * Grain
 * -----------------------------------------------------------------------------------------------*/

// Film grain as a mask, not a picture: the SVG only decides where the speckles are, and the
// element's own token color fills them, so the grain follows the theme with no color of its own.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.15' numOctaves='2' seed='7' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2.6 0 0 0 -0.75'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E\")";
// Drawn at half the tile size, so each speck is about a device pixel on a retina screen.
const grain: React.CSSProperties = { maskImage: GRAIN, WebkitMaskImage: GRAIN, maskSize: "60px", WebkitMaskSize: "60px" };

/* -------------------------------------------------------------------------------------------------
 * Words
 * -----------------------------------------------------------------------------------------------*/

// The grain over one piece of text. Every piece's cover is the line's height, centered, and
// pieces sit exactly edge to edge, so a phrase reads as one cover across spaces and line breaks.
function Cover() {
  return (
    <span
      aria-hidden
      style={grain}
      className={cn(
        "pointer-events-none absolute inset-x-0 top-1/2 h-[calc(1lh-4px)] -translate-y-1/2 bg-fg-3",
        "transition-[opacity,scale,filter] duration-[420ms] ease-out-expo [transition-delay:var(--d,0ms)]",
        "group-hover/spoiler:group-data-[state=hidden]/spoiler:bg-fg-2",
        "group-data-[state=revealed]/spoiler:scale-125 group-data-[state=revealed]/spoiler:opacity-0 group-data-[state=revealed]/spoiler:blur-[2px]",
        "motion-reduce:scale-100! motion-reduce:blur-none!",
      )}
    />
  );
}

// Each word carries its own cover, so the grain follows the text across line breaks and the
// reveal can travel outward from the word that was clicked.
function Word({ children }: { children: React.ReactNode }) {
  return (
    <span data-spoiler-piece className="relative inline-block">
      <span
        className={cn(
          "inline-block transition-[filter,opacity] duration-300 ease-out-expo [transition-delay:var(--d,0ms)]",
          "group-data-[state=hidden]/spoiler:opacity-30 group-data-[state=hidden]/spoiler:blur-[5px] group-data-[state=hidden]/spoiler:select-none",
          "motion-reduce:blur-none!",
        )}
      >
        {children}
      </span>
      <Cover />
    </span>
  );
}

// The space between two words, covered too. At a line break it collapses to nothing, and so does its cover.
function Gap({ children }: { children: string }) {
  return (
    <span data-spoiler-piece className="relative">
      {children}
      <Cover />
    </span>
  );
}

function splitWords(node: React.ReactNode, key = "w"): React.ReactNode {
  if (typeof node === "string" || typeof node === "number") {
    return String(node)
      .split(/(\s+)/)
      .map((part, i) =>
        part === "" ? null : /^\s+$/.test(part) ? <Gap key={`${key}.${i}`}>{part}</Gap> : <Word key={`${key}.${i}`}>{part}</Word>,
      );
  }
  if (Array.isArray(node)) return node.map((n, i) => <Fragment key={i}>{splitWords(n, `${key}.${i}`)}</Fragment>);
  if (isValidElement<{ children?: React.ReactNode }>(node)) {
    // Formatting (em, strong, code) keeps its element and splits inside; anything else is one piece.
    if (node.props.children != null) return cloneElement(node, undefined, splitWords(node.props.children, key));
    return <Word key={key}>{node}</Word>;
  }
  return node;
}

/* -------------------------------------------------------------------------------------------------
 * Shared state
 * -----------------------------------------------------------------------------------------------*/

type RevealProps = {
  /** Controlled: whether the content is showing. */
  revealed?: boolean;
  /** Uncontrolled starting state. */
  defaultRevealed?: boolean;
  onRevealedChange?: (revealed: boolean) => void;
  /** Whether it can be covered again once revealed. */
  rehide?: boolean;
};

/* -------------------------------------------------------------------------------------------------
 * Inline
 * -----------------------------------------------------------------------------------------------*/

export type SpoilerProps = Omit<React.ComponentProps<"span">, "children"> &
  RevealProps & {
    /** Text, with formatting if you like. Keep links and buttons out: the spoiler is itself the control. */
    children: React.ReactNode;
    /** What a screen reader hears while it's covered. */
    label?: string;
  };

/** A phrase inside running text, covered in grain until it's pressed. */
export function Spoiler({
  revealed: revealedProp,
  defaultRevealed = false,
  onRevealedChange,
  rehide = true,
  label = "Spoiler",
  children,
  className,
  onClick,
  onKeyDown,
  ...rest
}: SpoilerProps) {
  const [revealed, setRevealed] = useControllableState({ value: revealedProp, defaultValue: defaultRevealed, onChange: onRevealedChange });
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const interactive = !revealed || rehide;

  const toggle = (from?: { x: number; y: number }) => {
    const root = ref.current;
    if (!root) return;
    const words = Array.from(root.querySelectorAll<HTMLElement>("[data-spoiler-piece]"));
    if (!revealed && !reduce) {
      // The reveal travels outward from where it was pressed (the first word, from the keyboard),
      // ~1.1px per ms, capped so a long passage never makes anyone wait.
      const first = words[0]?.getBoundingClientRect();
      const o = from ?? (first ? { x: first.left, y: first.top + first.height / 2 } : { x: 0, y: 0 });
      for (const w of words) {
        const r = w.getBoundingClientRect();
        const d = Math.hypot(r.left + r.width / 2 - o.x, r.top + r.height / 2 - o.y);
        w.style.setProperty("--d", `${Math.min(320, Math.round(d / 1.1))}ms`);
      }
    } else {
      // Covering again is one quick step, no travel.
      for (const w of words) w.style.setProperty("--d", "0ms");
    }
    setRevealed(!revealed);
  };

  return (
    <span
      ref={ref}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-expanded={interactive ? revealed : undefined}
      aria-label={revealed ? undefined : label}
      data-state={revealed ? "revealed" : "hidden"}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || !interactive) return;
        // Selecting revealed text to copy it shouldn't cover it again.
        if (revealed && window.getSelection()?.toString()) return;
        toggle({ x: e.clientX, y: e.clientY });
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented || !interactive) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      }}
      className={cn(
        "group/spoiler rounded-[4px] px-[2px] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]",
        "transition-[background-color] duration-300 ease-out",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
        "data-[state=hidden]:cursor-pointer data-[state=hidden]:bg-fg/[0.07] data-[state=hidden]:hover:bg-fg/10",
        // Once revealed it keeps a faint wash, so it still reads as the thing you can cover again.
        rehide && "data-[state=revealed]:cursor-pointer data-[state=revealed]:bg-fg/[0.04]",
        className,
      )}
      {...rest}
    >
      {splitWords(children)}
    </span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Block
 * -----------------------------------------------------------------------------------------------*/

export type SpoilerBlockProps = Omit<React.ComponentProps<"div">, "children"> &
  RevealProps & {
    /** An image, a video, a card: anything that should stay covered until asked for. */
    children: React.ReactNode;
    /** The button on the cover. */
    label?: string;
    /** One line under the button saying what's hidden, e.g. "Season 2 finale". */
    description?: string;
    /** The hide button's name, once revealed. */
    hideLabel?: string;
  };

/** Media or a whole card under a blur-and-grain cover that dissolves from where it's pressed. */
export function SpoilerBlock({
  revealed: revealedProp,
  defaultRevealed = false,
  onRevealedChange,
  rehide = true,
  label = "Show spoiler",
  description,
  hideLabel = "Hide spoiler",
  children,
  className,
  ...rest
}: SpoilerBlockProps) {
  const [revealed, setRevealed] = useControllableState({ value: revealedProp, defaultValue: defaultRevealed, onChange: onRevealedChange });
  const [dissolving, setDissolving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const cover = useRef<HTMLButtonElement>(null);
  const hide = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();

  // The cover's mask: a hole that opens from the press point, with a soft, grainy edge.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const r = useMotionValue(0);
  const edge = useTransform(r, (v) => v + 56);
  const mask = useMotionTemplate`radial-gradient(circle at ${x}px ${y}px, transparent ${r}px, black ${edge}px)`;

  const show = (from: { x: number; y: number } | null) => {
    const box = root.current?.getBoundingClientRect();
    const keyboard = from === null;
    setRevealed(true);
    // Focus follows to the hide button (or the content), so it isn't dropped with the cover.
    requestAnimationFrame(() => (hide.current ?? root.current)?.focus({ preventScroll: true }));
    if (!box || reduce) return;
    const ox = keyboard ? box.width / 2 : from.x - box.left;
    const oy = keyboard ? box.height / 2 : from.y - box.top;
    x.set(ox);
    y.set(oy);
    r.set(0);
    setDissolving(true);
    // Far enough to clear the farthest corner, plus the soft edge.
    const far = Math.max(Math.hypot(ox, oy), Math.hypot(box.width - ox, oy), Math.hypot(ox, box.height - oy), Math.hypot(box.width - ox, box.height - oy)) + 56;
    animate(r, far, { duration: 0.56, ease: ease.outQuart }).then(() => setDissolving(false));
  };

  const conceal = () => {
    r.set(0);
    setDissolving(false);
    setRevealed(false);
    requestAnimationFrame(() => cover.current?.focus({ preventScroll: true }));
  };

  const covered = !revealed || dissolving;

  return (
    <div
      ref={root}
      tabIndex={-1}
      data-state={revealed ? "revealed" : "hidden"}
      className={cn("group/spoiler relative isolate overflow-hidden rounded-xl outline-none", className)}
      {...rest}
    >
      <div
        inert={!revealed}
        aria-hidden={!revealed || undefined}
        className={cn(
          "transition-[filter,scale] duration-500 ease-out-expo",
          "group-data-[state=hidden]/spoiler:scale-[1.08] group-data-[state=hidden]/spoiler:blur-xl group-data-[state=hidden]/spoiler:duration-200",
          "motion-reduce:scale-100!",
        )}
      >
        {children}
      </div>

      <AnimatePresence initial={false}>
        {covered && (
          <motion.div
            key="cover"
            className="absolute inset-0"
            style={dissolving ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: dissolving ? 0 : 0.15 } }}
            transition={{ duration: reduce ? 0.12 : 0.2, ease: ease.out }}
          >
            <div aria-hidden className="absolute inset-0 bg-frame/45" />
            <div aria-hidden style={grain} className="absolute inset-0 bg-fg/25" />
            <button
              ref={cover}
              type="button"
              disabled={revealed}
              onClick={(e) => show(e.detail === 0 ? null : { x: e.clientX, y: e.clientY })}
              className="group/cover absolute inset-0 flex cursor-pointer items-center justify-center p-4 outline-none disabled:cursor-default"
            >
              {/* One surface for the label and what's behind it, so both read on any image in either theme. */}
              <motion.span
                animate={dissolving ? { opacity: 0, scale: 0.96 } : { opacity: 1, scale: 1 }}
                transition={{ duration: dissolving ? 0.14 : 0.2, ease: ease.out }}
                className={cn(
                  "flex max-w-full flex-col items-center gap-0.5 border border-line-2 bg-raised text-fg shadow-pop",
                  description ? "rounded-xl px-3.5 py-2" : "rounded-full px-3 py-1.5",
                  "transition-[background-color,border-color,scale] duration-150 ease-out group-hover/cover:border-fg-4 group-active/cover:scale-[0.97] group-active/cover:duration-75",
                  "group-focus-visible/cover:outline-solid group-focus-visible/cover:outline-1 group-focus-visible/cover:outline-offset-2 group-focus-visible/cover:outline-fg-2",
                )}
              >
                <span className="flex items-center gap-1.5 text-[12.5px] font-medium leading-[18px]">
                  <Eye size={14} className="shrink-0 text-fg-2" />
                  {label}
                </span>
                {description && <span className="max-w-[28ch] text-center text-[11.5px] leading-4 text-fg-3 text-balance">{description}</span>}
              </motion.span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {revealed && rehide && (
        // Out of the way on a pointer until you're over the media or tabbing to it; always there on touch.
        <span className="absolute right-2 top-2 transition-opacity duration-150 pointer-fine:opacity-0 pointer-fine:group-hover/spoiler:opacity-100 pointer-fine:has-focus-visible:opacity-100">
          <motion.button
            ref={hide}
            type="button"
            aria-label={hideLabel}
            onClick={conceal}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18, ease: ease.out, delay: dissolving ? 0.3 : 0 }}
            className={cn(
              "relative grid size-7 place-items-center rounded-md border border-line-2 bg-raised/90 text-fg-2 shadow-pop outline-none",
              "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
              "transition-[background-color,color,scale] duration-150 hover:bg-raised hover:text-fg active:scale-[0.92] active:duration-75",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            )}
          >
            <EyeOff size={14} />
          </motion.button>
        </span>
      )}
    </div>
  );
}
