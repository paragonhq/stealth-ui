"use client";
import { Menu } from "@base-ui/react/menu";
import { Tooltip } from "@base-ui/react/tooltip";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ChevronRight, MoreH } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

export type BreadcrumbItem = {
  label: string;
  href?: string;
  /** Decorative icon before the label: a workspace mark, a folder. */
  icon?: React.ReactNode;
};

type LinkProps = React.ComponentProps<"a"> & { href: string };

export type BreadcrumbsProps = Omit<React.ComponentProps<"nav">, "children"> & {
  /** From the root to the current page. The last item is the page you're on. */
  items: BreadcrumbItem[];
  separator?: "chevron" | "slash";
  /**
   * "auto" folds middle items into a menu when the trail doesn't fit its container.
   * A number folds them whenever there are more items than that.
   */
  maxItems?: number | "auto";
  /** With a numeric maxItems, items always kept visible after the folded ones, the current page included. */
  itemsAfterCollapse?: number;
  /** Longest a single label may draw, in px, before it truncates. */
  maxItemWidth?: number;
  size?: "sm" | "md";
  /** Render links with your router's Link. Receives everything an anchor needs. */
  renderLink?: (props: LinkProps, item: BreadcrumbItem) => React.ReactElement;
  /** Called when a crumb or a folded item is chosen, before navigation. */
  onItemClick?: (item: BreadcrumbItem, index: number, event: React.MouseEvent) => void;
};

export function Breadcrumbs({
  items,
  separator = "chevron",
  maxItems = "auto",
  itemsAfterCollapse = 2,
  maxItemWidth = 180,
  size = "md",
  renderLink,
  onItemClick,
  className,
  style,
  ...rest
}: BreadcrumbsProps) {
  const reduce = useReducedMotion();
  const measureRef = useRef<HTMLOListElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const fixed = typeof maxItems === "number" ? Math.max(0, items.length - Math.max(2, maxItems)) : 0;
  const [fitted, setFitted] = useState(0);
  // A fixed limit keeps itemsAfterCollapse; fitting to width may fold everything between the
  // first item and the current page, because the page you're on matters more than its parent.
  const hiddenCount = typeof maxItems === "number" ? Math.min(fixed, Math.max(0, items.length - 1 - itemsAfterCollapse)) : Math.min(fitted, Math.max(0, items.length - 2));

  // How many middle items to fold is measured from an invisible copy of the whole trail,
  // so the answer never depends on what's currently folded and resizing can't oscillate.
  useEffect(() => {
    if (maxItems !== "auto") return;
    const nav = navRef.current;
    const measure = measureRef.current;
    if (!nav || !measure) return;
    const fit = () => {
      const available = nav.clientWidth;
      const crumbs = [...measure.querySelectorAll<HTMLElement>("[data-measure=crumb]")].map((el) => el.offsetWidth);
      const sep = measure.querySelector<HTMLElement>("[data-measure=sep]")?.offsetWidth ?? 0;
      const more = measure.querySelector<HTMLElement>("[data-measure=more]")?.offsetWidth ?? 0;
      const n = crumbs.length;
      const full = crumbs.reduce((a, b) => a + b, 0) + sep * (n - 1);
      if (full <= available || n < 3) return setFitted(0);
      // Fold from the second item onward, oldest first, until the rest fits.
      for (let k = 1; k <= n - 2; k++) {
        const kept = crumbs[0] + crumbs.slice(k + 1).reduce((a, b) => a + b, 0);
        if (kept + more + sep * (n - k) <= available) return setFitted(k);
      }
      setFitted(n - 2);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(nav);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [maxItems, items]);

  const folded = hiddenCount > 0 ? items.slice(1, 1 + hiddenCount) : [];
  const visible = items.map((item, index) => ({ item, index })).filter(({ index }) => index === 0 || index > hiddenCount);
  const text = size === "sm" ? "text-[12.5px]" : "text-[13px]";
  const vars = { "--crumb-max": `${maxItemWidth}px`, ...style } as React.CSSProperties;

  const sepEl = <Separator kind={separator} size={size} />;

  return (
    <nav ref={navRef} aria-label="Breadcrumb" data-size={size} className={cn("relative min-w-0", text, className)} style={vars} {...rest}>
      {/* The measuring copy: laid out like the real trail, never seen or read. */}
      {maxItems === "auto" && (
        <ol ref={measureRef} aria-hidden inert className="pointer-events-none invisible absolute top-0 left-0 flex h-0 items-center overflow-hidden whitespace-nowrap">
          {items.map((item, i) => (
            <li key={i} data-measure="crumb" className="flex shrink-0 items-center">
              <CrumbFace item={item} current={i === items.length - 1} size={size} />
            </li>
          ))}
          <li data-measure="sep" className="flex shrink-0">
            {sepEl}
          </li>
          <li data-measure="more" className={cn("flex shrink-0", moreClass(size))} />
        </ol>
      )}

      <Tooltip.Provider delay={500} closeDelay={0}>
        <ol className="flex min-w-0 flex-nowrap items-center">
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map(({ item, index }, position) => {
              const current = index === items.length - 1;
              return (
                <motion.li
                  key={`${index}:${item.href ?? item.label}`}
                  // A crumb added by going deeper slides in from the one before it; crumbs
                  // dropped by going back fade where they are.
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: -6, filter: "blur(2px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  transition={{ duration: reduce ? 0.15 : 0.24, ease: ease.out }}
                  className={cn("flex items-center", current ? "min-w-0 shrink" : "shrink-0", position === 0 && !current && "min-w-0 shrink")}
                >
                  {position > 0 && sepEl}
                  {position === 1 && folded.length > 0 && (
                    <>
                      <FoldedMenu items={folded} offset={1} size={size} renderLink={renderLink} onItemClick={onItemClick} />
                      {sepEl}
                    </>
                  )}
                  <Crumb item={item} index={index} current={current} size={size} renderLink={renderLink} onItemClick={onItemClick} />
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      </Tooltip.Provider>
    </nav>
  );
}

/* -------------------------------------------------------------------------------------------------
 * A crumb, and its full name when it's cut short
 * -----------------------------------------------------------------------------------------------*/

const crumbClass = (size: "sm" | "md") =>
  cn(
    "relative flex min-w-0 items-center gap-1.5 rounded-md outline-none",
    size === "sm" ? "h-6 px-1" : "h-7 px-1.5",
    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
  );

function CrumbFace({ item, current, size }: { item: BreadcrumbItem; current: boolean; size: "sm" | "md" }) {
  return (
    <span className={crumbClass(size)}>
      {item.icon && <span className="flex shrink-0 [&_svg]:size-3.5">{item.icon}</span>}
      <span className={cn("max-w-(--crumb-max) truncate", current && "font-medium")}>{item.label}</span>
    </span>
  );
}

function Crumb({
  item,
  index,
  current,
  size,
  renderLink,
  onItemClick,
}: {
  item: BreadcrumbItem;
  index: number;
  current: boolean;
  size: "sm" | "md";
  renderLink?: BreadcrumbsProps["renderLink"];
  onItemClick?: BreadcrumbsProps["onItemClick"];
}) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  const face = (
    <>
      {item.icon && <span aria-hidden className={cn("flex shrink-0 transition-colors duration-150 [&_svg]:size-3.5", current ? "text-fg-2" : "text-fg-4 group-hover/crumb:text-fg-3")}>{item.icon}</span>}
      <span ref={labelRef} className={cn("max-w-(--crumb-max) truncate", current && "font-medium")}>
        {item.label}
      </span>
    </>
  );

  const linkClass = cn(
    crumbClass(size),
    "group/crumb touch-manipulation text-fg-3 transition-[color,background-color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75",
    // A 44px tall hit area on touch without changing the drawing.
    "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2 pointer-coarse:after:content-['']",
  );

  const trigger = current || !item.href ? (
    <span aria-current={current ? "page" : undefined} tabIndex={current ? -1 : undefined} className={cn(crumbClass(size), current ? "text-fg" : "text-fg-3")}>
      {face}
    </span>
  ) : renderLink ? (
    renderLink({ href: item.href, className: linkClass, children: face, onClick: (e) => onItemClick?.(item, index, e) }, item)
  ) : (
    <a href={item.href} className={linkClass} onClick={(e) => onItemClick?.(item, index, e)}>
      {face}
    </a>
  );

  // The full label shows only when this one is actually cut short.
  return (
    <Tooltip.Root
      open={open}
      onOpenChange={(next) => {
        const el = labelRef.current;
        setOpen(next && !!el && el.scrollWidth > el.clientWidth + 1);
      }}
    >
      <Tooltip.Trigger render={trigger} />
      <Tooltip.Portal>
        <Tooltip.Positioner side="bottom" sideOffset={6} collisionPadding={8} className="z-(--z-tooltip)">
          <Tooltip.Popup
            className={cn(
              "max-w-[min(24rem,var(--available-width))] origin-(--transform-origin) rounded-lg border border-line-2 bg-raised px-2 py-1 text-[12px] leading-4 break-words text-fg shadow-pop",
              "transition-[opacity,scale] duration-140 ease-out-expo data-ending-style:duration-100",
              "data-starting-style:scale-[0.97] data-starting-style:opacity-0 data-ending-style:opacity-0",
              "data-instant:duration-0 motion-reduce:data-starting-style:scale-100",
            )}
          >
            {item.label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function Separator({ kind, size }: { kind: "chevron" | "slash"; size: "sm" | "md" }) {
  return (
    <span aria-hidden className={cn("flex shrink-0 select-none items-center justify-center text-fg-4", size === "sm" ? "w-4" : "w-5")}>
      {kind === "chevron" ? <ChevronRight size={size === "sm" ? 12 : 14} /> : <span className="text-[1.05em] font-light">/</span>}
    </span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * The folded middle
 * -----------------------------------------------------------------------------------------------*/

const moreClass = (size: "sm" | "md") => cn("inline-flex shrink-0 items-center justify-center rounded-md", size === "sm" ? "h-6 w-7" : "h-7 w-8");

function FoldedMenu({
  items,
  offset,
  size,
  renderLink,
  onItemClick,
}: {
  items: BreadcrumbItem[];
  offset: number;
  size: "sm" | "md";
  renderLink?: BreadcrumbsProps["renderLink"];
  onItemClick?: BreadcrumbsProps["onItemClick"];
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Show ${items.length} more ${items.length === 1 ? "level" : "levels"}`}
        className={cn(
          moreClass(size),
          "relative text-fg-3 outline-none transition-[color,background-color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
          "data-popup-open:bg-hover data-popup-open:text-fg",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
          "pointer-coarse:after:absolute pointer-coarse:after:-inset-2 pointer-coarse:after:content-['']",
        )}
      >
        <MoreH size={16} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" sideOffset={6} collisionPadding={8} className="z-(--z-dropdown) outline-none">
          <Menu.Popup
            className={cn(
              "relative isolate max-h-(--available-height) min-w-44 max-w-[min(20rem,var(--available-width))] overflow-y-auto overscroll-contain rounded-xl border border-line-2 bg-raised p-1 text-fg shadow-pop outline-none",
              "origin-(--transform-origin) transition-[opacity,scale,translate] duration-180 ease-out-expo",
              "data-starting-style:-translate-y-1 data-starting-style:scale-96 data-starting-style:opacity-0",
              "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-120",
              "data-instant:duration-0 motion-reduce:translate-none motion-reduce:scale-100",
            )}
          >
            <Glide />
            {items.map((item, i) => {
              const index = offset + i;
              const face = (
                <>
                  {/* Each folded level is indented one step, so the menu still reads as a path. */}
                  <span aria-hidden className="shrink-0" style={{ width: Math.min(i, 4) * 10 }} />
                  <span className="flex shrink-0 text-fg-4 [&_svg]:size-3.5">{item.icon ?? <FolderGlyph />}</span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </>
              );
              const cls = "relative flex h-8 cursor-default items-center gap-2 rounded-lg pr-2.5 pl-2 text-[13px] text-fg-2 outline-none select-none data-highlighted:text-fg pointer-coarse:h-10";
              return (
                <Menu.LinkItem
                  key={index}
                  href={item.href}
                  closeOnClick
                  label={item.label}
                  className={cls}
                  onClick={(e) => onItemClick?.(item, index, e)}
                  render={renderLink && item.href ? (props) => renderLink({ ...(props as LinkProps), href: item.href! }, item) : undefined}
                >
                  {face}
                </Menu.LinkItem>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

// One highlight for the menu: it springs after the pointer and jumps for arrow keys.
function Glide() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const height = useMotionValue(32);
  const opacity = useMotionValue(0);

  useEffect(() => {
    const popup = ref.current?.parentElement;
    if (!popup) return;
    let keyboard = false;
    let shown = false;
    const place = () => {
      const el = popup.querySelector<HTMLElement>("[data-highlighted]");
      if (!el) {
        shown = false;
        animate(opacity, 0, { duration: 0.12 });
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
    const onMove = () => (keyboard = false);
    const observer = new MutationObserver(place);
    observer.observe(popup, { subtree: true, attributes: true, attributeFilter: ["data-highlighted"] });
    popup.addEventListener("keydown", onKey, true);
    popup.addEventListener("pointermove", onMove, true);
    return () => {
      observer.disconnect();
      popup.removeEventListener("keydown", onKey, true);
      popup.removeEventListener("pointermove", onMove, true);
    };
  }, [reduce, y, height, opacity]);

  return <motion.div ref={ref} aria-hidden style={{ y, height, opacity }} className="pointer-events-none absolute inset-x-1 top-0 -z-10 rounded-lg bg-fg/[0.06]" />;
}

function FolderGlyph() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" aria-hidden>
      <path d="M2.5 4.25c0-.4.35-.75.75-.75h3l1.5 1.5h5c.4 0 .75.35.75.75v6.5c0 .4-.35.75-.75.75h-9.5a.75.75 0 0 1-.75-.75z" />
    </svg>
  );
}
