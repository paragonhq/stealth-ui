"use client";
import { Toolbar } from "@base-ui/react/toolbar";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Undo, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type ActiveFilter = {
  id: string;
  /** What is being filtered: "Status". */
  field: string;
  /** Defaults to "is". */
  operator?: string;
  /** One value, or several: ["Paid", "Refunded"]. */
  value: string | string[];
  /** Decorative, before the field name. */
  icon?: React.ReactNode;
};

export type ActiveFiltersProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "children"> & {
  value?: ActiveFilter[];
  defaultValue?: ActiveFilter[];
  onValueChange?: (filters: ActiveFilter[]) => void;
  /** Makes each chip's body a button, e.g. to reopen the filter's editor. */
  onEdit?: (filter: ActiveFilter, trigger: HTMLElement) => void;
  /** "collapse" keeps one line and folds the rest into +N; "wrap" shows every chip. */
  overflow?: "collapse" | "wrap";
  /** Show Clear all when there are two or more filters. */
  clearable?: boolean;
  /** Milliseconds the Undo offer stays after Clear all. 0 turns it off. */
  undoTimeout?: number;
  /** Shown in place of the chips when nothing is applied, holding the row's height. */
  empty?: React.ReactNode;
  "aria-label"?: string;
};

const summary = (f: ActiveFilter) => `${f.field} ${f.operator ?? "is"} ${[f.value].flat().join(", ")}`;

export function ActiveFilters({
  value,
  defaultValue = [],
  onValueChange,
  onEdit,
  overflow = "collapse",
  clearable = true,
  undoTimeout = 6000,
  empty = "No filters applied",
  "aria-label": ariaLabel = "Active filters",
  className,
  ...rest
}: ActiveFiltersProps) {
  const reduce = !!useReducedMotion();
  const [filters, setFilters] = useControllableState({ value, defaultValue, onChange: onValueChange });
  const [expanded, setExpanded] = useState(false);
  const [cleared, setCleared] = useState<ActiveFilter[] | null>(null);
  const [announce, setAnnounce] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef(new Map<string, HTMLElement>());
  const pendingFocus = useRef<{ id: string | null; part: "edit" | "remove" } | null>(null);
  const undoRef = useRef<HTMLButtonElement>(null);

  const { rowRef, measureRef, fit } = useFit(filters.map((f) => f.id + summary(f)).join("|"), overflow === "collapse" && !expanded);
  const collapsed = overflow === "collapse" && !expanded;
  const shown = collapsed ? filters.slice(0, fit) : filters;
  const hidden = filters.length - shown.length;

  // The Undo offer lapses on its own, and the moment the filters change from anywhere else.
  useEffect(() => {
    if (!cleared || !undoTimeout) return;
    const t = window.setTimeout(() => setCleared(null), undoTimeout);
    return () => window.clearTimeout(t);
  }, [cleared, undoTimeout]);
  const liveCleared = cleared && filters.length === 0 ? cleared : null;

  // After a removal, focus lands on the neighbor that slid into its place.
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (target.id === "undo") return undoRef.current?.focus();
    if (target.id === "more") return rootRef.current?.querySelector<HTMLElement>("[data-more]")?.focus();
    const chip = target.id ? chipRefs.current.get(target.id) : null;
    const el = chip?.querySelector<HTMLElement>(`[data-part="${target.part}"]`) ?? chip?.querySelector<HTMLElement>("button");
    (el ?? rootRef.current)?.focus();
  });

  const remove = (id: string) => {
    const index = filters.findIndex((f) => f.id === id);
    if (index < 0) return;
    const chip = chipRefs.current.get(id);
    const owned = !!chip?.contains(document.activeElement);
    const next = filters.filter((f) => f.id !== id);
    if (owned) {
      const part = (document.activeElement as HTMLElement | null)?.dataset.part === "edit" ? "edit" : "remove";
      const neighbor = next[Math.min(index, next.length - 1)]?.id ?? null;
      // If the neighbor is folded into +N it isn't on screen; fall back to the last visible chip.
      const visible = collapsed ? next.slice(0, Math.max(1, fit - 1)) : next;
      pendingFocus.current = { id: visible.some((f) => f.id === neighbor) ? neighbor : (visible[visible.length - 1]?.id ?? null), part };
    }
    setFilters(next);
    setAnnounce(`Removed ${summary(filters[index])}`);
  };

  const clearAll = () => {
    const had = filters;
    setFilters([]);
    setExpanded(false);
    if (undoTimeout) {
      setCleared(had);
      pendingFocus.current = { id: "undo", part: "remove" };
    } else pendingFocus.current = { id: null, part: "remove" };
    setAnnounce(`Cleared ${had.length} ${had.length === 1 ? "filter" : "filters"}`);
  };

  const undo = () => {
    if (!liveCleared) return;
    setFilters(liveCleared);
    setCleared(null);
    pendingFocus.current = { id: liveCleared[liveCleared.length - 1]?.id ?? null, part: "remove" };
    setAnnounce(`Restored ${liveCleared.length} ${liveCleared.length === 1 ? "filter" : "filters"}`);
  };

  const onKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      remove(id);
    }
  };

  const chipMotion = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, filter: "blur(2px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.9, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.out } },
    transition: reduce ? { duration: 0.14 } : { ...spring.snappy, filter: { duration: 0.18, ease: ease.out } }, // blur on a tween: a spring can overshoot below zero
  };

  const showClear = clearable && filters.length > 1;
  const showLess = overflow === "collapse" && expanded && filters.length > 0;

  return (
    <div ref={rootRef} tabIndex={-1} className={cn("relative min-w-0 outline-none", className)} {...rest}>
      <Toolbar.Root
        ref={rowRef}
        aria-label={ariaLabel}
        className={cn("flex min-h-7 min-w-0 items-center gap-1.5", collapsed ? "-mx-1 flex-nowrap overflow-x-clip px-1" : "flex-wrap")}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((f, i) => (
            <motion.div
              key={f.id}
              ref={(el: HTMLDivElement | null) => {
                if (el) chipRefs.current.set(f.id, el);
                else chipRefs.current.delete(f.id);
              }}
              layout={!reduce}
              {...chipMotion}
              className={cn("flex min-w-0", i === 0 ? "shrink" : "shrink-0")}
            >
              <Chip filter={f} onEdit={onEdit} onRemove={() => remove(f.id)} onKeyDown={(e) => onKeyDown(e, f.id)} />
            </motion.div>
          ))}

          {hidden > 0 && (
            <motion.div key="more" layout={!reduce} {...chipMotion} className="flex shrink-0">
              <Toolbar.Button
                data-more=""
                onClick={() => {
                  // Focus moves to the first chip that was folded away, which is what they came for.
                  pendingFocus.current = { id: filters[shown.length]?.id ?? null, part: onEdit ? "edit" : "remove" };
                  setExpanded(true);
                }}
                aria-label={`Show ${hidden} more ${hidden === 1 ? "filter" : "filters"}`}
                className={cn(ghostButton, "border border-dashed border-line-2 px-2 text-fg-2 tabular")}
              >
                +<NumberFlow value={hidden} />
              </Toolbar.Button>
            </motion.div>
          )}

          {(showClear || showLess) && (
            // Trailing actions sit together at the far end, so leftover space reads as intended,
            // and they wrap as one unit instead of stranding Clear all on a line of its own.
            <motion.div key="actions" layout={!reduce} {...chipMotion} className="ml-auto flex shrink-0 items-center gap-0.5">
              {showLess && (
                <Toolbar.Button
                  onClick={() => {
                    pendingFocus.current = { id: "more", part: "remove" };
                    setExpanded(false);
                  }}
                  className={cn(ghostButton, "px-2 text-fg-3")}>
                  Show less
                </Toolbar.Button>
              )}
              {showClear && (
                <Toolbar.Button onClick={clearAll} className={cn(ghostButton, "px-2 text-fg-3")}>
                  Clear all
                </Toolbar.Button>
              )}
            </motion.div>
          )}

          {filters.length === 0 && (
            <motion.div
              key={liveCleared ? "undo" : "empty"}
              layout={!reduce}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.2, ease: ease.out }}
              className="flex h-7 min-w-0 shrink-0 items-center gap-2 text-[12.5px]"
            >
              {liveCleared ? (
                <>
                  <span className="text-fg-3">
                    Cleared {liveCleared.length} {liveCleared.length === 1 ? "filter" : "filters"}
                  </span>
                  <Toolbar.Button ref={undoRef} onClick={undo} className={cn(ghostButton, "gap-1 px-1.5 text-fg")}>
                    <Undo size={14} />
                    Undo
                  </Toolbar.Button>
                </>
              ) : (
                <span className="text-fg-4">{empty}</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Toolbar.Root>

      {/* Every chip laid out invisibly on one line, so the row knows how many fit before showing them. */}
      {overflow === "collapse" && (
        <div ref={measureRef} aria-hidden inert className="pointer-events-none invisible absolute top-0 left-0 flex h-0 items-start gap-1.5 overflow-visible">
          {filters.map((f) => (
            <div key={f.id} className="flex shrink-0">
              <Chip filter={f} onEdit={onEdit} />
            </div>
          ))}
          <div data-measure="more" className={cn(ghostButton, "border border-dashed px-2 tabular")}>+{filters.length}</div>
          <div data-measure="clear" className={cn(ghostButton, "px-2")}>Clear all</div>
        </div>
      )}

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

const ghostButton = cn(
  "inline-flex h-7 shrink-0 items-center rounded-md text-[12.5px] font-medium whitespace-nowrap select-none",
  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
  "transition-[background-color,border-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.96] active:duration-75",
  "pointer-coarse:relative pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2",
);

type ChipProps = {
  filter: ActiveFilter;
  onEdit?: (filter: ActiveFilter, trigger: HTMLElement) => void;
  onRemove?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
};

function Chip({ filter, onEdit, onRemove, onKeyDown }: ChipProps) {
  const values = [filter.value].flat();
  const text = summary(filter);
  const body = (
    <>
      {filter.icon && <span className="flex shrink-0 text-fg-3 [&_svg]:size-3.5">{filter.icon}</span>}
      <span className="shrink-0 text-fg-2">{filter.field}</span>
      <span className="shrink-0 text-fg-3">{filter.operator ?? "is"}</span>
      <span className="min-w-0 truncate font-medium text-fg">{values.slice(0, 2).join(", ")}</span>
      {values.length > 2 && <span className="shrink-0 text-fg-3 tabular">+{values.length - 2}</span>}
    </>
  );
  const measuring = !onRemove;

  return (
    <div
      data-chip=""
      title={values.length > 2 ? text : undefined}
      className="group/chip flex h-7 max-w-[18rem] min-w-0 items-center rounded-md border border-line-2 bg-raised text-[12.5px] shadow-[var(--shadow)] transition-[border-color] duration-150 hover:border-fg-4"
    >
      {onEdit && !measuring ? (
        <Toolbar.Button
          data-part="edit"
          aria-label={`Edit filter: ${text}`}
          onClick={(e) => onEdit(filter, e.currentTarget)}
          onKeyDown={onKeyDown}
          className="flex h-full min-w-0 items-center gap-1.5 rounded-l-[5px] pr-1.5 pl-2 outline-none transition-[background-color,opacity] duration-150 group-has-[[data-part=remove]:hover]/chip:opacity-50 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
        >
          {body}
        </Toolbar.Button>
      ) : (
        // Hovering the × dims the chip it will take away, so the target is never in doubt.
        <span className="flex h-full min-w-0 items-center gap-1.5 pr-1.5 pl-2 transition-opacity duration-150 group-has-[[data-part=remove]:hover]/chip:opacity-50">{body}</span>
      )}
      {measuring ? (
        <span className="h-full w-6 shrink-0 border-l border-line" />
      ) : (
        <Toolbar.Button
          data-part="remove"
          aria-label={`Remove filter: ${text}`}
          onClick={onRemove}
          onKeyDown={onKeyDown}
          className={cn(
            "relative grid h-full w-6 shrink-0 place-items-center rounded-r-[5px] border-l border-line text-fg-3",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "transition-[background-color,color] duration-150 hover:bg-hover hover:text-fg active:[&>svg]:scale-[0.8]",
            "pointer-coarse:after:absolute pointer-coarse:after:-inset-2",
          )}
        >
          <X size={12} className="transition-transform duration-100 ease-out" />
        </Toolbar.Button>
      )}
    </div>
  );
}

// How many chips fit on one line beside the +N and Clear all buttons, measured from the hidden copy.
function useFit(key: string, enabled: boolean) {
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(Infinity);

  useEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!enabled || !row || !measure) return;
    let frame = 0;
    const compute = () => {
      const chips = [...measure.children].filter((c) => !(c as HTMLElement).dataset.measure) as HTMLElement[];
      const more = measure.querySelector<HTMLElement>("[data-measure=more]")?.offsetWidth ?? 0;
      const clear = chips.length > 1 ? (measure.querySelector<HTMLElement>("[data-measure=clear]")?.offsetWidth ?? 0) : 0;
      const gap = 6;
      const available = row.parentElement?.clientWidth ?? row.clientWidth;
      let used = clear ? clear + gap : 0;
      let n = 0;
      for (let i = 0; i < chips.length; i++) {
        const w = chips[i].offsetWidth + (i ? gap : 0);
        const reserve = i < chips.length - 1 ? gap + more : 0;
        if (used + w + reserve > available) break;
        used += w;
        n = i + 1;
      }
      // At least one chip always shows (it truncates), so the row never reads as empty.
      setFit(Math.max(1, n));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(compute);
    };
    const observer = new ResizeObserver(schedule);
    if (row.parentElement) observer.observe(row.parentElement);
    observer.observe(measure);
    schedule();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [key, enabled]);

  return { rowRef, measureRef, fit: enabled ? fit : Infinity };
}
