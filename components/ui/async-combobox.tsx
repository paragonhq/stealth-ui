"use client";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Alert, Check, ChevronsUpDown, Loader, Refresh, Search, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

export type SearchStatus = "idle" | "debouncing" | "loading" | "success" | "error";

type SearchState<T> = { status: SearchStatus; results: T[]; query: string; error: unknown };

/**
 * Debounced remote search. Every new query aborts the request before it, and a
 * late answer to an old query is dropped, so results never go backwards.
 */
export function useAsyncSearch<T>({
  search,
  debounce = 250,
  minQueryLength = 1,
}: {
  search: (query: string, options: { signal: AbortSignal }) => Promise<T[]>;
  debounce?: number;
  minQueryLength?: number;
}) {
  const [state, setState] = useState<SearchState<T>>({ status: "idle", results: [], query: "", error: null });
  const timer = useRef<number>(undefined);
  const controller = useRef<AbortController | null>(null);
  const latest = useRef(search);
  useEffect(() => {
    latest.current = search;
  });
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      controller.current?.abort();
    },
    [],
  );

  const run = useCallback(
    (raw: string, wait = debounce) => {
      window.clearTimeout(timer.current);
      controller.current?.abort();
      const query = raw.trim();
      if (query.length < minQueryLength) {
        setState((s) => ({ ...s, status: "idle", query, error: null }));
        return;
      }
      setState((s) => ({ ...s, status: "debouncing", query, error: null }));
      timer.current = window.setTimeout(async () => {
        const c = new AbortController();
        controller.current = c;
        setState((s) => ({ ...s, status: "loading" }));
        try {
          const results = await latest.current(query, { signal: c.signal });
          if (!c.signal.aborted) setState({ status: "success", results, query, error: null });
        } catch (error) {
          if (!c.signal.aborted) setState((s) => ({ ...s, status: "error", error }));
        }
      }, wait);
    },
    [debounce, minQueryLength],
  );

  const retry = useCallback(() => run(state.query, 0), [run, state.query]);
  /** Stops anything in flight and goes back to idle, keeping the last results for next time. */
  const reset = useCallback(() => {
    window.clearTimeout(timer.current);
    controller.current?.abort();
    setState((s) => ({ ...s, status: "idle", query: "", error: null }));
  }, []);
  return { ...state, run, retry, reset };
}

// Waits before showing a loading state (most requests beat it) and, once shown,
// holds it long enough not to flicker.
function useDelayedFlag(on: boolean, delay = 150, hold = 300) {
  const [shown, setShown] = useState(false);
  const since = useRef(0);
  useEffect(() => {
    let t: number | undefined;
    if (on && !shown)
      t = window.setTimeout(() => {
        since.current = performance.now();
        setShown(true);
      }, delay);
    else if (!on && shown) t = window.setTimeout(() => setShown(false), Math.max(0, hold - (performance.now() - since.current)));
    return () => window.clearTimeout(t);
  }, [on, shown, delay, hold]);
  return shown;
}

function fold(s: string) {
  let text = "";
  const map: number[] = [];
  for (let i = 0; i < s.length; i++) {
    for (const ch of s[i].normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase()) {
      text += ch;
      map.push(i);
    }
  }
  return { text, map };
}

/** Sets the part of `text` that matches `query` in the primary color, ignoring case and accents. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = fold(query.trim()).text;
  const { text: t, map } = fold(text);
  const at = q ? t.indexOf(q) : -1;
  if (at < 0) return <>{text}</>;
  const [a, b] = [map[at], map[at + q.length - 1] + 1];
  return (
    <>
      <span className="text-fg-2">{text.slice(0, a)}</span>
      <mark className="bg-transparent font-medium text-fg">{text.slice(a, b)}</mark>
      <span className="text-fg-2">{text.slice(b)}</span>
    </>
  );
}

export type AsyncComboboxProps<T> = {
  /** Fetches results. Honor the signal so abandoned requests stop. */
  search: (query: string, options: { signal: AbortSignal }) => Promise<T[]>;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  /** Row contents. Defaults to the label with the match highlighted. */
  renderItem?: (item: T, query: string) => React.ReactNode;
  value?: T | null;
  defaultValue?: T | null;
  onValueChange?: (item: T | null) => void;
  /** Shown before anything is typed: recent picks, popular items. */
  suggestions?: T[];
  suggestionsLabel?: string;
  debounce?: number;
  minQueryLength?: number;
  label?: React.ReactNode;
  "aria-label"?: string;
  placeholder?: string;
  /** Plural noun for the empty state and errors: “No repositories match…”. */
  noun?: string;
  disabled?: boolean;
  container?: ComboboxPrimitive.Portal.Props["container"];
  className?: string;
};

export function AsyncCombobox<T>({
  search,
  getKey,
  getLabel,
  renderItem,
  value,
  defaultValue = null,
  onValueChange,
  suggestions = [],
  suggestionsLabel = "Suggested",
  debounce = 250,
  minQueryLength = 1,
  label,
  "aria-label": ariaLabel,
  placeholder = "Search…",
  noun = "results",
  disabled,
  container,
  className,
}: AsyncComboboxProps<T>) {
  const reduce = !!useReducedMotion();
  const inputId = useId();
  const [inner, setInner] = useState<T | null>(defaultValue);
  const controlled = value !== undefined;
  const selected = controlled ? value : inner;
  const [input, setInput] = useState(selected ? getLabel(selected) : "");
  const s = useAsyncSearch({ search, debounce, minQueryLength });

  const typed = s.query.length >= minQueryLength;
  const pending = s.status === "debouncing" || s.status === "loading";
  const spinning = useDelayedFlag(s.status === "loading");
  const hasResults = s.results.length > 0;
  // While a search is in flight, whatever was on screen stays there (dimmed) until the answer replaces it.
  const items = typed ? (hasResults || s.status === "success" ? s.results : suggestions) : suggestions;
  // The chosen item stays in the collection so the input can keep showing its label.

  const firstLoad = typed && pending && items.length === 0;
  const empty = typed && s.status === "success" && !hasResults;
  const failed = typed && s.status === "error";
  const stale = typed && pending && items.length > 0;
  // Only rows people can see are in the collection, so arrows never land on a hidden one.
  const visible = failed || firstLoad || empty ? [] : items;

  const status = !typed
    ? suggestions.length
      ? suggestionsLabel
      : `Type to search ${noun}`
    : failed
      ? "Search failed"
      : spinning || firstLoad
        ? `Searching for “${s.query}”`
        : s.status === "success" || hasResults
          ? s.results.length === 0
            ? "No results"
            : `${s.results.length} ${s.results.length === 1 ? "result" : "results"}`
          : suggestionsLabel;

  const choose = (item: T | null) => {
    if (!controlled) setInner(item);
    onValueChange?.(item);
    setInput(item ? getLabel(item) : "");
  };

  const { setList, y, height, opacity } = useGlide(reduce);
  const { ref: bodyRef, height: bodyHeight } = useHeight();

  return (
    <ComboboxPrimitive.Root<T>
      items={visible}
      filter={null}
      value={selected}
      onValueChange={(next) => choose(next)}
      inputValue={input}
      onInputValueChange={(next, details) => {
        setInput(next);
        // Choosing writes the label into the input; that isn't a new search.
        if (details.reason !== "item-press") s.run(next);
      }}
      onOpenChange={(open, details) => {
        if (!open && details.reason !== "item-press") {
          setInput(selected ? getLabel(selected) : "");
          s.reset();
        }
      }}
      isItemEqualToValue={(a, b) => getKey(a) === getKey(b)}
      itemToStringLabel={getLabel}
      itemToStringValue={getKey}
      disabled={disabled}
    >
      <div className={cn("flex w-full min-w-0 flex-col gap-1.5", className)}>
        {label && (
          <label htmlFor={inputId} className="w-fit cursor-default text-[12.5px] font-medium text-fg-2 select-none">
            {label}
          </label>
        )}
        <ComboboxPrimitive.InputGroup
          className={cn(
            "group/field relative flex h-8 w-full items-center rounded-lg border border-line-2 bg-raised shadow-[var(--shadow)]",
            "transition-[border-color,box-shadow] duration-150 ease-out hover:border-fg-4",
            "focus-within:border-fg-4 focus-within:ring-3 focus-within:ring-fg/8",
            "data-disabled:pointer-events-none data-disabled:opacity-50",
          )}
        >
          <span className="pointer-events-none grid w-8 shrink-0 place-items-center text-fg-3">
            <span className="relative grid size-4 place-items-center">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span key={spinning ? "busy" : "idle"} {...swapIn(reduce)} className="grid place-items-center">
                  {spinning ? <Loader size={14} className="animate-spin" /> : <Search size={14} />}
                </motion.span>
              </AnimatePresence>
            </span>
          </span>
          <ComboboxPrimitive.Input
            id={inputId}
            placeholder={placeholder}
            aria-label={label ? undefined : ariaLabel}
            aria-busy={pending || undefined}
            onKeyDown={(e) => {
              // With nothing highlighted, Enter retries a failed search.
              if (e.key === "Enter" && failed) {
                e.preventDefault();
                e.preventBaseUIHandler();
                s.retry();
              }
            }}
            className="h-full min-w-0 flex-1 bg-transparent pr-16 text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]"
          />
          <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
            <AnimatePresence initial={false}>
              {(input || selected) && (
                <motion.button
                  key="clear"
                  type="button"
                  aria-label="Clear"
                  {...swapIn(reduce)}
                  onClick={() => {
                    choose(null);
                    s.run("", 0);
                  }}
                  className={cn(
                    "relative grid size-6 place-items-center rounded-md text-fg-3 hover:bg-hover hover:text-fg",
                    "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
                    "transition-[background-color,color] duration-150 active:scale-[0.9] after:absolute after:-inset-2 after:content-['']",
                  )}
                >
                  <X size={14} />
                </motion.button>
              )}
            </AnimatePresence>
            <ComboboxPrimitive.Trigger
              aria-label="Show results"
              className={cn(
                "grid size-6 place-items-center rounded-md text-fg-3 hover:bg-hover hover:text-fg-2 data-popup-open:text-fg-2",
                "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
                "transition-[background-color,color,scale] duration-150 active:scale-[0.9]",
              )}
            >
              <ChevronsUpDown size={16} />
            </ComboboxPrimitive.Trigger>
          </div>
        </ComboboxPrimitive.InputGroup>
      </div>

      <ComboboxPrimitive.Portal container={container}>
        <ComboboxPrimitive.Positioner align="start" sideOffset={6} collisionPadding={8} className="z-(--z-popover) outline-none">
          <ComboboxPrimitive.Popup
            aria-busy={pending || undefined}
            className={cn(
              "w-(--anchor-width) max-w-(--available-width) sm:min-w-72 origin-(--transform-origin) overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
              "transition-[opacity,scale] duration-160 ease-out-expo data-ending-style:duration-100 data-ending-style:ease-out",
              "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0",
              "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
            )}
          >
            {/* A fixed-height status line: counts, searching and failures change here without moving the rows. */}
            <ComboboxPrimitive.Status className="flex h-8 items-center border-b border-line px-3 font-mono text-2xs text-fg-3">
              <span className="min-w-0 truncate tabular">{status}</span>
            </ComboboxPrimitive.Status>

            {/* The body eases to each new height instead of snapping, so results arriving never jolt the popup. */}
            <motion.div
              initial={false}
              animate={{ height: bodyHeight ?? "auto" }}
              transition={reduce ? { duration: 0 } : { duration: 0.22, ease: ease.inOut }}
              className="overflow-hidden"
            >
              <div ref={bodyRef}>
                {firstLoad && <Skeleton show={spinning} />}
                {failed && (
                  <div role="alert" className="flex items-center gap-3 px-3 py-3">
                    <Alert size={16} className="shrink-0 text-danger" />
                    <p className="min-w-0 flex-1 text-[12.5px] text-fg-2">
                      Couldn’t load {noun}. <span className="text-fg-3">Check your connection.</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => s.retry()}
                      className={cn(
                        "flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-line-2 bg-frame px-2 text-[12px] font-medium text-fg hover:bg-hover",
                        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                        "transition-[background-color,scale] duration-150 active:scale-[0.96]",
                      )}
                    >
                      <Refresh size={14} />
                      Try again
                    </button>
                  </div>
                )}
                {empty && (
                  <p className="truncate px-3 py-5 text-center text-[12.5px] text-fg-3">
                    No {noun} match <span className="text-fg-2">“{s.query}”</span>
                  </p>
                )}
                {!typed && !suggestions.length && <p className="px-3 py-5 text-center text-[12.5px] text-fg-3">Start typing to search.</p>}
                <ComboboxPrimitive.List
                  ref={setList}
                  className={cn(
                    "relative max-h-[min(calc(var(--available-height)-3rem),18rem)] scroll-py-1 overflow-y-auto overscroll-contain p-1 outline-none empty:hidden",
                    "transition-opacity duration-200",
                    (failed || firstLoad || empty) && "hidden",
                    stale && "opacity-60",
                  )}
                >
                  <motion.div aria-hidden style={{ y, height, opacity }} className="pointer-events-none absolute inset-x-1 top-0 rounded-lg bg-line" />
                  <ComboboxPrimitive.Collection>
                    {(item: T) => (
                      <ComboboxPrimitive.Item key={getKey(item)} value={item} className={itemClass}>
                        <span className="flex min-w-0 flex-1 items-center gap-2">{renderItem ? renderItem(item, s.query) : <span className="truncate"><Highlight text={getLabel(item)} query={s.query} /></span>}</span>
                        <span className="grid size-4 shrink-0 place-items-center">
                          <ComboboxPrimitive.ItemIndicator>
                            <Check size={14} />
                          </ComboboxPrimitive.ItemIndicator>
                        </span>
                      </ComboboxPrimitive.Item>
                    )}
                  </ComboboxPrimitive.Collection>
                </ComboboxPrimitive.List>
              </div>
            </motion.div>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}

const itemClass = cn(
  "group/item relative z-[1] flex min-h-8 cursor-default scroll-my-1 items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-fg outline-none select-none pointer-coarse:min-h-10",
  "data-disabled:text-fg-4",
);

// Rows shaped like results, held back until the request has taken longer than a blink.
function Skeleton({ show }: { show: boolean }) {
  return (
    <div aria-hidden className={cn("flex flex-col gap-1 p-1 transition-opacity duration-200", show ? "opacity-100" : "opacity-0")}>
      {[62, 48, 70].map((w) => (
        <div key={w} className="flex h-11 flex-col justify-center gap-1.5 px-2">
          <div className="h-2.5 rounded-full bg-line-2 animate-pulse-soft" style={{ width: `${w}%` }} />
          <div className="h-2 rounded-full bg-line animate-pulse-soft" style={{ width: `${w - 22}%` }} />
        </div>
      ))}
    </div>
  );
}

const swapIn = (reduce: boolean) => ({
  initial: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" },
  transition: reduce ? { duration: 0.12 } : spring.pop,
});

// Tracks an element's height so its wrapper can animate between sizes.
function useHeight() {
  const [el, ref] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height));
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return { ref, height };
}

// One highlight for the list: glides after the pointer, jumps for arrow keys and new results.
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
      let top = 0;
      for (let n: HTMLElement | null = el; n && n !== list; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
      if (!shown || keyboard || reduce) {
        y.jump(top);
        height.jump(el.offsetHeight);
      } else {
        running.push(animate(y, top, spring.follow), animate(height, el.offsetHeight, spring.follow));
      }
      opacity.jump(1);
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
