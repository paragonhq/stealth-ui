"use client";
import { Checkbox } from "@base-ui/react/checkbox";
import { Popover } from "@base-ui/react/popover";
import NumberFlow from "@number-flow/react";
import { motion, Reorder, useDragControls, useReducedMotion } from "motion/react";
import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { Grip, Lock, Search, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type ColumnItem = {
  id: string;
  label: string;
  /** Unticked columns stay in the list so they can be brought back. Defaults to true. */
  visible?: boolean;
  /** Pinned to the start of the table: always shown, never moved. */
  locked?: boolean;
};

const isVisible = (c: ColumnItem) => c.locked || c.visible !== false;

// Locked columns always lead, in their own order; everything else follows.
function normalize(columns: ColumnItem[]) {
  return [...columns.filter((c) => c.locked), ...columns.filter((c) => !c.locked)];
}

const sameColumns = (a: ColumnItem[], b: ColumnItem[]) =>
  a.length === b.length && a.every((c, i) => c.id === b[i].id && isVisible(c) === isVisible(b[i]));

/** The visible columns, in order, for rendering the table itself. */
export function visibleColumns<T extends ColumnItem>(columns: T[]): T[] {
  return normalize(columns).filter(isVisible) as T[];
}

/** Column state on its own: keep it next to the table and hand it to ColumnManager. */
export function useColumnManager<T extends ColumnItem>(initial: T[]) {
  const [columns, setColumns] = useState(initial);
  const visible = useMemo(() => visibleColumns(columns), [columns]);
  return { columns, setColumns, visible } as const;
}

/* -------------------------------------------------------------------------------------------------
 * Panel: the list on its own, for a popover, a sheet or a settings page
 * -----------------------------------------------------------------------------------------------*/

export type ColumnManagerPanelProps = Omit<React.ComponentProps<"div">, "defaultValue" | "title"> & {
  value?: ColumnItem[];
  defaultValue?: ColumnItem[];
  onValueChange?: (columns: ColumnItem[]) => void;
  /** What Reset restores. Defaults to the columns as they were on first render. */
  resetTo?: ColumnItem[];
  title?: React.ReactNode;
  /** Show a filter field once there are this many columns. */
  searchThreshold?: number;
};

export function ColumnManagerPanel({
  value: valueProp,
  defaultValue,
  onValueChange,
  resetTo,
  title = "Columns",
  searchThreshold = 9,
  className,
  ...rest
}: ColumnManagerPanelProps) {
  const [raw, setValue] = useControllableState({ value: valueProp, defaultValue: defaultValue ?? [], onChange: onValueChange });
  const [initial] = useState(raw);
  const baseline = resetTo ?? initial;
  const reduce = useReducedMotion();
  const hintId = useId();

  const columns = useMemo(() => normalize(raw), [raw]);
  const locked = columns.filter((c) => c.locked);
  const movable = columns.filter((c) => !c.locked);
  const shown = columns.filter(isVisible).length;

  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  // Keyboard reorder: the picked-up column and the order to return to on Escape.
  const [grabbed, setGrabbed] = useState<{ id: string; from: string[] } | null>(null);
  const [message, setMessage] = useState("");

  const labelOf = (id: string) => columns.find((c) => c.id === id)?.label ?? id;
  const positionOf = (ids: string[], id: string) => locked.length + ids.indexOf(id) + 1;
  const total = columns.length;

  const setOrder = (ids: string[]) => {
    const byId = new Map(movable.map((c) => [c.id, c]));
    setValue([...locked, ...ids.map((id) => byId.get(id)!)]);
  };

  const toggle = (id: string, next: boolean) => {
    // The last visible column can't go: a table with no columns is a blank box.
    if (!next && shown <= 1) return;
    setValue(columns.map((c) => (c.id === id ? { ...c, visible: next } : c)));
  };

  const ids = movable.map((c) => c.id);

  const move = (id: string, delta: number) => {
    const from = ids.indexOf(id);
    const to = Math.max(0, Math.min(ids.length - 1, from + delta));
    if (from === to) return;
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setOrder(next);
    setMessage(`${labelOf(id)} moved to position ${positionOf(next, id)} of ${total}.`);
  };

  const onHandleKey = (e: React.KeyboardEvent, id: string) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (grabbed?.id === id) {
        setGrabbed(null);
        setMessage(`${labelOf(id)} dropped at position ${positionOf(ids, id)} of ${total}.`);
      } else {
        setGrabbed({ id, from: ids });
        setMessage(`${labelOf(id)} picked up, position ${positionOf(ids, id)} of ${total}. Arrow keys move it, Space drops it, Escape cancels.`);
      }
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      // Alt+arrows move without picking up first.
      if (grabbed?.id === id || e.altKey) {
        e.preventDefault();
        move(id, e.key === "ArrowUp" ? -1 : 1);
      }
    } else if (e.key === "Escape" && grabbed?.id === id) {
      // Marks the Escape as handled so the popover stays open (see ColumnManager).
      e.preventDefault();
      setOrder(grabbed.from);
      setGrabbed(null);
      setMessage(`Move canceled. ${labelOf(id)} is back at position ${positionOf(grabbed.from, id)}.`);
    }
  };

  const q = query.trim().toLowerCase();
  const searchable = total >= searchThreshold;
  const matches = q ? columns.filter((c) => c.label.toLowerCase().includes(q)) : null;
  const allShown = shown === total;
  const pristine = sameColumns(columns, normalize(baseline));

  return (
    <div className={cn("flex min-h-0 flex-col text-[13px] text-fg", className)} {...rest}>
      <div className="flex items-baseline justify-between gap-3 px-3 pb-2 pt-3">
        <span className="text-[13px] font-medium tracking-[-0.01em]">{title}</span>
        <span className="text-[12px] text-fg-3 tabular">
          <NumberFlow value={shown} className="tabular" /> of {total} shown
        </span>
      </div>

      {searchable && (
        <div className="px-2 pb-1.5">
          <div className="flex h-8 items-center gap-2 rounded-lg border border-line-2 bg-frame px-2 transition-[border-color,box-shadow] duration-150 focus-within:border-fg-4 focus-within:ring-2 focus-within:ring-fg/10">
            <Search size={14} className="shrink-0 text-fg-4" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // First Escape clears the filter, the next one closes the popover.
                if (e.key === "Escape" && query) {
                  e.preventDefault();
                  setQuery("");
                }
              }}
              placeholder="Find a column"
              aria-label="Find a column"
              enterKeyHint="search"
              className="min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[12.5px]"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear filter"
                onClick={() => setQuery("")}
                className="relative -mr-1 grid size-5 shrink-0 place-items-center rounded text-fg-3 outline-none transition-[color,scale] duration-150 hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.9] before:absolute before:-inset-3 before:content-[''] pointer-fine:before:hidden"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      <motion.div layoutScroll className="min-h-0 overflow-y-auto overscroll-contain px-1 pb-1 [scrollbar-width:thin]">
        {matches ? (
          matches.length ? (
            <ul aria-label={typeof title === "string" ? title : "Columns"}>
              {matches.map((c) => (
                <li key={c.id}>
                  <Row column={c} onToggle={toggle} lastVisible={shown <= 1 && isVisible(c)} slot={c.locked ? <LockMark /> : null} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
              <p className="text-[12.5px] text-fg-3">
                No columns match <span className="text-fg-2">“{query.trim()}”</span>
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="h-7 rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.97]"
              >
                Clear filter
              </button>
            </div>
          )
        ) : (
          <>
            {locked.length > 0 && (
              <ul aria-label="Pinned columns">
                {locked.map((c) => (
                  <li key={c.id}>
                    <Row column={c} onToggle={toggle} lastVisible slot={<LockMark />} />
                  </li>
                ))}
              </ul>
            )}
            <Reorder.Group as="ul" axis="y" values={ids} onReorder={setOrder} aria-label={typeof title === "string" ? title : "Columns"}>
              {movable.map((c) => (
                <MovableRow
                  key={c.id}
                  column={c}
                  reduce={!!reduce}
                  hintId={hintId}
                  grabbed={grabbed?.id === c.id}
                  dragging={dragging === c.id}
                  lastVisible={shown <= 1 && isVisible(c)}
                  onToggle={toggle}
                  onKey={onHandleKey}
                  onBlurHandle={() => {
                    if (grabbed?.id === c.id) {
                      setGrabbed(null);
                      setMessage(`${c.label} dropped at position ${positionOf(ids, c.id)} of ${total}.`);
                    }
                  }}
                  onDragStart={() => setDragging(c.id)}
                  onDragEnd={() => {
                    setDragging(null);
                    setMessage(`${c.label} moved to position ${positionOf(ids, c.id)} of ${total}.`);
                  }}
                />
              ))}
            </Reorder.Group>
          </>
        )}
      </motion.div>

      <div className="flex items-center justify-between gap-2 border-t border-line p-1">
        <FooterButton disabled={allShown} onClick={() => setValue(columns.map((c) => ({ ...c, visible: true })))}>
          Show all
        </FooterButton>
        <FooterButton disabled={pristine} onClick={() => setValue(normalize(baseline))}>
          Reset
        </FooterButton>
      </div>

      <span id={hintId} className="sr-only">
        Press Space to pick up, the arrow keys to move, Space again to drop.
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {message}
      </span>
    </div>
  );
}

function FooterButton({ className, ...rest }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "h-7 rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none",
        "transition-[background-color,color,opacity,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...rest}
    />
  );
}

function LockMark() {
  return (
    <span className="grid h-8 w-6 shrink-0 place-items-center text-fg-4" title="Pinned">
      <Lock size={13} />
      <span className="sr-only">Pinned</span>
    </span>
  );
}

type RowProps = {
  column: ColumnItem;
  onToggle: (id: string, next: boolean) => void;
  /** The only column left showing: it can't be hidden. */
  lastVisible: boolean;
  slot: React.ReactNode;
};

// The whole row is the checkbox's label, so a press anywhere on the name toggles it.
function Row({ column, onToggle, lastVisible, slot }: RowProps) {
  const checked = isVisible(column);
  const disabled = column.locked || lastVisible;
  return (
    <div className="flex h-8 items-center rounded-lg transition-colors duration-150 hover:bg-hover">
      {slot ?? <span className="w-6 shrink-0" />}
      <label
        className={cn("group/col flex h-full min-w-0 flex-1 select-none items-center gap-2.5 pr-2", disabled ? "cursor-default" : "cursor-pointer")}
        title={column.locked ? undefined : lastVisible ? "At least one column stays visible" : undefined}
      >
        <Checkbox.Root
          checked={checked}
          disabled={disabled}
          onCheckedChange={(next) => onToggle(column.id, next)}
          className={cn(
            "relative grid size-3.5 shrink-0 place-items-center rounded-[4px] border outline-none",
            "transition-[background-color,border-color,color,scale,opacity] duration-150 ease-out-expo",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "data-checked:border-fg data-checked:bg-fg data-checked:text-frame",
            "data-unchecked:border-fg-4 data-unchecked:bg-raised",
            !disabled && "motion-safe:active:scale-[0.86] motion-safe:group-active/col:scale-[0.86] group-hover/col:data-unchecked:border-fg-3",
            disabled && "opacity-45",
          )}
        >
          <Checkbox.Indicator keepMounted render={(props, state) => <span {...props}><Tick on={state.checked} /></span>} />
        </Checkbox.Root>
        <span className={cn("min-w-0 truncate transition-colors duration-150", checked ? "text-fg" : "text-fg-3")}>{column.label}</span>
      </label>
    </div>
  );
}

function Tick({ on }: { on: boolean }) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden focusable="false" className="size-3.5">
      <motion.path
        d="M3.75 8.25 6.75 11.25 12.25 4.75"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
        transition={
          reduce
            ? { duration: 0 }
            : on
              ? { pathLength: { duration: 0.22, ease: ease.out, delay: 0.02 }, opacity: { duration: 0.04 } }
              : { pathLength: { duration: 0.1, ease: ease.in }, opacity: { duration: 0.06, delay: 0.04 } }
        }
      />
    </svg>
  );
}

type MovableRowProps = Omit<RowProps, "slot"> & {
  reduce: boolean;
  hintId: string;
  grabbed: boolean;
  dragging: boolean;
  onKey: (e: React.KeyboardEvent, id: string) => void;
  onBlurHandle: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
};

function MovableRow({ column, reduce, hintId, grabbed, dragging, onKey, onBlurHandle, onDragStart, onDragEnd, ...row }: MovableRowProps) {
  const controls = useDragControls();
  const lifted = grabbed || dragging;
  return (
    <Reorder.Item
      value={column.id}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      // Neighbors make room on the snappy spring; the dropped row settles on it too.
      transition={reduce ? { duration: 0 } : spring.snappy}
      whileDrag={reduce ? undefined : { scale: 1.02 }}
      data-dragging={dragging || undefined}
      data-grabbed={grabbed || undefined}
      className={cn(
        "relative rounded-lg transition-[background-color,box-shadow] duration-150",
        lifted && "bg-raised shadow-pop ring-1 ring-line-2",
        grabbed && "z-1",
      )}
    >
      <Row
        column={column}
        {...row}
        slot={
          <button
            type="button"
            aria-label={`Reorder ${column.label}`}
            aria-describedby={hintId}
            aria-pressed={grabbed}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              controls.start(e);
            }}
            onKeyDown={(e) => onKey(e, column.id)}
            onBlur={onBlurHandle}
            className={cn(
              "relative grid h-8 w-6 shrink-0 touch-none place-items-center rounded-md outline-none",
              "cursor-grab text-fg-4 transition-[color,scale] duration-150 hover:text-fg-2 active:cursor-grabbing",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-fg-3",
              lifted && "text-fg-2",
              // A 44px target on touch without widening the drawing.
              "before:absolute before:-inset-x-2 before:-inset-y-1.5 before:content-[''] pointer-fine:before:hidden",
            )}
          >
            <Grip size={14} />
          </button>
        }
      />
    </Reorder.Item>
  );
}

/* -------------------------------------------------------------------------------------------------
 * The trigger and popover
 * -----------------------------------------------------------------------------------------------*/

export type ColumnManagerProps = Omit<ColumnManagerPanelProps, "className"> & {
  /** Trigger label. Also its accessible name when iconOnly. */
  label?: string;
  iconOnly?: boolean;
  size?: "sm" | "md";
  side?: Popover.Positioner.Props["side"];
  align?: Popover.Positioner.Props["align"];
  /** Where to portal the popover. Defaults to document.body. */
  container?: Popover.Portal.Props["container"];
  className?: string;
  /** Classes for the popover surface. */
  popupClassName?: string;
};

export function ColumnManager({
  label = "Columns",
  iconOnly = false,
  size = "md",
  side = "bottom",
  align = "end",
  container,
  className,
  popupClassName,
  value: valueProp,
  defaultValue,
  onValueChange,
  resetTo,
  ...panel
}: ColumnManagerProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue: defaultValue ?? [], onChange: onValueChange });
  const [initial] = useState(value);
  const shown = value.filter(isVisible).length;
  const hidden = value.length - shown;

  return (
    <Popover.Root
      onOpenChange={(open, details) => {
        // An Escape that already did something inside (canceled a move, cleared the filter) doesn't also close.
        if (!open && details.reason === "escape-key" && details.event.defaultPrevented) details.cancel();
      }}
    >
      <Popover.Trigger
        aria-label={iconOnly ? `${label}, ${hidden ? `${hidden} hidden` : "all shown"}` : undefined}
        className={cn(
          "group/trigger relative inline-flex shrink-0 select-none items-center justify-center font-medium tracking-[-0.005em] outline-none",
          "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover data-popup-open:border-fg-4 data-popup-open:bg-hover",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.97] active:duration-75",
          "data-disabled:pointer-events-none data-disabled:opacity-50",
          size === "sm" ? "h-7 gap-1.5 rounded-md text-[12px]" : "h-8 gap-2 rounded-lg text-[12.5px]",
          iconOnly ? (size === "sm" ? "w-7" : "w-8") : size === "sm" ? "px-2" : "px-2.5",
          iconOnly && "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
          className,
        )}
      >
        <ColumnsGlyph className="shrink-0 text-fg-2 transition-colors duration-150 group-hover/trigger:text-fg group-data-popup-open/trigger:text-fg" />
        {!iconOnly && (
          <>
            <span>{label}</span>
            <span className="-mr-0.5 flex items-center font-normal text-fg-3 tabular" aria-label={hidden ? `${hidden} hidden` : "All shown"}>
              <NumberFlow value={shown} className="tabular" aria-hidden />
              <span aria-hidden>/{value.length}</span>
            </span>
          </>
        )}
        {iconOnly && hidden > 0 && <span aria-hidden className="absolute right-1 top-1 size-1.5 rounded-full bg-fg" />}
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Positioner side={side} align={align} sideOffset={6} collisionPadding={8} className="z-(--z-popover)">
          <Popover.Popup
            className={cn(
              "flex max-h-[min(26rem,var(--available-height))] w-64 max-w-[var(--available-width)] flex-col rounded-xl border border-line-2 bg-raised shadow-pop outline-none",
              // Grows from the trigger and drifts 4px away from it; leaves faster and simpler.
              "origin-[var(--transform-origin)] transition-[opacity,scale,translate] duration-200 ease-out-expo",
              "data-starting-style:scale-[0.96] data-starting-style:opacity-0",
              "data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1",
              "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-150",
              "data-instant:transition-none motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-ending-style:scale-100",
              popupClassName,
            )}
          >
            <Popover.Title className="sr-only">{label}</Popover.Title>
            <ColumnManagerPanel value={value} onValueChange={setValue} resetTo={resetTo ?? initial} {...panel} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ColumnsGlyph({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" className={className}>
      <rect x="2.25" y="2.75" width="11.5" height="10.5" rx="1.75" />
      <path d="M6.1 2.75v10.5M9.9 2.75v10.5" />
    </svg>
  );
}
