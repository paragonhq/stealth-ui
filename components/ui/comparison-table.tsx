"use client";
import { Popover } from "@base-ui/react/popover";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Check, X } from "@/lib/icons";
import { spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type ComparisonPlan = {
  id: string;
  name: string;
  /** "$20", "Free", "Custom". */
  price?: React.ReactNode;
  /** Quiet text after the price: "/ month", "per seat". */
  period?: React.ReactNode;
  /** A short label beside the name, usually on the highlighted plan: "Popular". */
  badge?: string;
  /** The plan's call to action. Gets an href to render a link, or onClick for a button. */
  action?: { label: string; href?: string; onClick?: () => void };
};

/** true draws a check, false a cross, a string is printed. Add a note for "up to 3", "add-on", etc. */
export type ComparisonValue = boolean | string | { value: boolean | string; note?: string };

export type ComparisonFeature = {
  name: string;
  /** Opens in a small popover from the feature name, on hover or press. */
  description?: string;
  values: Record<string, ComparisonValue>;
};

export type ComparisonSection = { title: string; features: ComparisonFeature[] };

export type ComparisonTableProps = Omit<React.ComponentProps<"div">, "children"> & {
  plans: ComparisonPlan[];
  sections: ComparisonSection[];
  /** Id of the plan whose column is outlined and whose action is primary. */
  highlight?: string;
  /** Distance from the top of the scrolling area where the plan header sticks (a sticky site header's height). */
  stickyTop?: number | string;
  /** Names the table for screen readers. */
  caption?: string;
  /** Content for the empty cell above the feature names. */
  corner?: React.ReactNode;
  /** On narrow containers one plan shows at a time. Controlled plan id… */
  plan?: string;
  /** …or the one shown first. Defaults to the highlighted plan. */
  defaultPlan?: string;
  onPlanChange?: (id: string) => void;
};

// The highlighted column is drawn with inset shadows rather than borders, so it
// can have side rules, a rounded cap and a 3% tint without shifting any cell.
const col = {
  side: "shadow-[inset_1px_0_0_var(--line-2),inset_-1px_0_0_var(--line-2),inset_0_0_0_100vmax_color-mix(in_oklab,var(--fg)_3%,transparent)]",
  top: "shadow-[inset_1px_0_0_var(--line-2),inset_-1px_0_0_var(--line-2),inset_0_1px_0_var(--line-2),inset_0_0_0_100vmax_color-mix(in_oklab,var(--fg)_3%,transparent)]",
  bottom: "shadow-[inset_1px_0_0_var(--line-2),inset_-1px_0_0_var(--line-2),inset_0_-1px_0_var(--line-2),inset_0_0_0_100vmax_color-mix(in_oklab,var(--fg)_3%,transparent)]",
};

/**
 * Plans across the top, features down the side. The plan header sticks while
 * the features scroll under it, one highlight glides with the pointer so a row
 * can be read across, and on a narrow container the columns collapse to one
 * plan at a time behind a switcher.
 */
export function ComparisonTable({
  plans,
  sections,
  highlight,
  stickyTop = 0,
  caption = "Compare plans",
  corner,
  plan: planProp,
  defaultPlan,
  onPlanChange,
  className,
  style,
  ...rest
}: ComparisonTableProps) {
  const reduce = useReducedMotion();
  const [active, setActive] = useControllableState({
    value: planProp,
    defaultValue: defaultPlan ?? highlight ?? plans[0]?.id ?? "",
    onChange: onPlanChange,
  });
  const root = useRef<HTMLDivElement>(null);
  const table = useRef<HTMLTableElement>(null);
  const head = useRef<HTMLTableSectionElement>(null);
  const [stuck, setStuck] = useState(false);
  const [row, setRow] = useState<{ y: number; h: number; shown: boolean; jump: boolean }>({ y: 0, h: 0, shown: false, jump: true });
  const captionId = useId();

  // The header is stuck when it has slid down from the table's top edge. Any
  // scroll, of the window or of a container, is checked once per frame.
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const t = table.current?.getBoundingClientRect();
      const h = head.current?.getBoundingClientRect();
      if (!t || !h) return;
      const next = h.top - t.top > 1;
      setStuck((s) => (s === next ? s : next));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const track = (e: React.PointerEvent<HTMLTableRowElement>) => {
    if (e.pointerType !== "mouse" || !root.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const o = root.current.getBoundingClientRect();
    setRow((prev) => ({ y: r.top - o.top, h: r.height, shown: true, jump: !prev.shown }));
  };

  const top = typeof stickyTop === "number" ? `${stickyTop}px` : stickyTop;
  const last = (s: number, f: number) => s === sections.length - 1 && f === sections[s].features.length - 1;

  return (
    <div
      ref={root}
      data-slot="comparison-table"
      data-stuck={stuck || undefined}
      className={cn("group/ct @container relative w-full min-w-0 [--ct-bg:var(--frame)]", className)}
      style={{ ...style, ["--ct-top" as string]: top }}
      {...rest}
    >
      <PlanSwitcher plans={plans} active={active} onChange={setActive} reduce={!!reduce} label={caption} />

      <table
        ref={table}
        aria-labelledby={captionId}
        // Leaving the table fades the highlight; moving between rows only moves it.
        onPointerLeave={() => setRow((r) => ({ ...r, shown: false }))}
        className="w-full table-fixed border-separate border-spacing-0 text-[13px]">
        <caption id={captionId} className="sr-only">
          {caption}
        </caption>
        <thead ref={head}>
          <tr>
            <td
              className={cn(
                "sticky top-(--ct-top) z-(--z-sticky) w-[34%] bg-(--ct-bg) @max-[36rem]:top-[calc(var(--ct-top)+58px)] pb-3 pr-4 align-bottom @max-[36rem]:w-[52%]",
                "border-b border-line transition-[border-color] duration-200 group-data-stuck/ct:border-line-2",
                "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-3 after:bg-linear-to-b after:from-(--ct-bg) after:to-transparent after:opacity-0 after:transition-opacity after:duration-200 after:content-[''] group-data-stuck/ct:after:opacity-100",
              )}
            >
              {corner}
            </td>
            {plans.map((p) => {
              const hi = p.id === highlight;
              return (
                <th
                  key={p.id}
                  scope="col"
                  data-plan={p.id}
                  data-highlight={hi || undefined}
                  className={cn(
                    "sticky top-(--ct-top) z-(--z-sticky) bg-(--ct-bg) p-0 @max-[36rem]:top-[calc(var(--ct-top)+58px)] text-left align-bottom font-normal",
                    "border-b border-line transition-[border-color] duration-200 group-data-stuck/ct:border-line-2",
                "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-3 after:bg-linear-to-b after:from-(--ct-bg) after:to-transparent after:opacity-0 after:transition-opacity after:duration-200 after:content-[''] group-data-stuck/ct:after:opacity-100",
                    // Narrow containers show one plan column at a time.
                    p.id !== active && "@max-[36rem]:hidden",
                    hi && cn("rounded-t-xl", col.top),
                  )}
                >
                  <PlanHead plan={p} highlighted={hi} />
                </th>
              );
            })}
          </tr>
        </thead>

        {sections.map((section, si) => (
          <tbody key={section.title}>
            <tr>
              <th scope="colgroup" colSpan={1} className="pb-2 pr-4 pt-6 text-left align-bottom font-normal">
                <span className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">{section.title}</span>
              </th>
              {plans.map((p) => (
                <td
                  key={p.id}
                  aria-hidden
                  className={cn(p.id !== active && "@max-[36rem]:hidden", p.id === highlight && col.side)}
                />
              ))}
            </tr>
            {section.features.map((f, fi) => (
              <tr key={f.name} onPointerEnter={track}>
                <th scope="row" className="border-t border-line py-2.5 pr-4 text-left align-top font-normal text-fg">
                  <FeatureName feature={f} />
                </th>
                {plans.map((p) => {
                  const hi = p.id === highlight;
                  const end = last(si, fi);
                  return (
                    <td
                      key={p.id}
                      data-plan={p.id}
                      className={cn(
                        "border-t border-line px-3 py-2.5 align-top",
                        p.id !== active && "@max-[36rem]:hidden",
                        hi && (end ? cn("rounded-b-xl", col.bottom) : col.side),
                        hi && end && "pb-3.5",
                      )}
                    >
                      <Cell value={f.values[p.id]} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>

      {/* One highlight for every row: it glides after the pointer so a line can be read across the plans. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 rounded-md bg-fg/[0.035] motion-reduce:hidden"
        initial={false}
        animate={{ y: row.y, height: row.h, opacity: row.shown ? 1 : 0 }}
        transition={
          reduce
            ? { duration: 0 }
            : { y: row.jump ? { duration: 0 } : spring.follow, height: row.jump ? { duration: 0 } : spring.follow, opacity: { duration: row.shown ? 0.12 : 0.15 } }
        }
      />
    </div>
  );
}

function PlanHead({ plan, highlighted }: { plan: ComparisonPlan; highlighted: boolean }) {
  const a = plan.action;
  const actionClass = cn(
    "relative mt-1 inline-flex h-7 w-full select-none items-center justify-center rounded-md px-2.5 text-[12px] font-medium tracking-[-0.005em]",
    "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
    "transition-[background-color,border-color,scale] duration-150 ease-out active:scale-[0.97] active:duration-75",
    "before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
    highlighted ? "bg-fg text-frame hover:bg-fg/90" : "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover",
  );
  return (
    <div className="flex min-w-0 flex-col gap-1 px-3 pb-3 pt-3.5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className="truncate text-[13.5px] font-medium tracking-[-0.01em] text-fg">{plan.name}</span>
        {plan.badge && (
          <span className="inline-flex h-[18px] shrink-0 items-center rounded-full border border-line-2 bg-raised px-1.5 text-[10.5px] font-medium leading-none text-fg-2">
            {plan.badge}
          </span>
        )}
      </div>
      {plan.price != null && (
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-1">
          <span className="text-[18px] font-medium leading-6 tracking-[-0.02em] text-fg tabular">{plan.price}</span>
          {plan.period != null && <span className="text-[11.5px] text-fg-3">{plan.period}</span>}
        </p>
      )}
      {a &&
        (a.href ? (
          <a href={a.href} onClick={a.onClick} className={cn(actionClass, "cursor-pointer")}>
            {a.label}
          </a>
        ) : (
          <button type="button" onClick={a.onClick} className={actionClass}>
            {a.label}
          </button>
        ))}
    </div>
  );
}

function FeatureName({ feature }: { feature: ComparisonFeature }) {
  if (!feature.description) return <span className="text-pretty">{feature.name}</span>;
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={300}
        closeDelay={80}
        className={cn(
          "-mx-1 cursor-help rounded-[4px] px-1 text-left text-pretty text-fg outline-none",
          "underline decoration-fg-4 decoration-dotted underline-offset-[4px] transition-[text-decoration-color] duration-150",
          "hover:decoration-fg-2 data-popup-open:decoration-fg-2",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
        )}
      >
        {feature.name}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" align="start" sideOffset={8} collisionPadding={8} className="z-(--z-popover)">
          <Popover.Popup
            className={cn(
              "w-64 max-w-(--available-width) rounded-xl border border-line-2 bg-raised px-3 py-2.5 text-fg shadow-pop outline-none",
              "origin-(--transform-origin) transition-[opacity,scale,translate,filter] duration-200 ease-out-expo",
              "data-starting-style:scale-96 data-starting-style:opacity-0 data-starting-style:blur-[2px]",
              "data-[side=top]:data-starting-style:translate-y-1 data-[side=bottom]:data-starting-style:-translate-y-1",
              "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-140 data-ending-style:ease-out-quart",
              "data-instant:transition-none",
              "motion-reduce:data-starting-style:translate-0 motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:blur-none motion-reduce:data-ending-style:scale-100",
            )}
          >
            <Popover.Title className="text-[12.5px] font-medium tracking-[-0.005em]">{feature.name}</Popover.Title>
            <Popover.Description className="mt-0.5 text-pretty text-[12.5px] leading-[1.5] text-fg-2">{feature.description}</Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Cell({ value }: { value: ComparisonValue | undefined }) {
  const v = typeof value === "object" && value !== null ? value.value : value;
  const note = typeof value === "object" && value !== null ? value.note : undefined;
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {v === true ? (
        <span className="flex h-5 items-center text-fg">
          <Check size={16} />
          <span className="sr-only">Included</span>
        </span>
      ) : v === false || v === undefined ? (
        <span className="flex h-5 items-center text-fg-4">
          <X size={14} />
          <span className="sr-only">Not included</span>
        </span>
      ) : (
        <span className="text-pretty leading-5 text-fg-2 tabular">{v}</span>
      )}
      {note && <span className="text-pretty text-[12px] leading-4 text-fg-3">{note}</span>}
    </div>
  );
}

/**
 * Below 36rem the table shows one plan; this picks which. One pill slides
 * between the plans on the snappy spring.
 */
function PlanSwitcher({
  plans,
  active,
  onChange,
  reduce,
  label,
}: {
  plans: ComparisonPlan[];
  active: string;
  onChange: (id: string) => void;
  reduce: boolean;
  label: string;
}) {
  const id = useId();
  return (
    // Sticks above the plan header, so the plan can be changed from anywhere in the table.
    <div className="sticky top-(--ct-top) z-(--z-sticky) hidden bg-(--ct-bg) pb-3 pt-2 @max-[36rem]:block">
    <ToggleGroup
      value={[active]}
      // A plan is always shown: pressing the current one again does nothing.
      onValueChange={(v) => v[0] && onChange(v[0])}
      aria-label={`${label}: choose a plan`}
      className="flex w-full rounded-lg border border-line bg-raised p-0.5"
    >
      {plans.map((p) => (
          <Toggle
            key={p.id}
            value={p.id}
            className={cn(
              "relative isolate flex h-8 min-w-0 flex-1 select-none items-center justify-center rounded-md px-2 text-[12.5px] font-medium text-fg-3",
              "outline-none transition-[color,scale] duration-150 hover:text-fg-2 active:scale-[0.97] data-pressed:text-fg",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
            )}
          >
            {p.id === active && (
              <motion.span
                layoutId={`${id}-pill`}
                className="absolute inset-0 -z-10 rounded-md border border-line-2 bg-frame"
                transition={reduce ? { duration: 0 } : spring.snappy}
              />
            )}
            <span className="truncate">{p.name}</span>
          </Toggle>
      ))}
    </ToggleGroup>
    </div>
  );
}
