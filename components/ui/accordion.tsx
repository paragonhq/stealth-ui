"use client";
import { Accordion as BaseAccordion } from "@base-ui/react/accordion";
import { createContext, use } from "react";
import { cn } from "@/lib/cn";

type Variant = "card" | "flush";
type Indicator = "chevron" | "plus";

const AccordionContext = createContext<{ variant: Variant; indicator: Indicator }>({ variant: "card", indicator: "chevron" });

export type AccordionProps<Value = string> = Omit<BaseAccordion.Root.Props<Value>, "className"> & {
  /** A bordered card with hairlines between items, or bare rows that sit in the page's own column. */
  variant?: Variant;
  /** A chevron that turns over, or a plus whose upright stroke lies down into a minus. */
  indicator?: Indicator;
  className?: string;
};

/**
 * Single by default; pass `multiple` to let several stay open.
 * Closed panels stay in the DOM as `hidden="until-found"`, so the browser's
 * find-in-page can search them and opens the one that matches.
 */
export function Accordion<Value = string>({
  variant = "card",
  indicator = "chevron",
  hiddenUntilFound = true,
  className,
  ...rest
}: AccordionProps<Value>) {
  return (
    <AccordionContext value={{ variant, indicator }}>
      <BaseAccordion.Root<Value>
        data-variant={variant}
        hiddenUntilFound={hiddenUntilFound}
        className={cn(
          "flex w-full min-w-0 flex-col",
          variant === "card" && "overflow-hidden rounded-xl border border-line-2 bg-raised shadow-[var(--shadow)]",
          className,
        )}
        {...rest}
      />
    </AccordionContext>
  );
}

export type AccordionItemProps = Omit<BaseAccordion.Item.Props, "className"> & { className?: string };

export function AccordionItem({ className, ...rest }: AccordionItemProps) {
  const { variant } = use(AccordionContext);
  return (
    <BaseAccordion.Item
      className={cn(
        "group/item relative min-w-0",
        variant === "card" ? "border-t border-line first:border-t-0" : "border-b border-line",
        className,
      )}
      {...rest}
    />
  );
}

export type AccordionTriggerProps = Omit<BaseAccordion.Trigger.Props, "className" | "children"> & {
  children: React.ReactNode;
  /** 16px icon before the title. */
  icon?: React.ReactNode;
  /** Short text or a count before the indicator: "3 open", "Pro". Read as part of the button's name. */
  hint?: React.ReactNode;
  /** The heading level wrapping the trigger, so the outline of the page stays correct. */
  level?: 2 | 3 | 4 | 5 | 6;
  className?: string;
};

export function AccordionTrigger({ children, icon, hint, level = 3, className, ...rest }: AccordionTriggerProps) {
  const { variant, indicator } = use(AccordionContext);
  const Heading = `h${level}` as const;
  return (
    <BaseAccordion.Header render={<Heading />} className="m-0 flex">
      <BaseAccordion.Trigger
        className={cn(
          // Accessories align to the first line, so a title that wraps keeps its icon and chevron beside its opening words.
          "group/trigger relative flex min-h-11 min-w-0 flex-1 select-none items-start gap-3 text-left",
          "touch-manipulation [-webkit-tap-highlight-color:transparent]",
          "text-[13px] font-medium leading-[18px] tracking-[-0.005em] text-fg",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
          "transition-[background-color,color] duration-150 ease-out",
          "data-disabled:cursor-not-allowed data-disabled:text-fg-4",
          variant === "card"
            ? // Full-bleed rows: the wash fills the row, the ring sits just inside it.
              "px-4 py-[13px] focus-visible:-outline-offset-2 focus-visible:rounded-[10px] hover:not-data-disabled:bg-fg/[0.035] active:not-data-disabled:bg-fg/[0.06]"
            : // Bare rows: text aligns with the column; the wash reaches 8px past it on each side.
              "-mx-2 rounded-lg px-2 py-[13px] focus-visible:-outline-offset-1 hover:not-data-disabled:bg-hover active:not-data-disabled:bg-fg/[0.06]",
          className,
        )}
        {...rest}
      >
        {icon && (
          <span data-accordion-icon="" className="grid h-[18px] w-4 shrink-0 place-items-center text-fg-3 transition-colors duration-150 group-hover/trigger:text-fg-2 group-data-[panel-open]/trigger:text-fg group-data-disabled/trigger:text-fg-4">
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1 text-balance">{children}</span>
        {hint != null && <span className="shrink-0 text-[12px] font-normal leading-[18px] tabular text-fg-3 group-data-disabled/trigger:text-fg-4">{hint}</span>}
        <span className="-mr-0.5 grid h-[18px] w-5 shrink-0 place-items-center text-fg-3 transition-colors duration-150 group-hover/trigger:text-fg group-data-disabled/trigger:text-fg-4">
          {indicator === "plus" ? <PlusMinus /> : <Chevron />}
        </span>
      </BaseAccordion.Trigger>
    </BaseAccordion.Header>
  );
}

/**
 * Turns over with the panel. On hover it leans 1px the way it will go,
 * so the row says which direction it opens before it is pressed.
 */
function Chevron() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn(
        "transition-[rotate,translate] duration-[260ms] ease-in-out-quart motion-reduce:transition-none",
        "group-hover/trigger:translate-y-px group-data-[panel-open]/trigger:rotate-180 group-hover/trigger:group-data-[panel-open]/trigger:-translate-y-px",
        "group-data-disabled/trigger:translate-y-0!",
      )}
    >
      <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
    </svg>
  );
}

/** The upright stroke turns a quarter and fades as it lies on the crossbar: plus becomes minus without a doubled stroke. */
function PlusMinus() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden>
      <path d="M3.5 8h9" />
      <path
        d="M8 3.5v9"
        className="origin-center transition-[rotate,opacity] duration-[260ms] ease-in-out-quart [transform-box:fill-box] motion-reduce:transition-none group-data-[panel-open]/trigger:rotate-90 group-data-[panel-open]/trigger:opacity-0"
      />
    </svg>
  );
}

export type AccordionPanelProps = Omit<BaseAccordion.Panel.Props, "className"> & {
  className?: string;
  /** Classes for the padded inner box. */
  contentClassName?: string;
};

/**
 * Height grows from the measured `--accordion-panel-height`; the words fade up
 * 60ms later, once there is room for them, so text never slides out from under a clip.
 */
export function AccordionPanel({ className, contentClassName, children, ...rest }: AccordionPanelProps) {
  const { variant } = use(AccordionContext);
  return (
    <BaseAccordion.Panel
      className={cn(
        "group/panel h-(--accordion-panel-height) overflow-hidden",
        "transition-[height] duration-[260ms] ease-out-quart data-ending-style:duration-200 data-ending-style:ease-in-out-quart",
        "data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none",
        className,
      )}
      {...rest}
    >
      <div
        className={cn(
          "text-[13px] leading-[1.6] text-fg-2 text-pretty",
          "transition-[opacity,translate] delay-[60ms] duration-[280ms] ease-out-expo",
          "group-data-[starting-style]/panel:-translate-y-1 group-data-[starting-style]/panel:opacity-0",
          // Leaving: no delay and no travel, just out of the way before the height closes over it.
          "group-data-[ending-style]/panel:opacity-0 group-data-[ending-style]/panel:delay-0 group-data-[ending-style]/panel:duration-[140ms]",
          "motion-reduce:translate-y-0 motion-reduce:transition-[opacity] motion-reduce:delay-0",
          // With a leading icon, the answer lines up under the title, not under the icon.
          variant === "card" ? "px-4 pb-4 group-has-[[data-accordion-icon]]/item:pl-11" : "pb-4 group-has-[[data-accordion-icon]]/item:pl-7",
          contentClassName,
        )}
      >
        {children}
      </div>
    </BaseAccordion.Panel>
  );
}
