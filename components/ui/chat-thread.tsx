"use client";
import { Avatar } from "@base-ui/react/avatar";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ArrowDown } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { MessageStatus, type MessageStatusValue } from "@/components/ui/message-status";
import { ReplyQuote, jumpToMessage, type ReplyTarget } from "@/components/ui/reply-preview";

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

export type ChatAuthor = { id: string; name: string; avatar?: string };

export type ChatMessage = {
  id: string;
  authorId: string;
  /** When it was sent: a Date, an ISO string or epoch milliseconds. */
  at: Date | string | number;
  text?: string;
  /** Anything that isn't text: a voice note, an image, a file card. */
  content?: React.ReactNode;
  /** Render content without the bubble around it, for content that brings its own (a voice message). */
  bare?: boolean;
  /** Delivery state of your own messages. */
  status?: MessageStatusValue;
  replyTo?: ReplyTarget;
  edited?: boolean;
};

type Position = "single" | "first" | "middle" | "last";

export type ChatRow =
  | { type: "day"; key: string; date: Date }
  | { type: "message"; key: string; message: ChatMessage; date: Date; own: boolean; position: Position; showName: boolean; showAvatar: boolean };

const toDate = (at: ChatMessage["at"]) => (at instanceof Date ? at : new Date(at));

/**
 * Turns a flat list into rows: a day separator whenever the calendar day changes, and each
 * message placed in its group (same author, same day, under `windowMinutes` apart).
 */
export function groupMessages(
  messages: ChatMessage[],
  currentUserId: string,
  { windowMinutes = 5, timeZone, showNames = false }: { windowMinutes?: number; timeZone?: string; showNames?: boolean } = {},
) {
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const rows: ChatRow[] = [];
  let lastDay = "";
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const date = toDate(m.at);
    const day = dayKey.format(date);
    if (day !== lastDay) {
      // Keyed by the day's first message, so re-dating the thread never re-mounts a separator.
      rows.push({ type: "day", key: `day-${m.id}`, date });
      lastDay = day;
    }
    const joins = (a?: ChatMessage, b?: ChatMessage) =>
      !!a &&
      !!b &&
      a.authorId === b.authorId &&
      dayKey.format(toDate(a.at)) === dayKey.format(toDate(b.at)) &&
      Math.abs(toDate(b.at).getTime() - toDate(a.at).getTime()) <= windowMinutes * 60_000;
    const withPrev = joins(messages[i - 1], m);
    const withNext = joins(m, messages[i + 1]);
    const position: Position = withPrev ? (withNext ? "middle" : "last") : withNext ? "first" : "single";
    const own = m.authorId === currentUserId;
    rows.push({
      type: "message",
      key: m.id,
      message: m,
      date,
      own,
      position,
      showName: showNames && !own && !withPrev,
      showAvatar: showNames && !own && !withNext,
    });
  }
  return rows;
}

/* -------------------------------------------------------------------------------------------------
 * Hydration-safe dates: the server's time zone and locale aren't the reader's, so the first
 * render uses fixed ones and the reader's take over straight after.
 * -----------------------------------------------------------------------------------------------*/

const noop = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

function useFormatters(hydrated: boolean, locale?: string, timeZone?: string) {
  return useMemo(() => {
    const loc = hydrated ? locale : (locale ?? "en-US");
    const tz = hydrated ? timeZone : (timeZone ?? "UTC");
    const time = new Intl.DateTimeFormat(loc, { hour: "numeric", minute: "2-digit", timeZone: tz });
    const full = new Intl.DateTimeFormat(loc, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });
    const weekday = new Intl.DateTimeFormat(loc, { weekday: "long", timeZone: tz });
    const dayMonth = new Intl.DateTimeFormat(loc, { weekday: "short", month: "short", day: "numeric", timeZone: tz });
    const withYear = new Intl.DateTimeFormat(loc, { month: "short", day: "numeric", year: "numeric", timeZone: tz });
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    const day = (date: Date) => {
      // Relative words need "now", which only the reader's clock knows.
      if (!hydrated) return withYear.format(date);
      const now = new Date();
      const diff = Math.round((Date.parse(key.format(now)) - Date.parse(key.format(date))) / 86_400_000);
      if (diff === 0) return "Today";
      if (diff === 1) return "Yesterday";
      if (diff > 1 && diff < 7) return weekday.format(date);
      return date.getFullYear() === now.getFullYear() ? dayMonth.format(date) : withYear.format(date);
    };
    return { time: (d: Date) => time.format(d), full: (d: Date) => full.format(d), day, tz };
  }, [hydrated, locale, timeZone]);
}

/* -------------------------------------------------------------------------------------------------
 * ChatThread
 * -----------------------------------------------------------------------------------------------*/

export type ChatThreadProps = Omit<React.ComponentProps<"div">, "children"> & {
  messages: ChatMessage[];
  authors: ChatAuthor[];
  /** Whose messages sit on the right in the filled bubble. */
  currentUserId: string;
  /** Ids of people typing right now. */
  typing?: string[];
  /** Reply to a message: from the hover button, the R key, or a swipe right on touch. */
  onReply?: (message: ChatMessage) => void;
  /** Resend a failed message. */
  onRetry?: (message: ChatMessage) => void;
  /** Names and avatars on other people's messages. Defaults to on when more than two people are in the thread. */
  showNames?: boolean;
  /** Messages closer together than this, from the same person, share a group. */
  groupWindow?: number;
  locale?: string;
  timeZone?: string;
  /** Shown when there are no messages. */
  empty?: React.ReactNode;
  /** Older history exists above. Scrolling near the top calls onLoadOlder. */
  hasOlder?: boolean;
  onLoadOlder?: () => Promise<unknown> | void;
  /** The composer, pinned under the thread. The jump-to-latest pill sits just above it. */
  footer?: React.ReactNode;
  /** Names the log for screen readers: "Conversation with Maya Chen". */
  label?: string;
};

const PIN_SLOP = 32;
const SWIPE_REPLY = 56;
const SWIPE_TIMES = 64;

/**
 * A conversation: bubbles grouped by sender with a tail on the last of each group, day
 * separators that stick while you scroll, times on hover (or a swipe left on touch), and new
 * messages that rise into place while the thread stays pinned to the latest.
 */
export function ChatThread({
  messages,
  authors,
  currentUserId,
  typing = [],
  onReply,
  onRetry,
  showNames: showNamesProp,
  groupWindow = 5,
  locale,
  timeZone,
  empty,
  hasOlder = false,
  onLoadOlder,
  footer,
  label = "Conversation",
  className,
  ...rest
}: ChatThreadProps) {
  const reduce = !!useReducedMotion();
  const hydrated = useHydrated();
  const fmt = useFormatters(hydrated, locale, timeZone);
  const people = useMemo(() => new Map(authors.map((a) => [a.id, a])), [authors]);
  const showNames = showNamesProp ?? new Set(messages.map((m) => m.authorId)).size > 2;
  const rows = useMemo(
    () => groupMessages(messages, currentUserId, { windowMinutes: groupWindow, timeZone: fmt.tz, showNames }),
    [messages, currentUserId, groupWindow, fmt.tz, showNames],
  );

  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLUListElement>(null);
  const pinned = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const [seenId, setSeenId] = useState(messages[messages.length - 1]?.id);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Rows that were loaded above the history shouldn't animate in as if they just arrived.
  // Tracked with the "adjust state while rendering" pattern, so no effect has to catch up.
  const [firstId, setFirstId] = useState(messages[0]?.id);
  const [older, setOlder] = useState<Set<string>>(() => new Set());
  if (messages[0]?.id !== firstId) {
    const at = messages.findIndex((m) => m.id === firstId);
    if (at > 0) setOlder((s) => new Set([...s, ...messages.slice(0, at).map((m) => m.id)]));
    setFirstId(messages[0]?.id);
  }

  const lastId = messages[messages.length - 1]?.id;
  const lastIdRef = useRef(lastId);
  useEffect(() => {
    lastIdRef.current = lastId;
  }, [lastId]);

  const unread = useMemo(() => {
    const from = messages.findIndex((m) => m.id === seenId);
    return messages.slice(from + 1).filter((m) => m.authorId !== currentUserId).length;
  }, [messages, seenId, currentUserId]);

  /* ----- pinning: follow the newest while you're at the bottom, leave you alone when you're not ----- */
  const toBottom = useCallback(
    (smooth: boolean) => {
      const el = scrollerRef.current;
      if (!el) return;
      pinned.current = true;
      setAtBottom(true);
      setSeenId(lastIdRef.current);
      el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduce ? "smooth" : "auto" });
    },
    [reduce],
  );

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    // Growing rows animate their height, so this fires every frame of an arrival and the
    // scroll follows the growth instead of jumping to its end.
    const ro = new ResizeObserver(() => {
      if (!pinned.current) return;
      el.scrollTop = el.scrollHeight;
      setSeenId(lastIdRef.current);
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  // Your own message always brings you down to it, wherever you were reading.
  const lastOwn = messages[messages.length - 1]?.authorId === currentUserId ? lastId : undefined;
  useEffect(() => {
    if (lastOwn && !pinned.current) toBottom(true);
  }, [lastOwn, toBottom]);

  // Keep the reader's place when older messages are added above.
  const anchor = useRef<{ first?: string; height: number }>({ first: messages[0]?.id, height: 0 });
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const prev = anchor.current;
    if (prev.first && prev.first !== messages[0]?.id && !pinned.current) el.scrollTop += el.scrollHeight - prev.height;
    anchor.current = { first: messages[0]?.id, height: el.scrollHeight };
  });

  const [floatDay, setFloatDay] = useState<string | null>(null);
  const floatTimer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(floatTimer.current), []);

  const handled = useRef(0);
  const markHand = () => {
    handled.current = performance.now();
  };

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight <= PIN_SLOP;
    pinned.current = bottom;
    if (bottom !== atBottom) setAtBottom(bottom);
    if (bottom) setSeenId(lastIdRef.current);
    // While scrolling, the day you're reading floats at the top once its own label has scrolled away.
    let day: string | null = null;
    // Only for scrolling someone did: a composer growing or a message arriving also scrolls.
    const byHand = performance.now() - handled.current < 800;
    if (!bottom && byHand)
      contentRef.current?.querySelectorAll<HTMLElement>("[data-day]").forEach((sep) => {
        const top = sep.offsetTop - el.scrollTop;
        if (top + sep.offsetHeight <= 4) day = sep.dataset.day ?? null;
        // The next day's own label is about to take over: don't show two days at once.
        else if (top < 56) day = null;
      });
    window.clearTimeout(floatTimer.current);
    setFloatDay(day);
    if (day) floatTimer.current = window.setTimeout(() => setFloatDay(null), 1100);
    if (hasOlder && onLoadOlder && !loadingOlder && el.scrollTop < 120) {
      setLoadingOlder(true);
      Promise.resolve(onLoadOlder()).finally(() => setLoadingOlder(false));
    }
  };

  /* ----- touch: swipe a message right to reply, the thread left to see every time ----- */
  const swipeX = useMotionValue(0);
  const timesX = useMotionValue(0);
  const [swipeId, setSwipeId] = useState<string | null>(null);
  const gesture = useRef<{ x: number; y: number; id: string | null; mode: "none" | "reply" | "times" | "scroll"; pointer: number } | null>(null);
  const rubber = (d: number, max: number) => (d <= 0 ? 0 : d < max ? d : max + (d - max) * 0.25);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    const row = (e.target as HTMLElement).closest<HTMLElement>("[data-message-id]");
    gesture.current = { x: e.clientX, y: e.clientY, id: row?.dataset.messageId ?? null, mode: "none", pointer: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.pointer !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.mode === "none") {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) g.mode = "scroll";
      else if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        g.mode = dx > 0 && g.id && onReply ? "reply" : dx < 0 ? "times" : "scroll";
        if (g.mode === "reply") setSwipeId(g.id);
      }
    }
    if (g.mode === "reply") swipeX.set(rubber(dx, SWIPE_REPLY + 8));
    if (g.mode === "times") timesX.set(-rubber(-dx, SWIPE_TIMES));
  };
  const endGesture = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.mode === "reply") {
      if (swipeX.get() >= SWIPE_REPLY) {
        const m = messages.find((x) => x.id === g.id);
        if (m) onReply?.(m);
      }
      animate(swipeX, 0, reduce ? { duration: 0 } : spring.snappy).then(() => setSwipeId(null));
    }
    if (g.mode === "times") animate(timesX, 0, reduce ? { duration: 0 } : spring.soft);
  };

  /* ----- keyboard: the log is one tab stop; arrows walk the messages ----- */
  const messageIds = useMemo(() => messages.map((m) => m.id), [messages]);
  const focusRow = (id: string | undefined) => {
    if (!id) return;
    const el = contentRef.current?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(id)}"]`);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: "nearest" });
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const inRow = target.matches("[data-message-id]");
    const onLog = target === scrollerRef.current;
    if (!inRow && !onLog) return;
    const current = inRow ? target.dataset.messageId! : null;
    const i = current ? messageIds.indexOf(current) : messageIds.length;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      focusRow(messageIds[Math.max(0, i - 1)]);
    } else if (e.key === "ArrowDown" && current) {
      e.preventDefault();
      if (i >= messageIds.length - 1) scrollerRef.current?.focus();
      else focusRow(messageIds[i + 1]);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusRow(messageIds[0]);
    } else if (e.key === "End") {
      e.preventDefault();
      focusRow(messageIds[messageIds.length - 1]);
    } else if ((e.key === "r" || e.key === "Enter") && current && onReply && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const m = messages.find((x) => x.id === current);
      if (m) onReply(m);
    } else if (e.key === "Escape" && inRow) {
      e.preventDefault();
      scrollerRef.current?.focus();
    }
  };

  const typingPeople = typing
    .filter((id) => id !== currentUserId)
    .map((id) => people.get(id))
    .filter(Boolean) as ChatAuthor[];
  const lastOwnId = [...messages].reverse().find((m) => m.authorId === currentUserId)?.id;

  return (
    <div className={cn("relative flex min-h-0 flex-col [--bubble:color-mix(in_oklab,var(--fg)_7%,var(--frame))]", className)} {...rest}>
      <div
        ref={scrollerRef}
        role="log"
        aria-label={label}
        aria-live="polite"
        aria-relevant="additions"
        tabIndex={0}
        onScroll={onScroll}
        onWheel={markHand}
        onTouchMove={markHand}
        onKeyDownCapture={markHand}
        onPointerDownCapture={markHand}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        className={cn(
          "relative flex min-h-0 flex-1 touch-pan-y flex-col overflow-y-auto overflow-x-hidden overscroll-contain outline-none",
          "[mask-image:linear-gradient(to_bottom,transparent,black_16px,black_calc(100%-10px),transparent)] focus-visible:[mask-image:none]",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-4",
        )}
      >
        {messages.length === 0 ? (
          <div className="grid min-h-full place-items-center px-6 py-10 text-center">{empty ?? <DefaultEmpty />}</div>
        ) : (
          // Clipped, not hidden: the swipe-left times live past the right edge, and a clip can't be
          // scrolled sideways by focus or scrollIntoView the way an overflow region can.
          <div className="flex flex-1 flex-col overflow-x-clip">
            <motion.ul ref={contentRef} style={{ x: timesX }} className="flex flex-1 flex-col justify-end pb-3 pt-2">
              {hasOlder && (
                <li className="flex h-10 items-center justify-center text-[11.5px] text-fg-4" aria-live="off">
                  {loadingOlder ? "Loading earlier messages…" : ""}
                </li>
              )}
              <AnimatePresence initial={false}>
                {rows.map((row) =>
                  row.type === "day" ? (
                    <DaySeparator key={row.key} label={fmt.day(row.date)} reduce={reduce} />
                  ) : (
                    <MessageRow
                      key={row.key}
                      row={row}
                      author={people.get(row.message.authorId)}
                      fmt={fmt}
                      arrived={!older.has(row.message.id)}
                      reduce={reduce}
                      withAvatars={showNames}
                      onJump={(id) => jumpToMessage(id, { root: contentRef.current })}
                      showStatusLabel={row.own && (row.message.id === lastOwnId || row.message.status === "failed")}
                      onReply={onReply}
                      onRetry={onRetry}
                      swipe={swipeId === row.message.id ? swipeX : undefined}
                      timesX={timesX}
                    />
                  ),
                )}
                {typingPeople.length > 0 && <TypingRow key="typing" people={typingPeople} showAvatar={showNames} reduce={reduce} />}
              </AnimatePresence>
            </motion.ul>
          </div>
        )}
      </div>

      {/* The floating day: appears while you scroll through history, fades once you stop. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-2 z-(--z-sticky) flex justify-center">
        <AnimatePresence>
          {floatDay && (
            <motion.span
              key="float"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ duration: 0.16, ease: ease.out }}
              className="rounded-full border border-line-2 bg-raised px-2.5 py-0.5 text-[11px] font-medium leading-4 text-fg-2 shadow-pop"
            >
              {floatDay}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Jump to latest: only when you've scrolled away, with a count of what you've missed. */}
      <div className="pointer-events-none relative z-(--z-sticky) h-0">
        <AnimatePresence>
          {!atBottom && messages.length > 0 && (
            <motion.button
              key="jump"
              type="button"
              onClick={() => toBottom(true)}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: 6, scale: 0.97, transition: { duration: 0.14 } }}
              transition={reduce ? { duration: 0.15 } : spring.snappy}
              aria-label={unread ? `Jump to latest, ${unread} new message${unread === 1 ? "" : "s"}` : "Jump to latest message"}
              className={cn(
                "pointer-events-auto absolute bottom-3 left-1/2 flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full border border-line-2 bg-raised pl-2.5 pr-3 text-[12px] font-medium text-fg shadow-pop outline-none",
                "transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.96] active:duration-75",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              )}
            >
              <ArrowDown size={14} className="text-fg-3" />
              {unread > 0 ? (
                <span className="flex items-center gap-1 tabular">
                  <NumberFlow value={unread} aria-hidden />
                  <span>new</span>
                </span>
              ) : (
                <span>Latest</span>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {footer}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Rows
 * -----------------------------------------------------------------------------------------------*/

type Fmt = ReturnType<typeof useFormatters>;

function DaySeparator({ label, reduce }: { label: string; reduce: boolean }) {
  return (
    <motion.li
      data-day={label}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: ease.out }}
      className="flex items-center gap-3 px-6 pb-1 pt-4"
    >
      <span aria-hidden className="h-px flex-1 bg-line" />
      <span suppressHydrationWarning className="text-[11px] font-medium leading-4 text-fg-3">
        {label}
      </span>
      <span aria-hidden className="h-px flex-1 bg-line" />
    </motion.li>
  );
}

const radius: Record<Position, { own: string; other: string }> = {
  single: { own: "rounded-[18px] rounded-br-[4px]", other: "rounded-[18px] rounded-bl-[4px]" },
  first: { own: "rounded-[18px] rounded-br-[6px]", other: "rounded-[18px] rounded-bl-[6px]" },
  middle: { own: "rounded-[18px] rounded-r-[6px]", other: "rounded-[18px] rounded-l-[6px]" },
  last: { own: "rounded-[18px] rounded-tr-[6px] rounded-br-[4px]", other: "rounded-[18px] rounded-tl-[6px] rounded-bl-[4px]" },
};

type RowProps = {
  row: Extract<ChatRow, { type: "message" }>;
  author?: ChatAuthor;
  fmt: Fmt;
  arrived: boolean;
  reduce: boolean;
  withAvatars: boolean;
  onJump: (id: string) => void;
  showStatusLabel: boolean;
  onReply?: (m: ChatMessage) => void;
  onRetry?: (m: ChatMessage) => void;
  swipe?: MotionValue<number>;
  timesX: MotionValue<number>;
};

function MessageRow({ row, author, fmt, arrived, reduce, withAvatars, onJump, showStatusLabel, onReply, onRetry, swipe, timesX }: RowProps) {
  const { message: m, own, position, date } = row;
  const tail = position === "single" || position === "last";
  const spaced = position === "single" || position === "first";
  const name = author?.name ?? "Unknown";
  const time = fmt.time(date);
  const bare = !!m.content && m.bare;
  const failed = m.status === "failed";

  // Arrivals rise from where they came from: yours from the composer below, theirs a shorter way.
  const rise = own ? 28 : 14;
  const zero = useMotionValue(0);
  const x = swipe ?? zero;
  const timesOpacity = useTransform(timesX, [0, -SWIPE_TIMES], [0, 1]);

  return (
    <motion.li
      data-message-id={m.id}
      data-own={own || undefined}
      data-position={position}
      tabIndex={-1}
      initial={arrived ? { height: 0, opacity: 0 } : false}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0, transition: { duration: reduce ? 0 : 0.18, ease: ease.inOut } }}
      transition={reduce ? { duration: 0.15, height: { duration: 0 } } : { height: { duration: 0.3, ease: ease.out }, opacity: { duration: 0.12 } }}
      className={cn("group/row relative flex px-4 outline-none", spaced ? "pt-2" : "pt-0.5", own ? "justify-end" : "justify-start", "focus-visible:bg-hover")}
    >
      {/* Swipe-left times: parked just past the right edge, pulled into view with the whole thread. */}
      <motion.span aria-hidden style={{ opacity: timesOpacity }} className="absolute -right-14 top-1/2 w-12 -translate-y-1/2 text-left text-[10.5px] tabular text-fg-4" suppressHydrationWarning>
        {time}
      </motion.span>

      {/* Reply hint revealed behind a message being swiped right. */}
      {swipe && <ReplyHint x={swipe} />}

      <motion.div
        style={{ x }}
        initial={arrived && !reduce ? { y: rise, scale: 0.96, filter: "blur(2px)" } : false}
        animate={{ y: 0, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.34, ease: ease.out }}
        className={cn("flex min-w-0 max-w-[82%] items-end gap-2 pointer-fine:max-w-[68%]", own ? "origin-bottom-right flex-row-reverse" : "origin-bottom-left")}
      >
        {withAvatars && !own && <span className="w-7 shrink-0">{row.showAvatar && <Face author={author} />}</span>}

        <div className={cn("flex min-w-0 flex-col", own ? "items-end" : "items-start")}>
          <span
            className="sr-only"
            suppressHydrationWarning
          >{`${own ? "You" : name}, ${fmt.full(date)}${own && m.status ? `, ${m.status === "failed" ? "not delivered" : m.status}` : ""}:`}</span>
          {row.showName && (
            <span aria-hidden className="mb-1 px-3 text-[11.5px] font-medium leading-4 text-fg-3">
              {name}
            </span>
          )}

          <div className={cn("relative flex min-w-0 items-center", own && "flex-row-reverse")}>
            {bare ? (
              <div data-bubble className="relative min-w-0">
                {m.content}
              </div>
            ) : (
              <div
                data-bubble
                className={cn(
                  // Phones read at 15px; the pointer-sized layout drops to the 13px product scale.
                  "relative flex flex-col gap-1.5 px-3 py-[7px] text-[15px] leading-[21px] [overflow-wrap:anywhere] sm:text-[13px] sm:leading-5",
                  // A quote needs room to be read; the bubble won't shrink it below 13rem.
                  m.replyTo ? "min-w-52" : "min-w-0",
                  own ? "bg-fg text-frame" : "bg-(--bubble) text-fg",
                  radius[position][own ? "own" : "other"],
                  failed && "opacity-70",
                )}
              >
                {m.replyTo && <ReplyQuote target={m.replyTo} onJump={onJump} className="-mx-1.5 mt-[-2px] w-auto" />}
                {m.content}
                {m.text && (
                  <p className="whitespace-pre-wrap text-pretty">
                    {m.text}
                    {m.edited && <span className="ml-1.5 text-[11px] opacity-60">edited</span>}
                  </p>
                )}
                {tail && <Tail own={own} />}
              </div>
            )}

            {/* Hover and focus cluster: the time, your ticks, and reply. It floats beside the bubble, so it
                costs the bubble no width; touch has no hover, so there a swipe shows times and replies. */}
            <div
              className={cn(
                "absolute top-1/2 flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap transition-[opacity,translate] duration-150 ease-out pointer-coarse:hidden",
                own ? "right-full mr-2" : "left-full ml-2",
                "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100",
                own ? "translate-x-1" : "-translate-x-1",
                "group-hover/row:translate-x-0 group-focus-within/row:translate-x-0 motion-reduce:translate-x-0",
                own && "flex-row-reverse",
              )}
            >
              <span suppressHydrationWarning className="text-[10.5px] leading-4 text-fg-4 tabular">
                {time}
              </span>
              {own && m.status && !showStatusLabel && <MessageStatus status={m.status} onRetry={onRetry ? () => onRetry(m) : undefined} />}
              {onReply && !failed && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Reply to ${own ? "your message" : name}`}
                  onClick={() => onReply(m)}
                  className={cn(
                    "relative grid size-7 place-items-center rounded-full text-fg-3 outline-none",
                    "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.9] active:duration-75",
                  )}
                >
                  <ReplyGlyph />
                </button>
              )}
            </div>
          </div>

          {showStatusLabel && m.status && (
            <div className="mt-1 flex justify-end px-1">
              <MessageStatus status={m.status} label onRetry={onRetry ? () => onRetry(m) : undefined} />
            </div>
          )}
        </div>
      </motion.div>
    </motion.li>
  );
}

function ReplyHint({ x }: { x: MotionValue<number> }) {
  const opacity = useTransform(x, [0, SWIPE_REPLY], [0, 1]);
  const scale = useTransform(x, [0, SWIPE_REPLY], [0.5, 1]);
  return (
    <motion.span aria-hidden style={{ opacity, scale }} className="absolute left-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-hover text-fg-2">
      <ReplyGlyph />
    </motion.span>
  );
}

function Tail({ own }: { own: boolean }) {
  // Overlaps the bubble by 5px so the join never shows a seam; the bubble's own color fills it.
  return (
    <svg
      aria-hidden
      width="11"
      height="16"
      viewBox="0 0 11 16"
      className={cn("pointer-events-none absolute bottom-0", own ? "-right-[6px] text-fg" : "-left-[6px] -scale-x-100 text-(--bubble)")}
    >
      <path d="M0 0H5C5 7 6.6 12.4 10.6 15.6 10.8 15.8 10.6 16 10.4 16 6.6 16 3.4 14.8 0 12.6Z" fill="currentColor" />
    </svg>
  );
}

function Face({ author }: { author?: ChatAuthor }) {
  const initials = (author?.name ?? "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <Avatar.Root className="grid size-7 select-none place-items-center overflow-hidden rounded-full bg-hover text-[10px] font-medium text-fg-2 shadow-[inset_0_0_0_1px_var(--line)]">
      {author?.avatar && <Avatar.Image src={author.avatar} alt="" width={28} height={28} className="size-full object-cover" />}
      <Avatar.Fallback delay={author?.avatar ? 400 : 0}>{initials}</Avatar.Fallback>
    </Avatar.Root>
  );
}

function TypingRow({ people, showAvatar, reduce }: { people: ChatAuthor[]; showAvatar: boolean; reduce: boolean }) {
  const names = people.map((p) => p.name.split(" ")[0]);
  const text = names.length === 1 ? `${names[0]} is typing` : names.length === 2 ? `${names[0]} and ${names[1]} are typing` : `${names.length} people are typing`;
  return (
    <motion.li
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0, transition: { duration: reduce ? 0 : 0.16 } }}
      transition={reduce ? { duration: 0.15, height: { duration: 0 } } : { height: { duration: 0.26, ease: ease.out }, opacity: { duration: 0.12 } }}
      className="flex px-4 pt-2"
    >
      <motion.div initial={reduce ? false : { y: 10, scale: 0.9 }} animate={{ y: 0, scale: 1 }} transition={spring.soft} className="flex origin-bottom-left items-end gap-2">
        {showAvatar && (
          <span className="w-7 shrink-0">
            <Face author={people[0]} />
          </span>
        )}
        <span role="status" aria-label={text} className="relative flex h-9 items-center gap-1 rounded-[18px] rounded-bl-[4px] bg-(--bubble) px-3.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-1.5 rounded-full bg-fg-3 motion-safe:animate-dot-wave" style={{ animationDelay: `${i * 0.16}s` }} />
          ))}
          <Tail own={false} />
        </span>
      </motion.div>
    </motion.li>
  );
}

function DefaultEmpty() {
  return (
    <div className="flex max-w-[240px] flex-col items-center gap-1">
      <p className="text-[13px] font-medium text-fg">No messages yet</p>
      <p className="text-[12.5px] leading-[18px] text-fg-3">Messages you send and receive here will show up in order.</p>
    </div>
  );
}

function ReplyGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6.5 4 3 7.5 6.5 11M3 7.5h6a4 4 0 0 1 4 4v1" />
    </svg>
  );
}
