"use client";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Search, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type FilterGridCategory = { value: string; label: string };

const ALL = "__all";
const normalize = (s: string) => s.toLocaleLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

/* -------------------------------------------------------------------------------------------------
 * Headless filtering
 * -----------------------------------------------------------------------------------------------*/

export type UseFilterGridOptions<T> = {
  items: T[];
  /** One category or several. */
  getCategory: (item: T) => string | string[];
  /** Everything a search should match: name, description, tags. */
  getText: (item: T) => string;
  category?: string | null;
  defaultCategory?: string | null;
  onCategoryChange?: (category: string | null) => void;
  query?: string;
  defaultQuery?: string;
  onQueryChange?: (query: string) => void;
};

/** Search and category filtering, with per-category counts that follow the search. */
export function useFilterGrid<T>({ items, getCategory, getText, category: catProp, defaultCategory = null, onCategoryChange, query: queryProp, defaultQuery = "", onQueryChange }: UseFilterGridOptions<T>) {
  const [category, setCategory] = useControllableState<string | null>({ value: catProp, defaultValue: defaultCategory, onChange: onCategoryChange });
  const [query, setQuery] = useControllableState({ value: queryProp, defaultValue: defaultQuery, onChange: onQueryChange });
  const q = normalize(query.trim());

  const { matches, counts, results } = useMemo(() => {
    // Every word has to appear somewhere, in any order.
    const words = q.split(/\s+/).filter(Boolean);
    const matches = items.filter((item) => {
      const text = normalize(getText(item));
      return words.every((w) => text.includes(w));
    });
    const counts = new Map<string, number>();
    for (const item of matches) for (const c of [getCategory(item)].flat()) counts.set(c, (counts.get(c) ?? 0) + 1);
    const results = category ? matches.filter((item) => [getCategory(item)].flat().includes(category)) : matches;
    return { matches, counts, results };
  }, [items, q, category, getCategory, getText]);

  return { category, setCategory, query, setQuery, results, matchCount: matches.length, counts };
}

/* -------------------------------------------------------------------------------------------------
 * Match highlight
 * -----------------------------------------------------------------------------------------------*/

/** Marks each searched word inside a string. Safe with any characters in the query. */
export function FilterGridHighlight({ text, query, className }: { text: string; query: string; className?: string }) {
  const words = query.trim().split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.join("|")})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <mark key={i} className={cn("rounded-[3px] bg-fg/12 text-fg [box-decoration-break:clone] [-webkit-box-decoration-break:clone]", className)}>
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  );
}

/* -------------------------------------------------------------------------------------------------
 * The grid
 * -----------------------------------------------------------------------------------------------*/

export type FilterGridProps<T> = UseFilterGridOptions<T> &
  Omit<React.ComponentProps<"div">, "children" | "defaultValue"> & {
    categories: FilterGridCategory[];
    getKey: (item: T) => string;
    renderItem: (item: T, state: { query: string }) => React.ReactNode;
    /** Singular and plural noun for counts and the empty state. */
    itemLabel?: { one: string; other: string };
    /** Label for the chip that clears the category. */
    allLabel?: string;
    searchPlaceholder?: string;
    /** Narrowest a card may get before the grid drops a column. */
    minItemWidth?: number;
    /** Classes for the scrolling grid region. Give the root a height to make it scroll. */
    gridClassName?: string;
  };

export function FilterGrid<T>({
  items,
  getCategory,
  getText,
  category: catProp,
  defaultCategory,
  onCategoryChange,
  query: queryProp,
  defaultQuery,
  onQueryChange,
  categories,
  getKey,
  renderItem,
  itemLabel = { one: "item", other: "items" },
  allLabel = "All",
  searchPlaceholder = "Search",
  minItemWidth = 180,
  gridClassName,
  className,
  ...rest
}: FilterGridProps<T>) {
  const f = useFilterGrid({ items, getCategory, getText, category: catProp, defaultCategory, onCategoryChange, query: queryProp, defaultQuery, onQueryChange });
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const noun = (n: number) => (n === 1 ? itemLabel.one : itemLabel.other);
  const activeLabel = categories.find((c) => c.value === f.category)?.label;
  const trimmed = f.query.trim();

  // Announce the result count once typing settles, not on every keystroke.
  const [announced, setAnnounced] = useState("");
  const summary = f.results.length ? `${f.results.length} ${noun(f.results.length)}` : `No ${itemLabel.other}`;
  useEffect(() => {
    const t = window.setTimeout(() => setAnnounced(summary), 450);
    return () => window.clearTimeout(t);
  }, [summary]);

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)} {...rest}>
      <div className="flex items-center gap-3">
        <div className="relative flex h-8 min-w-0 flex-1 items-center rounded-lg border border-line-2 bg-raised shadow-[var(--shadow)] transition-[border-color,box-shadow] duration-150 hover:border-fg-4 focus-within:border-fg-4 focus-within:ring-2 focus-within:ring-fg/10">
          <Search size={14} className="pointer-events-none ml-2.5 shrink-0 text-fg-4" />
          <input
            ref={inputRef}
            type="search"
            value={f.query}
            onChange={(e) => f.setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && f.query) {
                e.preventDefault();
                f.setQuery("");
              }
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            className="h-full min-w-0 flex-1 bg-transparent px-2 text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px] [&::-webkit-search-cancel-button]:hidden"
          />
          {f.query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => (f.setQuery(""), inputRef.current?.focus())}
              className="relative mr-1.5 grid size-5 shrink-0 place-items-center rounded-md text-fg-3 outline-none transition-[color,background-color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.9] before:absolute before:-inset-3 before:content-[''] pointer-fine:before:hidden"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <span aria-hidden className="shrink-0 text-[12px] text-fg-3 tabular max-sm:hidden">{summary}</span>
      </div>

      <Chips
        categories={categories}
        value={f.category}
        onChange={f.setCategory}
        counts={f.counts}
        total={f.matchCount}
        allLabel={allLabel}
        reduce={!!reduce}
      />

      <motion.div layoutScroll className={cn("relative min-h-0 flex-1 overflow-y-auto overscroll-contain", gridClassName)}>
        <ul
          className="relative grid gap-2"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${minItemWidth}px, 100%), 1fr))` }}
          aria-label={activeLabel ? `${activeLabel} ${itemLabel.other}` : itemLabel.other}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {f.results.map((item) => (
              <motion.li
                key={getKey(item)}
                layout={reduce ? false : "position"}
                // Leavers shrink away fast; arrivals wait a beat for the room they need.
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, filter: "blur(2px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: reduce ? 0.12 : 0.22, ease: ease.out, delay: reduce ? 0 : 0.06 } }}
                exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.96, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } }}
                transition={spring.soft}
                className="flex min-w-0"
              >
                {renderItem(item, { query: f.query })}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <AnimatePresence initial={false}>
          {f.results.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2, delay: reduce ? 0 : 0.12 } }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              className="absolute inset-0 flex min-h-40 flex-col items-center justify-center gap-2.5 px-4 text-center"
            >
              <EmptyMessage
                query={trimmed}
                categoryLabel={activeLabel}
                otherMatches={f.category != null && f.matchCount > 0 ? f.matchCount : 0}
                noun={itemLabel.other}
                onClearQuery={() => (f.setQuery(""), inputRef.current?.focus())}
                onClearCategory={() => f.setCategory(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <span role="status" aria-live="polite" className="sr-only">
        {announced}
      </span>
    </div>
  );
}

// Says why it's empty and offers the one action that fixes it.
function EmptyMessage({
  query,
  categoryLabel,
  otherMatches,
  noun,
  onClearQuery,
  onClearCategory,
}: {
  query: string;
  categoryLabel?: string;
  otherMatches: number;
  noun: string;
  onClearQuery: () => void;
  onClearCategory: () => void;
}) {
  const where = categoryLabel ? ` in ${categoryLabel}` : "";
  const title = query ? (
    <>
      No {noun}
      {where} match <span className="text-fg">“{query}”</span>
    </>
  ) : (
    <>No {noun}{where} yet</>
  );
  const action = otherMatches ? { label: `Show ${otherMatches} in all categories`, run: onClearCategory } : query ? { label: "Clear search", run: onClearQuery } : categoryLabel ? { label: "Show all", run: onClearCategory } : null;

  return (
    <>
      <p className="max-w-[36ch] text-[13px] text-fg-2 [text-wrap:balance]">{title}</p>
      {action && (
        <button
          type="button"
          onClick={action.run}
          className="h-7 rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
        >
          {action.label}
        </button>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Category chips: one pill slides to the chosen chip; the row scrolls sideways when it must
 * -----------------------------------------------------------------------------------------------*/

function Chips({
  categories,
  value,
  onChange,
  counts,
  total,
  allLabel,
  reduce,
}: {
  categories: FilterGridCategory[];
  value: string | null;
  onChange: (v: string | null) => void;
  counts: Map<string, number>;
  total: number;
  allLabel: string;
  reduce: boolean;
}) {
  const pillId = useId();
  const rowRef = useRef<HTMLDivElement>(null);

  // Fade whichever edge has more chips beyond it. Written straight to the DOM: no re-render per scroll frame.
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const sync = () => {
      el.dataset.fadeStart = String(el.scrollLeft > 2);
      el.dataset.fadeEnd = String(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    el.addEventListener("scroll", sync, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", sync);
    };
  }, []);

  const chips = [{ value: ALL, label: allLabel, count: total }, ...categories.map((c) => ({ ...c, count: counts.get(c.value) ?? 0 }))];
  const current = value ?? ALL;

  return (
    <ToggleGroup
      ref={rowRef}
      value={[current]}
      onValueChange={(next) => {
        // A chip row always has one choice; pressing the current chip keeps it.
        if (!next[0]) return;
        onChange(next[0] === ALL ? null : next[0]);
        document.getElementById(`${pillId}-${next[0]}`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
      }}
      aria-label="Categories"
      className={cn(
        "-mx-1 flex scroll-px-6 gap-1 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "data-[fade-start=true]:data-[fade-end=true]:[mask-image:linear-gradient(to_right,transparent,var(--fg)_20px,var(--fg)_calc(100%-20px),transparent)]",
        "data-[fade-start=true]:data-[fade-end=false]:[mask-image:linear-gradient(to_right,transparent,var(--fg)_20px)]",
        "data-[fade-start=false]:data-[fade-end=true]:[mask-image:linear-gradient(to_left,transparent,var(--fg)_20px)]",
      )}
    >
      {chips.map((c) => {
        const on = c.value === current;
        return (
          <Toggle
            key={c.value}
            id={`${pillId}-${c.value}`}
            value={c.value}
            className={cn(
              "group/chip relative flex h-7 shrink-0 select-none items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium outline-none",
              "transition-[color,scale] duration-150 active:scale-[0.96] active:duration-75",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              "before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
              on ? "text-frame" : c.count ? "text-fg-2 hover:text-fg" : "text-fg-4 hover:text-fg-3",
            )}
          >
            {!on && <span aria-hidden className="absolute inset-0 rounded-full border border-line-2 transition-colors duration-150 group-hover/chip:border-fg-4 group-hover/chip:bg-hover" />}
            {on && <motion.span layoutId={pillId} aria-hidden transition={reduce ? { duration: 0 } : spring.snappy} className="absolute inset-0 rounded-full bg-fg" />}
            <span className="relative">{c.label}</span>
            <span className={cn("relative tabular text-[11.5px] font-normal transition-colors duration-150", on ? "text-frame/65" : "text-fg-4")}>{c.count}</span>
          </Toggle>
        );
      })}
    </ToggleGroup>
  );
}
