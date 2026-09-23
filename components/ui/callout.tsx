"use client";
import { Collapsible } from "@base-ui/react/collapsible";
import { cn } from "@/lib/cn";
import { Alert, ArrowRight, ChevronDown, CircleCheck, Info, Warning } from "@/lib/icons";
import { useControllableState } from "@/lib/use-controllable-state";

export type CalloutTone = "note" | "info" | "tip" | "success" | "warning" | "danger";

// A lightbulb on the shared 16px grid, 1.4 stroke.
const Bulb = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 11.25h4M6.5 13.5h3M8 2.25a4 4 0 0 0-2.4 7.2c.35.27.55.68.55 1.12v.18h3.7v-.18c0-.44.2-.85.55-1.12A4 4 0 0 0 8 2.25z" />
  </svg>
);

const tones: Record<CalloutTone, { icon: React.ReactNode; surface: string; glyph: string; label: string }> = {
  note: { icon: <Info />, surface: "border-line bg-raised", glyph: "text-fg-3", label: "Note" },
  info: { icon: <Info />, surface: "border-info/20 bg-info-soft", glyph: "text-info", label: "Info" },
  tip: { icon: <Bulb />, surface: "border-success/20 bg-success-soft", glyph: "text-success", label: "Tip" },
  success: { icon: <CircleCheck />, surface: "border-success/20 bg-success-soft", glyph: "text-success", label: "Success" },
  warning: { icon: <Warning />, surface: "border-warning/25 bg-warning-soft", glyph: "text-warning", label: "Warning" },
  danger: { icon: <Alert />, surface: "border-danger/25 bg-danger-soft", glyph: "text-danger", label: "Important" },
};

export type CalloutProps = Omit<React.ComponentProps<"div">, "title"> & {
  tone?: CalloutTone;
  size?: "sm" | "md";
  title?: React.ReactNode;
  /** Replace the tone's icon, or `false` for none. */
  icon?: React.ReactNode | false;
  /** One or two `CalloutAction`s, under the body. */
  action?: React.ReactNode;
  /** Longer supporting content behind a Show details toggle: a list, a log, the why. */
  details?: React.ReactNode;
  detailsLabel?: string;
  hideDetailsLabel?: string;
  /** Controlled details state. */
  detailsOpen?: boolean;
  defaultDetailsOpen?: boolean;
  onDetailsOpenChange?: (open: boolean) => void;
};

export function Callout({
  tone = "note",
  size = "md",
  title,
  icon,
  action,
  details,
  detailsLabel = "Show details",
  hideDetailsLabel = "Hide details",
  detailsOpen,
  defaultDetailsOpen,
  onDetailsOpenChange,
  className,
  children,
  ...rest
}: CalloutProps) {
  const t = tones[tone];
  const glyph = icon === false ? null : (icon ?? t.icon);
  const sm = size === "sm";
  const [open, setOpen] = useControllableState({ value: detailsOpen, defaultValue: defaultDetailsOpen ?? false, onChange: onDetailsOpenChange });

  return (
    <div
      role="note"
      data-tone={tone}
      data-size={size}
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] rounded-xl border",
        sm ? "px-2.5 py-2 text-[12.5px] leading-[18px]" : "px-3 py-2.5 text-[13px] leading-5",
        t.surface,
        className,
      )}
      {...rest}
    >
      {glyph && (
        <span className={cn("col-start-1 grid place-items-center", sm ? "mr-2 mt-px size-4 [&_svg]:size-3.5" : "mr-2.5 mt-0.5 size-4", t.glyph)}>{glyph}</span>
      )}
      <div className="col-start-2 min-w-0">
        <span className="sr-only">{t.label}: </span>
        {title != null && <p className="font-medium tracking-[-0.005em] text-fg text-pretty">{title}</p>}
        {children != null && <div className={cn("text-fg-2 text-pretty", title != null && "mt-0.5")}>{children}</div>}

        {details != null && (
          <Collapsible.Root open={open} onOpenChange={setOpen}>
            <Collapsible.Panel
              className={cn(
                "h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-240 ease-in-out-quart motion-reduce:transition-none",
                "data-starting-style:h-0 data-ending-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden",
              )}
              hiddenUntilFound
            >
              {/* The content lifts in as the panel opens and settles back as it closes. */}
              <div
                className={cn(
                  "pt-2 text-fg-2 transition-[opacity,translate] duration-240 ease-out-expo",
                  "in-data-starting-style:-translate-y-1 in-data-starting-style:opacity-0 in-data-ending-style:-translate-y-1 in-data-ending-style:opacity-0",
                )}
              >
                {details}
              </div>
            </Collapsible.Panel>
            <DetailsRow action={action} label={detailsLabel} hideLabel={hideDetailsLabel} open={open} sm={sm} />
          </Collapsible.Root>
        )}
        {details == null && action != null && <div className={cn("-ml-2 flex flex-wrap items-center gap-1", sm ? "mt-1" : "mt-1.5")}>{action}</div>}
      </div>
    </div>
  );
}

function DetailsRow({ action, label, hideLabel, open, sm }: { action?: React.ReactNode; label: string; hideLabel: string; open: boolean; sm: boolean }) {
  return (
    <div className={cn("-ml-2 flex flex-wrap items-center gap-1", sm ? "mt-1" : "mt-1.5")}>
      {action}
      <Collapsible.Trigger
        className={cn(
          "group/details relative inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] text-fg-2",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
          "transition-[background-color,color,scale] duration-150 ease-out hover:bg-fg/[0.06] hover:text-fg active:scale-[0.97] active:duration-75",
        )}
      >
        {/* Both labels share one cell, so the toggle never changes width. */}
        <span className="grid">
          <span aria-hidden={open} className={cn("col-start-1 row-start-1 transition-opacity duration-150", open && "opacity-0")}>
            {label}
          </span>
          <span aria-hidden={!open} className={cn("col-start-1 row-start-1 transition-opacity duration-150", !open && "opacity-0")}>
            {hideLabel}
          </span>
        </span>
        <ChevronDown size={14} className="transition-transform duration-240 ease-in-out-quart group-data-panel-open/details:rotate-180 motion-reduce:transition-none" />
      </Collapsible.Trigger>
    </div>
  );
}

export type CalloutActionProps = (Omit<React.ComponentProps<"button">, "type"> & { href?: undefined }) | (React.ComponentProps<"a"> & { href: string });

/** A text action with an arrow that leans forward on hover. Renders a link when given `href`. */
export function CalloutAction({ className, children, ...rest }: CalloutActionProps) {
  const cls = cn(
    "group/action inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[12.5px] font-medium text-fg",
    "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
    "transition-[background-color,scale] duration-150 ease-out hover:bg-fg/[0.06] active:scale-[0.97] active:duration-75",
    className,
  );
  const inner = (
    <>
      {children}
      <ArrowRight size={14} className="text-fg-3 transition-[translate,color] duration-200 ease-out-expo group-hover/action:translate-x-0.5 group-hover/action:text-fg" />
    </>
  );
  if (rest.href !== undefined) {
    return (
      <a className={cls} {...(rest as React.ComponentProps<"a">)}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" className={cls} {...(rest as React.ComponentProps<"button">)}>
      {inner}
    </button>
  );
}
