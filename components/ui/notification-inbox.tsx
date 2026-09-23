"use client";
import { Popover } from "@base-ui/react/popover";
import { Tabs } from "@base-ui/react/tabs";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Bell } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";
import { CountBadge } from "@/components/ui/count-badge";

export type InboxNotification = {
  id: string;
  /** What happened. Bold the actor and the object yourself: <><b>Maya</b> commented on <b>Q3 forecast</b></>. */
  title: React.ReactNode;
  /** A line of the comment or change, shown quieter under the title. */
  preview?: string;
  time: Date | number | string;
  /** Initials are drawn from this. */
  actor?: string;
  /** For system notifications with no person behind them. Replaces the initials. */
  icon?: React.ReactNode;
  read?: boolean;
  /** Also listed under Mentions. */
  mention?: boolean;
};

type Tab = "all" | "mentions";

const toMs = (t: InboxNotification["time"]) => (t instanceof Date ? t.getTime() : typeof t === "number" ? t : Date.parse(t));
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// One shared minute clock for every open list, so relative times ("4m") stay honest.
let clockNow = 0;
const subscribeClock = (notify: () => void) => {
  const tick = () => {
    clockNow = Date.now();
    notify();
  };
  tick();
  const id = window.setInterval(tick, 60_000);
  return () => window.clearInterval(id);
};

/** Wall-clock time that refreshes once a minute while mounted. 0 on the server. */
function useNow() {
  return useSyncExternalStore(
    subscribeClock,
    () => clockNow,
    () => 0,
  );
}

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** "now", "4m", "3h", "1d", "Mon", "12 Sep": short enough to sit in a row. The full date is on hover. */
function shortTime(ms: number, now: number) {
  const diff = Math.max(0, now - ms);
  const today = startOfDay(now);
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (ms >= today) return `${Math.floor(diff / 3_600_000)}h`;
  if (ms >= today - 86_400_000) return "1d";
  if (ms >= today - 6 * 86_400_000) return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(ms);
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(ms);
}
const fullTime = (ms: number) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(ms);

export type NotificationInboxProps = Omit<React.ComponentProps<"button">, "children" | "onClick"> & {
  items?: InboxNotification[];
  defaultItems?: InboxNotification[];
  onItemsChange?: (items: InboxNotification[]) => void;
  /** Called when a notification is opened. It is marked read first. */
  onOpenItem?: (item: InboxNotification) => void;
  /** Called after an archive is final, once its undo window has passed. */
  onArchive?: (item: InboxNotification) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Skeleton rows in place of the list, for the first load. */
  loading?: boolean;
  /** The bell's name and the panel's title. */
  label?: string;
  /** A link or button at the bottom right of the panel, e.g. notification settings. */
  footer?: React.ReactNode;
};

export function NotificationInbox({
  items: itemsProp,
  defaultItems = [],
  onItemsChange,
  onOpenItem,
  onArchive,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  loading = false,
  label = "Notifications",
  footer,
  className,
  ...rest
}: NotificationInboxProps) {
  const reduce = useReducedMotion();
  const [items, setItems] = useControllableState({ value: itemsProp, defaultValue: defaultItems, onChange: onItemsChange });
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const [tab, setTab] = useState<Tab>("all");
  const [undo, setUndo] = useState<{ item: InboxNotification; index: number } | null>(null);
  const undoTimer = useRef(0);
  const tabRef = useRef<HTMLButtonElement>(null);
  const [bell, ring] = useAnimate<HTMLSpanElement>();
  const unread = items.filter((i) => !i.read).length;
  const mentionsUnread = items.filter((i) => i.mention && !i.read).length;

  // The bell swings once when something new lands, never on load or when the count drops.
  const previous = useRef(unread);
  useEffect(() => {
    const was = previous.current;
    previous.current = unread;
    if (reduce || unread <= was || !bell.current) return;
    ring(bell.current, { rotate: [0, 14, -11, 7, -4, 0] }, { duration: 0.6, ease: "easeOut" });
  }, [unread, reduce, ring, bell]);

  // An archive becomes final when its undo window closes, the panel closes, or another archive replaces it.
  const pendingUndo = useRef<{ item: InboxNotification; index: number } | null>(null);
  const finalize = useCallback(() => {
    window.clearTimeout(undoTimer.current);
    const done = pendingUndo.current;
    pendingUndo.current = null;
    if (done) onArchive?.(done.item);
    setUndo(null);
  }, [onArchive]);
  useEffect(() => () => window.clearTimeout(undoTimer.current), []);

  const archive = (item: InboxNotification) => {
    const index = items.findIndex((i) => i.id === item.id);
    if (index < 0) return;
    if (pendingUndo.current) onArchive?.(pendingUndo.current.item);
    pendingUndo.current = { item, index };
    setItems(items.filter((i) => i.id !== item.id));
    setUndo({ item, index });
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(finalize, 5000);
  };
  const restore = () => {
    if (!undo) return;
    window.clearTimeout(undoTimer.current);
    pendingUndo.current = null;
    const next = [...items];
    next.splice(Math.min(undo.index, next.length), 0, undo.item);
    setItems(next);
    setUndo(null);
  };
  const markAllRead = () => setItems(items.map((i) => (i.read ? i : { ...i, read: true })));
  const openItem = (item: InboxNotification) => {
    if (!item.read) setItems(items.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
    onOpenItem?.({ ...item, read: true });
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) finalize();
      }}
    >
      <Popover.Trigger
        data-slot="notification-inbox"
        className={cn(
          "group/bell relative grid size-8 shrink-0 place-items-center rounded-lg text-fg-2 outline-none",
          "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.94] active:duration-75 data-popup-open:bg-hover data-popup-open:text-fg",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden",
          className,
        )}
        {...rest}
      >
        {/* Named by text, not aria-label, so the badge's "3 unread" joins the name. */}
        <span className="sr-only">{label}</span>
        <span ref={bell} className="grid origin-[50%_2px] place-items-center">
          <Bell />
        </span>
        <CountBadge count={unread} size="sm" position="top-right" className="right-1! top-1!" label={(n) => `${n} unread`} announce />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={12} className="z-(--z-popover)">
          <Popover.Popup
            initialFocus={tabRef}
            className={cn(
              "flex max-h-[min(520px,var(--available-height))] w-[380px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
              "origin-(--transform-origin) transition-[opacity,scale,translate] duration-200 ease-out-expo",
              "data-starting-style:-translate-y-1 data-starting-style:scale-[0.96] data-starting-style:opacity-0",
              "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-120 data-ending-style:ease-out",
              "motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:scale-100",
            )}
          >
            <Tabs.Root value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between gap-3 px-3.5 pt-3">
                <Popover.Title className="text-[14px] font-medium tracking-[-0.015em] text-fg">{label}</Popover.Title>
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={unread === 0}
                  className="-mr-1.5 h-7 rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none transition-[background-color,color,opacity,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3"
                >
                  Mark all read
                </button>
              </div>
              <Tabs.List className="relative mt-1.5 flex gap-4 border-b border-line px-3.5">
                {(
                  [
                    ["all", "All", unread],
                    ["mentions", "Mentions", mentionsUnread],
                  ] as const
                ).map(([value, text, count], i) => (
                  <Tabs.Tab
                    key={value}
                    value={value}
                    ref={i === 0 ? tabRef : undefined}
                    className="flex h-9 items-center gap-1.5 text-[12.5px] text-fg-3 outline-none transition-colors duration-150 hover:text-fg-2 data-active:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-[-6px] focus-visible:outline-fg-3"
                  >
                    {text}
                    <CountBadge count={count} tone="muted" size="sm" label={(n) => `${n} unread`} />
                  </Tabs.Tab>
                ))}
                <Tabs.Indicator className="absolute bottom-[-1px] left-0 h-px w-(--active-tab-width) translate-x-(--active-tab-left) bg-fg transition-[translate,width] duration-200 ease-in-out-quart" />
              </Tabs.List>

              {(["all", "mentions"] as const).map((value) => (
                <Tabs.Panel key={value} value={value} tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
                  {loading ? (
                    <Skeleton />
                  ) : (
                    <InboxList
                      items={value === "all" ? items : items.filter((i) => i.mention)}
                      empty={value === "all" ? ["You’re all caught up", "New activity shows up here."] : ["No mentions", "When someone @mentions you, it lands here."]}
                      onOpen={openItem}
                      onArchive={archive}
                    />
                  )}
                </Tabs.Panel>
              ))}
            </Tabs.Root>

            <div className="relative flex h-10 shrink-0 items-center justify-between gap-3 overflow-hidden border-t border-line px-3.5 text-[12px] text-fg-3">
              <AnimatePresence initial={false} mode="popLayout">
                {undo ? (
                  <motion.div
                    key="undo"
                    role="status"
                    className="flex min-w-0 flex-1 items-center justify-between gap-3"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, transition: { duration: 0.14, ease: ease.in } }}
                    transition={reduce ? { duration: 0.12 } : spring.snappy}
                  >
                    <span className="min-w-0 truncate text-fg-2">Archived</span>
                    <button
                      type="button"
                      onClick={restore}
                      className="-mr-1.5 h-7 shrink-0 rounded-md px-2 font-medium text-fg outline-none transition-[background-color,scale] duration-150 hover:bg-hover active:scale-[0.96] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3"
                    >
                      Undo
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="hints"
                    className="flex min-w-0 flex-1 items-center justify-between gap-3"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12, transition: { duration: 0.14, ease: ease.in } }}
                    transition={reduce ? { duration: 0.12 } : spring.snappy}
                  >
                    <span className="flex min-w-0 items-center gap-1.5 truncate pointer-coarse:invisible">
                      <Kbd>↑</Kbd>
                      <Kbd>↓</Kbd>
                      <span className="mr-1.5">move</span>
                      <Kbd>E</Kbd>
                      <span>archive</span>
                    </span>
                    {footer}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="grid h-[18px] min-w-[18px] place-items-center rounded border border-line-2 bg-frame px-1 font-mono text-2xs text-fg-3">{children}</kbd>;
}

function InboxList({
  items,
  empty,
  onOpen,
  onArchive,
}: {
  items: InboxNotification[];
  empty: [string, string];
  onOpen: (item: InboxNotification) => void;
  onArchive: (item: InboxNotification) => void;
}) {
  const reduce = useReducedMotion();
  const now = useNow();
  const list = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const sorted = [...items].sort((a, b) => toMs(b.time) - toMs(a.time));
  const today = now ? startOfDay(now) : 0;
  const groups = [
    { key: "today", title: "Today", rows: sorted.filter((i) => toMs(i.time) >= today) },
    { key: "earlier", title: "Earlier", rows: sorted.filter((i) => toMs(i.time) < today) },
  ].filter((g) => g.rows.length);
  const order = groups.flatMap((g) => g.rows);
  // Roving focus: one row is in the tab order; arrows move between rows.
  const current = order.some((i) => i.id === active) ? active : (order[0]?.id ?? null);

  const focusRow = (id: string | undefined) => {
    if (!id) return;
    setActive(id);
    list.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"]`)?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent, item: InboxNotification) => {
    const at = order.findIndex((i) => i.id === item.id);
    const key = e.key.toLowerCase();
    if (key === "arrowdown" || key === "j") focusRow(order[Math.min(order.length - 1, at + 1)]?.id);
    else if (key === "arrowup" || key === "k") focusRow(order[Math.max(0, at - 1)]?.id);
    else if (key === "home") focusRow(order[0]?.id);
    else if (key === "end") focusRow(order[order.length - 1]?.id);
    else if (key === "e" || key === "delete" || key === "backspace") {
      const next = order[at + 1] ?? order[at - 1];
      const tab = list.current?.closest("[role=dialog]")?.querySelector<HTMLElement>("[role=tab][aria-selected=true]");
      onArchive(item);
      // Keep the keyboard where the list was: on the row that slides into place, or the tab once the list is empty.
      requestAnimationFrame(() => (next ? focusRow(next.id) : tab?.focus()));
    } else return;
    e.preventDefault();
  };

  if (!order.length) return <Empty title={empty[0]} body={empty[1]} />;

  let row = 0;
  return (
    <ul ref={list} aria-label="Notifications" className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1.5">
      <AnimatePresence initial={false} mode="popLayout">
        {groups.map((group) => [
          <motion.li
            key={`h-${group.key}`}
            layout={reduce ? false : "position"}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="sticky top-0 z-[1] bg-raised/95 px-3.5 pb-1 pt-3 font-mono text-2xs uppercase tracking-[0.08em] text-fg-4 backdrop-blur-[2px]"
            aria-hidden
          >
            {group.title}
          </motion.li>,
          ...group.rows.map((item) => {
            const index = row++;
            const ms = toMs(item.time);
            return (
              <motion.li
                key={item.id}
                layout={reduce ? false : "position"}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, x: 24, transition: { duration: 0.18, ease: ease.in } }}
                transition={reduce ? { duration: 0.15 } : spring.soft}
                className="group/row relative px-1.5"
              >
                <button
                  type="button"
                  data-row={item.id}
                  tabIndex={item.id === current ? 0 : -1}
                  onFocus={() => setActive(item.id)}
                  onClick={() => onOpen(item)}
                  onKeyDown={(e) => onKeyDown(e, item)}
                  title={now ? fullTime(ms) : undefined}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg py-2.5 pl-2 pr-12 text-left outline-none transition-colors duration-150",
                    "hover:bg-hover focus-visible:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
                  )}
                >
                  {/* The unread dot lives in a fixed gutter, so reading a row changes nothing but the dot and the text color. */}
                  <span className="relative mt-[11px] grid size-1.5 shrink-0 place-items-center">
                    <AnimatePresence initial={false}>
                      {!item.read && (
                        <motion.span
                          key="dot"
                          className="absolute inset-0 rounded-full bg-fg"
                          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.3 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={
                            reduce
                              ? { opacity: 0, transition: { duration: 0.12 } }
                              : { opacity: 0, scale: 0.3, transition: { duration: 0.2, ease: ease.out, delay: Math.min(index, 8) * 0.025 } }
                          }
                          transition={spring.pop}
                        />
                      )}
                    </AnimatePresence>
                  </span>
                  <span
                    aria-hidden
                    className="grid size-7 shrink-0 place-items-center rounded-full bg-hover text-[10.5px] font-medium text-fg-2 shadow-[inset_0_0_0_1px_var(--line-2)] [&_svg]:size-3.5"
                  >
                    {item.icon ?? (item.actor ? initials(item.actor) : <Bell />)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-[13px] leading-[1.4] transition-colors duration-300 [&_b]:font-medium", item.read ? "text-fg-2 [&_b]:text-fg-2" : "text-fg-2 [&_b]:text-fg")}>
                      {item.title}
                    </span>
                    {item.preview && <span className="mt-0.5 block truncate text-[12.5px] text-fg-3">{item.preview}</span>}
                    <span className="mt-0.5 hidden text-[12px] text-fg-3 tabular pointer-coarse:block">{now ? shortTime(ms, now) : ""}</span>
                    {!item.read && <span className="sr-only">, unread</span>}
                  </span>
                </button>
                {/* Time and archive share one box on the right: hover or focus swaps one for the other. */}
                <span className="pointer-events-none absolute right-3 top-2.5 grid h-7 w-8 place-items-center">
                  <time
                    dateTime={now ? new Date(ms).toISOString() : undefined}
                    className="col-start-1 row-start-1 text-[12px] text-fg-3 tabular transition-opacity duration-150 group-focus-within/row:opacity-0 group-hover/row:opacity-0 pointer-coarse:hidden"
                  >
                    {now ? shortTime(ms, now) : ""}
                  </time>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Archive"
                    title="Archive (E)"
                    onClick={() => onArchive(item)}
                    className={cn(
                      "pointer-events-auto col-start-1 row-start-1 grid size-7 place-items-center rounded-md text-fg-3 opacity-0 outline-none transition-[opacity,background-color,color,scale] duration-150",
                      "hover:bg-line hover:text-fg active:scale-[0.9] group-focus-within/row:opacity-100 group-hover/row:opacity-100 pointer-coarse:opacity-100",
                      "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
                    )}
                  >
                    <ArchiveIcon />
                  </button>
                </span>
              </motion.li>
            );
          }),
        ])}
      </AnimatePresence>
    </ul>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-12 text-center"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: ease.out, delay: 0.1 }}
    >
      <span className="mb-2 grid size-9 place-items-center rounded-full bg-hover text-fg-3 shadow-[inset_0_0_0_1px_var(--line-2)]">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 11V7a4 4 0 0 1 8 0v4l1.25 1.25H2.75zM6.5 13.75a1.6 1.6 0 0 0 3 0" />
          <motion.path d="m6.1 7.6 1.3 1.3 2.5-2.7" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, ease: ease.out, delay: 0.25 }} />
        </svg>
      </span>
      <p className="text-[13px] font-medium text-fg">{title}</p>
      <p className="max-w-[28ch] text-[12.5px] text-fg-3 [text-wrap:balance]">{body}</p>
    </motion.div>
  );
}

function Skeleton() {
  return (
    <div aria-busy className="flex flex-col gap-1 px-3.5 py-3" aria-label="Loading notifications">
      {[0.72, 0.9, 0.6].map((w, i) => (
        <div key={i} className="flex items-start gap-2.5 py-2 pl-3.5">
          <span className="size-7 shrink-0 rounded-full bg-hover" />
          <span className="flex flex-1 flex-col gap-1.5 pt-1">
            <span className="h-2.5 rounded bg-hover" style={{ width: `${w * 100}%` }} />
            <span className="h-2.5 w-2/5 rounded bg-hover" />
          </span>
        </div>
      ))}
    </div>
  );
}

function ArchiveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.25" y="3" width="11.5" height="3" rx=".75" />
      <path d="M3.25 6v6.25c0 .4.35.75.75.75h8c.4 0 .75-.35.75-.75V6M6.5 8.75h3" />
    </svg>
  );
}
