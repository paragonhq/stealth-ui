"use client";
import { Tooltip } from "@base-ui/react/tooltip";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls, type MotionValue } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Check, Undo, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type SwipeDirection = "left" | "right";
export type SwipeDeckTone = "neutral" | "danger" | "success" | "warning" | "info";
export type SwipeDeckChoice = { label: string; icon?: React.ReactNode; tone?: SwipeDeckTone };

export type SwipeDeckProps<T> = Omit<React.ComponentProps<"div">, "children" | "onChange"> & {
  items: T[];
  getKey: (item: T) => string;
  renderCard: (item: T, state: { top: boolean }) => React.ReactNode;
  /** Names a card in announcements: "Approved Hotel Lumen. 4 left". */
  getLabel?: (item: T) => string;
  /** Position of the top card in `items`. */
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  onSwipe?: (item: T, direction: SwipeDirection) => void;
  onUndo?: (item: T, direction: SwipeDirection) => void;
  left?: SwipeDeckChoice;
  right?: SwipeDeckChoice;
  /** Shown in the deck's place once every card is decided. */
  empty?: React.ReactNode;
  /** The reject, undo and approve buttons under the deck. */
  controls?: boolean;
  disabled?: boolean;
  /** Height of the card area in px. Cards fill it. */
  height?: number;
  /** Classes for the card area. */
  deckClassName?: string;
};

type Exit<T> = { id: string; key: string; item: T; dir: SwipeDirection; from: { x: number; y: number; rotate: number }; vx: number; vy: number; how: "gesture" | "pointer" | "keyboard" };

const tones: Record<SwipeDeckTone, { text: string; soft: string; stamp: string }> = {
  neutral: { text: "text-fg", soft: "bg-fg/[0.08]", stamp: "border-fg/25 bg-raised text-fg" },
  danger: { text: "text-danger", soft: "bg-danger-soft", stamp: "border-danger/40 bg-raised text-danger" },
  success: { text: "text-success", soft: "bg-success-soft", stamp: "border-success/40 bg-raised text-success" },
  warning: { text: "text-warning", soft: "bg-warning-soft", stamp: "border-warning/40 bg-raised text-warning" },
  info: { text: "text-info", soft: "bg-info-soft", stamp: "border-info/40 bg-raised text-info" },
};

const THROW = 0.34; // of the deck's width
const PEEK = 10; // px of each card showing under the one above
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const back = { type: "spring", stiffness: 380, damping: 30, mass: 0.9 } as const;

export function SwipeDeck<T>({
  items,
  getKey,
  renderCard,
  getLabel,
  index: indexProp,
  defaultIndex = 0,
  onIndexChange,
  onSwipe,
  onUndo,
  left = { label: "Skip", tone: "neutral" },
  right = { label: "Keep", tone: "neutral" },
  empty,
  controls = true,
  disabled = false,
  className,
  deckClassName,
  height = 380,
  onKeyDown,
  "aria-label": ariaLabel = "Cards",
  ...rest
}: SwipeDeckProps<T>) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useControllableState({ value: indexProp, defaultValue: defaultIndex, onChange: onIndexChange });
  const [history, setHistory] = useState<{ index: number; dir: SwipeDirection }[]>([]);
  const [exiting, setExiting] = useState<Exit<T>[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [dragging, setDragging] = useState(false);
  const nonce = useRef(0);

  const deckRef = useRef<HTMLDivElement>(null);
  const width = useMotionValue(320);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const lift = useMotionValue(1);
  // Which way the card tips: held by its top it swings like a door on the bottom hinge, held low it tips the other way.
  const grab = useMotionValue(1);
  // After a card leaves, the rest of the stack still owes this much of a step forward.
  const lag = useMotionValue(0);
  const enter = useMotionValue(1);
  const rotate = useTransform(() => (reduce ? 0 : (x.get() / width.get()) * 14 * grab.get()));
  const progress = useTransform(() => clamp(Math.abs(x.get()) / (width.get() * THROW)));
  const lean = useTransform(() => Math.sign(x.get()) * progress.get());
  const topY = useTransform(() => y.get() + PEEK * lag.get());
  const topScale = useTransform(() => lift.get() * (1 - 0.05 * lag.get()));
  const topOrigin = useTransform(() => (grab.get() > 0 ? "50% 110%" : "50% -10%"));

  const anims = useRef<AnimationPlaybackControls[]>([]);
  const g = useRef({ id: -1, x0: 0, y0: 0, bx: 0, by: 0, moved: false, samples: [] as { t: number; x: number; y: number }[] });
  const suppressClick = useRef(false);

  useEffect(() => {
    const el = deckRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => width.set(e.contentRect.width || 320));
    ro.observe(el);
    return () => {
      ro.disconnect();
      anims.current.forEach((a) => a.stop());
    };
  }, [width]);

  const stop = () => {
    anims.current.forEach((a) => a.stop());
    anims.current = [];
  };
  const run = (...a: AnimationPlaybackControls[]) => anims.current.push(...a);

  const top = items[index];
  // Only decisions behind the current card can be undone; a reset from outside clears the way back.
  const undoable = history.filter((h) => h.index < index);
  const remaining = Math.max(0, items.length - index);
  const labelOf = (item: T) => getLabel?.(item) ?? "Card";
  const choice = (dir: SwipeDirection) => (dir === "left" ? left : right);

  function decide(dir: SwipeDirection, how: Exit<T>["how"], vx = 0, vy = 0) {
    if (!top || disabled) return;
    stop();
    const key = getKey(top);
    setExiting((list) => [...list, { id: `${key}:${nonce.current++}`, key, item: top, dir, from: { x: x.get(), y: y.get(), rotate: rotate.get() }, vx, vy, how }]);
    // The next card is already partway forward if the drag pulled it; it finishes the step from there.
    const owed = 1 - progress.get();
    if (reduce || how === "keyboard") lag.set(0);
    else {
      lag.set(owed);
      run(animate(lag, 0, spring.soft));
    }
    x.set(0);
    y.set(0);
    grab.set(1);
    lift.set(1);
    enter.set(1);
    setHistory([...undoable.slice(-49), { index, dir }]);
    setIndex(index + 1);
    onSwipe?.(top, dir);
    const rest = remaining - 1;
    setAnnouncement(`${choice(dir).label}: ${labelOf(top)}. ${rest ? `${rest} left` : "No cards left"}.`);
  }

  function undo() {
    const last = undoable[undoable.length - 1];
    if (!last || disabled) return;
    const item = items[last.index];
    if (item === undefined) return;
    stop();
    const key = getKey(item);
    setExiting((list) => list.filter((e) => e.key !== key));
    setHistory(undoable.slice(0, -1));
    setIndex(last.index);
    lag.set(0);
    grab.set(1);
    lift.set(1);
    // It comes back from the side it left by, straightening as it lands.
    if (reduce) {
      x.set(0);
      y.set(0);
      enter.set(0);
      run(animate(enter, 1, { duration: 0.15 }));
    } else {
      enter.set(1);
      x.set((last.dir === "right" ? 1 : -1) * width.get() * 1.15);
      y.set(-16);
      run(animate(x, 0, spring.soft), animate(y, 0, spring.soft));
    }
    onUndo?.(item, last.dir);
    setAnnouncement(`Restored ${labelOf(item)}.`);
  }

  // ---- pointer --------------------------------------------------------------------------

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    stop();
    lag.set(0);
    const rect = e.currentTarget.getBoundingClientRect();
    if (Math.abs(x.get()) < 2) grab.set(e.clientY - rect.top < rect.height * 0.6 ? 1 : -1);
    g.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, bx: x.get(), by: y.get(), moved: false, samples: [] };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!reduce) run(animate(lift, 1.02, spring.snappy));
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = g.current;
    if (s.id !== e.pointerId) return;
    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (!s.moved) {
      if (Math.hypot(dx, dy) < 4) return;
      s.moved = true;
      setDragging(true);
    }
    x.set(s.bx + dx);
    // Vertical travel is damped: the deck is about left and right.
    y.set(s.by + dy * 0.3);
    s.samples.push({ t: performance.now(), x: x.get(), y: y.get() });
    if (s.samples.length > 10) s.samples.shift();
  }

  function onPointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    const s = g.current;
    if (s.id !== e.pointerId) return;
    s.id = -1;
    setDragging(false);
    if (!s.moved) {
      if (!reduce) run(animate(lift, 1, spring.snappy));
      return;
    }
    suppressClick.current = true;
    const now = performance.now();
    const recent = s.samples.filter((p) => now - p.t < 100);
    let vx = 0;
    let vy = 0;
    if (recent.length > 1 && e.type !== "pointercancel") {
      const a = recent[0];
      const b = recent[recent.length - 1];
      const dt = Math.max(1, b.t - a.t);
      vx = ((b.x - a.x) / dt) * 1000;
      vy = ((b.y - a.y) / dt) * 1000;
    }
    const px = x.get();
    const far = Math.abs(px) > width.get() * THROW;
    const flung = Math.abs(vx) > 600 && Math.sign(vx) === Math.sign(px) && Math.abs(px) > 24;
    if (e.type !== "pointercancel" && (far || flung)) return decide(px > 0 ? "right" : "left", "gesture", vx, vy);
    // Not far enough: it springs home carrying the release speed, so a half-hearted flick settles, not snaps.
    if (reduce) {
      x.set(0);
      y.set(0);
      lift.set(1);
    } else run(animate(x, 0, { ...back, velocity: vx }), animate(y, 0, { ...back, velocity: vy }), animate(lift, 1, spring.snappy));
  }

  const visible = items.slice(index, index + 4);

  return (
    <div className={cn("flex w-full max-w-[320px] flex-col items-center gap-5", className)} {...rest}>
      <div
        ref={deckRef}
        tabIndex={disabled ? -1 : 0}
        role="group"
        aria-roledescription="card stack"
        aria-label={ariaLabel}
        aria-keyshortcuts="ArrowLeft ArrowRight Backspace"
        data-state={dragging ? "dragging" : top ? "idle" : "empty"}
        data-disabled={disabled || undefined}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            e.stopPropagation();
            decide(e.key === "ArrowLeft" ? "left" : "right", "keyboard");
          } else if (e.key === "Backspace" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z")) {
            e.preventDefault();
            e.stopPropagation();
            undo();
          }
        }}
        className={cn(
          "relative w-full rounded-2xl outline-none",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-fg-3",
          deckClassName,
        )}
        style={{ height, marginBottom: PEEK * 2 }}
      >
        {/* Back to front, so the top card paints last. */}
        {visible
          .map((item, depth) => ({ item, depth }))
          .reverse()
          .map(({ item, depth }) =>
            depth === 0 ? (
              <motion.div
                key={getKey(item)}
                data-top=""
                style={{ x, y: topY, rotate, scale: topScale, opacity: enter, transformOrigin: topOrigin, zIndex: 10 }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
                onDragStart={(e) => e.preventDefault()}
                onClickCapture={(e) => {
                  if (suppressClick.current) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                  suppressClick.current = false;
                }}
                className={cn(
                  "absolute inset-0 touch-pan-y select-none",
                  disabled ? "cursor-default" : dragging ? "cursor-grabbing" : "cursor-grab",
                )}
              >
                <CardFrame>
                  {renderCard(item, { top: true })}
                  <Stamp choice={right} side="right" lean={lean} />
                  <Stamp choice={left} side="left" lean={lean} />
                </CardFrame>
              </motion.div>
            ) : (
              <BackCard key={getKey(item)} depth={depth} progress={progress} lag={lag}>
                {renderCard(item, { top: false })}
              </BackCard>
            ),
          )}

        {exiting.map((ex) => (
          <ExitCard
            key={ex.id}
            exit={ex}
            width={width.get()}
            reduce={!!reduce}
            onDone={() => setExiting((list) => list.filter((e) => e.id !== ex.id))}
          >
            <CardFrame>
              {renderCard(ex.item, { top: false })}
              <Stamp choice={choice(ex.dir)} side={ex.dir} lean={ex.dir === "right" ? 1 : -1} />
            </CardFrame>
          </ExitCard>
        ))}

        <AnimatePresence initial={false}>
          {!top && empty && (
            <motion.div
              key="empty"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, filter: "blur(2px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.3, ease: ease.out, delay: reduce ? 0 : 0.12 }}
              className="absolute inset-0 grid place-items-center rounded-2xl border border-dashed border-line-2"
            >
              {empty}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {controls && (
        <Tooltip.Provider delay={500}>
          <div className="flex items-center gap-4">
            <DeckButton label={left.label} shortcut="←" tone={left.tone ?? "neutral"} size="lg" lean={lean} side="left" disabled={disabled || !top} onClick={() => decide("left", "pointer")}>
              {left.icon ?? <X size={18} />}
            </DeckButton>
            <DeckButton label="Undo" shortcut="⌫" tone="neutral" size="sm" disabled={disabled || undoable.length === 0} onClick={undo}>
              <Undo />
            </DeckButton>
            <DeckButton label={right.label} shortcut="→" tone={right.tone ?? "neutral"} size="lg" lean={lean} side="right" disabled={disabled || !top} onClick={() => decide("right", "pointer")}>
              {right.icon ?? <Check size={18} />}
            </DeckButton>
          </div>
        </Tooltip.Provider>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Pieces
 * -----------------------------------------------------------------------------------------------*/

function CardFrame({ children }: { children: React.ReactNode }) {
  return <div className="relative h-full w-full overflow-hidden rounded-2xl border border-line-2 bg-raised shadow-pop">{children}</div>;
}

/** A card waiting its turn. It steps forward as the top card is dragged away. */
function BackCard({ depth, progress, lag, children }: { depth: number; progress: MotionValue<number>; lag: MotionValue<number>; children: React.ReactNode }) {
  const d = useTransform(() => Math.max(0, depth + lag.get() - progress.get()));
  const scale = useTransform(() => 1 - 0.05 * d.get());
  const y = useTransform(() => PEEK * d.get());
  const opacity = useTransform(() => {
    const v = d.get();
    return v <= 1 ? 1 : v <= 2 ? 1 - (v - 1) * 0.45 : 0.55 * clamp(3 - v);
  });
  return (
    <motion.div aria-hidden inert style={{ scale, y, opacity, zIndex: 10 - depth, transformOrigin: "50% 100%" }} className="pointer-events-none absolute inset-0">
      <CardFrame>{children}</CardFrame>
    </motion.div>
  );
}

function ExitCard<T>({ exit, width, reduce, onDone, children }: { exit: Exit<T>; width: number; reduce: boolean; onDone: () => void; children: React.ReactNode }) {
  const x = useMotionValue(exit.from.x);
  const y = useMotionValue(exit.from.y);
  const rotate = useMotionValue(exit.from.rotate);
  const opacity = useMotionValue(1);
  const done = useRef(onDone);

  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    const sign = exit.dir === "right" ? 1 : -1;
    const to = sign * (width * 1.25 + 80);
    let a: AnimationPlaybackControls[];
    if (reduce) a = [animate(opacity, 0, { duration: 0.16 })];
    else if (exit.how === "gesture") {
      // Leaves along the throw, never slower than it was let go.
      const vx = sign * Math.max(Math.abs(exit.vx), 900);
      a = [
        animate(x, to, { type: "spring", stiffness: 120, damping: 20, velocity: vx, restDelta: 40 }),
        animate(y, exit.from.y + exit.vy * 0.12, { type: "spring", stiffness: 120, damping: 20, velocity: exit.vy }),
        animate(rotate, exit.from.rotate + sign * 10, { duration: 0.4, ease: ease.out }),
      ];
    } else {
      const d = exit.how === "keyboard" ? 0.2 : 0.34;
      a = [
        animate(x, to, { duration: d, ease: ease.in }),
        animate(y, [0, -18, 12], { duration: d, ease: "easeOut" }),
        animate(rotate, sign * 16, { duration: d, ease: ease.in }),
      ];
    }
    let live = true;
    a[0].finished.then(() => live && done.current());
    return () => {
      live = false;
      a.forEach((c) => c.stop());
    };
  }, [exit, width, reduce, x, y, rotate, opacity]);

  return (
    <motion.div aria-hidden inert style={{ x, y, rotate, opacity, zIndex: 20, transformOrigin: "50% 110%" }} className="pointer-events-none absolute inset-0">
      {children}
    </motion.div>
  );
}

/** The verdict, written on the card as it leans toward that side. */
function Stamp({ choice, side, lean }: { choice: SwipeDeckChoice; side: SwipeDirection; lean: MotionValue<number> | number }) {
  const t = tones[choice.tone ?? "neutral"];
  const from = (v: number) => clamp(((side === "right" ? v : -v) - 0.2) / 0.6);
  const value = typeof lean === "number" ? from(lean) : undefined;
  const mv = useTransform(() => (typeof lean === "number" ? from(lean) : from(lean.get())));
  const scale = useTransform(() => 0.9 + 0.1 * mv.get());
  return (
    <motion.span
      aria-hidden
      style={{ opacity: value ?? mv, scale: value !== undefined ? 1 : scale }}
      className={cn(
        "pointer-events-none absolute top-4 flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium shadow-[var(--shadow)]",
        // It sits on the trailing edge, where it stays readable while the card travels.
        side === "right" ? "left-4 origin-left" : "right-4 origin-right",
        t.stamp,
      )}
    >
      <span className="grid size-3.5 place-items-center [&>svg]:size-3.5">{choice.icon ?? (side === "right" ? <Check /> : <X />)}</span>
      {choice.label}
    </motion.span>
  );
}

function DeckButton({
  label,
  shortcut,
  tone,
  size,
  lean,
  side,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut: string;
  tone: SwipeDeckTone;
  size: "sm" | "lg";
  lean?: MotionValue<number>;
  side?: SwipeDirection;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const t = tones[tone];
  // The button a drag would press lights up as the card leans its way.
  const fill = useTransform(() => (lean && side ? clamp((side === "right" ? lean.get() : -lean.get()) * 1.1) : 0));
  const grow = useTransform(() => 1 + 0.08 * fill.get());
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-keyshortcuts={shortcut === "←" ? "ArrowLeft" : shortcut === "→" ? "ArrowRight" : "Backspace"}
            disabled={disabled}
            onClick={onClick}
            className={cn(
              "relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-line-2 bg-raised shadow-[var(--shadow)] outline-none",
              "transition-[background-color,border-color,scale,opacity] duration-150 hover:border-fg-4 active:scale-[0.92] active:duration-75",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              "disabled:pointer-events-none disabled:opacity-40",
              size === "lg" ? cn("size-12", t.text) : "size-9 text-fg-2 hover:text-fg",
            )}
          />
        }
      >
        {size === "lg" && <motion.span aria-hidden style={{ opacity: fill }} className={cn("absolute inset-0", t.soft)} />}
        <motion.span style={{ scale: grow }} className="relative grid place-items-center">
          {children}
        </motion.span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner side="bottom" sideOffset={8} collisionPadding={8} className="z-(--z-tooltip)">
          <Tooltip.Popup
            className={cn(
              "flex origin-(--transform-origin) items-center gap-2 rounded-lg border border-line-2 bg-raised py-[3px] pl-2 pr-1 text-[12px] leading-5 text-fg shadow-pop",
              "transition-[opacity,scale] duration-150 ease-out-expo data-ending-style:duration-100",
              "data-starting-style:scale-96 data-starting-style:opacity-0 data-ending-style:opacity-0 data-instant:transition-none",
            )}
          >
            {label}
            <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-line-2 bg-frame px-1 font-sans text-[11px] leading-none text-fg-2">{shortcut}</kbd>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
