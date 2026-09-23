"use client";
import { Combobox } from "@base-ui/react/combobox";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { Children, Fragment, isValidElement, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ChevronsUpDown, Plus, Search } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type PathItem = {
  id: string;
  name: string;
  /** Right-aligned detail in the list: a plan, a count, a framework. */
  meta?: string;
  /** A 16px mark shown in the trigger and the list. */
  icon?: React.ReactNode;
  disabled?: boolean;
};

type Row = PathItem & { create?: true };
const CREATE = "__create__";

/* -------------------------------------------------------------------------------------------------
 * PathSwitcher: the breadcrumb
 * -----------------------------------------------------------------------------------------------*/

export type PathSwitcherProps = React.ComponentProps<"nav">;

/** A breadcrumb of scopes (team / project / environment) where every step is its own switcher. */
export function PathSwitcher({ className, children, "aria-label": label = "Location", ...rest }: PathSwitcherProps) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <nav aria-label={label} className={cn("min-w-0", className)} {...rest}>
      <ol className="flex min-w-0 items-center">
        {items.map((child, i) => (
          <Fragment key={child.key ?? i}>
            {i > 0 && (
              <li aria-hidden className="shrink-0 px-0.5 text-fg-4">
                <svg width="16" height="24" viewBox="0 0 16 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round">
                  <path d="M10.5 5 5.5 19" />
                </svg>
              </li>
            )}
            {/* When space runs out the deepest scope truncates first; its parents give way far less. */}
            <li className={cn("flex min-w-0 items-center", i < items.length - 1 ? "shrink-[0.15]" : "shrink")}>{child}</li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

/* -------------------------------------------------------------------------------------------------
 * PathSegment: one step, with its own searchable list
 * -----------------------------------------------------------------------------------------------*/

export type PathSegmentProps = {
  /** What this step is: "Team", "Project". Names the switcher and its search. */
  label: string;
  items: PathItem[];
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (id: string, item: PathItem) => void;
  /** Makes the name a link to this scope; the chevron alone opens the switcher. */
  href?: string;
  /** Shown when nothing is chosen. Defaults to "Select a {label}". */
  placeholder?: string;
  /** The items are on their way: the name becomes a skeleton and the list shows placeholder rows. */
  loading?: boolean;
  /** Adds a create row, prefilled with the search. */
  onCreate?: (name: string) => void;
  /** Longest the name may grow before it truncates, in pixels. */
  maxWidth?: number;
  /** Portal container for the popup. Defaults to document.body. */
  container?: HTMLElement | React.RefObject<HTMLElement | null> | null;
  className?: string;
};

export function PathSegment({
  label,
  items,
  value: valueProp,
  defaultValue = null,
  onValueChange,
  href,
  placeholder,
  loading = false,
  onCreate,
  maxWidth = 180,
  container,
  className,
}: PathSegmentProps) {
  const reduce = !!useReducedMotion();
  const [value, setValue] = useControllableState<string | null>({ value: valueProp, defaultValue, onChange: undefined });
  const current = items.find((i) => i.id === value) ?? null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dir, setDir] = useState(1);
  const anchor = useRef<HTMLDivElement>(null);
  const noun = label.toLowerCase();

  const choose = (next: PathItem) => {
    if (next.id === current?.id) return;
    setDir(current && items.indexOf(next) < items.indexOf(current) ? -1 : 1);
    setValue(next.id);
    onValueChange?.(next.id, next);
  };

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => (q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items), [items, q]);
  const createRow = useMemo<Row>(() => ({ id: CREATE, name: query.trim(), create: true }), [query]);
  const exact = items.some((i) => i.name.toLowerCase() === q);
  const rows: Row[] = loading ? [] : onCreate && !exact ? [...matches, createRow] : matches;
  const { setScroller, y, height, opacity } = useGlide(reduce);

  const text = current?.name ?? placeholder ?? `Select a ${noun}`;
  const name = (
    <Label text={text} icon={current?.icon} id={current?.id ?? "none"} dir={dir} loading={loading} empty={!current} maxWidth={maxWidth} reduce={reduce} />
  );

  const segmentClass = cn(
    "group/seg relative flex h-8 min-w-0 select-none items-center gap-2 rounded-lg px-2 text-[13px] outline-none",
    "touch-manipulation [-webkit-tap-highlight-color:transparent]",
    "transition-[background-color,scale] duration-150 ease-out hover:bg-hover active:scale-[0.98] active:duration-75",
    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
  );

  return (
    <Combobox.Root<Row>
      items={onCreate ? [...items, createRow] : items}
      filteredItems={rows}
      value={current}
      onValueChange={(next) => {
        if (!next) return;
        if (next.create) return onCreate?.(query.trim());
        choose(next);
      }}
      inputValue={query}
      onInputValueChange={setQuery}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      autoHighlight
      isItemEqualToValue={(a, b) => a.id === b.id}
      itemToStringLabel={(i) => i.name}
      itemToStringValue={(i) => i.id}
    >
      <div ref={anchor} data-open={open ? "" : undefined} className={cn("flex min-w-0 items-center rounded-lg", className)}>
        {href ? (
          <>
            <a href={href} aria-current={current ? "page" : undefined} className={cn(segmentClass, "cursor-pointer pr-1.5")}>
              {name}
            </a>
            <Combobox.Trigger
              aria-label={`Switch ${noun}`}
              className={cn(
                "relative grid h-8 w-5 shrink-0 place-items-center rounded-md text-fg-4 outline-none transition-[background-color,color,scale] duration-150",
                "hover:bg-hover hover:text-fg-2 data-popup-open:bg-hover data-popup-open:text-fg-2 active:scale-[0.92]",
                "before:absolute before:-inset-x-2 before:-inset-y-1.5 before:content-[''] pointer-fine:before:hidden",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
              )}
            >
              <ChevronsUpDown size={13} />
            </Combobox.Trigger>
          </>
        ) : (
          <Combobox.Trigger aria-label={`${label}: ${current?.name ?? "none"}. Switch ${noun}`} className={cn(segmentClass, "pr-1.5 data-popup-open:bg-hover")}>
            {name}
            <ChevronsUpDown size={13} className="shrink-0 text-fg-4 transition-colors group-hover/seg:text-fg-3 group-data-popup-open/seg:text-fg-2" />
          </Combobox.Trigger>
        )}
      </div>

      <Combobox.Portal container={container}>
        <Combobox.Positioner anchor={anchor} align="start" sideOffset={6} collisionPadding={8} className="z-(--z-popover) outline-none">
          <Combobox.Popup
            aria-label={`Switch ${noun}`}
            aria-busy={loading || undefined}
            className={cn(
              "w-[max(var(--anchor-width),16rem)] max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
              "transition-[opacity,scale,translate] duration-180 ease-out-expo data-ending-style:duration-120 data-ending-style:ease-out",
              "data-starting-style:scale-96 data-starting-style:-translate-y-1 data-starting-style:opacity-0 data-ending-style:scale-98 data-ending-style:opacity-0",
              "motion-reduce:scale-100 motion-reduce:translate-none",
            )}
          >
            <label className="flex h-10 items-center gap-2 border-b border-line px-3 text-fg-3">
              <Search size={14} className="shrink-0" />
              <Combobox.Input
                placeholder={`Find a ${noun}`}
                aria-label={`Find a ${noun}`}
                className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]"
              />
            </label>
            <div ref={setScroller} className="relative max-h-[min(var(--available-height),17rem)] scroll-py-1 overflow-y-auto overscroll-contain p-1">
              <motion.div aria-hidden style={{ y, height, opacity }} className="pointer-events-none absolute inset-x-1 top-0 rounded-lg bg-fg/[0.06]" />
              {loading ? (
                <div role="status" aria-label={`Loading ${noun}s`} className="flex flex-col">
                  {[70, 52, 62].map((w) => (
                    <div key={w} className="flex h-8 items-center gap-2.5 px-2">
                      <span className="size-4 rounded bg-hover" />
                      <span className="h-2 rounded-full bg-hover motion-safe:animate-pulse-soft" style={{ width: `${w}%` }} />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {matches.length > 0 && (
                    <div className="flex h-7 items-center justify-between px-2 font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">
                      <span>{label}s</span>
                      <span className="tabular">{matches.length}</span>
                    </div>
                  )}
                  {!matches.length && (
                    <p className="truncate px-2 py-3 text-[12.5px] text-fg-3">
                      {q ? (
                        <>
                          No {noun} matches <span className="text-fg-2">“{query.trim()}”</span>
                        </>
                      ) : (
                        `No ${noun}s yet`
                      )}
                    </p>
                  )}
                </>
              )}
              <Combobox.List className="outline-none">
                {(i: Row) =>
                  i.create ? (
                    <Combobox.Item
                      key={CREATE}
                      value={i}
                      className={cn(itemClass, matches.length > 0 && "mt-1 before:absolute before:inset-x-1 before:-top-[3px] before:h-px before:bg-line")}
                    >
                      <span className="grid size-4 shrink-0 place-items-center rounded-[4px] border border-dashed border-line-2 text-fg-3 transition-colors group-data-highlighted/item:border-fg-4 group-data-highlighted/item:text-fg">
                        <Plus size={11} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-fg-2 group-data-highlighted/item:text-fg">
                        {i.name ? (
                          <>
                            Create {noun} <span className="text-fg">“{i.name}”</span>
                          </>
                        ) : (
                          `Create ${noun}`
                        )}
                      </span>
                    </Combobox.Item>
                  ) : (
                    <Combobox.Item key={i.id} value={i} disabled={i.disabled} className={itemClass}>
                      {i.icon && <span className="grid size-4 shrink-0 place-items-center text-fg-3 [&_svg]:size-4">{i.icon}</span>}
                      <span className="min-w-0 flex-1 truncate">{i.name}</span>
                      {i.meta && <span className="shrink-0 text-[11.5px] text-fg-4 tabular">{i.meta}</span>}
                      <span className="grid size-4 shrink-0 place-items-center">{i.id === current?.id && <DrawnCheck reduce={reduce} />}</span>
                    </Combobox.Item>
                  )
                }
              </Combobox.List>
            </div>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

const itemClass = cn(
  "group/item relative z-[1] flex h-8 cursor-default scroll-my-1 items-center gap-2.5 rounded-lg px-2 text-[13px] text-fg outline-none select-none pointer-coarse:h-10",
  "data-disabled:text-fg-4 data-disabled:[&_*]:text-fg-4",
);

/* -------------------------------------------------------------------------------------------------
 * The name: rolls to the new value and eases its width, so the rest of the path slides over
 * -----------------------------------------------------------------------------------------------*/

function Label({
  text,
  icon,
  id,
  dir,
  loading,
  empty,
  maxWidth,
  reduce,
}: {
  text: string;
  icon?: React.ReactNode;
  id: string;
  dir: number;
  loading: boolean;
  empty: boolean;
  maxWidth: number;
  reduce: boolean;
}) {
  const [measure, setMeasure] = useState<HTMLSpanElement | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    if (!measure) return;
    const ro = new ResizeObserver(() => setWidth(Math.min(Math.ceil(measure.getBoundingClientRect().width), maxWidth)));
    ro.observe(measure);
    return () => ro.disconnect();
  }, [measure, maxWidth]);

  const key = loading ? "loading" : id;
  const target = loading ? 72 : width;
  // Variants read the direction through `custom`, so the leaving name uses the new direction too.
  const roll = {
    variants: {
      enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, y: d * 8, filter: "blur(2px)" }),
      center: { opacity: 1, y: 0, filter: "blur(0px)" },
      exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, y: d * -8, filter: "blur(2px)" }),
    },
    custom: dir,
    initial: "enter",
    animate: "center",
    exit: "exit",
  };

  return (
    <>
      {icon !== undefined && !loading && (
        <span className="grid size-4 shrink-0 place-items-center overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout" custom={dir}>
            <motion.span key={id} {...roll} transition={reduce ? { duration: 0.12 } : { duration: 0.26, ease: ease.out }} className="grid size-4 place-items-center [&_svg]:size-4">
              {icon}
            </motion.span>
          </AnimatePresence>
        </span>
      )}
      <motion.span
        initial={false}
        animate={target === null ? undefined : { width: target }}
        transition={reduce ? { duration: 0 } : spring.snappy}
        className="relative grid h-5 min-w-0 items-center overflow-hidden"
      >
        {/* Measures the full name at its natural width; the visible span animates to it. */}
        <span ref={setMeasure} aria-hidden className="invisible absolute left-0 top-0 whitespace-nowrap font-medium">
          {text}
        </span>
        <AnimatePresence initial={false} mode="popLayout" custom={dir}>
          <motion.span
            key={key}
            {...roll}
            transition={reduce ? { duration: 0.12 } : { duration: 0.26, ease: ease.out }}
            className={cn("col-start-1 row-start-1 truncate whitespace-nowrap font-medium", empty ? "text-fg-3" : "text-fg")}
          >
            {loading ? <span className="block h-2.5 w-[72px] rounded-full bg-hover motion-safe:animate-pulse-soft" /> : text}
          </motion.span>
        </AnimatePresence>
      </motion.span>
      {loading && <span className="sr-only">Loading</span>}
    </>
  );
}

function DrawnCheck({ reduce }: { reduce: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-fg">
      <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.28, ease: ease.out, delay: 0.06 }} />
    </svg>
  );
}

// One highlight for the list: glides after the pointer, jumps for the keyboard and for filtering.
function useGlide(reduce: boolean) {
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const y = useMotionValue(0);
  const height = useMotionValue(32);
  const opacity = useMotionValue(0);

  useEffect(() => {
    if (!scroller) return;
    let keyboard = false;
    let shown = false;
    let running: AnimationPlaybackControls[] = [];
    const stop = () => {
      running.forEach((c) => c.stop());
      running = [];
    };
    const place = () => {
      const el = scroller.querySelector<HTMLElement>("[data-highlighted]");
      stop();
      if (!el) {
        shown = false;
        running.push(animate(opacity, 0, { duration: reduce ? 0 : 0.12 }));
        return;
      }
      let top = 0;
      for (let n: HTMLElement | null = el; n && n !== scroller; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
      if (!shown || keyboard || reduce) {
        y.jump(top);
        height.jump(el.offsetHeight);
      } else {
        running.push(animate(y, top, spring.follow), animate(height, el.offsetHeight, spring.follow));
      }
      opacity.jump(el.hasAttribute("data-disabled") ? 0.45 : 1);
      shown = true;
    };
    const onKey = () => (keyboard = true);
    const onPointer = () => (keyboard = false);
    const observer = new MutationObserver(place);
    observer.observe(scroller, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-highlighted"] });
    document.addEventListener("keydown", onKey, true);
    scroller.addEventListener("pointermove", onPointer);
    place();
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKey, true);
      scroller.removeEventListener("pointermove", onPointer);
      stop();
    };
  }, [scroller, reduce, y, height, opacity]);

  return { setScroller, y, height, opacity };
}
