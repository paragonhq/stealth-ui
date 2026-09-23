"use client";
import NumberFlow from "@number-flow/react";
import { Select } from "@base-ui/react/select";
import { AnimatePresence, LayoutGroup, animate, motion, useMotionValue, useReducedMotion, type Transition } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown, MoreH } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * The window of page numbers, on its own
 * -----------------------------------------------------------------------------------------------*/

export type PaginationItem = number | "start-ellipsis" | "end-ellipsis";

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

/**
 * The pages to draw for a given page. Once there are more pages than slots, the list
 * always has the same length (first, last, the current page and its siblings, and an
 * ellipsis wherever a gap is two or more pages), so the control never changes width.
 */
export function usePagination({ page, pageCount, siblings = 1, boundaries = 1 }: { page: number; pageCount: number; siblings?: number; boundaries?: number }): PaginationItem[] {
  const slots = siblings * 2 + 3 + boundaries * 2;
  if (pageCount <= slots) return range(1, pageCount);

  const start = range(1, boundaries);
  const end = range(pageCount - boundaries + 1, pageCount);
  const from = Math.max(Math.min(page - siblings, pageCount - boundaries - siblings * 2 - 1), boundaries + 2);
  const to = Math.min(Math.max(page + siblings, boundaries + siblings * 2 + 2), pageCount - boundaries - 1);

  return [
    ...start,
    // A gap of exactly one page shows that page instead of an ellipsis standing in for it.
    from > boundaries + 2 ? "start-ellipsis" : boundaries + 1,
    ...range(from, to),
    to < pageCount - boundaries - 1 ? "end-ellipsis" : pageCount - boundaries,
    ...end,
  ];
}

/* -------------------------------------------------------------------------------------------------
 * Pagination
 * -----------------------------------------------------------------------------------------------*/

type Size = "sm" | "md";

export type PaginationProps = Omit<React.ComponentProps<"nav">, "onChange"> & {
  /** The current page, starting at 1. Use with onPageChange to control it. */
  page?: number;
  defaultPage?: number;
  onPageChange?: (page: number) => void;
  /** Total number of items. Enables the summary and the page size select. */
  total?: number;
  /** Number of pages, when you don't know the item count. Ignored when total is set. */
  pageCount?: number;
  pageSize?: number;
  defaultPageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  /** Page sizes to offer. Pass two or more to show the select. */
  pageSizeOptions?: number[];
  /** Pages either side of the current one. */
  siblings?: number;
  /** "full" shows numbered pages; "compact" shows an editable page field between the arrows. */
  variant?: "full" | "compact";
  size?: Size;
  /** The "Showing 21–40 of 312" line. Pass a function to word it yourself, or false to hide it. */
  summary?: boolean | ((range: { from: number; to: number; total: number }) => React.ReactNode);
  /** What the items are called, for the summary: "invoices". */
  itemName?: string;
  /** Render pages as real links. Clicks still call onPageChange. */
  getPageHref?: (page: number) => string;
  /** How far an ellipsis jumps. */
  jump?: number;
  disabled?: boolean;
};

export function Pagination({
  page: pageProp,
  defaultPage = 1,
  onPageChange,
  total,
  pageCount: pageCountProp,
  pageSize: pageSizeProp,
  defaultPageSize,
  onPageSizeChange,
  pageSizeOptions,
  siblings = 1,
  variant = "full",
  size = "md",
  summary = true,
  itemName = "results",
  getPageHref,
  jump = 5,
  disabled = false,
  className,
  ...rest
}: PaginationProps) {
  const [pageSize, setPageSize] = useControllableState({ value: pageSizeProp, defaultValue: defaultPageSize ?? pageSizeOptions?.[0] ?? 20, onChange: onPageSizeChange });
  const pageCount = Math.max(1, total !== undefined ? Math.ceil(total / pageSize) : (pageCountProp ?? 1));
  const [rawPage, setRawPage] = useControllableState({ value: pageProp, defaultValue: defaultPage, onChange: onPageChange });
  const page = Math.min(Math.max(1, rawPage), pageCount);
  const go = (next: number) => setRawPage(Math.min(Math.max(1, next), pageCount));

  // Changing the page size keeps the first row you were looking at on screen.
  const changePageSize = (next: number) => {
    const first = (page - 1) * pageSize;
    setPageSize(next);
    setRawPage(Math.floor(first / next) + 1);
  };

  const showSummary = summary !== false && total !== undefined;
  const showSizes = !!pageSizeOptions && pageSizeOptions.length > 1 && total !== undefined;
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = total ? Math.min(total, page * pageSize) : 0;

  return (
    <nav
      aria-label="Pagination"
      data-variant={variant}
      data-size={size}
      data-disabled={disabled || undefined}
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-2.5 text-fg", className)}
      {...rest}
    >
      {(showSummary && variant === "full") || showSizes ? (
        // Where you are and how much you see sit together; the pages take the other end, and
        // move to their own line, still flush right, when the row gets too narrow.
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          {showSummary && variant === "full" && (
            <Summary from={from} to={to} total={total} itemName={itemName} render={typeof summary === "function" ? summary : undefined} />
          )}
          {showSizes && <PageSizeSelect value={pageSize} options={pageSizeOptions} onChange={changePageSize} size={size} disabled={disabled} />}
        </div>
      ) : null}
      <div className="ml-auto flex">
        {variant === "full" ? (
          <PageList page={page} pageCount={pageCount} siblings={siblings} size={size} jump={jump} disabled={disabled} getPageHref={getPageHref} onGo={go} />
        ) : (
          <CompactPager page={page} pageCount={pageCount} size={size} disabled={disabled} getPageHref={getPageHref} onGo={go} />
        )}
      </div>
    </nav>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Summary: the range rolls instead of flashing
 * -----------------------------------------------------------------------------------------------*/

function Summary({ from, to, total, itemName, render }: { from: number; to: number; total: number; itemName: string; render?: (r: { from: number; to: number; total: number }) => React.ReactNode }) {
  const custom = render?.({ from, to, total });
  const n = new Intl.NumberFormat("en-US").format(total);
  // The widest the line can get sits invisibly in the same cell, so the select beside it never
  // shuffles sideways when the range goes from 1–20 to 301–312.
  const widest = `Showing ${n}–${n} of ${n} ${itemName}`;
  return (
    <p role="status" aria-live="polite" aria-atomic className="grid min-w-0 text-[12.5px] text-fg-3 tabular">
      {!custom && (
        <span aria-hidden className="invisible col-start-1 row-start-1 h-0 overflow-hidden whitespace-nowrap">
          {widest}
        </span>
      )}
      <span className="col-start-1 row-start-1">
      {custom ??
        (total === 0 ? (
          <>No {itemName}</>
        ) : (
          <>
            Showing{" "}
            <span className="text-fg-2">
              <NumberFlow value={from} locales="en-US" willChange />–<NumberFlow value={to} locales="en-US" willChange />
            </span>{" "}
            of <span className="text-fg-2">{n}</span> {itemName}
          </>
        ))}
      </span>
    </p>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Numbered pages with one pill that slides between them
 * -----------------------------------------------------------------------------------------------*/

const pressable = cn(
  "relative inline-flex shrink-0 select-none items-center justify-center font-medium outline-none",
  "touch-manipulation [-webkit-tap-highlight-color:transparent]",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
  "transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.94] active:duration-75",
  "aria-disabled:pointer-events-none aria-disabled:text-fg-4",
  // 44px tall hit area on touch without changing the drawing.
  "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.5 pointer-coarse:after:content-['']",
);

const cell = (size: Size) => (size === "sm" ? "h-7 min-w-7 rounded-md px-1.5 text-[12px]" : "h-8 min-w-8 rounded-lg px-2 text-[13px]");

type PagerProps = {
  page: number;
  pageCount: number;
  size: Size;
  disabled: boolean;
  getPageHref?: (page: number) => string;
  onGo: (page: number) => void;
};

function PageList({ page, pageCount, siblings, size, jump, disabled, getPageHref, onGo }: PagerProps & { siblings: number; jump: number }) {
  const items = usePagination({ page, pageCount, siblings });
  const reduce = useReducedMotion();
  const id = useId();
  // A page chosen from the keyboard renders on the same frame; a click glides.
  const [instant, setInstant] = useState(false);
  const go = (next: number, e: React.MouseEvent) => {
    setInstant(e.detail === 0);
    onGo(next);
  };

  const slide: Transition = instant ? { duration: 0 } : reduce ? { duration: 0.15, ease: ease.out } : spring.snappy;

  return (
    <div className={cn("flex items-center", size === "sm" ? "gap-0.5" : "gap-1")}>
      <Arrow dir="prev" page={page} pageCount={pageCount} size={size} disabled={disabled} getPageHref={getPageHref} onGo={go} />
      <LayoutGroup id={id}>
        <ul className={cn("relative flex items-center", size === "sm" ? "gap-0.5" : "gap-1")}>
          <AnimatePresence initial={false} mode="popLayout">
            {items.map((item) => (
              <motion.li
                key={item}
                layout={reduce || instant ? false : "position"}
                initial={{ opacity: 0, scale: reduce ? 1 : 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: reduce ? 1 : 0.8, transition: { duration: instant ? 0 : 0.1 } }}
                transition={slide}
                className="flex"
              >
                {typeof item === "number" ? (
                  <PageButton value={item} current={item === page} size={size} disabled={disabled} href={getPageHref?.(item)} pillId={`${id}-pill`} slide={slide} onGo={go} />
                ) : (
                  <Ellipsis
                    dir={item === "start-ellipsis" ? -1 : 1}
                    target={Math.min(Math.max(1, page + (item === "start-ellipsis" ? -jump : jump)), pageCount)}
                    jump={jump}
                    size={size}
                    disabled={disabled}
                    onGo={go}
                  />
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </LayoutGroup>
      <Arrow dir="next" page={page} pageCount={pageCount} size={size} disabled={disabled} getPageHref={getPageHref} onGo={go} />
    </div>
  );
}

type Go = (page: number, e: React.MouseEvent) => void;

function PageButton({ value, current, size, disabled, href, pillId, slide, onGo }: { value: number; current: boolean; size: Size; disabled: boolean; href?: string; pillId: string; slide: Transition; onGo: Go }) {
  const Tag = href && !disabled ? "a" : "button";
  return (
    <Tag
      {...(Tag === "a" ? { href } : { type: "button" as const })}
      aria-current={current ? "page" : undefined}
      aria-label={`Page ${value}`}
      aria-disabled={disabled || undefined}
      data-state={current ? "active" : "inactive"}
      onClick={(e: React.MouseEvent) => {
        if (disabled || current) return;
        onGo(value, e);
      }}
      className={cn(pressable, cell(size), "tabular", current ? "text-fg" : "text-fg-2 hover:bg-hover hover:text-fg")}
    >
      {current && (
        <motion.span
          layoutId={pillId}
          transition={slide}
          aria-hidden
          className={cn("absolute inset-0 border border-line-2 bg-raised shadow-[var(--shadow)]", size === "sm" ? "rounded-md" : "rounded-lg")}
        />
      )}
      <span className="relative">{value}</span>
    </Tag>
  );
}

// An ellipsis is also a shortcut: it jumps a few pages in its direction, and says so on hover and focus.
function Ellipsis({ dir, target, jump, size, disabled, onGo }: { dir: -1 | 1; target: number; jump: number; size: Size; disabled: boolean; onGo: Go }) {
  return (
    <button
      type="button"
      aria-label={dir < 0 ? `Back ${jump} pages, to page ${target}` : `Forward ${jump} pages, to page ${target}`}
      aria-disabled={disabled || undefined}
      onClick={(e) => !disabled && onGo(target, e)}
      className={cn(pressable, cell(size), "group/jump text-fg-3 hover:bg-hover hover:text-fg")}
    >
      <span className="relative grid size-4 place-items-center">
        <MoreH
          size={16}
          className="absolute transition-[opacity,scale] duration-150 ease-out group-hover/jump:scale-75 group-hover/jump:opacity-0 group-focus-visible/jump:scale-75 group-focus-visible/jump:opacity-0"
        />
        <svg
          width={16}
          height={16}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={cn(
            "absolute scale-75 opacity-0 transition-[opacity,scale] duration-150 ease-out",
            "group-hover/jump:scale-100 group-hover/jump:opacity-100 group-focus-visible/jump:scale-100 group-focus-visible/jump:opacity-100",
          )}
        >
          <path d={dir < 0 ? "M12 4.5 8.5 8l3.5 3.5M7.5 4.5 4 8l3.5 3.5" : "m4 4.5 3.5 3.5L4 11.5M8.5 4.5 12 8l-3.5 3.5"} />
        </svg>
      </span>
    </button>
  );
}

function Arrow({ dir, page, pageCount, size, disabled, getPageHref, onGo }: Omit<PagerProps, "onGo"> & { dir: "prev" | "next"; onGo: Go }) {
  const target = dir === "prev" ? page - 1 : page + 1;
  // aria-disabled rather than disabled: at the first or last page the button keeps focus
  // instead of dropping it to the body under the keyboard user's feet.
  const off = disabled || target < 1 || target > pageCount;
  const href = !off ? getPageHref?.(target) : undefined;
  const Tag = href ? "a" : "button";
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <Tag
      {...(Tag === "a" ? { href, rel: dir } : { type: "button" as const })}
      aria-label={dir === "prev" ? "Previous page" : "Next page"}
      aria-disabled={off || undefined}
      onClick={(e: React.MouseEvent) => {
        if (off) return e.preventDefault();
        onGo(target, e);
      }}
      className={cn(pressable, cell(size), "group/arrow px-0 text-fg-2 hover:bg-hover hover:text-fg aria-disabled:pointer-events-auto aria-disabled:cursor-not-allowed aria-disabled:active:scale-100 aria-disabled:hover:bg-transparent")}
    >
      <Icon
        size={size === "sm" ? 14 : 16}
        className={cn(
          "transition-transform duration-150 ease-out motion-reduce:transition-none group-aria-disabled/arrow:translate-x-0",
          dir === "prev" ? "group-hover/arrow:-translate-x-px" : "group-hover/arrow:translate-x-px",
        )}
      />
    </Tag>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Compact: arrows around an editable page field
 * -----------------------------------------------------------------------------------------------*/

function CompactPager({ page, pageCount, size, disabled, getPageHref, onGo }: PagerProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const digits = String(pageCount).length;

  const commit = () => {
    if (draft === null) return;
    const n = Number.parseInt(draft, 10);
    // Out of range clamps to the nearest page; nonsense puts the old page back.
    if (Number.isFinite(n)) onGo(Math.min(Math.max(1, n), pageCount));
    setDraft(null);
  };

  return (
    <div className={cn("flex items-center", size === "sm" ? "gap-1" : "gap-1.5")}>
      <Arrow dir="prev" page={page} pageCount={pageCount} size={size} disabled={disabled} getPageHref={getPageHref} onGo={(p) => onGo(p)} />
      <label className={cn("flex items-center gap-1.5 text-fg-3 tabular", size === "sm" ? "text-[12px]" : "text-[12.5px]")}>
        <span>Page</span>
        <input
          ref={inputRef}
          value={draft ?? String(page)}
          disabled={disabled}
          inputMode="numeric"
          enterKeyHint="go"
          autoComplete="off"
          aria-label={`Page, of ${pageCount}`}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, digits))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit();
              inputRef.current?.select();
            } else if (e.key === "Escape" && draft !== null) {
              e.preventDefault();
              setDraft(null);
            } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              setDraft(null);
              onGo(Math.min(Math.max(1, page + (e.key === "ArrowUp" ? 1 : -1)), pageCount));
            }
          }}
          style={{ width: `calc(${Math.max(2, digits)}ch + ${size === "sm" ? 14 : 18}px)` }}
          className={cn(
            "rounded-md border border-line-2 bg-raised text-center font-medium text-fg shadow-[var(--shadow)] tabular outline-none",
            "transition-[border-color,box-shadow] duration-150 ease-out hover:border-fg-4 focus:border-fg-4 focus:ring-3 focus:ring-fg/10",
            "disabled:opacity-50",
            // 16px on touch so the phone doesn't zoom in on focus.
            size === "sm" ? "h-7 text-base sm:text-[12px]" : "h-8 text-base sm:text-[13px]",
          )}
        />
        <span className="whitespace-nowrap">
          of <span className="text-fg-2">{new Intl.NumberFormat("en-US").format(pageCount)}</span>
        </span>
      </label>
      <Arrow dir="next" page={page} pageCount={pageCount} size={size} disabled={disabled} getPageHref={getPageHref} onGo={(p) => onGo(p)} />
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Page size
 * -----------------------------------------------------------------------------------------------*/

function PageSizeSelect({ value, options, onChange, size, disabled }: { value: number; options: number[]; onChange: (n: number) => void; size: Size; disabled: boolean }) {
  const items = options.map((n) => ({ value: n, label: `${n} per page` }));
  return (
    <Select.Root items={items} value={value} onValueChange={(v) => v !== null && onChange(v as number)} disabled={disabled}>
      <Select.Trigger
        aria-label="Items per page"
        className={cn(
          "group/size relative inline-flex shrink-0 select-none items-center border border-line-2 bg-raised text-fg-2 shadow-[var(--shadow)] outline-none tabular",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.97] active:duration-75",
          "hover:border-fg-4 hover:bg-hover hover:text-fg data-popup-open:border-fg-4 data-popup-open:bg-hover data-popup-open:text-fg",
          "data-disabled:pointer-events-none data-disabled:opacity-50",
          "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.5 pointer-coarse:after:content-['']",
          size === "sm" ? "h-7 gap-1 rounded-md pr-1 pl-2 text-[12px]" : "h-8 gap-1.5 rounded-lg pr-1.5 pl-2.5 text-[12.5px]",
        )}
      >
        <Select.Value />
        <Select.Icon className="flex text-fg-4 transition-colors duration-150 group-hover/size:text-fg-3">
          <ChevronsUpDown size={14} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={6} collisionPadding={8} className="z-(--z-popover) outline-none select-none">
          <Select.Popup
            className={cn(
              "relative min-w-(--anchor-width) origin-(--transform-origin) overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
              "transition-[opacity,scale] duration-160 ease-out-expo data-ending-style:duration-100 data-ending-style:ease-out",
              "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0",
              // Laid over the trigger, Base UI lines the chosen row up with the value; a scale would skew that, so it only fades.
              "data-[side=none]:data-starting-style:scale-100 data-[side=none]:data-ending-style:scale-100 data-[side=none]:min-w-[calc(var(--anchor-width)+0.5rem)]",
              "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
            )}
          >
            <GlideList>
              {items.map((item) => (
                <Select.Item
                  key={item.value}
                  value={item.value}
                  className="relative z-[1] flex h-8 cursor-default scroll-my-1 items-center gap-2 rounded-lg pr-2 pl-2.5 text-[13px] text-fg outline-none select-none tabular pointer-coarse:h-10"
                >
                  <Select.ItemText className="flex-1">{item.label}</Select.ItemText>
                  <span className="grid size-4 place-items-center">
                    <Select.ItemIndicator>
                      <Check size={14} />
                    </Select.ItemIndicator>
                  </span>
                </Select.Item>
              ))}
            </GlideList>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

// One highlight for the whole list: it springs after the pointer and jumps for arrow keys.
function GlideList({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const [list, setList] = useState<HTMLDivElement | null>(null);
  const y = useMotionValue(0);
  const height = useMotionValue(32);
  const opacity = useMotionValue(0);

  useEffect(() => {
    if (!list) return;
    let keyboard = false;
    let shown = false;
    const place = () => {
      const el = list.querySelector<HTMLElement>("[data-highlighted]");
      if (!el) {
        shown = false;
        animate(opacity, 0, { duration: reduce ? 0 : 0.12 });
        return;
      }
      if (!shown || keyboard || reduce) {
        y.jump(el.offsetTop);
        height.jump(el.offsetHeight);
        animate(opacity, 1, { duration: keyboard || reduce ? 0 : 0.08 });
      } else {
        animate(y, el.offsetTop, spring.follow);
        animate(height, el.offsetHeight, spring.follow);
      }
      shown = true;
    };
    const onKey = () => (keyboard = true);
    const onPointer = () => (keyboard = false);
    const observer = new MutationObserver(place);
    observer.observe(list, { subtree: true, attributes: true, attributeFilter: ["data-highlighted"] });
    document.addEventListener("keydown", onKey, true);
    list.addEventListener("pointermove", onPointer);
    place();
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKey, true);
      list.removeEventListener("pointermove", onPointer);
    };
  }, [list, reduce, y, height, opacity]);

  return (
    <Select.List ref={setList} className="relative max-h-(--available-height) overflow-y-auto overscroll-contain p-1 outline-none">
      <motion.div aria-hidden style={{ y, height, opacity }} className="pointer-events-none absolute inset-x-1 top-0 rounded-lg bg-fg/[0.06]" />
      {children}
    </Select.List>
  );
}
