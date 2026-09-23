"use client";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { createContext, use, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { Check, ChevronDown, ChevronUp, ChevronsUpDown } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

type Size = "sm" | "md" | "lg";
// Base UI accepts a className function; these parts take a plain string so cn() can merge it.
type Styled<P> = Omit<P, "className"> & { className?: string };
type Items = SelectPrimitive.Root.Props<unknown>["items"];

type Ctx = { value: unknown; indexOf: (value: unknown) => number };
const SelectContext = createContext<Ctx>({ value: null, indexOf: () => -1 });

// Flattens the `items` prop (record, flat array or groups) into one ordered list of values,
// so the trigger knows whether a new choice sits above or below the old one.
function flatten(items: Items): unknown[] {
  if (!items) return [];
  if (!Array.isArray(items)) return Object.keys(items);
  return items.flatMap((entry) => ("items" in entry && Array.isArray(entry.items) ? entry.items.map((i: { value: unknown }) => i.value) : [entry.value]));
}

export type SelectProps<Value> = Omit<SelectPrimitive.Root.Props<Value, false>, "multiple">;

/** The root. Pass `items` so the trigger can show labels and animate in the right direction. */
export function Select<Value>({ value, defaultValue, onValueChange, items, ...rest }: SelectProps<Value>) {
  const [inner, setInner] = useState<Value | null>(defaultValue ?? null);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const order = useMemo(() => flatten(items), [items]);
  const ctx = useMemo<Ctx>(() => ({ value: current, indexOf: (v) => order.indexOf(v) }), [current, order]);

  return (
    <SelectContext value={ctx}>
      <SelectPrimitive.Root<Value, false>
        items={items}
        value={current}
        onValueChange={(next, details) => {
          if (!controlled) setInner(next);
          onValueChange?.(next, details);
        }}
        {...rest}
      />
    </SelectContext>
  );
}

export type SelectLabelProps = Styled<SelectPrimitive.Label.Props>;

export function SelectLabel({ className, ...rest }: SelectLabelProps) {
  return <SelectPrimitive.Label className={cn("w-fit cursor-default text-[12.5px] font-medium text-fg-2 select-none", className)} {...rest} />;
}

export type SelectTriggerProps = Omit<Styled<SelectPrimitive.Trigger.Props>, "children"> & {
  placeholder?: React.ReactNode;
  /** Decorative icon before the value. */
  icon?: React.ReactNode;
  size?: Size;
  /** Marks the field as invalid when it isn't inside a Field that does it for you. */
  invalid?: boolean;
  /** Render the chosen value yourself. Receives the raw value. */
  children?: (value: unknown) => React.ReactNode;
};

export function SelectTrigger({ placeholder = "Select…", icon, size = "md", invalid, className, children, ...rest }: SelectTriggerProps) {
  const { value, indexOf } = use(SelectContext);
  const reduce = useReducedMotion();
  // The new value arrives from the side of the list it was picked from: below slides up, above slides down.
  const [shown, setShown] = useState({ value, dir: 1 });
  if (!Object.is(shown.value, value)) setShown({ value, dir: indexOf(value) < indexOf(shown.value) ? -1 : 1 });
  const dir = shown.dir;

  return (
    <SelectPrimitive.Trigger
      data-size={size}
      aria-invalid={invalid || undefined}
      className={cn(
        "group/trigger relative flex w-full min-w-0 items-center border border-line-2 bg-raised text-left text-fg shadow-[var(--shadow)] select-none",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.985] active:duration-75",
        "hover:border-fg-4 hover:bg-hover data-popup-open:border-fg-4 data-popup-open:bg-hover",
        "aria-invalid:border-danger/70 hover:aria-invalid:border-danger data-invalid:border-danger/70",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "data-readonly:bg-transparent data-readonly:shadow-none",
        // A 44px touch target without changing how the field looks.
        "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.5",
        size === "sm" && "h-7 gap-1.5 rounded-md pr-1.5 pl-2 text-[12.5px]",
        size === "md" && "h-8 gap-2 rounded-lg pr-2 pl-2.5 text-[13px]",
        size === "lg" && "h-9 gap-2 rounded-lg pr-2.5 pl-3 text-[13px]",
        className,
      )}
      {...rest}
    >
      {icon && <span className="flex shrink-0 text-fg-3 [&_svg]:size-3.5">{icon}</span>}
      <SelectPrimitive.Value
        placeholder={placeholder}
        render={(props, state) => (
          <span {...props} className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden py-1">
            <AnimatePresence initial={false} custom={dir}>
              <motion.span
                key={String(state.placeholder ? "" : keyOf(state.value))}
                custom={dir}
                className={cn("col-start-1 row-start-1 truncate", state.placeholder && "text-fg-4")}
                variants={{
                  enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, y: 8 * d, filter: "blur(2px)" }),
                  center: { opacity: 1, y: 0, filter: "blur(0px)" },
                  exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, y: -8 * d, filter: "blur(2px)" }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: reduce ? 0.12 : 0.22, ease: ease.out }}
              >
                {children && !state.placeholder ? children(state.value) : props.children}
              </motion.span>
            </AnimatePresence>
          </span>
        )}
      />
      <SelectPrimitive.Icon
        className={cn(
          "flex shrink-0 text-fg-3 transition-colors duration-150 group-hover/trigger:text-fg-2 group-data-popup-open/trigger:text-fg-2 group-data-readonly/trigger:hidden",
          size === "sm" ? "[&_svg]:size-3.5" : "[&_svg]:size-4",
        )}
      >
        <ChevronsUpDown />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function keyOf(value: unknown): string {
  if (value && typeof value === "object") {
    const v = value as { value?: unknown; id?: unknown };
    return String(v.value ?? v.id ?? JSON.stringify(value));
  }
  return String(value);
}

export type SelectPopupProps = Styled<SelectPrimitive.Popup.Props> & {
  /** Overlap the trigger so the chosen item sits exactly over the value. Falls back to below when there isn't room, and is always off for touch. */
  alignItemWithTrigger?: boolean;
  side?: SelectPrimitive.Positioner.Props["side"];
  align?: SelectPrimitive.Positioner.Props["align"];
  sideOffset?: number;
  /** Portal target. Defaults to document.body. */
  container?: SelectPrimitive.Portal.Props["container"];
};

export function SelectPopup({ alignItemWithTrigger = true, side = "bottom", align = "start", sideOffset = 6, container, className, children, ...rest }: SelectPopupProps) {
  const reduce = !!useReducedMotion();
  const { setList, y, height, opacity } = useGlide(reduce);

  return (
    <SelectPrimitive.Portal container={container}>
      <SelectPrimitive.Positioner
        alignItemWithTrigger={alignItemWithTrigger}
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className="z-(--z-popover) outline-none select-none"
      >
        <SelectPrimitive.Popup
          className={cn(
            "group/popup relative min-w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
            "transition-[opacity,scale] duration-160 ease-out-expo data-ending-style:duration-100 data-ending-style:ease-out",
            "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0",
            // Aligned over the trigger, Base UI measures the popup to line the item up; a scale would throw that off, so it only fades.
            "data-[side=none]:data-starting-style:scale-100 data-[side=none]:data-ending-style:scale-100 data-[side=none]:min-w-[calc(var(--anchor-width)+0.5rem)]",
            "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
            className,
          )}
          {...rest}
        >
          <ScrollArrow direction="up" />
          <SelectPrimitive.List
            ref={setList}
            className="relative max-h-[min(var(--available-height),19rem)] scroll-py-6 overflow-y-auto overscroll-contain p-1 outline-none"
          >
            <motion.div aria-hidden style={{ y, height, opacity }} className="pointer-events-none absolute inset-x-1 top-0 rounded-lg bg-line" />
            {children}
          </SelectPrimitive.List>
          <ScrollArrow direction="down" />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function ScrollArrow({ direction }: { direction: "up" | "down" }) {
  const Part = direction === "up" ? SelectPrimitive.ScrollUpArrow : SelectPrimitive.ScrollDownArrow;
  return (
    <Part
      className={cn(
        "absolute inset-x-0 z-[2] flex h-6 cursor-default items-center justify-center bg-raised text-fg-3 transition-opacity duration-150",
        "data-starting-style:opacity-0 data-ending-style:opacity-0",
        // Where the pointer rests to keep scrolling, extended past the edge in aligned mode so it's easy to find.
        "before:absolute before:inset-x-0 before:h-full before:content-['']",
        direction === "up" ? "top-0 rounded-t-xl data-[side=none]:before:-top-full" : "bottom-0 rounded-b-xl data-[side=none]:before:-bottom-full",
      )}
    >
      {direction === "up" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </Part>
  );
}

// One highlight for the whole list. It glides after the pointer on a spring and
// jumps instantly for arrow keys, where motion would read as lag.
function useGlide(reduce: boolean) {
  const [list, setList] = useState<HTMLDivElement | null>(null);
  const y = useMotionValue(0);
  const height = useMotionValue(32);
  const opacity = useMotionValue(0);

  useEffect(() => {
    if (!list) return;
    let keyboard = false;
    let shown = false;
    let running: AnimationPlaybackControls[] = [];
    const stop = () => {
      running.forEach((c) => c.stop());
      running = [];
    };
    const place = () => {
      const el = list.querySelector<HTMLElement>("[data-highlighted]");
      stop();
      if (!el) {
        shown = false;
        running.push(animate(opacity, 0, { duration: reduce ? 0 : 0.12 }));
        return;
      }
      // offsetTop ignores the popup's entrance scale, which would skew a measured rect.
      let top = 0;
      // Disabled rows can be reached by arrow keys but read as unavailable, so the highlight dims.
      const target = el.hasAttribute("data-disabled") ? 0.45 : 1;
      for (let n: HTMLElement | null = el; n && n !== list; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
      if (!shown || keyboard || reduce) {
        y.jump(top);
        height.jump(el.offsetHeight);
        if (keyboard || reduce) opacity.jump(target);
        else running.push(animate(opacity, target, { duration: 0.08 }));
      } else {
        running.push(animate(y, top, spring.follow), animate(height, el.offsetHeight, spring.follow));
        opacity.jump(target);
      }
      shown = true;
    };
    const onKey = () => (keyboard = true);
    const onPointer = () => (keyboard = false);
    const observer = new MutationObserver(place);
    observer.observe(list, { subtree: true, attributes: true, attributeFilter: ["data-highlighted"] });
    document.addEventListener("keydown", onKey, true);
    list.addEventListener("pointermove", onPointer);
    place();
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKey, true);
      list.removeEventListener("pointermove", onPointer);
      stop();
    };
  }, [list, reduce, y, height, opacity]);

  return { setList, y, height, opacity };
}

export type SelectItemProps = Styled<SelectPrimitive.Item.Props> & {
  /** Decorative icon before the label. */
  icon?: React.ReactNode;
  /** A second, quieter line under the label. */
  description?: React.ReactNode;
  /** Right-aligned meta: a code, a count, a shortcut. */
  hint?: React.ReactNode;
};

export function SelectItem({ icon, description, hint, className, children, ...rest }: SelectItemProps) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative z-[1] flex cursor-default scroll-my-1 items-center gap-2 rounded-lg pr-2 pl-2 text-[13px] text-fg outline-none select-none",
        description ? "min-h-11 py-1.5" : "h-8 pointer-coarse:h-10",
        "data-disabled:text-fg-4 data-disabled:[&_span]:text-fg-4",
        className,
      )}
      {...rest}
    >
      {icon && <span className="flex shrink-0 text-fg-3 [&_svg]:size-4">{icon}</span>}
      <span className="flex min-w-0 flex-1 flex-col">
        <SelectPrimitive.ItemText className="truncate">{children}</SelectPrimitive.ItemText>
        {description && <span className="truncate text-[12px] leading-4 text-fg-3">{description}</span>}
      </span>
      {hint && <span className="shrink-0 font-mono text-2xs text-fg-4 tabular">{hint}</span>}
      {/* The check has its own column so hints never shift when the selection moves. */}
      <span className="grid size-4 shrink-0 place-items-center">
        <SelectPrimitive.ItemIndicator>
          <Check size={14} className="text-fg" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

export type SelectGroupProps = Styled<SelectPrimitive.Group.Props> & { label?: React.ReactNode };

export function SelectGroup({ label, className, children, ...rest }: SelectGroupProps) {
  return (
    <SelectPrimitive.Group className={cn("pb-1 last:pb-0", className)} {...rest}>
      {label && (
        <SelectPrimitive.GroupLabel className="px-2 pt-2 pb-1 font-mono text-2xs tracking-[0.08em] text-fg-3 uppercase select-none">{label}</SelectPrimitive.GroupLabel>
      )}
      {children}
    </SelectPrimitive.Group>
  );
}

export type SelectSeparatorProps = Styled<SelectPrimitive.Separator.Props>;

export function SelectSeparator({ className, ...rest }: SelectSeparatorProps) {
  return <SelectPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-line", className)} {...rest} />;
}
