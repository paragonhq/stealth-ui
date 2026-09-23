"use client";
import { Tooltip } from "@base-ui/react/tooltip";
import NumberFlow from "@number-flow/react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * Root
 * -----------------------------------------------------------------------------------------------*/

type RailContextValue = {
  collapsed: boolean;
  toggle: (via: "pointer" | "key") => void;
  value: string | null;
  select: (value: string) => void;
  pill: string;
  navId: string;
  shortcut: string | false;
};

const RailContext = createContext<RailContextValue | null>(null);

function useRail(part: string) {
  const ctx = useContext(RailContext);
  if (!ctx) throw new Error(`<${part}> must be inside <IconRail>`);
  return ctx;
}

// "mod" is ⌘ on Apple devices and Ctrl elsewhere. The server assumes ⌘; the glyph
// only appears inside a tooltip, which never renders before hydration.
const noop = () => () => {};
const readApple = () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
function useApple() {
  return useSyncExternalStore(noop, readApple, () => true);
}

function matches(e: KeyboardEvent, shortcut: string) {
  const parts = shortcut.toLowerCase().split("+");
  const key = parts.pop();
  const mod = parts.includes("mod");
  if (mod !== (e.metaKey || e.ctrlKey)) return false;
  if (parts.includes("shift") !== e.shiftKey || parts.includes("alt") !== e.altKey) return false;
  return e.key.toLowerCase() === key;
}

export type IconRailProps = Omit<React.ComponentProps<"aside">, "defaultValue" | "onChange"> & {
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** The active item's value. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  /** Keyboard toggle, as "mod+b" or "mod+shift+s". `false` turns it off. Ignored while typing in a field. */
  shortcut?: string | false;
  /** Widths in px. */
  expandedWidth?: number;
  collapsedWidth?: number;
};

export function IconRail({
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  value,
  defaultValue = null,
  onValueChange,
  shortcut = "mod+b",
  expandedWidth = 220,
  collapsedWidth = 48,
  className,
  style,
  children,
  ...rest
}: IconRailProps) {
  const [collapsed, setCollapsed] = useControllableState({ value: collapsedProp, defaultValue: defaultCollapsed, onChange: onCollapsedChange });
  const [current, setCurrent] = useControllableState<string | null>({ value, defaultValue, onChange: onValueChange });
  // Keyboard toggles land on the same frame; a pointer toggle animates. Motion on a
  // shortcut someone presses all day reads as latency.
  const [instant, setInstant] = useState(false);
  const pill = useId();
  const navId = useId();

  const toggle = useCallback(
    (via: "pointer" | "key") => {
      setInstant(via === "key");
      setCollapsed((c) => !c);
    },
    [setCollapsed],
  );

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || !matches(e, shortcut)) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")) return;
      e.preventDefault();
      toggle("key");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut, toggle]);

  const ctx = useMemo(
    () => ({ collapsed, toggle, value: current, select: (v: string) => setCurrent(v), pill, navId, shortcut }),
    [collapsed, toggle, current, setCurrent, pill, navId, shortcut],
  );

  return (
    <RailContext.Provider value={ctx}>
      <Tooltip.Provider delay={400} timeout={400}>
        <aside
          data-collapsed={collapsed || undefined}
          data-instant={instant || undefined}
          style={{ width: collapsed ? collapsedWidth : expandedWidth, ...style }}
          className={cn(
            "group/rail flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-line bg-frame text-fg",
            "transition-[width] duration-260 ease-in-out-quart data-instant:duration-0",
            className,
          )}
          {...rest}
        >
          {children}
        </aside>
      </Tooltip.Provider>
    </RailContext.Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Shared pieces
 * -----------------------------------------------------------------------------------------------*/

// Everything that isn't an icon fades and slides 4px toward the icons as the rail
// narrows, quickly and with no delay; on the way back it waits 70ms so the width
// has room for it before it arrives.
const fadeLabel = cn(
  "transition-[opacity,translate] duration-200 delay-70 ease-out-expo",
  "group-data-collapsed/rail:-translate-x-1 group-data-collapsed/rail:opacity-0 group-data-collapsed/rail:delay-0 group-data-collapsed/rail:duration-100",
  "group-data-instant/rail:transition-none motion-reduce:translate-x-0",
);

const focusRing = "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3";

const tipClass = cn(
  "flex items-center gap-2 rounded-lg border border-line-2 bg-raised px-2 py-1 text-[12px] leading-4 text-fg shadow-pop outline-none",
  "origin-(--transform-origin) transition-[opacity,scale,translate] duration-150 ease-out-expo",
  "data-starting-style:-translate-x-0.5 data-starting-style:scale-96 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-100",
  "data-instant:transition-none motion-reduce:translate-x-0 motion-reduce:scale-100",
);

function RailTooltip({ label, detail, disabled, children }: { label: React.ReactNode; detail?: React.ReactNode; disabled: boolean; children: React.ReactElement }) {
  return (
    <Tooltip.Root disabled={disabled}>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner side="right" sideOffset={10} className="z-(--z-tooltip)">
          <Tooltip.Popup className={tipClass}>
            {label}
            {detail}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Header, content, group, footer
 * -----------------------------------------------------------------------------------------------*/

export type IconRailHeaderProps = Omit<React.ComponentProps<"div">, "title"> & {
  /** A 32px mark that stays put in both states: a logo or a workspace tile. */
  mark: React.ReactNode;
  /** Shown beside the mark when expanded. */
  title?: React.ReactNode;
};

export function IconRailHeader({ mark, title, className, children, ...rest }: IconRailHeaderProps) {
  return (
    <div className={cn("flex h-12 shrink-0 items-center gap-2 px-2", className)} {...rest}>
      <span className="grid size-8 shrink-0 place-items-center">{mark}</span>
      {title && <span className={cn("min-w-0 flex-1 truncate whitespace-nowrap text-[13px] font-medium tracking-[-0.01em]", fadeLabel)}>{title}</span>}
      {children}
    </div>
  );
}

type WashContextValue = { show: (el: HTMLElement) => void; hide: () => void };
const WashContext = createContext<WashContextValue | null>(null);

export type IconRailContentProps = React.ComponentProps<"nav">;

/** The labeled nav landmark holding the items. ↑ ↓ Home End move between them. */
export function IconRailContent({ className, children, onKeyDown, "aria-label": label = "Main", ...rest }: IconRailContentProps) {
  const { navId } = useRail("IconRailContent");
  const reduce = !!useReducedMotion();
  const listRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const [on, setOn] = useState(false);
  const shown = useRef(false);
  const hiddenAt = useRef(0);

  // One wash for the list, as in the sidebar: it glides after the pointer and
  // appears in place when the pointer first arrives.
  const show = useCallback(
    (el: HTMLElement) => {
      const list = listRef.current;
      if (!list) return;
      const top = el.getBoundingClientRect().top - list.getBoundingClientRect().top;
      if (!reduce && (shown.current || performance.now() - hiddenAt.current < 150)) animate(y, top, spring.follow);
      else y.jump(top);
      shown.current = true;
      setOn(true);
    },
    [reduce, y],
  );
  const hide = useCallback(() => {
    if (!shown.current) return;
    shown.current = false;
    hiddenAt.current = performance.now();
    setOn(false);
  }, []);
  const wash = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <WashContext.Provider value={wash}>
      <nav
        id={navId}
        aria-label={label}
        className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-2 py-1 [scrollbar-width:none]", className)}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented || !["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
          const rows = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-rail-row]") ?? [])].filter((el) => !el.matches(":disabled,[aria-disabled=true]"));
          const at = rows.indexOf(e.target as HTMLElement);
          if (at < 0) return;
          e.preventDefault();
          const next = e.key === "Home" ? 0 : e.key === "End" ? rows.length - 1 : Math.min(rows.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)));
          rows[next]?.focus();
        }}
        {...rest}
      >
        <div ref={listRef} className="relative flex flex-col" onPointerLeave={hide}>
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-8 rounded-md bg-hover"
            style={{ y }}
            initial={false}
            animate={{ opacity: on ? 1 : 0 }}
            transition={{ duration: on ? 0.12 : 0.15, ease: "easeOut" }}
          />
          {children}
        </div>
      </nav>
    </WashContext.Provider>
  );
}

export type IconRailGroupProps = React.ComponentProps<"div"> & { label?: string };

/**
 * A labeled run of items. When the rail narrows, the label gives way to a short
 * hairline in the same 28px row, so no icon moves vertically.
 */
export function IconRailGroup({ label, className, children, ...rest }: IconRailGroupProps) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={label ? id : undefined} className={cn("flex flex-col gap-px pt-2 first:pt-0", className)} {...rest}>
      {label && (
        <div className="relative flex h-7 items-center px-2">
          <span id={id} className={cn("truncate whitespace-nowrap font-mono text-[10.5px] uppercase leading-none tracking-[0.08em] text-fg-3", fadeLabel)}>
            {label}
          </span>
          <span
            aria-hidden
            className="absolute left-2.5 top-1/2 h-px w-3 bg-line-2 opacity-0 transition-opacity duration-150 group-data-collapsed/rail:opacity-100 group-data-collapsed/rail:delay-100 group-data-instant/rail:transition-none"
          />
        </div>
      )}
      {children}
    </div>
  );
}

export type IconRailFooterProps = React.ComponentProps<"div">;

export function IconRailFooter({ className, ...rest }: IconRailFooterProps) {
  return <div className={cn("flex shrink-0 flex-col gap-px border-t border-line p-2", className)} {...rest} />;
}

/* -------------------------------------------------------------------------------------------------
 * Item
 * -----------------------------------------------------------------------------------------------*/

export type IconRailItemProps = Omit<React.ComponentProps<"a">, "children"> & {
  value: string;
  /** The 16px icon: the only thing left when the rail is narrow. */
  icon: React.ReactNode;
  /** The label. Also the tooltip and the accessible name when narrow. */
  children: string;
  /** Rolls when it changes; becomes a dot on the icon when narrow. */
  count?: number;
  disabled?: boolean;
  /** Your router's link element, e.g. <Link href="/inbox" />. */
  render?: React.ReactElement;
};

export function IconRailItem({ value, icon, children, count, disabled = false, href, render, className, onClick, onPointerEnter, ...rest }: IconRailItemProps) {
  const { collapsed, value: current, select, pill } = useRail("IconRailItem");
  const wash = useContext(WashContext);
  const reduce = useReducedMotion();
  const active = current === value;
  const hasCount = typeof count === "number" && count > 0;
  const element = render ?? (href && !disabled ? <a href={href} /> : <button type="button" disabled={disabled} />);

  return (
    <RailTooltip label={children} detail={hasCount ? <span className="text-[11.5px] tabular text-fg-3">{count}</span> : undefined} disabled={!collapsed || disabled}>
      {cloneWith(element, {
        ...rest,
        "aria-current": active ? "page" : undefined,
        "aria-disabled": disabled || undefined,
        "data-rail-row": "",
        "data-active": active || undefined,
        "data-disabled": disabled || undefined,
        onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
          if (disabled) return e.preventDefault();
          onClick?.(e);
          select(value);
        },
        onPointerEnter: (e: React.PointerEvent<HTMLAnchorElement>) => {
          onPointerEnter?.(e);
          if (e.pointerType === "touch") return;
          if (disabled) wash?.hide();
          else wash?.show(e.currentTarget);
        },
        className: cn(
          "group/item relative flex h-8 w-full min-w-0 select-none items-center rounded-md pr-2 text-left text-[13px] text-fg-2 no-underline",
          "transition-[color,scale,background-color] duration-150 active:scale-[0.97] active:duration-75 hover:text-fg data-active:text-fg",
          "pointer-coarse:active:bg-hover data-disabled:pointer-events-none data-disabled:opacity-50",
          // Narrow rows are 32px squares; on touch the hit area grows to 44px without changing the drawing.
          "before:absolute before:-inset-x-2 before:-inset-y-1.5 before:content-[''] pointer-fine:before:hidden",
          !wash && "hover:bg-hover",
          focusRing,
          className,
        ),
        children: (
          <>
            {active && (
              <motion.span
                layoutId={pill}
                aria-hidden
                className="absolute inset-0 rounded-md border border-line-2 bg-raised shadow-[var(--shadow)]"
                transition={reduce ? { duration: 0 } : spring.snappy}
              />
            )}
            <span aria-hidden className="relative grid size-8 shrink-0 place-items-center text-fg-3 transition-colors duration-150 group-hover/item:text-fg-2 group-data-active/item:text-fg [&_svg]:size-4">
              {icon}
              {/* Narrow, the count becomes a dot on the icon; the number moves to the tooltip. */}
              <span
                className={cn(
                  "absolute right-1.5 top-1.5 size-1.5 scale-0 rounded-full bg-fg opacity-0 ring-2 ring-frame transition-[scale,opacity] duration-200 ease-out-expo",
                  hasCount && "group-data-collapsed/rail:scale-100 group-data-collapsed/rail:opacity-100 group-data-collapsed/rail:delay-100",
                  "group-data-instant/rail:transition-none group-data-active/item:ring-raised",
                )}
              />
            </span>
            <span className={cn("relative min-w-0 flex-1 truncate whitespace-nowrap pl-0.5", fadeLabel)}>{children}</span>
            {hasCount && (
              <span className={cn("relative shrink-0 text-[11.5px] tabular text-fg-3 group-data-active/item:text-fg-2", fadeLabel)}>
                <NumberFlow value={count} />
              </span>
            )}
          </>
        ),
      })}
    </RailTooltip>
  );
}

// Adds our props and classes to the caller's element (their Link, or our default
// anchor or button). Their own className is kept and ours goes first.
function cloneWith(element: React.ReactElement, props: Record<string, unknown>) {
  const own = element.props as Record<string, unknown>;
  const Type = element.type as React.ElementType;
  return <Type {...own} {...props} className={cn(props.className as string, own.className as string)} />;
}

/* -------------------------------------------------------------------------------------------------
 * Toggle
 * -----------------------------------------------------------------------------------------------*/

export type IconRailToggleProps = Omit<React.ComponentProps<"button">, "children"> & {
  /** Label while expanded. */
  collapseLabel?: string;
  /** Label while narrow; also its tooltip. */
  expandLabel?: string;
};

/** The row that folds the rail. It shows the shortcut in its tooltip when narrow. */
export function IconRailToggle({ collapseLabel = "Collapse", expandLabel = "Expand sidebar", className, onClick, ...rest }: IconRailToggleProps) {
  const { collapsed, toggle, navId, shortcut } = useRail("IconRailToggle");
  const apple = useApple();
  const keys = shortcut ? shortcut.split("+").map((k) => (k === "mod" ? (apple ? "⌘" : "Ctrl") : k === "shift" ? "⇧" : k === "alt" ? (apple ? "⌥" : "Alt") : k.toUpperCase())) : [];
  const label = collapsed ? expandLabel : collapseLabel;

  return (
    <RailTooltip
      label={label}
      disabled={!collapsed}
      detail={
        keys.length ? (
          <kbd className="flex gap-0.5">
            {keys.map((k) => (
              <span key={k} className="grid h-[18px] min-w-[18px] place-items-center rounded-[5px] border border-line-2 bg-frame px-1 font-mono text-[10.5px] leading-none text-fg-2">
                {k}
              </span>
            ))}
          </kbd>
        ) : undefined
      }
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={!collapsed}
        aria-controls={navId}
        aria-keyshortcuts={shortcut ? shortcut.replace(/mod/i, apple ? "Meta" : "Control").replace(/\b\w/g, (c) => c.toUpperCase()) : undefined}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) toggle("pointer");
        }}
        className={cn(
          "group/item relative flex h-8 w-full min-w-0 select-none items-center rounded-md pr-2 text-left text-[13px] text-fg-3",
          "transition-[color,scale,background-color] duration-150 hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75",
          "before:absolute before:-inset-x-2 before:-inset-y-1.5 before:content-[''] pointer-fine:before:hidden",
          focusRing,
          className,
        )}
        {...rest}
      >
        <span aria-hidden className="grid size-8 shrink-0 place-items-center">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-[rotate] duration-260 ease-in-out-quart group-data-collapsed/rail:rotate-180 group-data-instant/rail:transition-none"
          >
            <path d="M8.25 4.5 4.75 8l3.5 3.5M11.75 4.5 8.25 8l3.5 3.5" />
          </svg>
        </span>
        <span aria-hidden className={cn("min-w-0 flex-1 truncate whitespace-nowrap pl-0.5", fadeLabel)}>
          {collapseLabel}
        </span>
        {keys.length > 0 && (
          <kbd aria-hidden className={cn("flex shrink-0 gap-0.5 font-mono text-[10.5px] text-fg-4 pointer-coarse:hidden", fadeLabel)}>
            {keys.map((k) => (
              <span key={k}>{k}</span>
            ))}
          </kbd>
        )}
      </button>
    </RailTooltip>
  );
}
