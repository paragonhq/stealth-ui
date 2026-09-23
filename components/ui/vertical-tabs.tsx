"use client";
import { Select } from "@base-ui/react/select";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { createContext, use, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Check, ChevronsUpDown } from "@/lib/icons";
import { useControllableState } from "@/lib/use-controllable-state";

type Value = string;
type Entry = { value: Value; label: React.ReactNode; icon?: React.ReactNode; hint?: React.ReactNode; disabled?: boolean; el: HTMLElement };

/**
 * Every tab registers what it shows, so the narrow layout can offer the same
 * sections as a select without the consumer describing them twice.
 */
function createRegistry() {
  let entries: Entry[] = [];
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    subscribe(l: () => void) {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    snapshot: () => entries,
    set(entry: Entry) {
      const rest = entries.filter((e) => e.value !== entry.value);
      // Keep document order, whatever order the tabs mounted in.
      entries = [...rest, entry].sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      emit();
    },
    remove(value: Value) {
      entries = entries.filter((e) => e.value !== value);
      emit();
    },
  };
}
type Registry = ReturnType<typeof createRegistry>;
const empty: Entry[] = [];

type Collapse = "sm" | "md";
type Ctx = { value: Value | null; setValue: (v: Value) => void; registry: Registry; collapse: Collapse };
const VerticalTabsContext = createContext<Ctx | null>(null);
const useVT = () => {
  const ctx = use(VerticalTabsContext);
  if (!ctx) throw new Error("VerticalTabs parts must be used inside <VerticalTabs>");
  return ctx;
};

export type VerticalTabsProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "dir"> & {
  value?: Value | null;
  /** The section shown first. Without it no section is active until one is picked. */
  defaultValue?: Value | null;
  onValueChange?: (value: Value | null) => void;
  /** Below this container width the side list becomes a select above the panel. */
  collapseBelow?: Collapse;
};

export function VerticalTabs({ value: valueProp, defaultValue = null, onValueChange, collapseBelow = "sm", className, children, onKeyDownCapture, onPointerDownCapture, ...rest }: VerticalTabsProps) {
  const [value, setValue] = useControllableState<Value | null>({ value: valueProp, defaultValue, onChange: onValueChange });
  const [registry] = useState(createRegistry);

  return (
    <VerticalTabsContext value={{ value, setValue, registry, collapse: collapseBelow }}>
      <BaseTabs.Root
        value={value}
        onValueChange={(v) => setValue(v as Value)}
        orientation="vertical"
        data-vtabs-root=""
        data-collapse={collapseBelow}
        // Arrow keys switch sections on the same frame; only pointer switches animate.
        onKeyDownCapture={(e) => {
          e.currentTarget.dataset.nav = "key";
          onKeyDownCapture?.(e);
        }}
        onPointerDownCapture={(e) => {
          e.currentTarget.dataset.nav = "pointer";
          onPointerDownCapture?.(e);
        }}
        className={cn("group/vtabs @container/vtabs min-w-0", className)}
        {...rest}
      >
        <div
          className={cn(
            "flex flex-col gap-4",
            collapseBelow === "sm" ? "@[30rem]/vtabs:flex-row @[30rem]/vtabs:gap-6" : "@[40rem]/vtabs:flex-row @[40rem]/vtabs:gap-8",
          )}
        >
          {children}
        </div>
      </BaseTabs.Root>
    </VerticalTabsContext>
  );
}

// The side list and the select swap at the same container width: 480px, or 640px for longer labels.
const wide: Record<Collapse, string> = {
  sm: "hidden @[30rem]/vtabs:block @[30rem]/vtabs:w-[176px] @[40rem]/vtabs:w-[200px]",
  md: "hidden @[40rem]/vtabs:block @[40rem]/vtabs:w-[200px]",
};
const narrow: Record<Collapse, string> = { sm: "@[30rem]/vtabs:hidden", md: "@[40rem]/vtabs:hidden" };

export type VerticalTabsListProps = Omit<BaseTabs.List.Props, "className"> & {
  className?: string;
  /** Names the list, and the select that replaces it on narrow widths. */
  "aria-label": string;
};

export function VerticalTabsList({ className, children, activateOnFocus = true, "aria-label": label, ...rest }: VerticalTabsListProps) {
  const { value, setValue, registry, collapse } = useVT();
  const entries = useSyncExternalStore(registry.subscribe, registry.snapshot, () => empty);
  const listRef = useRef<HTMLDivElement>(null);
  // One hover wash for the whole list, handed from row to row.
  const [hover, setHover] = useState<{ top: number; height: number; on: boolean; instant: boolean }>({ top: 0, height: 0, on: false, instant: true });

  const onPointerOver = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const tab = (e.target as HTMLElement).closest<HTMLElement>("[role=tab]");
    if (!tab || !listRef.current?.contains(tab) || tab.hasAttribute("data-disabled")) return;
    const next = { top: tab.offsetTop, height: tab.offsetHeight };
    setHover((h) => (h.on && h.top === next.top ? h : { ...next, on: true, instant: !h.on }));
  };

  return (
    <>
      <div className={cn("shrink-0", wide[collapse])}>
        <BaseTabs.List
          ref={listRef}
          aria-label={label}
          activateOnFocus={activateOnFocus}
          onPointerOver={onPointerOver}
          onPointerLeave={() => setHover((h) => ({ ...h, on: false }))}
          className={cn("relative isolate flex flex-col gap-px", className)}
          {...rest}
        >
          {children}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 -z-10 rounded-lg bg-fg/[0.035]",
              // Glides between rows; appears in place when the pointer first arrives.
              hover.instant ? "transition-opacity" : "transition-[opacity,translate,height]",
              "duration-150 ease-out-quart",
              !hover.on && "opacity-0",
            )}
            style={{ translate: `0 ${hover.top}px`, height: hover.height }}
          />
          <BaseTabs.Indicator
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 -z-10 h-(--active-tab-height) translate-y-(--active-tab-top) rounded-lg bg-fg/[0.07]",
              "transition-[translate,height] duration-[240ms] ease-in-out-quart group-data-[nav=key]/vtabs:duration-0",
            )}
          />
        </BaseTabs.List>
      </div>

      <div className={narrow[collapse]}>
        <Select.Root value={value} onValueChange={(v) => v != null && setValue(v as Value)}>
          <Select.Trigger
            aria-label={label}
            className={cn(
              "group/trigger relative flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-line-2 bg-raised pr-2 pl-2.5 text-left text-[13px] text-fg shadow-[var(--shadow)] select-none",
              "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              "transition-[background-color,border-color,scale] duration-150 ease-out active:scale-[0.985] active:duration-75",
              "hover:border-fg-4 hover:bg-hover data-popup-open:border-fg-4 data-popup-open:bg-hover",
              "pointer-coarse:h-11 pointer-coarse:text-[15px]",
            )}
          >
            <Select.Value
              render={(props) => {
                const current = entries.find((e) => e.value === value);
                return (
                  <span {...props} className="flex min-w-0 flex-1 items-center gap-2">
                    {current?.icon && <span className="flex shrink-0 text-fg-3 [&_svg]:size-4">{current.icon}</span>}
                    <span className="truncate">{current?.label ?? <span className="text-fg-4">Choose a section</span>}</span>
                  </span>
                );
              }}
            />
            <Select.Icon className="flex shrink-0 text-fg-3 transition-colors duration-150 group-hover/trigger:text-fg-2 [&_svg]:size-4">
              <ChevronsUpDown />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger={false} sideOffset={6} collisionPadding={8} className="z-(--z-popover) outline-none select-none">
              <Select.Popup
                className={cn(
                  "relative min-w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
                  "transition-[opacity,scale] duration-160 ease-out-expo data-ending-style:duration-100 data-ending-style:ease-out",
                  "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0",
                )}
              >
                <Select.List className="max-h-[min(var(--available-height),20rem)] scroll-py-1 overflow-y-auto overscroll-contain p-1 outline-none">
                  {entries.map((e) => (
                    <Select.Item
                      key={e.value}
                      value={e.value}
                      disabled={e.disabled}
                      className={cn(
                        "group/item flex h-8 cursor-default scroll-my-1 items-center gap-2 rounded-lg pr-2 pl-2 text-[13px] text-fg outline-none select-none pointer-coarse:h-11",
                        "data-highlighted:bg-fg/[0.07] data-disabled:text-fg-4",
                      )}
                    >
                      {e.icon && <span className="flex shrink-0 text-fg-3 group-data-disabled/item:text-fg-4 [&_svg]:size-4">{e.icon}</span>}
                      <Select.ItemText className="min-w-0 flex-1 truncate">{e.label}</Select.ItemText>
                      {e.hint != null && <span className="shrink-0 text-[12px] text-fg-3 tabular group-data-disabled/item:text-fg-4">{e.hint}</span>}
                      <span className="grid size-4 shrink-0 place-items-center">
                        <Select.ItemIndicator>
                          <Check size={14} />
                        </Select.ItemIndicator>
                      </span>
                    </Select.Item>
                  ))}
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </div>
    </>
  );
}

export type VerticalTabsTabProps = Omit<BaseTabs.Tab.Props, "className" | "children" | "value"> & {
  value: Value;
  className?: string;
  children: React.ReactNode;
  /** 16px icon before the label. */
  icon?: React.ReactNode;
  /** Right-aligned meta: a count, a plan, a status word. */
  hint?: React.ReactNode;
};

export function VerticalTabsTab({ value, icon, hint, disabled, className, children, ...rest }: VerticalTabsTabProps) {
  const { registry } = useVT();
  const ref = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (ref.current) registry.set({ value, label: children, icon, hint, disabled, el: ref.current });
  }, [registry, value, children, icon, hint, disabled]);
  useLayoutEffect(() => () => registry.remove(value), [registry, value]);

  return (
    <BaseTabs.Tab
      ref={ref}
      value={value}
      disabled={disabled}
      className={cn(
        "group/tab relative flex h-8 w-full min-w-0 select-none items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] outline-none",
        "touch-manipulation [-webkit-tap-highlight-color:transparent]",
        "text-fg-2 transition-colors duration-150 hover:text-fg data-active:text-fg data-active:font-medium",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
        "data-disabled:pointer-events-none data-disabled:text-fg-4",
        className,
      )}
      {...rest}
    >
      {icon && (
        <span className="flex shrink-0 text-fg-3 transition-[color,scale] duration-150 ease-out-quart group-hover/tab:text-fg-2 group-active/tab:scale-[0.9] group-data-active/tab:text-fg [&_svg]:size-4">
          {icon}
        </span>
      )}
      {/* The label reserves its bold width, so becoming active never nudges the hint. */}
      <span className="grid min-w-0 flex-1">
        <span aria-hidden className="invisible col-start-1 row-start-1 truncate font-medium">
          {children}
        </span>
        <span className="col-start-1 row-start-1 truncate">{children}</span>
      </span>
      {hint != null && <span className="shrink-0 text-[12px] font-normal text-fg-3 tabular group-data-disabled/tab:text-fg-4">{hint}</span>}
    </BaseTabs.Tab>
  );
}

export type VerticalTabsLabelProps = React.ComponentProps<"div">;

/** A quiet group heading between tabs ("Account", "Workspace"). Shown in the side list only. */
export function VerticalTabsLabel({ className, ...rest }: VerticalTabsLabelProps) {
  return (
    <div
      aria-hidden
      className={cn("px-2.5 pt-4 pb-1.5 font-mono text-2xs tracking-[0.08em] text-fg-4 uppercase select-none first:pt-1", className)}
      {...rest}
    />
  );
}

export type VerticalTabsPanelsProps = React.ComponentProps<"div">;

/** Stacks the panels in one cell so the outgoing one fades while the next arrives. */
export function VerticalTabsPanels({ className, ...rest }: VerticalTabsPanelsProps) {
  return <div className={cn("relative grid min-w-0 flex-1 grid-cols-1 content-start", className)} {...rest} />;
}

export type VerticalTabsPanelProps = Omit<BaseTabs.Panel.Props, "className"> & { className?: string };

export function VerticalTabsPanel({ className, ...rest }: VerticalTabsPanelProps) {
  return (
    <BaseTabs.Panel
      className={cn(
        "col-start-1 row-start-1 min-w-0 rounded-md outline-none",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-[6px] focus-visible:outline-fg-3",
        // Arrives from the direction of the section picked; leaves by fading out of the flow.
        "transition-[opacity,translate] duration-[220ms] ease-out-expo",
        "data-starting-style:opacity-0 data-starting-style:data-[activation-direction=down]:translate-y-1.5 data-starting-style:data-[activation-direction=up]:-translate-y-1.5",
        "data-ending-style:pointer-events-none data-ending-style:absolute data-ending-style:inset-x-0 data-ending-style:top-0 data-ending-style:opacity-0 data-ending-style:duration-[120ms] data-ending-style:ease-out-quart",
        "group-data-[nav=key]/vtabs:duration-0",
        className,
      )}
      {...rest}
    />
  );
}
