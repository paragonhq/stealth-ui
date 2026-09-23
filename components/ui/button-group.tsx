"use client";
import { motion, useReducedMotion } from "motion/react";
import { Children, Fragment, isValidElement, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

export type ButtonGroupProps = Omit<React.ComponentProps<"div">, "role"> & {
  orientation?: "horizontal" | "vertical";
  /** Names the group for screen readers ("Zoom", "Page navigation"). */
  "aria-label"?: string;
};

type Rect = { x: number; y: number; w: number; h: number };
type Glide = { rect: Rect; shown: boolean; instant: boolean; pressed: boolean };

// How far the hover wash sits inside each segment, in px.
const INSET = 3;

/**
 * Buttons that read as one object: one border, one shadow, hairlines between,
 * and a single hover wash that glides from segment to segment instead of each
 * one lighting up on its own. Button and IconButton flatten themselves inside it.
 */
export function ButtonGroup({ orientation = "horizontal", className, children, onPointerLeave, ...rest }: ButtonGroupProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [glide, setGlide] = useState<Glide>({ rect: { x: 0, y: 0, w: 0, h: 0 }, shown: false, instant: true, pressed: false });
  const vertical = orientation === "vertical";
  const items = Children.toArray(children).filter(isValidElement);

  const segmentFor = (target: EventTarget | null) => {
    const root = ref.current;
    if (!root || !(target instanceof Element)) return null;
    for (const el of Array.from(root.children) as HTMLElement[]) {
      if (el.dataset.groupPart) continue;
      if (!el.contains(target)) continue;
      if (el.matches(":disabled, [aria-disabled='true'], [data-disabled]")) return null;
      return el;
    }
    return null;
  };
  const rectOf = (el: HTMLElement): Rect => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });

  // An open menu keeps the wash under its trigger until it closes.
  const openTrigger = () => (Array.from(ref.current?.children ?? []) as HTMLElement[]).find((el) => el.matches("[aria-expanded='true']"));
  const settle = () => {
    const open = openTrigger();
    setGlide((g) => (open ? { ...g, rect: rectOf(open), shown: true, pressed: false } : { ...g, shown: false, pressed: false }));
  };

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const observer = new MutationObserver(() => {
      if (root.matches(":hover")) return;
      const open = (Array.from(root.children) as HTMLElement[]).find((el) => el.matches("[aria-expanded='true']"));
      setGlide((g) => (open ? { ...g, rect: rectOf(open), shown: true } : { ...g, shown: false, pressed: false }));
    });
    observer.observe(root, { attributes: true, subtree: true, attributeFilter: ["aria-expanded"] });
    return () => observer.disconnect();
  }, []);

  const move = (e: React.PointerEvent, pressed?: boolean) => {
    // Events from a portaled menu bubble here through React; to the eye the pointer has left.
    if (!(e.target instanceof Node) || !ref.current?.contains(e.target)) return settle();
    if (e.pointerType !== "mouse" && pressed === undefined) return;
    const el = segmentFor(e.target);
    if (!el) return setGlide((g) => ({ ...g, shown: false, pressed: false }));
    const rect = rectOf(el);
    setGlide((g) => ({ rect, shown: true, instant: !g.shown, pressed: pressed ?? g.pressed }));
  };

  const t = glide.instant || reduce ? { duration: 0 } : spring.follow;

  return (
    <div
      ref={ref}
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      onPointerMove={(e) => move(e)}
      onPointerDown={(e) => move(e, true)}
      onPointerUp={(e) => (e.pointerType === "mouse" ? move(e, false) : setGlide((g) => ({ ...g, shown: false, pressed: false })))}
      onPointerCancel={() => setGlide((g) => ({ ...g, shown: false, pressed: false }))}
      onPointerLeave={(e) => {
        onPointerLeave?.(e);
        settle();
      }}
      className={cn(
        "group/bg relative isolate inline-flex shrink-0 rounded-lg border border-line-2 bg-raised shadow-[var(--shadow)]",
        "has-[[data-size=sm]]:rounded-md",
        vertical ? "flex-col" : "flex-row items-stretch",
        className,
      )}
      {...rest}
    >
      <motion.span
        aria-hidden
        data-group-part="glide"
        className="pointer-events-none absolute left-0 top-0 -z-10 rounded-[5px] bg-fg/[0.07] group-has-[[data-size=sm]]/bg:rounded-[3px]"
        initial={false}
        animate={{
          x: glide.rect.x + INSET,
          y: glide.rect.y + INSET,
          width: Math.max(0, glide.rect.w - INSET * 2),
          height: Math.max(0, glide.rect.h - INSET * 2),
          opacity: glide.shown ? 1 : 0,
          scale: glide.pressed && !reduce ? 0.94 : 1,
        }}
        transition={{
          x: t,
          y: t,
          width: t,
          height: t,
          opacity: { duration: glide.shown ? 0.12 : 0.15 },
          scale: glide.pressed ? { duration: 0.08 } : spring.snappy,
        }}
      />
      {items.map((child, i) => (
        <Fragment key={child.key ?? i}>
          {i > 0 && (
            <span
              aria-hidden
              data-group-part="separator"
              className={cn("shrink-0 bg-line-2", vertical ? "h-px w-full" : "my-0 w-px self-stretch")}
            />
          )}
          {child}
        </Fragment>
      ))}
    </div>
  );
}
