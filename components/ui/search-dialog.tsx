"use client";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { Dialog } from "@base-ui/react/dialog";
import { Tabs } from "@base-ui/react/tabs";
import NumberFlow from "@number-flow/react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Clock, Loader, Search, Warning, X } from "@/lib/icons";
import { useControllableState } from "@/lib/use-controllable-state";
import { Kbd } from "@/components/ui/kbd";
import { CopyButton } from "@/components/ui/copy-button";
import {
  CommandHighlight,
  PaletteFooter,
  paletteClasses,
  scoreCommand,
  useDelayedFlag,
  useListGlide,
  usePaletteHotkey,
} from "@/components/ui/command-palette";

export type SearchResult = {
  id: string;
  title: string;
  /** Which filter it belongs to: a SearchFilter value. */
  kind: string;
  /** Where it lives: "Docs › Billing", an email, a project. */
  subtitle?: string;
  icon?: React.ReactNode;
  /** Body text for the preview. Every word of the query is marked in it. */
  excerpt?: string;
  /** Label and value rows under the excerpt in the preview. */
  meta?: [label: string, value: React.ReactNode][];
  /** Enables Copy link in the preview. */
  href?: string;
};

export type SearchFilter = { value: string; label: string };

export type SearchDialogProps = {
  /** Called (debounced) as the query changes. Honor the signal: a newer query aborts the older request. */
  search: (query: string, options: { signal: AbortSignal }) => Promise<SearchResult[]>;
  /** Filter tabs after All. Each result's kind picks its tab and its group. */
  filters?: SearchFilter[];
  allLabel?: string;
  onSelect?: (result: SearchResult, query: string) => void;
  /** Replace the default preview. Receives the highlighted result and the query it matched. */
  renderPreview?: (result: SearchResult, query: string) => React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Recent queries, newest first. Shown while the field is empty. */
  recent?: string[];
  defaultRecent?: string[];
  onRecentChange?: (queries: string[]) => void;
  /** Milliseconds of quiet typing before a search runs. */
  debounce?: number;
  hotkey?: string | false;
  hotkeyTarget?: React.RefObject<HTMLElement | null>;
  placeholder?: string;
  container?: Dialog.Portal.Props["container"];
  label?: string;
  className?: string;
  children?: React.ReactNode;
};

type Entry = { key: string; type: "recent"; query: string } | { key: string; type: "result"; result: SearchResult };
type Section = { value: string; items: Entry[] };

// Every occurrence of every word of the query, for marking up an excerpt.
function marks(text: string, query: string): [number, number][] {
  const lower = text.toLocaleLowerCase();
  const out: [number, number][] = [];
  for (const token of query.toLocaleLowerCase().split(/\s+/).filter((t) => t.length > 1)) {
    for (let i = lower.indexOf(token); i >= 0; i = lower.indexOf(token, i + token.length)) out.push([i, i + token.length]);
  }
  out.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return merged;
}

function Marked({ text, query }: { text: string; query: string }) {
  const ranges = marks(text, query);
  if (!ranges.length) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach(([s, e], i) => {
    if (s > at) parts.push(text.slice(at, s));
    parts.push(
      <mark key={i} className="rounded-[2px] bg-fg/[0.12] text-fg">
        {text.slice(s, e)}
      </mark>,
    );
    at = e;
  });
  parts.push(text.slice(at));
  return <>{parts}</>;
}

/**
 * The request lifecycle on its own: debounces the query, aborts the one before,
 * keeps the last results on screen while the next arrive, and reports failure.
 */
export function useSearch(search: SearchDialogProps["search"], query: string, debounce = 150) {
  const [state, setState] = useState<{ results: SearchResult[] | null; for: string; loading: boolean; error: string | null }>({
    results: null,
    for: "",
    loading: false,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  const run = useRef(search);
  useEffect(() => {
    run.current = search;
  });
  const q = query.trim();
  // A changed query marks the current results as refreshing in the same render, so nothing flickers "done" in between.
  const [seen, setSeen] = useState({ q, attempt });
  if (seen.q !== q || seen.attempt !== attempt) {
    setSeen({ q, attempt });
    setState((s) => (q ? { ...s, loading: true, error: null } : { results: null, for: "", loading: false, error: null }));
  }

  useEffect(() => {
    if (!q) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      run
        .current(q, { signal: controller.signal })
        .then((results) => {
          if (!controller.signal.aborted) setState({ results, for: q, loading: false, error: null });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const message = error instanceof Error && error.message ? error.message : "Couldn’t search. Try again.";
          setState((s) => ({ ...s, loading: false, error: message }));
        });
    }, debounce);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q, debounce, attempt]);

  return { ...state, retry: () => setAttempt((a) => a + 1) };
}

export function SearchDialog({
  search,
  filters = [],
  allLabel = "All",
  onSelect,
  renderPreview,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  recent: recentProp,
  defaultRecent = [],
  onRecentChange,
  debounce = 150,
  hotkey = "/",
  hotkeyTarget,
  placeholder = "Search…",
  container,
  label = "Search",
  className,
  children,
}: SearchDialogProps) {
  const reduce = !!useReducedMotion();
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const [recent, setRecent] = useControllableState({ value: recentProp, defaultValue: defaultRecent, onChange: onRecentChange });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [instant, setInstant] = useState(false);
  const [highlighted, setHighlighted] = useState<{ key: string; byKeyboard: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contained = container != null;

  const { results, for: resultQuery, loading, error, retry } = useSearch(search, query, debounce);
  const q = query.trim();
  const skeleton = useDelayedFlag(loading && results === null && !error);
  const refreshing = useDelayedFlag(loading && results !== null);
  const { setList: setGlideList, y: glideY, height: glideH, opacity: glideO } = useListGlide(reduce);

  const tabs = useMemo(() => [{ value: "all", label: allLabel }, ...filters], [filters, allLabel]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: results?.length ?? 0 };
    for (const r of results ?? []) c[r.kind] = (c[r.kind] ?? 0) + 1;
    return c;
  }, [results]);

  const sections = useMemo<Section[]>(() => {
    if (!q) return recent.length ? [{ value: "Recent searches", items: recent.map((r) => ({ key: `recent:${r}`, type: "recent" as const, query: r })) }] : [];
    if (!results) return [];
    const shown = filter === "all" ? results : results.filter((r) => r.kind === filter);
    if (filter !== "all") return shown.length ? [{ value: "", items: shown.map((result) => ({ key: result.id, type: "result" as const, result })) }] : [];
    // In All, results group by kind in the order of the filters.
    const order = filters.map((f) => f.value);
    const kinds = [...new Set(shown.map((r) => r.kind))].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
    return kinds.map((k) => ({
      value: filters.find((f) => f.value === k)?.label ?? k,
      items: shown.filter((r) => r.kind === k).map((result) => ({ key: result.id, type: "result" as const, result })),
    }));
  }, [q, recent, results, filter, filters]);

  const entries = sections.flatMap((s) => s.items);
  const current = entries.find((e) => e.key === highlighted?.key) ?? entries[0];
  const preview = current?.type === "result" ? current.result : null;
  const otherFilter = filter !== "all" && results?.length ? filters.find((f) => (counts[f.value] ?? 0) > 0 && f.value !== filter) : undefined;

  // Results arrive after the keystroke that asked for them, so the list's own first-row highlight has
  // already passed. Put it on the first row, as a real arrow key would, whenever a new set lands.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      const input = inputRef.current;
      if (!list || !input || list.querySelector("[data-highlighted]") || !list.querySelector("[role=option]")) return;
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", bubbles: true, cancelable: true }));
    });
    return () => cancelAnimationFrame(frame);
  }, [open, results, filter, recent.length]);

  const close = (fromKeyboard: boolean) => {
    setInstant(fromKeyboard);
    setOpen(false);
  };

  const remember = (text: string) => setRecent((r) => [text, ...r.filter((x) => x !== text)].slice(0, 6));
  const forget = (text: string) => setRecent((r) => r.filter((x) => x !== text));

  const choose = (entry: Entry, fromKeyboard: boolean) => {
    if (entry.type === "recent") {
      setQuery(entry.query);
      inputRef.current?.focus();
      return;
    }
    remember(resultQuery || q);
    onSelect?.(entry.result, resultQuery || q);
    close(fromKeyboard);
  };

  usePaletteHotkey({
    hotkey,
    target: hotkeyTarget,
    open,
    onToggle: () => {
      setInstant(true);
      setOpen(!open);
    },
  });

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // ⇧⌫ forgets the highlighted recent search.
    if (e.shiftKey && (e.key === "Backspace" || e.key === "Delete") && current?.type === "recent") {
      e.preventDefault();
      forget(current.query);
    }
  };

  const emptyState = q && !loading && !error && results && entries.length === 0;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next, details) => {
        const ev = details.event as Event | undefined;
        setInstant(ev instanceof KeyboardEvent || (ev instanceof MouseEvent && ev.detail === 0));
        setOpen(next);
      }}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) return;
        setQuery("");
        setFilter("all");
        setHighlighted(null);
      }}
    >
      {children}
      <Dialog.Portal container={container}>
        <Dialog.Backdrop data-instant={instant ? "" : undefined} className={cn(contained ? "absolute" : "fixed", paletteClasses.backdrop)} />
        <Dialog.Viewport className={cn(contained ? "absolute pt-6" : "fixed pt-[10vh]", paletteClasses.viewport, "pb-4")}>
          <Dialog.Popup
            initialFocus={inputRef}
            data-instant={instant ? "" : undefined}
            className={cn(paletteClasses.popup, "@container max-w-[720px]", contained ? "h-full max-h-[520px]" : "h-[min(520px,80dvh)]", className)}
          >
            <Dialog.Title className="sr-only">{label}</Dialog.Title>
            <Autocomplete.Root
              inline
              open
              items={sections}
              filteredItems={sections}
              value={query}
              onValueChange={(next, details) => {
                if (details.reason === "item-press") return;
                setQuery(next);
              }}
              onOpenChange={(next, details) => {
                if (!next && details.reason === "escape-key") close(true);
              }}
              onItemHighlighted={(value: Entry | undefined, details) => setHighlighted(value ? { key: value.key, byKeyboard: details.reason !== "pointer" } : null)}
              itemToStringValue={(entry: Entry) => (entry.type === "recent" ? entry.query : entry.result.title)}
              autoHighlight="always"
              keepHighlight
            >
              <div className="flex h-12 shrink-0 items-center gap-2.5 pr-2.5 pl-4 pointer-coarse:h-14">
                <span className="relative grid size-4 shrink-0 place-items-center text-fg-3">
                  <Search size={16} className={cn("transition-[opacity,scale] duration-150", refreshing && "scale-75 opacity-0")} />
                  <Loader size={16} className={cn("absolute animate-spin transition-[opacity,scale] duration-150", !refreshing && "scale-75 opacity-0")} />
                </span>
                <Autocomplete.Input
                  ref={inputRef}
                  placeholder={placeholder}
                  aria-label={placeholder.replace(/…$/, "")}
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="search"
                  type="search"
                  onKeyDown={onInputKeyDown}
                  className={paletteClasses.input}
                />
                <Dialog.Close
                  aria-label="Close"
                  className={cn(
                    "relative grid shrink-0 place-items-center rounded-md outline-none",
                    "transition-[scale,opacity] duration-150 hover:opacity-80 active:scale-[0.94]",
                    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                    "after:absolute after:-inset-3 after:content-[''] pointer-fine:after:hidden",
                  )}
                >
                  <Kbd keys="esc" size="sm" />
                </Dialog.Close>
              </div>

              <Tabs.Root value={filter} onValueChange={(v) => setFilter(String(v))} className="flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 overflow-x-auto border-b border-line px-2.5 [scrollbar-width:none]">
                  <Tabs.List
                    aria-label="Filter results"
                    activateOnFocus
                    // Typing while a filter has focus goes back to the field, keystroke included.
                    onKeyDown={(e) => {
                      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey && e.key !== " ") inputRef.current?.focus();
                    }}
                    className="relative flex h-10 w-max items-center gap-0.5"
                  >
                    <Tabs.Indicator className="absolute top-1/2 left-0 h-7 w-(--active-tab-width) -translate-y-1/2 translate-x-(--active-tab-left) rounded-md bg-fg/[0.07] transition-[translate,width] duration-[220ms] ease-in-out-quart motion-reduce:transition-none" />
                    {tabs.map((t) => (
                      <Tabs.Tab
                        key={t.value}
                        value={t.value}
                        className={cn(
                          "relative z-[1] flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium text-fg-3 outline-none select-none",
                          "transition-[color,scale] duration-150 hover:text-fg-2 active:scale-[0.97] data-active:text-fg",
                          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
                        )}
                      >
                        {t.label}
                        {q && results && (
                          <span className={cn("font-mono text-[11px] tabular transition-colors", counts[t.value] ? "text-fg-3" : "text-fg-4")}>
                            <NumberFlow value={counts[t.value] ?? 0} animated={!reduce} />
                          </span>
                        )}
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                </div>

                <Tabs.Panel value={filter} className="flex min-h-0 flex-1 outline-none">
                  <div className="relative min-w-0 flex-1 overflow-y-auto overscroll-contain @[600px]:max-w-[55%]" aria-busy={loading || undefined}>
                    {error && results && (
                      <div className="flex items-center gap-2 border-b border-line bg-danger-soft px-4 py-2 text-[12px] text-danger">
                        <Warning size={14} className="shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{error} Showing earlier results.</span>
                        <RetryButton onClick={retry} />
                      </div>
                    )}
                    <div className="p-1.5">
                      {skeleton && <SkeletonRows />}
                      {!skeleton && error && !results && (
                        <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                          <p className="text-[13px] text-fg-2">{error}</p>
                          <RetryButton onClick={retry} />
                        </div>
                      )}
                      {emptyState && (
                        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                          <p className="max-w-full truncate text-[13px] text-fg-2">
                            No {filter === "all" ? "results" : (filters.find((f) => f.value === filter)?.label.toLowerCase() ?? "results")} for{" "}
                            <span className="text-fg">“{resultQuery}”</span>
                          </p>
                          {otherFilter ? (
                            <SmallButton onClick={() => setFilter(otherFilter.value)}>
                              See {counts[otherFilter.value]} in {otherFilter.label}
                            </SmallButton>
                          ) : (
                            <SmallButton
                              onClick={() => {
                                setQuery("");
                                inputRef.current?.focus();
                              }}
                            >
                              Clear search
                            </SmallButton>
                          )}
                        </div>
                      )}
                      {!q && !recent.length && <p className="px-3 py-12 text-center text-[13px] text-fg-3">Search across everything in this workspace</p>}
                      <div
                        ref={(node) => {
                          listRef.current = node;
                          setGlideList(node);
                        }}
                        className={cn("group/list relative", skeleton && "hidden")}
                      >
                        <motion.div aria-hidden style={{ y: glideY, height: glideH, opacity: glideO }} className={paletteClasses.glide} />
                        <Autocomplete.List className={cn("outline-none empty:hidden transition-opacity duration-150", loading && results && "opacity-60")}>
                          {(section: Section) => (
                            <Autocomplete.Group key={section.value || "results"} items={section.items}>
                              {section.value && <Autocomplete.GroupLabel className={cn(paletteClasses.groupLabel, "first:pt-1.5")}>{section.value}</Autocomplete.GroupLabel>}
                              <Autocomplete.Collection>
                                {(entry: Entry) =>
                                  entry.type === "recent" ? (
                                    <Autocomplete.Item key={entry.key} value={entry} onClick={(e) => choose(entry, e.detail === 0)} className={paletteClasses.item}>
                                      <Clock size={16} className="shrink-0 text-fg-3" />
                                      <span className="min-w-0 flex-1 truncate">{entry.query}</span>
                                      <button
                                        type="button"
                                        tabIndex={-1}
                                        aria-label={`Remove “${entry.query}” from recent searches`}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          forget(entry.query);
                                          inputRef.current?.focus();
                                        }}
                                        className={cn(
                                          "relative -mr-1 grid size-6 shrink-0 place-items-center rounded-md text-fg-4 opacity-0 transition-[opacity,color,background-color,scale]",
                                          "group-data-highlighted/item:opacity-100 pointer-coarse:opacity-100 hover:bg-fg/[0.06] hover:text-fg-2 active:scale-[0.9]",
                                          "after:absolute after:-inset-2 after:content-['']",
                                        )}
                                      >
                                        <X size={12} />
                                      </button>
                                    </Autocomplete.Item>
                                  ) : (
                                    <Autocomplete.Item
                                      key={entry.key}
                                      value={entry}
                                      onClick={(e) => choose(entry, e.detail === 0)}
                                      className={cn(paletteClasses.item, "h-12 pointer-coarse:h-14")}
                                    >
                                      {entry.result.icon && (
                                        <span className="flex size-4 shrink-0 text-fg-3 transition-colors group-data-highlighted/item:text-fg-2 [&_svg]:size-4">{entry.result.icon}</span>
                                      )}
                                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span className="truncate">
                                          <CommandHighlight text={entry.result.title} ranges={scoreCommand({ id: entry.key, label: entry.result.title }, resultQuery)?.ranges ?? []} />
                                        </span>
                                        {entry.result.subtitle && <span className="truncate text-[12px] text-fg-3">{entry.result.subtitle}</span>}
                                      </span>
                                    </Autocomplete.Item>
                                  )
                                }
                              </Autocomplete.Collection>
                            </Autocomplete.Group>
                          )}
                        </Autocomplete.List>
                      </div>
                    </div>
                  </div>

                  <aside aria-label="Preview" className="hidden min-w-0 flex-1 border-l border-line bg-fg/[0.015] @[600px]:flex">
                    {preview ? (
                      <motion.div
                        key={preview.id}
                        // Arrow keys swap the preview on the same frame; the pointer gets a short fade so a sweep across rows doesn't strobe.
                        initial={highlighted?.byKeyboard === false && !reduce ? { opacity: 0 } : false}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.14, ease: "easeOut" }}
                        className="flex min-w-0 flex-1 flex-col"
                      >
                        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-5 [&>*]:shrink-0">
                          {renderPreview ? renderPreview(preview, resultQuery) : <DefaultPreview result={preview} query={resultQuery} />}
                        </div>
                        {!renderPreview && (
                          // Actions stay put at the bottom however long the preview runs.
                          <div className="flex shrink-0 items-center gap-2 border-t border-line px-5 py-3">
                            <button
                              type="button"
                              onClick={() => choose({ key: preview.id, type: "result", result: preview }, false)}
                              className={cn(
                                "inline-flex h-7 items-center gap-1.5 rounded-md bg-fg px-2.5 text-[12px] font-medium text-frame",
                                "transition-[background-color,scale] duration-150 hover:bg-fg/90 active:scale-[0.97]",
                                "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                              )}
                            >
                              Open
                              <Kbd keys="enter" variant="ghost" size="sm" className="[&_kbd]:text-frame/60" />
                            </button>
                            {preview.href && <CopyButton value={preview.href} size="sm" label="Copy link" copiedLabel="Copied" />}
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <div className="grid flex-1 place-items-center px-6 text-center text-[12.5px] text-fg-4">{skeleton || error ? "" : q ? "Nothing to preview" : "Results show a preview here"}</div>
                    )}
                  </aside>
                </Tabs.Panel>
              </Tabs.Root>

              <PaletteFooter
                hints={
                  current?.type === "recent"
                    ? [
                        ["enter", "Search again"],
                        ["shift+backspace", "Remove"],
                      ]
                    : [
                        [["up", "down"], "Navigate"],
                        ["enter", "Open"],
                        ["tab", "Filters"],
                      ]
                }
              />
              <Autocomplete.Status className="sr-only">
                {!q ? "" : loading ? "Searching…" : error ? error : `${entries.length} ${entries.length === 1 ? "result" : "results"}`}
              </Autocomplete.Status>
            </Autocomplete.Root>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DefaultPreview({ result, query }: { result: SearchResult; query: string }) {
  return (
    <>
      <div className="flex min-w-0 items-center gap-2 text-[12px] text-fg-3">
        {result.icon && <span className="flex shrink-0 [&_svg]:size-3.5">{result.icon}</span>}
        <span className="truncate">{result.subtitle}</span>
      </div>
      <h3 className="text-[15px] leading-[1.3] font-medium tracking-[-0.015em] text-fg text-balance">
        <Marked text={result.title} query={query} />
      </h3>
      {result.excerpt && (
        <p className="line-clamp-5 text-[12.5px] leading-[1.55] text-fg-2 text-pretty">
          <Marked text={result.excerpt} query={query} />
        </p>
      )}
      {result.meta && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[12px]">
          {result.meta.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-fg-3">{k}</dt>
              <dd className="min-w-0 truncate text-fg-2">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

function SkeletonRows() {
  return (
    <div aria-hidden className="flex flex-col">
      {[62, 48, 71, 55].map((w, i) => (
        <div key={i} className="flex h-12 items-center gap-2.5 px-2.5">
          <span className="size-4 shrink-0 rounded-[4px] bg-fg/[0.07] animate-pulse-soft" />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="h-2.5 rounded-full bg-fg/[0.08] animate-pulse-soft" style={{ width: `${w}%` }} />
            <span className="h-2 rounded-full bg-fg/[0.05] animate-pulse-soft" style={{ width: `${w - 22}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

function SmallButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)]",
        "transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97]",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
      )}
    >
      {children}
    </button>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return <SmallButton onClick={onClick}>Try again</SmallButton>;
}
