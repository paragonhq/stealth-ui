"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Children, isValidElement, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

type Status = "idle" | "loading" | "error";

export type LoadMoreProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The rows loaded so far, each with a stable key. Each is wrapped in an li. */
  children: React.ReactNode;
  /** False once the last page is in. The button becomes the end marker. */
  hasMore: boolean;
  /** Fetch and append the next page. Return a promise; reject it and the button offers a retry. */
  onLoadMore: () => unknown;
  /** Total number of items, when known. Adds “Showing 20 of 128” under the button. */
  total?: number;
  /** Accessible name for the list, e.g. “Activity”. */
  listLabel?: string;
  label?: string;
  loadingLabel?: string;
  retryLabel?: string;
  endLabel?: string;
  /** Shown above the button when a page fails to load. */
  errorMessage?: React.ReactNode;
  listClassName?: string;
  /** Wait this long before the spinner shows, so fast pages never flash it. */
  pendingDelay?: number;
  /** Once shown, keep the spinner at least this long so it never flickers. */
  minPending?: number;
};

export function LoadMore({
  children,
  hasMore,
  onLoadMore,
  total,
  listLabel,
  label = "Load more",
  loadingLabel = "Loading…",
  retryLabel = "Try again",
  endLabel = "All caught up",
  errorMessage = "Couldn’t load more. Check your connection and try again.",
  listClassName,
  pendingDelay = 150,
  minPending = 400,
  className,
  ...rest
}: LoadMoreProps) {
  const reduce = useReducedMotion();
  const items = Children.toArray(children);
  const count = items.length;

  const [status, setStatus] = useState<Status>("idle");
  const [spinning, setSpinning] = useState(false);
  const [announce, setAnnounce] = useState("");
  // Items at or past this index arrived by pressing the button; everything before it was already there.
  const [freshFrom, setFreshFrom] = useState(count);
  const list = useRef<HTMLUListElement>(null);
  const footer = useRef<HTMLDivElement>(null);
  const focusAt = useRef<number | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  const countRef = useRef(count);
  useEffect(() => {
    countRef.current = count;
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Once the new rows are in the DOM, move focus to the first of them. Keyboard
  // and screen-reader users land on what they asked for instead of on a button
  // that is now further down.
  useEffect(() => {
    const at = focusAt.current;
    if (at == null || count <= at) return;
    focusAt.current = null;
    const el = list.current?.children[at] as HTMLElement | undefined;
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [count, reduce]);

  // The error sits under the button so the button stays under the pointer; make sure it is in view.
  useEffect(() => {
    if (status === "error") footer.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [status, reduce]);

  const load = async () => {
    // One page at a time: a second press while loading is a double request.
    if (busy.current) return;
    busy.current = true;
    const before = countRef.current;
    setFreshFrom(before);
    setStatus("loading");
    let shownAt = 0;
    const reveal = window.setTimeout(() => {
      shownAt = performance.now();
      setSpinning(true);
    }, pendingDelay);

    let ok = true;
    try {
      await onLoadMore();
    } catch {
      ok = false;
    }
    window.clearTimeout(reveal);
    if (shownAt) {
      const rest = minPending - (performance.now() - shownAt);
      if (rest > 0) await new Promise((r) => window.setTimeout(r, rest));
    }
    busy.current = false;
    if (!alive.current) return;
    setSpinning(false);
    if (ok) {
      focusAt.current = before;
      setStatus("idle");
      const added = countRef.current - before;
      setAnnounce(added > 0 ? `Loaded ${added} more${total != null ? `. Showing ${countRef.current} of ${total}` : ""}` : "");
    } else {
      setStatus("error");
      setAnnounce(typeof errorMessage === "string" ? errorMessage : "Couldn’t load more");
    }
  };

  const shown = status === "loading" && spinning ? "loading" : status === "error" ? "error" : "idle";
  const text = { idle: label, loading: loadingLabel, error: retryLabel }[shown];
  const ended = !hasMore;

  return (
    <div className={cn("flex min-w-0 flex-col", className)} {...rest}>
      <ul ref={list} aria-label={listLabel} aria-busy={status === "loading" || undefined} className={cn("flex flex-col", listClassName)}>
        {items.map((child, i) => {
          const fresh = i >= freshFrom;
          const delay = reduce ? 0 : Math.min(i - freshFrom, 7) * 0.03;
          return (
            <motion.li
              key={isValidElement(child) && child.key != null ? child.key : i}
              tabIndex={-1}
              initial={fresh ? (reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(2px)" }) : false}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: reduce ? 0.15 : 0.32, ease: ease.out, delay: fresh ? delay : 0 }}
              className="rounded-lg outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3"
            >
              {child}
            </motion.li>
          );
        })}
      </ul>

      {/* Never the scroll anchor: new rows push it down instead of the page jumping to follow it. */}
      <div ref={footer} className="flex flex-col items-center gap-2 pt-3 [overflow-anchor:none]">
        <div className="grid w-full place-items-center">
          <AnimatePresence initial={false} mode="popLayout">
            {ended ? (
              <EndMark key="end" label={endLabel} reduce={!!reduce} />
            ) : (
              <motion.button
                key="button"
                type="button"
                onClick={load}
                data-state={shown}
                aria-busy={status === "loading" || undefined}
                exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.96, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } }}
                className={cn(
                  "relative col-start-1 row-start-1 inline-flex h-8 select-none items-center justify-center gap-2 rounded-lg border px-3 text-[12.5px] font-medium tracking-[-0.005em] shadow-[var(--shadow)]",
                  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                  "transition-[background-color,border-color,color,scale] duration-150 ease-out active:duration-75",
                  status === "loading"
                    ? "cursor-default border-line-2 bg-hover text-fg-2"
                    : shown === "error"
                      ? "border-danger/40 bg-raised text-danger hover:border-danger/60 hover:bg-danger-soft active:scale-[0.97]"
                      : "border-line-2 bg-raised text-fg hover:border-fg-4 hover:bg-hover active:scale-[0.97]",
                )}
              >
                <span className="relative grid size-4 place-items-center" aria-hidden>
                  <AnimatePresence initial={false}>
                    <motion.span
                      key={shown}
                      className="absolute inset-0 grid place-items-center"
                      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
                      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
                      // Blur tweens on its own: a spring would overshoot it below zero.
                      transition={reduce ? { duration: 0.12 } : { ...spring.pop, filter: { duration: 0.18, ease: ease.out } }}
                    >
                      {shown === "loading" ? <Spinner /> : shown === "error" ? <RetryGlyph /> : <MoreGlyph />}
                    </motion.span>
                  </AnimatePresence>
                </span>
                {/* Every label shares one cell, so the button never changes width. */}
                <span className="grid text-left">
                  {[label, loadingLabel, retryLabel].map((l) => (
                    <span key={l} aria-hidden className="invisible col-start-1 row-start-1">
                      {l}
                    </span>
                  ))}
                  <span className="col-start-1 row-start-1">{text}</span>
                </span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence initial={false}>
          {status === "error" && !ended && (
            <motion.p
              key="error"
              role="alert"
              className="max-w-[36ch] text-balance text-center text-[12px] leading-[17px] text-danger"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.2, ease: ease.out }}
            >
              {errorMessage}
            </motion.p>
          )}
        </AnimatePresence>

        {total != null && (
          <p className="text-[11.5px] tabular text-fg-3">
            {ended && count >= total ? (
              <>Showing all {total.toLocaleString("en-US")}</>
            ) : (
              <>
                Showing <NumberFlow value={count} className="text-fg-2" /> of {total.toLocaleString("en-US")}
              </>
            )}
          </p>
        )}
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
        {ended && announce ? `. ${endLabel}` : ""}
      </span>
    </div>
  );
}

// The end of the list: hairlines draw out from a tick, so it reads as a
// finish line rather than a button that went missing.
function EndMark({ label, reduce }: { label: string; reduce: boolean }) {
  const rule = (origin: "left" | "right") => (
    <motion.span
      aria-hidden
      className={cn("h-px flex-1 bg-line-2", origin === "right" ? "origin-right" : "origin-left")}
      initial={reduce ? { opacity: 0 } : { scaleX: 0, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 1 }}
      transition={{ duration: reduce ? 0.15 : 0.5, ease: ease.out, delay: reduce ? 0 : 0.12 }}
    />
  );
  return (
    <motion.div
      className="col-start-1 row-start-1 flex h-8 w-full items-center gap-3"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0.15 : 0.28, ease: ease.out, delay: reduce ? 0 : 0.06 }}
    >
      {rule("right")}
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-fg-2">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-fg-3">
          <circle cx="8" cy="8" r="5.75" />
          <motion.path
            d="m5.5 8.25 1.75 1.75 3.25-3.75"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.32, ease: ease.out, delay: 0.18 }}
          />
        </svg>
        {label}
      </span>
      {rule("left")}
    </motion.div>
  );
}

const svg = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

function Spinner() {
  return (
    <svg {...svg} className="animate-spin [animation-duration:0.8s]">
      <circle cx="8" cy="8" r="5.75" opacity="0.22" />
      <path d="M8 2.25a5.75 5.75 0 0 1 5.75 5.75" />
    </svg>
  );
}

// A chevron that nudges down on hover: more is below.
function MoreGlyph() {
  return (
    <svg {...svg} className="transition-transform duration-200 ease-out [button:hover_&]:translate-y-px">
      <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
    </svg>
  );
}

function RetryGlyph() {
  return (
    <svg {...svg}>
      <path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.75V5h-2.25" />
    </svg>
  );
}
