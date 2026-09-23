"use client";
import { Dialog } from "@base-ui/react/dialog";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type MobileMenuItem = {
  label: string;
  /** Where the row goes. Rows with `items` open a nested view instead. */
  href?: string;
  /** One line under the label in nested views. */
  description?: string;
  /** A 16px icon, shown in nested views. */
  icon?: React.ReactNode;
  /** Children open as a view that slides in from the right. Nest as deep as you need. */
  items?: MobileMenuItem[];
};

/* -------------------------------------------------------------------------------------------------
 * The two-bar icon
 * -----------------------------------------------------------------------------------------------*/

// Two bars that meet in the middle and then turn into a cross; closing turns them
// back first and then parts them. The order is what makes it read as one object
// changing shape rather than two icons swapping.
function Bars({ open, reduce }: { open: boolean; reduce: boolean }) {
  const openT: Transition = reduce ? { duration: 0 } : { y: { duration: 0.14, ease: ease.out }, rotate: { ...spring.snappy, delay: 0.08 } };
  const closeT: Transition = reduce ? { duration: 0 } : { rotate: { duration: 0.14, ease: ease.out }, y: { duration: 0.16, ease: ease.out, delay: 0.1 } };
  return (
    <span aria-hidden className="relative block size-4">
      {[-1, 1].map((side) => (
        <motion.span
          key={side}
          className="absolute inset-x-px top-1/2 -mt-[0.75px] h-[1.5px] rounded-full bg-current"
          initial={{ y: side * 3.5, rotate: 0 }}
          animate={open ? { y: 0, rotate: side * 45 } : { y: side * 3.5, rotate: 0 }}
          transition={open ? openT : closeT}
        />
      ))}
    </span>
  );
}

const toggleClass = cn(
  "relative grid size-10 shrink-0 place-items-center rounded-lg text-fg outline-none",
  "transition-[background-color,scale] duration-150 hover:bg-hover active:scale-[0.92] active:duration-75",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
  "before:absolute before:-inset-0.5 before:content-['']",
);

/* -------------------------------------------------------------------------------------------------
 * Root
 * -----------------------------------------------------------------------------------------------*/

type Geometry = { left: number; top: number; width: number; height: number; panelTop: number };

export type MobileMenuProps = {
  items: MobileMenuItem[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The href of the page being shown; that row is marked current. */
  current?: string;
  /** Called when a link row is pressed, before the menu closes. Call preventDefault to handle routing yourself. */
  onNavigate?: (item: MobileMenuItem, event: React.MouseEvent<HTMLAnchorElement>) => void;
  /** Render link rows with your router's link. Spread the props onto it. */
  renderLink?: (item: MobileMenuItem, props: React.ComponentProps<"a">) => React.ReactElement;
  /** Pinned to the bottom of the panel, in thumb reach: sign in, start trial. */
  footer?: React.ReactNode;
  /** Render inside this element instead of the viewport (a frame, a preview). It needs position: relative. */
  container?: React.RefObject<HTMLElement | null>;
  /** Where the panel starts, in px from the top. Defaults to the bottom of the trigger's header. */
  top?: number;
  /** The dialog's accessible name. */
  title?: string;
  className?: string;
};

export function MobileMenu({
  items,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  current,
  onNavigate,
  renderLink,
  footer,
  container,
  top,
  title = "Menu",
  className,
}: MobileMenuProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const reduce = !!useReducedMotion();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [geo, setGeo] = useState<Geometry | null>(null);
  // The page's burger hides from the moment the menu opens until it has fully closed,
  // so the close button can morph back into it without two icons overlapping.
  const [settled, setSettled] = useState(!defaultOpen);
  const [path, setPath] = useState<number[]>([]);
  const [dir, setDir] = useState(1);
  const [drilled, setDrilled] = useState(false);
  const returnTo = useRef<string | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  // Measure where the burger is, so the close button lands exactly on it and the
  // panel starts right under the header it lives in.
  const measure = () => {
    const t = triggerRef.current;
    if (!t) return;
    const origin = container?.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const r = t.getBoundingClientRect();
    const header = t.closest("header")?.getBoundingClientRect();
    setGeo({
      left: r.left - origin.left,
      top: r.top - origin.top,
      width: r.width,
      height: r.height,
      panelTop: top ?? (header ? header.bottom : r.bottom + 8) - origin.top,
    });
  };

  useEffect(() => {
    if (!open) return;
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });

  // Drilling in focuses the new view's back button; going back returns focus to the
  // row that opened the view. Both happen after the view has mounted.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !drilled) return;
    const target = returnTo.current ? view.querySelector<HTMLElement>(`[data-row="${CSS.escape(returnTo.current)}"]`) : view.querySelector<HTMLElement>("[data-view-focus]");
    target?.focus({ preventScroll: true });
    returnTo.current = null;
  }, [path, drilled]);

  let list = items;
  const trail: MobileMenuItem[] = [];
  for (const i of path) {
    const next = list[i];
    if (!next?.items) break;
    trail.push(next);
    list = next.items;
  }
  const section = trail[trail.length - 1];

  const push = (i: number) => {
    setDir(1);
    setDrilled(true);
    returnTo.current = null;
    setPath((p) => [...p, i]);
  };
  const pop = () => {
    setDir(-1);
    returnTo.current = section?.label ?? null;
    setPath((p) => p.slice(0, -1));
  };

  const views = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { x: d > 0 ? "100%" : "-24%", opacity: d > 0 ? 1 : 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => (reduce ? { opacity: 0 } : { x: d > 0 ? "-24%" : "100%", opacity: d > 0 ? 0 : 1 }),
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next, details) => {
        // Escape inside a nested view steps back one level instead of closing everything.
        if (!next && details.reason === "escape-key" && path.length) {
          details.cancel();
          pop();
          return;
        }
        if (next) {
          measure();
          setSettled(false);
          setPath([]);
          setDrilled(false);
        }
        setOpen(next);
      }}
      onOpenChangeComplete={(next) => {
        if (!next) setSettled(true);
      }}
    >
      <Dialog.Trigger ref={triggerRef} aria-label="Open menu" data-hidden={!settled || undefined} className={cn(toggleClass, "data-hidden:opacity-0", className)}>
        <Bars open={false} reduce={reduce} />
      </Dialog.Trigger>

      <Dialog.Portal container={container}>
        <Dialog.Popup
          // The popup is a transparent sheet over everything; only the close button and
          // the panel take pointer events. Its own near-invisible fade exists so Base UI
          // waits for the panel's exit before unmounting.
          className={cn(
            "group/popup inset-0 z-(--z-dialog) outline-none pointer-events-none",
            container ? "absolute" : "fixed",
            "transition-opacity duration-320 data-starting-style:opacity-[0.99] data-ending-style:opacity-[0.99] data-ending-style:duration-240",
          )}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {geo && (
            <Dialog.Close aria-label="Close menu" className={cn(toggleClass, "pointer-events-auto absolute")} style={{ left: geo.left, top: geo.top, width: geo.width, height: geo.height }}>
              <Bars open={open} reduce={reduce} />
            </Dialog.Close>
          )}

          <div
            className={cn(
              "pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col border-t border-line bg-frame",
              // The panel unrolls from the header down, and rolls back up faster.
              "[clip-path:inset(0_0_0_0)] transition-[clip-path] duration-320 ease-drawer",
              "group-data-starting-style/popup:[clip-path:inset(0_0_100%_0)] group-data-ending-style/popup:[clip-path:inset(0_0_100%_0)] group-data-ending-style/popup:duration-240",
              "motion-reduce:transition-opacity motion-reduce:group-data-starting-style/popup:opacity-0 motion-reduce:group-data-ending-style/popup:opacity-0",
            )}
            style={{ top: geo?.panelTop ?? 56 }}
          >
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <AnimatePresence initial={false} custom={dir} mode="popLayout">
                <motion.div
                  key={path.join(".") || "root"}
                  ref={viewRef}
                  custom={dir}
                  variants={views}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={reduce ? { duration: 0.15 } : { duration: 0.36, ease: ease.drawer }}
                  className="absolute inset-0 overflow-y-auto overscroll-contain bg-frame px-4 pb-6 pt-2"
                >
                  {section && (
                    <div className="mb-2">
                      <button
                        type="button"
                        data-view-focus=""
                        onClick={pop}
                        className="-ml-2 flex h-11 items-center gap-1 rounded-lg pl-1 pr-3 text-[15px] text-fg-2 outline-none transition-[color,scale] duration-150 active:scale-[0.97] hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3"
                      >
                        <ChevronLeft size={18} />
                        {trail[trail.length - 2]?.label ?? title}
                      </button>
                      <h2 className="px-0.5 pt-1 text-[22px] font-medium leading-tight tracking-[-0.02em] text-fg">{section.label}</h2>
                    </div>
                  )}
                  <ul className={cn("flex flex-col", !section && "divide-y divide-line")}>
                    {list.map((item, i) => (
                      <Row
                        key={item.label}
                        item={item}
                        index={i}
                        nested={!!section}
                        stagger={!drilled && !section}
                        reduce={reduce}
                        current={!!current && item.href === current}
                        onOpen={() => push(i)}
                        onNavigate={(e) => {
                          onNavigate?.(item, e);
                          setOpen(false);
                        }}
                        renderLink={renderLink}
                      />
                    ))}
                  </ul>
                </motion.div>
              </AnimatePresence>
            </div>
            {footer && <div className="flex shrink-0 gap-2 border-t border-line p-4 pb-[max(16px,env(safe-area-inset-bottom))] *:flex-1">{footer}</div>}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Rows
 * -----------------------------------------------------------------------------------------------*/

function Row({
  item,
  index,
  nested,
  stagger,
  reduce,
  current,
  onOpen,
  onNavigate,
  renderLink,
}: {
  item: MobileMenuItem;
  index: number;
  nested: boolean;
  stagger: boolean;
  reduce: boolean;
  current: boolean;
  onOpen: () => void;
  onNavigate: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  renderLink?: MobileMenuProps["renderLink"];
}) {
  const rowClass = cn(
    "group/row flex w-full min-w-0 items-center gap-3 rounded-lg text-left text-fg no-underline outline-none",
    "transition-[background-color,scale] duration-150 active:scale-[0.985] active:bg-hover active:duration-75",
    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
    nested ? "min-h-14 px-2 py-2.5 -mx-2 w-[calc(100%+16px)]" : "h-14 text-[17px] font-medium tracking-[-0.01em]",
  );

  const body = (
    <>
      {nested && item.icon && (
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg border border-line-2 bg-raised text-fg-2 [&_svg]:size-4">
          {item.icon}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("truncate", nested && "text-[15px] font-medium tracking-[-0.01em]")}>{item.label}</span>
        {nested && item.description && <span className="line-clamp-2 text-[13px] leading-[18px] text-fg-3">{item.description}</span>}
      </span>
      {current && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-fg" />}
      {item.items && <ChevronRight size={18} className="shrink-0 text-fg-3 transition-transform duration-150 group-active/row:translate-x-0.5" />}
    </>
  );

  let control: React.ReactNode;
  if (item.items) {
    control = (
      <button type="button" data-row={item.label} onClick={onOpen} className={rowClass}>
        {body}
      </button>
    );
  } else {
    const props: React.ComponentProps<"a"> = {
      href: item.href,
      "aria-current": current ? "page" : undefined,
      className: rowClass,
      onClick: onNavigate,
      children: body,
    };
    control = renderLink ? renderLink(item, props) : <a {...props} />;
  }

  // Rows arrive one after another only when the menu opens; views reached by drilling
  // in slide as a whole, and nothing restaggers on the way back.
  return (
    <motion.li
      initial={stagger ? (reduce ? { opacity: 0 } : { opacity: 0, y: 10 }) : false}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0.15 } : { duration: 0.34, ease: ease.out, delay: 0.08 + Math.min(index, 7) * 0.03 }}
    >
      {control}
    </motion.li>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Close
 * -----------------------------------------------------------------------------------------------*/

export type MobileMenuCloseProps = React.ComponentProps<typeof Dialog.Close>;

/** Closes the menu. Use it for footer buttons: pass your button or link through `render`. */
export function MobileMenuClose(props: MobileMenuCloseProps) {
  return <Dialog.Close {...props} />;
}
