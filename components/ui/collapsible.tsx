"use client";
import { Collapsible as BaseCollapsible } from "@base-ui/react/collapsible";
import { Children } from "react";
import { cn } from "@/lib/cn";

export type CollapsibleProps = Omit<BaseCollapsible.Root.Props, "className"> & { className?: string };

/** Open state lives here: `open` + `onOpenChange`, or `defaultOpen`. */
export function Collapsible({ className, ...rest }: CollapsibleProps) {
  return <BaseCollapsible.Root className={cn("flex min-w-0 flex-col", className)} {...rest} />;
}

export type CollapsibleTriggerProps = Omit<BaseCollapsible.Trigger.Props, "className" | "children"> & {
  children: React.ReactNode;
  /** A section header row, or a quiet text button ("Show 3 more"). Both lead with the chevron, so a label that changes never moves it. */
  variant?: "row" | "inline";
  /** Label shown while open ("Show less"). Both labels share one box, so the button never changes width. */
  openLabel?: React.ReactNode;
  /** Trailing text in a row trigger: a count, a status. */
  hint?: React.ReactNode;
  className?: string;
};

export function CollapsibleTrigger({ children, variant = "row", openLabel, hint, className, ...rest }: CollapsibleTriggerProps) {
  const row = variant === "row";
  return (
    <BaseCollapsible.Trigger
      data-variant={variant}
      className={cn(
        "group/trigger relative flex min-w-0 select-none items-center text-left",
        "touch-manipulation [-webkit-tap-highlight-color:transparent]",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
        "transition-[background-color,color,scale] duration-150 ease-out active:duration-75",
        "data-disabled:cursor-not-allowed data-disabled:text-fg-4",
        row
          ? "-mx-2 min-h-9 gap-1.5 rounded-lg px-2 text-[13px] font-medium tracking-[-0.005em] text-fg hover:not-data-disabled:bg-hover active:not-data-disabled:bg-fg/[0.06]"
          : cn(
              "-mx-2 h-8 w-fit gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-fg-2 hover:not-data-disabled:bg-hover hover:not-data-disabled:text-fg active:not-data-disabled:scale-[0.97]",
              // Draws 32px tall; on touch it lends itself 6px above and below.
              "pointer-coarse:before:absolute pointer-coarse:before:-inset-y-1.5 pointer-coarse:before:inset-x-0 pointer-coarse:before:content-['']",
            ),
        className,
      )}
      {...rest}
    >
      {row && (
        <span className="-ml-0.5 grid size-4 shrink-0 place-items-center text-fg-3 transition-colors duration-150 group-hover/trigger:text-fg-2 group-data-[panel-open]/trigger:text-fg-2">
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
            className="transition-[rotate] duration-[240ms] ease-in-out-quart motion-reduce:transition-none group-data-[panel-open]/trigger:rotate-90"
          >
            <path d="m6.25 4.5 3.5 3.5-3.5 3.5" />
          </svg>
        </span>
      )}

      {!row && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="shrink-0 text-fg-3 transition-[rotate,color] duration-[240ms] ease-in-out-quart motion-reduce:transition-none group-hover/trigger:text-fg-2 group-data-[panel-open]/trigger:rotate-180"
        >
          <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
        </svg>
      )}

      <Label open={openLabel}>{children}</Label>

      {row && hint != null && <span className="ml-auto shrink-0 pl-3 text-[12px] font-normal tabular text-fg-3">{hint}</span>}
    </BaseCollapsible.Trigger>
  );
}

/**
 * Both labels sit in one grid cell. The outgoing one rises and fades, the incoming
 * one arrives from below; `visibility` follows, so only the current label is read out.
 */
function Label({ children, open }: { children: React.ReactNode; open?: React.ReactNode }) {
  if (open == null) return <span className="min-w-0 truncate">{children}</span>;
  const swap = "col-start-1 row-start-1 whitespace-nowrap transition-[opacity,translate,visibility] duration-200 ease-out-expo motion-reduce:translate-y-0";
  return (
    <span className="grid min-w-0 overflow-hidden py-0.5">
      <span className={cn(swap, "group-data-[panel-open]/trigger:invisible group-data-[panel-open]/trigger:-translate-y-2 group-data-[panel-open]/trigger:opacity-0")}>
        {children}
      </span>
      <span className={cn(swap, "invisible translate-y-2 opacity-0 group-data-[panel-open]/trigger:visible group-data-[panel-open]/trigger:translate-y-0 group-data-[panel-open]/trigger:opacity-100")}>
        {open}
      </span>
    </span>
  );
}

export type CollapsiblePanelProps = Omit<BaseCollapsible.Panel.Props, "className"> & {
  className?: string;
  /** Classes for the inner box that fades in once the height has room for it. */
  contentClassName?: string;
};

/** Height follows `--collapsible-panel-height`; the content fades up 50ms behind it. */
export function CollapsiblePanel({ className, contentClassName, children, ...rest }: CollapsiblePanelProps) {
  return (
    <BaseCollapsible.Panel
      className={cn(
        "group/panel h-(--collapsible-panel-height) overflow-hidden",
        "transition-[height] duration-[260ms] ease-out-quart data-ending-style:duration-200 data-ending-style:ease-in-out-quart",
        "data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none",
        className,
      )}
      {...rest}
    >
      <div className={cn(fadeIn, contentClassName)}>{children}</div>
    </BaseCollapsible.Panel>
  );
}

const fadeIn = cn(
  "transition-[opacity,translate] delay-[50ms] duration-[280ms] ease-out-expo",
  "group-data-[starting-style]/panel:-translate-y-1 group-data-[starting-style]/panel:opacity-0",
  "group-data-[ending-style]/panel:opacity-0 group-data-[ending-style]/panel:delay-0 group-data-[ending-style]/panel:duration-[140ms]",
  "motion-reduce:translate-y-0 motion-reduce:delay-0",
);

// Revealed rows arrive 20ms apart, capped at the eighth, and leave together.
const stagger = cn(
  "[&>*]:transition-[opacity,translate] [&>*]:duration-[280ms] [&>*]:ease-out-expo [&>*]:delay-[40ms]",
  "[&>*:nth-child(2)]:delay-[60ms] [&>*:nth-child(3)]:delay-[80ms] [&>*:nth-child(4)]:delay-[100ms] [&>*:nth-child(5)]:delay-[120ms]",
  "[&>*:nth-child(6)]:delay-[140ms] [&>*:nth-child(7)]:delay-[160ms] [&>*:nth-child(n+8)]:delay-[180ms]",
  "group-data-[starting-style]/more:[&>*]:-translate-y-1.5 group-data-[starting-style]/more:[&>*]:opacity-0",
  "group-data-[ending-style]/more:[&>*]:opacity-0 group-data-[ending-style]/more:[&>*]:delay-0! group-data-[ending-style]/more:[&>*]:duration-[140ms]",
  "motion-reduce:[&>*]:translate-y-0! motion-reduce:[&>*]:delay-0!",
);

export type CollapsibleListProps = Omit<CollapsibleProps, "children"> & {
  children: React.ReactNode;
  /** How many children stay visible while collapsed. */
  limit?: number;
  /** Closed label. Receives how many are hidden. */
  moreLabel?: (hidden: number) => React.ReactNode;
  lessLabel?: React.ReactNode;
  /** Classes for both groups of rows, so they read as one list (gap, dividers). */
  listClassName?: string;
  triggerClassName?: string;
};

/**
 * The "Show 3 more" pattern. With `limit` or fewer children it renders them plainly,
 * with no button: a control that reveals nothing is a lie.
 */
export function CollapsibleList({
  children,
  limit = 3,
  moreLabel = (n) => (
    <>
      Show <span className="tabular">{n}</span> more
    </>
  ),
  lessLabel = "Show less",
  listClassName,
  triggerClassName,
  className,
  ...rest
}: CollapsibleListProps) {
  const items = Children.toArray(children);
  const head = items.slice(0, limit);
  const tail = items.slice(limit);
  const list = cn("flex flex-col", listClassName);

  if (!tail.length) return <div className={cn(list, className)}>{head}</div>;

  return (
    <Collapsible className={className} {...rest}>
      <div className={list}>{head}</div>
      <BaseCollapsible.Panel
        className={cn(
          "group/more h-(--collapsible-panel-height) overflow-hidden",
          "transition-[height] duration-[260ms] ease-out-quart data-ending-style:duration-200 data-ending-style:ease-in-out-quart",
          "data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none",
        )}
      >
        <div className={cn(list, stagger)}>{tail}</div>
      </BaseCollapsible.Panel>
      <CollapsibleTrigger variant="inline" openLabel={lessLabel} className={cn("mt-1", triggerClassName)}>
        {moreLabel(tail.length)}
      </CollapsibleTrigger>
    </Collapsible>
  );
}
