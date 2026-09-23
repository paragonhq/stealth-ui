"use client";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Check, ChevronsUpDown, Loader, Plus, X } from "@/lib/icons";
import { spring } from "@/lib/motion";

export type ComboboxOption = {
  value: string;
  label: string;
  /** Decorative icon before the label. */
  icon?: React.ReactNode;
  /** Right-aligned meta: a count, a code, a shortcut. */
  hint?: React.ReactNode;
  disabled?: boolean;
};

// The "Create" row travels through the list as an item, so arrows and Enter reach it like any other.
// Its label is the query itself, so pressing it leaves the typed text in the input.
const CREATE = "\u0000create";

export type ComboboxProps = {
  options: ComboboxOption[];
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  /** Turns on the “Create “x”” row. Return the new option, or a promise of it; throw to report a failure. */
  onCreate?: (query: string) => ComboboxOption | Promise<ComboboxOption>;
  /** Label for the create row. */
  createLabel?: (query: string) => React.ReactNode;
  label?: React.ReactNode;
  "aria-label"?: string;
  placeholder?: string;
  /** Noun for the empty state: “No projects match…”. */
  noun?: string;
  disabled?: boolean;
  invalid?: boolean;
  name?: string;
  container?: ComboboxPrimitive.Portal.Props["container"];
  className?: string;
};

// Case- and accent-insensitive, with a map back to the original characters so the
// highlighted run lines up with what's on screen ("sao" finds "São").
function fold(s: string) {
  let text = "";
  const map: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const f = s[i].normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
    for (const ch of f) {
      text += ch;
      map.push(i);
    }
  }
  return { text, map };
}

export function matchRange(label: string, query: string): [number, number] | null {
  const q = fold(query.trim()).text;
  if (!q) return null;
  const { text, map } = fold(label);
  const at = text.indexOf(q);
  if (at < 0) return null;
  return [map[at], map[at + q.length - 1] + 1];
}

/** The label with the matched run set in the primary color and the rest a step quieter. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const range = matchRange(text, query);
  if (!range) return <>{text}</>;
  return (
    <>
      <span className="text-fg-2">{text.slice(0, range[0])}</span>
      <mark className="bg-transparent font-medium text-fg">{text.slice(range[0], range[1])}</mark>
      <span className="text-fg-2">{text.slice(range[1])}</span>
    </>
  );
}

function defaultCreateLabel(query: string) {
  return (
    <>
      Create <span className="font-medium text-fg">“{query}”</span>
    </>
  );
}

export function Combobox({
  options,
  value,
  defaultValue = null,
  onValueChange,
  onCreate,
  createLabel = defaultCreateLabel,
  label,
  "aria-label": ariaLabel,
  placeholder = "Search…",
  noun = "results",
  disabled,
  invalid,
  name,
  container,
  className,
}: ComboboxProps) {
  const reduce = !!useReducedMotion();
  const inputId = useId();
  const errorId = useId();
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const [created, setCreated] = useState<ComboboxOption[]>([]);
  const all = useMemo(() => [...options, ...created.filter((c) => !options.some((o) => o.value === c.value))], [options, created]);
  const selected = all.find((o) => o.value === current) ?? null;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selected?.label ?? "");
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Set in the same event as the press, before state catches up, so the close can be held back.
  const pendingCreate = useRef(false);
  // A value set from outside (controlled) brings its label into the input.
  const [synced, setSynced] = useState(selected?.value ?? null);
  if ((selected?.value ?? null) !== synced) {
    setSynced(selected?.value ?? null);
    setQuery(selected?.label ?? "");
  }

  // While the input still shows the chosen label, the list shows everything.
  const q = selected && query === selected.label ? "" : query.trim();
  const matches = useMemo(() => (q ? all.filter((o) => matchRange(o.label, q)) : all), [all, q]);
  const exact = !!q && all.some((o) => fold(o.label).text === fold(q).text);
  const canCreate = !!onCreate && !!q && !exact;
  const createItem = useMemo<ComboboxOption>(() => ({ value: CREATE, label: q }), [q]);
  const filtered = canCreate ? [...matches, createItem] : matches;

  const choose = (next: ComboboxOption | null) => {
    if (!controlled) setInner(next?.value ?? null);
    onValueChange?.(next?.value ?? null);
    setQuery(next?.label ?? "");
  };

  const create = async (text: string) => {
    if (!onCreate || creating) return;
    setError(null);
    const result = onCreate(text);
    if (!(result instanceof Promise)) {
      pendingCreate.current = false;
      setCreated((c) => [...c, result]);
      choose(result);
      setOpen(false);
      return;
    }
    setCreating(text);
    try {
      const option = await result;
      setCreated((c) => [...c, option]);
      choose(option);
      setOpen(false);
    } catch {
      setError(`Couldn't create “${text}”. Try again.`);
    } finally {
      pendingCreate.current = false;
      setCreating(null);
    }
  };

  const { setList, y, height, opacity } = useGlide(reduce);

  return (
    <ComboboxPrimitive.Root<ComboboxOption>
      items={onCreate ? [...all, createItem] : all}
      filteredItems={filtered}
      value={selected}
      onValueChange={(next) => {
        if (next?.value === CREATE) {
          pendingCreate.current = true;
          return void create(q);
        }
        choose(next);
      }}
      inputValue={query}
      onInputValueChange={(next) => {
        setQuery(next);
        setError(null);
      }}
      open={open}
      onOpenChange={(next, details) => {
        // An async create keeps the list open until it lands, so the spinner stays where it was pressed.
        if (!next && pendingCreate.current && details.reason === "item-press") return details.cancel();
        setOpen(next);
        // Leaving with a half-typed query puts the chosen label back rather than keeping stray text.
        if (!next && details.reason !== "item-press") setQuery(selected?.label ?? "");
      }}
      autoHighlight
      isItemEqualToValue={(a, b) => a.value === b.value}
      itemToStringLabel={(o) => o.label}
      itemToStringValue={(o) => o.value}
      disabled={disabled}
      name={name}
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
            "has-aria-invalid:border-danger/70 has-aria-invalid:focus-within:ring-danger/15",
            "data-disabled:pointer-events-none data-disabled:opacity-50",
          )}
        >
          <ComboboxPrimitive.Input
            ref={inputRef}
            id={inputId}
            placeholder={placeholder}
            aria-label={label ? undefined : ariaLabel}
            aria-invalid={invalid || !!error || undefined}
            aria-describedby={error && !open ? errorId : undefined}
            className="h-full min-w-0 flex-1 rounded-lg bg-transparent pr-16 pl-2.5 text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]"
          />
          <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
            <span className="grid size-6 place-items-center">
              <AnimatePresence initial={false} mode="popLayout">
                {creating ? (
                  <motion.span key="busy" {...swapIn(reduce)} className="grid place-items-center text-fg-3">
                    <Loader size={14} className="animate-spin" />
                  </motion.span>
                ) : (
                  (query || selected) && (
                    <motion.span key="clear" {...swapIn(reduce)} className="grid">
                      <button
                        type="button"
                        aria-label="Clear"
                        onClick={() => {
                          choose(null);
                          inputRef.current?.focus();
                        }}
                        className={cn(
                          "relative grid size-6 place-items-center rounded-md text-fg-3 hover:bg-hover hover:text-fg",
                          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
                          "transition-[background-color,color,scale] duration-150 active:scale-[0.9] after:absolute after:-inset-2 after:content-['']",
                        )}
                      >
                        <X size={14} />
                      </button>
                    </motion.span>
                  )
                )}
              </AnimatePresence>
            </span>
            <ComboboxPrimitive.Trigger
              aria-label="Show all options"
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
        {/* While the list is open the failure shows in the create row; once it closes, under the field. */}
        <AnimatePresence initial={false}>
          {error && !open && (
            <motion.p
              id={errorId}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="text-[12px] text-danger"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        <span role="status" className="sr-only">
          {creating ? `Creating “${creating}”` : (error ?? "")}
        </span>
      </div>

      <ComboboxPrimitive.Portal container={container}>
        <ComboboxPrimitive.Positioner align="start" sideOffset={6} collisionPadding={8} className="z-(--z-popover) outline-none">
          <ComboboxPrimitive.Popup
            aria-busy={!!creating || undefined}
            className={cn(
              "w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
              "transition-[opacity,scale] duration-160 ease-out-expo data-ending-style:duration-100 data-ending-style:ease-out",
              "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0",
              "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
            )}
          >
            <ComboboxPrimitive.Empty className="empty:hidden">
              <div className="px-3 py-5 text-center text-[12.5px] text-fg-3">
                <p className="truncate">
                  No {noun} match <span className="text-fg-2">“{q}”</span>
                </p>
              </div>
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List
              ref={setList}
              className="relative max-h-[min(var(--available-height),17.5rem)] scroll-py-1 overflow-y-auto overscroll-contain p-1 outline-none empty:hidden"
            >
              <motion.div aria-hidden style={{ y, height, opacity }} className="pointer-events-none absolute inset-x-1 top-0 rounded-lg bg-line" />
              <ComboboxPrimitive.Collection>
                {(o: ComboboxOption) =>
                  o.value === CREATE ? (
                    <ComboboxPrimitive.Item
                      key="create"
                      value={o}
                      className={cn(itemClass, matches.length > 0 && "mt-1 before:absolute before:inset-x-1 before:-top-[3px] before:h-px before:bg-line")}
                    >
                      <span className="grid size-4 shrink-0 place-items-center rounded-[4px] border border-line-2 text-fg-2 transition-colors group-data-highlighted/item:border-fg-4 group-data-highlighted/item:text-fg">
                        {creating ? <Loader size={11} className="animate-spin" /> : <Plus size={11} />}
                      </span>
                      <span className={cn("min-w-0 flex-1 truncate", error ? "text-danger" : "text-fg-2")}>
                        {creating ? `Creating “${creating}”…` : error ? `Couldn’t create “${q}”. Try again` : createLabel(q)}
                      </span>
                      <kbd className="font-mono text-2xs text-fg-4 opacity-0 transition-opacity group-data-highlighted/item:opacity-100">↵</kbd>
                    </ComboboxPrimitive.Item>
                  ) : (
                    <ComboboxPrimitive.Item key={o.value} value={o} disabled={o.disabled} className={itemClass}>
                      {o.icon && <span className="flex shrink-0 text-fg-3 [&_svg]:size-4">{o.icon}</span>}
                      <span className="min-w-0 flex-1 truncate">
                        <Highlight text={o.label} query={q} />
                      </span>
                      {o.hint && <span className="shrink-0 font-mono text-2xs text-fg-4 tabular">{o.hint}</span>}
                      <span className="grid size-4 shrink-0 place-items-center">
                        <ComboboxPrimitive.ItemIndicator>
                          <Check size={14} />
                        </ComboboxPrimitive.ItemIndicator>
                      </span>
                    </ComboboxPrimitive.Item>
                  )
                }
              </ComboboxPrimitive.Collection>
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}

const itemClass = cn(
  "group/item relative z-[1] flex h-8 cursor-default scroll-my-1 items-center gap-2 rounded-lg px-2 text-[13px] text-fg outline-none select-none pointer-coarse:h-10",
  "data-disabled:text-fg-4 data-disabled:[&_*]:text-fg-4",
);

const swapIn = (reduce: boolean) => ({
  initial: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" },
  transition: reduce ? { duration: 0.12 } : spring.pop,
});

// One highlight for the list: glides after the pointer, jumps for arrow keys and filtering.
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
      let top = 0;
      for (let n: HTMLElement | null = el; n && n !== list; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
      if (!shown || keyboard || reduce) {
        y.jump(top);
        height.jump(el.offsetHeight);
        opacity.jump(target);
      } else {
        running.push(animate(y, top, spring.follow), animate(height, el.offsetHeight, spring.follow));
        opacity.jump(target);
      }
      shown = true;
    };
    // Typing re-filters the list, which moves rows under the highlight; that should jump too.
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
