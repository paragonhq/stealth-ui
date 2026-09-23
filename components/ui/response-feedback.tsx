"use client";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { X } from "@/lib/icons";
import { ease, spring, stagger } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type FeedbackRating = "up" | "down" | null;
export type FeedbackDetails = { rating: "down"; reasons: string[]; comment: string };

export type ResponseFeedbackProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onSubmit"> & {
  value?: FeedbackRating;
  defaultValue?: FeedbackRating;
  /** Fires the moment a thumb is pressed or released: save the rating here. */
  onValueChange?: (value: FeedbackRating) => void;
  /** Reasons offered after a thumbs down. An empty list keeps just the comment. */
  reasons?: string[];
  /** Sends the details. Return a promise to show progress; a rejection keeps the form and says so. */
  onSubmit?: (details: FeedbackDetails) => void | Promise<void>;
  label?: string;
  disabled?: boolean;
};

type Phase = "closed" | "open" | "sending" | "sent" | "failed";

const DEFAULT_REASONS = ["Not accurate", "Didn’t follow instructions", "Out of date", "Too long", "Missing sources", "Unsafe"];

const UP =
  "M5 7.25v6H3a.75.75 0 0 1-.75-.75V8A.75.75 0 0 1 3 7.25zm0 0 2.5-4.5a1.4 1.4 0 0 1 1.9 1.3l-.4 2.2h3.3a1.25 1.25 0 0 1 1.2 1.6l-1.3 4.3a1.25 1.25 0 0 1-1.2.85H5";
const DOWN =
  "M11 8.75v-6h2a.75.75 0 0 1 .75.75V8a.75.75 0 0 1-.75.75zm0 0-2.5 4.5a1.4 1.4 0 0 1-1.9-1.3l.4-2.2H3.7a1.25 1.25 0 0 1-1.2-1.6l1.3-4.3a1.25 1.25 0 0 1 1.2-.85H11";

const noop = () => () => {};
/** ⌘ on Apple platforms, Ctrl elsewhere; ⌘ on the server so the first paint matches most readers. */
const useModKey = () => useSyncExternalStore(noop, () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"), () => "⌘");

const ring = "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3";

export function ResponseFeedback({
  value,
  defaultValue = null,
  onValueChange,
  reasons = DEFAULT_REASONS,
  onSubmit,
  label = "Was this helpful?",
  disabled = false,
  className,
  ...rest
}: ResponseFeedbackProps) {
  const reduce = !!useReducedMotion();
  const id = useId();
  const mod = useModKey();
  const [rating, setRating] = useControllableState<FeedbackRating>({ value, defaultValue, onChange: onValueChange });
  const [phase, setPhase] = useState<Phase>("closed");
  const [picked, setPicked] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const downRef = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLFormElement>(null);
  const keyboard = useRef(false);
  const focusOnOpen = useRef(false);
  const closeTimer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const open = phase !== "closed";
  const empty = picked.length === 0 && comment.trim() === "";

  const focus = (el: HTMLElement | null | undefined) => el?.focus({ preventScroll: true, focusVisible: keyboard.current } as FocusOptions);

  // The card's first reason gets focus once it exists, so the keyboard lands where the next decision is.
  useEffect(() => {
    if (phase !== "open" || !focusOnOpen.current) return;
    // One frame later, once the reason group has registered its items, so arrow keys pick up from here.
    // A render in between cancels and reschedules it; the flag only clears once it lands.
    const raf = requestAnimationFrame(() => {
      focusOnOpen.current = false;
      focus(card.current?.querySelector<HTMLElement>("[data-reason], textarea"));
    });
    return () => cancelAnimationFrame(raf);
  });

  const close = (returnFocus: boolean) => {
    window.clearTimeout(closeTimer.current);
    setPhase("closed");
    if (returnFocus) focus(downRef.current);
  };

  const rate = (next: FeedbackRating) => {
    window.clearTimeout(closeTimer.current);
    setRating(next);
    if (next === "down") {
      setPicked([]);
      setComment("");
      focusOnOpen.current = true;
      setPhase("open");
    } else setPhase("closed");
  };

  const send = async () => {
    if (empty || phase === "sending") return;
    setPhase("sending");
    const started = performance.now();
    try {
      await onSubmit?.({ rating: "down", reasons: picked, comment: comment.trim() });
      // A spinner that flashes for a frame reads as a glitch; hold it for 300ms.
      await new Promise((r) => window.setTimeout(r, Math.max(0, 300 - (performance.now() - started))));
      setPhase("sent");
      focus(downRef.current);
      closeTimer.current = window.setTimeout(() => setPhase("closed"), 2600);
    } catch {
      setPhase("failed");
    }
  };

  const status = rating === "up" ? "Thanks for letting us know" : phase === "sent" || (rating === "down" && phase === "closed") ? "Thanks, feedback noted" : label;
  const labels = [label, "Thanks for letting us know", "Thanks, feedback noted"];

  return (
    <div className={cn("flex w-full flex-col", className)} {...rest}>
      <div className="flex items-center gap-2">
        <ToggleGroup
          aria-label="Rate this response"
          value={rating ? [rating] : []}
          onValueChange={(v) => rate((v[0] as FeedbackRating) ?? null)}
          disabled={disabled}
          className="-ml-1 flex items-center gap-0.5"
        >
          <Thumb dir="up" pressed={rating === "up"} reduce={reduce} onPointerDown={() => (keyboard.current = false)} onKeyDown={() => (keyboard.current = true)} />
          <Thumb
            dir="down"
            ref={downRef}
            pressed={rating === "down"}
            reduce={reduce}
            expanded={open}
            controls={`${id}-card`}
            onPointerDown={() => (keyboard.current = false)}
            onKeyDown={() => (keyboard.current = true)}
          />
        </ToggleGroup>
        {/* Every message shares one grid cell, so the row never reflows as it changes. */}
        <span className="grid min-w-0 text-[12.5px] text-fg-3">
          {labels.map((l) => (
            <span key={l} aria-hidden className="invisible col-start-1 row-start-1 truncate">
              {l}
            </span>
          ))}
          <AnimatePresence initial={false}>
            <motion.span
              key={status}
              className="col-start-1 row-start-1 truncate"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 5, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -5, filter: "blur(2px)", transition: { duration: 0.12 } }}
              transition={{ duration: 0.22, ease: ease.out }}
            >
              {status}
            </motion.span>
          </AnimatePresence>
        </span>
        <span role="status" aria-live="polite" className="sr-only">
          {rating === "up" ? "Marked as helpful" : phase === "sent" ? "Feedback sent" : phase === "failed" ? "Couldn’t send feedback" : ""}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="card"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={
              reduce
                ? { opacity: 0, transition: { duration: 0.12 } }
                : { height: 0, opacity: 0, transition: { height: { duration: 0.22, ease: ease.inOut }, opacity: { duration: 0.12 } } }
            }
            transition={{ height: { duration: 0.3, ease: ease.out }, opacity: { duration: 0.2, ease: ease.out } }}
            // Padding inside the clip, cancelled by margin, so the card's shadow and focus rings aren't cut off.
            className="-mx-3 -mb-5 overflow-hidden px-3 pb-5"
          >
            {/* The card grows down from the row; its content settles a beat later so the height leads. */}
            <form
              ref={card}
              id={`${id}-card`}
              aria-labelledby={`${id}-title`}
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  keyboard.current = true;
                  close(true);
                }
              }}
              className="mt-2 max-w-md rounded-xl border border-line-2 bg-raised shadow-[var(--shadow)]"
            >
              <Morph reduce={reduce}>
                <AnimatePresence initial={false} mode="wait">
                  {phase === "sent" ? (
                    <motion.div
                      key="sent"
                      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, filter: "blur(2px)" }}
                      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                      transition={{ duration: 0.24, ease: ease.out }}
                      className="flex items-center gap-2.5 px-3.5 py-3"
                    >
                      <SentMark reduce={reduce} />
                      <div className="min-w-0">
                        <p id={`${id}-title`} className="text-[13px] font-medium tracking-[-0.01em] text-fg">
                          Feedback sent
                        </p>
                        <p className="text-[12px] text-fg-3">It goes to the team that tunes these answers.</p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="form"
                      initial={false}
                      exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.99, filter: "blur(2px)", transition: { duration: 0.12 } }}
                      className="p-3.5"
                      aria-busy={phase === "sending" || undefined}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p id={`${id}-title`} className="text-[13px] font-medium tracking-[-0.01em] text-fg">
                            What went wrong?
                          </p>
                          <p className="mt-0.5 text-[12px] text-fg-3">Pick any that apply.</p>
                        </div>
                        <button
                          type="button"
                          aria-label="Skip feedback"
                          onClick={(e) => {
                            keyboard.current = e.detail === 0;
                            close(true);
                          }}
                          className={cn(
                            ring,
                            "relative -mr-1.5 -mt-1.5 grid size-7 shrink-0 place-items-center rounded-md text-fg-3 transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92]",
                            "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
                          )}
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {reasons.length > 0 && (
                        <ToggleGroup
                          multiple
                          aria-label="Reasons"
                          value={picked}
                          onValueChange={(v) => setPicked(v as string[])}
                          disabled={phase === "sending"}
                          className="mt-3 flex flex-wrap gap-1.5"
                        >
                          {reasons.map((r, i) => (
                            <motion.span
                              key={r}
                              className="flex"
                              initial={reduce ? false : { opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.22, ease: ease.out, delay: 0.08 + Math.min(i, 8) * stagger.items }}
                            >
                              <Reason value={r} pressed={picked.includes(r)} reduce={reduce} />
                            </motion.span>
                          ))}
                        </ToggleGroup>
                      )}

                      <label htmlFor={`${id}-comment`} className="mt-3 block text-[12px] text-fg-2">
                        Anything else? <span className="text-fg-4">Optional</span>
                      </label>
                      <textarea
                        id={`${id}-comment`}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            void send();
                          }
                        }}
                        readOnly={phase === "sending"}
                        rows={2}
                        maxLength={1000}
                        placeholder="The date it gave for the launch was last year’s"
                        className={cn(
                          "mt-1.5 block max-h-32 min-h-[60px] w-full resize-none rounded-lg border border-line-2 bg-frame px-2.5 py-2 text-base leading-[1.45] text-fg [field-sizing:content] placeholder:text-fg-4 sm:text-[13px]",
                          "outline-none transition-[border-color,box-shadow] duration-150 focus:border-fg-4 focus:ring-3 focus:ring-fg/10",
                        )}
                      />

                      <div className="mt-3 flex items-center gap-2">
                        <span className="min-w-0 flex-1 text-[11.5px]">
                          {phase === "failed" ? (
                            <span className="text-danger">Couldn’t send. Check your connection and try again.</span>
                          ) : (
                            <span className="hidden text-fg-4 pointer-fine:inline">
                              <kbd className="font-sans">{mod}</kbd> <kbd className="font-sans">Enter</kbd> to send
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            keyboard.current = e.detail === 0;
                            close(true);
                          }}
                          className={cn(
                            ring,
                            "h-8 shrink-0 rounded-lg px-2.5 text-[12.5px] font-medium text-fg-2 transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.97]",
                          )}
                        >
                          Skip
                        </button>
                        <button
                          type="submit"
                          aria-disabled={empty || undefined}
                          data-busy={phase === "sending" ? "" : undefined}
                          className={cn(
                            ring,
                            "relative h-8 shrink-0 rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame transition-[background-color,opacity,scale] duration-150 hover:bg-fg/90 active:scale-[0.97]",
                            "aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-fg aria-disabled:active:scale-100",
                            "data-busy:pointer-events-none",
                          )}
                        >
                          {/* The spinner overlays the label, so the button keeps its width. */}
                          <span className={cn("transition-opacity duration-150", phase === "sending" && "opacity-0")}>
                            {phase === "failed" ? "Try again" : "Send feedback"}
                          </span>
                          <span
                            className={cn("absolute inset-0 grid place-items-center transition-opacity duration-150", phase === "sending" ? "opacity-100" : "opacity-0")}
                            aria-hidden
                          >
                            <svg width={14} height={14} viewBox="0 0 16 16" fill="none" className="animate-spin-slow motion-reduce:animate-none">
                              <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeOpacity={0.3} strokeWidth={1.6} />
                              <path d="M8 2.5a5.5 5.5 0 0 1 5.5 5.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
                            </svg>
                          </span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Morph>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Animates its own height to whatever its content measures, so swapping the form for the thanks glides instead of jumping. */
function Morph({ reduce, children }: { reduce: boolean; children: React.ReactNode }) {
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
    <motion.div initial={false} animate={{ height }} transition={reduce ? { duration: 0 } : { duration: 0.28, ease: ease.inOut }} className="overflow-hidden">
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

function Thumb({
  dir,
  pressed,
  reduce,
  expanded,
  controls,
  ref,
  ...rest
}: {
  dir: "up" | "down";
  pressed: boolean;
  reduce: boolean;
  expanded?: boolean;
  controls?: string;
  ref?: React.Ref<HTMLButtonElement>;
  onPointerDown?: () => void;
  onKeyDown?: () => void;
}) {
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const name = dir === "up" ? "Helpful" : "Not helpful";

  // The acknowledgement: a small nod in the thumb's own direction as it fills.
  const mounted = useRef(false);
  useEffect(() => {
    // Only a change nods; a thumb that starts pressed just sits there.
    if (!mounted.current) return void (mounted.current = true);
    if (!pressed || reduce || !scope.current) return;
    animate(scope.current, { rotate: [0, dir === "up" ? -16 : 16, 0], y: [0, dir === "up" ? -2 : 2, 0], scale: [1, 0.88, 1] }, { duration: 0.44, ease: ease.out });
  }, [pressed, reduce, dir, animate, scope]);

  return (
    <Toggle
      ref={ref}
      value={dir}
      aria-label={name}
      title={name}
      aria-expanded={dir === "down" ? !!expanded : undefined}
      aria-controls={dir === "down" && expanded ? controls : undefined}
      className={cn(
        ring,
        "relative grid size-7 place-items-center rounded-md text-fg-3 transition-[background-color,color,scale] duration-150 ease-out",
        "hover:bg-hover hover:text-fg active:scale-[0.9] active:duration-75 data-pressed:text-fg data-disabled:pointer-events-none data-disabled:opacity-50",
        "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
      )}
      {...rest}
    >
      <span ref={scope} className="grid size-4 place-items-center">
        <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <motion.path
            d={dir === "up" ? UP : DOWN}
            fill="currentColor"
            initial={false}
            animate={{ fillOpacity: pressed ? 1 : 0 }}
            transition={{ duration: pressed ? 0.2 : 0.14, ease: ease.out, delay: pressed && !reduce ? 0.08 : 0 }}
          />
        </svg>
      </span>
    </Toggle>
  );
}

function Reason({ value, pressed, reduce }: { value: string; pressed: boolean; reduce: boolean }) {
  return (
    <Toggle
      value={value}
      data-reason=""
      className={cn(
        ring,
        "relative inline-flex h-7 select-none items-center rounded-full border px-2.5 text-[12px] transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.96] active:duration-75",
        "border-line-2 text-fg-2 hover:border-fg-4 hover:text-fg data-pressed:border-fg-4 data-pressed:bg-fg/[0.07] data-pressed:text-fg data-disabled:opacity-50",
      )}
    >
      {/* The tick makes room for itself: its column grows from nothing while it draws. */}
      <span
        className={cn(
          "grid transition-[grid-template-columns] duration-200 ease-out-expo motion-reduce:transition-none",
          pressed ? "grid-cols-[1fr]" : "grid-cols-[0fr]",
        )}
      >
        <span className="overflow-hidden">
          <svg
            width={12}
            height={12}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="-ml-0.5 mr-1"
          >
            <motion.path
              d="M3.5 8.5 6.5 11.5 12.5 4.5"
              initial={false}
              animate={{ pathLength: pressed ? 1 : 0, opacity: pressed ? 1 : 0 }}
              transition={{ duration: reduce ? 0 : 0.26, ease: ease.out, delay: pressed && !reduce ? 0.06 : 0 }}
            />
          </svg>
        </span>
      </span>
      {value}
    </Toggle>
  );
}

function SentMark({ reduce }: { reduce: boolean }) {
  return (
    <motion.span
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduce ? { duration: 0.15 } : spring.pop}
      className="grid size-7 shrink-0 place-items-center rounded-full bg-success-soft text-success"
    >
      <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <motion.path
          d="M3.5 8.5 6.5 11.5 12.5 4.5"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.34, ease: ease.out, delay: 0.1 }}
        />
      </svg>
    </motion.span>
  );
}
