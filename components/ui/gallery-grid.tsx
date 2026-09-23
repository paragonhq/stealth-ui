"use client";
import { Checkbox } from "@base-ui/react/checkbox";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useRef } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";
import { BlurUpImage } from "@/components/ui/blur-up-image";

export type GalleryItem = {
  id: string;
  src: string;
  alt: string;
  /** Intrinsic size. The masonry is laid out from these before any image loads. */
  width: number;
  height: number;
  /** A tiny version shown blurred while the image loads. */
  placeholder?: string;
  /** The dominant color, shown while the image loads. */
  color?: string;
  title?: string;
  meta?: string;
};

type Columns = Record<number, number>;

/**
 * Shortest-column masonry, worked out for every column count up front. Positions are
 * expressed in container-query units, so the server render is already the right layout
 * at any width: nothing measures, nothing jumps, and the DOM stays in reading order.
 */
function layout(items: GalleryItem[], n: number, gap: number) {
  const heights = new Array<number>(n).fill(0); // in column widths
  const counts = new Array<number>(n).fill(0);
  const w = `var(--gg-w${n})`;
  const place = items.map((item) => {
    let c = 0;
    // Compare real heights (column widths plus the gaps already stacked) to pick the shortest.
    for (let i = 1; i < n; i++) if (heights[i] * 1000 + counts[i] * gap < heights[c] * 1000 + counts[c] * gap) c = i;
    const top = `calc(${heights[c]} * ${w} + ${counts[c] * gap}px)`;
    const left = `calc(${c} * (${w} + ${gap}px))`;
    heights[c] += item.height / item.width;
    counts[c] += 1;
    return { left, top };
  });
  let tallest = 0;
  for (let i = 1; i < n; i++) if (heights[i] * 1000 + counts[i] * gap > heights[tallest] * 1000 + counts[tallest] * gap) tallest = i;
  const height = `calc(${heights[tallest]} * ${w} + ${Math.max(0, counts[tallest] - 1) * gap}px)`;
  return { place, height };
}

export type GalleryGridProps = Omit<React.ComponentProps<"div">, "children" | "onSelect"> & {
  items: GalleryItem[];
  /** Column count by minimum container width in px, e.g. { 0: 2, 480: 3, 720: 4 }. */
  columns?: Columns;
  /** Space between tiles in px. */
  gap?: number;
  selected?: string[];
  defaultSelected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  /** Keep selection mode on with nothing selected (after a "Select" button). Otherwise it follows the selection. */
  selectionMode?: boolean;
  /** Called with false when Escape asks to leave selection mode, so a forced mode can end too. */
  onSelectionModeChange?: (on: boolean) => void;
  /** Called when a tile is opened outside selection mode, with its image element to animate from. Without it, a press selects. */
  onOpen?: (item: GalleryItem, index: number, tile: HTMLElement) => void;
  /** Overlay buttons for a tile, shown on hover and focus. Use GalleryGridAction. */
  actions?: (item: GalleryItem) => React.ReactNode;
  /** Shown in place of the grid when there are no items. */
  empty?: React.ReactNode;
};

export function GalleryGrid({
  items,
  columns = { 0: 2, 440: 3, 720: 4 },
  gap = 6,
  selected: selectedProp,
  defaultSelected = [],
  onSelectedChange,
  selectionMode,
  onSelectionModeChange,
  onOpen,
  actions,
  empty,
  className,
  onKeyDown,
  ...rest
}: GalleryGridProps) {
  const [selected, setSelected] = useControllableState({ value: selectedProp, defaultValue: defaultSelected, onChange: onSelectedChange });
  const selecting = selectionMode ?? selected.length > 0;
  const anchor = useRef<string | null>(null);
  const reduce = !!useReducedMotion();
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");

  const counts = [...new Set(Object.values(columns))];
  const layouts = Object.fromEntries(counts.map((n) => [n, layout(items, n, gap)]));
  const breakpoints = Object.entries(columns)
    .map(([min, n]) => [Number(min), n] as const)
    .sort((a, b) => a[0] - b[0]);

  // One rule per breakpoint swaps which precomputed position each tile reads.
  const css = [
    `[data-gg="${id}"]{container-type:inline-size;${counts.map((n) => `--gg-w${n}:calc((100cqw - ${(n - 1) * gap}px) / ${n});`).join("")}}`,
    ...breakpoints.map(([min, n]) => {
      const rule = `[data-gg="${id}"] [data-gg-canvas]{height:var(--gg-h${n})}[data-gg="${id}"] [data-gg-tile]{--gg-l:var(--gg-l${n});--gg-t:var(--gg-t${n});width:var(--gg-w${n})}`;
      return min > 0 ? `@container (min-width:${min}px){${rule}}` : rule;
    }),
  ].join("");

  const toggle = (itemId: string, range: boolean) => {
    if (range && anchor.current && anchor.current !== itemId) {
      const a = items.findIndex((i) => i.id === anchor.current);
      const b = items.findIndex((i) => i.id === itemId);
      if (a >= 0 && b >= 0) {
        const span = items.slice(Math.min(a, b), Math.max(a, b) + 1).map((i) => i.id);
        setSelected([...new Set([...selected, ...span])]);
        anchor.current = itemId;
        return;
      }
    }
    anchor.current = itemId;
    setSelected(selected.includes(itemId) ? selected.filter((s) => s !== itemId) : [...selected, itemId]);
  };

  if (!items.length)
    return (
      <div className={cn("grid min-h-40 place-items-center rounded-xl border border-dashed border-line-2 p-6 text-center", className)} {...rest}>
        {empty ?? <p className="text-[13px] text-fg-3">No photos yet</p>}
      </div>
    );

  return (
    <div
      data-gg={id}
      data-selecting={selecting || undefined}
      className={cn("relative w-full", className)}
      style={Object.fromEntries(counts.map((n) => [`--gg-h${n}`, layouts[n].height])) as React.CSSProperties}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        // Escape clears the selection; ⌘A / Ctrl+A selects every photo.
        if (e.key === "Escape" && selecting) {
          e.preventDefault();
          setSelected([]);
          onSelectionModeChange?.(false);
        } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
          e.preventDefault();
          setSelected(items.map((i) => i.id));
        }
      }}
      {...rest}
    >
      <style href={`gg-${id}`} precedence="default">
        {css}
      </style>
      <ul data-gg-canvas className="relative" aria-label="Photos" aria-multiselectable={selecting || undefined}>
        <AnimatePresence initial={false}>
          {items.map((item, index) => (
            <Tile
              key={item.id}
              item={item}
              index={index}
              style={Object.fromEntries(
                counts.flatMap((n) => [
                  [`--gg-l${n}`, layouts[n].place[index].left],
                  [`--gg-t${n}`, layouts[n].place[index].top],
                ]),
              )}
              selecting={selecting}
              checked={selected.includes(item.id)}
              reduce={reduce}
              onToggle={toggle}
              onOpen={onOpen}
              actions={actions}
            />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

type TileProps = {
  item: GalleryItem;
  index: number;
  style: Record<string, string>;
  selecting: boolean;
  checked: boolean;
  reduce: boolean;
  onToggle: (id: string, range: boolean) => void;
  onOpen?: GalleryGridProps["onOpen"];
  actions?: GalleryGridProps["actions"];
};

function Tile({ item, index, style, selecting, checked, reduce, onToggle, onOpen, actions }: TileProps) {
  const imageRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null);
  const name = item.title ?? item.alt;

  // Long-press on touch starts selecting, the way photo apps do.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch" || selecting) return;
    const p = { x: e.clientX, y: e.clientY, fired: false, timer: 0 };
    p.timer = window.setTimeout(() => {
      p.fired = true;
      onToggle(item.id, false);
    }, 450);
    press.current = p;
  };
  const cancelPress = (e?: React.PointerEvent) => {
    const p = press.current;
    if (!p) return;
    if (e && e.type === "pointermove" && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) return;
    window.clearTimeout(p.timer);
    if (!p.fired) press.current = null;
  };

  return (
    <motion.li
      data-gg-tile
      data-checked={checked || undefined}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, scale: 0.9, transition: { duration: 0.16, ease: ease.in } }}
      transition={{ duration: 0.24, ease: ease.out }}
      className={cn(
        "group/tile absolute left-0 top-0 select-none",
        // Tiles glide to their new place when the column count changes or a neighbour leaves.
        "[translate:var(--gg-l)_var(--gg-t)] transition-[translate] duration-300 ease-in-out-quart motion-reduce:transition-none",
      )}
      style={{ ...style, aspectRatio: `${item.width} / ${item.height}` }}
    >
      <div
        ref={imageRef}
        data-gallery-image={item.id}
        className={cn(
          "absolute inset-0 overflow-hidden rounded-lg bg-hover",
          "transition-[scale,border-radius] duration-200 ease-out-expo motion-reduce:transition-none",
          // Selected photos step back from the edges, so the selection reads at a glance.
          checked && "scale-[0.9] rounded-xl motion-reduce:scale-100",
        )}
      >
        <BlurUpImage
          src={item.src}
          alt={item.alt}
          placeholder={item.placeholder}
          color={item.color}
          aspectRatio={`${item.width} / ${item.height}`}
          className="size-full"
        />
        {/* Title on hover or focus, over a short scrim that exists only for legibility. */}
        {item.title && (
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 flex flex-col bg-linear-to-t from-page/80 to-transparent px-2.5 pb-2 pt-8",
              "translate-y-1 opacity-0 transition-[opacity,translate] duration-200 ease-out-expo",
              "group-hover/tile:translate-y-0 group-hover/tile:opacity-100 group-focus-within/tile:translate-y-0 group-focus-within/tile:opacity-100",
              "group-data-checked/tile:opacity-0 motion-reduce:translate-y-0",
            )}
          >
            <span className="truncate text-[12.5px] font-medium text-fg">{item.title}</span>
            {item.meta && <span className="truncate text-[11.5px] text-fg-2">{item.meta}</span>}
          </div>
        )}
      </div>

      <button
        type="button"
        role={selecting || !onOpen ? "checkbox" : undefined}
        aria-checked={selecting || !onOpen ? checked : undefined}
        aria-label={selecting || !onOpen ? name : `Open ${name}`}
        onPointerDown={onPointerDown}
        onPointerMove={cancelPress}
        onPointerUp={() => cancelPress()}
        onPointerCancel={() => cancelPress()}
        onContextMenu={(e) => press.current?.fired && e.preventDefault()}
        onClick={(e) => {
          if (press.current?.fired) {
            press.current = null;
            return;
          }
          if (selecting) onToggle(item.id, e.shiftKey);
          else if (onOpen) onOpen(item, index, imageRef.current ?? e.currentTarget);
          // With nothing to open, a press selects instead of doing nothing.
          else onToggle(item.id, e.shiftKey);
        }}
        onKeyDown={(e) => {
          // x selects the focused photo without opening it.
          if (e.key === "x" && !e.metaKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            onToggle(item.id, e.shiftKey);
          }
        }}
        className={cn(
          "absolute inset-0 rounded-lg [-webkit-touch-callout:none]",
          selecting || !onOpen ? "cursor-default" : "cursor-zoom-in",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[scale] duration-150 ease-out active:scale-[0.985]",
        )}
      />

      <Checkbox.Root
        checked={checked}
        onCheckedChange={(_, details) => onToggle(item.id, !!(details.event as MouseEvent | undefined)?.shiftKey)}
        aria-label={`Select ${name}`}
        // In selection mode the whole tile is the checkbox; this one is just its picture.
        tabIndex={selecting ? -1 : undefined}
        aria-hidden={selecting || undefined}
        className={cn(
          "absolute left-1.5 top-1.5 grid size-[22px] place-items-center rounded-full",
          "border-[1.5px] border-raised/90 bg-page/30 text-frame shadow-[var(--shadow)] backdrop-blur-sm dark:border-fg/90",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[opacity,scale,background-color,border-color] duration-150 ease-out active:scale-90",
          "data-checked:border-fg data-checked:bg-fg",
          "before:absolute before:-inset-2.5 before:content-['']",
          // Hidden until it's useful: hover, keyboard focus, selection mode, or checked.
          "opacity-0 group-hover/tile:opacity-100 group-focus-within/tile:opacity-100 pointer-coarse:opacity-100",
          selecting && "opacity-100",
        )}
      >
        <Checkbox.Indicator keepMounted className="grid place-items-center">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <motion.path
              d="M2.75 6.25 5 8.5l4.25-5"
              initial={false}
              animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
              transition={reduce ? { duration: 0 } : { pathLength: { duration: 0.22, ease: ease.out }, opacity: { duration: 0.08 } }}
            />
          </svg>
        </Checkbox.Indicator>
      </Checkbox.Root>

      {actions && (
        <div
          className={cn(
            "absolute right-1.5 top-1.5 flex gap-1",
            "opacity-0 transition-opacity duration-150 group-hover/tile:opacity-100 group-focus-within/tile:opacity-100 pointer-coarse:opacity-100 has-data-active:opacity-100",
            selecting && "pointer-events-none opacity-0! [&_*]:invisible",
          )}
        >
          {actions(item)}
        </div>
      )}
    </motion.li>
  );
}

export type GalleryGridActionProps = React.ComponentProps<"button"> & {
  /** Names the action; also its tooltip. */
  label: string;
  /** Pressed state, for toggles like Favorite. */
  active?: boolean;
};

/** A small round button for the tile overlay. */
export function GalleryGridAction({ label, active, className, children, ...rest }: GalleryGridActionProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      data-active={active || undefined}
      className={cn(
        "relative grid size-7 place-items-center rounded-full bg-page/60 text-fg shadow-[var(--shadow)] backdrop-blur-sm",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color,scale] duration-150 ease-out hover:bg-page/85 active:scale-90",
        "before:absolute before:-inset-1.5 before:content-['']",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
