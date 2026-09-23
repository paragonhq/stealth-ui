"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { cloneElement, createContext, isValidElement, useContext, useId } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * Context
 * -----------------------------------------------------------------------------------------------*/

type TabBarContext = {
  value: string;
  select: (value: string) => void;
  onReselect?: (value: string) => void;
  indicator: boolean;
  layoutId: string;
  reduce: boolean;
};

const Ctx = createContext<TabBarContext | null>(null);
const useTabBar = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("TabBarItem must be used inside TabBar");
  return ctx;
};

/* -------------------------------------------------------------------------------------------------
 * TabBar
 * -----------------------------------------------------------------------------------------------*/

export type TabBarProps = Omit<React.ComponentProps<"nav">, "defaultValue"> & {
  /** The active item's value. Pair with onValueChange to control it. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Called when the active item is pressed again. Scroll its view to the top here. */
  onReselect?: (value: string) => void;
  /** fixed pins to the viewport; absolute pins to the nearest positioned parent (a phone frame, a demo). */
  position?: "fixed" | "absolute" | "static";
  /** A soft pill behind the active icon that slides between items. */
  indicator?: boolean;
};

/**
 * A phone's bottom navigation: 3–5 destinations, icon over label, sat above the
 * home indicator. The active icon fills, and one pill slides to it.
 */
export function TabBar({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  onReselect,
  position = "fixed",
  indicator = true,
  className,
  style,
  children,
  "aria-label": ariaLabel = "Main",
  ...rest
}: TabBarProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const reduce = !!useReducedMotion();
  const layoutId = useId();

  return (
    <Ctx.Provider value={{ value, select: setValue, onReselect, indicator, layoutId, reduce }}>
      <nav
        aria-label={ariaLabel}
        data-position={position}
        style={{ "--tab-cut": "var(--frame)", ...style } as React.CSSProperties}
        className={cn(
          "select-none border-t border-line bg-frame/92 backdrop-blur-md backdrop-saturate-150",
          // Sits above the home indicator. --tab-bar-inset is the floor on devices without one
          // (and lets a mock phone frame fake the inset).
          "pb-[max(var(--tab-bar-inset,6px),env(safe-area-inset-bottom))]",
          position === "fixed" && "fixed inset-x-0 bottom-0 z-(--z-sticky)",
          position === "absolute" && "absolute inset-x-0 bottom-0 z-(--z-sticky)",
          className,
        )}
        {...rest}
      >
        <LayoutGroup id={layoutId}>
          <ul className="mx-auto flex h-[52px] max-w-lg items-stretch px-1">{children}</ul>
        </LayoutGroup>
      </nav>
    </Ctx.Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * TabBarItem
 * -----------------------------------------------------------------------------------------------*/

export type TabBarItemProps = Omit<React.ComponentProps<"button">, "value" | "children"> & {
  value: string;
  label: string;
  /**
   * The icon. Draw it with `data-fill` on the shapes that fill when active and `data-cut` on
   * the details that turn into cut-outs; TabBarIcons are drawn this way. A function receives
   * the active state if you'd rather swap two glyphs yourself.
   */
  icon: React.ReactNode | ((active: boolean) => React.ReactNode);
  /** A number shows a rolling count (99+ past 99); true shows a dot. 0 or false hides it. */
  badge?: number | boolean;
  /** What the badge means, read after the label. Defaults to "N new" or "New activity". */
  badgeLabel?: string;
  /** Renders a link instead of a button. */
  href?: string;
  /** Your own element (a router Link) to render the item as. It receives every prop and the content. */
  render?: React.ReactElement<Record<string, unknown>>;
};

export function TabBarItem({
  value,
  label,
  icon,
  badge,
  badgeLabel,
  href,
  render,
  disabled,
  className,
  onClick,
  ...rest
}: TabBarItemProps) {
  const { value: current, select, onReselect, indicator, reduce } = useTabBar();
  const active = current === value;
  const count = typeof badge === "number" ? badge : 0;
  const showBadge = badge === true || count > 0;
  const announce = badgeLabel ?? (typeof badge === "number" ? `${count} new` : "New activity");

  const handle = (e: React.MouseEvent<HTMLElement>) => {
    onClick?.(e as React.MouseEvent<HTMLButtonElement>);
    if (e.defaultPrevented || disabled) return;
    if (active) onReselect?.(value);
    else select(value);
  };

  const props = {
    ...rest,
    "data-active": active ? "" : undefined,
    "data-disabled": disabled ? "" : undefined,
    "aria-current": active ? ("page" as const) : undefined,
    "aria-disabled": disabled || undefined,
    onClick: handle,
    className: cn(
      "group/tab relative flex h-full w-full min-w-0 flex-col items-center justify-center gap-[3px] rounded-xl pt-1",
      "touch-manipulation [-webkit-tap-highlight-color:transparent] outline-none",
      "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
      "text-fg-3 transition-colors duration-150 hover:text-fg-2 data-active:text-fg",
      "data-disabled:pointer-events-none data-disabled:opacity-40",
      className,
    ),
  };

  const content = (
    <>
      <span className="relative grid h-7 w-14 place-items-center">
        {indicator && active && (
          <motion.span
            layoutId="indicator"
            aria-hidden
            className="absolute inset-0 rounded-full bg-fg/[0.08]"
            transition={reduce ? { duration: 0 } : spring.snappy}
          />
        )}
        <span
          className={cn(
            "relative grid size-6 place-items-center [&_svg]:size-6",
            // The press: the icon gives a little under the thumb and settles back.
            "transition-transform duration-200 ease-out-expo group-active/tab:scale-[0.86] group-active/tab:duration-100 motion-reduce:transform-none",
            // The morph: shapes marked data-fill fill in, details marked data-cut become cut-outs, strokes firm up.
            "[&_path,&_circle,&_rect]:transition-[fill-opacity,stroke,stroke-width,fill] [&_path,&_circle,&_rect]:duration-200 [&_path,&_circle,&_rect]:ease-out-expo",
            "[&_[data-fill]]:fill-current [&_[data-fill]]:[fill-opacity:0] group-data-active/tab:[&_[data-fill]]:[fill-opacity:1]",
            "[&_[data-cut]]:[fill:transparent] group-data-active/tab:[&_[data-cut]]:[fill:var(--tab-cut)] group-data-active/tab:[&_[data-cut]]:[stroke:var(--tab-cut)]",
            "group-data-active/tab:[&_[data-bold]]:[stroke-width:2.1]",
          )}
        >
          {typeof icon === "function" ? icon(active) : icon}
        </span>
        <Badge show={showBadge} count={count} dot={badge === true} reduce={reduce} />
      </span>
      <span className="max-w-full truncate px-0.5 text-[10.5px] font-medium leading-[14px] tracking-[0.01em]">{label}</span>
      {showBadge && <span className="sr-only">, {announce}</span>}
    </>
  );

  let el: React.ReactNode;
  if (render && isValidElement(render)) el = cloneElement(render, { ...props, href: href ?? (render.props.href as string | undefined) }, content);
  else if (href) el = <a href={disabled ? undefined : href} {...(props as React.ComponentProps<"a">)}>{content}</a>;
  else el = <button type="button" disabled={disabled} {...props}>{content}</button>;

  return <li className="flex min-w-0 flex-1 justify-center">{el}</li>;
}

// The badge pops in from the icon's corner the moment a count arrives, rolls its
// digits as the count changes, and shrinks back into the corner at zero. Its ring
// is the bar's own color so it reads as cut out of the icon.
function Badge({ show, count, dot, reduce }: { show: boolean; count: number; dot: boolean; reduce: boolean }) {
  const capped = Math.min(count, 99);
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.span
          key="badge"
          aria-hidden
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4, transition: { duration: 0.14 } }}
          transition={reduce ? { duration: 0.15 } : spring.pop}
          className={cn(
            "absolute left-[calc(50%+5px)] origin-bottom-left rounded-full bg-fg text-frame ring-2 ring-(--tab-cut)",
            dot ? "top-0.5 size-2" : "-top-0.5 flex h-4 min-w-4 items-center justify-center px-1 text-[10px] font-semibold leading-none tabular",
          )}
        >
          {!dot && <NumberFlow value={capped} suffix={count > 99 ? "+" : undefined} className="[--number-flow-mask-height:0.15em]" />}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Icons: 24px grid, 1.6 stroke, marked up for the fill morph
 * -----------------------------------------------------------------------------------------------*/

const svg = (children: React.ReactNode, name: string) => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable={false} {...props}>
      {children}
    </svg>
  );
  Icon.displayName = name;
  return Icon;
};

/** Tab icons drawn for the outline-to-filled morph. Use them as-is, or copy the data-fill / data-cut markup. */
export const TabBarIcons = {
  Home: svg(
    <>
      <path data-fill d="M3.75 10.4 12 3.75l8.25 6.65v8.85a1 1 0 0 1-1 1H4.75a1 1 0 0 1-1-1z" />
      <path data-cut d="M9.75 20.25v-4.5a1 1 0 0 1 1-1h2.5a1 1 0 0 1 1 1v4.5z" />
    </>,
    "TabHome",
  ),
  Search: svg(
    <>
      <circle data-bold cx="10.75" cy="10.75" r="6.25" />
      <path data-bold d="m15.5 15.5 4.75 4.75" />
    </>,
    "TabSearch",
  ),
  Inbox: svg(
    <>
      <path data-fill d="M3.75 13.25 6.1 5.6a1.5 1.5 0 0 1 1.43-1.1h8.94a1.5 1.5 0 0 1 1.43 1.1l2.35 7.65v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5z" />
      <path data-cut d="M4 13.25h4.25l1 2.25h5.5l1-2.25H20" />
    </>,
    "TabInbox",
  ),
  Bell: svg(
    <>
      <path data-fill d="M6 16.75V11a6 6 0 0 1 12 0v5.75l1.5 1.5h-15z" />
      <path data-bold d="M10 20.75a2.25 2.25 0 0 0 4 0" />
    </>,
    "TabBell",
  ),
  User: svg(
    <>
      <circle data-fill cx="12" cy="8.25" r="3.75" />
      <path data-fill d="M4.75 20.25c.55-3.65 3.55-5.75 7.25-5.75s6.7 2.1 7.25 5.75z" />
    </>,
    "TabUser",
  ),
  Calendar: svg(
    <>
      <rect data-fill x="3.75" y="5" width="16.5" height="15.25" rx="2.25" />
      <path data-cut d="M4 9.75h16" />
      <path d="M8 3v3.5M16 3v3.5" />
    </>,
    "TabCalendar",
  ),
  Chart: svg(
    <>
      <rect data-fill x="4" y="12" width="4" height="8" rx="1" />
      <rect data-fill x="10" y="7.5" width="4" height="12.5" rx="1" />
      <rect data-fill x="16" y="4" width="4" height="16" rx="1" />
    </>,
    "TabChart",
  ),
};
