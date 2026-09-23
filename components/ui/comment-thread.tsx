"use client";
import { Menu } from "@base-ui/react/menu";
import { Tooltip } from "@base-ui/react/tooltip";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ArrowUp, ChevronUp, MoreH, Pencil, Trash } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

export type CommentAuthor = { id: string; name: string; avatarUrl?: string };

export type ThreadComment = {
  id: string;
  author: CommentAuthor;
  body: string;
  createdAt: Date | string | number;
  editedAt?: Date | string | number;
  /** The first comment of a thread that still has replies is kept as a tombstone instead of removed. */
  deleted?: boolean;
};

export type Thread = {
  root: ThreadComment;
  replies: ThreadComment[];
  resolved?: boolean;
  resolvedBy?: CommentAuthor;
  resolvedAt?: Date | string | number;
};

/* -------------------------------------------------------------------------------------------------
 * Time: one shared clock for every timestamp on the page, ticking every 30s while the tab is visible.
 * The server renders an absolute date; the client swaps in "4m ago" after hydration.
 * -----------------------------------------------------------------------------------------------*/

let clock = 0;
let ticker: number | undefined;
const listeners = new Set<() => void>();
const tick = () => {
  if (document.hidden) return;
  clock = Date.now();
  listeners.forEach((l) => l());
};
function subscribeClock(cb: () => void) {
  listeners.add(cb);
  if (ticker === undefined) {
    ticker = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size) {
      window.clearInterval(ticker);
      ticker = undefined;
      document.removeEventListener("visibilitychange", tick);
    }
  };
}
const readClock = () => clock || (clock = Date.now());
/** Move the shared clock to now, e.g. right after posting, so the new item reads "just now". */
function bumpClock() {
  clock = Date.now();
  listeners.forEach((l) => l());
}
/** Milliseconds since epoch on the client, 0 on the server and during hydration. */
export function useNow() {
  return useSyncExternalStore(subscribeClock, readClock, () => 0);
}

const toMs = (d: Date | string | number) => (d instanceof Date ? d.getTime() : typeof d === "number" ? d : Date.parse(d));
const shortDate = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const shortDateYear = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const fullDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const startOfDay = (ms: number) => new Date(ms).setHours(0, 0, 0, 0);

function absolute(ms: number, now: number) {
  return new Date(ms).getFullYear() === new Date(now || ms).getFullYear() ? shortDate.format(ms) : shortDateYear.format(ms);
}

/** "just now", "4m ago", "2h ago", "Yesterday", "3d ago", then "12 Sep". */
export function formatRelative(date: Date | string | number, now: number) {
  const ms = toMs(date);
  if (!now) return absolute(ms, now);
  const s = Math.max(0, (now - ms) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  const days = Math.round((startOfDay(now) - startOfDay(ms)) / 864e5);
  if (h < 24 && days === 0) return `${h}h ago`;
  if (days <= 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return absolute(ms, now);
}

function TimeAgo({ date, className }: { date: Date | string | number; className?: string }) {
  const now = useNow();
  const ms = toMs(date);
  return (
    <time dateTime={new Date(ms).toISOString()} title={fullDate.format(ms)} suppressHydrationWarning className={cn("tabular whitespace-nowrap", className)}>
      {formatRelative(ms, now)}
    </time>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Small parts
 * -----------------------------------------------------------------------------------------------*/

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

function Avatar({ author, size = 24, className }: { author: CommentAuthor; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      className={cn(
        "relative grid shrink-0 select-none place-items-center overflow-hidden rounded-full bg-hover font-medium leading-none text-fg-2",
        "shadow-[inset_0_0_0_1px_var(--line-2)]",
        className,
      )}
    >
      {author.avatarUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={author.avatarUrl} alt="" onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        // Small avatars in a stack are partly covered, so they show one letter.
        (size < 20 ? initials(author.name).slice(0, 1) : initials(author.name))
      )}
    </span>
  );
}

const iconButton = cn(
  "relative grid size-7 shrink-0 place-items-center rounded-md text-fg-3 outline-none",
  "transition-[background-color,color,scale,opacity] duration-150 ease-out-quart hover:bg-fg/[0.06] hover:text-fg active:scale-[0.92] active:duration-75",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
  "data-popup-open:bg-fg/[0.08] data-popup-open:text-fg",
  // Draws at 28px; on touch the target grows to 44px.
  "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
);

const textButton = cn(
  "relative inline-flex h-6 items-center gap-1.5 rounded-md px-1.5 -mx-1.5 text-[12px] font-medium text-fg-3 outline-none select-none",
  "transition-[background-color,color,scale] duration-150 ease-out-quart hover:bg-fg/[0.06] hover:text-fg active:scale-[0.97] active:duration-75",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
  "before:absolute before:-inset-y-2.5 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
);

const smallButton = (primary: boolean) =>
  cn(
    "inline-flex h-7 shrink-0 select-none items-center justify-center rounded-md px-2 text-[12px] font-medium outline-none",
    "transition-[background-color,border-color,color,scale,opacity] duration-150 ease-out-quart active:scale-[0.97] active:duration-75",
    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
    "disabled:pointer-events-none disabled:opacity-40",
    primary ? "bg-fg text-frame hover:bg-fg/90" : "text-fg-2 hover:bg-fg/[0.06] hover:text-fg",
  );

function Tip({ label, children }: { label: string; children: React.ReactElement<Record<string, unknown>> }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" sideOffset={6} className="z-(--z-tooltip)">
          <Tooltip.Popup
            className={cn(
              "rounded-md border border-line-2 bg-raised px-2 py-1 text-[12px] leading-4 text-fg shadow-pop",
              "origin-(--transform-origin) transition-[opacity,scale] duration-150 ease-out-expo",
              "data-starting-style:scale-96 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-100",
              "data-instant:transition-none motion-reduce:data-starting-style:scale-100",
            )}
          >
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/** The resolve toggle: an empty ring with a faint tick that fills, pops and draws its tick when resolved. */
function ResolveGlyph({ resolved, draw }: { resolved: boolean; draw: boolean }) {
  return (
    <motion.svg
      key={resolved ? "on" : "off"}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      initial={draw ? { scale: resolved ? 0.78 : 0.9 } : false}
      animate={{ scale: 1 }}
      transition={spring.pop}
    >
      <circle
        cx="8"
        cy="8"
        r="5.75"
        stroke="currentColor"
        strokeWidth={1.4}
        className={cn("transition-[fill] duration-300 ease-out-quart", resolved ? "fill-success-soft" : "fill-transparent")}
      />
      <motion.path
        d="m5.5 8.25 1.75 1.75 3.25-3.75"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={draw && resolved ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.32, ease: ease.out, delay: 0.06 }}
        className={resolved ? undefined : "opacity-50"}
      />
    </motion.svg>
  );
}

/**
 * Animates its own height to whatever its content measures, so swaps inside it
 * (an editor opening, a comment turning into "Deleted · Undo", a fold) move the
 * rows below smoothly instead of jumping. Padded by 4px so focus rings aren't clipped.
 */
function AutoHeight({ children, reduce, className }: { children: React.ReactNode; reduce: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const height = useMotionValue<number | string>("auto");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last = el.offsetHeight;
    let running: AnimationPlaybackControls | undefined;
    const ro = new ResizeObserver(() => {
      const next = el.offsetHeight;
      if (next === last) return;
      const from = last;
      last = next;
      running?.stop();
      if (reduce) return height.set("auto");
      if (height.get() === "auto") height.set(from);
      running = animate(height, next, { duration: 0.26, ease: ease.inOut, onComplete: () => height.set("auto") });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      running?.stop();
    };
  }, [height, reduce]);
  return (
    <motion.div style={{ height }} className={cn("-m-1 overflow-hidden", className)}>
      <div ref={ref} className="relative p-1">
        {children}
      </div>
    </motion.div>
  );
}

const noop = () => () => {};
const isApple = () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

// Event-time helpers. Only ever called from handlers and timers, never while rendering.
const stamp = () => Date.now();
const newId = () => `r-${stamp().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const omit = <T extends Record<string, unknown>>(obj: T, key: string) => {
  const next = { ...obj };
  delete next[key];
  return next;
};

/* -------------------------------------------------------------------------------------------------
 * CommentThread
 * -----------------------------------------------------------------------------------------------*/

export type CommentThreadProps = Omit<React.ComponentProps<"article">, "children" | "defaultValue" | "onChange"> & {
  /** The thread, controlled. Pair with onThreadChange. */
  thread?: Thread;
  /** The thread, uncontrolled. */
  defaultThread?: Thread;
  /** Every change: a reply, an edit, a delete, resolve. */
  onThreadChange?: (thread: Thread) => void;
  /** Who is looking. Their own comments get Edit and Delete, and new replies are theirs. */
  currentUser: CommentAuthor;
  /** Persist a reply. It appears at once; return a promise and a rejection marks it failed with Retry. */
  onReply?: (reply: ThreadComment) => void | Promise<unknown>;
  /** Persist an edit. A rejection restores the original and reopens the editor with the draft. */
  onEdit?: (id: string, body: string) => void | Promise<unknown>;
  /** Fires once the undo window has passed, not when Delete is pressed. */
  onDelete?: (id: string) => void;
  onResolvedChange?: (resolved: boolean) => void;
  /** Whether the replies and the reply field are showing. */
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Milliseconds a deleted comment can be restored for. Paused while the pointer or focus is on it. */
  undoTimeout?: number;
  /** No replying, editing, deleting or resolving. */
  readOnly?: boolean;
  replyPlaceholder?: string;
};

type Editing = { id: string; draft: string; error?: string } | null;
type PendingTimer = { handle?: number; left: number; at: number };
type Status = "sending" | "failed";

export function CommentThread({
  thread: threadProp,
  defaultThread,
  onThreadChange,
  currentUser,
  onReply,
  onEdit,
  onDelete,
  onResolvedChange,
  expanded: expandedProp,
  defaultExpanded = false,
  onExpandedChange,
  undoTimeout = 6000,
  readOnly = false,
  replyPlaceholder = "Reply…",
  className,
  ...rest
}: CommentThreadProps) {
  const reduce = !!useReducedMotion();
  const uid = useId();
  const [thread, setThread] = useControllableState<Thread>({
    value: threadProp,
    defaultValue: defaultThread ?? { root: { id: "empty", author: currentUser, body: "", createdAt: 0 }, replies: [] },
    onChange: onThreadChange,
  });
  const [expanded, setExpanded] = useControllableState({ value: expandedProp, defaultValue: defaultExpanded, onChange: onExpandedChange });
  const [editing, setEditing] = useState<Editing>(null);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [tombs, setTombs] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [focusReply, setFocusReply] = useState(0);
  const [focusMenu, setFocusMenu] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // The tick only draws when someone resolves it here, never on first paint.
  const [touched, setTouched] = useState(false);

  // Async work (a reply that fails later, a delete that commits after the undo window)
  // must update the latest thread, not the one captured when it started.
  const latest = useRef(thread);
  const callbacks = useRef({ onDelete, setThread });
  const timers = useRef(new Map<string, PendingTimer>());
  useEffect(() => {
    latest.current = thread;
    callbacks.current = { onDelete, setThread };
  });

  const update = (fn: (t: Thread) => Thread) => {
    const next = fn(latest.current);
    latest.current = next;
    callbacks.current.setThread(next);
  };

  const { root, replies, resolved = false } = thread;
  const lastReply = replies[replies.length - 1];
  const repliers = [...new Map(replies.map((r) => [r.author.id, r.author])).values()].slice(-3);
  const regionId = `${uid}-replies`;
  const open = expanded && !resolved;

  /* ----- resolve ----- */
  const toggleResolved = () => {
    const next = !resolved;
    setTouched(true);
    setEditing(null);
    update((t) => ({ ...t, resolved: next, resolvedBy: next ? currentUser : undefined, resolvedAt: next ? stamp() : undefined }));
    onResolvedChange?.(next);
    setAnnouncement(next ? "Thread resolved" : "Thread reopened");
  };

  /* ----- replies, optimistic ----- */
  const post = async (reply: ThreadComment) => {
    if (!onReply) return;
    setStatus((s) => ({ ...s, [reply.id]: "sending" }));
    try {
      await onReply(reply);
      setStatus((s) => omit(s, reply.id));
      setAnnouncement("Reply sent");
    } catch {
      setStatus((s) => ({ ...s, [reply.id]: "failed" }));
      setAnnouncement("Couldn’t send your reply");
    }
  };

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    const reply: ThreadComment = {
      id: newId(),
      author: currentUser,
      body,
      createdAt: stamp(),
    };
    bumpClock();
    setDraft("");
    update((t) => ({ ...t, replies: [...t.replies, reply] }));
    void post(reply);
  };

  const discard = (id: string) => {
    setStatus((s) => omit(s, id));
    update((t) => ({ ...t, replies: t.replies.filter((r) => r.id !== id) }));
  };

  /* ----- edit, optimistic with rollback ----- */
  const patch = (t: Thread, id: string, c: Partial<ThreadComment>): Thread =>
    t.root.id === id ? { ...t, root: { ...t.root, ...c } } : { ...t, replies: t.replies.map((r) => (r.id === id ? { ...r, ...c } : r)) };

  const saveEdit = async (id: string, body: string) => {
    const before = [latest.current.root, ...latest.current.replies].find((c) => c.id === id);
    if (!before) return;
    update((t) => patch(t, id, { body, editedAt: stamp() }));
    setEditing(null);
    setFocusMenu(id);
    try {
      await onEdit?.(id, body);
    } catch {
      update((t) => patch(t, id, { body: before.body, editedAt: before.editedAt }));
      setEditing({ id, draft: body, error: "Couldn’t save your edit. Try again." });
      setAnnouncement("Couldn’t save your edit");
    }
  };

  /* ----- delete, with an undo window that pauses under the pointer ----- */
  const commit = (id: string) => {
    const entry = timers.current.get(id);
    if (entry?.handle) window.clearTimeout(entry.handle);
    timers.current.delete(id);
    setTombs((t) => t.filter((x) => x !== id));
    update((t) => (t.root.id === id ? { ...t, root: { ...t.root, deleted: true, body: "" } } : { ...t, replies: t.replies.filter((r) => r.id !== id) }));
    callbacks.current.onDelete?.(id);
  };
  const arm = (id: string) => {
    const entry = timers.current.get(id);
    if (!entry || entry.handle) return;
    entry.at = stamp();
    entry.handle = window.setTimeout(() => commit(id), Math.max(0, entry.left));
  };
  const pause = (id: string) => {
    const entry = timers.current.get(id);
    if (!entry?.handle) return;
    window.clearTimeout(entry.handle);
    entry.handle = undefined;
    entry.left -= stamp() - entry.at;
  };
  const remove = (id: string) => {
    setEditing(null);
    setTombs((t) => [...t, id]);
    timers.current.set(id, { left: undoTimeout, at: stamp() });
    arm(id);
    setAnnouncement(id === root.id && replies.length === 0 ? "Thread deleted. Undo is available." : "Comment deleted. Undo is available.");
  };
  const undo = (id: string) => {
    const entry = timers.current.get(id);
    if (entry?.handle) window.clearTimeout(entry.handle);
    timers.current.delete(id);
    setTombs((t) => t.filter((x) => x !== id));
    setFocusMenu(id);
    setAnnouncement("Comment restored");
  };

  // Unmounting doesn't cancel a delete: anything still inside its undo window is committed.
  useEffect(() => {
    const pending = timers.current;
    const cbs = callbacks;
    return () => {
      for (const [id, entry] of pending) {
        if (entry.handle) window.clearTimeout(entry.handle);
        cbs.current.onDelete?.(id);
      }
      pending.clear();
    };
  }, []);

  const openReply = () => {
    setExpanded(true);
    setFocusReply((n) => n + 1);
  };

  const actions: RowActions = {
    focused: () => setFocusMenu(null),
    edit: (c) => setEditing({ id: c.id, draft: c.body }),
    draft: (d) => setEditing((e) => (e ? { ...e, draft: d, error: undefined } : e)),
    cancel: (c) => {
      setEditing(null);
      setFocusMenu(c.id);
    },
    save: (c, body) => void saveEdit(c.id, body),
    remove: (c) => remove(c.id),
    retry: (c) => void post(c),
    discard: (c) => discard(c.id),
  };
  const rowProps = (c: ThreadComment) => ({
    comment: c,
    own: !readOnly && c.author.id === currentUser.id && !c.deleted,
    status: status[c.id],
    editing: editing?.id === c.id ? editing : null,
    reduce,
    focusMenu: focusMenu === c.id,
  });

  // A first comment deleted with nothing under it takes the thread with it.
  if (root.deleted && replies.length === 0) return null;

  const swap = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.985 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, transition: { duration: 0.1 } },
    transition: { duration: 0.2, ease: ease.out },
  };

  return (
    <article
      aria-label={`Thread by ${root.author.name}`}
      data-state={resolved ? "resolved" : open ? "open" : "closed"}
      className={cn("relative grid w-full min-w-0 grid-cols-[24px_minmax(0,1fr)] gap-x-2.5 text-[13px] [--thread-bg:var(--raised)]", className)}
      {...rest}
    >
      {/* The spine joins the first avatar to the replies while they're showing. */}
      <span aria-hidden className="pointer-events-none relative col-start-1 row-span-3 row-start-1">
        <motion.span
          initial={false}
          animate={{ scaleY: open ? 1 : 0, opacity: open ? 1 : 0 }}
          transition={reduce ? { duration: 0.12 } : { duration: 0.28, ease: ease.inOut }}
          className={cn("absolute left-1/2 top-8 w-px -translate-x-1/2 origin-top bg-line-2", readOnly ? "bottom-6" : "bottom-11")}
        />
      </span>

      <AutoHeight reduce={reduce} className="col-span-2 col-start-1 row-start-1">
        <AnimatePresence initial={false} mode="popLayout">
          {tombs.includes(root.id) ? (
            <Tombstone
              key="tomb"
              label={replies.length ? "Comment deleted" : "Thread deleted"}
              onUndo={() => undo(root.id)}
              onPause={() => pause(root.id)}
              onResume={() => arm(root.id)}
              {...swap}
            />
          ) : (
            <motion.div key="root" className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-2.5" {...swap}>
              <CommentRow
                {...rowProps(root)}
                actions={actions}
                root
                resolved={resolved}
                resolveSlot={
                  !readOnly && !root.deleted ? (
                    <Tip label={resolved ? "Reopen thread" : "Resolve thread"}>
                      <button
                        type="button"
                        aria-pressed={resolved}
                        aria-label={resolved ? "Reopen thread" : "Resolve thread"}
                        onClick={toggleResolved}
                        className={cn(iconButton, resolved && "text-success hover:text-success")}
                      >
                        <ResolveGlyph resolved={resolved} draw={touched && !reduce} />
                      </button>
                    </Tip>
                  ) : resolved ? (
                    <span role="img" aria-label="Resolved" className="grid size-7 place-items-center text-success">
                      <ResolveGlyph resolved draw={false} />
                    </span>
                  ) : null
                }
              />
            </motion.div>
          )}
        </AnimatePresence>
      </AutoHeight>

      {/* Under the first comment: who replied and when, or who resolved it. */}
      <div className="col-start-2 row-start-2 min-w-0">
        <AnimatePresence initial={false} mode="popLayout">
          {resolved ? (
            <motion.p
              key="resolved"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.22, ease: ease.out, delay: reduce ? 0 : 0.14 }}
              className="mt-1 flex h-6 min-w-0 items-center gap-1.5 text-[12px] text-fg-3"
            >
              {replies.length > 0 && (
                <>
                  <span className="shrink-0 tabular">
                    {replies.length} {replies.length === 1 ? "reply" : "replies"}
                  </span>
                  <span aria-hidden className="text-fg-4">
                    ·
                  </span>
                </>
              )}
              <span className="truncate">Resolved by {thread.resolvedBy?.id === currentUser.id ? "you" : (thread.resolvedBy?.name ?? "a teammate")}</span>
              {thread.resolvedAt != null && (
                <>
                  <span aria-hidden className="text-fg-4">
                    ·
                  </span>
                  <TimeAgo date={thread.resolvedAt} className="shrink-0" />
                </>
              )}
            </motion.p>
          ) : (
            (replies.length > 0 || (!readOnly && !expanded)) && (
              <motion.div
                key="footer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.18 }}
                className="mt-1 flex h-6 items-center gap-3"
              >
                {replies.length > 0 && (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={regionId}
                    onClick={() => setExpanded(!expanded)}
                    className={cn(textButton, "group/toggle")}
                  >
                    <AnimatePresence initial={false} mode="popLayout">
                      {expanded ? (
                        <motion.span
                          key="hide"
                          className="flex items-center gap-1"
                          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
                          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)", transition: { duration: 0.1 } }}
                          transition={{ duration: 0.18, ease: ease.out }}
                        >
                          <ChevronUp size={14} />
                          Hide replies
                        </motion.span>
                      ) : (
                        <motion.span
                          key="show"
                          className="flex items-center gap-2"
                          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)" }}
                          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)", transition: { duration: 0.1 } }}
                          transition={{ duration: 0.18, ease: ease.out }}
                        >
                          <span className="flex -space-x-1">
                            {repliers.map((a) => (
                              <Avatar key={a.id} author={a} size={18} className="shadow-[0_0_0_2px_var(--thread-bg),inset_0_0_0_1px_var(--line-2)]" />
                            ))}
                          </span>
                          <span className="inline-flex items-center gap-[0.25em] whitespace-nowrap text-fg-2 transition-colors duration-150 group-hover/toggle:text-fg">
                            <NumberFlow value={replies.length} className="tabular" animated={!reduce} />
                            {replies.length === 1 ? "reply" : "replies"}
                          </span>
                          {lastReply && (
                            <span className="hidden whitespace-nowrap font-normal text-fg-3 min-[420px]:inline">
                              Last <TimeAgo date={lastReply.createdAt} />
                            </span>
                          )}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                )}
                {!readOnly && !expanded && (
                  <button type="button" onClick={openReply} className={textButton}>
                    Reply
                  </button>
                )}
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>

      {/* Replies and the reply field fold open under the first comment. */}
      <div id={regionId} className="col-start-2 row-start-3 min-w-0">
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="region"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0, transition: reduce ? { duration: 0.1 } : { height: { duration: 0.22, ease: ease.inOut }, opacity: { duration: 0.12 } } }}
              transition={reduce ? { duration: 0.12, height: { duration: 0 } } : { height: { duration: 0.28, ease: ease.inOut }, opacity: { duration: 0.2, delay: 0.04 } }}
              className="-mx-1 overflow-hidden px-1"
            >
              <ul aria-label="Replies" className="flex flex-col pt-1.5">
                <AnimatePresence initial={false}>
                  {replies.map((r) => (
                    <motion.li
                      key={r.id}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={reduce ? { duration: 0.12, height: { duration: 0 } } : { height: { duration: 0.24, ease: ease.inOut }, opacity: { duration: 0.16 } }}
                      className="-mx-1 overflow-hidden px-1"
                    >
                      <AutoHeight reduce={reduce}>
                        <AnimatePresence initial={false} mode="popLayout">
                          {tombs.includes(r.id) ? (
                            <Tombstone
                              key="tomb"
                              label="Reply deleted"
                              className="my-1"
                              onUndo={() => undo(r.id)}
                              onPause={() => pause(r.id)}
                              onResume={() => arm(r.id)}
                              {...swap}
                            />
                          ) : (
                            <motion.div
                              key="row"
                              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, transition: { duration: 0.1 } }}
                              transition={reduce ? { duration: 0.12 } : spring.soft}
                              className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-2 py-1.5"
                            >
                              <CommentRow {...rowProps(r)} actions={actions} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </AutoHeight>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>

              {!readOnly && (
                <ReplyField
                  author={currentUser}
                  value={draft}
                  onValueChange={setDraft}
                  onSend={send}
                  placeholder={replyPlaceholder}
                  focusSignal={focusReply}
                  onEscape={() => {
                    if (replies.length === 0 && !draft) setExpanded(false);
                  }}
                  reduce={reduce}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </article>
  );
}

/* -------------------------------------------------------------------------------------------------
 * One comment: header, body (or the editor), and its menu
 * -----------------------------------------------------------------------------------------------*/

type RowActions = {
  focused: () => void;
  edit: (c: ThreadComment) => void;
  draft: (draft: string) => void;
  cancel: (c: ThreadComment) => void;
  save: (c: ThreadComment, body: string) => void;
  remove: (c: ThreadComment) => void;
  retry: (c: ThreadComment) => void;
  discard: (c: ThreadComment) => void;
};

type RowProps = {
  comment: ThreadComment;
  own: boolean;
  status?: Status;
  editing: Editing;
  reduce: boolean;
  root?: boolean;
  resolved?: boolean;
  resolveSlot?: React.ReactNode;
  focusMenu: boolean;
  actions: RowActions;
};

function CommentRow({
  comment: c,
  own,
  status,
  editing,
  reduce,
  root = false,
  resolved = false,
  resolveSlot,
  focusMenu,
  actions,
}: RowProps) {
  const menuRef = useRef<HTMLButtonElement>(null);

  // After an edit, a cancel or an undo, focus lands back on this comment's menu.
  useEffect(() => {
    if (!focusMenu) return;
    menuRef.current?.focus({ preventScroll: true });
    actions.focused();
  }, [focusMenu, actions]);

  return (
    <>
      <Avatar author={c.author} size={root ? 24 : 20} className={cn(!root && "mt-px", c.deleted && "opacity-50")} />
      <div className="group/comment min-w-0">
        <div className={cn("relative flex min-w-0 items-center gap-1.5", root ? "h-6" : "h-[22px]")}>
          <span className={cn("min-w-0 truncate font-medium tracking-[-0.005em]", c.deleted ? "text-fg-3" : "text-fg")}>{c.author.name}</span>
          <span className="grid shrink-0 text-[12px] text-fg-3">
            <TimeAgo date={c.createdAt} className={cn("col-start-1 row-start-1 transition-opacity duration-200", status === "sending" && "opacity-0 delay-300")} />
            {/* "Sending…" only shows if it takes long enough to notice; a fast send never flashes it. */}
            {status === "sending" && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: 0.3 }}
                className="col-start-1 row-start-1 whitespace-nowrap"
              >
                Sending…
              </motion.span>
            )}
          </span>
          {c.editedAt != null && !c.deleted && (
            <span className="shrink-0 text-[12px] text-fg-4" title={`Edited ${fullDate.format(toMs(c.editedAt))}`} suppressHydrationWarning>
              (edited)
            </span>
          )}

          <div
            className={cn(
              // Floats over the end of the header instead of reserving width, so names don't truncate early.
              "absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-0.5 pl-5",
              "bg-[linear-gradient(to_right,transparent,var(--thread-bg)_16px)]",
              // With a pointer, the actions wait for hover or focus. The resolved tick and an open menu stay.
              "transition-opacity duration-150 pointer-fine:opacity-0",
              "pointer-fine:group-hover/comment:opacity-100 pointer-fine:group-focus-within/comment:opacity-100",
              "pointer-fine:has-[[aria-pressed=true]]:opacity-100 pointer-fine:has-data-popup-open:opacity-100",
            )}
          >
            {resolveSlot}
            {own && !status && !editing && (
              <Menu.Root>
                <Menu.Trigger ref={menuRef} aria-label={`Actions for ${c.author.name}’s comment`} className={iconButton}>
                  <MoreH />
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner side="bottom" align="end" sideOffset={4} collisionPadding={8} className="z-(--z-dropdown)">
                    <Menu.Popup
                      className={cn(
                        "min-w-36 rounded-xl border border-line-2 bg-raised p-1 text-fg shadow-pop outline-none",
                        "origin-(--transform-origin) transition-[opacity,scale,translate] duration-160 ease-out-expo",
                        "data-starting-style:-translate-y-1 data-starting-style:scale-96 data-starting-style:opacity-0",
                        "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-100",
                        "data-instant:transition-none motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:scale-100",
                      )}
                    >
                      <Menu.Item onClick={() => actions.edit(c)} className={menuItem}>
                        <Pencil />
                        Edit
                      </Menu.Item>
                      <Menu.Separator className="mx-2 my-1 h-px bg-line" />
                      <Menu.Item onClick={() => actions.remove(c)} className={cn(menuItem, "text-danger data-highlighted:bg-danger-soft [&_svg]:text-danger")}>
                        <Trash />
                        Delete
                      </Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            )}
          </div>
        </div>

        {editing ? (
          <EditField
            value={editing.draft}
            original={c.body}
            error={editing.error}
            onChange={actions.draft}
            onCancel={() => actions.cancel(c)}
            onSave={(body) => actions.save(c, body)}
            reduce={reduce}
          />
        ) : c.deleted ? (
          <p className="mt-0.5 text-[13px] leading-5 text-fg-3">This comment was deleted.</p>
        ) : (
          <p
            className={cn(
              "mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-5 transition-[color,opacity] duration-200",
              // A resolved thread folds its first comment to one line; AutoHeight animates the fold.
              root && resolved ? "line-clamp-1 text-fg-3" : "text-fg",
              status === "sending" && "opacity-60 delay-300",
            )}
          >
            {c.body}
          </p>
        )}

        {status === "failed" && (
          <div role="alert" className="mt-1 flex h-6 items-center gap-3 text-[12px]">
            <span className="text-danger">Couldn’t send.</span>
            <button type="button" onClick={() => actions.retry(c)} className={cn(textButton, "text-fg-2")}>
              Retry
            </button>
            <button type="button" onClick={() => actions.discard(c)} className={textButton}>
              Discard
            </button>
          </div>
        )}
      </div>
    </>
  );
}

const menuItem = cn(
  "flex h-8 cursor-default select-none items-center gap-2.5 rounded-lg px-2 text-[13px] text-fg outline-none pointer-coarse:h-10",
  "transition-colors duration-75 data-highlighted:bg-fg/[0.06] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-3",
);

/* -------------------------------------------------------------------------------------------------
 * Inline editor
 * -----------------------------------------------------------------------------------------------*/

function EditField({
  value,
  original,
  error,
  onChange,
  onCancel,
  onSave,
  reduce,
}: {
  value: string;
  original: string;
  error?: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSave: (v: string) => void;
  reduce: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const errorId = useId();
  const apple = useSyncExternalStore(noop, isApple, () => true);
  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && trimmed !== original.trim();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  return (
    <motion.div initial={reduce ? { opacity: 0 } : { opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16, ease: ease.out }} className="mt-1">
      <textarea
        ref={ref}
        value={value}
        aria-label="Edit comment"
        aria-invalid={!!error || undefined}
        aria-describedby={error ? errorId : undefined}
        rows={1}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (canSave) onSave(trimmed);
          }
        }}
        className={cn(
          "block max-h-48 min-h-9 w-full resize-none rounded-lg border border-line-2 bg-frame px-2.5 py-1.5 text-base leading-5 text-fg outline-none field-sizing-content sm:text-[13px]",
          "transition-[border-color,box-shadow] duration-150 focus:border-fg-4 focus:ring-3 focus:ring-fg/8",
          error && "border-danger/60 focus:border-danger/70",
        )}
      />
      {error && (
        <p id={errorId} className="mt-1 text-[12px] text-danger">
          {error}
        </p>
      )}
      <div className="mt-1.5 flex items-center justify-end gap-1">
        <span className="mr-auto hidden text-[11px] text-fg-4 pointer-fine:inline" suppressHydrationWarning>
          Esc to cancel · {apple ? "⌘↵" : "Ctrl+Enter"} to save
        </span>
        <button type="button" onClick={onCancel} className={smallButton(false)}>
          Cancel
        </button>
        <button type="button" disabled={!canSave} onClick={() => onSave(trimmed)} className={smallButton(true)}>
          Save
        </button>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Deleted, with undo
 * -----------------------------------------------------------------------------------------------*/

type TombstoneProps = React.ComponentProps<typeof motion.div> & {
  label: string;
  onUndo: () => void;
  onPause: () => void;
  onResume: () => void;
};

function Tombstone({ label, onUndo, onPause, onResume, className, ...rest }: TombstoneProps) {
  const undoRef = useRef<HTMLButtonElement>(null);
  // The menu that deleted it is gone, so focus comes here instead of falling to the page.
  useEffect(() => {
    undoRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <motion.div
      onPointerEnter={onPause}
      onPointerLeave={onResume}
      onFocus={onPause}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onResume();
      }}
      className={cn("flex h-8 min-w-0 items-center gap-2 rounded-lg border border-dashed border-line-2 pl-2.5 pr-1 text-[12.5px] text-fg-3", className)}
      {...rest}
    >
      <Trash size={14} className="shrink-0 text-fg-4" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <button ref={undoRef} type="button" onClick={onUndo} className={cn(smallButton(false), "h-6 text-fg")}>
        Undo
      </button>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Reply field
 * -----------------------------------------------------------------------------------------------*/

function ReplyField({
  author,
  value,
  onValueChange,
  onSend,
  onEscape,
  placeholder,
  focusSignal,
  reduce,
}: {
  author: CommentAuthor;
  value: string;
  onValueChange: (v: string) => void;
  onSend: () => void;
  onEscape: () => void;
  placeholder: string;
  focusSignal: number;
  reduce: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [sent, setSent] = useState(0);
  const empty = value.trim().length === 0;

  useEffect(() => {
    if (focusSignal) ref.current?.focus();
  }, [focusSignal]);

  const submit = () => {
    if (empty) return;
    setSent((n) => n + 1);
    onSend();
  };

  return (
    <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-2 pb-1 pt-1.5">
      <Avatar author={author} size={20} className="mt-[5px]" />
      <div
        className={cn(
          "flex min-w-0 items-end gap-1 rounded-lg border border-line-2 bg-frame py-[3px] pl-2.5 pr-[3px]",
          "transition-[border-color,box-shadow] duration-150 hover:border-fg-4 focus-within:border-fg-4 focus-within:ring-3 focus-within:ring-fg/8",
        )}
      >
        <textarea
          ref={ref}
          rows={1}
          value={value}
          placeholder={placeholder}
          aria-label="Reply"
          enterKeyHint="send"
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") onEscape();
          }}
          className="max-h-40 min-h-6 flex-1 resize-none self-center bg-transparent py-0.5 text-base leading-5 text-fg outline-none field-sizing-content placeholder:text-fg-4 sm:text-[13px]"
        />
        <button
          type="button"
          aria-label="Send reply"
          aria-keyshortcuts="Enter"
          disabled={empty}
          onClick={submit}
          className={cn(
            "relative grid size-6 shrink-0 place-items-center rounded-md outline-none",
            "before:absolute before:-inset-2.5 before:content-[''] pointer-fine:before:hidden",
            "transition-[background-color,color,scale] duration-150 ease-out-quart active:scale-[0.9] active:duration-75",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
            empty ? "bg-fg/8 text-fg-4" : "bg-fg text-frame hover:bg-fg/90",
          )}
        >
          {/* On send the arrow leaves upward and a fresh one rises into its place. */}
          <span className="grid size-full place-items-center overflow-hidden rounded-[inherit]">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={sent}
              className="grid place-items-center"
              initial={reduce ? { opacity: 0 } : { y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { y: -14, opacity: 0, transition: { duration: 0.16, ease: ease.in } }}
              transition={reduce ? { duration: 0.1 } : { ...spring.snappy, delay: 0.08 }}
            >
              <ArrowUp size={14} />
            </motion.span>
          </AnimatePresence>
          </span>
        </button>
      </div>
    </div>
  );
}
