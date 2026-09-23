"use client";
import { Menu } from "@base-ui/react/menu";
import NumberFlow from "@number-flow/react";
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform, useVelocity } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { ArrowDown, ArrowUp, Check, MoreH } from "@/lib/icons";
import { spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type KanbanColumn = {
  id: string;
  title: string;
  /** A work-in-progress limit. The count reads "n/limit" and turns to a warning when it's passed. */
  limit?: number;
};

export type KanbanCardData = { id: string; column: string };

export type KanbanMove<T> = { card: T; from: string; to: string; index: number };

export type KanbanProps<T extends KanbanCardData> = Omit<React.ComponentProps<"div">, "children" | "defaultValue" | "onChange"> & {
  columns: KanbanColumn[];
  /** Every card, grouped by `column`; order within a column is the order in this array. Controlled. */
  value?: T[];
  defaultValue?: T[];
  /** Called with the whole new array after any move. */
  onValueChange?: (cards: T[]) => void;
  /** Called once per move with what moved and where. The place to save. */
  onCardMove?: (move: KanbanMove<T>) => void;
  /** The card's content. Keep buttons out of it: the whole card is the drag handle. The move menu sits in the top-right corner, so leave the first line about 20px of room at its end. */
  renderCard: (card: T) => React.ReactNode;
  /** Plain-text name for the card's menu and the announcements. */
  getCardLabel: (card: T) => string;
  /** Freezes the board: nothing can be dragged or moved. */
  disabled?: boolean;
  /** Shown in a column with no cards. */
  emptyLabel?: string;
};

// Mouse and pen start after a few pixels so a click stays a click; touch waits for a short
// hold so a swipe still scrolls the board.
const THRESHOLD = 5;
const HOLD_MS = 200;
const HOLD_SLOP = 8;
const EDGE = 48;
const GAP = 6;

type Target = { column: string; index: number };
type Ghost = { id: string; phase: "dragging" | "settling"; width: number };
type Line = { column: string; top: number } | null;

const cardClass = cn(
  "relative select-none rounded-lg border border-line bg-raised px-3 py-2.5 text-[13px] text-fg shadow-[var(--shadow)]",
  "[-webkit-touch-callout:none]",
);

const q = (root: ParentNode | null | undefined, sel: string) => root?.querySelector<HTMLElement>(sel) ?? null;
const cardSel = (id: string) => `[data-card-id="${CSS.escape(id)}"]`;

/** A board of columns whose cards move by drag, by menu, or with Alt and the arrow keys. */
export function Kanban<T extends KanbanCardData>({
  columns,
  value,
  defaultValue,
  onValueChange,
  onCardMove,
  renderCard,
  getCardLabel,
  disabled = false,
  emptyLabel = "No cards",
  className,
  ...rest
}: KanbanProps<T>) {
  const [cards, setCards] = useControllableState<T[]>({ value, defaultValue: defaultValue ?? [], onChange: onValueChange });
  const reduce = !!useReducedMotion();
  const uid = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [menu] = useState(() => Menu.createHandle<string>());

  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [line, setLine] = useState<Line>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<{ id: string; to: string; index: number } | null>(null);
  const focusAfter = useRef<string | null>(null);

  // The ghost lives in a fixed layer above the page, so no column's scroll box can clip it.
  const gx = useMotionValue(0);
  const gy = useMotionValue(0);
  const gScale = useMotionValue(1);
  // It leans into fast horizontal moves and rights itself when the hand stops.
  const lean = useTransform(useVelocity(gx), [-1600, 0, 1600], [-4, 0, 4], { clamp: true });
  const rotate = useSpring(lean, { stiffness: 380, damping: 30 });

  const session = useRef<{
    id: string;
    label: string;
    pointerId: number;
    startX: number;
    startY: number;
    grabX: number;
    grabY: number;
    x: number;
    y: number;
    started: boolean;
    target: Target | null;
    hold?: number;
    frame?: number;
    cleanup: () => void;
  } | null>(null);

  const byColumn = (list: T[], col: string) => list.filter((c) => c.column === col);
  const titleOf = (col: string) => columns.find((c) => c.id === col)?.title ?? col;

  // Moves one card and reports it. `index` counts the destination column without the card.
  const commitMove = (id: string, to: string, index: number) => {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    const without = cards.filter((c) => c.id !== id);
    const dest = byColumn(without, to);
    const i = Math.max(0, Math.min(index, dest.length));
    const at = i < dest.length ? without.indexOf(dest[i]) : dest.length ? without.indexOf(dest[dest.length - 1]) + 1 : without.length;
    const moved = { ...card, column: to } as T;
    without.splice(at, 0, moved);
    setCards(without);
    onCardMove?.({ card: moved, from: card.column, to, index: i });
    setMessage(`${getCardLabel(card)} moved to ${titleOf(to)}, position ${i + 1} of ${dest.length + 1}.`);
  };

  /* ---------------------------------------------------------------------------------------------
   * Pointer
   * -------------------------------------------------------------------------------------------*/

  // Which column and slot the pointer is over. Cards don't move during a drag (the source stays
  // in place, dimmed), so the rects read here are stable and there's nothing to flicker.
  const hitTest = (x: number, y: number, id: string): Target | null => {
    const bodies = Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-kanban-body]") ?? []);
    const board = boardRef.current?.getBoundingClientRect();
    if (!board || y < board.top - EDGE || y > board.bottom + EDGE) return null;
    let body: HTMLElement | undefined;
    let best = Infinity;
    for (const b of bodies) {
      const r = b.getBoundingClientRect();
      const d = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      if (d < best) {
        best = d;
        body = b;
      }
    }
    if (!body || best > EDGE) return null;
    const cardsIn = Array.from(body.querySelectorAll<HTMLElement>(":scope > [data-card-id]")).filter((el) => el.dataset.cardId !== id);
    const index = cardsIn.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2 < y;
    }).length;
    return { column: body.dataset.kanbanBody!, index };
  };

  // The insertion line sits in the gap the card would drop into, in the body's scroll coordinates.
  // A drop that wouldn't change anything shows no line.
  const lineFor = (t: Target | null, id: string): Line => {
    if (!t) return null;
    const card = cards.find((c) => c.id === id);
    const list = byColumn(cards, t.column).filter((c) => c.id !== id);
    if (card?.column === t.column && byColumn(cards, t.column).findIndex((c) => c.id === id) === t.index) return null;
    const body = q(rootRef.current, `[data-kanban-body="${CSS.escape(t.column)}"]`);
    if (!body) return null;
    const el = (cid: string) => q(body, cardSel(cid));
    // An empty column says "Drop here" instead.
    if (!list.length) return null;
    if (t.index === 0) return { column: t.column, top: Math.max(2, (el(list[0].id)?.offsetTop ?? 0) - GAP / 2 - 1) };
    const prev = el(list[t.index - 1].id);
    return { column: t.column, top: prev ? prev.offsetTop + prev.offsetHeight + GAP / 2 - 1 : 6 };
  };

  const track = (t: Target | null, id: string) => {
    const next = lineFor(t, id);
    setOver(t?.column ?? null);
    setLine((l) => (l?.column === next?.column && l?.top === next?.top ? l : next));
  };

  const endSession = () => {
    const s = session.current;
    if (!s) return;
    window.clearTimeout(s.hold);
    if (s.frame) cancelAnimationFrame(s.frame);
    s.cleanup();
    session.current = null;
  };

  useEffect(
    () => () => {
      const s = session.current;
      if (!s) return;
      window.clearTimeout(s.hold);
      if (s.frame) cancelAnimationFrame(s.frame);
      s.cleanup();
    },
    [],
  );

  useGrabbingCursor(ghost?.phase === "dragging");

  // Near an edge, the board scrolls sideways and the column under the pointer scrolls up or down.
  const autoScroll = () => {
    const s = session.current;
    if (!s?.started) return;
    const speed = (d: number) => Math.round((1 - Math.max(0, d) / EDGE) * 14);
    let moved = false;
    const board = boardRef.current;
    if (board) {
      const r = board.getBoundingClientRect();
      const max = board.scrollWidth - board.clientWidth;
      const dx = s.x < r.left + EDGE && board.scrollLeft > 0 ? -speed(s.x - r.left) : s.x > r.right - EDGE && board.scrollLeft < max ? speed(r.right - s.x) : 0;
      if (dx) {
        board.scrollLeft += dx;
        moved = true;
      }
    }
    const body = s.target ? q(rootRef.current, `[data-kanban-body="${CSS.escape(s.target.column)}"]`) : null;
    if (body) {
      const r = body.getBoundingClientRect();
      const max = body.scrollHeight - body.clientHeight;
      const near = (d: number) => d < EDGE && d > -EDGE;
      const dy = near(s.y - r.top) && body.scrollTop > 0 ? -speed(s.y - r.top) : near(r.bottom - s.y) && body.scrollTop < max ? speed(r.bottom - s.y) : 0;
      if (dy) {
        body.scrollTop += dy;
        moved = true;
      }
    }
    if (moved) {
      s.target = hitTest(s.x, s.y, s.id);
      track(s.target, s.id);
    }
    s.frame = requestAnimationFrame(autoScroll);
  };

  const begin = () => {
    const s = session.current;
    if (!s) return;
    const inner = q(rootRef.current, `${cardSel(s.id)} [data-card-inner]`);
    const r = inner?.getBoundingClientRect();
    if (!r) return;
    s.started = true;
    gx.set(s.x - s.grabX);
    gy.set(s.y - s.grabY);
    gScale.set(1);
    if (!reduce) animate(gScale, 1.03, spring.snappy);
    setPressed(null);
    setGhost({ id: s.id, phase: "dragging", width: r.width });
    setMessage(`${s.label} picked up.`);
    s.target = hitTest(s.x, s.y, s.id);
    track(s.target, s.id);
    s.frame = requestAnimationFrame(autoScroll);
  };

  const finish = (drop: boolean) => {
    const s = session.current;
    if (!s) return;
    const { id, label, target } = s;
    endSession();
    setOver(null);
    setLine(null);
    const card = cards.find((c) => c.id === id);
    const from = card ? byColumn(cards, card.column).findIndex((c) => c.id === id) : -1;
    const noop = !target || (card?.column === target.column && from === target.index);
    setGhost((g) => (g ? { ...g, phase: "settling" } : g));
    if (drop && target && !noop) {
      commitMove(id, target.column, target.index);
    } else {
      setMessage(drop && !target ? `${label} returned. Drop it over a column to move it.` : `Move canceled. ${label} is back where it was.`);
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>, id: string, label: string) => {
    if (disabled || ghost || session.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as Element).closest("[data-move-trigger]")) return;
    const touch = e.pointerType === "touch";
    const r = e.currentTarget.getBoundingClientRect();

    const onMove = (ev: PointerEvent) => {
      const s = session.current;
      if (!s || ev.pointerId !== s.pointerId) return;
      s.x = ev.clientX;
      s.y = ev.clientY;
      if (!s.started) {
        const dist = Math.hypot(ev.clientX - s.startX, ev.clientY - s.startY);
        if (touch) {
          if (dist > HOLD_SLOP) {
            endSession();
            setPressed(null);
          }
          return;
        }
        if (dist < THRESHOLD) return;
        begin();
      }
      gx.set(s.x - s.grabX);
      gy.set(s.y - s.grabY);
      const t = hitTest(s.x, s.y, s.id);
      s.target = t;
      track(t, s.id);
    };
    const onUp = (ev: PointerEvent) => {
      const s = session.current;
      if (!s || ev.pointerId !== s.pointerId) return;
      if (!s.started) {
        endSession();
        setPressed(null);
      } else finish(true);
    };
    const onCancel = (ev: PointerEvent) => {
      const s = session.current;
      if (!s || ev.pointerId !== s.pointerId) return;
      if (!s.started) {
        endSession();
        setPressed(null);
      } else finish(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape" || !session.current?.started) return;
      ev.preventDefault();
      finish(false);
    };
    const onTouchMove = (ev: TouchEvent) => {
      if (session.current?.started) ev.preventDefault();
    };
    const onContext = (ev: Event) => {
      if (session.current) ev.preventDefault();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("contextmenu", onContext);

    session.current = {
      id,
      label,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      grabX: e.clientX - r.left,
      grabY: e.clientY - r.top,
      x: e.clientX,
      y: e.clientY,
      started: false,
      target: null,
      hold: touch ? window.setTimeout(begin, HOLD_MS) : undefined,
      cleanup: () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("contextmenu", onContext);
      },
    };
    setPressed(id);
  };

  // After a drop (or a menu move across columns) the ghost flies to wherever the card now lives,
  // then hands over to it. Measured after commit so it lands on the real slot.
  const settlingId = ghost?.phase === "settling" ? ghost.id : null;
  useLayoutEffect(() => {
    if (!settlingId) return;
    const inner = q(rootRef.current, `${cardSel(settlingId)} [data-card-inner]`);
    if (!inner) {
      setGhost(null);
      return;
    }
    inner.scrollIntoView({ block: "nearest", inline: "nearest" });
    const r = inner.getBoundingClientRect();
    const done = () => setGhost((g) => (g?.id === settlingId && g.phase === "settling" ? null : g));
    if (reduce) {
      done();
      return;
    }
    animate(gx, r.left, spring.soft);
    animate(gScale, 1, spring.soft);
    const flight = animate(gy, r.top, spring.soft);
    flight.then(done);
    return () => flight.stop();
  }, [settlingId, reduce, gx, gy, gScale]);

  /* ---------------------------------------------------------------------------------------------
   * Keyboard and menu
   * -------------------------------------------------------------------------------------------*/

  // A move to another column flies the card there in the ghost layer, so the destination
  // column's scroll box never clips it mid-flight. Moves within a column slide by layout.
  const moveWithFlight = (id: string, to: string, index: number) => {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    if (card.column !== to && !reduce) {
      const r = q(rootRef.current, `${cardSel(id)} [data-card-inner]`)?.getBoundingClientRect();
      if (r) {
        gx.set(r.left);
        gy.set(r.top);
        gScale.set(1);
        setGhost({ id, phase: "settling", width: r.width });
      }
    }
    focusAfter.current = id;
    commitMove(id, to, index);
  };

  // Keyboard focus follows the card to its new place.
  useLayoutEffect(() => {
    const id = focusAfter.current;
    if (!id) return;
    focusAfter.current = null;
    q(rootRef.current, `${cardSel(id)} [data-move-trigger]`)?.focus({ preventScroll: true });
  });

  const onTriggerKey = (e: React.KeyboardEvent, card: T) => {
    if (!e.altKey || disabled) return;
    const list = byColumn(cards, card.column);
    const i = list.findIndex((c) => c.id === card.id);
    const col = columns.findIndex((c) => c.id === card.column);
    if (e.key === "ArrowUp" && i > 0) moveWithFlight(card.id, card.column, i - 1);
    else if (e.key === "ArrowDown" && i < list.length - 1) moveWithFlight(card.id, card.column, i + 1);
    else if (e.key === "ArrowLeft" && col > 0) moveWithFlight(card.id, columns[col - 1].id, i);
    else if (e.key === "ArrowRight" && col < columns.length - 1) moveWithFlight(card.id, columns[col + 1].id, i);
    else return;
    e.preventDefault();
    // Alt+ArrowDown would otherwise also open the menu.
    (e as React.KeyboardEvent & { preventBaseUIHandler?: () => void }).preventBaseUIHandler?.();
  };

  const ghostCard = ghost ? cards.find((c) => c.id === ghost.id) : undefined;

  return (
    <div ref={rootRef} data-dragging={ghost?.phase === "dragging" ? "" : undefined} className={cn("relative flex min-h-0 flex-col", className)} {...rest}>
      <div
        ref={boardRef}
        className="flex min-h-0 flex-1 snap-x snap-mandatory scroll-px-1 gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none]"
      >
        {columns.map((col) => {
          const list = byColumn(cards, col.id);
          const headId = `${uid}-${col.id}`;
          const full = col.limit !== undefined && list.length > col.limit;
          const isOver = over === col.id && ghost?.phase === "dragging";
          return (
            <section
              key={col.id}
              aria-labelledby={headId}
              data-over={isOver ? "" : undefined}
              className={cn(
                "flex min-h-0 w-[224px] shrink-0 snap-start flex-col rounded-xl border border-line bg-frame",
                "transition-[border-color,background-color] duration-150",
                "data-over:border-line-2 data-over:bg-hover",
              )}
            >
              <header className="flex h-10 shrink-0 items-center justify-between gap-2 ps-3 pe-2.5">
                <h3 id={headId} className="truncate text-[13px] font-medium tracking-[-0.005em] text-fg">
                  {col.title}
                </h3>
                <span
                  data-full={full ? "" : undefined}
                  className="inline-flex h-5 shrink-0 items-center rounded-full px-1.5 font-mono text-[11px] text-fg-3 tabular transition-colors duration-200 data-full:bg-warning-soft data-full:text-warning"
                >
                  <NumberFlow value={list.length} animated={!reduce} />
                  {col.limit !== undefined && <span className="text-fg-4 in-data-full:text-warning/70">/{col.limit}</span>}
                  <span className="sr-only">
                    {` card${list.length === 1 ? "" : "s"}`}
                    {full ? `, over the limit of ${col.limit}` : ""}
                  </span>
                </span>
              </header>
              <ul
                data-kanban-body={col.id}
                aria-labelledby={headId}
                className="relative flex min-h-24 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-1.5 pb-1.5 [scrollbar-width:thin]"
              >
                {list.map((card) => {
                  const label = getCardLabel(card);
                  const source = ghost?.id === card.id;
                  return (
                    <motion.li
                      key={card.id}
                      data-card-id={card.id}
                      layout={reduce || source ? false : "position"}
                      transition={spring.soft}
                      className="group/card relative shrink-0"
                    >
                      <div
                        data-card-inner=""
                        data-pressed={pressed === card.id ? "" : undefined}
                        data-source={source && ghost?.phase === "dragging" ? "" : undefined}
                        onPointerDown={(e) => onPointerDown(e, card.id, label)}
                        className={cn(
                          cardClass,
                          // Opacity isn't transitioned: the hand-over from ghost to card must be a single frame.
                          "transition-[scale,border-color] duration-150 ease-out-quart data-pressed:scale-[0.98]",
                          !disabled && "cursor-grab touch-manipulation",
                          // The card it came from stays put, dimmed, so nothing reflows under the pointer.
                          "data-source:border-dashed data-source:opacity-40 data-source:shadow-none",
                          // Hidden under the landing ghost, but still focusable so keyboard focus can follow it.
                          source && ghost?.phase === "settling" && "opacity-0",
                        )}
                      >
                        {renderCard(card)}
                        <Menu.Trigger
                          handle={menu}
                          payload={card.id}
                          disabled={disabled}
                          data-move-trigger=""
                          aria-label={`Move ${label}`}
                          aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight"
                          onKeyDown={(e) => onTriggerKey(e, card)}
                          className={cn(
                            "absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-md text-fg-3 outline-none",
                            "transition-[opacity,background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92]",
                            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
                            // Shown on hover and focus with a mouse; always there on touch, where hover doesn't exist.
                            "opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 data-popup-open:bg-hover data-popup-open:text-fg data-popup-open:opacity-100 pointer-coarse:opacity-100",
                            "before:absolute before:-inset-2.5 before:content-[''] pointer-fine:before:hidden",
                            "disabled:hidden",
                          )}
                        >
                          <MoreH size={14} />
                        </Menu.Trigger>
                      </div>
                    </motion.li>
                  );
                })}
                {!list.length && (
                  <li
                    className="grid min-h-20 flex-1 place-items-center rounded-lg border border-dashed border-line-2 text-[12px] text-fg-4 transition-colors duration-150 in-data-over:border-fg-4 in-data-over:text-fg-3"
                  >
                    {isOver ? "Drop here" : emptyLabel}
                  </li>
                )}
                <AnimatePresence>
                  {line?.column === col.id && (
                    <motion.li
                      key={col.id}
                      aria-hidden
                      className="pointer-events-none absolute inset-x-2 top-0 z-10 flex h-0.5 items-center"
                      initial={{ opacity: 0, y: line.top, scaleX: reduce ? 1 : 0.6 }}
                      animate={{ opacity: 1, y: line.top, scaleX: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      transition={reduce ? { duration: 0 } : { ...spring.follow, opacity: { duration: 0.12 } }}
                    >
                      <span className="absolute -start-1 size-1.5 rounded-full border border-fg bg-frame" />
                      <span className="h-0.5 w-full rounded-full bg-fg" />
                    </motion.li>
                  )}
                </AnimatePresence>
              </ul>
            </section>
          );
        })}
      </div>

      <Menu.Root
        handle={menu}
        onOpenChangeComplete={(open) => {
          // Move after the menu has closed, so it never loses its anchor mid-exit.
          if (open || !pending) return;
          setPending(null);
          moveWithFlight(pending.id, pending.to, pending.index);
        }}
      >
        {({ payload }) => {
          const card = cards.find((c) => c.id === payload);
          if (!card) return null;
          const list = byColumn(cards, card.column);
          const i = list.findIndex((c) => c.id === card.id);
          const queue = (to: string, index: number) => setPending({ id: card.id, to, index });
          const alt = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌥" : "Alt ";
          return (
            <Menu.Portal>
              <Menu.Positioner side="bottom" align="end" sideOffset={4} collisionPadding={8} className="z-(--z-dropdown) outline-none">
                <Menu.Popup className={popupClass}>
                  <Menu.Item disabled={i <= 0} onClick={() => queue(card.column, i - 1)} className={itemClass}>
                    <ArrowUp size={14} className="text-fg-3" />
                    <span className="flex-1">Move up</span>
                    <Kbd>{alt}↑</Kbd>
                  </Menu.Item>
                  <Menu.Item disabled={i >= list.length - 1} onClick={() => queue(card.column, i + 1)} className={itemClass}>
                    <ArrowDown size={14} className="text-fg-3" />
                    <span className="flex-1">Move down</span>
                    <Kbd>{alt}↓</Kbd>
                  </Menu.Item>
                  <Menu.Separator className="-mx-1 my-1 h-px bg-line" />
                  <Menu.Group>
                    <Menu.GroupLabel className="px-2 pb-1 pt-1.5 font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">Move to</Menu.GroupLabel>
                    {columns.map((col) => {
                      const current = col.id === card.column;
                      const n = byColumn(cards, col.id).length;
                      return (
                        <Menu.Item key={col.id} disabled={current} onClick={() => queue(col.id, 0)} className={itemClass}>
                          <span className="grid size-3.5 place-items-center">{current && <Check size={14} />}</span>
                          <span className="min-w-0 flex-1 truncate">{col.title}</span>
                          <span className="font-mono text-[11px] text-fg-4 tabular">
                            {n}
                            {col.limit !== undefined && `/${col.limit}`}
                          </span>
                        </Menu.Item>
                      );
                    })}
                  </Menu.Group>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          );
        }}
      </Menu.Root>

      {ghost &&
        ghostCard &&
        createPortal(
          <motion.div
            aria-hidden
            className="pointer-events-none fixed left-0 top-0 z-(--z-popover)"
            style={{ x: gx, y: gy, scale: gScale, rotate: reduce || ghost.phase === "settling" ? 0 : rotate, width: ghost.width }}
          >
            <div
              data-phase={ghost.phase}
              className={cn(
                cardClass,
                "cursor-grabbing border-line-2 shadow-pop transition-[box-shadow,border-color] duration-200",
                "data-[phase=settling]:border-line data-[phase=settling]:shadow-[var(--shadow)]",
              )}
            >
              {renderCard(ghostCard)}
            </div>
          </motion.div>,
          document.body,
        )}

      <span role="status" aria-live="polite" className="sr-only">
        {message}
      </span>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="font-mono text-[11px] tracking-[0.04em] text-fg-4">{children}</kbd>;
}

// While a card is in the air the cursor stays a closed hand everywhere, and text can't be selected.
function useGrabbingCursor(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const style = document.body.style;
    const prev = { cursor: style.cursor, userSelect: style.userSelect };
    style.cursor = "grabbing";
    style.userSelect = "none";
    return () => {
      style.cursor = prev.cursor;
      style.userSelect = prev.userSelect;
    };
  }, [on]);
}

const popupClass = cn(
  "min-w-[200px] rounded-xl border border-line-2 bg-raised p-1 text-fg shadow-pop outline-none",
  "origin-(--transform-origin) transition-[opacity,scale,translate] duration-180 ease-out-expo",
  "data-starting-style:scale-96 data-starting-style:opacity-0 data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1",
  "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-120",
  "motion-reduce:scale-100 motion-reduce:translate-none",
);

const itemClass = cn(
  "flex h-8 cursor-default select-none items-center gap-2.5 rounded-lg px-2 text-[13px] outline-none pointer-coarse:h-10",
  "transition-colors duration-100 data-highlighted:bg-fg/[0.06] data-disabled:opacity-45",
);
