"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Children, isValidElement, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

type Status = "idle" | "loading" | "error";

export type InfiniteListProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The items loaded so far, each with a stable key. Each is wrapped in an article. */
  children: React.ReactNode;
  /** False once the last page is in. */
  hasMore: boolean;
  /** Fetch and append the next page. Return a promise; reject it to show the error row. */
  onLoadMore: () => unknown;
  /** Total number of items if known; announced as the feed's size. */
  total?: number;
  /** One placeholder row shaped like a real row. Defaults to an avatar and two lines. */
  skeleton?: React.ReactNode;
  /** How many placeholder rows show while a page loads. */
  skeletonCount?: number;
  /** Shown instead of the list when there is nothing at all. */
  empty?: React.ReactNode;
  /** The end-of-list line. Defaults to “You’ve reached the end”. */
  endMessage?: React.ReactNode;
  errorMessage?: React.ReactNode;
  /** How far below the fold to start loading the next page. */
  rootMargin?: string;
  /** Retry a failed page once, quietly, before showing the error. Most failures are blips. */
  retryOnce?: boolean;
};

export function InfiniteList({
  children,
  hasMore,
  onLoadMore,
  total,
  skeleton,
  skeletonCount = 3,
  empty,
  endMessage = "You’ve reached the end",
  errorMessage = "Couldn’t load more.",
  rootMargin = "0px 0px 240px 0px",
  retryOnce = true,
  className,
  onKeyDown,
  ...rest
}: InfiniteListProps) {
  const reduce = useReducedMotion();
  const items = Children.toArray(children);
  const count = items.length;
  const [status, setStatus] = useState<Status>("idle");
  const [active, setActive] = useState(0);
  const [freshFrom, setFreshFrom] = useState(count);
  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  const countRef = useRef(count);
  const loadRef = useRef<() => void>(() => {});
  const retryButton = useRef<HTMLButtonElement>(null);
  // Set when Try again is pressed: that button is about to disappear, so focus needs somewhere to go.
  const refocus = useRef(false);

  useEffect(() => {
    countRef.current = count;
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = async () => {
    if (busy.current) return;
    busy.current = true;
    setFreshFrom(countRef.current);
    setStatus("loading");
    let ok = false;
    for (let attempt = 0; attempt < (retryOnce ? 2 : 1) && !ok; attempt++) {
      if (attempt) await new Promise((r) => window.setTimeout(r, 1200));
      if (!alive.current) return;
      try {
        await onLoadMore();
        ok = true;
      } catch {
        ok = false;
      }
    }
    busy.current = false;
    if (alive.current) setStatus(ok ? "idle" : "error");
  };
  useEffect(() => {
    loadRef.current = load;
  });

  // Watch a sentinel just past the last row. The observer is rebuilt after
  // every page, so if the new rows still don't fill the view it fires again.
  useEffect(() => {
    const root = scroller.current;
    const target = sentinel.current;
    if (!root || !target || !hasMore || status !== "idle") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadRef.current();
    }, { root, rootMargin });
    io.observe(target);
    return () => io.disconnect();
  }, [hasMore, status, count, rootMargin]);

  useEffect(() => {
    if (!refocus.current) return;
    if (status === "error") {
      refocus.current = false;
      retryButton.current?.focus();
    } else if (status === "idle" && count > freshFrom) {
      refocus.current = false;
      scroller.current?.querySelector<HTMLElement>(`[data-index="${freshFrom}"]`)?.focus({ preventScroll: true });
    }
  }, [status, count, freshFrom]);

  // If the reader is already at the end of what's loaded, bring the skeletons
  // or the error row into view so the wait (or the failure) is never off-screen.
  useEffect(() => {
    const root = scroller.current;
    const edge = sentinel.current;
    if (status === "idle" || !root || !edge) return;
    if (edge.getBoundingClientRect().top > root.getBoundingClientRect().bottom + 16) return;
    root.scrollTo({ top: root.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [status, reduce]);

  // Feed keyboard model: Page Down / Page Up (and the arrows) move between
  // items, Home / End jump to the first and last loaded item.
  const focusItem = (i: number) => {
    const next = Math.max(0, Math.min(count - 1, i));
    setActive(next);
    const el = scroller.current?.querySelector<HTMLElement>(`[data-index="${next}"]`);
    el?.focus({ preventScroll: true });
    // On the last item of a finished list, show the end line too, not just the row.
    if (next === count - 1 && !hasMore) scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
    else el?.scrollIntoView({ block: "nearest" });
  };
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    const from = (e.target as HTMLElement).closest<HTMLElement>("[data-index]");
    if (e.defaultPrevented || !from || from !== e.target) return;
    const i = Number(from.dataset.index);
    const map: Record<string, number> = { PageDown: i + 1, ArrowDown: i + 1, j: i + 1, PageUp: i - 1, ArrowUp: i - 1, k: i - 1, Home: 0, End: count - 1 };
    if (!(e.key in map) || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    focusItem(map[e.key]);
  };

  const toTop = () => {
    scroller.current?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    setActive(0);
    scroller.current?.querySelector<HTMLElement>('[data-index="0"]')?.focus({ preventScroll: true });
  };

  const fade = { duration: reduce ? 0.12 : 0.2, ease: ease.out };
  const current = Math.min(active, Math.max(0, count - 1));

  return (
    <div
      ref={scroller}
      role="feed"
      aria-busy={status === "loading" || undefined}
      onKeyDown={handleKey}
      className={cn("relative min-h-0 overflow-y-auto overscroll-contain", className)}
      {...rest}
    >
      {count === 0 && !hasMore && status === "idle" ? (
        <div className="grid h-full min-h-40 place-items-center p-6 text-center text-[12.5px] text-fg-3">{empty ?? "Nothing here yet"}</div>
      ) : (
        <>
          {items.map((child, i) => (
            <motion.article
              key={isValidElement(child) && child.key != null ? child.key : i}
              data-index={i}
              aria-posinset={i + 1}
              aria-setsize={total ?? (hasMore ? -1 : count)}
              tabIndex={i === current ? 0 : -1}
              onFocus={() => setActive(i)}
              // Rows arriving where skeletons stood crossfade in place: no travel, so nothing looks like it moved.
              initial={i >= freshFrom ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ ...fade, delay: reduce ? 0 : Math.min(i - freshFrom, 5) * 0.02 }}
              className="rounded-lg outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3"
            >
              {child}
            </motion.article>
          ))}

          <div ref={sentinel} aria-hidden className="h-px" />

          <AnimatePresence initial={false} mode="popLayout">
            {status === "loading" && (
              <motion.div key="skeleton" aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={fade}>
                {Array.from({ length: skeletonCount }, (_, i) => (
                  <div key={i} className="animate-pulse-soft motion-reduce:animate-none" style={{ animationDelay: `${i * 160}ms` }}>
                    {skeleton ?? <SkeletonRow wide={i % 2 === 0} />}
                  </div>
                ))}
              </motion.div>
            )}

            {status === "error" && (
              <motion.div
                key="error"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={fade}
                className="flex items-center gap-3 rounded-lg px-3 py-3"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-danger-soft text-danger">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                    <path d="M8 4.75v4" />
                    <circle cx="8" cy="11.25" r=".75" fill="currentColor" stroke="none" />
                  </svg>
                </span>
                <p role="alert" className="min-w-0 flex-1 text-[12.5px] leading-[18px] text-fg-2">
                  {errorMessage}
                </p>
                <button
                  ref={retryButton}
                  type="button"
                  onClick={() => {
                    refocus.current = true;
                    load();
                  }}
                  className={cn(
                    "group/retry inline-flex h-7 shrink-0 select-none items-center gap-1.5 rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)]",
                    "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                    "transition-[background-color,border-color,scale] duration-150 ease-out hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75",
                  )}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="transition-transform duration-200 ease-out group-hover/retry:-rotate-45">
                    <path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.75V5h-2.25" />
                  </svg>
                  Try again
                </button>
              </motion.div>
            )}

            {!hasMore && status === "idle" && count > 0 && (
              <motion.div
                key="end"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={fade}
                className="flex items-center justify-between gap-3 px-3 pb-2 pt-4"
              >
                <p className="flex min-w-0 items-center gap-2 text-[12px] text-fg-3">
                  <span aria-hidden className="h-px w-4 bg-line-2" />
                  <span className="truncate">{endMessage}</span>
                </p>
                <button
                    type="button"
                    onClick={toTop}
                    className={cn(
                      "group/top inline-flex h-7 shrink-0 select-none items-center gap-1 rounded-md px-2 text-[12px] font-medium text-fg-2",
                      "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                      "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75",
                    )}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="transition-transform duration-200 ease-out group-hover/top:-translate-y-px">
                      <path d="M8 13V3M4 7l4-4 4 4" />
                    </svg>
                    Back to top
                  </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

/** The default placeholder: an avatar and two lines at the height of a two-line row. */
export function SkeletonRow({ wide = true, className }: { wide?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5", className)}>
      <span className="size-8 shrink-0 rounded-lg bg-fg/[0.07]" />
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className={cn("h-2.5 rounded-full bg-fg/[0.07]", wide ? "w-3/5" : "w-2/5")} />
        <span className={cn("h-2 rounded-full bg-fg/[0.07]", wide ? "w-1/3" : "w-1/2")} />
      </span>
      <span className="h-2.5 w-12 shrink-0 rounded-full bg-fg/[0.07]" />
    </div>
  );
}
