"use client";
import { Collapsible } from "@base-ui/react/collapsible";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ChevronRight, ChevronsUpDown } from "@/lib/icons";
import { spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * Root
 * -----------------------------------------------------------------------------------------------*/

type SidebarContextValue = {
  value: string | null;
  select: (value: string) => void;
  /** Scopes the active pill's layoutId to this sidebar, so two sidebars never trade pills. */
  pill: string;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

function useSidebar(part: string) {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error(`<${part}> must be inside <Sidebar>`);
  return ctx;
}

export type SidebarProps = Omit<React.ComponentProps<"aside">, "defaultValue" | "onChange"> & {
  /** The value of the item for the current page. Pass it from your router to keep the sidebar in sync. */
  value?: string | null;
  defaultValue?: string | null;
  /** Called when an item is pressed, before any navigation its link performs. */
  onValueChange?: (value: string | null) => void;
};

export function Sidebar({ value, defaultValue = null, onValueChange, className, children, ...rest }: SidebarProps) {
  const [current, setCurrent] = useControllableState<string | null>({ value, defaultValue, onChange: onValueChange });
  const pill = useId();
  const ctx = useMemo(() => ({ value: current, select: (v: string) => setCurrent(v), pill }), [current, setCurrent, pill]);

  return (
    <SidebarContext.Provider value={ctx}>
      <aside className={cn("flex h-full min-h-0 w-60 shrink-0 flex-col border-r border-line bg-frame text-fg", className)} {...rest}>
        {children}
      </aside>
    </SidebarContext.Provider>
  );
}

export type SidebarHeaderProps = React.ComponentProps<"div">;

/** The top of the sidebar: the workspace, a search or a compose button. Never scrolls. */
export function SidebarHeader({ className, ...rest }: SidebarHeaderProps) {
  return <div className={cn("flex shrink-0 items-center gap-1 px-3 pb-1.5 pt-3", className)} {...rest} />;
}

export type SidebarFooterProps = React.ComponentProps<"div">;

/** The bottom of the sidebar: the signed-in person, a help link. Never scrolls. */
export function SidebarFooter({ className, ...rest }: SidebarFooterProps) {
  return <div className={cn("shrink-0 border-t border-line p-2", className)} {...rest} />;
}

/* -------------------------------------------------------------------------------------------------
 * Content: the scrolling list, the hover wash and the arrow keys
 * -----------------------------------------------------------------------------------------------*/

type WashContextValue = { show: (el: HTMLElement) => void; hide: () => void };
const WashContext = createContext<WashContextValue | null>(null);

// One wash for the whole list, moved to whichever row the pointer is over. It glides
// between rows on the follow spring, and appears in place (a fade, no travel) when the
// pointer first arrives so it never sweeps in from the last row it visited. Motion
// values keep the position off React's render path.
function useWash(reduce: boolean) {
  const listRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const height = useMotionValue(0);
  const [on, setOn] = useState(false);
  const shown = useRef(false);
  const hiddenAt = useRef(0);

  const show = useCallback(
    (el: HTMLElement) => {
      const list = listRef.current;
      if (!list) return;
      const top = el.getBoundingClientRect().top - list.getBoundingClientRect().top;
      // Still fading out from a moment ago: glide from there instead of reappearing.
      const glide = !reduce && (shown.current || performance.now() - hiddenAt.current < 150);
      if (glide) {
        animate(y, top, spring.follow);
        animate(height, el.offsetHeight, spring.follow);
      } else {
        y.jump(top);
        height.jump(el.offsetHeight);
      }
      shown.current = true;
      setOn(true);
    },
    [reduce, y, height],
  );

  const hide = useCallback(() => {
    if (!shown.current) return;
    shown.current = false;
    hiddenAt.current = performance.now();
    setOn(false);
  }, []);

  return { listRef, y, height, on, show, hide };
}

export type SidebarContentProps = React.ComponentProps<"nav">;

/**
 * The scrolling middle of the sidebar, rendered as a labeled nav landmark. Fades its
 * edges only when there is more to scroll to, and lets ↑ ↓ Home End move between rows.
 */
export function SidebarContent({ className, children, onKeyDown, "aria-label": label = "Main", ...rest }: SidebarContentProps) {
  const reduce = !!useReducedMotion();
  const { listRef, y, height, on, show, hide } = useWash(reduce);
  const wash = useMemo(() => ({ show, hide }), [show, hide]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  useEffect(() => {
    const el = scrollRef.current;
    const list = listRef.current;
    if (!el || !list) return;
    const measure = () => {
      const top = el.scrollTop > 1;
      const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
      setEdges((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(list);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [listRef]);

  return (
    <WashContext.Provider value={wash}>
      <nav
        aria-label={label}
        className={cn("relative flex min-h-0 flex-1 flex-col", className)}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented || !["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
          const rows = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-sidebar-row]") ?? [])].filter(
            (el) => !el.closest("[hidden]") && !el.matches(":disabled,[aria-disabled=true]"),
          );
          const at = rows.indexOf(e.target as HTMLElement);
          if (at < 0) return;
          e.preventDefault();
          const next = e.key === "Home" ? 0 : e.key === "End" ? rows.length - 1 : Math.min(rows.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)));
          rows[next]?.focus();
        }}
        {...rest}
      >
        <motion.div
          ref={scrollRef}
          layoutScroll
          data-edge-top={edges.top || undefined}
          data-edge-bottom={edges.bottom || undefined}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3 [scrollbar-width:none]",
            // The edge fades only where there is more to see, so a short list reads as complete.
            "[--fade-top:0px] [--fade-bottom:0px] data-edge-top:[--fade-top:16px] data-edge-bottom:[--fade-bottom:16px]",
            "[mask-image:linear-gradient(to_bottom,transparent,var(--fg)_var(--fade-top),var(--fg)_calc(100%-var(--fade-bottom)),transparent)]",
          )}
        >
          <div ref={listRef} className="relative flex flex-col" onPointerLeave={hide}>
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 rounded-md bg-hover"
              style={{ y, height }}
              initial={false}
              animate={{ opacity: on ? 1 : 0 }}
              transition={{ duration: on ? 0.12 : 0.15, ease: "easeOut" }}
            />
            {children}
          </div>
        </motion.div>
      </nav>
    </WashContext.Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Group
 * -----------------------------------------------------------------------------------------------*/

export type SidebarGroupProps = Omit<React.ComponentProps<"div">, "title"> & {
  /** The section's name. Omit it for the first, unlabeled block of items. */
  label?: React.ReactNode;
  /** Lets the label fold the section away. */
  collapsible?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** A small control at the end of the label row, such as "Add team". Keep it icon-sized. */
  action?: React.ReactNode;
};

const labelText = "font-mono text-[10.5px] uppercase leading-none tracking-[0.08em] text-fg-3";

export function SidebarGroup({ label, collapsible = false, open, defaultOpen = true, onOpenChange, action, className, children, ...rest }: SidebarGroupProps) {
  const labelId = useId();
  const wash = useContext(WashContext);
  const list = (
    <div role="group" aria-labelledby={label ? labelId : undefined} className="flex flex-col gap-px">
      {children}
    </div>
  );

  if (!collapsible || !label) {
    return (
      <div className={cn("flex flex-col pt-3 first:pt-0.5", className)} {...rest}>
        {label && (
          <div className="flex h-7 items-center justify-between gap-2 pl-2 pr-1">
            <span id={labelId} className={labelText}>
              {label}
            </span>
            {action}
          </div>
        )}
        {list}
      </div>
    );
  }

  return (
    <Collapsible.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={(next) => onOpenChange?.(next)}
      className={cn("group/sg flex flex-col pt-3 first:pt-0.5", className)}
      {...rest}
    >
      <div className="relative flex h-7 items-center">
        <Collapsible.Trigger
          data-sidebar-row=""
          // The wash belongs to rows; leaving it behind would strand it over a row that is folding away.
          onPointerEnter={() => wash?.hide()}
          className={cn(
            "group/trigger relative flex h-full min-w-0 flex-1 items-center gap-1 rounded-md pl-2 pr-8 text-left outline-none",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
            "transition-[color,scale] duration-120 active:scale-[0.98] pointer-coarse:h-9",
          )}
        >
          <span id={labelId} className={cn(labelText, "truncate transition-colors duration-150 group-hover/trigger:text-fg-2")}>
            {label}
          </span>
          <ChevronRight
            size={12}
            className={cn(
              "shrink-0 text-fg-3 transition-[rotate,opacity] duration-200 ease-out-expo group-data-panel-open/trigger:rotate-90",
              // The chevron is a hint on pointers, always there on touch and whenever the section is folded.
              "opacity-0 group-hover/trigger:opacity-100 group-focus-visible/trigger:opacity-100 group-data-closed/sg:opacity-100 pointer-coarse:opacity-100",
            )}
          />
          {/* A folded section that hides the current page keeps a mark of it on its label. */}
          <span
            aria-hidden
            className="ml-0.5 size-1 shrink-0 scale-50 rounded-full bg-fg opacity-0 transition-[opacity,scale] duration-200 ease-out-expo group-data-closed/sg:group-has-[[aria-current=page]]/sg:scale-100 group-data-closed/sg:group-has-[[aria-current=page]]/sg:opacity-100"
          />
        </Collapsible.Trigger>
        {action && <div className="absolute right-1 top-1/2 -translate-y-1/2">{action}</div>}
      </div>
      <Collapsible.Panel
        hiddenUntilFound
        className={cn(
          "h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-220 ease-in-out-quart",
          "data-starting-style:h-0 data-ending-style:h-0 data-ending-style:duration-180 [&[hidden]:not([hidden=until-found])]:hidden",
        )}
      >
        <div className="transition-opacity duration-200 ease-out group-data-closed/sg:opacity-0 group-data-closed/sg:duration-120">{list}</div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Item
 * -----------------------------------------------------------------------------------------------*/

export type SidebarItemProps = Omit<useRender.ComponentProps<"a">, "children"> & {
  /** Identifies the item. It is active when it equals the sidebar's value. */
  value: string;
  /** A 16px icon. Use a letter tile or an avatar for teams and people. */
  icon?: React.ReactNode;
  /** Rolls when it changes and folds away at 0. */
  count?: number;
  /** Anything else at the end of the row: a shortcut, a status dot, a "New" chip. */
  trailing?: React.ReactNode;
  disabled?: boolean;
  children: React.ReactNode;
};

/**
 * A row in the sidebar. A link when it has an href (or a `render` element such as your
 * router's Link), otherwise a button. The active row carries aria-current="page".
 */
export function SidebarItem({ value, icon, count, trailing, disabled = false, render, className, children, onClick, onPointerEnter, href, ...rest }: SidebarItemProps) {
  const { value: current, select, pill } = useSidebar("SidebarItem");
  const wash = useContext(WashContext);
  const reduce = useReducedMotion();
  const active = current === value;
  const isLink = !!href || !!render;

  const element = useRender({
    defaultTagName: isLink ? "a" : "button",
    render: render as useRender.ComponentProps<"a">["render"],
    props: mergeProps<"a">(
      ({
        href: disabled ? undefined : href,
        "aria-current": active ? "page" : undefined,
        "aria-disabled": disabled || undefined,
        ...(isLink ? {} : ({ type: "button", disabled } as object)),
        "data-sidebar-row": "",
        "data-active": active || undefined,
        "data-disabled": disabled || undefined,
        onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
          if (disabled) return e.preventDefault();
          onClick?.(e);
          if (!e.defaultPrevented || isLink) select(value);
        },
        onPointerEnter: (e: React.PointerEvent<HTMLAnchorElement>) => {
          onPointerEnter?.(e);
          if (e.pointerType === "touch") return;
          if (disabled) wash?.hide();
          else wash?.show(e.currentTarget);
        },
        className: cn(
          "group/item relative flex h-8 w-full min-w-0 select-none items-center gap-2.5 rounded-md px-2 text-left text-[13px] leading-none text-fg-2 no-underline outline-none",
          "transition-[color,scale,background-color] duration-150 active:scale-[0.985] active:duration-75 pointer-coarse:h-11 pointer-coarse:active:bg-hover",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
          "hover:text-fg data-active:text-fg",
          // Outside a SidebarContent there is no shared wash, so the row lights itself.
          !wash && "hover:bg-hover",
          "data-disabled:pointer-events-none data-disabled:opacity-50",
          isLink && !disabled && "cursor-pointer",
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
            {icon && (
              <span aria-hidden className="relative grid size-4 shrink-0 place-items-center text-fg-3 transition-colors duration-150 group-hover/item:text-fg-2 group-data-active/item:text-fg [&_svg]:size-4">
                {icon}
              </span>
            )}
            <span className="relative min-w-0 flex-1 truncate py-0.5 leading-[18px]">{children}</span>
            {trailing && <span className="relative flex shrink-0 items-center">{trailing}</span>}
            <SidebarCount value={count} />
          </>
        ),
      } as useRender.ElementProps<"a">),
      rest,
    ),
  });

  return element;
}

// Counts roll digit by digit and fold away when they reach zero, so "3 unread" going
// to "read" is one continuous motion instead of a number that vanishes.
function SidebarCount({ value }: { value?: number }) {
  const reduce = useReducedMotion();
  const shown = typeof value === "number" && value > 0;
  return (
    <AnimatePresence initial={false}>
      {shown && (
        <motion.span
          key="count"
          className="relative -mr-0.5 flex h-4 min-w-4 shrink-0 items-center justify-end text-[11.5px] tabular text-fg-3 transition-colors duration-150 group-data-active/item:text-fg-2"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)", transition: { duration: 0.14 } }}
          transition={reduce ? { duration: 0.15 } : spring.pop}
        >
          <NumberFlow value={value} format={{ notation: value >= 1000 ? "compact" : "standard" }} />
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------------------------------
 * User
 * -----------------------------------------------------------------------------------------------*/

type Presence = "online" | "away" | "busy" | "offline";
const presenceLabel: Record<Presence, string> = { online: "Online", away: "Away", busy: "Do not disturb", offline: "Offline" };
const presenceClass: Record<Presence, string> = { online: "bg-success", away: "bg-warning", busy: "bg-danger", offline: "bg-fg-4" };

export type SidebarUserProps = Omit<useRender.ComponentProps<"button">, "children"> & {
  name: string;
  /** A second line: an email, a role, a plan. Truncates before the name does. */
  description?: string;
  /** Image URL. Falls back to initials if missing or broken. */
  avatar?: string;
  status?: Presence;
};

/**
 * The signed-in person, at the foot of the sidebar. A button, so it can open your
 * account menu: pass it to a menu trigger's `render` prop.
 */
export function SidebarUser({ name, description, avatar, status, render, className, ...rest }: SidebarUserProps) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

  return useRender({
    defaultTagName: "button",
    render,
    props: mergeProps<"button">(
      {
        type: "button",
        className: cn(
          "group/user flex h-11 w-full min-w-0 select-none items-center gap-2.5 rounded-lg px-1.5 text-left outline-none",
          "transition-[background-color,scale] duration-150 hover:bg-hover active:scale-[0.985] active:duration-75 data-popup-open:bg-hover",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
          className,
        ),
        children: (
          <>
            <span className="relative size-7 shrink-0">
              <span className="grid size-full place-items-center overflow-hidden rounded-full border border-line-2 bg-raised text-[11px] font-medium text-fg-2">
                {avatar && !broken ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="" width={28} height={28} className="size-full object-cover" onError={() => setBroken(true)} />
                ) : (
                  <span aria-hidden>{initials}</span>
                )}
              </span>
              {status && <span aria-hidden className={cn("absolute -bottom-px -right-px size-2.5 rounded-full border-2 border-frame", presenceClass[status])} />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[13px] font-medium leading-4 tracking-[-0.005em] text-fg">{name}</span>
              {description && <span className="truncate text-[11.5px] leading-[14px] text-fg-3">{description}</span>}
            </span>
            {status && <span className="sr-only">, {presenceLabel[status]}</span>}
            <ChevronsUpDown size={14} className="shrink-0 text-fg-3 transition-colors duration-150 group-hover/user:text-fg-2" />
          </>
        ),
      },
      rest,
    ),
  });
}
