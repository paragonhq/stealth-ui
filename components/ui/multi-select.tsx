"use client";
import { Combobox } from "@base-ui/react/combobox";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ChevronsUpDown, Search, X } from "@/lib/icons";
import { spring } from "@/lib/motion";

export type MultiSelectOption = {
  value: string;
  label: string;
  /** Decorative: an avatar, a flag, a status dot. Shown in the list and on the chip. */
  icon?: React.ReactNode;
  description?: string;
  disabled?: boolean;
};

// The "Select all" row is a real list item so arrow keys reach it; it never stays in the value.
const ALL: MultiSelectOption = { value: "\u0000all", label: "Select all" };

export type MultiSelectProps = {
  options: MultiSelectOption[];
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** Visible label. Without one, pass aria-label. */
  label?: React.ReactNode;
  "aria-label"?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Noun for the count and the empty state, e.g. "people". */
  noun?: string;
  /** Show the "Select all" row, which acts on what the search currently matches. */
  selectAll?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  name?: string;
  /** Portal target for the popup. Defaults to document.body. */
  container?: Combobox.Portal.Props["container"];
  className?: string;
};

const normalize = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();

export function MultiSelect({
  options,
  value,
  defaultValue = [],
  onValueChange,
  label,
  "aria-label": ariaLabel,
  placeholder = "Select…",
  searchPlaceholder = "Search",
  noun = "items",
  selectAll = true,
  disabled,
  invalid,
  name,
  container,
  className,
}: MultiSelectProps) {
  const reduce = !!useReducedMotion();
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const ids = controlled ? value : inner;
  const setIds = (next: string[]) => {
    if (!controlled) setInner(next);
    onValueChange?.(next);
  };

  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const selected = useMemo(() => ids.map((id) => byValue.get(id)).filter((o): o is MultiSelectOption => !!o), [ids, byValue]);
  const [query, setQuery] = useState("");
  const q = normalize(query.trim());
  const matches = useMemo(() => (q ? options.filter((o) => normalize(o.label).includes(q) || normalize(o.description ?? "").includes(q)) : options), [options, q]);
  const pickable = matches.filter((o) => !o.disabled);
  const pickedInMatches = pickable.filter((o) => ids.includes(o.value)).length;
  const allState = pickable.length > 0 && pickedInMatches === pickable.length ? "checked" : pickedInMatches > 0 ? "mixed" : "unchecked";
  const filtered = matches.length ? (selectAll && pickable.length > 1 ? [ALL, ...matches] : matches) : [];

  const describedBy = useId();
  const { rowRef, measureRef, fit } = useFit(selected.map((o) => o.value).join("|"));
  const shown = selected.slice(0, fit);
  const overflow = selected.length - shown.length;
  const { setList, y, height, opacity } = useGlide(reduce);

  // The resting state is the same either way so server and client markup agree; only the travel differs.
  const chipMotion = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, filter: "blur(2px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, scale: 0.8, filter: "blur(2px)", transition: { duration: 0.12 } },
    transition: reduce ? { duration: 0.12 } : spring.snappy,
  };

  return (
    <Combobox.Root<MultiSelectOption, true>
      multiple
      items={selectAll ? [ALL, ...options] : options}
      filteredItems={filtered}
      value={selected}
      onValueChange={(next) => {
        if (next.includes(ALL)) {
          const pickableIds = pickable.map((o) => o.value);
          setIds(allState === "checked" ? ids.filter((id) => !pickableIds.includes(id)) : [...ids, ...pickableIds.filter((id) => !ids.includes(id))]);
          return;
        }
        setIds(next.map((o) => o.value));
      }}
      inputValue={query}
      onInputValueChange={(next, details) => {
        // Keep the search after a pick so several results can be chosen from one query.
        if (details.reason === "input-clear" && details.isItemPress) return details.cancel();
        setQuery(next);
      }}
      onOpenChangeComplete={(open) => !open && setQuery("")}
      isItemEqualToValue={(a, b) => a.value === b.value}
      itemToStringLabel={(o) => o.label}
      itemToStringValue={(o) => o.value}
      disabled={disabled}
      name={name}
    >
      <div className={cn("flex w-full min-w-0 flex-col gap-1.5", className)}>
        {label && <Combobox.Label className="w-fit cursor-default text-[12.5px] font-medium text-fg-2 select-none">{label}</Combobox.Label>}
        <div className="group/field relative">
          <Combobox.Trigger
            aria-label={label ? undefined : ariaLabel}
            aria-describedby={selected.length ? describedBy : undefined}
            aria-invalid={invalid || undefined}
            className={cn(
              "flex h-8 w-full min-w-0 items-center gap-2 rounded-lg border border-line-2 bg-raised pr-2 pl-1 text-left text-[13px] text-fg shadow-[var(--shadow)] select-none",
              "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              "transition-[background-color,border-color,scale] duration-150 ease-out active:scale-[0.99] active:duration-75",
              "hover:border-fg-4 data-popup-open:border-fg-4",
              "aria-invalid:border-danger/70 data-disabled:pointer-events-none data-disabled:opacity-50",
              "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.5",
              selected.length ? "pr-[3.25rem]" : "pl-2.5",
            )}
          >
            <span ref={rowRef} className="relative flex h-full min-w-0 flex-1 items-center gap-1 overflow-hidden">
              {selected.length === 0 && <span className="truncate text-fg-4">{placeholder}</span>}
              <AnimatePresence initial={false} mode="popLayout">
                {shown.map((o, i) => (
                  <motion.span key={o.value} layout={!reduce} {...chipMotion} className={cn(i === 0 ? "min-w-0 shrink" : "shrink-0", "flex")}>
                    <Chip option={o} />
                  </motion.span>
                ))}
                {overflow > 0 && (
                  <motion.span key="more" layout={!reduce} {...chipMotion} className="flex h-[22px] shrink-0 items-center rounded-[5px] bg-line px-1.5 text-[12px] text-fg-2">
                    +<NumberFlow value={overflow} className="tabular" />
                  </motion.span>
                )}
              </AnimatePresence>
              {/* Every chip laid out off-screen, so the row knows how many fit before it shows them. */}
              <span ref={measureRef} aria-hidden className="pointer-events-none invisible absolute top-0 left-0 flex h-full items-center gap-1">
                {selected.map((o) => (
                  <span key={o.value} className="flex shrink-0">
                    <Chip option={o} />
                  </span>
                ))}
                <span className="flex h-[22px] shrink-0 items-center rounded-[5px] px-1.5 text-[12px] tabular">+{selected.length}</span>
              </span>
            </span>
            <ChevronsUpDown size={16} className="absolute right-2 shrink-0 text-fg-3 transition-colors group-hover/field:text-fg-2" />
          </Combobox.Trigger>
          <span id={describedBy} className="sr-only">
            {selected.length} selected: {selected.map((o) => o.label).join(", ")}
          </span>

          <AnimatePresence initial={false}>
            {selected.length > 0 && !disabled && (
              <motion.button
                type="button"
                aria-label={`Clear ${noun}`}
                onClick={() => setIds([])}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, transition: { duration: 0.1 } }}
                transition={spring.pop}
                className={cn(
                  "absolute top-1/2 right-7 -mt-2.5 grid size-5 place-items-center rounded-md text-fg-3 hover:bg-hover hover:text-fg",
                  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                  "transition-colors active:scale-[0.9]",
                  "after:absolute after:-inset-2.5 after:content-['']",
                )}
              >
                <X size={14} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Combobox.Portal container={container}>
        <Combobox.Positioner align="start" sideOffset={6} collisionPadding={8} className="z-(--z-popover) outline-none">
          <Combobox.Popup
            aria-label={typeof label === "string" ? label : ariaLabel}
            className={cn(
              "flex w-(--anchor-width) max-w-(--available-width) min-w-64 origin-(--transform-origin) flex-col overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
              "transition-[opacity,scale] duration-160 ease-out-expo data-ending-style:duration-100 data-ending-style:ease-out",
              "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0",
              "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
            )}
          >
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
              <Search size={14} className="shrink-0 text-fg-3" />
              <Combobox.Input
                aria-label={searchPlaceholder}
                placeholder={searchPlaceholder}
                onKeyDown={(e) => {
                  // Backspace in an empty search takes back the last pick.
                  if (e.key === "Backspace" && query === "" && ids.length) setIds(ids.slice(0, -1));
                }}
                className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]"
              />
            </div>

            <Combobox.Empty className="empty:hidden">
              <div className="flex flex-col items-center gap-2 px-3 py-5 text-center text-[12.5px] text-fg-3">
                <p className="max-w-full truncate">
                  No {noun} match <span className="text-fg-2">“{query.trim()}”</span>
                </p>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="h-6 rounded-md border border-line-2 px-2 text-[12px] font-medium text-fg-2 transition-[background-color,color,scale] duration-150 outline-none hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 active:scale-[0.96]"
                >
                  Clear search
                </button>
              </div>
            </Combobox.Empty>

            <Combobox.List ref={setList} className="relative max-h-[min(calc(var(--available-height)-6rem),16.5rem)] scroll-py-1 overflow-y-auto overscroll-contain p-1 outline-none empty:hidden">
              <motion.div aria-hidden style={{ y, height, opacity }} className="pointer-events-none absolute inset-x-1 top-0 rounded-lg bg-line" />
              <Combobox.Collection>
              {(o: MultiSelectOption) =>
                o === ALL ? (
                  <Combobox.Item key={o.value} value={o} className={cn(itemClass, "mb-1 after:absolute after:inset-x-1 after:-bottom-[3px] after:h-px after:bg-line")}>
                    <Box state={allState} reduce={reduce} />
                    <span className="min-w-0 flex-1 truncate">{allState === "checked" ? "Deselect all" : q ? `Select all ${pickable.length} matches` : "Select all"}</span>
                    <span className="font-mono text-2xs text-fg-4 tabular">{pickable.length}</span>
                  </Combobox.Item>
                ) : (
                  <Combobox.Item key={o.value} value={o} disabled={o.disabled} className={itemClass}>
                    <Box state={ids.includes(o.value) ? "checked" : "unchecked"} reduce={reduce} />
                    {o.icon && <span className="flex shrink-0 text-fg-3">{o.icon}</span>}
                    <span className="flex min-w-0 flex-1 items-baseline gap-2">
                      <span className="truncate">{o.label}</span>
                      {o.description && <span className="min-w-0 truncate text-[12px] text-fg-3">{o.description}</span>}
                    </span>
                  </Combobox.Item>
                )
              }
              </Combobox.Collection>
            </Combobox.List>

            <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-t border-line pr-1.5 pl-3 text-[12px] text-fg-3">
              <span className="tabular">
                <NumberFlow value={selected.length} className="text-fg-2" /> of {options.length} selected
              </span>
              <button
                type="button"
                disabled={!selected.length}
                onClick={() => setIds([])}
                className={cn(
                  "h-6 rounded-md px-2 text-[12px] font-medium text-fg-2 hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40",
                  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                  "transition-[background-color,color,scale] duration-150 active:scale-[0.96]",
                )}
              >
                Clear
              </button>
            </div>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

const itemClass = cn(
  "group/item relative z-[1] flex h-8 cursor-default scroll-my-1 items-center gap-2.5 rounded-lg px-2 text-[13px] text-fg outline-none select-none pointer-coarse:h-10",
  "data-disabled:text-fg-4 data-disabled:[&_span]:text-fg-4",
);

function Chip({ option }: { option: MultiSelectOption }) {
  return (
    <span className="flex h-[22px] min-w-0 items-center gap-1 rounded-[5px] border border-line-2 bg-frame px-1.5 text-[12px] leading-none text-fg">
      {option.icon && <span className="flex shrink-0 [&>*]:size-3.5">{option.icon}</span>}
      <span className="min-w-0 truncate">{option.label}</span>
    </span>
  );
}

// A checkbox that squashes a little on press and draws its tick when it turns on.
function Box({ state, reduce }: { state: "checked" | "unchecked" | "mixed"; reduce: boolean }) {
  const on = state !== "unchecked";
  return (
    <span
      aria-hidden
      data-state={state}
      className={cn(
        "grid size-3.5 shrink-0 place-items-center rounded-[4px] border transition-[background-color,border-color,scale] duration-150 ease-out group-active/item:scale-[0.88]",
        on ? "border-fg bg-fg text-frame" : "border-line-2 bg-frame group-data-highlighted/item:border-fg-4",
      )}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {state === "mixed" ? (
          <path d="M2.5 5h5" />
        ) : (
          <motion.path
            d="M2 5.2 4.1 7.2 8 2.8"
            initial={false}
            animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
            transition={reduce ? { duration: 0 } : { pathLength: { duration: 0.2, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.05 } }}
          />
        )}
      </svg>
    </span>
  );
}

// Works out how many chips fit on one line beside a "+N" badge, from an invisible copy of the row.
function useFit(key: string) {
  const rowRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState(99);

  useEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;
    let frame = 0;
    const compute = () => {
      const items = [...measure.children] as HTMLElement[];
      const badge = items.pop();
      const available = row.clientWidth;
      const gap = 4;
      let used = 0;
      let n = 0;
      for (let i = 0; i < items.length; i++) {
        const width = items[i].offsetWidth + (i ? gap : 0);
        const reserve = i < items.length - 1 ? gap + (badge?.offsetWidth ?? 0) : 0;
        if (used + width + reserve > available) break;
        used += width;
        n = i + 1;
      }
      // The first chip always shows, truncating if it must, so the field never reads as empty.
      setFit(Math.max(1, n));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(compute);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(row);
    observer.observe(measure);
    schedule();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [key]);

  return { rowRef, measureRef, fit };
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
      let top = 0;
      for (let n: HTMLElement | null = el; n && n !== list; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
      if (!shown || keyboard || reduce) {
        y.jump(top);
        height.jump(el.offsetHeight);
        if (keyboard || reduce) opacity.jump(target);
        else running.push(animate(opacity, target, { duration: 0.08 }));
      } else {
        running.push(animate(y, top, spring.follow), animate(height, el.offsetHeight, spring.follow));
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
