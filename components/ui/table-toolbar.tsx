"use client";
import { Menu } from "@base-ui/react/menu";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Toolbar } from "@base-ui/react/toolbar";
import { Tooltip } from "@base-ui/react/tooltip";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Fragment, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Check, Download, Filter, Loader, Search, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/** Row heights for each density, in px. Put them on your rows and transition `height`. */
export const tableDensity = { compact: 32, comfortable: 44 } as const;
export type TableDensity = keyof typeof tableDensity;

const focusRing = "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3";

// Secondary button look shared by Filter and Export. Below a 448px toolbar the label
// drops to screen-reader-only and the button squares up around its icon.
const buttonClass = cn(
  "group/btn relative inline-flex h-8 shrink-0 select-none items-center justify-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium tracking-[-0.005em]",
  "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover data-popup-open:border-fg-4 data-popup-open:bg-hover",
  "transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.97] active:duration-75",
  "data-disabled:pointer-events-none data-disabled:opacity-50",
  "@max-md:w-8 @max-md:px-0",
  "before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden",
  focusRing,
);

const menuPopupClass = cn(
  "max-h-(--available-height) min-w-52 max-w-[min(18rem,var(--available-width))] overflow-y-auto overscroll-contain rounded-xl border border-line-2 bg-raised p-1 text-fg shadow-pop outline-none",
  "origin-(--transform-origin) transition-[opacity,scale,translate] duration-180 ease-out-expo",
  "data-starting-style:scale-96 data-starting-style:opacity-0 data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1",
  "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-120",
  "data-instant:duration-0 motion-reduce:scale-100 motion-reduce:translate-none",
);

const menuItemClass = cn(
  "flex h-8 cursor-default select-none items-center gap-2.5 rounded-lg px-2 text-[13px] outline-none",
  "transition-colors duration-100 data-highlighted:bg-hover data-disabled:opacity-50",
);

/* -------------------------------------------------------------------------------------------------
 * Root
 * -----------------------------------------------------------------------------------------------*/

export type TableToolbarProps = Omit<Toolbar.Root.Props, "className"> & { className?: string };

/** One tab stop for the whole bar; arrow keys move between its controls. */
export function TableToolbar({ className, ...rest }: TableToolbarProps) {
  return (
    <Tooltip.Provider delay={500} timeout={400}>
      <Toolbar.Root className={cn("@container flex w-full min-w-0 flex-wrap items-center gap-1.5", className)} {...rest} />
    </Tooltip.Provider>
  );
}

export function TableToolbarSeparator({ className, ...rest }: Omit<Toolbar.Separator.Props, "className"> & { className?: string }) {
  return <Toolbar.Separator className={cn("mx-0.5 h-4 w-px shrink-0 bg-line-2", className)} {...rest} />;
}

/* -------------------------------------------------------------------------------------------------
 * Search
 * -----------------------------------------------------------------------------------------------*/

export type TableToolbarSearchProps = Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "size"> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** A key that focuses the field from anywhere on the page. Pass null to turn it off. */
  shortcut?: string | null;
  /** Results are being fetched: the glass becomes a spinner in the same spot. */
  busy?: boolean;
};

export function TableToolbarSearch({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  shortcut = "/",
  busy = false,
  placeholder = "Search",
  className,
  ...rest
}: TableToolbarSearchProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const inputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== shortcut || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      // Single-key shortcuts never fire while someone is typing somewhere else.
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      // Consumed: nothing further up the page should also act on this key.
      e.preventDefault();
      e.stopPropagation();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shortcut]);

  return (
    <div
      data-busy={busy || undefined}
      className={cn(
        // Under 448px the field takes its own row so it stays wide enough to type in.
        "relative flex h-8 min-w-0 flex-1 items-center rounded-lg border @max-md:basis-full border-line-2 bg-raised shadow-[var(--shadow)]",
        "transition-[border-color,box-shadow] duration-150 hover:border-fg-4 focus-within:border-fg-4 focus-within:ring-2 focus-within:ring-fg/10",
        className,
      )}
    >
      <span className="pointer-events-none relative grid size-4 shrink-0 place-items-center pl-2.5 text-fg-4 box-content">
        <AnimatePresence initial={false}>
          <motion.span
            key={busy ? "busy" : "idle"}
            className="absolute inset-0 grid place-items-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            transition={spring.pop}
          >
            {busy ? <Loader size={14} className="animate-spin-slow text-fg-3" /> : <Search size={14} />}
          </motion.span>
        </AnimatePresence>
      </span>
      <Toolbar.Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          // Escape empties the field first; with nothing to clear it leaves focus alone for the page to handle.
          if (e.key === "Escape" && value) {
            e.preventDefault();
            setValue("");
          }
        }}
        placeholder={placeholder}
        aria-label={rest["aria-label"] ?? placeholder}
        aria-busy={busy || undefined}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        className="peer h-full min-w-0 flex-1 bg-transparent pl-2 pr-2 text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px] [&::-webkit-search-cancel-button]:hidden"
        {...rest}
      />
      {value ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Clear search"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
          className="relative mr-1.5 grid size-5 shrink-0 place-items-center rounded-md text-fg-3 outline-none transition-[color,background-color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.9] before:absolute before:-inset-3 before:content-[''] pointer-fine:before:hidden"
        >
          <X size={12} />
        </button>
      ) : (
        shortcut && (
          <kbd
            aria-hidden
            className="pointer-events-none mr-1.5 grid h-5 min-w-5 place-items-center rounded-[5px] border border-line-2 px-1 font-mono text-[11px] text-fg-3 transition-opacity duration-150 peer-focus:opacity-0 pointer-coarse:hidden"
          >
            {shortcut}
          </kbd>
        )
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Filter
 * -----------------------------------------------------------------------------------------------*/

export type TableToolbarFilterOption = { value: string; label: string; group?: string; count?: number };

export type TableToolbarFilterProps = {
  options: TableToolbarFilterOption[];
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  label?: string;
  className?: string;
};

export function TableToolbarFilter({ options, value: valueProp, defaultValue = [], onValueChange, label = "Filter", className }: TableToolbarFilterProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const reduce = useReducedMotion();
  const active = value.length;

  // Consecutive options with the same group share a heading.
  const groups: { name?: string; options: TableToolbarFilterOption[] }[] = [];
  for (const o of options) {
    const last = groups[groups.length - 1];
    if (last && last.name === o.group) last.options.push(o);
    else groups.push({ name: o.group, options: [o] });
  }

  return (
    <Menu.Root>
      <Toolbar.Button
        render={<Menu.Trigger />}
        aria-label={active ? `${label}, ${active} active` : label}
        className={cn(buttonClass, className)}
      >
        <Filter size={16} className="text-fg-2 transition-colors duration-150 group-hover/btn:text-fg group-data-popup-open/btn:text-fg" />
        <span className="@max-md:sr-only">{label}</span>
        <AnimatePresence initial={false}>
          {active > 0 && (
            // The badge grows its own width, so the search field beside it gives way smoothly instead of jumping.
            <motion.span
              key="badge"
              aria-hidden
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, width: 0, marginLeft: -6 }}
              animate={{ opacity: 1, scale: 1, width: "auto", marginLeft: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, width: 0, marginLeft: -6 }}
              transition={reduce ? { duration: 0.12 } : spring.snappy}
              className="flex h-4 items-center overflow-hidden @max-md:absolute @max-md:-right-1.5 @max-md:-top-1.5"
            >
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-fg px-1 text-[10.5px] font-medium leading-none text-frame tabular">
                <NumberFlow value={active} className="tabular" />
              </span>
            </motion.span>
          )}
        </AnimatePresence>
      </Toolbar.Button>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" sideOffset={6} collisionPadding={8} className="z-(--z-dropdown)">
          <Menu.Popup className={menuPopupClass}>
            {groups.map((g, gi) => (
              <Fragment key={g.name ?? gi}>
                {gi > 0 && <Menu.Separator className="mx-2 my-1 h-px bg-line" />}
                <Menu.Group>
                  {g.name && (
                    <Menu.GroupLabel className="px-2 pb-1 pt-1.5 font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">{g.name}</Menu.GroupLabel>
                  )}
                  {g.options.map((o) => {
                    const checked = value.includes(o.value);
                    return (
                      <Menu.CheckboxItem
                        key={o.value}
                        checked={checked}
                        onCheckedChange={(next) => setValue(next ? [...value, o.value] : value.filter((v) => v !== o.value))}
                        className={cn(menuItemClass, "group/item")}
                      >
                        <span
                          className={cn(
                            "grid size-3.5 shrink-0 place-items-center rounded-[4px] border transition-[background-color,border-color,scale] duration-150",
                            "group-active/item:scale-[0.86]",
                            checked ? "border-fg bg-fg text-frame" : "border-fg-4 bg-raised group-data-highlighted/item:border-fg-3",
                          )}
                        >
                          <DrawnTick on={checked} />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{o.label}</span>
                        {o.count != null && <span className="text-[12px] text-fg-4 tabular">{o.count}</span>}
                      </Menu.CheckboxItem>
                    );
                  })}
                </Menu.Group>
              </Fragment>
            ))}
            {active > 0 && (
              <>
                <Menu.Separator className="mx-2 my-1 h-px bg-line" />
                <Menu.Item onClick={() => setValue([])} closeOnClick={false} className={cn(menuItemClass, "text-fg-2 data-highlighted:text-fg")}>
                  <X size={14} className="ml-px text-fg-3" />
                  Clear filters
                </Menu.Item>
              </>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function DrawnTick({ on }: { on: boolean }) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden focusable="false" className="size-3.5">
      <motion.path
        d="M3.75 8.25 6.75 11.25 12.25 4.75"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
        transition={reduce ? { duration: 0 } : on ? { pathLength: { duration: 0.22, ease: ease.out }, opacity: { duration: 0.04 } } : { duration: 0.08 }}
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Segmented toggles: density and view
 * -----------------------------------------------------------------------------------------------*/

export type TableToolbarToggleOption = { value: string; label: string; icon: React.ReactNode };

export type TableToolbarToggleProps = {
  options: TableToolbarToggleOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Names the group for screen readers, e.g. "Density". */
  "aria-label": string;
  className?: string;
};

/** Icon-only segmented control. One pill slides between the options; each has a tooltip. */
export function TableToolbarToggle({ options, value: valueProp, defaultValue, onValueChange, className, ...rest }: TableToolbarToggleProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue: defaultValue ?? options[0]?.value ?? "", onChange: onValueChange });
  const reduce = useReducedMotion();
  const pillId = useId();

  return (
    <ToggleGroup
      value={[value]}
      // A segmented control always has one choice: pressing the current one keeps it.
      onValueChange={(next) => next[0] && setValue(next[0])}
      aria-label={rest["aria-label"]}
      className={cn("flex h-8 shrink-0 items-center rounded-lg border border-line-2 bg-frame p-0.5 shadow-[var(--shadow)]", className)}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Tooltip.Root key={o.value}>
            <Tooltip.Trigger
              render={
                <Toolbar.Button
                  render={<Toggle value={o.value} />}
                  aria-label={o.label}
                  className={cn(
                    "relative grid h-full w-7 place-items-center rounded-md text-fg-3 transition-[color,scale] duration-150",
                    "hover:text-fg-2 data-pressed:text-fg active:scale-[0.92] active:duration-75",
                    "before:absolute before:-inset-x-0.5 before:-inset-y-2 before:content-[''] pointer-fine:before:hidden",
                    "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                  )}
                />
              }
            >
              {on && (
                <motion.span
                  layoutId={pillId}
                  aria-hidden
                  transition={reduce ? { duration: 0 } : spring.snappy}
                  className="absolute inset-0 rounded-md bg-raised shadow-[var(--shadow)] ring-1 ring-line-2"
                />
              )}
              <span className="relative">{o.icon}</span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner side="top" sideOffset={8} collisionPadding={8} className="z-(--z-tooltip)">
                <Tooltip.Popup
                  className={cn(
                    "rounded-lg border border-line-2 bg-raised px-2 py-[3px] text-[12px] leading-4 text-fg shadow-pop outline-none",
                    "origin-(--transform-origin) transition-[opacity,scale,translate] duration-150 ease-out-expo",
                    "data-starting-style:scale-96 data-starting-style:translate-y-0.5 data-starting-style:opacity-0",
                    "data-ending-style:opacity-0 data-ending-style:duration-100 data-instant:transition-none",
                  )}
                >
                  {o.label}
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        );
      })}
    </ToggleGroup>
  );
}

export type TableToolbarDensityProps = Omit<TableToolbarToggleProps, "options" | "value" | "defaultValue" | "onValueChange" | "aria-label"> & {
  value?: TableDensity;
  defaultValue?: TableDensity;
  onValueChange?: (value: TableDensity) => void;
  "aria-label"?: string;
};

export function TableToolbarDensity({ onValueChange, defaultValue = "comfortable", ...rest }: TableToolbarDensityProps) {
  return (
    <TableToolbarToggle
      aria-label="Row density"
      options={[
        { value: "compact", label: "Compact rows", icon: <DensityGlyph gap={2.5} /> },
        { value: "comfortable", label: "Comfortable rows", icon: <DensityGlyph gap={4} /> },
      ]}
      defaultValue={defaultValue}
      onValueChange={(v) => onValueChange?.(v as TableDensity)}
      {...rest}
    />
  );
}

// Lines spaced like the rows they stand for: four tight or three loose.
function DensityGlyph({ gap }: { gap: number }) {
  const count = gap < 3 ? 4 : 3;
  const top = 8 - ((count - 1) * gap) / 2;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden focusable="false">
      {Array.from({ length: count }, (_, i) => (
        <path key={i} d={`M3 ${top + i * gap}h10`} />
      ))}
    </svg>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Export
 * -----------------------------------------------------------------------------------------------*/

export type TableToolbarExportFormat = { value: string; label: string; hint?: string };
type ExportState = "idle" | "busy" | "done" | "failed";
// Only ever called from event handlers and timers.
const now = () => performance.now();

export type TableToolbarExportProps = {
  formats?: TableToolbarExportFormat[];
  /** Runs the export. Return a promise to get the busy, done and failed states. */
  onExport: (format: string) => void | Promise<unknown>;
  label?: string;
  className?: string;
};

const defaultFormats: TableToolbarExportFormat[] = [
  { value: "csv", label: "CSV", hint: ".csv" },
  { value: "json", label: "JSON", hint: ".json" },
];

export function TableToolbarExport({ formats = defaultFormats, onExport, label = "Export", className }: TableToolbarExportProps) {
  const [state, setState] = useState<ExportState>("idle");
  const reduce = useReducedMotion();
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const run = async (format: string) => {
    if (state === "busy") return;
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    // No spinner for exports that finish inside 150ms; once shown, it stays at least 300ms.
    let shownAt = 0;
    timers.current.push(window.setTimeout(() => ((shownAt = now()), setState("busy")), 150));
    let outcome: ExportState = "done";
    try {
      await onExport(format);
    } catch {
      outcome = "failed";
    }
    window.clearTimeout(timers.current[0]);
    const wait = shownAt ? Math.max(0, 300 - (now() - shownAt)) : 0;
    timers.current.push(
      window.setTimeout(() => {
        setState(outcome);
        timers.current.push(window.setTimeout(() => setState("idle"), outcome === "failed" ? 2600 : 1600));
      }, wait),
    );
  };

  const labels = { idle: label, busy: "Exporting…", done: "Exported", failed: "Failed" } as const;
  const icon =
    state === "busy" ? <Loader size={16} className="animate-spin-slow" /> : state === "done" ? <Check size={16} /> : state === "failed" ? <X size={16} /> : <Download size={16} />;

  return (
    <Menu.Root>
      <Toolbar.Button
        render={<Menu.Trigger />}
        aria-label={labels[state]}
        aria-busy={state === "busy" || undefined}
        data-state={state}
        className={cn(buttonClass, "@max-md:ml-auto", state === "failed" && "text-danger", state === "busy" && "pointer-events-none", className)}
      >
        <span className={cn("relative grid size-4 place-items-center", state === "idle" ? "text-fg-2 group-hover/btn:text-fg" : state === "done" ? "text-success" : "")}>
          <AnimatePresence initial={false}>
            <motion.span
              key={state}
              className="absolute inset-0 grid place-items-center"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
              transition={reduce ? { duration: 0.12 } : spring.pop}
            >
              {icon}
            </motion.span>
          </AnimatePresence>
        </span>
        {/* Every label shares one grid cell, so the button keeps the width of the longest. */}
        <span className="grid overflow-hidden py-1 text-left @max-md:sr-only" aria-hidden>
          {Object.values(labels).map((l) => (
            <span key={l} className="invisible col-start-1 row-start-1">{l}</span>
          ))}
          <AnimatePresence initial={false}>
            <motion.span
              key={state}
              className="col-start-1 row-start-1"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" }}
              transition={{ duration: reduce ? 0.12 : 0.2, ease: ease.out }}
            >
              {labels[state]}
            </motion.span>
          </AnimatePresence>
        </span>
      </Toolbar.Button>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={8} className="z-(--z-dropdown)">
          <Menu.Popup className={cn(menuPopupClass, "min-w-44")}>
            <Menu.Group>
              <Menu.GroupLabel className="px-2 pb-1 pt-1.5 font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">Export as</Menu.GroupLabel>
              {formats.map((f) => (
                <Menu.Item key={f.value} onClick={() => run(f.value)} className={menuItemClass}>
                  <span className="flex-1">{f.label}</span>
                  {f.hint && <span className="font-mono text-[11px] text-fg-4">{f.hint}</span>}
                </Menu.Item>
              ))}
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "done" ? "Export ready" : state === "failed" ? "Export failed. Try again." : ""}
      </span>
    </Menu.Root>
  );
}
