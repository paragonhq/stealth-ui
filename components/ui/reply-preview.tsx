"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { File as FileIcon, Image as ImageIcon, Mic, X } from "@/lib/icons";
import { ease } from "@/lib/motion";

export type ReplyTarget = {
  /** The original message's id. It should match data-message-id on the element that renders it. */
  id: string;
  author: string;
  /** The original text. Long text is truncated in place, never cut in the data. */
  text?: string;
  /** What the original was, when it wasn't just text. */
  kind?: "text" | "voice" | "image" | "file";
  /** Voice length, or a file name, shown after the kind: "Voice message · 0:14". */
  detail?: string;
  /** A small preview for images. */
  thumbnail?: string;
  /** The original is gone. The quote stays, says so, and stops being a link. */
  deleted?: boolean;
};

const kindLabel = { voice: "Voice message", image: "Photo", file: "File", text: "" } as const;

function Summary({ target }: { target: ReplyTarget }) {
  if (target.deleted) return <span className="italic">Original message was deleted</span>;
  const kind = target.kind ?? "text";
  if (kind === "text") return <>{target.text}</>;
  const Icon = kind === "voice" ? Mic : kind === "image" ? ImageIcon : FileIcon;
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1 align-bottom">
      <Icon size={12} className="shrink-0 opacity-80" />
      <span className="truncate">{target.text || [kindLabel[kind], target.detail].filter(Boolean).join(" · ")}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * jumpToMessage: scroll to the original, flash it, and move focus there
 * -----------------------------------------------------------------------------------------------*/

export type JumpOptions = {
  /** Where to look for [data-message-id]. Defaults to the document. */
  root?: ParentNode | null;
  /** Skip the smooth scroll and the pulse. Defaults to the user's reduced-motion setting. */
  reduce?: boolean;
  /** Move focus to the original so keyboard and screen reader users land on it. Default true. */
  focus?: boolean;
};

function scrollParent(el: HTMLElement) {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}

const reducedNow = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Finds the original by id, brings it to the middle of its scroller, and flashes it. Returns false if it isn't rendered. */
export function jumpToMessage(id: string, { root, reduce = reducedNow(), focus = true }: JumpOptions = {}) {
  const scope = root ?? (typeof document !== "undefined" ? document : null);
  const el = scope?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(id)}"]`);
  if (!el) return false;

  // Scroll only the conversation, not the page around it: center the original in its own scroller.
  const scroller = scrollParent(el);
  let visible: boolean;
  if (scroller) {
    const box = scroller.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    visible = rect.top >= box.top && rect.bottom <= box.bottom;
    const top = scroller.scrollTop + (rect.top - box.top) - (box.height - rect.height) / 2;
    scroller.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
  } else {
    const rect = el.getBoundingClientRect();
    visible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }
  if (focus) {
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  }

  // Flash once the scroll has (nearly) settled, so the eye arrives before the highlight fades.
  const flash = () => {
    el.animate(
      [{ backgroundColor: "color-mix(in oklab, var(--fg) 11%, transparent)" }, { backgroundColor: "color-mix(in oklab, var(--fg) 11%, transparent)", offset: 0.25 }, { backgroundColor: "transparent" }],
      { duration: 1400, easing: "cubic-bezier(0.25, 1, 0.5, 1)" },
    );
    const bubble = el.querySelector<HTMLElement>("[data-bubble]");
    if (bubble && !reduce) bubble.animate([{ scale: "1" }, { scale: "1.035" }, { scale: "1" }], { duration: 380, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
  };
  if (reduce || visible) flash();
  else window.setTimeout(flash, 320);
  return true;
}

/* -------------------------------------------------------------------------------------------------
 * ReplyPreview: the bar above the composer
 * -----------------------------------------------------------------------------------------------*/

export type ReplyPreviewProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The message being replied to, or null for none. Changing it swaps the contents in place. */
  target: ReplyTarget | null;
  onCancel: () => void;
  /** Pressing the quote. Defaults to jumping to the original in the page. */
  onJump?: (id: string) => void;
  /** Words before the author. */
  label?: string;
  /** Escape anywhere in the surrounding form cancels the reply. On by default. */
  escapeToCancel?: boolean;
};

/**
 * The message you're answering, slid up above the text you're writing. Pressing it takes you
 * to the original; the cross or Escape drops it and hands focus back to the field.
 */
export function ReplyPreview({ target, onCancel, onJump, label = "Replying to", escapeToCancel = true, className, ...rest }: ReplyPreviewProps) {
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  // Cancelling removes the button that had focus; the field it belongs to takes it instead.
  const cancel = () => {
    const field = ref.current?.closest("form")?.querySelector<HTMLElement>("textarea, input:not([type=hidden]):not([type=file])");
    field?.focus({ preventScroll: true });
    onCancelRef.current();
  };

  const open = !!target;
  useEffect(() => {
    if (!open || !escapeToCancel) return;
    const scope = ref.current?.closest("form") ?? ref.current?.parentElement;
    if (!scope) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      onCancelRef.current();
    };
    scope.addEventListener("keydown", onKey);
    return () => scope.removeEventListener("keydown", onKey);
  }, [open, escapeToCancel]);

  return (
    <div ref={ref} className={cn("min-w-0", className)} {...rest}>
      <AnimatePresence initial={false}>
        {target && (
          <motion.div
            key="reply"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0, transition: { height: { duration: reduce ? 0 : 0.18, ease: ease.inOut }, opacity: { duration: 0.1 } } }}
            transition={reduce ? { duration: 0.15, height: { duration: 0 } } : { height: { duration: 0.24, ease: ease.out }, opacity: { duration: 0.18 } }}
            className="overflow-hidden"
          >
            <motion.div
              initial={reduce ? false : { y: 10, filter: "blur(2px)" }}
              animate={{ y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.28, ease: ease.out }}
              className="flex items-stretch gap-1 pb-0.5 pl-3 pr-1.5 pt-1.5"
            >
              <AnimatePresence initial={false} mode="popLayout">
                <motion.button
                  key={target.id}
                  type="button"
                  disabled={target.deleted}
                  onClick={() => (onJump ? onJump(target.id) : jumpToMessage(target.id))}
                  aria-label={`${label} ${target.author}: ${target.deleted ? "original message was deleted" : target.text || kindLabel[target.kind ?? "text"]}. Show original`}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)", transition: { duration: 0.12 } }}
                  transition={{ duration: 0.2, ease: ease.out }}
                  className={cn(
                    "group/quote relative flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 pl-2.5 pr-2 text-left outline-none",
                    "transition-[background-color] duration-150 hover:bg-hover disabled:hover:bg-transparent",
                    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-4",
                  )}
                >
                  <span aria-hidden className="absolute bottom-1.5 left-0 top-1.5 w-[2px] rounded-full bg-fg-3 transition-colors duration-150 group-hover/quote:bg-fg-2" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[11.5px] leading-4 text-fg-3">
                      {label} <span className="font-medium text-fg">{target.author}</span>
                    </span>
                    <span className="truncate text-[12.5px] leading-[18px] text-fg-2">
                      <Summary target={target} />
                    </span>
                  </span>
                  {target.thumbnail && !target.deleted && (
                    // eslint-disable-next-line @next/next/no-img-element -- a 32px preview of the quoted image
                    <img src={target.thumbnail} alt="" className="size-8 shrink-0 rounded-md border border-line object-cover" />
                  )}
                </motion.button>
              </AnimatePresence>
              <button
                type="button"
                aria-label="Cancel reply"
                aria-keyshortcuts={escapeToCancel ? "Escape" : undefined}
                onClick={cancel}
                className={cn(
                  "relative grid size-7 shrink-0 self-center place-items-center rounded-full text-fg-3 outline-none",
                  "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.9] active:duration-75",
                  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                  "before:absolute before:-inset-2 before:rounded-full before:content-[''] pointer-fine:before:hidden",
                )}
              >
                <X size={14} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <span role="status" aria-live="polite" className="sr-only">
        {target ? `${label} ${target.author}` : ""}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * ReplyQuote: the quote inside a reply's bubble
 * -----------------------------------------------------------------------------------------------*/

export type ReplyQuoteProps = Omit<React.ComponentProps<"button">, "children" | "onClick"> & {
  target: ReplyTarget;
  /** Pressing the quote. Defaults to jumping to the original in the page. */
  onJump?: (id: string) => void;
  /** Lines of text before it's cut. */
  lines?: 1 | 2;
};

/**
 * A quote that sits inside any bubble. It takes its color from the text around it, so it reads
 * on a filled bubble and a quiet one alike, and it takes you to the original when pressed.
 */
export function ReplyQuote({ target, onJump, lines = 2, className, ...rest }: ReplyQuoteProps) {
  return (
    <button
      type="button"
      disabled={target.deleted}
      onClick={() => (onJump ? onJump(target.id) : jumpToMessage(target.id))}
      aria-label={`Reply to ${target.author}: ${target.deleted ? "original message was deleted" : target.text || kindLabel[target.kind ?? "text"]}. Show original`}
      data-deleted={target.deleted || undefined}
      className={cn(
        "group/quote relative flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg bg-current/[0.07] py-1.5 pl-3 pr-2 text-left outline-none",
        "transition-[background-color,scale] duration-150 ease-out hover:bg-current/[0.12] active:scale-[0.985] active:duration-75",
        "disabled:cursor-default disabled:hover:bg-current/[0.07] disabled:active:scale-100",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-current/50",
        className,
      )}
      {...rest}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-current opacity-35 transition-opacity duration-150 group-hover/quote:opacity-60" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[11.5px] font-medium leading-4">{target.author}</span>
        <span className={cn("text-[12px] leading-4 opacity-70", lines === 1 ? "truncate" : "line-clamp-2 break-words")}>
          <Summary target={target} />
        </span>
      </span>
      {target.thumbnail && !target.deleted && (
        // eslint-disable-next-line @next/next/no-img-element -- a small preview of the quoted image
        <img src={target.thumbnail} alt="" className="size-8 shrink-0 rounded-md object-cover" />
      )}
    </button>
  );
}
