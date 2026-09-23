"use client";
import { Tooltip } from "@base-ui/react/tooltip";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls, type MotionValue } from "motion/react";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type SwipeSide = "start" | "end";
export type SwipeTone = "neutral" | "danger" | "success" | "warning" | "info";

export type SwipeAction = {
  id: string;
  /** A verb: "Archive", "Delete", "Mark read". Also the tooltip and accessible name. */
  label: string;
  icon: React.ReactNode;
  tone?: SwipeTone;
  /** The row leaves when this runs: it slides out and folds shut before `onAction` fires. */
  removes?: boolean;
  onAction: () => void;
};

export type SwipeActionsProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The row itself. Keep its own click target inside; drags never reach it as a click. */
  children: React.ReactNode;
  /** Revealed by swiping toward the end edge (right in LTR). The first is the outermost and the full-swipe action. */
  startActions?: SwipeAction[];
  /** Revealed by swiping toward the start edge (left in LTR). The first is the outermost and the full-swipe action. */
  endActions?: SwipeAction[];
  /** Swiping far enough runs the outermost action without a second tap. `true` for both sides. */
  fullSwipe?: boolean | SwipeSide;
  /** Which tray is open. `null` when the row rests closed. */
  open?: SwipeSide | null;
  defaultOpen?: SwipeSide | null;
  onOpenChange?: (open: SwipeSide | null) => void;
  /** The icon buttons that appear on hover and focus, for mouse and keyboard users. */
  toolbar?: boolean;
  /** Where the hover toolbar sits: centered on the row, or over its first line (where a timestamp usually is). */
  toolbarAlign?: "center" | "top";
  /** Width of each revealed action in px. */
  actionWidth?: number;
  disabled?: boolean;
  /** Classes for the sliding layer. It inherits the row's background so the trays stay hidden behind it. */
  contentClassName?: string;
};

type Phase = "idle" | "dragging" | "committing";

// Tray colors are soft while you're still deciding and turn solid once a full swipe will commit.
const tones: Record<SwipeTone, { soft: string; solid: string; hover: string }> = {
  neutral: { soft: "bg-fg/[0.07] text-fg", solid: "bg-fg text-frame", hover: "hover:bg-fg/[0.11]" },
  danger: { soft: "bg-danger-soft text-danger", solid: "bg-danger text-frame", hover: "hover:bg-danger/20" },
  success: { soft: "bg-success-soft text-success", solid: "bg-success text-frame", hover: "hover:bg-success/20" },
  warning: { soft: "bg-warning-soft text-warning", solid: "bg-warning text-frame", hover: "hover:bg-warning/20" },
  info: { soft: "bg-info-soft text-info", solid: "bg-info text-frame", hover: "hover:bg-info/20" },
};

/** The resistance of a scroll view pulled past its end: fast at first, never past `dim`. */
const rubber = (over: number, dim: number) => (over * dim * 0.55) / (dim + over * 0.55);
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const OPEN_EVENT = "swipe-actions:engage";
const settleSpring = { type: "spring", stiffness: 420, damping: 40, mass: 0.8 } as const;

export function SwipeActions({
  children,
  startActions = [],
  endActions = [],
  fullSwipe = true,
  open: openProp,
  defaultOpen = null,
  onOpenChange,
  toolbar = true,
  actionWidth = 72,
  disabled = false,
  className,
  contentClassName,
  toolbarAlign = "center",
  onKeyDown,
  ...rest
}: SwipeActionsProps) {
  const uid = useId();
  const reduce = useReducedMotion();
  const [open, setOpen] = useControllableState<SwipeSide | null>({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const [phase, setPhase] = useState<Phase>("idle");
  const [armed, setArmedState] = useState<SwipeSide | null>(null);
  // Which action on the armed side takes over the tray: the outermost for a full swipe, the pressed one for a tap.
  const [expand, setExpand] = useState(0);
  const [commits, setCommits] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const actions = { start: startActions, end: endActions };
  const reveal = (side: SwipeSide) => actions[side].length * actionWidth;
  const full = (side: SwipeSide) => fullSwipe === true || fullSwipe === side;

  // x is physical pixels; dir flips it to logical so "start" means the start edge in RTL too.
  const x = useMotionValue(defaultOpen === "start" ? startActions.length * actionWidth : defaultOpen === "end" ? -endActions.length * actionWidth : 0);
  const dir = useMotionValue(1);
  const logical = useTransform(() => x.get() * dir.get());
  const startRevealed = useTransform(() => Math.max(0, logical.get()));
  const endRevealed = useTransform(() => Math.max(0, -logical.get()));
  const armStart = useMotionValue(0);
  const armEnd = useMotionValue(0);

  const anim = useRef<AnimationPlaybackControls | null>(null);
  const armedRef = useRef<SwipeSide | null>(null);
  const targetRef = useRef<SwipeSide | null>(defaultOpen);
  const suppressClick = useRef(false);
  const g = useRef({ id: -1, x0: 0, y0: 0, base: 0, lock: null as null | "x" | "y", width: 0, samples: [] as { t: number; v: number }[] });
  const wheel = useRef({ active: false, base: 0, acc: 0, timer: 0 });

  useEffect(() => {
    if (rootRef.current && getComputedStyle(rootRef.current).direction === "rtl") dir.set(-1);
    return () => {
      anim.current?.stop();
      window.clearTimeout(wheel.current.timer);
    };
  }, [dir]);

  const width = () => rootRef.current?.getBoundingClientRect().width ?? 360;
  const armAt = (side: SwipeSide, w: number) => Math.max(reveal(side) + 56, w * 0.5);

  function setArmed(side: SwipeSide | null, index = 0) {
    if (side) setExpand(index);
    if (armedRef.current === side) return;
    armedRef.current = side;
    setArmedState(side);
    for (const [s, mv] of [["start", armStart], ["end", armEnd]] as const) {
      const to = s === side ? 1 : 0;
      if (reduce) mv.set(to);
      else animate(mv, to, spring.snappy);
    }
    // A tick under the thumb where the platform allows it. Coarse, Android only, harmless elsewhere.
    if (side) navigator.vibrate?.(8);
  }

  /** Maps a raw drag offset to where the row may actually be. */
  function constrain(l: number, w: number) {
    const side: SwipeSide = l >= 0 ? "start" : "end";
    const mag = Math.abs(l);
    const sign = Math.sign(l) || 1;
    const r = reveal(side);
    let out: number;
    if (!r) out = rubber(mag, 28);
    else if (mag <= r) out = mag;
    else if (full(side)) out = Math.min(mag, w);
    else out = r + rubber(mag - r, 56);
    if (armedRef.current && armedRef.current !== side) setArmed(null);
    if (r && full(side)) {
      const at = armAt(side, w);
      if (out >= at) setArmed(side);
      else if (armedRef.current === side && out < at - 24) setArmed(null);
    }
    return sign * out;
  }

  function moveTo(l: number) {
    x.set(l * dir.get());
  }

  function settle(side: SwipeSide | null, velocity = 0) {
    anim.current?.stop();
    setArmed(null);
    const target = (side === "start" ? reveal("start") : side === "end" ? -reveal("end") : 0) * dir.get();
    if (reduce) x.set(target);
    else anim.current = animate(x, target, { ...settleSpring, velocity: velocity * dir.get() });
    targetRef.current = side;
    setOpen(side);
  }

  function focusNextRow() {
    const root = rootRef.current;
    if (!root || !root.contains(document.activeElement)) return;
    const scope = root.closest("ul,ol,[role=list],[role=grid]") ?? document;
    const rows = Array.from(scope.querySelectorAll<HTMLElement>("[data-swipe-actions]")).filter((r) => r.dataset.state !== "committing" || r === root);
    const i = rows.indexOf(root);
    const next = rows[i + 1] ?? rows[i - 1];
    next?.querySelector<HTMLElement>('[data-swipe-content] :is(a[href],button,[tabindex="0"]):not([tabindex="-1"]):not(:disabled)')?.focus();
  }

  async function remove(side: SwipeSide, action: SwipeAction, how: "gesture" | "pointer" | "keyboard", velocity = 0) {
    const root = rootRef.current;
    if (!root) return;
    anim.current?.stop();
    setPhase("committing");
    const w = width();
    if (!reduce && how !== "keyboard") {
      setArmed(side, Math.max(0, actions[side].indexOf(action)));
      const target = (side === "start" ? w : -w) * dir.get();
      // A throw keeps its speed; a tap slides out on its own.
      anim.current =
        how === "gesture"
          ? animate(x, target, { type: "spring", stiffness: 380, damping: 42, velocity: velocity * dir.get(), restDelta: 2 })
          : animate(x, target, { duration: 0.2, ease: ease.in });
      await anim.current;
    }
    focusNextRow();
    await animate(root, reduce ? { opacity: 0 } : { height: [root.offsetHeight, 0], opacity: how === "keyboard" ? 0 : 1 }, { duration: reduce ? 0.12 : 0.22, ease: ease.inOut });
    action.onAction();
  }

  function run(side: SwipeSide, action: SwipeAction, how: "gesture" | "pointer" | "keyboard", velocity = 0) {
    if (action.removes) return void remove(side, action, how, velocity);
    action.onAction();
    setCommits((c) => c + 1);
    settle(null, velocity);
  }

  function release(velocity: number) {
    const l = logical.get();
    const side: SwipeSide = l >= 0 ? "start" : "end";
    if (armedRef.current) {
      const s = armedRef.current;
      const primary = actions[s][0];
      if (primary) return run(s, primary, "gesture", velocity);
    }
    const r = reveal(side);
    if (!r) return settle(null, velocity);
    const outward = side === "start" ? velocity : -velocity;
    let openIt = Math.abs(l) > r * 0.5;
    if (outward > 350) openIt = true;
    else if (outward < -350) openIt = false;
    settle(openIt ? side : null, velocity);
  }

  const velocityOf = (samples: { t: number; v: number }[]) => {
    const now = performance.now();
    const recent = samples.filter((s) => now - s.t < 100);
    if (recent.length < 2) return 0;
    const a = recent[0];
    const b = recent[recent.length - 1];
    return b.t === a.t ? 0 : ((b.v - a.v) / (b.t - a.t)) * 1000;
  };

  // ---- pointer ---------------------------------------------------------------------------

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled || phase === "committing" || (e.pointerType === "mouse" && e.button !== 0)) return;
    anim.current?.stop();
    g.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, base: logical.get(), lock: null, width: width(), samples: [] };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = g.current;
    if (s.id !== e.pointerId || s.lock === "y") return;
    const dx = (e.clientX - s.x0) * dir.get();
    const dy = e.clientY - s.y0;
    if (!s.lock) {
      if (Math.hypot(dx, dy) < 6) return;
      // Mostly sideways is a swipe; anything else belongs to the page's scroll.
      if (Math.abs(dx) < Math.abs(dy) * 1.2) {
        s.lock = "y";
        return;
      }
      s.lock = "x";
      e.currentTarget.setPointerCapture(e.pointerId);
      window.getSelection()?.removeAllRanges();
      window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: uid }));
      setPhase("dragging");
      // Pick up from the finger, not from the 6px threshold, so the row never jumps.
      s.x0 = e.clientX;
      s.base = logical.get();
    }
    const l = constrain(s.base + (e.clientX - s.x0) * dir.get(), s.width);
    moveTo(l);
    s.samples.push({ t: performance.now(), v: l });
    if (s.samples.length > 12) s.samples.shift();
  }

  function onPointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    const s = g.current;
    if (s.id !== e.pointerId) return;
    s.id = -1;
    if (s.lock !== "x") return;
    suppressClick.current = true;
    setPhase("idle");
    release(e.type === "pointercancel" ? 0 : velocityOf(s.samples));
  }

  // ---- trackpad: two-finger horizontal scroll swipes the row, like a desktop mail client ----

  const onWheel = useEffectEvent((e: WheelEvent) => {
    const w = wheel.current;
    if (disabled || phase === "committing") return;
    if (!w.active) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 2) return;
      anim.current?.stop();
      w.active = true;
      w.base = logical.get();
      w.acc = 0;
      g.current.samples = [];
      g.current.width = width();
      window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: uid }));
      setPhase("dragging");
    }
    e.preventDefault();
    w.acc -= e.deltaX * dir.get();
    const l = constrain(w.base + w.acc, g.current.width);
    moveTo(l);
    g.current.samples.push({ t: performance.now(), v: l });
    window.clearTimeout(w.timer);
    w.timer = window.setTimeout(() => {
      w.active = false;
      setPhase("idle");
      release(0);
    }, 140);
  });

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => onWheel(e);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // ---- closing from elsewhere ------------------------------------------------------------

  const closeFromOutside = useEffectEvent(() => {
    if (open && phase !== "committing") settle(null);
  });

  useEffect(() => {
    const onEngage = (e: Event) => {
      if ((e as CustomEvent).detail !== uid) closeFromOutside();
    };
    window.addEventListener(OPEN_EVENT, onEngage);
    return () => window.removeEventListener(OPEN_EVENT, onEngage);
  }, [uid]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) closeFromOutside();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  // A controlled `open` that changes from outside moves the row there.
  const follow = useEffectEvent((next: SwipeSide | null) => {
    if (phase !== "idle" || next === targetRef.current) return;
    targetRef.current = next;
    const target = (next === "start" ? reveal("start") : next === "end" ? -reveal("end") : 0) * dir.get();
    if (Math.abs(x.get() - target) < 0.5) return;
    anim.current?.stop();
    if (reduce) x.set(target);
    else anim.current = animate(x, target, settleSpring);
  });
  useEffect(() => follow(open), [open]);

  const state = phase === "committing" ? "committing" : phase === "dragging" ? "dragging" : open ? "open" : "closed";
  const showToolbar = toolbar && (startActions.length > 0 || endActions.length > 0);
  const toolbarItems = [
    ...startActions.map((a) => ({ side: "start" as const, action: a })),
    ...[...endActions].reverse().map((a) => ({ side: "end" as const, action: a })),
  ];

  return (
    <div
      ref={rootRef}
      data-swipe-actions=""
      data-state={state}
      data-side={open ?? undefined}
      data-armed={armed ?? undefined}
      data-disabled={disabled || undefined}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          anim.current?.stop();
          // Keyboard closes instantly.
          x.set(0);
          targetRef.current = null;
          setOpen(null);
        }
      }}
      className={cn("group/swipe relative isolate overflow-hidden bg-raised", className)}
      {...rest}
    >
      {(["start", "end"] as const).map((side) =>
        actions[side].length ? (
          <div
            key={side}
            aria-hidden
            className={cn("absolute inset-y-0 flex", side === "start" ? "start-0" : "end-0 flex-row-reverse")}
          >
            {actions[side].map((action, i) => (
              <TrayAction
                key={action.id}
                action={action}
                side={side}
                index={i}
                count={actions[side].length}
                width={actionWidth}
                revealed={side === "start" ? startRevealed : endRevealed}
                arm={side === "start" ? armStart : armEnd}
                dir={dir}
                expand={armed === side ? expand : 0}
                solid={armed === side && i === expand}
                commits={i === 0 ? commits : 0}
                reduce={!!reduce}
                onPress={() => run(side, action, "pointer")}
              />
            ))}
          </div>
        ) : null,
      )}

      <motion.div
        ref={contentRef}
        data-swipe-content=""
        style={{ x }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onDragStart={(e) => e.preventDefault()}
        onClickCapture={(e) => {
          // A drag never lands as a click, and a tap on an open row just closes it.
          if (suppressClick.current || (open && phase === "idle")) {
            e.preventDefault();
            e.stopPropagation();
            if (!suppressClick.current) settle(null);
          }
          suppressClick.current = false;
        }}
        className={cn(
          "group/row relative z-10 bg-inherit touch-pan-y",
          state === "dragging" && "select-none",
          state === "committing" && "pointer-events-none",
          contentClassName,
        )}
      >
        {children}
        {showToolbar && (
          <Toolbar
            items={toolbarItems}
            visible={state === "closed"}
            disabled={disabled}
            align={toolbarAlign}
            onRun={(side, action, keyboard) => run(side, action, keyboard ? "keyboard" : "pointer")}
          />
        )}
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * The revealed tray
 * -----------------------------------------------------------------------------------------------*/

function TrayAction({
  action,
  side,
  index,
  count,
  expand,
  width,
  revealed,
  arm,
  dir,
  solid,
  commits,
  reduce,
  onPress,
}: {
  action: SwipeAction;
  side: SwipeSide;
  index: number;
  count: number;
  expand: number;
  width: number;
  revealed: MotionValue<number>;
  arm: MotionValue<number>;
  dir: MotionValue<number>;
  solid: boolean;
  commits: number;
  reduce: boolean;
  onPress: () => void;
}) {
  // Each action takes its share of the revealed width. Once a full swipe arms (or a tap commits),
  // that action takes all of it and the rest fold away beneath the row.
  const share = useTransform(() => {
    const r = revealed.get();
    const a = arm.get();
    return index === expand ? r * (1 / count + (1 - 1 / count) * a) : (r * (1 - a)) / count;
  });
  const progress = useTransform(() => clamp(share.get() / width));
  // Centered while narrower than its slot; once stretched, it hugs the row's edge and follows the finger.
  const shift = useTransform(() => {
    const w = share.get();
    const off = w < width ? (w - width) / 2 : 0;
    return (side === "end" ? off : -off) * dir.get();
  });
  const iconOpacity = useTransform(() => clamp((progress.get() - 0.35) / 0.5));
  // Driven by the finger, so it stays under reduced motion; nothing moves on its own.
  const iconScale = useTransform(() => 0.72 + 0.28 * progress.get());
  const tone = tones[action.tone ?? "neutral"];

  return (
    <motion.button
      type="button"
      tabIndex={-1}
      style={{ width: share }}
      onClick={onPress}
      className={cn(
        "group/act relative flex h-full shrink-0 overflow-hidden outline-none",
        side === "start" ? "justify-end" : "justify-start",
        "transition-colors duration-150",
        solid ? tone.solid : cn(tone.soft, tone.hover),
      )}
    >
      <motion.span style={{ x: shift, width }} className="flex h-full shrink-0 flex-col items-center justify-center gap-1 transition-transform duration-100 group-active/act:scale-95">
        <motion.span style={{ opacity: iconOpacity, scale: iconScale }} className="flex flex-col items-center gap-1">
          <motion.span
            key={commits}
            initial={commits && !reduce ? { scale: 1.2 } : false}
            animate={solid && !reduce ? { scale: [1, 1.16, 1] } : { scale: 1 }}
            transition={{ duration: 0.3, ease: ease.out }}
            className="grid size-4 place-items-center"
          >
            {action.icon}
          </motion.span>
          <span className="max-w-full truncate px-1 text-[11px] font-medium leading-none tracking-[-0.005em]">{action.label}</span>
        </motion.span>
      </motion.span>
    </motion.button>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Hover and focus toolbar: the same actions for a mouse, a keyboard and a screen reader
 * -----------------------------------------------------------------------------------------------*/

function Toolbar({
  items,
  visible,
  disabled,
  align,
  onRun,
}: {
  items: { side: SwipeSide; action: SwipeAction }[];
  visible: boolean;
  disabled: boolean;
  align: "center" | "top";
  onRun: (side: SwipeSide, action: SwipeAction, keyboard: boolean) => void;
}) {
  return (
    <Tooltip.Provider delay={500} timeout={400}>
      <div
        role="group"
        aria-label="Row actions"
        className={cn(
          "absolute end-2 z-10 flex items-center gap-0.5 rounded-lg border border-line-2 bg-raised p-0.5 shadow-[var(--shadow)]",
          "origin-right transition-[opacity,scale,translate] duration-150 ease-out-expo motion-reduce:transition-opacity",
          // Hidden until the row is hovered or something in it has keyboard focus. Never on touch alone.
          "pointer-events-none translate-x-1 scale-96 opacity-0",
          visible &&
            "group-hover/row:pointer-events-auto group-hover/row:translate-x-0 group-hover/row:scale-100 group-hover/row:opacity-100 group-has-focus-visible/row:pointer-events-auto group-has-focus-visible/row:translate-x-0 group-has-focus-visible/row:scale-100 group-has-focus-visible/row:opacity-100",
          align === "top" ? "top-1.5" : "inset-y-0 my-auto h-fit",
        )}
      >
        {items.map(({ side, action }) => (
          <Tooltip.Root key={`${side}-${action.id}`}>
            <Tooltip.Trigger
              render={
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={action.label}
                  onClick={(e) => onRun(side, action, e.detail === 0)}
                  className={cn(
                    "grid size-7 place-items-center rounded-md text-fg-2 outline-none",
                    "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
                    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
                    "disabled:pointer-events-none disabled:opacity-50",
                    action.tone === "danger" && "hover:bg-danger-soft hover:text-danger",
                  )}
                />
              }
            >
              {action.icon}
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner side="top" sideOffset={8} collisionPadding={8} className="z-(--z-tooltip)">
                <Tooltip.Popup
                  className={cn(
                    "origin-(--transform-origin) rounded-lg border border-line-2 bg-raised px-2 py-[3px] text-[12px] leading-5 text-fg shadow-pop",
                    "transition-[opacity,scale] duration-150 ease-out-expo data-ending-style:duration-100",
                    "data-starting-style:scale-96 data-starting-style:opacity-0 data-ending-style:opacity-0 data-instant:transition-none",
                  )}
                >
                  {action.label}
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        ))}
      </div>
    </Tooltip.Provider>
  );
}
