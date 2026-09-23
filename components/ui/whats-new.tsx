"use client";
import { Popover } from "@base-ui/react/popover";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ArrowUpRight, ChevronLeft, ChevronRight, Sparkle } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type ChangelogEntry = {
  id: string;
  title: string;
  /** An ISO date (“2026-09-18”) or a Date. */
  date: string | Date;
  /** Short kind label: “Feature”, “Improvement”, “Fix”. */
  tag?: string;
  /** An image URL, or any node (a video, an illustration). Shown 16:9. */
  image?: string | React.ReactNode;
  imageAlt?: string;
  /** One line under the title in the list. */
  summary?: string;
  /** The full entry, shown when opened. */
  body?: React.ReactNode;
  /** Link to the full post. */
  href?: string;
};

export type UseWhatsNewOptions = {
  entries: ChangelogEntry[];
  /** Ids already read (controlled). Persist it per user. */
  read?: string[];
  defaultRead?: string[];
  onReadChange?: (read: string[]) => void;
};

/** Read tracking without the popover: counts, and marking one or all as read. */
export function useWhatsNew({ entries, read, defaultRead = [], onReadChange }: UseWhatsNewOptions) {
  const [ids, setIds] = useControllableState<string[]>({ value: read, defaultValue: defaultRead, onChange: onReadChange });
  const isRead = (id: string) => ids.includes(id);
  return {
    read: ids,
    isRead,
    unread: entries.filter((e) => !ids.includes(e.id)).length,
    markRead: (id: string) => setIds((prev) => (prev.includes(id) ? prev : [...prev, id])),
    markAllRead: () => setIds((prev) => [...new Set([...prev, ...entries.map((e) => e.id)])]),
  };
}

type Ctx = ReturnType<typeof useWhatsNew> & { entries: ChangelogEntry[] };
const WhatsNewCtx = createContext<Ctx | null>(null);
const useCtx = () => {
  const ctx = useContext(WhatsNewCtx);
  if (!ctx) throw new Error("WhatsNew parts must be inside <WhatsNew>");
  return ctx;
};

export type WhatsNewProps = UseWhatsNewOptions & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

/** Holds the entries and what has been read. Put a trigger and the content inside. */
export function WhatsNew({ entries, read, defaultRead, onReadChange, open, defaultOpen, onOpenChange, children }: WhatsNewProps) {
  const state = useWhatsNew({ entries, read, defaultRead, onReadChange });
  return (
    <WhatsNewCtx.Provider value={{ ...state, entries }}>
      <Popover.Root open={open} defaultOpen={defaultOpen} onOpenChange={(next) => onOpenChange?.(next)}>
        {children}
      </Popover.Root>
    </WhatsNewCtx.Provider>
  );
}

export type WhatsNewTriggerProps = Omit<Popover.Trigger.Props, "className" | "children"> & {
  className?: string;
  label?: string;
  /** Square button with just the icon and the badge. The label becomes its name. */
  iconOnly?: boolean;
  variant?: "secondary" | "ghost";
};

/** The button with the unread badge. The count rolls down as entries are read. */
export function WhatsNewTrigger({ label = "What’s new", iconOnly = false, variant = "ghost", className, ...rest }: WhatsNewTriggerProps) {
  const { unread } = useCtx();
  const reduce = useReducedMotion();
  const name = unread ? `${label}, ${unread} unread` : label;
  return (
    <Popover.Trigger
      aria-label={iconOnly || unread ? name : undefined}
      data-variant={variant}
      className={cn(
        "relative inline-flex h-8 shrink-0 select-none items-center gap-2 rounded-lg text-[12.5px] font-medium outline-none",
        "transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.97] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        iconOnly ? "w-8 justify-center" : "pl-2 pr-2.5",
        variant === "secondary"
          ? "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover data-popup-open:border-fg-4 data-popup-open:bg-hover"
          : "text-fg-2 hover:bg-hover hover:text-fg data-popup-open:bg-hover data-popup-open:text-fg",
        className,
      )}
      {...rest}
    >
      <Sparkle className="shrink-0" />
      {!iconOnly && <span>{label}</span>}
      <AnimatePresence initial={false}>
        {unread > 0 && (
          <motion.span
            key="badge"
            aria-hidden
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, transition: { duration: 0.14 } }}
            transition={reduce ? { duration: 0.12 } : spring.pop}
            className={cn(
              "tabular grid h-4 min-w-4 place-items-center rounded-full bg-fg px-1 text-[10.5px] font-medium leading-none text-frame",
              iconOnly && "absolute -right-1 -top-1 ring-2 ring-frame",
            )}
          >
            <NumberFlow value={unread} />
          </motion.span>
        )}
      </AnimatePresence>
    </Popover.Trigger>
  );
}

export type WhatsNewContentProps = {
  title?: string;
  /** Link to the complete changelog, shown in the footer. */
  changelogHref?: string;
  changelogLabel?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  /** Portal target. Defaults to document.body. */
  container?: HTMLElement | null;
  className?: string;
};

type View = { entry: number | null; dir: 1 | -1 };

/**
 * The popover: a list of entries, each opening into a page you can step
 * through. Opening an entry marks it read.
 */
export function WhatsNewContent({
  title = "What’s new",
  changelogHref,
  changelogLabel = "Full changelog",
  side = "bottom",
  align = "end",
  container,
  className,
}: WhatsNewContentProps) {
  const { entries, unread, isRead, markRead, markAllRead } = useCtx();
  const [view, setView] = useState<View>({ entry: null, dir: 1 });
  const [instant, setInstant] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<string | null>(null);
  const reduce = useReducedMotion();

  const focusPage = useRef(false);

  const open = (index: number, dir: 1 | -1, via: "pointer" | "key" = "pointer") => {
    const entry = entries[index];
    if (!entry) return;
    // Coming from the list, or reading the page itself: follow to the new page.
    // Pressing the arrows in the header: leave focus on the arrow.
    focusPage.current = view.entry == null || !!document.activeElement?.closest("article[data-page]");
    markRead(entry.id);
    setInstant(via === "key" || !!reduce);
    setView({ entry: index, dir });
  };
  const back = () => {
    returnTo.current = view.entry != null ? (entries[view.entry]?.id ?? null) : null;
    setInstant(!!reduce);
    setView({ entry: null, dir: -1 });
  };

  // Move focus with the view, so it never falls out of the popover when the element it was on leaves.
  useEffect(() => {
    if (view.entry != null) {
      // Query rather than hold a ref: during a page turn the leaving article is still mounted.
      const id = entries[view.entry]?.id;
      if (focusPage.current && id) pagesRef.current?.querySelector<HTMLElement>(`article[data-page="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
      focusPage.current = false;
    } else if (returnTo.current) {
      listRef.current?.querySelector<HTMLElement>(`[data-entry="${CSS.escape(returnTo.current)}"]`)?.focus({ preventScroll: true });
      returnTo.current = null;
    }
  }, [view, entries]);

  // Direction and instant-ness travel through AnimatePresence's `custom`, so the
  // leaving page exits the right way even though it rendered before the change.
  const motionProps = {
    variants: pageVariants,
    initial: "enter",
    animate: "center",
    exit: "exit",
    transition: { duration: 0.26, ease: ease.out },
  } as const;

  const index = view.entry ?? 0;
  const current = view.entry != null ? entries[view.entry] : null;

  return (
    <Popover.Portal container={container ?? undefined}>
      <Popover.Positioner side={side} align={align} sideOffset={8} collisionPadding={12} className="z-(--z-popover)">
        <Popover.Popup
          initialFocus={() => listRef.current?.querySelector<HTMLElement>("[data-entry]") ?? true}
          className={cn(
            "flex w-[360px] max-w-[var(--available-width)] flex-col overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
            "origin-[var(--transform-origin)] transition-[opacity,scale,translate,filter] duration-200 ease-out-expo",
            "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-starting-style:blur-[2px]",
            "data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1",
            "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:ease-out-quart",
            "data-instant:transition-none",
            "motion-reduce:data-starting-style:translate-0 motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:blur-none motion-reduce:data-ending-style:scale-100",
            className,
          )}
          onKeyDown={(e) => {
            if (view.entry == null) return;
            if (e.key === "ArrowRight" && view.entry < entries.length - 1) {
              e.preventDefault();
              open(view.entry + 1, 1, "key");
            } else if (e.key === "ArrowLeft" && view.entry > 0) {
              e.preventDefault();
              open(view.entry - 1, -1, "key");
            } else if (e.key === "Backspace") {
              e.preventDefault();
              back();
            }
          }}
        >
          <AutoHeight instant={instant}>
            <AnimatePresence initial={false} mode="popLayout" custom={{ dir: view.dir, instant }}>
              {current && view.entry != null ? (
                <motion.div key="detail" custom={{ dir: view.dir, instant }} {...motionProps}>
                  <div className="flex h-11 items-center gap-1 border-b border-line px-1.5">
                    <button type="button" onClick={back} className={cn(ghost, "gap-1 pl-1 pr-2")}>
                      <ChevronLeft className="size-3.5" />
                      All updates
                    </button>
                    <div className="ml-auto flex items-center gap-0.5">
                      <span className="tabular px-1.5 text-[11.5px] text-fg-3">
                        {index + 1} of {entries.length}
                      </span>
                      {/* aria-disabled, not disabled: a button that disables under the pointer or focus would drop focus to the page. */}
                      <button
                        type="button"
                        aria-label="Newer update"
                        aria-disabled={index === 0 || undefined}
                        onClick={() => index > 0 && open(index - 1, -1)}
                        className={cn(ghost, "w-7 justify-center")}
                      >
                        <ChevronLeft />
                      </button>
                      <button
                        type="button"
                        aria-label="Older update"
                        aria-disabled={index === entries.length - 1 || undefined}
                        onClick={() => index < entries.length - 1 && open(index + 1, 1)}
                        className={cn(ghost, "w-7 justify-center")}
                      >
                        <ChevronRight />
                      </button>
                    </div>
                  </div>
                  {/* The header stays put; only the page under it turns. */}
                  <div ref={pagesRef} className="relative">
                    <AnimatePresence initial={false} mode="popLayout" custom={{ dir: view.dir, instant }}>
                  <motion.article
                        key={current.id}
                        data-page={current.id}
                        tabIndex={-1}
                        aria-labelledby={`wn-${current.id}`}
                        custom={{ dir: view.dir, instant }}
                        {...motionProps}
                        className="p-4 outline-none"
                      >
                    <Media entry={current} className="aspect-[16/9] rounded-lg" />
                    <Meta entry={current} className="mt-3.5" />
                    <h3 id={`wn-${current.id}`} className="mt-1 text-[15px] font-medium leading-[1.3] tracking-[-0.015em] text-fg text-balance">
                      {current.title}
                    </h3>
                    {(current.body ?? current.summary) && (
                      <div className="mt-1.5 text-[12.5px] leading-[1.55] text-fg-2 text-pretty [&_p+p]:mt-2">{current.body ?? current.summary}</div>
                    )}
                    {current.href && (
                      <a href={current.href} target="_blank" rel="noopener noreferrer" className={cn(link, "mt-3")}>
                        Read the full post
                        <ArrowUpRight className="size-3.5 transition-transform duration-150 ease-out-expo group-hover/link:-translate-y-px group-hover/link:translate-x-px" />
                      </a>
                    )}
                  </motion.article>
                    </AnimatePresence>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="list" custom={{ dir: view.dir, instant }} {...motionProps}>
                  <div className="flex h-11 items-center gap-2 border-b border-line pl-4 pr-1.5">
                    <Popover.Title className="text-[13.5px] font-medium tracking-[-0.01em] text-fg">{title}</Popover.Title>
                    <span className="tabular text-[11.5px] text-fg-3">
                      {unread ? (
                        <>
                          <NumberFlow value={unread} /> new
                        </>
                      ) : (
                        "Up to date"
                      )}
                    </span>
                    <button type="button" disabled={!unread} onClick={markAllRead} className={cn(ghost, "ml-auto px-2")}>
                      Mark all as read
                    </button>
                  </div>
                  {entries.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <p className="text-[13px] text-fg">No updates yet</p>
                      <p className="mt-1 text-[12px] text-fg-3">New features and fixes show up here.</p>
                    </div>
                  ) : (
                    <div
                      ref={listRef}
                      role="list"
                      className="max-h-[320px] overflow-y-auto overscroll-contain p-1.5"
                      onKeyDown={(e) => {
                        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
                        const rows = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-entry]")];
                        const at = rows.indexOf(document.activeElement as HTMLElement);
                        const to = rows[Math.min(Math.max(at + (e.key === "ArrowDown" ? 1 : -1), 0), rows.length - 1)];
                        if (to) {
                          e.preventDefault();
                          to.focus();
                        }
                      }}
                    >
                      {entries.map((entry, i) => {
                        const fresh = !isRead(entry.id);
                        return (
                          <div role="listitem" key={entry.id}>
                            <button
                              type="button"
                              data-entry={entry.id}
                              data-unread={fresh ? "" : undefined}
                              onClick={() => open(i, 1)}
                              className={cn(
                                "group/row flex w-full items-center gap-3 rounded-lg p-2 text-left outline-none",
                                "transition-[background-color] duration-150 hover:bg-hover focus-visible:bg-hover",
                                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
                              )}
                            >
                              <Media entry={entry} className="h-10 w-16 shrink-0 rounded-md" thumbnail />
                              <span className="min-w-0 flex-1">
                                <span className={cn("block truncate text-[13px] leading-[1.35]", fresh ? "font-medium text-fg" : "text-fg-2")}>
                                  {entry.title}
                                  {fresh && <span className="sr-only">, unread</span>}
                                </span>
                                <Meta entry={entry} className="mt-0.5 block" />
                              </span>
                              {/* The unread dot shrinks away the moment the entry is opened. */}
                              <span
                                aria-hidden
                                className={cn(
                                  "size-1.5 shrink-0 rounded-full bg-fg transition-[scale,opacity] duration-200 ease-out-expo",
                                  fresh ? "scale-100 opacity-100" : "scale-0 opacity-0",
                                )}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {changelogHref && (
                    <div className="border-t border-line px-2 py-1.5">
                      <a href={changelogHref} target="_blank" rel="noopener noreferrer" className={cn(link, "px-2")}>
                        {changelogLabel}
                        <ArrowUpRight className="size-3.5 transition-transform duration-150 ease-out-expo group-hover/link:-translate-y-px group-hover/link:translate-x-px" />
                      </a>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </AutoHeight>
          <p role="status" className="sr-only">
            {current ? `${current.title}, ${(view.entry ?? 0) + 1} of ${entries.length}` : ""}
          </p>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  );
}

type Page = { dir: 1 | -1; instant: boolean };
const pageVariants = {
  enter: ({ dir, instant }: Page) => (instant ? { opacity: 1, x: 0, filter: "blur(0px)" } : { opacity: 0, x: dir * 24, filter: "blur(2px)" }),
  center: { opacity: 1, x: 0, filter: "blur(0px)" },
  exit: ({ dir, instant }: Page) =>
    instant
      ? { opacity: 0, transition: { duration: 0 } }
      : { opacity: 0, x: dir * -24, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } },
};

const ghost = cn(
  "relative inline-flex h-7 shrink-0 items-center rounded-md text-[12px] text-fg-2 outline-none",
  "transition-[background-color,color,opacity,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.96] active:duration-75",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
  "disabled:pointer-events-none disabled:opacity-40 aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent aria-disabled:hover:text-fg-2 aria-disabled:active:scale-100",
);

const link = cn(
  "group/link inline-flex h-7 items-center gap-1 rounded-md text-[12px] text-fg-2 outline-none",
  "transition-colors duration-150 hover:text-fg",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
);

function Media({ entry, className, thumbnail }: { entry: ChangelogEntry; className?: string; thumbnail?: boolean }) {
  const [failed, setFailed] = useState(false);
  const box = cn("relative block overflow-hidden border border-line bg-hover", className);
  if (!entry.image || failed) return <span aria-hidden className={cn(box, "grid place-items-center text-fg-4")}><Sparkle className={thumbnail ? "size-3.5" : undefined} /></span>;
  if (typeof entry.image !== "string") return <span aria-hidden={thumbnail || undefined} className={box}>{entry.image}</span>;
  return (
    <span className={box}>
      {/* eslint-disable-next-line @next/next/no-img-element -- copied into any React app, not only Next */}
      <img src={entry.image} alt={thumbnail ? "" : (entry.imageAlt ?? "")} loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />
    </span>
  );
}

function Meta({ entry, className }: { entry: ChangelogEntry; className?: string }) {
  return (
    <span className={cn("text-[11.5px] text-fg-3", className)}>
      {entry.tag && (
        <>
          {entry.tag}
          <span aria-hidden className="px-1 text-fg-4">·</span>
        </>
      )}
      <time dateTime={toDate(entry.date).toISOString().slice(0, 10)}>{formatDate(entry.date)}</time>
    </span>
  );
}

function toDate(d: string | Date) {
  return typeof d === "string" ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00Z` : d) : d;
}

// Recent dates read relative (“Today”, “3 days ago”), older ones as a short date.
// Date-only strings are calendar days, so they're compared and printed in UTC.
function formatDate(d: string | Date) {
  const date = toDate(d);
  const now = new Date();
  const day = (x: Date) => Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
  const days = Math.round((day(now) - day(date)) / 86_400_000);
  if (days >= 0 && days < 7) return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-days, "day").replace(/^./, (c) => c.toUpperCase());
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: date.getUTCFullYear() === now.getUTCFullYear() ? undefined : "numeric",
    timeZone: "UTC",
  }).format(date);
}

// Eases the popover's height between the list and an entry, and between entries of different lengths.
function AutoHeight({ children, instant }: { children: React.ReactNode; instant: boolean }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize[0]?.blockSize ?? el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <motion.div
      initial={false}
      animate={{ height }}
      transition={instant ? { duration: 0 } : { duration: 0.3, ease: ease.inOut }}
      className="relative overflow-hidden"
    >
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}
