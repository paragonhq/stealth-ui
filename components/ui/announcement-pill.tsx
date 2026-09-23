"use client";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@/lib/cn";

type Size = "sm" | "md";
type BadgeVariant = "solid" | "soft";

const isExternalHref = (href?: string) => !!href && /^(https?:)?\/\//.test(href);

export type AnnouncementPillProps = useRender.ComponentProps<"a"> & {
  /** The short label in the leading chip: "New", "Beta", "v2.4". Leave it out for a plain pill. */
  badge?: React.ReactNode;
  /** A filled chip that catches the eye, or a quiet outlined one. */
  badgeVariant?: BadgeVariant;
  size?: Size;
  /** Opens in a new tab with an up-right arrow. Defaults to true for absolute URLs. */
  external?: boolean;
};

/**
 * The link above a hero that says what's new. On hover a band of light crosses
 * it once, left to right, and the chevron pulls a stem out behind it to become
 * an arrow. Renders an anchor; pass `render={<Link href="…" />}` for a router link.
 */
export function AnnouncementPill({
  badge,
  badgeVariant = "solid",
  size = "md",
  external: externalProp,
  render,
  className,
  children,
  ...rest
}: AnnouncementPillProps) {
  const external = externalProp ?? isExternalHref(rest.href);
  const sm = size === "sm";

  const own: useRender.ElementProps<"a"> & Record<`data-${string}`, string | undefined> = {
    "data-slot": "announcement-pill",
    "data-size": size,
    "data-badge": badge ? badgeVariant : undefined,
    target: external ? "_blank" : undefined,
    rel: external ? "noopener noreferrer" : undefined,
    className: cn(
      "group/pill relative isolate inline-flex max-w-full min-w-0 cursor-pointer select-none items-center rounded-full",
      "border border-line-2 bg-raised text-fg-2 shadow-[var(--shadow)]",
      "touch-manipulation [-webkit-tap-highlight-color:transparent]",
      "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
      // One-step hover: the surface and the text each brighten a step. Press sinks it a touch.
      "transition-[background-color,border-color,color,scale] duration-150 ease-out-quart",
      "hover:border-fg-4/70 hover:bg-hover hover:text-fg focus-visible:text-fg active:scale-[0.98] active:duration-75",
      sm ? "h-7 gap-1.5 text-[12px]" : "h-8 gap-2 text-[12.5px]",
      badge ? (sm ? "pl-[3px] pr-2" : "pl-1 pr-2.5") : sm ? "pl-2.5 pr-2" : "pl-3 pr-2.5",
      // 28–32px tall to the eye, 44px to a thumb.
      "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2 pointer-coarse:after:content-['']",
      className,
    ),
    children: (
      <>
        {/* The sheen lives in its own clipped layer so the pill's touch area can reach past its edge. */}
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit] motion-reduce:hidden">
          <span
            className={cn(
              "absolute inset-y-0 left-0 w-1/2 -skew-x-[20deg]",
              "bg-linear-to-r from-transparent via-raised to-transparent dark:via-fg/[0.09]",
              // Crosses once on the way in (850ms), snaps home unseen on the way out (0ms),
              // so leaving never plays it backwards.
              "-translate-x-[120%] transition-[translate] duration-0 ease-in-out-quart",
              "group-hover/pill:translate-x-[240%] group-hover/pill:duration-[850ms]",
              "group-focus-visible/pill:translate-x-[240%] group-focus-visible/pill:duration-[850ms]",
            )}
          />
        </span>

        {badge != null && badge !== false && (
          <span
            data-slot="announcement-pill-badge"
            className={cn(
              "inline-flex shrink-0 items-center rounded-full font-medium tracking-[-0.005em] transition-colors duration-150",
              sm ? "h-5 px-1.5 text-[11px]" : "h-6 px-2 text-[11.5px]",
              badgeVariant === "solid" ? "bg-fg text-frame" : "border border-line-2 bg-frame text-fg group-hover/pill:border-fg-4/70",
            )}
          >
            {badge}
            {/* Read as "New: Agent mode is here", not "New Agent mode is here". */}
            <span className="sr-only">: </span>
          </span>
        )}

        <span className="min-w-0 truncate font-[450] tracking-[-0.005em]">{children}</span>

        <Arrow external={external} />
        {external && <span className="sr-only"> (opens in a new tab)</span>}
      </>
    ),
  };

  return useRender({ defaultTagName: "a", render, props: mergeProps<"a">(own, rest) });
}

/**
 * At rest a chevron. On hover it steps 1.5px forward and a stem draws in behind
 * it, so the mark turns into an arrow pointing where the link goes.
 */
function Arrow({ external }: { external: boolean }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
    className: "-mr-0.5 shrink-0 text-fg-3 transition-colors duration-150 group-hover/pill:text-fg group-focus-visible/pill:text-fg",
  };
  const move = "transition-transform duration-200 ease-out-quart";
  if (external)
    return (
      <svg {...common}>
        <g className={cn(move, "group-hover/pill:translate-x-px group-hover/pill:-translate-y-px group-focus-visible/pill:translate-x-px group-focus-visible/pill:-translate-y-px")}>
          <path d="M5 11 11 5M6 5h5v5" />
        </g>
      </svg>
    );
  return (
    <svg {...common}>
      <path
        d="M3.75 8h6.5"
        className={cn(
          "origin-right [transform-box:fill-box] scale-x-0 opacity-0",
          "transition-[scale,opacity,translate] duration-200 ease-out-quart",
          "group-hover/pill:translate-x-[1.5px] group-hover/pill:scale-x-100 group-hover/pill:opacity-100",
          "group-focus-visible/pill:translate-x-[1.5px] group-focus-visible/pill:scale-x-100 group-focus-visible/pill:opacity-100",
        )}
      />
      <path d="m7.25 4.5 3.5 3.5-3.5 3.5" className={cn(move, "group-hover/pill:translate-x-[1.5px] group-focus-visible/pill:translate-x-[1.5px]")} />
    </svg>
  );
}
