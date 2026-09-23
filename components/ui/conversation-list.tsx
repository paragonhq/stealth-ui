"use client";
import { Avatar } from "@base-ui/react/avatar";
import { ContextMenu } from "@base-ui/react/context-menu";
import { Tooltip } from "@base-ui/react/tooltip";
import NumberFlow from "@number-flow/react";
import {
  AnimatePresence,
  LayoutGroup,
  animate,
  motion,
  useDragControls,
  useIsPresent,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * Data
 * -----------------------------------------------------------------------------------------------*/

export type Conversation = {
  id: string;
  /** The person or the group. Never truncated before the preview is. */
  name: string;
  /** Image URL. Initials on a neutral tile stand in until it loads, or when it fails. */
  avatar?: string;
  /** Draws a presence dot cut into the avatar. */
  online?: boolean;
  /** The last message, as plain text. */
  preview?: string;
  /** Who sent the last message: "You", or a name in a group. Shown as a prefix. */
  sender?: string;
  /** A Date or timestamp is formatted relative to now and kept fresh. A string is shown as is. */
  time?: Date | number | string;
  /** Unread messages. Rolls when it changes; 99+ past 99. */
  unread?: number;
  /** Marked unread by hand: a dot instead of a count. */
  markedUnread?: boolean;
  /** Someone mentioned you: an @ sits beside the count. */
  mention?: boolean;
  /** Replaces the preview while someone types. A string names who ("Priya"), for groups. */
  typing?: boolean | string;
  /** Your unsent text. Shown in place of the preview, marked as a draft. */
  draft?: string;
  pinned?: boolean;
  muted?: boolean;
};

const isUnread = (c: Conversation) => (c.unread ?? 0) > 0 || !!c.markedUnread;

/* -------------------------------------------------------------------------------------------------
 * Time
 * -----------------------------------------------------------------------------------------------*/

// One shared clock for every list on the page, ticking every 30s so "Now" becomes "9:41"
// on its own. The server has no idea what "now" is for the reader, so it renders times
// only after hydration (strings are shown straight away).
let clockNow = 0;
let clockTimer: number | undefined;
const clockListeners = new Set<() => void>();
function subscribeClock(cb: () => void) {
  clockListeners.add(cb);
  if (clockTimer === undefined) {
    clockTimer = window.setInterval(() => {
      clockNow = Date.now();
      clockListeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    clockListeners.delete(cb);
    if (!clockListeners.size) {
      window.clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
}
const readClock = () => clockNow || (clockNow = Date.now());
const readServerClock = () => 0;

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Inbox-style time: Now, 9:41, Yesterday, Mon, 12 Sep, 12 Sep 2025. */
export function formatConversationTime(date: Date, now: number | Date = Date.now(), locale?: string) {
  const n = new Date(now);
  if (Math.abs(n.getTime() - date.getTime()) < 60_000) return capitalize(new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(0, "second"));
  const days = Math.round((dayStart(n) - dayStart(date)) / 86_400_000);
  if (days <= 0) return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date);
  if (days === 1) return capitalize(new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-1, "day"));
  if (days < 7) return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  if (date.getFullYear() === n.getFullYear()) return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date);
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

/* -------------------------------------------------------------------------------------------------
 * Icons (same 16px grid and 1.4 stroke as the shared set)
 * -----------------------------------------------------------------------------------------------*/

const svg = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: false };

function ArchiveIcon() {
  return (
    <svg {...svg}>
      <rect x="2.25" y="3" width="11.5" height="3" rx=".75" />
      <path d="M3.25 6v6.25c0 .4.35.75.75.75h8c.4 0 .75-.35.75-.75V6M6.5 8.75h3" />
    </svg>
  );
}
function PinIcon({ off }: { off?: boolean }) {
  return (
    <svg {...svg}>
      <path d="M6 2.75h4M6.75 2.75v3.5L4.5 8.75v1h7v-1L9.25 6.25v-3.5M8 9.75v3.5" />
      {off && <path d="m2.75 2.75 10.5 10.5" />}
    </svg>
  );
}
function BellOffIcon({ off = true }: { off?: boolean }) {
  return (
    <svg {...svg}>
      <path d="M4 11V7a4 4 0 0 1 8 0v4l1.25 1.25H2.75zM6.5 13.75a1.6 1.6 0 0 0 3 0" />
      {off && <path d="m2.5 2.5 11 11" />}
    </svg>
  );
}
function UnreadIcon({ read }: { read: boolean }) {
  return read ? (
    <svg {...svg}>
      <path d="M2.75 4.25c0-.8.7-1.5 1.5-1.5h7.5c.8 0 1.5.7 1.5 1.5v5.5c0 .8-.7 1.5-1.5 1.5H7.5L4.75 13.5v-2.25h-.5c-.8 0-1.5-.7-1.5-1.5z" />
      <path d="m5.75 7 1.5 1.5 3-3" />
    </svg>
  ) : (
    <svg {...svg}>
      <path d="M9.25 2.75h-5c-.8 0-1.5.7-1.5 1.5v5.5c0 .8.7 1.5 1.5 1.5h.5v2.25l2.75-2.25h4.25c.8 0 1.5-.7 1.5-1.5v-3" />
      <circle cx="12.25" cy="3.75" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Actions
 * -----------------------------------------------------------------------------------------------*/

type ActionKey = "read" | "pin" | "mute" | "archive";
type Action = { key: ActionKey; label: string; short: string; shortcut: string; icon: React.ReactNode; run: () => void };

type Handlers = {
  onArchive?: (id: string) => void;
  onPinnedChange?: (id: string, pinned: boolean) => void;
  onReadChange?: (id: string, read: boolean) => void;
  onMutedChange?: (id: string, muted: boolean) => void;
};

function actionsFor(c: Conversation, h: Handlers): Partial<Record<ActionKey, Action>> {
  const unread = isUnread(c);
  return {
    read: h.onReadChange && {
      key: "read",
      label: unread ? "Mark as read" : "Mark as unread",
      short: unread ? "Read" : "Unread",
      shortcut: "U",
      icon: <UnreadIcon read={unread} />,
      run: () => h.onReadChange?.(c.id, unread),
    },
    pin: h.onPinnedChange && {
      key: "pin",
      label: c.pinned ? "Unpin" : "Pin",
      short: c.pinned ? "Unpin" : "Pin",
      shortcut: "P",
      icon: <PinIcon off={c.pinned} />,
      run: () => h.onPinnedChange?.(c.id, !c.pinned),
    },
    mute: h.onMutedChange && {
      key: "mute",
      label: c.muted ? "Unmute" : "Mute",
      short: c.muted ? "Unmute" : "Mute",
      shortcut: "M",
      icon: <BellOffIcon off={!c.muted} />,
      run: () => h.onMutedChange?.(c.id, !c.muted),
    },
    archive: h.onArchive && { key: "archive", label: "Archive", short: "Archive", shortcut: "E", icon: <ArchiveIcon />, run: () => h.onArchive?.(c.id) },
  };
}

const SHORTCUTS: Record<string, ActionKey> = { u: "read", p: "pin", m: "mute", e: "archive" };

/* -------------------------------------------------------------------------------------------------
 * ConversationList
 * -----------------------------------------------------------------------------------------------*/

export type ConversationListProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> &
  Handlers & {
    conversations: Conversation[];
    /** The open conversation's id. */
    value?: string | null;
    defaultValue?: string | null;
    onValueChange?: (id: string) => void;
    /** Shows skeleton rows shaped like the real ones. */
    loading?: boolean;
    /** Shown when there are no conversations and nothing is loading. */
    empty?: React.ReactNode;
    /** Section titles and the list's accessible name. */
    labels?: { list?: string; pinned?: string; all?: string };
    /** Replace the default time format. Receives the date and the current time. */
    formatTime?: (date: Date, now: number) => string;
  };

/**
 * An inbox of chats. Rows spring into their new place when a message arrives or a chat is
 * pinned, one highlight glides after the pointer, previews swap to a typing line, counts
 * roll, and every hover action has a swipe, a shortcut and a context-menu equivalent.
 */
export function ConversationList({
  conversations,
  value: valueProp,
  defaultValue = null,
  onValueChange,
  onArchive,
  onPinnedChange,
  onReadChange,
  onMutedChange,
  loading = false,
  empty,
  labels,
  formatTime = formatConversationTime,
  className,
  ...rest
}: ConversationListProps) {
  const reduce = !!useReducedMotion();
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const now = useSyncExternalStore(subscribeClock, readClock, readServerClock);
  const [value, setValue] = useControllableState<string | null>({ value: valueProp, defaultValue, onChange: (id) => id && onValueChange?.(id) });
  const [active, setActive] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ top: number; height: number } | null>(null);
  const refocus = useRef<string | null>(null);

  const handlers: Handlers = { onArchive, onPinnedChange, onReadChange, onMutedChange };
  const pinned = conversations.filter((c) => c.pinned);
  const others = conversations.filter((c) => !c.pinned);
  const ids = useMemo(() => new Set(conversations.map((c) => c.id)), [conversations]);

  // Rows that just arrived fade in; rows that only moved (pinned, bumped) glide instead.
  const idKey = conversations.map((c) => c.id).join("\u0000");
  const [known, setKnown] = useState(() => ({ key: idKey, ids, fresh: new Set<string>() }));
  if (known.key !== idKey) setKnown({ key: idKey, ids, fresh: new Set([...ids].filter((id) => !known.ids.has(id))) });

  // One tab stop for the whole list: the row last focused, else the open one, else the first.
  const tabbable = (active && ids.has(active) && active) || (value && ids.has(value) && value) || [...pinned, ...others][0]?.id;

  // A row that moved between sections is a new element: put focus back on it.
  useEffect(() => {
    const id = refocus.current;
    if (!id) return;
    refocus.current = null;
    root.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"]:not([data-exiting]) [data-row-main]`)?.focus({ preventScroll: false });
  }, [conversations]);

  const mains = () => Array.from(root.current?.querySelectorAll<HTMLElement>("[data-row]:not([data-exiting]) [data-row-main]") ?? []);

  const run = (c: Conversation, key: ActionKey, from: HTMLElement | null) => {
    const action = actionsFor(c, handlers)[key];
    if (!action) return;
    if (from) {
      if (key === "archive") {
        // Hand focus to the neighbour before the row leaves, so it never falls to the page.
        const list = mains();
        const i = list.findIndex((el) => el.closest("[data-row]") === from.closest("[data-row]"));
        (list[i + 1] ?? list[i - 1])?.focus();
      } else if (key === "pin") refocus.current = c.id;
    }
    setOpenId(null);
    action.run();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const row = target.closest<HTMLElement>("[data-row]");
    if (!row || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const list = mains();
    const main = row.querySelector<HTMLElement>("[data-row-main]");
    const i = list.indexOf(main!);
    const acts = Array.from(row.querySelectorAll<HTMLElement>("[data-row-action]"));
    const a = acts.indexOf(target);
    // A key the list uses is consumed here, so page-level single-key shortcuts don't also fire.
    const consume = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    const move = (el?: HTMLElement | null) => {
      if (!el) return;
      consume();
      el.focus();
    };
    switch (e.key) {
      case "ArrowDown":
      case "j":
        return move(list[i + 1]);
      case "ArrowUp":
      case "k":
        return move(list[i - 1]);
      case "Home":
        return move(list[0]);
      case "End":
        return move(list[list.length - 1]);
      case "ArrowRight":
        return move(a < 0 ? acts[0] : acts[a + 1]);
      case "ArrowLeft":
        return a >= 0 ? move(a === 0 ? main : acts[a - 1]) : undefined;
      case "Escape":
        return a >= 0 ? move(main) : undefined;
    }
    const key = SHORTCUTS[e.key.toLowerCase()];
    if (key && !e.shiftKey) {
      const c = conversations.find((x) => x.id === row.dataset.row);
      if (c && actionsFor(c, handlers)[key]) {
        consume();
        run(c, key, main);
      }
    }
  };

  // The hover highlight is one element for the whole list, measured against the row under
  // the pointer and sprung there, so it reads as one thing gliding rather than rows blinking.
  const track = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const row = (e.target as HTMLElement).closest<HTMLElement>("[data-row-surface]");
    const box = root.current?.getBoundingClientRect();
    if (!row || !box) return setHover(null);
    const r = row.getBoundingClientRect();
    const top = r.top - box.top;
    if (!hover || hover.top !== top || hover.height !== r.height) setHover({ top, height: r.height });
  };

  const renderRows = (items: Conversation[]) => (
    <AnimatePresence mode="popLayout" initial={false} custom={ids}>
      {items.map((c) => (
        <Row
          key={c.id}
          c={c}
          reduce={reduce}
          fresh={known.fresh.has(c.id)}
          now={now}
          formatTime={formatTime}
          selected={value === c.id}
          tabbable={tabbable === c.id}
          open={openId === c.id}
          actions={actionsFor(c, handlers)}
          onOpenChange={(open) => setOpenId(open ? c.id : null)}
          onSelect={() => {
            setOpenId(null);
            setValue(c.id);
          }}
          onFocusRow={() => setActive(c.id)}
          onRun={(key, from) => run(c, key, from)}
        />
      ))}
    </AnimatePresence>
  );

  const header = (id: string, text: string) => (
    <motion.div
      key={id}
      id={`${uid}-${id}`}
      layout={reduce ? false : "position"}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
      transition={{ duration: 0.2, ease: ease.out, layout: reduce ? { duration: 0 } : spring.soft }}
      className="px-3 pb-1.5 pt-3 font-mono text-2xs uppercase tracking-[0.08em] text-fg-3 first:pt-1"
    >
      {text}
    </motion.div>
  );

  let body: React.ReactNode;
  if (loading && !conversations.length) {
    body = (
      <div aria-busy="true" className="flex flex-col gap-0.5">
        <span className="sr-only" role="status">Loading conversations</span>
        {[62, 44, 70, 52, 38].map((w, i) => (
          <div key={i} aria-hidden className="flex h-[60px] items-center gap-3 px-3">
            <div className="size-10 shrink-0 animate-pulse-soft rounded-full bg-fg/[0.07]" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-center justify-between gap-6">
                <div className="h-2.5 animate-pulse-soft rounded-full bg-fg/[0.08]" style={{ width: `${w - 18}%` }} />
                <div className="h-2 w-8 animate-pulse-soft rounded-full bg-fg/[0.06]" />
              </div>
              <div className="h-2 animate-pulse-soft rounded-full bg-fg/[0.06]" style={{ width: `${w + 16}%` }} />
            </div>
          </div>
        ))}
      </div>
    );
  } else if (!conversations.length) {
    body = empty ?? (
      <div className="flex flex-col items-center gap-1 px-6 py-12 text-center">
        <p className="text-[13px] font-medium text-fg">No conversations yet</p>
        <p className="text-[12.5px] text-fg-3">New messages will show up here.</p>
      </div>
    );
  } else {
    body = (
      <LayoutGroup id={uid}>
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 rounded-lg bg-fg/[0.035]"
          initial={false}
          animate={hover ? { opacity: 1, y: hover.top, height: hover.height } : { opacity: 0 }}
          transition={reduce ? { duration: 0 } : { ...spring.follow, opacity: { duration: hover ? 0.12 : 0.15 } }}
        />
        <AnimatePresence initial={false}>
          {pinned.length > 0 && others.length > 0 && header("pinned", labels?.pinned ?? "Pinned")}
        </AnimatePresence>
        {pinned.length > 0 && (
          <ul aria-labelledby={others.length ? `${uid}-pinned` : undefined} aria-label={others.length ? undefined : labels?.pinned ?? "Pinned"} className="relative flex flex-col gap-0.5">
            {renderRows(pinned)}
          </ul>
        )}
        <AnimatePresence initial={false}>{pinned.length > 0 && others.length > 0 && header("all", labels?.all ?? "Messages")}</AnimatePresence>
        {others.length > 0 && (
          <ul aria-labelledby={pinned.length ? `${uid}-all` : undefined} aria-label={pinned.length ? undefined : labels?.all ?? "Messages"} className="relative flex flex-col gap-0.5">
            {renderRows(others)}
          </ul>
        )}
      </LayoutGroup>
    );
  }

  return (
    <Tooltip.Provider delay={500} closeDelay={0}>
      <div
        ref={root}
        role="group"
        aria-label={labels?.list ?? "Conversations"}
        data-loading={loading || undefined}
        onKeyDown={onKeyDown}
        onPointerMove={track}
        onPointerLeave={() => setHover(null)}
        onPointerDownCapture={(e) => {
          // Touching anywhere else closes a row that was swiped open.
          if (openId && !(e.target as HTMLElement).closest(`[data-row="${CSS.escape(openId)}"]`)) setOpenId(null);
        }}
        className={cn("relative isolate flex flex-col", className)}
        {...rest}
      >
        {body}
      </div>
    </Tooltip.Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Row
 * -----------------------------------------------------------------------------------------------*/

const SWIPE_W = 72;

type RowProps = {
  c: Conversation;
  reduce: boolean;
  fresh: boolean;
  now: number;
  formatTime: (date: Date, now: number) => string;
  selected: boolean;
  tabbable: boolean;
  open: boolean;
  actions: Partial<Record<ActionKey, Action>>;
  onOpenChange: (open: boolean) => void;
  onSelect: () => void;
  onFocusRow: () => void;
  onRun: (key: ActionKey, from: HTMLElement | null) => void;
};

function Row({ c, reduce, fresh, now, formatTime, selected, tabbable, open, actions, onOpenChange, onSelect, onFocusRow, onRun }: RowProps) {
  const present = useIsPresent();
  const x = useMotionValue(0);
  const controls = useDragControls();
  const surface = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLButtonElement>(null);
  const dragged = useRef(false);
  const [armed, setArmed] = useState<"start" | "end" | null>(null);

  // Swipe right for read state (and pin); swipe left for mute and archive. The action on the
  // outer edge is the one a long swipe commits.
  const start = [actions.read, actions.pin].filter(Boolean) as Action[];
  const end = [actions.mute, actions.archive].filter(Boolean) as Action[];
  const hover = [actions.read, actions.archive].filter(Boolean) as Action[];
  const menu = [actions.read, actions.pin, actions.mute].filter(Boolean) as Action[];

  const settle = (to: number) => animate(x, to, reduce ? { duration: 0.15, ease: ease.out } : spring.snappy);

  // Another row opened, or the list asked everything to close.
  useEffect(() => {
    if (!open && x.get() !== 0) settle(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const commit = async (action: Action, side: "start" | "end") => {
    const w = surface.current?.offsetWidth ?? 320;
    if (action.key === "archive") {
      await animate(x, side === "end" ? -w - 24 : w + 24, { duration: reduce ? 0.1 : 0.2, ease: ease.in });
      onRun(action.key, null);
    } else {
      onRun(action.key, null);
      settle(0);
    }
  };

  const release = (vx: number) => {
    const v = x.get();
    const startW = start.length * SWIPE_W;
    const endW = end.length * SWIPE_W;
    const wasArmed = armed;
    setArmed(null);
    if (wasArmed === "start" && start[0]) return commit(start[0], "start");
    if (wasArmed === "end" && end.at(-1)) return commit(end.at(-1)!, "end");
    // A flick counts as much as a drag: fast and in the right direction opens the tray.
    if (endW && (v < -endW / 2 || (v < -12 && vx < -500))) {
      onOpenChange(true);
      return settle(-endW);
    }
    if (startW && (v > startW / 2 || (v > 12 && vx > 500))) {
      onOpenChange(true);
      return settle(startW);
    }
    onOpenChange(false);
    settle(0);
  };

  const unread = isUnread(c);
  // Muted chats still count, but never shout: no bright sender, preview or time.
  const loud = unread && !c.muted;
  const typing = !!c.typing;
  const count = c.unread ?? 0;
  const timeText =
    typeof c.time === "string" ? c.time : c.time != null && now ? formatTime(new Date(c.time), now) : "";
  const timeISO = c.time != null && typeof c.time !== "string" ? new Date(c.time).toISOString() : undefined;
  const timeTitle =
    c.time != null && typeof c.time !== "string" && now ? new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(new Date(c.time)) : undefined;
  const typingText = typeof c.typing === "string" ? `${c.typing} is typing` : "typing";

  const spoken = [
    c.name,
    count > 0 ? `${count} unread${c.mention ? ", mentions you" : ""}` : c.markedUnread ? "unread" : "",
    c.pinned ? "pinned" : "",
    c.muted ? "muted" : "",
    c.online ? "online" : "",
  ]
    .filter(Boolean)
    .join(", ");
  const said = typing ? `${typingText}…` : c.draft ? `Draft: ${c.draft}` : c.preview ? `${c.sender ? `${c.sender}: ` : ""}${c.preview}` : "";
  const label = `${spoken}. ${said}${timeText ? `. ${timeText}` : ""}`;

  const previewKey = typing ? "typing" : c.draft ? `d:${c.draft}` : `p:${c.sender ?? ""}:${c.preview ?? ""}`;
  const swap = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 5, filter: "blur(2px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: reduce ? { opacity: 0, transition: { duration: 0.08 } } : { opacity: 0, y: -5, filter: "blur(2px)", transition: { duration: 0.12, ease: ease.in } },
    transition: { duration: reduce ? 0.12 : 0.2, ease: ease.out },
  };

  return (
    <motion.li
      layout={reduce ? false : "position"}
      layoutId={reduce ? undefined : c.id}
      data-row={c.id}
      data-exiting={present ? undefined : ""}
      inert={!present}
      custom={c.id}
      initial={fresh ? (reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985 }) : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit="exit"
      variants={{
        // Still in the list means it only moved to the other section: vanish, the new copy glides.
        exit: (ids: Set<string>) =>
          ids?.has?.(c.id)
            ? { opacity: 0, transition: { duration: 0 } }
            : reduce
              ? { opacity: 0, transition: { duration: 0.12 } }
              : { opacity: 0, x: -12, scale: 0.98, transition: { duration: 0.18, ease: ease.in } },
      }}
      transition={{ duration: 0.24, ease: ease.out, layout: spring.soft }}
      className="relative"
    >
      <ContextMenu.Root>
        <ContextMenu.Trigger
          render={<div />}
          ref={surface}
          data-row-surface=""
          className="relative overflow-hidden rounded-lg [-webkit-touch-callout:none]"
        >
          {/* Swipe trays sit behind the row and are clipped to exactly what the row uncovers. */}
          {start.length > 0 && <Tray side="start" actions={start} x={x} armed={armed === "start"} reduce={reduce} onPress={(a) => (a === start[0] ? commit(a, "start") : (onRun(a.key, null), settle(0)))} />}
          {end.length > 0 && <Tray side="end" actions={end} x={x} armed={armed === "end"} reduce={reduce} onPress={(a) => (a === end.at(-1) ? commit(a, "end") : (onRun(a.key, null), settle(0)))} />}

          <motion.div
            drag="x"
            dragControls={controls}
            dragListener={false}
            dragDirectionLock
            dragMomentum={false}
            dragConstraints={{ left: end.length ? -2000 : 0, right: start.length ? 2000 : 0 }}
            dragElastic={{ left: end.length ? 1 : 0.08, right: start.length ? 1 : 0.08 }}
            onPointerDown={(e) => {
              dragged.current = false;
              if (e.pointerType !== "mouse") controls.start(e);
            }}
            onDragStart={() => {
              dragged.current = true;
              onOpenChange(true);
            }}
            onDrag={() => {
              const w = surface.current?.offsetWidth ?? 320;
              const v = x.get();
              const next = start.length && v > Math.max(w * 0.55, start.length * SWIPE_W + 40) ? "start" : end.length && v < -Math.max(w * 0.55, end.length * SWIPE_W + 40) ? "end" : null;
              if (next !== armed) setArmed(next);
            }}
            onDragEnd={(_, info) => release(info.velocity.x)}
            style={{ x, touchAction: "pan-y" }}
            className="group/row relative"
            data-selected={selected || undefined}
          >
            <button
              ref={main}
              type="button"
              data-row-main=""
              aria-label={label}
              aria-current={selected ? "true" : undefined}
              aria-keyshortcuts={[...start, ...end].map((a) => a.shortcut).join(" ") || undefined}
              tabIndex={tabbable ? 0 : -1}
              onFocus={onFocusRow}
              onKeyDown={(e) => {
                if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
                  e.preventDefault();
                  const r = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 56, clientY: r.bottom - 6 }));
                }
              }}
              onClick={() => {
                if (dragged.current) return;
                // Tapping a row that is swiped open closes it instead of opening the chat.
                if (Math.abs(x.get()) > 2) {
                  onOpenChange(false);
                  return;
                }
                onSelect();
              }}
              className={cn(
                "flex w-full select-none items-center gap-3 rounded-lg px-3 py-2.5 text-left",
                "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
                "transition-[background-color] duration-150 active:bg-fg/[0.06] active:duration-75",
                selected && "bg-fg/[0.075] active:bg-fg/[0.1]",
              )}
            >
              <RowAvatar c={c} />

              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[13px] font-medium leading-[18px] tracking-[-0.005em] text-fg">{c.name}</span>
                  {c.muted && (
                    <span className="shrink-0 text-fg-4 [&_svg]:size-3" aria-hidden>
                      <BellOffIcon />
                    </span>
                  )}
                </span>
                <span className="relative grid h-[18px] min-w-0 overflow-hidden">
                  <AnimatePresence initial={false}>
                    <motion.span key={previewKey} {...swap} className="col-start-1 row-start-1 flex min-w-0 items-center gap-1 text-[12.5px] leading-[18px]">
                      {typing ? (
                        <span className="flex min-w-0 items-center gap-1.5 text-fg-2">
                          <span className="truncate">{typingText}</span>
                          <TypingDots />
                        </span>
                      ) : c.draft ? (
                        <span className="truncate text-fg-3">
                          <span className="font-medium text-fg-2">Draft </span>
                          {c.draft}
                        </span>
                      ) : (
                        <span className={cn("truncate transition-colors duration-200", loud ? "text-fg-2" : "text-fg-3")}>
                          {c.sender && <span className={cn("transition-colors duration-200", loud ? "text-fg" : "text-fg-2")}>{c.sender}: </span>}
                          {c.preview}
                        </span>
                      )}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </span>

              {/* Fixed width, so the hover actions take exactly this space and nothing reflows. */}
              <span
                className={cn(
                  "flex min-w-15 shrink-0 flex-col items-end gap-0.5 self-stretch py-px",
                  "transition-[opacity] duration-150",
                  hover.length > 0 && "pointer-fine:group-hover/row:opacity-0 group-has-[[data-row-action]:focus-visible]/row:opacity-0",
                )}
              >
                <time
                  dateTime={timeISO}
                  title={timeTitle}
                  className={cn("h-[18px] whitespace-nowrap text-[11.5px] leading-[18px] tabular transition-colors duration-200", loud ? "text-fg" : "text-fg-3")}
                >
                  {timeText}
                </time>
                <span className="flex h-[18px] items-center gap-1">
                  <AnimatePresence initial={false}>
                    {c.pinned && !unread && (
                      <motion.span key="pin" className="text-fg-4 [&_svg]:size-3" aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
                        <PinIcon />
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <Badge count={count} marked={!!c.markedUnread} mention={!!c.mention} muted={!!c.muted} reduce={reduce} />
                </span>
              </span>
            </button>

            {hover.length > 0 && (
              <div
                className={cn(
                  "absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1",
                  "pointer-events-none translate-x-1 opacity-0 transition-[opacity,translate] duration-150 ease-out-expo",
                  "pointer-fine:group-hover/row:pointer-events-auto pointer-fine:group-hover/row:translate-x-0 pointer-fine:group-hover/row:opacity-100",
                  "group-has-[[data-row-action]:focus-visible]/row:pointer-events-auto group-has-[[data-row-action]:focus-visible]/row:translate-x-0 group-has-[[data-row-action]:focus-visible]/row:opacity-100",
                  "pointer-coarse:hidden motion-reduce:translate-x-0",
                )}
              >
                {hover.map((a) => (
                  <HoverAction key={a.key} action={a} onPress={(el) => onRun(a.key, el)} />
                ))}
              </div>
            )}
          </motion.div>
        </ContextMenu.Trigger>

        <ContextMenu.Portal>
          <ContextMenu.Positioner collisionPadding={8} className="z-(--z-dropdown) outline-none">
            <ContextMenu.Popup
              className={cn(
                "min-w-48 rounded-xl border border-line-2 bg-raised p-1 text-fg shadow-pop outline-none",
                "origin-(--transform-origin) transition-[opacity,scale] duration-150 ease-out-expo",
                "data-starting-style:scale-96 data-starting-style:opacity-0 data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-100",
                "motion-reduce:scale-100",
              )}
            >
              {menu.map((a) => (
                <MenuItem key={a.key} action={a} onClick={() => onRun(a.key, main.current)} />
              ))}
              {actions.archive && (
                <>
                  {menu.length > 0 && <ContextMenu.Separator className="-mx-1 my-1 h-px bg-line" />}
                  <MenuItem action={actions.archive} onClick={() => onRun("archive", main.current)} />
                </>
              )}
            </ContextMenu.Popup>
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    </motion.li>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Parts
 * -----------------------------------------------------------------------------------------------*/

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p));
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function RowAvatar({ c }: { c: Conversation }) {
  return (
    <span className="relative size-10 shrink-0">
      <Avatar.Root
        className={cn(
          "flex size-10 select-none items-center justify-center overflow-hidden rounded-full bg-fg/[0.08] text-[13px] font-medium text-fg-2",
          // The presence dot is cut out of the avatar rather than ringed in a surface color,
          // so it sits right on any background: selected, hovered, light or dark.
          "transition-[mask-size] duration-200",
          c.online && "[mask-image:radial-gradient(circle_at_calc(100%-5px)_calc(100%-5px),transparent_6.5px,var(--fg)_7px)]",
        )}
      >
        {c.avatar && <Avatar.Image src={c.avatar} alt="" width={40} height={40} className="size-full object-cover" />}
        <Avatar.Fallback delay={c.avatar ? 400 : 0} className="tracking-[0.01em]">
          {initials(c.name)}
        </Avatar.Fallback>
      </Avatar.Root>
      <AnimatePresence initial={false}>
        {c.online && (
          <motion.span
            key="online"
            aria-hidden
            className="absolute bottom-0 right-0 size-2.5 rounded-full bg-success"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4, transition: { duration: 0.12 } }}
            transition={spring.pop}
          />
        )}
      </AnimatePresence>
    </span>
  );
}

function TypingDots() {
  return (
    <span aria-hidden className="flex shrink-0 items-center gap-[3px] pt-px">
      {[0, 0.15, 0.3].map((d) => (
        <span key={d} className="size-[3px] animate-dot-wave rounded-full bg-current" style={{ animationDelay: `${d}s` }} />
      ))}
    </span>
  );
}

function Badge({ count, marked, mention, muted, reduce }: { count: number; marked: boolean; mention: boolean; muted: boolean; reduce: boolean }) {
  const show = count > 0 ? "count" : marked ? "dot" : null;
  const enter = reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 };
  const tone = muted ? "bg-fg/[0.14] text-fg-2" : "bg-fg text-frame";
  return (
    <span className="flex items-center gap-1" aria-hidden>
      <AnimatePresence initial={false}>
        {mention && count > 0 && (
          <motion.span
            key="at"
            initial={enter}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ ...enter, transition: { duration: 0.12 } }}
            transition={reduce ? { duration: 0.12 } : spring.pop}
            className={cn("grid size-[18px] place-items-center rounded-full text-[11px] font-medium leading-none", tone)}
          >
            @
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false} mode="popLayout">
        {show === "count" && (
          <motion.span
            key="count"
            initial={enter}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ ...enter, transition: { duration: 0.12 } }}
            transition={reduce ? { duration: 0.12 } : spring.pop}
            className={cn("flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[5px] text-[11px] font-medium leading-none tabular transition-colors duration-200", tone)}
          >
            <NumberFlow value={Math.min(count, 99)} suffix={count > 99 ? "+" : undefined} animated={!reduce} />
          </motion.span>
        )}
        {show === "dot" && (
          <motion.span
            key="dot"
            initial={enter}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ ...enter, transition: { duration: 0.12 } }}
            transition={reduce ? { duration: 0.12 } : spring.pop}
            className={cn("mr-[5px] size-2 rounded-full", muted ? "bg-fg-3" : "bg-fg")}
          />
        )}
      </AnimatePresence>
    </span>
  );
}

function HoverAction({ action, onPress }: { action: Action; onPress: (el: HTMLElement) => void }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={<button type="button" />}
        tabIndex={-1}
        data-row-action=""
        aria-label={action.label}
        aria-keyshortcuts={action.shortcut}
        onClick={(e) => onPress(e.currentTarget)}
        className={cn(
          "grid size-7 place-items-center rounded-md text-fg-3",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
          "transition-[background-color,color,scale] duration-150 hover:bg-fg/[0.07] hover:text-fg active:scale-[0.92] active:duration-75",
        )}
      >
        {action.icon}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" sideOffset={6} collisionPadding={8} className="z-(--z-tooltip)">
          <Tooltip.Popup
            className={cn(
              "flex h-[26px] items-center gap-2 rounded-lg border border-line-2 bg-raised pl-2 pr-1 text-[12px] text-fg shadow-pop",
              "origin-(--transform-origin) transition-[opacity,scale] duration-150 ease-out-expo",
              "data-starting-style:scale-96 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-100 data-instant:transition-none",
            )}
          >
            {action.label}
            <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-line-2 bg-frame px-1 font-mono text-[10.5px] leading-none text-fg-2">
              {action.shortcut}
            </kbd>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function MenuItem({ action, onClick }: { action: Action; onClick: () => void }) {
  return (
    <ContextMenu.Item
      onClick={onClick}
      className={cn(
        "flex h-8 cursor-default select-none items-center gap-2.5 rounded-lg px-2 text-[13px] outline-none pointer-coarse:h-10",
        "data-highlighted:bg-fg/[0.06] [&_svg]:text-fg-3 data-highlighted:[&_svg]:text-fg-2",
      )}
    >
      {action.icon}
      <span className="flex-1">{action.label}</span>
      <kbd className="font-sans text-[12px] text-fg-3 pointer-coarse:hidden">{action.shortcut}</kbd>
    </ContextMenu.Item>
  );
}

/** The actions a swipe uncovers. Each button stretches with the drag; past the commit point the edge action takes the whole tray. */
function Tray({ side, actions, x, armed, reduce, onPress }: { side: "start" | "end"; actions: Action[]; x: MotionValue<number>; armed: boolean; reduce: boolean; onPress: (a: Action) => void }) {
  const width = useTransform(x, (v) => Math.max(0, side === "start" ? v : -v));
  const edge = side === "start" ? actions[0] : actions[actions.length - 1];
  const tone: Record<ActionKey, string> = {
    read: "bg-fg-2 text-frame",
    pin: "bg-fg/[0.14] text-fg",
    mute: "bg-fg/[0.14] text-fg",
    archive: "bg-fg text-frame",
  };
  return (
    <motion.div aria-hidden className={cn("absolute inset-y-0 flex overflow-hidden", side === "start" ? "left-0" : "right-0")} style={{ width }}>
      {actions.map((a) => {
        const isEdge = a === edge;
        const collapsed = armed && !isEdge;
        return (
          <button
            key={a.key}
            type="button"
            tabIndex={-1}
            onClick={() => onPress(a)}
            className={cn(
              "relative flex min-w-0 basis-0 flex-col justify-center gap-1 overflow-hidden text-[11px] font-medium",
              "transition-[flex-grow] duration-200 ease-out-expo",
              collapsed ? "grow-0" : "grow",
              tone[a.key],
              // Past the commit point the icon hugs the row, so it looks pulled along by the finger.
              !(armed && isEdge) ? "items-center" : side === "start" ? "items-end pr-6" : "items-start pl-6",
            )}
          >
            <motion.span
              className="flex flex-col items-center gap-1"
              animate={{ scale: armed && isEdge && !reduce ? 1.12 : 1 }}
              transition={spring.pop}
            >
              {a.icon}
              <span className="whitespace-nowrap">{a.short}</span>
            </motion.span>
          </button>
        );
      })}
    </motion.div>
  );
}
