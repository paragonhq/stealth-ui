"use client";
import { NumberField } from "@base-ui/react/number-field";
import { Select } from "@base-ui/react/select";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown, Loader } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/* -------------------------------------------------------------------------------------------------
 * Headless state
 * -----------------------------------------------------------------------------------------------*/

export type UseTablePaginationOptions = {
  total?: number;
  page?: number;
  defaultPage?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  defaultPageSize?: number;
  onPageSizeChange?: (size: number) => void;
};

/** Page and page size, both controllable, plus the numbers every footer needs. Pages are 1-based. */
export function useTablePagination({ total, page: pageProp, defaultPage = 1, onPageChange, pageSize: sizeProp, defaultPageSize = 25, onPageSizeChange }: UseTablePaginationOptions = {}) {
  const [rawPage, setRawPage] = useControllableState({ value: pageProp, defaultValue: defaultPage, onChange: onPageChange });
  const [pageSize, setRawSize] = useControllableState({ value: sizeProp, defaultValue: defaultPageSize, onChange: onPageSizeChange });
  const pageCount = total == null ? undefined : Math.max(1, Math.ceil(total / pageSize));
  // A page past the end (rows were deleted, a filter narrowed) reads as the last page.
  const page = pageCount ? clamp(rawPage, 1, pageCount) : Math.max(1, rawPage);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = total == null ? page * pageSize : Math.min(total, page * pageSize);

  const setPage = (next: number) => setRawPage(pageCount ? clamp(next, 1, pageCount) : Math.max(1, next));
  // Changing the size keeps the first visible row on screen instead of jumping back to page 1.
  const setPageSize = (size: number) => {
    const first = Math.max(0, from - 1);
    setRawSize(size);
    setRawPage(Math.floor(first / size) + 1);
  };

  return { page, pageSize, pageCount, from, to, setPage, setPageSize, slice: <T,>(rows: T[]) => rows.slice((page - 1) * pageSize, page * pageSize) };
}

/* -------------------------------------------------------------------------------------------------
 * The rows: a fast crossfade that leans the way you paged
 * -----------------------------------------------------------------------------------------------*/

export type TablePageTransitionProps = Omit<React.ComponentProps<"tbody">, "ref"> & {
  page: number;
  /** Render as a tbody (default) or a div for grid tables. */
  as?: "tbody" | "div";
};

// Wait mode keeps table layout honest: the old rows leave in 90ms, the new ones arrive
// in 160ms, drifting 6px from the side you paged towards.
export function TablePageTransition({ page, as = "tbody", className, children, ...rest }: TablePageTransitionProps) {
  const reduce = useReducedMotion();
  const [prev, setPrev] = useState(page);
  const [dir, setDir] = useState(1);
  if (page !== prev) {
    setDir(page > prev ? 1 : -1);
    setPrev(page);
  }
  const Tag = as === "tbody" ? motion.tbody : motion.div;
  return (
    <AnimatePresence mode="wait" initial={false} custom={dir}>
      <Tag
        key={page}
        custom={dir}
        variants={{
          enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * 6 }),
          show: { opacity: 1, x: 0, transition: { duration: reduce ? 0.1 : 0.16, ease: ease.out } },
          leave: (d: number) => (reduce ? { opacity: 0, transition: { duration: 0.06 } } : { opacity: 0, x: d * -4, transition: { duration: 0.09, ease: ease.in } }),
        }}
        initial="enter"
        animate="show"
        exit="leave"
        className={className}
        {...(rest as object)}
      >
        {children}
      </Tag>
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Footer
 * -----------------------------------------------------------------------------------------------*/

export type TablePaginationProps = Omit<React.ComponentProps<"nav">, "children"> &
  UseTablePaginationOptions & {
    /** Page sizes offered. Pass an empty array to hide the picker. */
    pageSizes?: number[];
    /** With no total (cursor pagination), whether there is a page after this one. */
    hasNextPage?: boolean;
    /** The requested page is loading: the button that asked for it shows a spinner in place of its arrow. */
    busy?: boolean;
    /** Plural noun for the range text and announcements. */
    itemLabel?: string;
    /** Show first and last page buttons. */
    edges?: boolean;
  };

export function TablePagination({
  total,
  page: pageProp,
  defaultPage,
  onPageChange,
  pageSize: sizeProp,
  defaultPageSize,
  onPageSizeChange,
  pageSizes = [10, 25, 50, 100],
  hasNextPage,
  busy = false,
  itemLabel = "rows",
  edges = true,
  className,
  "aria-label": ariaLabel = "Pagination",
  ...rest
}: TablePaginationProps) {
  const p = useTablePagination({ total, page: pageProp, defaultPage, onPageChange, pageSize: sizeProp, defaultPageSize, onPageSizeChange });
  const [pending, setPending] = useState<"first" | "prev" | "next" | "last" | null>(null);
  const empty = total === 0;
  const canPrev = !empty && p.page > 1;
  const canNext = !empty && (p.pageCount ? p.page < p.pageCount : !!hasNextPage);

  const go = (target: number, which: NonNullable<typeof pending>) => {
    // Paging again while a page loads just supersedes it; the latest request wins.
    setPending(which);
    p.setPage(target);
  };

  const fmt = new Intl.NumberFormat("en-US");
  const announce = empty
    ? `No ${itemLabel}`
    : `Page ${p.page}${p.pageCount ? ` of ${p.pageCount}` : ""}, ${itemLabel} ${fmt.format(p.from)} to ${fmt.format(p.to)}${total != null ? ` of ${fmt.format(total)}` : ""}`;

  return (
    <nav aria-label={ariaLabel} className={cn("@container flex min-h-11 w-full items-center gap-3 text-[12.5px] text-fg-2", className)} {...rest}>
      {pageSizes.length > 0 && (
        <PageSizeSelect value={p.pageSize} sizes={pageSizes} onChange={p.setPageSize} disabled={empty} />
      )}

      <p className="ml-auto flex items-center whitespace-nowrap tabular @max-sm:hidden" aria-hidden>
        {empty ? (
          <span>No {itemLabel}</span>
        ) : (
          <>
            <NumberFlow value={p.from} className="tabular text-fg" />
            <span className="px-0.5 text-fg-4">–</span>
            <NumberFlow value={p.to} className="tabular text-fg" />
            {total != null && (
              <>
                <span className="px-1 text-fg-3">of</span>
                <NumberFlow value={total} className="tabular" />
              </>
            )}
          </>
        )}
      </p>

      <div className="flex items-center gap-1 @max-sm:ml-auto">
        {edges && p.pageCount != null && (
          <PageButton label="First page" disabled={!canPrev} busy={busy && pending === "first"} onClick={() => go(1, "first")} className="@max-md:hidden">
            <EdgeGlyph side="first" />
          </PageButton>
        )}
        <PageButton label="Previous page" disabled={!canPrev} busy={busy && pending === "prev"} onClick={() => go(p.page - 1, "prev")}>
          <ChevronLeft size={16} />
        </PageButton>

        {p.pageCount != null ? (
          <PageJump page={p.page} pageCount={p.pageCount} disabled={empty} onCommit={(n) => go(n, n > p.page ? "next" : "prev")} />
        ) : (
          <span className="px-1.5 tabular text-fg">Page {p.page}</span>
        )}

        <PageButton label="Next page" disabled={!canNext} busy={busy && pending === "next"} onClick={() => go(p.page + 1, "next")}>
          <ChevronRight size={16} />
        </PageButton>
        {edges && p.pageCount != null && (
          <PageButton label="Last page" disabled={!canNext} busy={busy && pending === "last"} onClick={() => go(p.pageCount!, "last")} className="@max-md:hidden">
            <EdgeGlyph side="last" />
          </PageButton>
        )}
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </nav>
  );
}

// Only ever called from effects and timers.
const now = () => performance.now();

/** A spinner that waits 150ms before showing, then stays at least 300ms so it never flickers. */
function useSettledBusy(busy: boolean) {
  const [show, setShow] = useState(false);
  const shownAt = useRef(0);
  useEffect(() => {
    if (busy) {
      const t = window.setTimeout(() => {
        shownAt.current = now();
        setShow(true);
      }, 150);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setShow(false), Math.max(0, 300 - (now() - shownAt.current)));
    return () => window.clearTimeout(t);
  }, [busy]);
  return show;
}

function PageButton({ label, busy: busyProp, disabled, className, children, ...rest }: React.ComponentProps<"button"> & { label: string; busy: boolean }) {
  const reduce = useReducedMotion();
  const busy = useSettledBusy(busyProp);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-busy={busyProp || undefined}
      // Disabled rather than aria-disabled: at an edge there is nothing to do, and Tab shouldn't stop there.
      disabled={disabled}
      className={cn(
        "relative grid size-7 shrink-0 place-items-center rounded-md border border-line-2 bg-raised text-fg-2 shadow-[var(--shadow)] outline-none",
        "transition-[background-color,border-color,color,scale,opacity] duration-150 hover:border-fg-4 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none",
        "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
        busy && "text-fg",
        className,
      )}
      {...rest}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={busy ? "busy" : "idle"}
          className="grid place-items-center"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.14, ease: ease.out }}
        >
          {busy ? <Loader size={14} className="animate-spin-slow" /> : children}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function EdgeGlyph({ side }: { side: "first" | "last" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {side === "first" ? <path d="M10.25 4.5 6.75 8l3.5 3.5M4.25 4.5v7" /> : <path d="m5.75 4.5 3.5 3.5-3.5 3.5M11.75 4.5v7" />}
    </svg>
  );
}

// "Page [3] of 50": type a number and press Enter, or use the arrow keys to step.
function PageJump({ page, pageCount, disabled, onCommit }: { page: number; pageCount: number; disabled: boolean; onCommit: (page: number) => void }) {
  const [draft, setDraft] = useState<number | null>(page);
  const [synced, setSynced] = useState(page);
  if (page !== synced) {
    setSynced(page);
    setDraft(page);
  }
  const digits = String(pageCount).length;
  const commit = (v: number | null) => {
    // Empty or out-of-range input settles on the nearest real page.
    const next = v == null ? page : clamp(Math.round(v), 1, pageCount);
    setDraft(next);
    if (next !== page) onCommit(next);
  };

  return (
    <NumberField.Root
      value={draft}
      min={1}
      max={pageCount}
      disabled={disabled}
      onValueChange={(v) => setDraft(v)}
      onValueCommitted={commit}
      className="flex items-center gap-1.5 px-1 whitespace-nowrap"
    >
      <span className="text-fg-3 @max-sm:hidden">Page</span>
      <NumberField.Group>
        <NumberField.Input
          aria-label={`Page, of ${pageCount}`}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(draft);
          }}
          style={{ width: `calc(${digits}ch + 18px)` }}
          className={cn(
            "h-7 rounded-md border border-line-2 bg-frame px-2 text-center text-base text-fg tabular outline-none sm:text-[12.5px]",
            "transition-[border-color,box-shadow] duration-150 hover:border-fg-4 focus:border-fg-4 focus:ring-2 focus:ring-fg/10",
            "data-disabled:opacity-50",
          )}
        />
      </NumberField.Group>
      <span className="text-fg-3">
        of <span className="tabular">{pageCount.toLocaleString("en-US")}</span>
      </span>
    </NumberField.Root>
  );
}

function PageSizeSelect({ value, sizes, onChange, disabled }: { value: number; sizes: number[]; onChange: (n: number) => void; disabled: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Select.Root value={value} onValueChange={(v) => v != null && onChange(v as number)} disabled={disabled} items={sizes.map((s) => ({ value: s, label: String(s) }))}>
        <Select.Label className="whitespace-nowrap text-fg-3 @max-md:sr-only">Rows per page</Select.Label>
        <Select.Trigger
          className={cn(
            "group/size relative inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-line-2 bg-raised pl-2 pr-1 text-fg shadow-[var(--shadow)] outline-none",
            "transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] data-popup-open:border-fg-4 data-popup-open:bg-hover",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "data-disabled:pointer-events-none data-disabled:opacity-50",
            "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
          )}
        >
          <Select.Value className="min-w-[3ch] tabular">{(v: number) => <>{v}<span className="sr-only"> per page</span></>}</Select.Value>
          <Select.Icon className="text-fg-3 transition-colors group-hover/size:text-fg-2">
            <ChevronsUpDown size={14} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner side="top" align="start" sideOffset={6} alignItemWithTrigger={false} collisionPadding={8} className="z-(--z-dropdown) outline-none">
            <Select.Popup
              className={cn(
                "min-w-[max(5.5rem,var(--anchor-width))] rounded-xl border border-line-2 bg-raised p-1 text-fg shadow-pop outline-none",
                "origin-(--transform-origin) transition-[opacity,scale,translate] duration-180 ease-out-expo",
                "data-starting-style:scale-96 data-starting-style:opacity-0 data-[side=top]:data-starting-style:translate-y-1 data-[side=bottom]:data-starting-style:-translate-y-1",
                "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-120",
                "data-instant:duration-0 motion-reduce:scale-100 motion-reduce:translate-none",
              )}
            >
              <Select.List>
                {sizes.map((s) => (
                  <Select.Item
                    key={s}
                    value={s}
                    className="flex h-8 cursor-default select-none items-center gap-2 rounded-lg pl-2 pr-2.5 text-[13px] tabular outline-none transition-colors duration-100 data-highlighted:bg-hover"
                  >
                    <span className="grid size-3.5 place-items-center text-fg">
                      <Select.ItemIndicator className="grid place-items-center">
                        <Check size={14} />
                      </Select.ItemIndicator>
                    </span>
                    <Select.ItemText>{s}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
