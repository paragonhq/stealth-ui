"use client";
import NumberFlow from "@number-flow/react";
import { Reorder, useDragControls, useReducedMotion } from "motion/react";
import type { DragControls } from "motion/react";
import { Children, createContext, Fragment, isValidElement, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Grip } from "@/lib/icons";
import { spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * Context
 * -----------------------------------------------------------------------------------------------*/

type Active = { id: string; mode: "keyboard" | "pointer"; from: string[] };

type ListContext = {
  order: string[];
  active: Active | null;
  pressed: string | null;
  disabled: boolean;
  numbered: boolean;
  reduce: boolean;
  hintId: string;
  press: (id: string) => void;
  lift: (id: string, label: string) => void;
  moveTo: (id: string, label: string, index: number) => void;
  drop: (id: string, label: string) => void;
  cancel: (id: string, label: string) => void;
  dragStart: (id: string) => void;
  dragEnd: (id: string, label: string) => void;
  cancelDrag: () => void;
};

const ListCtx = createContext<ListContext | null>(null);
const useList = () => {
  const ctx = useContext(ListCtx);
  if (!ctx) throw new Error("ReorderListItem must be used inside ReorderList");
  return ctx;
};

type ItemContext = { value: string; label: string; disabled: boolean; controls: DragControls; handleRef: React.RefObject<HTMLButtonElement | null> };
const ItemCtx = createContext<ItemContext | null>(null);

/* -------------------------------------------------------------------------------------------------
 * ReorderList
 * -----------------------------------------------------------------------------------------------*/

export type ReorderListProps = Omit<
  React.ComponentProps<"ul">,
  "children" | "defaultValue" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
> & {
  /** The order, as item values. Controlled. */
  value?: string[];
  /** The starting order when uncontrolled. Defaults to the order the children are written in. */
  defaultValue?: string[];
  /** Called on every swap, while dragging and on each arrow press. */
  onValueChange?: (value: string[]) => void;
  /** Called once when a drag or keyboard move is dropped somewhere new. The place to save. */
  onValueCommitted?: (value: string[]) => void;
  /** Stops every item from being picked up. */
  disabled?: boolean;
  /** Shows each item's position as a rolling number after its handle. */
  numbered?: boolean;
  /** ReorderListItem elements, each with a unique value. */
  children: React.ReactNode;
};

/** A vertical list whose items are reordered by their handle or the keyboard. */
export function ReorderList({
  value,
  defaultValue,
  onValueChange,
  onValueCommitted,
  disabled = false,
  numbered = false,
  className,
  children,
  ...rest
}: ReorderListProps) {
  const items = Children.toArray(children).filter((c) => isValidElement<ReorderListItemProps>(c));
  const childIds = items.map((c) => c.props.value);
  const [stored, setStored] = useControllableState({ value, defaultValue: defaultValue ?? childIds, onChange: onValueChange });

  // Children added later join the end; removed ones drop out. Order always matches what's rendered.
  const order = [...stored.filter((id) => childIds.includes(id)), ...childIds.filter((id) => !stored.includes(id))];
  const byId = new Map(items.map((c) => [c.props.value, c]));

  const reduce = !!useReducedMotion();
  const hintId = useId();
  const [active, setActive] = useState<Active | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const canceled = useRef(false);

  const at = (ids: string[], id: string) => `position ${ids.indexOf(id) + 1} of ${ids.length}`;
  const commit = (from: string[], to: string[]) => {
    if (from.join() !== to.join()) onValueCommitted?.(to);
  };

  // A press lifts the item before the pointer has moved, so the hand gets an answer at once.
  useEffect(() => {
    if (!pressed) return;
    const release = () => setPressed(null);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [pressed]);

  const ctx: ListContext = {
    order,
    active,
    pressed,
    disabled,
    numbered,
    reduce,
    hintId,
    press: setPressed,
    lift(id, label) {
      setActive({ id, mode: "keyboard", from: order });
      setMessage(`${label} lifted, ${at(order, id)}. Arrow keys move it, Space drops it, Escape cancels.`);
    },
    moveTo(id, label, index) {
      const from = order.indexOf(id);
      const to = Math.max(0, Math.min(order.length - 1, index));
      if (from === to) return;
      const next = [...order];
      next.splice(to, 0, next.splice(from, 1)[0]);
      setStored(next);
      setMessage(`${label}, ${at(next, id)}.`);
      // Alt+arrow moves without lifting, so it commits straight away.
      if (active?.id !== id) commit(order, next);
    },
    drop(id, label) {
      if (active?.id !== id) return;
      setActive(null);
      setMessage(`${label} dropped, ${at(order, id)}.`);
      commit(active.from, order);
    },
    cancel(id, label) {
      if (active?.id !== id) return;
      setStored(active.from);
      setActive(null);
      setMessage(`Move canceled. ${label} is back at ${at(active.from, id)}.`);
    },
    dragStart(id) {
      canceled.current = false;
      setActive({ id, mode: "pointer", from: order });
    },
    dragEnd(id, label) {
      const from = active?.id === id ? active.from : order;
      setActive(null);
      if (canceled.current) {
        setMessage(`Move canceled. ${label} is back at ${at(from, id)}.`);
        return;
      }
      setMessage(`${label} dropped, ${at(order, id)}.`);
      commit(from, order);
    },
    cancelDrag() {
      if (active?.mode !== "pointer") return;
      canceled.current = true;
      setStored(active.from);
    },
  };

  // While an item is in the air the cursor stays a closed hand everywhere, and text can't be selected.
  const grabbing = active?.mode === "pointer";
  useEffect(() => {
    if (!grabbing) return;
    const style = document.body.style;
    const prev = { cursor: style.cursor, userSelect: style.userSelect };
    style.cursor = "grabbing";
    style.userSelect = "none";
    return () => {
      style.cursor = prev.cursor;
      style.userSelect = prev.userSelect;
    };
  }, [grabbing]);

  return (
    <ListCtx.Provider value={ctx}>
      <Reorder.Group
        as="ul"
        axis="y"
        values={order}
        onReorder={(next: string[]) => setStored(next)}
        data-dragging={active ? "" : undefined}
        data-disabled={disabled ? "" : undefined}
        className={cn("relative flex flex-col gap-1.5", className)}
        {...rest}
      >
        {/* Keyed by value, so unkeyed children still keep their identity as they move. */}
        {order.map((id) => <Fragment key={id}>{byId.get(id)}</Fragment>)}
      </Reorder.Group>
      <span id={hintId} className="sr-only">
        Press Space to lift, the arrow keys to move, Space again to drop and Escape to cancel. Alt with an arrow key moves without lifting.
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {message}
      </span>
    </ListCtx.Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * ReorderListItem
 * -----------------------------------------------------------------------------------------------*/

export type ReorderListItemProps = Omit<
  React.ComponentProps<"li">,
  "value" | "children" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
> & {
  /** Unique within the list. */
  value: string;
  /** Plain-text name, used for the handle's label and the announcements. */
  label: string;
  /** This item can't be picked up. Others can still move past it. */
  disabled?: boolean;
  /** Render the grip before the content. Turn off to place a ReorderListHandle yourself. */
  handle?: boolean;
  children?: React.ReactNode;
};

export function ReorderListItem({ value, label, disabled = false, handle = true, className, children, ...rest }: ReorderListItemProps) {
  const list = useList();
  const controls = useDragControls();
  const handleRef = useRef<HTMLButtonElement | null>(null);
  const lifted = list.active?.id === value || list.pressed === value;
  const mode = list.active?.id === value ? list.active.mode : null;
  const position = list.order.indexOf(value) + 1;

  // Escape during a pointer drag puts everything back and lets the item spring home.
  useEffect(() => {
    if (mode !== "pointer") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      list.cancelDrag();
      controls.stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, list, controls]);

  return (
    <ItemCtx.Provider value={{ value, label, disabled: disabled || list.disabled, controls, handleRef }}>
      <Reorder.Item
        value={value}
        dragListener={false}
        dragControls={controls}
        onDragStart={() => list.dragStart(value)}
        onDragEnd={() => list.dragEnd(value, label)}
        // Siblings make room on the soft spring; keyboard moves use the snappier one so they keep up with key repeat.
        animate={{ scale: lifted && !list.reduce ? 1.02 : 1 }}
        transition={
          list.reduce
            ? { duration: 0 }
            : { layout: list.active?.mode === "keyboard" ? spring.snappy : spring.soft, scale: spring.snappy }
        }
        // How the dropped item settles back into its slot after release.
        dragTransition={{ bounceStiffness: 520, bounceDamping: 38 }}
        data-lifted={lifted ? "" : undefined}
        data-dragging={mode === "pointer" ? "" : undefined}
        data-disabled={disabled || list.disabled ? "" : undefined}
        className={cn(
          "relative flex min-h-12 items-center gap-1 rounded-lg border border-line bg-raised pe-3 ps-1 text-[13px] text-fg",
          "transition-[border-color,box-shadow] duration-200 ease-out-quart",
          lifted && "z-10 border-line-2 shadow-pop",
          className,
        )}
        {...rest}
      >
        {handle && <ReorderListHandle />}
        {list.numbered && (
          <span aria-hidden className="w-5 shrink-0 text-center font-mono text-[11px] text-fg-3 tabular">
            <NumberFlow value={position} animated={!list.reduce} />
          </span>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-3 py-2 ps-1">{children}</div>
      </Reorder.Item>
    </ItemCtx.Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * ReorderListHandle
 * -----------------------------------------------------------------------------------------------*/

export type ReorderListHandleProps = Omit<React.ComponentProps<"button">, "children"> & {
  children?: React.ReactNode;
};

/** The grip that picks an item up. Rendered by ReorderListItem unless `handle={false}`. */
export function ReorderListHandle({ className, children, onPointerDown, onKeyDown, onBlur, ...rest }: ReorderListHandleProps) {
  const list = useList();
  const item = useContext(ItemCtx);
  if (!item) throw new Error("ReorderListHandle must be used inside ReorderListItem");
  const { value, label, disabled, controls, handleRef } = item;
  const keyboardLifted = list.active?.id === value && list.active.mode === "keyboard";

  // React moves the focused node when it reorders, which can drop focus. Put it back.
  useLayoutEffect(() => {
    if (keyboardLifted && document.activeElement !== handleRef.current) handleRef.current?.focus({ preventScroll: true });
  });

  return (
    <button
      ref={handleRef}
      type="button"
      disabled={disabled}
      aria-label={`Reorder ${label}`}
      aria-describedby={list.hintId}
      aria-pressed={keyboardLifted}
      data-lifted={keyboardLifted ? "" : undefined}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        if (e.defaultPrevented || disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
        e.preventDefault();
        list.press(value);
        controls.start(e);
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented || disabled) return;
        const index = list.order.indexOf(value);
        const lifted = list.active?.id === value;
        const step = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (lifted) list.drop(value, label);
          else list.lift(value, label);
        } else if (step && (lifted || e.altKey)) {
          e.preventDefault();
          list.moveTo(value, label, index + step);
        } else if (lifted && (e.key === "Home" || e.key === "End")) {
          e.preventDefault();
          list.moveTo(value, label, e.key === "Home" ? 0 : list.order.length - 1);
        } else if (lifted && e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          list.cancel(value, label);
        }
      }}
      onBlur={(e) => {
        onBlur?.(e);
        // Blur caused by the reorder itself is refocused above; a real Tab away drops the item.
        const node = e.currentTarget;
        window.setTimeout(() => {
          if (document.activeElement !== node && list.active?.id === value && list.active.mode === "keyboard") list.drop(value, label);
        }, 0);
      }}
      className={cn(
        "relative grid h-8 w-6 shrink-0 touch-none select-none place-items-center rounded-md text-fg-4 outline-none",
        "cursor-grab transition-colors duration-150 hover:text-fg-2 active:cursor-grabbing",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
        "data-lifted:text-fg-2 in-data-lifted:text-fg-2",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-fg-4",
        // A 44px target on touch without widening the drawing.
        "before:absolute before:-inset-x-2.5 before:-inset-y-1.5 before:content-[''] pointer-fine:before:hidden",
        className,
      )}
      {...rest}
    >
      {children ?? <Grip size={14} />}
    </button>
  );
}

/** Position and state of the item it's called inside, for content that reacts to being moved. */
export function useReorderListItem() {
  const list = useList();
  const item = useContext(ItemCtx);
  if (!item) throw new Error("useReorderListItem must be used inside ReorderListItem");
  return {
    position: list.order.indexOf(item.value) + 1,
    total: list.order.length,
    lifted: list.active?.id === item.value || list.pressed === item.value,
  };
}
