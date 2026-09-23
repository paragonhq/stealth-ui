"use client";
import { Menu } from "@base-ui/react/menu";
import { Toolbar } from "@base-ui/react/toolbar";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Check, MoreH } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";

export type OverflowItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onSelect?: () => void;
  /** Higher stays in the bar longer. Ties fall back to order: later items fold first. */
  priority?: number;
  /** Makes it a toggle: aria-pressed in the bar, a checkbox item in the menu. */
  pressed?: boolean;
  /** Show only the icon in the bar (the label becomes its name and tooltip). */
  iconOnly?: boolean;
  disabled?: boolean;
  tone?: "default" | "danger";
};

/**
 * Which items fit in `width`, by priority. The ones that don't fold into the menu, and when
 * anything folds the menu button's width is reserved first.
 */
export function fitItems(items: OverflowItem[], widths: Record<string, number>, width: number, moreWidth: number, gap: number) {
  const total = items.reduce((sum, it, i) => sum + (widths[it.id] ?? 0) + (i ? gap : 0), 0);
  if (total <= width) return new Set(items.map((i) => i.id));
  const budget = width - moreWidth - gap;
  const ranked = items.map((it, i) => ({ it, i })).sort((a, b) => (b.it.priority ?? 0) - (a.it.priority ?? 0) || a.i - b.i);
  const fit = new Set<string>();
  let used = 0;
  for (const { it } of ranked) {
    const w = (widths[it.id] ?? 0) + (fit.size ? gap : 0);
    // Strict priority: once something doesn't fit, nothing ranked below it squeezes in ahead of it.
    if (used + w > budget) break;
    used += w;
    fit.add(it.id);
  }
  return fit;
}

const GAP = 2;

export type OverflowMenuProps = Omit<React.ComponentProps<"div">, "children"> & {
  items: OverflowItem[];
  /** Accessible name of the toolbar. */
  label: string;
  /** Label of the overflow button. */
  moreLabel?: string;
  /** Content after the collapsible items that never folds, e.g. a primary action. */
  end?: React.ReactNode;
  /** Called with the ids that are currently folded into the menu. */
  onOverflowChange?: (hidden: string[]) => void;
};

/**
 * A toolbar that folds its lowest-priority items into a "more" menu as it narrows, and lets them
 * back out as it widens. Items leave the bar with a fade while their neighbors spring into place.
 */
export function OverflowMenu({ items, label, moreLabel = "More", end, onOverflowChange, className, ...rest }: OverflowMenuProps) {
  const reduce = useReducedMotion();
  const regionRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const moreGhostRef = useRef<HTMLSpanElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  // Everything shows until the first measurement, which lands before the first paint.
  const [visible, setVisible] = useState<Set<string> | null>(null);
  const [settled, setSettled] = useState(false);
  const visibleRef = useRef<Set<string> | null>(null);

  // One observer measures the region and every item's natural width from a hidden copy of the row.
  const idsKey = items.map((i) => `${i.id}:${i.label}:${i.iconOnly ? 1 : 0}`).join("|");
  const itemsRef = useRef(items);
  useLayoutEffect(() => {
    itemsRef.current = items;
  });
  useLayoutEffect(() => {
    const region = regionRef.current;
    const ghost = ghostRef.current;
    if (!region || !ghost) return;
    const measure = () => {
      const widths: Record<string, number> = {};
      ghost.querySelectorAll<HTMLElement>("[data-ghost-id]").forEach((el) => {
        widths[el.dataset.ghostId!] = el.getBoundingClientRect().width;
      });
      const moreWidth = moreGhostRef.current?.getBoundingClientRect().width ?? 32;
      const next = fitItems(itemsRef.current, widths, region.clientWidth, moreWidth, GAP);
      const prev = visibleRef.current;
      if (prev && prev.size === next.size && [...next].every((id) => prev.has(id))) return;
      // Anything folding away while focused hands focus to the menu button instead of the page.
      const focused = document.activeElement?.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
      if (focused && !next.has(focused)) requestAnimationFrame(() => moreRef.current?.focus());
      visibleRef.current = next;
      setVisible(next);
      // The first fit happens before paint and shouldn't animate; later ones should.
      if (!prev) requestAnimationFrame(() => setSettled(true));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(region);
    ro.observe(ghost);
    return () => ro.disconnect();
  }, [idsKey]);

  const shown = visible ? items.filter((i) => visible.has(i.id)) : items;
  const hidden = visible ? items.filter((i) => !visible.has(i.id)) : [];
  const hiddenKey = hidden.map((i) => i.id).join(",");
  useEffect(() => {
    onOverflowChange?.(hiddenKey ? hiddenKey.split(",") : []);
  }, [hiddenKey, onOverflowChange]);

  const layout = reduce || !settled ? false : ("position" as const);
  const still = { opacity: 0, transition: { duration: 0 } };

  return (
    <TooltipProvider>
      <Toolbar.Root aria-label={label} className={cn("relative flex min-w-0 items-center gap-2", className)} {...rest}>
        <div ref={regionRef} className="relative flex min-w-0 flex-1 items-center overflow-hidden" style={{ gap: GAP }}>
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((it) => (
              <motion.div
                key={it.id}
                layout={layout}
                data-item-id={it.id}
                className="shrink-0"
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, filter: "blur(2px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={!settled ? still : reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.9, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } }}
                transition={reduce ? { duration: 0.12 } : { ...spring.snappy, opacity: { duration: 0.16, ease: ease.out } }}
              >
                <BarItem item={it} />
              </motion.div>
            ))}
            {hidden.length > 0 && (
              <motion.div
                key="__more"
                layout={layout}
                className="shrink-0"
                initial={!settled ? false : reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, transition: { duration: 0.12 } }}
                transition={reduce ? { duration: 0.12 } : spring.pop}
              >
                <Menu.Root>
                  <Toolbar.Button
                    ref={moreRef}
                    render={<Menu.Trigger />}
                    aria-label={`${moreLabel}, ${hidden.length} ${hidden.length === 1 ? "item" : "items"}`}
                    className={cn(buttonClass, "gap-1 pl-2 pr-2 data-popup-open:bg-fg/[0.08] data-popup-open:text-fg")}
                  >
                    <MoreH />
                    {/* The count ticks as items fold in, so it's clear where they went. */}
                    <span aria-hidden className="tabular text-[11.5px] text-fg-3">
                      <NumberFlow value={hidden.length} animated={!reduce} />
                    </span>
                  </Toolbar.Button>
                  <Menu.Portal>
                    <Menu.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={8} className="z-(--z-dropdown)">
                      <Menu.Popup className={popupClass}>
                        {hidden.map((it) => (
                          <MenuItem key={it.id} item={it} />
                        ))}
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {end}

        {/* A hidden copy of every item at its natural width: what the fitting is measured against. */}
        <div ref={ghostRef} aria-hidden inert className="pointer-events-none invisible absolute left-0 top-0 flex w-max" style={{ gap: GAP }}>
          {items.map((it) => (
            <span key={it.id} data-ghost-id={it.id} className="shrink-0">
              <span className={cn(buttonClass, it.iconOnly ? "w-8 px-0" : "px-2.5")}>
                {it.icon}
                {!it.iconOnly && it.label}
              </span>
            </span>
          ))}
          <span ref={moreGhostRef} className={cn(buttonClass, "gap-1 pl-2 pr-2")}>
            <MoreH />
            <span className="tabular text-[11.5px]">{items.length}</span>
          </span>
        </div>
      </Toolbar.Root>
    </TooltipProvider>
  );
}

const buttonClass = cn(
  "relative inline-flex h-8 shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-[12.5px] font-medium text-fg-2 outline-none",
  "transition-[background-color,color,scale] duration-150 hover:bg-fg/[0.06] hover:text-fg active:scale-[0.96] active:duration-75",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
  "aria-pressed:bg-fg/[0.1] aria-pressed:text-fg data-disabled:pointer-events-none data-disabled:opacity-40",
  "[&_svg]:size-4 [&_svg]:shrink-0",
);

const popupClass = cn(
  "min-w-48 max-w-(--available-width) rounded-xl border border-line-2 bg-raised p-1 text-fg shadow-pop outline-none",
  "origin-(--transform-origin) transition-[opacity,scale,translate] duration-160 ease-out-expo",
  "data-starting-style:scale-96 data-starting-style:-translate-y-1 data-starting-style:opacity-0",
  "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-100",
  "data-instant:transition-none motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:translate-y-0",
);

function BarItem({ item }: { item: OverflowItem }) {
  const button = (
    <Toolbar.Button
      aria-label={item.iconOnly ? item.label : undefined}
      aria-pressed={item.pressed}
      disabled={item.disabled}
      onClick={item.onSelect}
      className={cn(buttonClass, item.iconOnly ? "w-8 px-0" : "px-2.5", item.tone === "danger" && "hover:bg-danger-soft hover:text-danger")}
    >
      {item.icon}
      {!item.iconOnly && item.label}
    </Toolbar.Button>
  );
  return item.iconOnly ? <Tooltip content={item.label}>{button}</Tooltip> : button;
}

function MenuItem({ item }: { item: OverflowItem }) {
  const cls = cn(
    "flex h-8 cursor-default select-none items-center gap-2.5 rounded-lg px-2 text-[13px] outline-none pointer-coarse:h-10",
    "transition-colors duration-75 data-highlighted:bg-fg/[0.06] data-disabled:opacity-40",
    "[&_svg]:size-4 [&_svg]:shrink-0",
    item.tone === "danger" ? "text-danger data-highlighted:bg-danger-soft" : "[&>svg:first-child]:text-fg-3",
  );
  if (item.pressed !== undefined) {
    return (
      <Menu.CheckboxItem checked={item.pressed} onCheckedChange={() => item.onSelect?.()} disabled={item.disabled} className={cls}>
        {item.icon}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <Menu.CheckboxItemIndicator keepMounted className="grid size-4 place-items-center text-fg transition-[opacity,scale] duration-150 data-unchecked:scale-75 data-unchecked:opacity-0">
          <Check />
        </Menu.CheckboxItemIndicator>
      </Menu.CheckboxItem>
    );
  }
  return (
    <Menu.Item onClick={item.onSelect} disabled={item.disabled} className={cls}>
      {item.icon}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </Menu.Item>
  );
}
