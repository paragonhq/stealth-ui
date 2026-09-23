"use client";
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

/* -------------------------------------------------------------------------------------------------
 * Provider
 * -----------------------------------------------------------------------------------------------*/

type Zone = {
  id: string;
  label: string;
  accept?: (item: string) => boolean;
  rejectLabel?: string;
  magnet: number;
  el: HTMLElement | null;
};

type Flight = { id: string; label: string; from: string | null; phase: "dragging" | "settling"; width: number; height: number };
type Picked = { id: string; label: string; from: string | null; via: "keyboard" | "pointer" };
type Flash = { zone: string; kind: "accepted" | "rejected"; key: number };

type Ctx = {
  flight: Flight | null;
  picked: Picked | null;
  over: string | null;
  flash: Flash | null;
  reduce: boolean;
  hintId: string;
  zones: React.RefObject<Map<string, Zone>>;
  canDrop: (zone: string, item: string) => boolean;
  startPointer: (e: React.PointerEvent<HTMLElement>, id: string, label: string, from: string | null) => void;
  toggle: (id: string, label: string, from: string | null, via: "keyboard" | "pointer") => void;
  dropPicked: (zone: string) => void;
  consumeClick: (id: string) => boolean;
};

const DnDCtx = createContext<Ctx | null>(null);
const ZoneCtx = createContext<{ id: string; state: DropTargetState; holding: string | null } | null>(null);
const useDnD = (part: string) => {
  const ctx = useContext(DnDCtx);
  if (!ctx) throw new Error(`${part} must be used inside DropTargetProvider`);
  return ctx;
};

const THRESHOLD = 5;
const sel = (id: string) => `[data-draggable-id="${CSS.escape(id)}"]`;

export type DropTargetProviderProps = {
  /** Called when an item is dropped on a target that accepts it. Move the item in your state here. */
  onDrop: (item: string, target: string) => void;
  children: React.ReactNode;
};

/** Connects Draggables to DropTargets. Handles the ghost, the magnet, the flight home and the keyboard path. */
export function DropTargetProvider({ onDrop, children }: DropTargetProviderProps) {
  const reduce = !!useReducedMotion();
  const hintId = useId();
  const zones = useRef(new Map<string, Zone>());
  const [flight, setFlight] = useState<Flight | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [message, setMessage] = useState("");
  const focusAfter = useRef<string | null>(null);
  const suppressClick = useRef<string | null>(null);
  const flashTimer = useRef<number>(undefined);

  // The ghost follows the pointer exactly; the magnet adds a sprung pull toward a nearby target.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const pullX = useSpring(0, spring.follow);
  const pullY = useSpring(0, spring.follow);
  const gx = useTransform(() => px.get() + pullX.get());
  const gy = useTransform(() => py.get() + pullY.get());
  const gScale = useMotionValue(1);
  const gw = useMotionValue(0);
  const gh = useMotionValue(0);
  const ghostRef = useRef<HTMLDivElement | null>(null);

  const session = useRef<{
    id: string;
    label: string;
    from: string | null;
    pointerId: number;
    startX: number;
    startY: number;
    grabX: number;
    grabY: number;
    width: number;
    height: number;
    source: HTMLElement;
    started: boolean;
    target: string | null;
    cleanup: () => void;
  } | null>(null);

  useEffect(
    () => () => {
      session.current?.cleanup();
      window.clearTimeout(flashTimer.current);
    },
    [],
  );

  const canDrop = (zone: string, item: string) => {
    const z = zones.current.get(zone);
    return !!z && (z.accept ? z.accept(item) : true);
  };

  const flashZone = (zone: string, kind: Flash["kind"]) => {
    window.clearTimeout(flashTimer.current);
    setFlash({ zone, kind, key: Date.now() });
    flashTimer.current = window.setTimeout(() => setFlash(null), kind === "rejected" ? 1400 : 700);
  };

  // The target under the ghost, or the nearest one within its magnet radius.
  const hitTest = (cx: number, cy: number) => {
    let best: { zone: Zone; d: number; r: DOMRect } | null = null;
    for (const z of zones.current.values()) {
      if (!z.el) continue;
      const r = z.el.getBoundingClientRect();
      const dx = cx < r.left ? r.left - cx : cx > r.right ? cx - r.right : 0;
      const dy = cy < r.top ? r.top - cy : cy > r.bottom ? cy - r.bottom : 0;
      const d = Math.hypot(dx, dy);
      if (d <= z.magnet && (!best || d < best.d)) best = { zone: z, d, r };
    }
    return best;
  };

  const land = (s: { id: string; label: string; from: string | null; width: number; height: number }, target: string | null) => {
    const ok = !!target && target !== s.from && canDrop(target, s.id);
    setFlight({ id: s.id, label: s.label, from: s.from, phase: "settling", width: s.width, height: s.height });
    setOver(null);
    pullX.set(0);
    pullY.set(0);
    if (ok) {
      const z = zones.current.get(target!)!;
      onDrop(s.id, target!);
      flashZone(target!, "accepted");
      setMessage(`${s.label} moved to ${z.label}.`);
    } else if (target && target !== s.from) {
      const z = zones.current.get(target)!;
      flashZone(target, "rejected");
      setMessage(`${z.label} can't take ${s.label}${z.rejectLabel ? `: ${z.rejectLabel}` : ""}. It went back.`);
    } else if (!target) {
      setMessage(`${s.label} went back. Drop it on a target to move it.`);
    }
  };

  const startPointer = (e: React.PointerEvent<HTMLElement>, id: string, label: string, from: string | null) => {
    if (flight || session.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const source = e.currentTarget;
    const r = source.getBoundingClientRect();

    const onMove = (ev: PointerEvent) => {
      const s = session.current;
      if (!s || ev.pointerId !== s.pointerId) return;
      if (!s.started) {
        if (Math.hypot(ev.clientX - s.startX, ev.clientY - s.startY) < THRESHOLD) return;
        s.started = true;
        setPicked(null);
        px.set(ev.clientX - s.grabX);
        py.set(ev.clientY - s.grabY);
        gScale.set(1);
        gw.set(s.width);
        gh.set(s.height);
        if (!reduce) animate(gScale, 1.05, spring.snappy);
        setFlight({ id: s.id, label: s.label, from: s.from, phase: "dragging", width: s.width, height: s.height });
        setMessage(`${s.label} picked up.`);
      }
      const x = ev.clientX - s.grabX;
      const y = ev.clientY - s.grabY;
      px.set(x);
      py.set(y);
      const cx = x + s.width / 2;
      const cy = y + s.height / 2;
      const hit = hitTest(cx, cy);
      const target = hit ? hit.zone.id : null;
      // Magnetism: just outside a target that would take it, the ghost leans in, harder the closer it
      // gets (up to 12px). Once inside, it's the hand's again.
      if (hit && hit.d > 0 && !reduce && target !== s.from && canDrop(hit.zone.id, s.id)) {
        const strength = 1 - hit.d / Math.max(1, hit.zone.magnet);
        const nx = Math.max(hit.r.left, Math.min(cx, hit.r.right)) - cx;
        const ny = Math.max(hit.r.top, Math.min(cy, hit.r.bottom)) - cy;
        const len = Math.hypot(nx, ny) || 1;
        pullX.set((nx / len) * 12 * strength);
        pullY.set((ny / len) * 12 * strength);
      } else {
        pullX.set(0);
        pullY.set(0);
      }
      if (target !== s.target) {
        s.target = target;
        setOver(target);
      }
    };
    const end = (ev: PointerEvent, cancel: boolean) => {
      const s = session.current;
      if (!s || ev.pointerId !== s.pointerId) return;
      s.cleanup();
      session.current = null;
      if (!s.started) return;
      // A drag should never also count as a click on the item.
      suppressClick.current = s.id;
      window.setTimeout(() => {
        suppressClick.current = null;
      }, 0);
      land(s, cancel ? null : s.target);
      if (cancel) setMessage(`Move cancelled. ${s.label} went back.`);
    };
    const onUp = (ev: PointerEvent) => end(ev, false);
    const onCancel = (ev: PointerEvent) => end(ev, true);
    const onKey = (ev: KeyboardEvent) => {
      const s = session.current;
      if (ev.key !== "Escape" || !s?.started) return;
      ev.preventDefault();
      s.cleanup();
      session.current = null;
      land(s, null);
      setMessage(`Move cancelled. ${s.label} went back.`);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    session.current = {
      id,
      label,
      from,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      grabX: e.clientX - r.left,
      grabY: e.clientY - r.top,
      width: r.width,
      height: r.height,
      source,
      started: false,
      target: null,
      cleanup: () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey);
      },
    };
  };

  // Copy the item's look into the ghost when a flight starts. It's a picture, not a second live copy.
  const flightId = flight?.id;
  useLayoutEffect(() => {
    const ghost = ghostRef.current;
    const src = flightId ? document.querySelector<HTMLElement>(sel(flightId)) : null;
    if (!ghost || !src) return;
    const clone = src.cloneNode(true) as HTMLElement;
    clone.removeAttribute("data-draggable-id");
    clone.removeAttribute("id");
    clone.setAttribute("data-ghost", "");
    clone.setAttribute("data-state", "idle");
    clone.style.width = "100%";
    clone.style.height = "100%";
    ghost.replaceChildren(clone);
  }, [flightId]);

  // After a drop, fly the ghost to wherever the item now lives: its new target, or home.
  const settling = flight?.phase === "settling" ? flight.id : null;
  useLayoutEffect(() => {
    if (!settling) return;
    const el = document.querySelector<HTMLElement>(sel(settling));
    const done = () => setFlight((f) => (f?.id === settling && f.phase === "settling" ? null : f));
    if (!el || reduce) {
      done();
      return;
    }
    const r = el.getBoundingClientRect();
    // Land from wherever the ghost is now, magnet included.
    px.set(gx.get());
    py.set(gy.get());
    pullX.jump(0);
    pullY.jump(0);
    // The item may look different where it lands (a compact chip in a folder), so the ghost takes its size too.
    animate(px, r.left, spring.soft);
    animate(gw, r.width, spring.soft);
    animate(gh, r.height, spring.soft);
    animate(gScale, 1, spring.soft);
    const a = animate(py, r.top, spring.soft);
    a.then(done);
    return () => a.stop();
  }, [settling, reduce, px, py, gx, gy, pullX, pullY, gScale, gw, gh]);

  // Keyboard focus follows the item to its new place.
  useLayoutEffect(() => {
    const id = focusAfter.current;
    if (!id) return;
    focusAfter.current = null;
    document.querySelector<HTMLElement>(sel(id))?.focus({ preventScroll: true });
  });

  // While an item is picked up by tap or keyboard: Escape or a press elsewhere puts it down.
  useEffect(() => {
    if (!picked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setPicked(null);
      setMessage(`Move cancelled. ${picked.label} stays where it was.`);
      document.querySelector<HTMLElement>(sel(picked.id))?.focus({ preventScroll: true });
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (t.closest("[data-drop-button]") || t.closest(sel(picked.id))) return;
      setPicked(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [picked]);

  const ctx: Ctx = {
    flight,
    picked,
    over,
    flash,
    reduce,
    hintId,
    zones,
    canDrop,
    startPointer,
    consumeClick: (id) => suppressClick.current === id,
    toggle(id, label, from, via) {
      if (picked?.id === id) {
        setPicked(null);
        setMessage(`${label} put down.`);
        return;
      }
      setPicked({ id, label, from, via });
      setMessage(`${label} picked up. Tab to a target and press Enter to move it there, or Escape to cancel.`);
      if (via === "keyboard") {
        // Hand focus to the first target that would take it, or to the first one (which says why not).
        requestAnimationFrame(() =>
          (
            document.querySelector<HTMLElement>("[data-drop-button]:not([aria-disabled=true])") ??
            document.querySelector<HTMLElement>("[data-drop-button]")
          )?.focus(),
        );
      }
    },
    dropPicked(zone) {
      if (!picked) return;
      const z = zones.current.get(zone);
      if (!z) return;
      if (!canDrop(zone, picked.id)) {
        flashZone(zone, "rejected");
        setMessage(`${z.label} can't take ${picked.label}${z.rejectLabel ? `: ${z.rejectLabel}` : ""}.`);
        return;
      }
      const src = document.querySelector<HTMLElement>(sel(picked.id));
      const r = src?.getBoundingClientRect();
      setPicked(null);
      focusAfter.current = picked.via === "keyboard" ? picked.id : null;
      if (r && !reduce) {
        px.set(r.left);
        py.set(r.top);
        gw.set(r.width);
        gh.set(r.height);
        gScale.set(1);
        setFlight({ id: picked.id, label: picked.label, from: picked.from, phase: "settling", width: r.width, height: r.height });
      }
      onDrop(picked.id, zone);
      flashZone(zone, "accepted");
      setMessage(`${picked.label} moved to ${z.label}.`);
    },
  };

  return (
    <DnDCtx.Provider value={ctx}>
      {children}
      <span id={hintId} className="sr-only">
        Press Enter to pick up, then Tab to a target and press Enter to drop. Escape cancels.
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {message}
      </span>
      {flight &&
        createPortal(
          <motion.div
            ref={ghostRef}
            aria-hidden
            data-phase={flight.phase}
            className={cn(
              "pointer-events-none fixed left-0 top-0 z-(--z-popover) rounded-lg",
              "shadow-pop transition-shadow duration-200 data-[phase=settling]:shadow-none",
              "[&>*]:cursor-grabbing",
            )}
            style={{ x: gx, y: gy, scale: gScale, width: gw, height: gh }}
          />,
          document.body,
        )}
    </DnDCtx.Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Draggable
 * -----------------------------------------------------------------------------------------------*/

export type DraggableProps = Omit<React.ComponentProps<"button">, "id" | "children"> & {
  /** Unique across the provider. */
  id: string;
  /** Plain-text name for the announcements. */
  label: string;
  children: React.ReactNode;
};

/** Something that can be dragged, or picked up with a tap or Enter and placed on a target. */
export function Draggable({ id, label, disabled, className, children, onClick, onPointerDown, ...rest }: DraggableProps) {
  const ctx = useDnD("Draggable");
  const zone = useContext(ZoneCtx)?.id ?? null;
  const inFlight = ctx.flight?.id === id;
  const picked = ctx.picked?.id === id;

  return (
    <button
      type="button"
      data-draggable-id={id}
      data-state={inFlight ? (ctx.flight?.phase === "dragging" ? "dragging" : "landing") : picked ? "picked" : "idle"}
      aria-pressed={picked}
      aria-describedby={ctx.hintId}
      disabled={disabled}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        if (!e.defaultPrevented && !disabled) ctx.startPointer(e, id, label, zone);
      }}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || ctx.consumeClick(id)) return;
        // detail 0 means Enter or Space rather than a pointer.
        ctx.toggle(id, label, zone, e.detail === 0 ? "keyboard" : "pointer");
      }}
      className={cn(
        "relative touch-none select-none outline-none [-webkit-touch-callout:none]",
        "cursor-grab transition-[opacity,scale,box-shadow] duration-150 ease-out-quart active:scale-[0.97]",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        // Left behind while dragging: a dashed outline of where it came from.
        "data-[state=dragging]:opacity-35",
        "data-[state=landing]:opacity-0 data-[state=landing]:transition-none",
        "data-[state=picked]:shadow-[0_0_0_1px_var(--fg-3)] data-[state=picked]:scale-[1.03]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------------------------------
 * DropTarget
 * -----------------------------------------------------------------------------------------------*/

export type DropTargetState = {
  /** Something is being dragged or is picked up. */
  active: boolean;
  /** This target would take what's in the air. */
  canDrop: boolean;
  /** What's in the air came from this target; dropping it here changes nothing. */
  home: boolean;
  /** The ghost is over it or inside its magnet radius. */
  over: boolean;
  /** Briefly true after a drop lands or is refused here. */
  flash: "accepted" | "rejected" | null;
};

export type DropTargetProps = Omit<React.ComponentProps<"div">, "id" | "children"> & {
  id: string;
  /** Plain-text name, used in "Move … to <label>" and the announcements. */
  label: string;
  /** Which items this target takes. Omit to take everything. */
  accept?: (item: string) => boolean;
  /** Why it refuses, shown while a refused item is in the air ("Only PDFs", "Read-only"). */
  rejectLabel?: string;
  /** How far outside its edge a release still snaps in, in px. */
  magnet?: number;
  children: React.ReactNode | ((state: DropTargetState) => React.ReactNode);
};

/** A place things are dropped. It lights up when it would take what you're holding and says so when it won't. */
export function DropTarget({ id, label, accept, rejectLabel, magnet = 32, className, children, ...rest }: DropTargetProps) {
  const ctx = useDnD("DropTarget");
  const ref = useRef<HTMLDivElement | null>(null);

  // Register with the provider; kept current on every render so accept can close over fresh state.
  useLayoutEffect(() => {
    ctx.zones.current.set(id, { id, label, accept, rejectLabel, magnet, el: ref.current });
  });
  useEffect(() => {
    const zones = ctx.zones.current;
    return () => {
      zones.delete(id);
    };
  }, [ctx.zones, id]);

  const holding = ctx.flight?.phase === "dragging" ? ctx.flight : ctx.picked;
  const active = !!holding;
  const home = holding?.from === id;
  const can = !!holding && !home && (accept ? accept(holding.id) : true);
  const over = ctx.over === id && ctx.flight?.phase === "dragging";
  const flash = ctx.flash?.zone === id ? ctx.flash.kind : null;
  const state: DropTargetState = { active, canDrop: can, home, over, flash };

  return (
    <ZoneCtx.Provider value={{ id, state, holding: holding?.id ?? null }}>
      <div
        ref={ref}
        role="group"
        aria-label={label}
        data-active={active ? "" : undefined}
        data-can-drop={active && !home ? String(can) : undefined}
        data-over={over ? "" : undefined}
        data-flash={flash ?? undefined}
        className={cn(
          "relative rounded-xl border border-line bg-raised transition-[border-color,background-color,opacity,box-shadow] duration-200 ease-out-quart",
          "data-[can-drop=true]:border-dashed data-[can-drop=true]:border-fg-4",
          "data-[can-drop=false]:opacity-55",
          "data-over:data-[can-drop=true]:border-solid data-over:data-[can-drop=true]:border-fg-3 data-over:data-[can-drop=true]:bg-hover",
          "data-over:data-[can-drop=false]:border-danger/50",
          "data-[flash=accepted]:border-success/60 data-[flash=accepted]:shadow-[0_0_0_3px_var(--success-soft)]",
          "data-[flash=rejected]:border-danger/60 data-[flash=rejected]:shadow-[0_0_0_3px_var(--danger-soft)]",
          className,
        )}
        {...rest}
      >
        {typeof children === "function" ? children(state) : children}
        {/* The keyboard and tap path: while something is picked up, the whole target is one button. */}
        {ctx.picked && !home && (
          <button
            type="button"
            data-drop-button=""
            aria-disabled={!can || undefined}
            aria-label={can ? `Move ${ctx.picked.label} to ${label}` : `${label} can't take ${ctx.picked.label}${rejectLabel ? `: ${rejectLabel}` : ""}`}
            onClick={() => ctx.dropPicked(id)}
            onKeyDown={(e) => {
              const buttons = Array.from(document.querySelectorAll<HTMLElement>("[data-drop-button]"));
              const i = buttons.indexOf(e.currentTarget);
              const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
              if (!step) return;
              e.preventDefault();
              buttons[(i + step + buttons.length) % buttons.length]?.focus();
            }}
            className={cn(
              "absolute inset-0 z-1 rounded-[inherit] outline-none",
              "hover:bg-fg/[0.03] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              can ? "cursor-copy" : "cursor-not-allowed",
            )}
          />
        )}
      </div>
    </ZoneCtx.Provider>
  );
}

/** The state of the DropTarget it's called inside, for content that reacts to what's being held. */
export function useDropTarget(): DropTargetState & { holding: string | null } {
  const zone = useContext(ZoneCtx);
  if (!zone) throw new Error("useDropTarget must be used inside DropTarget");
  return { ...zone.state, holding: zone.holding };
}
