"use client";
import { Combobox } from "@base-ui/react/combobox";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { HighlightMatch, findMatches } from "@/components/ui/highlight-match";
import { cn } from "@/lib/cn";
import { Search } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

export type FacetOption = {
  value: string;
  label: string;
  /** Decorative: a status glyph, a priority bar, an avatar. Shown in the list only. */
  icon?: React.ReactNode;
  /** How many results carry this value under the other active filters. Omit to hide counts. */
  count?: number;
  disabled?: boolean;
};

export type FacetedFilterProps = {
  /** The facet's name, on the trigger and in the list's label: "Status". */
  title: string;
  options: FacetOption[];
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** Chips shown on the trigger before the rest collapse into +N. */
  maxChips?: number;
  searchPlaceholder?: string;
  /** Plural noun for the empty state: "No statuses match". Defaults to the title, lowercased. */
  noun?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  /** Portal target for the popup. Defaults to document.body. */
  container?: Combobox.Portal.Props["container"];
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

export function FacetedFilter({
  title,
  options,
  value,
  defaultValue = [],
  onValueChange,
  maxChips = 2,
  searchPlaceholder,
  noun,
  size = "sm",
  disabled,
  container,
  onOpenChange,
  className,
}: FacetedFilterProps) {
  const reduce = !!useReducedMotion();
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const ids = controlled ? value : inner;
  const setIds = (next: string[]) => {
    if (!controlled) setInner(next);
    onValueChange?.(next);
  };

  // Chips follow the list's order, not the order they were ticked, so the trigger reads the same way the list does.
  const selected = useMemo(() => options.filter((o) => ids.includes(o.value)), [options, ids]);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => (query.trim() ? options.filter((o) => findMatches(o.label, query)) : options), [options, query]);
  const shown = selected.slice(0, maxChips);
  const overflow = selected.length - shown.length;
  const active = selected.length > 0;
  const hasCounts = options.some((o) => o.count !== undefined);

  const { setList, y, height, opacity } = useGlide(reduce);
  const { innerRef, width } = useWidth();
  const statusId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // Clearing removes the button that was pressed; hand focus back to the search so the popup stays put.
  const clear = (fn: () => void) => {
    fn();
    inputRef.current?.focus();
  };

  const chipMotion = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, filter: "blur(2px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.85, filter: "blur(2px)", transition: { duration: 0.1 } },
    transition: reduce ? { duration: 0.12 } : { ...spring.snappy, filter: { duration: 0.18, ease: ease.out } }, // blur on a tween: a spring can overshoot below zero
  };

  return (
    <Combobox.Root<FacetOption, true>
      multiple
      items={options}
      filteredItems={filtered}
      autoHighlight
      value={selected}
      onValueChange={(next) => setIds(next.map((o) => o.value))}
      inputValue={query}
      onInputValueChange={(next, details) => {
        // Keep the query after a pick, so several matches can be ticked from one search.
        if (details.reason === "input-clear" && details.isItemPress) return details.cancel();
        setQuery(next);
      }}
      onOpenChange={(open) => onOpenChange?.(open)}
      onOpenChangeComplete={(open) => !open && setQuery("")}
      isItemEqualToValue={(a, b) => a.value === b.value}
      itemToStringLabel={(o) => o.label}
      itemToStringValue={(o) => o.value}
      disabled={disabled}
    >
      <Combobox.Trigger
        data-active={active || undefined}
        data-size={size}
        aria-label={active ? `${title}: ${selected.map((o) => o.label).join(", ")}` : title}
        className={cn(
          "group/trigger relative inline-flex shrink-0 items-center rounded-md border bg-transparent font-medium text-fg-2 select-none",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.97] active:duration-75",
          "border-dashed border-fg-4 hover:border-fg-3 hover:bg-hover hover:text-fg data-popup-open:border-fg-3 data-popup-open:bg-hover data-popup-open:text-fg",
          // Once a value is picked the outline turns solid: a filter that is doing something looks set.
          "data-active:border-solid data-active:border-line-2 data-active:hover:border-fg-4 data-active:data-popup-open:border-fg-4 data-active:bg-raised data-active:text-fg data-active:shadow-[var(--shadow)] data-active:hover:bg-hover",
          "data-disabled:pointer-events-none data-disabled:opacity-50",
          "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2",
          size === "sm" ? "h-7 pr-2 pl-1.5 text-[12.5px]" : "h-8 pr-2.5 pl-2 text-[13px]",
          className,
        )}
      >
        <PlusCircle active={active} reduce={reduce} />
        <span className="ml-1.5">{title}</span>
        <motion.span
          aria-hidden
          className="flex h-full overflow-hidden"
          initial={false}
          animate={{ width }}
          transition={reduce ? { duration: 0 } : { duration: 0.24, ease: ease.out }}
        >
          <span ref={innerRef} className="flex h-full w-max items-center">
            {active && <span className="mx-2 h-3.5 w-px shrink-0 bg-line-2" />}
            <span className="flex items-center gap-1">
              <AnimatePresence initial={false} mode="popLayout">
                {shown.map((o) => (
                  <motion.span key={o.value} layout={!reduce} {...chipMotion} className={chipClass}>
                    <span className="max-w-[9rem] truncate">{o.label}</span>
                  </motion.span>
                ))}
                {overflow > 0 && (
                  <motion.span key="more" layout={!reduce} {...chipMotion} className={cn(chipClass, "text-fg-2")}>
                    +<NumberFlow value={overflow} className="tabular" />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </span>
        </motion.span>
      </Combobox.Trigger>

      <Combobox.Portal container={container}>
        <Combobox.Positioner align="start" sideOffset={6} collisionPadding={8} className="z-(--z-popover) outline-none">
          <Combobox.Popup
            aria-label={`${title} filter`}
            className={cn(
              "flex w-60 max-w-(--available-width) origin-(--transform-origin) flex-col overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
              "transition-[opacity,scale] duration-160 ease-out-expo data-ending-style:duration-100 data-ending-style:ease-out",
              "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0",
              "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
            )}
          >
            <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-2.5">
              <Search size={14} className="shrink-0 text-fg-3" />
              <Combobox.Input
                ref={inputRef}
                aria-label={searchPlaceholder ?? `Search ${title.toLowerCase()}`}
                aria-describedby={statusId}
                placeholder={searchPlaceholder ?? title}
                onKeyDown={(e) => {
                  // Backspace in an empty search takes back the last value ticked.
                  if (e.key === "Backspace" && query === "" && ids.length) setIds(ids.slice(0, -1));
                }}
                className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]"
              />
            </div>

            <Combobox.Empty className="empty:hidden">
              <div className="flex flex-col items-center gap-2 px-3 py-5 text-center text-[12.5px] text-fg-3">
                <p className="max-w-full truncate">
                  {options.length ? (
                    <>
                      No {noun ?? title.toLowerCase()} match <span className="text-fg-2">“{query.trim()}”</span>
                    </>
                  ) : (
                    <>Nothing to filter by yet</>
                  )}
                </p>
                {query && (
                  <button type="button" onClick={() => clear(() => setQuery(""))} className={smallButton}>
                    Clear search
                  </button>
                )}
              </div>
            </Combobox.Empty>

            <Combobox.List ref={setList} className="relative max-h-[min(calc(var(--available-height)-6rem),17rem)] scroll-py-1 overflow-y-auto overscroll-contain p-1 outline-none empty:hidden">
              <motion.div aria-hidden style={{ y, height, opacity }} className="pointer-events-none absolute inset-x-1 top-0 rounded-lg bg-line" />
              <Combobox.Collection>
                {(o: FacetOption) => (
                  <Combobox.Item key={o.value} value={o} disabled={o.disabled} className={itemClass}>
                    <Box on={ids.includes(o.value)} reduce={reduce} />
                    {o.icon && <span className="flex shrink-0 text-fg-3 [&_svg]:size-3.5">{o.icon}</span>}
                    <HighlightMatch text={o.label} query={query} className="min-w-0 flex-1 truncate" />
                    {hasCounts && (
                      <span className={cn("shrink-0 font-mono text-[11px] text-fg-3 tabular", o.count === 0 && "text-fg-4")}>
                        {o.count !== undefined && <NumberFlow value={o.count} />}
                      </span>
                    )}
                  </Combobox.Item>
                )}
              </Combobox.Collection>
            </Combobox.List>

            <AnimatePresence initial={false}>
              {active && (
                <motion.div
                  key="footer"
                  initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0, transition: { duration: 0.14, ease: ease.out } }}
                  transition={{ duration: 0.2, ease: ease.out }}
                  className="shrink-0 overflow-hidden"
                >
                  <div className="flex h-9 items-center justify-between gap-2 border-t border-line pr-1.5 pl-3 text-[12px] text-fg-3">
                    <span className="flex items-center gap-1 tabular">
                      <NumberFlow value={selected.length} className="text-fg-2" /> selected
                    </span>
                    <button type="button" onClick={() => clear(() => setIds([]))} className={smallButton}>
                      Clear filter
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <span id={statusId} className="sr-only">
              {active ? `${selected.length} selected` : "None selected"}
            </span>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

const chipClass = "flex h-5 min-w-0 shrink-0 items-center rounded-[4px] bg-line px-1.5 text-[11.5px] leading-none font-normal text-fg";

const smallButton = cn(
  "h-6 rounded-md px-2 text-[12px] font-medium text-fg-2 hover:bg-hover hover:text-fg",
  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
  "transition-[background-color,color,scale] duration-150 active:scale-[0.96]",
);

const itemClass = cn(
  "group/item relative z-[1] flex h-8 cursor-default scroll-my-1 items-center gap-2.5 rounded-lg px-2 text-[13px] text-fg outline-none select-none pointer-coarse:h-10",
  "data-disabled:text-fg-4 data-disabled:[&_*]:text-fg-4",
);

// The plus turns a quarter and fades into a filled dot once the filter is active, so a filter
// that is doing something reads as set from across the toolbar.
function PlusCircle({ active, reduce }: { active: boolean; reduce: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden className="shrink-0 text-fg-3 group-hover/trigger:text-fg-2 group-data-active/trigger:text-fg">
      <circle cx="8" cy="8" r="5.75" />
      <motion.g
        initial={false}
        animate={active ? { rotate: 45, opacity: 0, scale: 0.6 } : { rotate: 0, opacity: 1, scale: 1 }}
        transition={reduce ? { duration: 0 } : spring.pop}
        style={{ originX: "8px", originY: "8px" }}
      >
        <path d="M8 5.5v5M5.5 8h5" />
      </motion.g>
      <motion.circle
        cx="8"
        cy="8"
        r="2.25"
        fill="currentColor"
        stroke="none"
        initial={false}
        animate={active ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
        transition={reduce ? { duration: 0 } : spring.pop}
        style={{ originX: "8px", originY: "8px" }}
      />
    </svg>
  );
}

// A checkbox that squashes on press and draws its tick when it turns on.
function Box({ on, reduce }: { on: boolean; reduce: boolean }) {
  return (
    <span
      aria-hidden
      data-state={on ? "checked" : "unchecked"}
      className={cn(
        "grid size-3.5 shrink-0 place-items-center rounded-[4px] border transition-[background-color,border-color,scale] duration-150 ease-out group-active/item:scale-[0.85]",
        on ? "border-fg bg-fg text-frame" : "border-line-2 bg-frame group-data-highlighted/item:border-fg-4",
      )}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <motion.path
          d="M2 5.2 4.1 7.2 8 2.8"
          initial={false}
          animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : { pathLength: { duration: 0.2, ease: ease.out }, opacity: { duration: 0.05 } }}
        />
      </svg>
    </span>
  );
}

// The chip strip's natural width, so the trigger can tween to it instead of snapping.
function useWidth() {
  const innerRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | "auto">("auto");
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.borderBoxSize?.[0]?.inlineSize ?? el.offsetWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { innerRef, width };
}

// One highlight for the list: glides after the pointer, jumps for arrow keys.
function useGlide(reduce: boolean) {
  const [list, setList] = useState<HTMLDivElement | null>(null);
  const y = useMotionValue(0);
  const height = useMotionValue(32);
  const opacity = useMotionValue(0);

  useEffect(() => {
    if (!list) return;
    let keyboard = false;
    let shown = false;
    let running: AnimationPlaybackControls[] = [];
    const stop = () => {
      running.forEach((c) => c.stop());
      running = [];
    };
    const place = () => {
      const el = list.querySelector<HTMLElement>("[data-highlighted]");
      stop();
      if (!el) {
        shown = false;
        running.push(animate(opacity, 0, { duration: reduce ? 0 : 0.12 }));
        return;
      }
      const target = el.hasAttribute("data-disabled") ? 0.45 : 1;
      if (!shown || keyboard || reduce) {
        y.jump(el.offsetTop);
        height.jump(el.offsetHeight);
        if (keyboard || reduce) opacity.jump(target);
        else running.push(animate(opacity, target, { duration: 0.08 }));
      } else {
        running.push(animate(y, el.offsetTop, spring.follow), animate(height, el.offsetHeight, spring.follow));
        opacity.jump(target);
      }
      shown = true;
    };
    const onKey = () => (keyboard = true);
    const onPointer = () => (keyboard = false);
    const observer = new MutationObserver(place);
    observer.observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-highlighted"] });
    document.addEventListener("keydown", onKey, true);
    list.addEventListener("pointermove", onPointer);
    place();
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKey, true);
      list.removeEventListener("pointermove", onPointer);
      stop();
    };
  }, [list, reduce, y, height, opacity]);

  return { setList, y, height, opacity };
}
