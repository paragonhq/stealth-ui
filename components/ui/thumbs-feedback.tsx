"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Plus } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { ChoiceChip, ChoiceChips } from "@/components/ui/choice-chips";

type Vote = "up" | "down";
type Phase = "ask" | "sending" | "error" | "thanks";

export type Feedback = { vote: Vote; reasons: string[]; comment: string };

export type ThumbsFeedbackProps = Omit<React.ComponentProps<"div">, "onSubmit" | "children"> & {
  /** The question beside the thumbs. Pass null for thumbs only (under a chat message, say). */
  question?: string | null;
  /** Chips offered after a thumbs down. An empty array skips straight to the comment. */
  reasons?: string[];
  reasonsLabel?: string;
  /** Offer an optional comment after a thumbs down. */
  allowComment?: boolean;
  commentPlaceholder?: string;
  thanksLabel?: string;
  /** Called with the vote (and, for a thumbs down, reasons and comment). Return a promise to show sending and failure. */
  onSubmit?: (feedback: Feedback) => void | Promise<void>;
  /** Show an Undo button with the thanks. */
  undoable?: boolean;
  onUndo?: () => void;
  size?: "sm" | "md";
};

const MAX_COMMENT = 500;

// Measures its content and springs its height, so the panel opens and the swap to thanks never jumps.
function AutoHeight({ children, reduce }: { children: React.ReactNode; reduce: boolean }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <motion.div initial={false} animate={{ height }} transition={reduce ? { duration: 0 } : { duration: 0.32, ease: ease.out }} className="-m-2 overflow-hidden">
      {/* The padding gives focus rings and touch targets room inside the clip; the margin cancels it. */}
      <div ref={inner} className="flow-root p-2">
        {children}
      </div>
    </motion.div>
  );
}

function Thumb({ dir, filled, size }: { dir: Vote; filled: boolean; size: number }) {
  const up = "M5 7.25v6H3a.75.75 0 0 1-.75-.75V8A.75.75 0 0 1 3 7.25zm0 0 2.5-4.5a1.4 1.4 0 0 1 1.9 1.3l-.4 2.2h3.3a1.25 1.25 0 0 1 1.2 1.6l-1.3 4.3a1.25 1.25 0 0 1-1.2.85H5";
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={dir === "down" ? { transform: "rotate(180deg)" } : undefined}>
      {/* Filling keeps the same stroke, so the chosen thumb gains weight without changing shape. */}
      <path d={up} fill={filled ? "currentColor" : "none"} />
    </svg>
  );
}

export function ThumbsFeedback({
  question = "Was this helpful?",
  reasons = ["Inaccurate", "Out of date", "Hard to follow", "Missing an example"],
  reasonsLabel = "What went wrong?",
  allowComment = true,
  commentPlaceholder = "Tell us more (optional)",
  thanksLabel = "Thanks for the feedback",
  onSubmit,
  undoable = true,
  onUndo,
  size = "md",
  className,
  ...rest
}: ThumbsFeedbackProps) {
  const [vote, setVote] = useState<Vote | null>(null);
  const [phase, setPhase] = useState<Phase>("ask");
  const [picked, setPicked] = useState<string[]>([]);
  const [commenting, setCommenting] = useState(false);
  const [comment, setComment] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const thanksRef = useRef<HTMLDivElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  const reduce = !!useReducedMotion();
  const panelId = useId();
  const questionId = useId();
  const icon = size === "sm" ? 14 : 16;
  const open = vote === "down" && phase !== "thanks";

  const send = async (feedback: Feedback) => {
    setPhase("sending");
    // Cleared first so a second failure in a row is announced again.
    setAnnouncement("");
    try {
      await onSubmit?.(feedback);
      setPhase("thanks");
      setAnnouncement(thanksLabel);
      requestAnimationFrame(() => thanksRef.current?.focus());
    } catch {
      setPhase("error");
      setAnnouncement("Couldn't send your feedback");
    }
  };

  const choose = (v: Vote) => {
    if (phase === "sending") return;
    if (v === vote && v === "down") {
      // Pressing thumbs down again takes the vote back.
      setVote(null);
      setPhase("ask");
      return;
    }
    setVote(v);
    setPhase("ask");
    if (v === "up") send({ vote: "up", reasons: [], comment: "" });
    else if (!reasons.length && allowComment) setCommenting(true);
  };

  const reset = () => {
    setVote(null);
    setPhase("ask");
    setPicked([]);
    setComment("");
    setCommenting(false);
    setAnnouncement("Feedback removed");
    onUndo?.();
    requestAnimationFrame(() => downRef.current?.parentElement?.querySelector<HTMLElement>("[data-thumb]")?.focus());
  };

  const thumbButton = (v: Vote) => {
    const chosen = vote === v;
    const dim = vote !== null && !chosen;
    return (
      <button
        ref={v === "down" ? downRef : undefined}
        type="button"
        data-thumb={v}
        aria-pressed={chosen}
        aria-label={v === "up" ? "Helpful" : "Not helpful"}
        aria-expanded={v === "down" ? open : undefined}
        aria-controls={v === "down" && open ? panelId : undefined}
        // aria-disabled rather than disabled, so a focused thumb keeps focus while sending.
        aria-disabled={phase === "sending" || undefined}
        onClick={() => choose(v)}
        data-state={chosen ? "on" : dim ? "dim" : "off"}
        className={cn(
          "relative grid shrink-0 place-items-center rounded-lg text-fg-3",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[background-color,color,opacity,scale] duration-200 ease-out hover:bg-hover hover:text-fg active:scale-[0.9] active:duration-75",
          "data-[state=on]:text-fg data-[state=dim]:opacity-40 data-[state=dim]:hover:opacity-100",
          "aria-disabled:pointer-events-none",
          "after:absolute after:-inset-1.5 after:content-['']",
          size === "sm" ? "size-7" : "size-8",
        )}
      >
        <span className="relative grid place-items-center" style={{ width: icon, height: icon }}>
          <AnimatePresence initial={false}>
            <motion.span
              key={chosen ? "on" : "off"}
              className="absolute inset-0 grid place-items-center"
              initial={reduce ? { opacity: 0 } : chosen ? { opacity: 0, scale: 0.4, rotate: v === "up" ? -18 : 18 } : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, transition: { duration: 0.1 } }}
              transition={reduce ? { duration: 0.15 } : chosen ? spring.bouncy : spring.pop}
            >
              <Thumb dir={v} filled={chosen} size={icon} />
            </motion.span>
          </AnimatePresence>
        </span>
      </button>
    );
  };

  const canSend = picked.length > 0 || comment.trim().length > 0;

  return (
    <div
      className={cn("w-full", className)}
      {...rest}
      onKeyDown={(e) => {
        rest.onKeyDown?.(e);
        // Escape anywhere in the component (the thumb included) takes the thumbs down back.
        if (e.key === "Escape" && open && phase !== "sending" && !e.defaultPrevented) {
          e.stopPropagation();
          setVote(null);
          setPhase("ask");
          downRef.current?.focus();
        }
      }}
    >
      <AutoHeight reduce={reduce}>
        <AnimatePresence mode="popLayout" initial={false}>
          {phase === "thanks" ? (
            <motion.div
              key="thanks"
              ref={thanksRef}
              tabIndex={-1}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.28, ease: ease.out }}
              className={cn("flex w-fit max-w-full items-center gap-2 rounded-lg pr-1 outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3", size === "sm" ? "h-7" : "h-8")}
            >
              <svg width={icon} height={icon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-success">
                <motion.circle cx="8" cy="8" r="5.75" initial={reduce ? false : { pathLength: 0, rotate: -90 }} animate={{ pathLength: 1, rotate: 0 }} transition={{ duration: 0.4, ease: ease.out }} style={{ originX: "50%", originY: "50%" }} />
                <motion.path d="m5.5 8.25 1.75 1.75 3.25-3.75" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.26, ease: ease.out, delay: 0.24 }} />
              </svg>
              <span className={cn("min-w-0 truncate text-fg-2", size === "sm" ? "text-[12px]" : "text-[12.5px]")}>{thanksLabel}</span>
              {undoable && (
                <button
                  type="button"
                  onClick={reset}
                  className={cn(
                    "relative ml-1 shrink-0 rounded-md px-1.5 py-0.5 text-fg-3 underline decoration-fg-4 underline-offset-[3px]",
                    "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
                    "transition-[color,text-decoration-color] hover:text-fg hover:decoration-fg-3",
                    "after:absolute after:-inset-y-2.5 after:inset-x-0 after:content-['']",
                    size === "sm" ? "text-[12px]" : "text-[12.5px]",
                  )}
                >
                  Undo
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div key="ask" exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)", transition: { duration: 0.12 } }}>
              <div role="group" aria-labelledby={question ? questionId : undefined} aria-label={question ? undefined : "Rate this response"} className={cn("flex items-center gap-1", !question && "-ml-1.5")}>
                {question && (
                  <span id={questionId} className={cn("mr-2 min-w-0 truncate text-fg-2", size === "sm" ? "text-[12px]" : "text-[12.5px]")}>
                    {question}
                  </span>
                )}
                {thumbButton("up")}
                {thumbButton("down")}
                {vote === "up" && phase === "sending" && <Spinner className="ml-1.5" />}
                {vote === "up" && phase === "error" && (
                  <span className="ml-2 flex min-w-0 items-center gap-1.5 text-[12px] text-danger">
                    <span className="truncate">Couldn’t send.</span>
                    <button type="button" onClick={() => send({ vote: "up", reasons: [], comment: "" })} className="shrink-0 rounded underline underline-offset-[3px] outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3">
                      Try again
                    </button>
                  </span>
                )}
              </div>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    key="panel"
                    id={panelId}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    transition={{ duration: 0.26, ease: ease.out, delay: reduce ? 0 : 0.06 }}
                    className="flex flex-col gap-3 pt-3"
                  >
                    {reasons.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span id={`${panelId}-reasons`} className="text-[12px] text-fg-3">
                          {reasonsLabel}
                        </span>
                        <ChoiceChips aria-labelledby={`${panelId}-reasons`} size="sm" clearable={false} value={picked} onValueChange={setPicked}>
                          {reasons.map((r) => (
                            <ChoiceChip key={r} value={r}>
                              {r}
                            </ChoiceChip>
                          ))}
                        </ChoiceChips>
                      </div>
                    )}

                    {allowComment &&
                      (commenting ? (
                        <motion.div initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: ease.out }} className="relative">
                          <textarea
                            autoFocus
                            value={comment}
                            maxLength={MAX_COMMENT}
                            onChange={(e) => setComment(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSend) send({ vote: "down", reasons: picked, comment: comment.trim() });
                            }}
                            rows={3}
                            aria-label="Comment"
                            placeholder={commentPlaceholder}
                            className={cn(
                              "block w-full resize-none rounded-lg border border-line-2 bg-raised px-2.5 py-2 text-base leading-[1.45] text-fg outline-none sm:text-[13px]",
                              "placeholder:text-fg-4 transition-[border-color,box-shadow] duration-150 focus:border-fg-4 focus:ring-2 focus:ring-fg/10",
                            )}
                          />
                          {comment.length > MAX_COMMENT - 80 && (
                            <span className="tabular pointer-events-none absolute bottom-1.5 right-2.5 text-2xs text-fg-3">
                              {comment.length}/{MAX_COMMENT}
                            </span>
                          )}
                        </motion.div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCommenting(true)}
                          className={cn(
                            "-ml-1.5 flex h-7 items-center gap-1.5 self-start rounded-md px-1.5 text-[12px] text-fg-3",
                            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
                            "transition-[background-color,color] hover:bg-hover hover:text-fg-2 active:scale-[0.97]",
                          )}
                        >
                          <Plus size={12} />
                          Add a comment
                        </button>
                      ))}

                    <div className="flex items-center justify-end gap-2">
                      {phase === "error" && (
                        <span className="mr-auto min-w-0 truncate text-[12px] text-danger">
                          Couldn’t send. Check your connection.
                        </span>
                      )}
                      <button
                        type="button"
                        aria-disabled={phase === "sending" || undefined}
                        onClick={() => phase !== "sending" && send({ vote: "down", reasons: [], comment: "" })}
                        className={cn(
                          "h-7 shrink-0 rounded-md px-2 text-[12px] font-medium text-fg-3",
                          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                          "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75 aria-disabled:pointer-events-none aria-disabled:opacity-50",
                        )}
                      >
                        Skip
                      </button>
                      <button
                        type="button"
                        disabled={!canSend}
                        aria-busy={phase === "sending" || undefined}
                        onClick={() => phase !== "sending" && send({ vote: "down", reasons: picked, comment: comment.trim() })}
                        className={cn(
                          "relative grid h-7 shrink-0 place-items-center rounded-md bg-fg px-2.5 text-[12px] font-medium text-frame",
                          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                          "transition-[background-color,opacity,scale] duration-150 hover:bg-fg/90 active:scale-[0.97] active:duration-75",
                          "disabled:pointer-events-none disabled:opacity-40",
                        )}
                      >
                        {/* Both labels share a cell and the spinner overlays, so the button never changes width. */}
                        <span className={cn("col-start-1 row-start-1 transition-opacity", phase === "sending" && "opacity-0")}>
                          {phase === "error" ? "Try again" : "Send feedback"}
                        </span>
                        <span aria-hidden className="invisible col-start-1 row-start-1">
                          Send feedback
                        </span>
                        {phase === "sending" && <Spinner className="col-start-1 row-start-1" />}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </AutoHeight>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden className={cn("animate-spin motion-reduce:animate-[spin_1.6s_linear_infinite]", className)}>
      <path d="M8 2.25a5.75 5.75 0 1 0 5.75 5.75" />
    </svg>
  );
}
