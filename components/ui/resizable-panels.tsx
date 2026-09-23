"use client";
import { animate, motion, motionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { Children, createContext, isValidElement, useContext, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

/* -------------------------------------------------------------------------------------------------
 * Types and context
 * -----------------------------------------------------------------------------------------------*/

type Direction = "horizontal" | "vertical";

type PanelDef = {
  id: string;
  min: number;
  max: number;
  collapsible: boolean;
  collapsedSize: number;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

type GroupContext = {
  direction: Direction;
  sizes: number[];
  mvs: MotionValue<number>[];
  defs: PanelDef[];
  groupPx: number;
  dragging: number | null;
  startDrag: (handle: number, e: React.PointerEvent) => void;
  nudge: (handle: number, delta: number) => void;
  jumpTo: (handle: number, edge: "min" | "max") => void;
  toggle: (handle: number, instant?: boolean, only?: number) => void;
};

const Group = createContext<GroupContext | null>(null);
const PanelIndex = createContext(-1);
const HandleIndex = createContext(-1);
const useGroup = () => {
  const ctx = useContext(Group);
  if (!ctx) throw new Error("Panel and PanelHandle must be used inside PanelGroup");
  return ctx;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
// iOS-style resistance: the further past the edge, the less it gives, never more than `limit`.
const rubber = (over: number, limit: number) => (limit * over * 0.55) / (limit + over * 0.55);
const round = (v: number) => Math.round(v * 100) / 100;

/* -------------------------------------------------------------------------------------------------
 * PanelGroup
 * -----------------------------------------------------------------------------------------------*/

export type PanelGroupProps = Omit<React.ComponentProps<"div">, "dir"> & {
  direction?: Direction;
  /** Called with every panel's size, in percent, whenever a resize settles. Persist it to restore the layout. */
  onLayout?: (sizes: number[]) => void;
};

/**
 * Split panes. Sizes are percentages of the group, so the layout survives a window resize;
 * handles between panels drag, step with arrow keys, and double-click to collapse.
 */
export function PanelGroup({ direction = "horizontal", onLayout, className, children, ...rest }: PanelGroupProps) {
  const reduce = !!useReducedMotion();
  const uid = useId();
  const kids = Children.toArray(children).filter(isValidElement);
  const panelProps = kids.filter((k) => k.type === Panel).map((k) => k.props as PanelProps);

  // Panels without a default share whatever the others leave.
  const [initial] = useState(() => {
    const given = panelProps.reduce((sum, p) => sum + (p.defaultSize ?? 0), 0);
    const free = panelProps.filter((p) => p.defaultSize === undefined).length;
    return panelProps.map((p) => (p.collapsed ? (p.collapsedSize ?? 0) : (p.defaultSize ?? (free ? Math.max(0, 100 - given) / free : 0))));
  });
  const [mvs] = useState(() => initial.map((s) => motionValue(s)));
  const [sizes, setSizes] = useState(initial);
  const [dragging, setDragging] = useState<number | null>(null);
  const [groupPx, setGroupPx] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const restore = useRef<number[]>(initial.map((s) => s));
  const last = useRef<number[]>(initial);
  const pointer = useRef<{ handle: number; start: number; a: number; b: number; px: number; id: number; moved: boolean } | null>(null);

  const defs: PanelDef[] = panelProps.map((p, i) => ({
    id: p.id ?? `${uid}-p${i}`,
    min: p.minSize ?? 10,
    max: p.maxSize ?? 100,
    collapsible: !!p.collapsible,
    collapsedSize: p.collapsedSize ?? 0,
    collapsed: p.collapsed,
    onCollapsedChange: p.onCollapsedChange,
  }));
  const defsRef = useRef(defs);
  const onLayoutRef = useRef(onLayout);
  useEffect(() => {
    defsRef.current = defs;
    onLayoutRef.current = onLayout;
  });

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const handles = [...el.children].filter((c) => c.getAttribute("role") === "separator");
      const handlePx = handles.reduce((sum, h) => sum + (direction === "horizontal" ? (h as HTMLElement).offsetWidth : (h as HTMLElement).offsetHeight), 0);
      setGroupPx((direction === "horizontal" ? el.clientWidth : el.clientHeight) - handlePx);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [direction]);

  const isCollapsed = (i: number, v = mvs[i].get()) => defsRef.current[i].collapsible && v <= defsRef.current[i].collapsedSize + 0.01;

  // Writes the settled sizes to React (for ARIA and data attributes) and tells the app.
  const commit = () => {
    const next = mvs.map((m) => round(m.get()));
    const prev = last.current;
    last.current = next;
    setSizes(next);
    next.forEach((v, i) => {
      const was = isCollapsed(i, prev[i]);
      const now = isCollapsed(i, v);
      if (!now && v > 0) restore.current[i] = v;
      if (was !== now) defsRef.current[i].onCollapsedChange?.(now);
    });
    if (next.some((v, i) => v !== prev[i])) onLayoutRef.current?.(next);
  };

  // The range the panel before handle `h` may take, given both neighbors' limits.
  const range = (h: number, total: number) => {
    const A = defsRef.current[h];
    const B = defsRef.current[h + 1];
    return { lo: Math.max(A.min, total - B.max), hi: Math.min(A.max, total - B.min) };
  };

  const set = (h: number, a: number, total: number, how: "jump" | "spring" | "soft") => {
    const [ma, mb] = [mvs[h], mvs[h + 1]];
    if (how === "jump" || reduce) {
      ma.jump(a);
      mb.jump(total - a);
      return Promise.resolve();
    }
    const t = how === "spring" ? spring.snappy : spring.soft;
    return Promise.all([animate(ma, a, t), animate(mb, total - a, t)]).then(() => undefined);
  };

  const startDrag = (h: number, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const coord = direction === "horizontal" ? e.clientX : e.clientY;
    pointer.current = { handle: h, start: coord, a: mvs[h].get(), b: mvs[h + 1].get(), px: Math.max(groupPx, 1), id: e.pointerId, moved: false };
    setDragging(h);
    document.documentElement.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
    document.documentElement.style.userSelect = "none";
  };

  useEffect(() => {
    if (dragging === null) return;
    let snapped: "a" | "b" | null = null;
    const onMove = (e: PointerEvent) => {
      const p = pointer.current;
      if (!p || e.pointerId !== p.id) return;
      const total = p.a + p.b;
      const A = defsRef.current[p.handle];
      const B = defsRef.current[p.handle + 1];
      const deltaPx = (direction === "horizontal" ? e.clientX : e.clientY) - p.start;
      // A press that hasn't traveled 3px is still a click (or half of a double-click), not a resize.
      if (!p.moved && Math.abs(deltaPx) < 3) return;
      p.moved = true;
      const deltaPct = (deltaPx / p.px) * 100;
      const raw = p.a + deltaPct;
      const { lo, hi } = range(p.handle, total);
      const edge = (24 / p.px) * 100;
      let a = raw;
      let snap: typeof snapped = null;
      if (raw < lo) {
        // Past the minimum: a collapsible panel snaps shut beyond half its minimum; anything else resists.
        if (A.collapsible && raw < A.min / 2) snap = "a";
        else a = lo - rubber(lo - raw, edge);
      } else if (raw > hi) {
        if (B.collapsible && total - raw < B.min / 2) snap = "b";
        else a = hi + rubber(raw - hi, edge);
      }
      if (snap !== snapped) {
        const target = snap === "a" ? A.collapsedSize : snap === "b" ? total - B.collapsedSize : clamp(raw, lo, hi);
        snapped = snap;
        void set(p.handle, target, total, "spring");
        return;
      }
      if (snap) return;
      set(p.handle, a, total, "jump");
      document.documentElement.style.cursor =
        a <= lo ? (direction === "horizontal" ? "e-resize" : "s-resize") : a >= hi ? (direction === "horizontal" ? "w-resize" : "n-resize") : direction === "horizontal" ? "col-resize" : "row-resize";
    };
    const onUp = (e: PointerEvent) => {
      const p = pointer.current;
      if (!p || e.pointerId !== p.id) return;
      pointer.current = null;
      setDragging(null);
      document.documentElement.style.cursor = "";
      document.documentElement.style.userSelect = "";
      if (!p.moved) return;
      const total = p.a + p.b;
      const { lo, hi } = range(p.handle, total);
      const a = mvs[p.handle].get();
      // Anything left outside the limits by the rubber band springs back.
      if (!snapped && (a < lo || a > hi)) void set(p.handle, clamp(a, lo, hi), total, "soft").then(commit);
      else window.setTimeout(commit, snapped ? 260 : 0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.documentElement.style.cursor = "";
      document.documentElement.style.userSelect = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers read live values through refs and motion values
  }, [dragging, direction]);

  const nudge = (h: number, delta: number) => {
    const total = mvs[h].get() + mvs[h + 1].get();
    const { lo, hi } = range(h, total);
    const A = defsRef.current[h];
    const current = mvs[h].get();
    let a = clamp(current + delta, lo, hi);
    // Stepping down out of a collapsed panel opens it to its minimum; stepping below the minimum collapses it.
    if (A.collapsible && isCollapsed(h) && delta > 0) a = lo;
    else if (A.collapsible && delta < 0 && current <= lo + 0.01) a = A.collapsedSize;
    void set(h, a, total, "jump");
    commit();
  };

  const jumpTo = (h: number, edge: "min" | "max") => {
    const total = mvs[h].get() + mvs[h + 1].get();
    const { lo, hi } = range(h, total);
    void set(h, edge === "min" ? lo : hi, total, "jump");
    commit();
  };

  // Double-click or Enter: collapse whichever neighbor can, or bring it back to where it was.
  const toggle = (h: number, instant = false, only?: number) => {
    const total = mvs[h].get() + mvs[h + 1].get();
    const A = defsRef.current[h];
    const B = defsRef.current[h + 1];
    const target = only ?? (A.collapsible ? h : B.collapsible ? h + 1 : null);
    if (target === null || !defsRef.current[target].collapsible) return;
    const T = defsRef.current[target];
    const shut = isCollapsed(target);
    // Remember where it was, so opening it again puts it back exactly there.
    if (!shut) restore.current[target] = mvs[target].get();
    const want = shut ? clamp(restore.current[target] ?? T.min, T.min, T.max) : T.collapsedSize;
    const a = target === h ? want : total - want;
    void set(h, clamp(a, 0, total), total, instant ? "jump" : "soft").then(commit);
    if (instant) commit();
  };

  // A controlled `collapsed` prop animates the panel open or shut.
  const controlled = defs.map((d) => d.collapsed);
  useEffect(() => {
    controlled.forEach((want, i) => {
      if (want === undefined || want === isCollapsed(i)) return;
      const h = i < mvs.length - 1 ? i : i - 1;
      if (h < 0) return;
      toggle(h, false, i);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the prop values changing
  }, [controlled.join(",")]);

  const countBefore = (i: number, type: unknown) => kids.slice(0, i).filter((k) => k.type === type).length;
  return (
    <Group.Provider value={{ direction, sizes, mvs, defs, groupPx, dragging, startDrag, nudge, jumpTo, toggle }}>
      <div
        ref={root}
        data-direction={direction}
        data-dragging={dragging !== null ? "" : undefined}
        className={cn("flex size-full min-h-0 min-w-0 overflow-hidden", direction === "vertical" && "flex-col", className)}
        {...rest}
      >
        {kids.map((k, i) => {
          if (k.type === Panel) {
            return (
              <PanelIndex.Provider key={k.key ?? i} value={countBefore(i, Panel)}>
                {k}
              </PanelIndex.Provider>
            );
          }
          if (k.type === PanelHandle) {
            return (
              <HandleIndex.Provider key={k.key ?? i} value={countBefore(i, PanelHandle)}>
                {k}
              </HandleIndex.Provider>
            );
          }
          return k;
        })}
      </div>
    </Group.Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Panel
 * -----------------------------------------------------------------------------------------------*/

export type PanelProps = Omit<React.ComponentProps<"div">, "id"> & {
  id?: string;
  /** Starting size in percent. Panels without one share what is left. */
  defaultSize?: number;
  /** Percent. Default 10. */
  minSize?: number;
  /** Percent. Default 100. */
  maxSize?: number;
  /** Can be dragged or double-clicked shut. */
  collapsible?: boolean;
  /** Size when collapsed, in percent: 0 hides it, a few percent leaves a rail. */
  collapsedSize?: number;
  /** Controlled collapsed state: changing it animates the panel. */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

// Props the group reads; everything else lands on the panel element.
const groupKeys = ["id", "defaultSize", "minSize", "maxSize", "collapsible", "collapsedSize", "collapsed", "onCollapsedChange"] as const;

export function Panel({ className, children, style, ...props }: PanelProps) {
  const rest: Record<string, unknown> = { ...props };
  for (const k of groupKeys) delete rest[k];
  const { direction, sizes, mvs, defs, groupPx } = useGroup();
  const i = useContext(PanelIndex);
  const def = defs[i];
  const mv = mvs[i];
  const flex = useTransform(mv, (v) => `${v} 1 0px`);
  // Content fades as the panel closes and keeps its minimum size, so it is clipped rather than squeezed.
  const opacity = useTransform(mv, [def.collapsedSize, Math.max(def.collapsedSize + 0.01, def.min * 0.8)], def.collapsible ? [0, 1] : [1, 1]);
  const collapsed = def.collapsible && sizes[i] <= def.collapsedSize + 0.01;
  const minPx = def.collapsible && groupPx ? (groupPx * def.min) / 100 : undefined;

  return (
    <motion.div
      id={def.id}
      data-panel=""
      data-collapsed={collapsed ? "" : undefined}
      style={{ ...style, flex }}
      className={cn("relative min-h-0 min-w-0 overflow-hidden", className)}
      {...(rest as Omit<React.ComponentProps<typeof motion.div>, "style">)}
    >
      <motion.div
        inert={collapsed}
        style={{ opacity, ...(minPx ? (direction === "horizontal" ? { minWidth: minPx } : { minHeight: minPx }) : null) }}
        className="size-full"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * PanelHandle
 * -----------------------------------------------------------------------------------------------*/

export type PanelHandleProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Always show the grip, not only on hover and focus. Touch screens always show it. */
  grip?: boolean;
  /** Accessible name. Defaults to "Resize {panel id}". */
  "aria-label"?: string;
};

export function PanelHandle({ grip = false, className, "aria-label": label, ...rest }: PanelHandleProps) {
  const { direction, sizes, defs, dragging, startDrag, nudge, jumpTo, toggle } = useGroup();
  const h = useContext(HandleIndex);
  const A = defs[h];
  const horizontal = direction === "horizontal";
  const total = (sizes[h] ?? 0) + (sizes[h + 1] ?? 0);
  const lo = Math.max(A.min, total - defs[h + 1].max);
  const hi = Math.min(A.max, total - defs[h + 1].min);
  const active = dragging === h;
  const collapsedSide = [h, h + 1].find((i) => defs[i].collapsible && sizes[i] <= defs[i].collapsedSize + 0.01);

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={horizontal ? "vertical" : "horizontal"}
      aria-controls={A.id}
      aria-valuenow={Math.round(sizes[h] ?? 0)}
      aria-valuemin={Math.round(A.collapsible ? A.collapsedSize : lo)}
      aria-valuemax={Math.round(hi)}
      aria-label={label ?? "Resize panels"}
      data-dragging={active ? "" : undefined}
      data-collapsed={collapsedSide !== undefined ? "" : undefined}
      onPointerDown={(e) => startDrag(h, e)}
      onDoubleClick={() => toggle(h)}
      onKeyDown={(e) => {
        const back = horizontal ? "ArrowLeft" : "ArrowUp";
        const fwd = horizontal ? "ArrowRight" : "ArrowDown";
        const step = e.shiftKey ? 10 : 2;
        if (e.key === back) nudge(h, -step);
        else if (e.key === fwd) nudge(h, step);
        else if (e.key === "Home") jumpTo(h, "min");
        else if (e.key === "End") jumpTo(h, "max");
        else if (e.key === "Enter") toggle(h, true);
        else return;
        e.preventDefault();
      }}
      className={cn(
        "group/handle relative z-[1] flex-none touch-none select-none bg-line outline-none",
        "transition-[background-color] duration-150 hover:bg-fg-4 hover:delay-150 data-dragging:bg-fg-3 data-dragging:delay-0 focus-visible:bg-fg-3",
        // The line is 1px; the target is 9px (21px on touch), centered on it.
        "before:absolute before:content-['']",
        horizontal
          ? "w-px cursor-col-resize before:inset-y-0 before:-inset-x-1 pointer-coarse:before:-inset-x-2.5"
          : "h-px cursor-row-resize before:inset-x-0 before:-inset-y-1 pointer-coarse:before:-inset-y-2.5",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg-3 ring-2 ring-frame",
          "opacity-0 transition-[opacity,scale,background-color] duration-150 ease-out-expo motion-reduce:transition-opacity",
          horizontal ? "h-6 w-[5px] scale-y-50" : "h-[5px] w-6 scale-x-50",
          "group-hover/handle:opacity-100 group-hover/handle:delay-150 group-focus-visible/handle:opacity-100 group-data-dragging/handle:bg-fg group-data-dragging/handle:opacity-100 group-data-dragging/handle:delay-0",
          horizontal
            ? "group-hover/handle:scale-y-100 group-focus-visible/handle:scale-y-100 group-data-dragging/handle:scale-y-110"
            : "group-hover/handle:scale-x-100 group-focus-visible/handle:scale-x-100 group-data-dragging/handle:scale-x-110",
          (grip || collapsedSide !== undefined) && "opacity-100",
          grip && (horizontal ? "scale-y-100" : "scale-x-100"),
          "pointer-coarse:opacity-100",
        )}
      />
    </div>
  );
}
