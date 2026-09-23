"use client";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { Dialog } from "@base-ui/react/dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ChevronRight, Loader, Search } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";
import { Kbd, matchShortcut, usePlatform } from "@/components/ui/kbd";
import {
  CommandRow,
  PaletteFooter,
  messageOf,
  paletteClasses,
  useCommandSearch,
  useDelayedFlag,
  useListGlide,
  useMeasuredHeight,
  usePaletteHotkey,
  type CommandEntry,
  type CommandGroup,
  type CommandItem,
  type CommandSection,
} from "@/components/ui/command-palette";

export type CommandPagesItem = CommandItem & {
  /** Opens this page instead of running. Write the label with an ellipsis ("Change theme…"). */
  to?: string;
  /** Marks the current choice among options, drawn as a check. */
  checked?: boolean;
};

export type CommandPage = {
  /** Shown in the breadcrumb chip and as the heading when its items turn up in a search from the root. */
  title: string;
  placeholder?: string;
  groups: { heading: string; items: CommandPagesItem[] }[];
};

export type CommandPagesProps = {
  /** Every page by id. The first page shown is `root`. */
  pages: Record<string, CommandPage>;
  root?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Called with the page stack, root first, whenever it changes. */
  onPageChange?: (stack: string[]) => void;
  hotkey?: string | false;
  hotkeyTarget?: React.RefObject<HTMLElement | null>;
  /** Called with every item that runs. */
  onSelect?: (item: CommandPagesItem) => void;
  container?: Dialog.Portal.Props["container"];
  label?: string;
  footer?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
};

type Level = { id: string; query: string; scroll: number };
type Failure = { key: string; message: string };

export function CommandPages({
  pages,
  root = "root",
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  onPageChange,
  hotkey = "mod+k",
  hotkeyTarget,
  onSelect,
  container,
  label = "Command palette",
  footer,
  className,
  children,
}: CommandPagesProps) {
  const reduce = !!useReducedMotion();
  const platform = usePlatform();
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  // Each level remembers what was typed and how far it was scrolled, so going back lands where you left.
  const [stack, setStack] = useState<Level[]>([{ id: root, query: "", scroll: 0 }]);
  const [instant, setInstant] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const contained = container != null;

  const level = stack[stack.length - 1];
  const page = pages[level.id] ?? pages[root];
  const query = level.query;
  const atRoot = stack.length === 1;

  // From the root, a search also reaches into every page ("dark" finds Theme › Dark).
  const groups = useMemo<CommandGroup[]>(() => {
    const own = page.groups;
    if (!atRoot || !query.trim()) return own;
    const deep = Object.entries(pages)
      .filter(([id]) => id !== root)
      .map(([id, p]) => ({
        heading: p.title,
        items: p.groups.flatMap((g) => g.items).map((i) => ({ ...i, id: `${id}/${i.id}` })),
      }));
    return [...own, ...deep];
  }, [page, pages, root, atRoot, query]);

  const sections = useCommandSearch(groups, query);
  const count = sections.reduce((n, s) => n + s.items.length, 0);
  const spinning = useDelayedFlag(busy !== null);
  const { setList: setGlideList, y: glideY, height: glideH, opacity: glideO } = useListGlide(reduce);
  const [measure, contentHeight] = useMeasuredHeight();

  const commit = (next: Level[]) => {
    setStack(next);
    onPageChange?.(next.map((l) => l.id));
  };

  // The page you leave is photographed and slid out; the live list slides in from the other side.
  const ghost = (dir: 1 | -1) => {
    const live = pageRef.current;
    const host = ghostRef.current;
    if (reduce || !live || !host || typeof live.animate !== "function") return;
    const clone = live.cloneNode(true) as HTMLElement;
    clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    clone.setAttribute("aria-hidden", "true");
    clone.setAttribute("inert", "");
    clone.style.cssText = `position:absolute;left:0;right:0;top:${-(scrollRef.current?.scrollTop ?? 0)}px;pointer-events:none`;
    host.replaceChildren(clone);
    clone
      .animate([{ transform: "translateX(0)", opacity: 1 }, { transform: `translateX(${-dir * 16}px)`, opacity: 0 }], {
        duration: 120,
        easing: `cubic-bezier(${ease.in.join(",")})`,
        fill: "forwards",
      })
      .finished.then(() => clone.remove(), () => clone.remove());
  };

  // Which row to land on after a page change: the current choice going in, the row you came from going back.
  const landing = useRef<((e: CommandEntry) => boolean) | null>(null);

  const push = (to: string) => {
    if (!pages[to]) return;
    landing.current = (e) => (e.item as CommandPagesItem).checked === true;
    ghost(1);
    setDirection(1);
    setFailure(null);
    const saved = { ...level, scroll: scrollRef.current?.scrollTop ?? 0 };
    commit([...stack.slice(0, -1), saved, { id: to, query: "", scroll: 0 }]);
  };

  const popTo = (depth: number) => {
    if (depth >= stack.length - 1 || depth < 0) return;
    const from = stack[depth + 1].id;
    landing.current = (e) => (e.item as CommandPagesItem).to === from;
    ghost(-1);
    setDirection(-1);
    setFailure(null);
    commit(stack.slice(0, depth + 1));
  };

  // After a page change: restore its scroll and slide the new list in.
  const depth = stack.length;
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = scrollRef.current;
    if (el) el.scrollTop = stack[stack.length - 1].scroll;
    const input = inputRef.current;
    input?.focus();
    // Step the highlight to the landing row (or the first) as if by arrow key, so it is announced too.
    // The list keeps its previous index across pages, so walk from wherever it is now.
    const found = landing.current ? sections.flatMap((sec) => sec.items).findIndex(landing.current) : -1;
    const target = Math.max(0, found);
    landing.current = null;
    const frame = requestAnimationFrame(() => {
      const options = [...(pageRef.current?.querySelectorAll<HTMLElement>("[role=option]") ?? [])];
      const current = options.findIndex((o) => o.hasAttribute("data-highlighted"));
      if (!input || current < 0 || current === target) return;
      const key = target > current ? "ArrowDown" : "ArrowUp";
      for (let i = 0; i < Math.abs(target - current); i++) input.dispatchEvent(new KeyboardEvent("keydown", { key, code: key, bubbles: true, cancelable: true }));
    });
    const live = pageRef.current;
    if (reduce || !live || typeof live.animate !== "function") return () => cancelAnimationFrame(frame);
    live.animate([{ transform: `translateX(${direction * 16}px)`, opacity: 0 }, { transform: "translateX(0)", opacity: 1 }], {
      duration: 200,
      easing: `cubic-bezier(${ease.out.join(",")})`,
    });
    return () => cancelAnimationFrame(frame);
    // Only a change of page should slide; typing never does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depth, level.id]);

  const setQuery = (q: string) => setStack((s) => [...s.slice(0, -1), { ...s[s.length - 1], query: q }]);

  const close = (fromKeyboard: boolean) => {
    setInstant(fromKeyboard);
    setOpen(false);
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

  const run = async (entry: CommandEntry, fromKeyboard: boolean) => {
    const item = entry.item as CommandPagesItem;
    if (item.disabled || busy) return;
    if (item.to) return push(item.to);
    setFailure(null);
    let result: void | Promise<unknown>;
    try {
      result = item.onSelect?.();
    } catch (error) {
      return setFailure({ key: entry.key, message: messageOf(error) });
    }
    if (result && typeof (result as Promise<unknown>).then === "function") {
      setBusy(entry.key);
      try {
        await result;
      } catch (error) {
        setBusy(null);
        return setFailure({ key: entry.key, message: messageOf(error) });
      }
      setBusy(null);
    }
    onSelect?.(item);
    if (item.keepOpen) return;
    // A choice made with the pointer holds for a beat so the check can land on it; the keyboard never waits.
    if (!fromKeyboard && item.checked !== undefined && !reduce) window.setTimeout(() => close(false), 260);
    else close(fromKeyboard);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !e.currentTarget.value && !atRoot && e.currentTarget.selectionStart === 0) {
      e.preventDefault();
      popTo(stack.length - 2);
    }
  };

  const onPopupKeyDown = (e: React.KeyboardEvent) => {
    const native = e.nativeEvent;
    if (!native.metaKey && !native.ctrlKey && !native.altKey) return;
    for (const g of page.groups)
      for (const item of g.items)
        if (item.shortcut && !item.disabled && matchShortcut(native, item.shortcut, platform)) {
          e.preventDefault();
          e.stopPropagation();
          void run({ key: item.id, item, ranges: [], score: 0 }, true);
          return;
        }
  };

  const trail = stack.slice(1);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next, details) => {
        const ev = details.event as Event | undefined;
        // Escape on a nested page goes back one page instead of closing.
        if (!next && details.reason === "escape-key" && !atRoot) {
          details.cancel();
          popTo(stack.length - 2);
          return;
        }
        setInstant(ev instanceof KeyboardEvent || (ev instanceof MouseEvent && ev.detail === 0));
        setOpen(next);
      }}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) return;
        first.current = true;
        setStack([{ id: root, query: "", scroll: 0 }]);
        setFailure(null);
        setBusy(null);
      }}
    >
      {children}
      <Dialog.Portal container={container}>
        <Dialog.Backdrop data-instant={instant ? "" : undefined} className={cn(contained ? "absolute" : "fixed", paletteClasses.backdrop)} />
        <Dialog.Viewport className={cn(contained ? "absolute pt-14" : "fixed pt-[12vh]", paletteClasses.viewport)}>
          <Dialog.Popup
            initialFocus={inputRef}
            data-instant={instant ? "" : undefined}
            data-depth={stack.length}
            onKeyDown={onPopupKeyDown}
            className={cn(paletteClasses.popup, className)}
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
                setFailure(null);
              }}
              onOpenChange={(next, details) => {
                if (next || details.reason !== "escape-key") return;
                if (atRoot) close(true);
                else popTo(stack.length - 2);
              }}
              itemToStringValue={(entry: CommandEntry) => entry.item.label}
              autoHighlight="always"
              keepHighlight
            >
              <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line pr-2.5 pl-4 pointer-coarse:h-14">
                <span className="relative mr-0.5 grid size-4 shrink-0 place-items-center text-fg-3">
                  <Search size={16} className={cn("transition-[opacity,scale] duration-150", spinning && "scale-75 opacity-0")} />
                  <Loader size={16} className={cn("absolute animate-spin transition-[opacity,scale] duration-150", !spinning && "scale-75 opacity-0")} />
                </span>
                <nav aria-label="Pages" className="flex min-w-0 shrink items-center gap-1 empty:hidden">
                  <AnimatePresence initial={false} mode="popLayout">
                    {trail.map((l, i) => (
                      <motion.button
                        key={`${i}-${l.id}`}
                        type="button"
                        layout={reduce ? false : "position"}
                        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, filter: "blur(2px)" }}
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                        exit={reduce ? { opacity: 0, transition: { duration: 0.08 } } : { opacity: 0, scale: 0.9, transition: { duration: 0.1 } }}
                        transition={reduce ? { duration: 0.12 } : spring.pop}
                        onClick={() => popTo(i)}
                        aria-current={i === trail.length - 1 ? "page" : undefined}
                        aria-label={i === trail.length - 1 ? `${pages[l.id]?.title}, current page` : `Back to ${pages[l.id]?.title}`}
                        className={cn(
                          "relative inline-flex h-6 max-w-[9rem] shrink-0 items-center rounded-md border border-line-2 bg-fg/[0.05] px-2 text-[12px] font-medium text-fg-2 outline-none select-none",
                          "transition-[background-color,border-color,color] duration-150 hover:border-fg-4 hover:text-fg active:scale-[0.96]",
                          "aria-[current=page]:text-fg",
                          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                        )}
                      >
                        <span className="truncate">{pages[l.id]?.title}</span>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </nav>
                <motion.div layout={reduce ? false : "position"} transition={spring.snappy} className="flex h-full min-w-0 flex-1">
                  <Autocomplete.Input
                    ref={inputRef}
                    placeholder={page.placeholder ?? "Search or jump to…"}
                    aria-label={page.placeholder?.replace(/…$/, "") ?? "Search commands"}
                    autoComplete="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    onKeyDown={onInputKeyDown}
                    className={cn(paletteClasses.input, trail.length > 0 && "pl-1")}
                  />
                </motion.div>
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

              <div
                ref={scrollRef}
                style={{ height: contentHeight ?? undefined }}
                className="relative max-h-[min(22rem,55dvh)] min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain transition-[height] duration-[180ms] ease-out-quart motion-reduce:transition-none"
              >
                <div ref={ghostRef} aria-hidden className="pointer-events-none absolute inset-x-0 top-0" />
                <div ref={measure} className="p-1.5">
                  <div ref={pageRef}>
                    <Autocomplete.Empty>
                      {count === 0 && (
                        <div className="flex flex-col items-center gap-1 px-6 py-9 text-center">
                          <p className="max-w-full truncate text-[13px] text-fg-2">
                            {query.trim() ? (
                              <>
                                No results for <span className="text-fg">“{query.trim()}”</span>
                              </>
                            ) : (
                              "Nothing here yet"
                            )}
                          </p>
                          {!atRoot && (
                            <p className="text-[12px] text-fg-3">
                              Press <Kbd keys="backspace" size="sm" className="mx-0.5" /> to go back
                            </p>
                          )}
                        </div>
                      )}
                    </Autocomplete.Empty>
                    <div ref={setGlideList} className="group/list relative">
                      <motion.div aria-hidden style={{ y: glideY, height: glideH, opacity: glideO }} className={paletteClasses.glide} />
                      <Autocomplete.List className="outline-none empty:hidden">
                        {(section: CommandSection) => (
                          <Autocomplete.Group key={section.value} items={section.items}>
                            <Autocomplete.GroupLabel className={cn(paletteClasses.groupLabel, "first:pt-1.5")}>{section.value}</Autocomplete.GroupLabel>
                            <Autocomplete.Collection>
                              {(entry: CommandEntry) => {
                                const item = entry.item as CommandPagesItem;
                                return (
                                  <CommandRow
                                    key={entry.key}
                                    entry={entry}
                                    busy={busy === entry.key}
                                    failure={failure?.key === entry.key ? failure.message : null}
                                    onRun={(fromKeyboard) => void run(entry, fromKeyboard)}
                                    trailing={
                                      item.to ? (
                                        <ChevronRight size={14} className="text-fg-4 transition-[color,translate] duration-150 group-data-highlighted/item:translate-x-0.5 group-data-highlighted/item:text-fg-2" />
                                      ) : item.checked !== undefined ? (
                                        <Checkmark on={item.checked} reduce={reduce} />
                                      ) : undefined
                                    }
                                  />
                                );
                              }}
                            </Autocomplete.Collection>
                          </Autocomplete.Group>
                        )}
                      </Autocomplete.List>
                    </div>
                  </div>
                </div>
              </div>

              <PaletteFooter
                hints={
                  atRoot
                    ? [
                        [["up", "down"], "Navigate"],
                        ["enter", "Open"],
                      ]
                    : [
                        ["enter", "Choose"],
                        ["backspace", "Back"],
                      ]
                }
              >
                {footer}
              </PaletteFooter>
              <Autocomplete.Status className="sr-only">
                {busy ? "Working…" : failure ? failure.message : query.trim() ? (count === 0 ? "No results" : `${count} ${count === 1 ? "result" : "results"}`) : atRoot ? "" : `${page.title}, ${count} options`}
              </Autocomplete.Status>
            </Autocomplete.Root>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// The current choice. The tick draws itself when it arrives on a row.
function Checkmark({ on, reduce }: { on: boolean; reduce: boolean }) {
  return (
    <span className="grid size-4 place-items-center text-fg">
      {on && (
        <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <motion.path
            d="M3.5 8.5 6.5 11.5 12.5 4.5"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.24, ease: ease.out }}
          />
        </svg>
      )}
      {on && <span className="sr-only">Selected</span>}
    </span>
  );
}
