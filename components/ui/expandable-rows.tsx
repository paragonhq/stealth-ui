"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type ExpandableColumn<T> = {
  key: string;
  header: React.ReactNode;
  cell?: (row: T) => React.ReactNode;
  numeric?: boolean;
  width?: number | string;
  className?: string;
};

export type ExpandableRowsProps<T> = Omit<React.ComponentProps<"div">, "children" | "defaultValue"> & {
  columns: ExpandableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Names each toggle: "Show details for {label}". Defaults to the row id. */
  getRowLabel?: (row: T) => string;
  /** The panel under an open row. Return null for rows with nothing more to show; they get no toggle. */
  renderDetail: (row: T) => React.ReactNode;
  caption: string;
  expanded?: string[];
  defaultExpanded?: string[];
  onExpandedChange?: (expanded: string[]) => void;
  /** Only one row open at a time: opening one closes the last. */
  single?: boolean;
  /** Pressing anywhere on a row toggles it. Links and buttons inside the row keep their own click. */
  rowClickExpands?: boolean;
  empty?: React.ReactNode;
  size?: "sm" | "md";
  minWidth?: number;
};

const interactive = "a,button,input,select,textarea,label,[role=checkbox],[data-row-expand-ignore]";

export function ExpandableRows<T>({
  columns,
  rows,
  getRowId,
  getRowLabel,
  renderDetail,
  caption,
  expanded: expandedProp,
  defaultExpanded = [],
  onExpandedChange,
  single = false,
  rowClickExpands = true,
  empty = "Nothing here yet",
  size = "md",
  minWidth,
  className,
  ...rest
}: ExpandableRowsProps<T>) {
  const [expanded, setExpanded] = useControllableState({ value: expandedProp, defaultValue: defaultExpanded, onChange: onExpandedChange });
  const open = useMemo(() => new Set(expanded), [expanded]);
  // Rows whose panel is on screen, including while it closes. The row's own divider waits for the
  // panel to finish collapsing, so the two never show a double line.
  const [mounted, setMounted] = useState<Set<string>>(() => new Set(defaultExpanded.concat(expandedProp ?? [])));
  const captionId = useId();
  const baseId = useId();
  const reduce = useReducedMotion();
  const h = size === "sm" ? "h-8" : "h-10";
  const root = useRef<HTMLDivElement>(null);
  // The visible width of the table. Panels pin to it, so on a phone that scrolls the table
  // sideways the details stay readable instead of running off past the edge.
  const [visible, setVisible] = useState<number>();
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = (el: HTMLDivElement) => {
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  };
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setVisible(el.clientWidth);
      measure(el);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Panels opened by a person (not on first paint), which should be brought into view once they finish growing.
  const reveal = useRef(new Set<string>());

  // If an opened panel ends below the fold of a scrolling table, scroll just enough to show it,
  // never so far that its own row slides under the header.
  const bringIntoView = (panel: HTMLElement) => {
    const box = root.current;
    if (!box || box.scrollHeight <= box.clientHeight) return;
    const b = box.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const head = box.querySelector("thead")?.getBoundingClientRect().height ?? 0;
    const row = (panel.closest("tr")?.previousElementSibling as HTMLElement | null)?.getBoundingClientRect().height ?? 0;
    const overflow = p.bottom - b.bottom + 8;
    const room = p.top - row - (b.top + head);
    const delta = Math.min(overflow, room);
    if (delta > 0) box.scrollBy({ top: delta, behavior: reduce ? "auto" : "smooth" });
  };

  const details = useMemo(() => new Map(rows.map((r) => [getRowId(r), renderDetail(r)])), [rows, getRowId, renderDetail]);
  const expandable = useMemo(() => rows.map(getRowId).filter((id) => details.get(id) != null), [rows, getRowId, details]);
  const allOpen = expandable.length > 0 && expandable.every((id) => open.has(id));

  const toggle = useCallback(
    (id: string, force?: boolean) => {
      const next = force ?? !open.has(id);
      if (next === open.has(id)) return;
      if (next) {
        reveal.current.add(id);
        setMounted((m) => new Set(m).add(id));
      }
      setExpanded(next ? (single ? [id] : [...expanded, id]) : expanded.filter((e) => e !== id));
    },
    [open, expanded, single, setExpanded],
  );

  const toggleAll = () => {
    if (allOpen) setExpanded([]);
    else {
      setMounted((m) => new Set([...m, ...expandable]));
      setExpanded(expandable);
    }
  };

  const unmount = (id: string) =>
    setMounted((m) => {
      if (!m.has(id)) return m;
      const next = new Set(m);
      next.delete(id);
      return next;
    });

  return (
    <div data-size={size} className={cn("relative flex flex-col overflow-hidden rounded-xl border border-line bg-frame", className)} {...rest}>
      <div ref={root} onScroll={(e) => measure(e.currentTarget)} className="max-h-[inherit] min-h-0 flex-1 overflow-auto overscroll-contain">
        <table aria-labelledby={captionId} style={{ minWidth }} className="w-full border-separate border-spacing-0 text-[13px]">
          <caption id={captionId} className="sr-only">
            {caption}
          </caption>
          <colgroup>
            <col style={{ width: 40 }} />
            {columns.map((c) => (
              <col key={c.key} style={c.width != null ? { width: c.width } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className={cn("sticky top-0 z-(--z-sticky) border-b border-line bg-frame p-0", size === "sm" ? "h-8" : "h-9")}>
                {!single && expandable.length > 1 ? (
                  <span className="flex justify-center">
                    <Toggle open={allOpen} onPress={toggleAll} label={allOpen ? "Collapse all rows" : "Expand all rows"} />
                  </span>
                ) : (
                  <span className="sr-only">Details</span>
                )}
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "sticky top-0 z-(--z-sticky) whitespace-nowrap border-b border-line bg-frame px-3 text-[12px] font-medium text-fg-3",
                    size === "sm" ? "h-8" : "h-9",
                    col.numeric ? "text-right" : "text-left",
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = getRowId(row);
              const detail = details.get(id);
              const isOpen = open.has(id);
              const panelId = `${baseId}-${id}`;
              const hasPanel = isOpen || mounted.has(id);
              return (
                <Fragment key={id}>
                  <tr
                    data-state={isOpen ? "open" : "closed"}
                    onClick={(e) => {
                      if (!rowClickExpands || detail == null || (e.target as HTMLElement).closest(interactive)) return;
                      if (window.getSelection()?.toString()) return;
                      toggle(id);
                      // Focus follows to the toggle, without a ring, so the arrow keys carry on from here.
                      e.currentTarget.querySelector<HTMLElement>("[aria-expanded]")?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
                    }}
                    className={cn(
                      "group/row transition-colors duration-150",
                      isOpen ? "bg-hover" : "hover:bg-hover",
                    )}
                  >
                    <td className={cn("border-line p-0 text-center", h, hasPanel ? "border-b-0" : "border-b group-last/row:border-b-0")}>
                      {detail != null && (
                        <span className="flex justify-center">
                          <Toggle
                            open={isOpen}
                            onPress={() => toggle(id)}
                            onKey={(key) => (key === "ArrowRight" ? toggle(id, true) : toggle(id, false))}
                            controls={panelId}
                            label={`${isOpen ? "Hide" : "Show"} details for ${getRowLabel ? getRowLabel(row) : id}`}
                          />
                        </span>
                      )}
                    </td>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "border-line px-3 text-fg",
                          h,
                          hasPanel ? "border-b-0" : "border-b group-last/row:border-b-0",
                          col.numeric ? "whitespace-nowrap text-right tabular" : "text-left",
                          col.className,
                        )}
                      >
                        {col.cell ? col.cell(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                  <AnimatePresence initial={false} onExitComplete={() => unmount(id)}>
                    {isOpen && detail != null && (
                      <tr key="detail" className="group/detail bg-hover">
                        <td colSpan={columns.length + 1} className="border-b border-line p-0 [tr:last-child>&]:border-b-0">
                          <motion.div
                            id={panelId}
                            role="region"
                            aria-label={`Details for ${getRowLabel ? getRowLabel(row) : id}`}
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            exit={{ height: 0, transition: { duration: reduce ? 0 : 0.2, ease: ease.inOut } }}
                            transition={{ duration: reduce ? 0 : 0.28, ease: ease.inOut }}
                            onAnimationComplete={() => {
                              if (!reveal.current.delete(id)) return;
                              const panel = document.getElementById(panelId);
                              if (panel) bringIntoView(panel);
                            }}
                            className="overflow-hidden"
                          >
                            {/* The content settles a beat behind the height, so it reads as revealed rather than squeezed. */}
                            <motion.div
                              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, transition: { duration: 0.12 } }}
                              transition={{ duration: reduce ? 0.15 : 0.26, ease: ease.out, delay: reduce ? 0 : 0.06 }}
                              style={{ maxWidth: visible }}
                              className="sticky left-0 pb-3.5 pl-[52px] pr-4 pt-0.5"
                            >
                              {detail}
                            </motion.div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="h-32 px-4 text-center text-[13px] text-fg-3">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* More columns past the edge: a soft shadow says so. */}
      <div aria-hidden className={cn("pointer-events-none absolute inset-y-0 left-0 z-(--z-sticky) w-4 bg-linear-to-r from-overlay to-transparent transition-opacity duration-200", edges.left ? "opacity-50" : "opacity-0")} />
      <div aria-hidden className={cn("pointer-events-none absolute inset-y-0 right-0 z-(--z-sticky) w-4 bg-linear-to-l from-overlay to-transparent transition-opacity duration-200", edges.right ? "opacity-50" : "opacity-0")} />
    </div>
  );
}

function Toggle({
  open,
  onPress,
  onKey,
  controls,
  label,
}: {
  open: boolean;
  onPress: () => void;
  onKey?: (key: "ArrowRight" | "ArrowLeft") => void;
  controls?: string;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={open ? controls : undefined}
      aria-label={label}
      data-state={open ? "open" : "closed"}
      onClick={onPress}
      onKeyDown={(e) => {
        // Right opens and Left closes, as in a tree; Enter and Space toggle as any button does.
        if (onKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
          e.preventDefault();
          onKey(e.key);
        }
      }}
      className={cn(
        "group/toggle relative grid size-6 place-items-center rounded-md text-fg-3 outline-none",
        "transition-[background-color,color,scale] duration-150 hover:bg-fg/5 hover:text-fg active:scale-[0.9] data-[state=open]:text-fg",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
        "after:absolute after:-inset-2.5 after:content-['']",
      )}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="transition-transform duration-200 ease-out-expo group-data-[state=open]/toggle:rotate-90 motion-reduce:transition-none"
      >
        <path d="m6.25 4.5 3.5 3.5-3.5 3.5" />
      </svg>
    </button>
  );
}
