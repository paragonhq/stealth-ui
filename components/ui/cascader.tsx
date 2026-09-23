"use client";
import { Popover } from "@base-ui/react/popover";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ChevronDown, ChevronLeft, ChevronRight, Search } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type CascaderOption = {
  value: string;
  label: string;
  /** Quiet text at the end of the row: a count, a code, a status. */
  hint?: string;
  disabled?: boolean;
  children?: CascaderOption[];
};

/** The option objects along a path of values. Stops at the first value that doesn't resolve. */
export function resolveCascaderPath(options: CascaderOption[], path: string[]) {
  const out: CascaderOption[] = [];
  let list: CascaderOption[] | undefined = options;
  for (const v of path) {
    const hit: CascaderOption | undefined = list?.find((o) => o.value === v);
    if (!hit) break;
    out.push(hit);
    list = hit.children;
  }
  return out;
}

/** Every selectable path in the tree, for search. Leaves only, unless parents are selectable too. */
export function flattenCascader(options: CascaderOption[], withParents = false) {
  const out: CascaderOption[][] = [];
  const walk = (list: CascaderOption[], trail: CascaderOption[]) => {
    for (const o of list) {
      const next = [...trail, o];
      const leaf = !o.children?.length;
      if (leaf || withParents) out.push(next);
      if (!leaf) walk(o.children!, next);
    }
  };
  walk(options, []);
  return out;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Below this width the columns can't sit side by side, so they stack and slide.
const NARROW = "(max-width: 639px)";
function useNarrow() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(NARROW);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}

const COL = 184; // column width
const ROW = 32; // option height
const MAX_ROWS = 8;

type Via = "pointer" | "keyboard";

export type CascaderProps = Omit<React.ComponentProps<"button">, "value" | "defaultValue" | "onChange" | "children"> & {
  options: CascaderOption[];
  /** The chosen path of values, root first. */
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (path: string[], options: CascaderOption[]) => void;
  placeholder?: string;
  /** A name per column ("Region", "Country", "City"). Shown as column headers and used as each list's label. */
  levels?: string[];
  /** A search field that finds any selectable path by any of its labels. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Let a parent be the answer ("All of Europe"), not only a leaf. */
  selectParents?: boolean;
  /** Open a parent's column on hover as well as on press. */
  expandOn?: "click" | "hover";
  size?: "sm" | "md";
  invalid?: boolean;
  /** Submits the chosen path joined with "/". */
  name?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function Cascader({
  options,
  value: valueProp,
  defaultValue = [],
  onValueChange,
  placeholder = "Choose…",
  levels,
  searchable = false,
  searchPlaceholder = "Search",
  selectParents = false,
  expandOn = "click",
  size = "md",
  invalid = false,
  name,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  disabled,
  className,
  ...rest
}: CascaderProps) {
  const uid = useId();
  const reduce = useReducedMotion();
  const narrow = useNarrow();
  const [value, setValue] = useControllableState<string[]>({ value: valueProp, defaultValue });
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });

  // The path being browsed, which can run ahead of the committed value.
  const [trail, setTrail] = useState<string[]>(value);
  const [view, setView] = useState(0); // the column shown when stacked
  const [dir, setDir] = useState(1);
  const [via, setVia] = useState<Via>("pointer");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const initialRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const hoverTimer = useRef<number>(undefined);
  const typed = useRef({ text: "", at: 0 });

  const chosen = useMemo(() => resolveCascaderPath(options, value), [options, value]);
  const trailOpts = resolveCascaderPath(options, trail);
  const columns: CascaderOption[][] = [options];
  for (const o of trailOpts) if (o.children?.length) columns.push(o.children);
  const shown = Math.min(view, columns.length - 1);

  // Every column is the same height, so revealing a longer one never makes the popup jump.
  const bodyH = useMemo(() => {
    let longest = 0;
    const walk = (l: CascaderOption[]) => {
      longest = Math.max(longest, l.length);
      l.forEach((o) => o.children && walk(o.children));
    };
    walk(options);
    return Math.min(MAX_ROWS, longest) * ROW + 8;
  }, [options]);

  const results = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return [];
    return flattenCascader(options, selectParents)
      .filter((p) => !p[p.length - 1].disabled && p.some((o) => fold(o.label).includes(q)))
      .slice(0, 50);
  }, [options, query, selectParents]);
  const searching = query.trim().length > 0;

  const optId = (depth: number, index: number) => `${uid}-o${depth}-${index}`;
  const resultId = (index: number) => `${uid}-r${index}`;

  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    document.getElementById(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });
  useLayoutEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const commit = (path: string[], close: boolean) => {
    setValue(path);
    onValueChange?.(path, resolveCascaderPath(options, path));
    if (close) setOpen(false);
  };

  const openChange = (next: boolean) => {
    if (next) {
      // Every open starts from the committed answer, not from wherever browsing was left.
      const resolved = resolveCascaderPath(options, value);
      const withKids = resolved.filter((o) => o.children?.length).length;
      setTrail(value);
      setView(Math.min(withKids, Math.max(0, resolved.length - 1)));
      setQuery("");
      setActive(0);
      setVia("pointer");
    }
    setOpen(next);
  };

  const expand = (depth: number, o: CascaderOption, how: Via, focusChild: boolean) => {
    setVia(how);
    setDir(1);
    // Re-entering the open parent keeps the deeper browsing intact.
    if (trail[depth] !== o.value) setTrail([...trail.slice(0, depth), o.value]);
    setView(depth + 1);
    if (focusChild) {
      const kids = o.children ?? [];
      const keep = trail[depth] === o.value ? kids.findIndex((k) => k.value === trail[depth + 1]) : -1;
      const first = keep >= 0 ? keep : kids.findIndex((k) => !k.disabled);
      if (first >= 0) pendingFocus.current = optId(depth + 1, first);
    }
  };

  const back = (depth: number, how: Via) => {
    if (depth === 0) return;
    setVia(how);
    setDir(-1);
    setView(depth - 1);
    const parent = columns[depth - 1].findIndex((o) => o.value === trail[depth - 1]);
    pendingFocus.current = optId(depth - 1, Math.max(0, parent));
  };

  const activate = (depth: number, o: CascaderOption, how: Via, key?: string) => {
    if (o.disabled) return;
    const path = [...trail.slice(0, depth), o.value];
    if (o.children?.length) {
      // Enter on a selectable parent answers with it; everything else goes deeper.
      if (selectParents && key === "Enter") return commit(path, true);
      if (selectParents) commit(path, false);
      expand(depth, o, how, how === "keyboard");
      return;
    }
    setTrail(path);
    commit(path, true);
  };

  const move = (depth: number, from: number, step: number) => {
    const list = columns[depth];
    for (let i = 1; i <= list.length; i++) {
      const next = step === Infinity ? list.length - i : step === -Infinity ? i - 1 : (from + step * i + list.length * 2) % list.length;
      if (!list[next].disabled) return document.getElementById(optId(depth, next))?.focus();
    }
  };

  const onOptionKey = (e: React.KeyboardEvent, depth: number, index: number) => {
    const o = columns[depth][index];
    const stop = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    switch (e.key) {
      case "ArrowDown": stop(); return move(depth, index, 1);
      case "ArrowUp": stop(); return move(depth, index, -1);
      case "Home": stop(); return move(depth, index, -Infinity);
      case "End": stop(); return move(depth, index, Infinity);
      case "ArrowRight":
        stop();
        if (o.children?.length && !o.disabled) expand(depth, o, "keyboard", true);
        return;
      case "ArrowLeft":
        stop();
        if (narrow) return back(depth, "keyboard");
        if (depth > 0) {
          const parent = columns[depth - 1].findIndex((p) => p.value === trail[depth - 1]);
          document.getElementById(optId(depth - 1, Math.max(0, parent)))?.focus();
        }
        return;
      case "Enter":
      case " ":
        stop();
        return activate(depth, o, "keyboard", e.key);
    }
    // Typeahead: letters jump to the next option in this column that starts with them.
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = e.timeStamp;
      typed.current = { text: now - typed.current.at > 600 ? e.key : typed.current.text + e.key, at: now };
      const t = fold(typed.current.text);
      const list = columns[depth];
      const start = t.length === 1 ? index + 1 : index;
      for (let i = 0; i < list.length; i++) {
        const j = (start + i) % list.length;
        if (!list[j].disabled && fold(list[j].label).startsWith(t)) {
          document.getElementById(optId(depth, j))?.focus();
          break;
        }
      }
    }
  };

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" && query) {
      // First Escape clears the search, the second closes.
      e.preventDefault();
      e.stopPropagation();
      setQuery("");
      return;
    }
    if (!searching) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        (initialRef.current ?? document.getElementById(optId(0, 0)))?.focus();
      }
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length) setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      commit(results[active].map((o) => o.value), true);
    }
  };

  // Keyboard moves render on the same frame; pointer moves reveal the column.
  const mode = via === "keyboard" ? "instant" : reduce ? "fade" : "full";
  const initialIndex = (() => {
    const depth = narrow ? shown : Math.max(0, Math.min(trail.length, columns.length) - 1);
    const list = columns[depth] ?? [];
    const i = list.findIndex((o) => o.value === trail[depth]);
    return { depth, index: i >= 0 ? i : list.findIndex((o) => !o.disabled) };
  })();

  const renderColumn = (depth: number) => {
    const list = columns[depth];
    const current = list.findIndex((o) => o.value === trail[depth]);
    const tabStop = current >= 0 ? current : list.findIndex((o) => !o.disabled);
    const last = value.length - 1;
    return (
      <div
        role="listbox"
        aria-label={levels?.[depth] ?? `Level ${depth + 1}`}
        className="flex flex-col overflow-y-auto overscroll-contain p-1 outline-none"
        style={{ height: bodyH }}
      >
        {list.map((o, i) => {
          const onTrail = trail[depth] === o.value && !!o.children?.length;
          const selected = value[depth] === o.value && value.slice(0, depth).every((v, k) => v === trail[k]);
          const endpoint = selected && depth === last;
          const isInitial = initialIndex.depth === depth && initialIndex.index === i;
          return (
            <div
              key={o.value}
              id={optId(depth, i)}
              ref={isInitial ? initialRef : undefined}
              role="option"
              aria-selected={selected}
              aria-disabled={o.disabled || undefined}
              aria-haspopup={o.children?.length ? "listbox" : undefined}
              aria-expanded={o.children?.length ? onTrail : undefined}
              tabIndex={i === tabStop ? 0 : -1}
              data-on-trail={onTrail || undefined}
              data-selected={selected || undefined}
              data-disabled={o.disabled || undefined}
              onClick={() => activate(depth, o, "pointer")}
              onKeyDown={(e) => onOptionKey(e, depth, i)}
              onPointerEnter={() => {
                if (expandOn !== "hover" || narrow || o.disabled || !o.children?.length || onTrail) return;
                window.clearTimeout(hoverTimer.current);
                // A short intent delay so sweeping across the column doesn't open every row.
                hoverTimer.current = window.setTimeout(() => expand(depth, o, "pointer", false), 110);
              }}
              onPointerLeave={() => window.clearTimeout(hoverTimer.current)}
              className={cn(
                "group/opt relative flex h-8 shrink-0 cursor-default select-none items-center gap-2 rounded-md pl-2 pr-1.5 text-[13px] text-fg-2 outline-none",
                "transition-colors duration-100 hover:bg-fg/5 hover:text-fg data-[on-trail]:text-fg data-[selected]:text-fg",
                "focus-visible:bg-fg/5 focus-visible:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-4",
                "data-[disabled]:pointer-events-none data-[disabled]:text-fg-4",
              )}
            >
              {onTrail && (
                <motion.span
                  layoutId={reduce || via === "keyboard" ? undefined : `${uid}-trail-${depth}`}
                  aria-hidden
                  className="absolute inset-0 rounded-md bg-fg/[0.07]"
                  transition={spring.snappy}
                />
              )}
              <span className="relative min-w-0 flex-1 truncate">{o.label}</span>
              {o.hint && <span className="relative shrink-0 text-[11.5px] tabular text-fg-3">{o.hint}</span>}
              <span className="relative grid size-4 shrink-0 place-items-center text-fg-3">
                {endpoint ? (
                  <DrawnCheck reduce={!!reduce} />
                ) : o.children?.length ? (
                  <ChevronRight size={14} className="transition-transform duration-150 ease-out group-hover/opt:translate-x-px group-data-[on-trail]/opt:text-fg-2" />
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const header = (depth: number) =>
    levels?.[depth] ? (
      <div className="flex h-7 items-end px-3 pb-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-4">{levels[depth]}</div>
    ) : null;

  const pathKey = value.join("\u0000");

  return (
    <Popover.Root open={open} onOpenChange={openChange}>
      <Popover.Trigger
        disabled={disabled}
        data-size={size}
        data-invalid={invalid || undefined}
        aria-invalid={invalid || undefined}
        className={cn(
          "group/cascader relative inline-flex w-full min-w-0 select-none items-center gap-2 rounded-lg border border-line-2 bg-raised text-left shadow-[var(--shadow)]",
          "outline-none transition-[background-color,border-color,box-shadow,scale] duration-150 ease-out active:scale-[0.985] active:duration-75",
          "hover:border-fg-4 focus-visible:border-fg-4 focus-visible:ring-3 focus-visible:ring-fg/10 data-[popup-open]:border-fg-4",
          "data-[invalid]:border-danger data-[invalid]:focus-visible:ring-danger/15",
          "disabled:pointer-events-none disabled:opacity-50",
          size === "sm" ? "h-7 pl-2 pr-1.5 text-[12.5px]" : "h-8 pl-2.5 pr-2 text-[13px]",
          className,
        )}
        {...rest}
      >
        <span className="relative grid min-w-0 flex-1">
          <AnimatePresence initial={false}>
            <motion.span
              key={pathKey}
              className="col-start-1 row-start-1 flex min-w-0 items-center gap-1"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -6, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } }}
              transition={{ duration: reduce ? 0.15 : 0.22, ease: ease.out }}
            >
              {chosen.length === 0 ? (
                <span className="truncate text-fg-4">{placeholder}</span>
              ) : (
                <>
                  {chosen.length > 1 && (
                    // Ancestors give way first, so the answer itself stays readable.
                    <span className="flex min-w-0 shrink-[4] items-center gap-1 text-fg-3">
                      <span className="truncate">
                        {chosen.slice(0, -1).map((o, i) => (
                          <span key={o.value}>
                            {i > 0 && <span className="px-1 text-fg-4" aria-hidden>/</span>}
                            {o.label}
                          </span>
                        ))}
                      </span>
                      <span className="text-fg-4" aria-hidden>/</span>
                      <span className="sr-only">,</span>
                    </span>
                  )}
                  <span className="min-w-[3ch] shrink truncate text-fg">{chosen[chosen.length - 1].label}</span>
                </>
              )}
            </motion.span>
          </AnimatePresence>
        </span>
        <ChevronDown
          size={size === "sm" ? 14 : 16}
          className="shrink-0 text-fg-3 transition-transform duration-200 ease-out group-data-[popup-open]/cascader:rotate-180 motion-reduce:transition-none"
        />
      </Popover.Trigger>
      {name && <input type="hidden" name={name} value={value.join("/")} />}

      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} collisionPadding={8} className="z-(--z-popover)">
          <Popover.Popup
            initialFocus={(type) => (searchable ? (type === "touch" ? true : inputRef.current) : initialRef.current ?? true)}
            className={cn(
              "flex min-w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) flex-col overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
              "transition-[opacity,scale,translate] duration-180 ease-out-expo",
              "data-starting-style:-translate-y-1 data-starting-style:scale-[0.97] data-starting-style:opacity-0",
              "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-120",
              "motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
            )}
          >
            {searchable && (
              <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
                <Search size={14} className="shrink-0 text-fg-4" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onSearchKey}
                  role="combobox"
                  aria-expanded={searching}
                  aria-controls={`${uid}-results`}
                  aria-activedescendant={searching && results[active] ? resultId(active) : undefined}
                  aria-autocomplete="list"
                  aria-label={searchPlaceholder}
                  placeholder={searchPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="search"
                  className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]"
                />
              </div>
            )}

            {searching ? (
              <div
                id={`${uid}-results`}
                role="listbox"
                aria-label="Matches"
                className="flex w-[min(360px,calc(var(--available-width)-2px))] flex-col overflow-y-auto overscroll-contain p-1"
                style={{ maxHeight: bodyH + (levels ? 28 : 0) }}
              >
                {results.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                    <p className="text-[12.5px] text-fg-3">
                      No matches for <span className="text-fg">“{query.trim()}”</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        inputRef.current?.focus();
                      }}
                      className="h-7 rounded-md border border-line-2 px-2.5 text-[12px] font-medium text-fg outline-none transition-[background-color,scale] duration-150 hover:bg-fg/5 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  results.map((p, i) => {
                    const leaf = p[p.length - 1];
                    return (
                      <div
                        key={p.map((o) => o.value).join("/")}
                        id={resultId(i)}
                        role="option"
                        aria-selected={i === active}
                        data-active={i === active || undefined}
                        onPointerMove={() => i !== active && setActive(i)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => commit(p.map((o) => o.value), true)}
                        className="flex shrink-0 cursor-default select-none flex-col justify-center gap-0.5 rounded-md px-2 py-1.5 data-[active]:bg-fg/[0.07]"
                      >
                        <span className="truncate text-[13px] text-fg-2">
                          <Highlight text={leaf.label} query={query.trim()} />
                        </span>
                        {p.length > 1 && (
                          <span className="truncate text-[11.5px] text-fg-3">
                            {p.slice(0, -1).map((o, k) => (
                              <span key={o.value}>
                                {k > 0 && " / "}
                                <Highlight text={o.label} query={query.trim()} quiet />
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : narrow ? (
              // Stacked: one column at a time, sliding in the direction of travel.
              <div className="w-[min(320px,calc(var(--available-width)-2px))] overflow-hidden">
                <div className="flex h-9 items-center justify-between gap-2 border-b border-line pl-1 pr-3">
                  {shown > 0 ? (
                    <button
                      type="button"
                      onClick={() => back(shown, "pointer")}
                      className="flex h-7 min-w-0 items-center gap-1 rounded-md pl-1 pr-2 text-[12.5px] font-medium text-fg outline-none transition-[background-color,scale] duration-150 hover:bg-fg/5 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.96]"
                    >
                      <ChevronLeft size={14} className="shrink-0 text-fg-3" />
                      <span className="truncate">{trailOpts[shown - 1]?.label}</span>
                    </button>
                  ) : (
                    <span className="pl-2 text-[12.5px] font-medium text-fg">{levels?.[0] ?? "Choose"}</span>
                  )}
                  {shown > 0 && levels?.[shown] && (
                    <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-4">{levels[shown]}</span>
                  )}
                </div>
                <AnimatePresence initial={false} mode="popLayout" custom={{ dir, mode }}>
                  <motion.div
                    key={shown}
                    custom={{ dir, mode }}
                    variants={slide}
                    initial="enter"
                    animate="center"
                    exit="leave"
                    transition={mode === "full" ? spring.soft : { duration: mode === "fade" ? 0.15 : 0 }}
                  >
                    {renderColumn(shown)}
                  </motion.div>
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex">
                <AnimatePresence initial={false} custom={mode}>
                  {columns.map((_, depth) => (
                    <motion.div
                      key={depth}
                      custom={mode}
                      variants={reveal}
                      initial="enter"
                      animate="shown"
                      exit="gone"
                      transition={mode === "full" ? { width: { duration: 0.24, ease: ease.out }, opacity: { duration: 0.16 } } : { duration: mode === "fade" ? 0.15 : 0 }}
                      className={cn("shrink-0 overflow-hidden", depth > 0 && "border-l border-line")}
                    >
                      <motion.div
                        key={trail[depth - 1] ?? "root"}
                        style={{ width: COL }}
                        initial={mode === "full" ? { opacity: 0, x: -8 } : false}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, ease: ease.out }}
                      >
                        {header(depth)}
                        {renderColumn(depth)}
                      </motion.div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
            <span role="status" aria-live="polite" className="sr-only">
              {searching ? (results.length === 1 ? "1 match" : `${results.length} matches`) : ""}
            </span>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

type Mode = "instant" | "fade" | "full";
const reveal = {
  enter: (m: Mode) => (m === "instant" ? { width: COL + 1, opacity: 1 } : m === "fade" ? { width: COL + 1, opacity: 0 } : { width: 0, opacity: 0 }),
  shown: { width: COL + 1, opacity: 1 },
  gone: (m: Mode) => (m === "full" ? { width: 0, opacity: 0, transition: { duration: 0.16, ease: ease.inOut } } : { opacity: 0, transition: { duration: m === "fade" ? 0.1 : 0 } }),
};
const slide = {
  enter: ({ dir, mode }: { dir: number; mode: Mode }) => (mode === "full" ? { x: `${dir * 40}%`, opacity: 0 } : { opacity: mode === "fade" ? 0 : 1 }),
  center: { x: "0%", opacity: 1 },
  leave: ({ dir, mode }: { dir: number; mode: Mode }) =>
    mode === "full" ? { x: `${dir * -24}%`, opacity: 0, transition: { duration: 0.16, ease: ease.in } } : { opacity: 0, transition: { duration: mode === "fade" ? 0.1 : 0 } },
};

function Highlight({ text, query, quiet }: { text: string; query: string; quiet?: boolean }) {
  const at = fold(text).indexOf(fold(query));
  if (!query || at < 0) return <>{text}</>;
  // Folding strips accents without changing length for these scripts, so indexes line up.
  return (
    <>
      {text.slice(0, at)}
      <mark className={cn("bg-transparent", quiet ? "text-fg-2" : "font-medium text-fg")}>{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}

function DrawnCheck({ reduce }: { reduce: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-fg">
      <motion.path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.28, ease: ease.out, delay: 0.04 }}
      />
    </svg>
  );
}
