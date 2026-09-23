"use client";
import NumberFlow from "@number-flow/react";
import { Popover } from "@base-ui/react/popover";
import { Tooltip } from "@base-ui/react/tooltip";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Avatar, type Presence } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { dur, ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type AvatarGroupPerson = {
  /** Stable key. Falls back to the name. */
  id?: string;
  name: string;
  src?: string;
  status?: Presence;
  /** A short second line: a role, an email, "Editing". Shown in the tooltip and the list. */
  meta?: string;
};

type Size = "xs" | "sm" | "md" | "lg";
const px: Record<Size, number> = { xs: 20, sm: 24, md: 32, lg: 40 };

type Tip = { title: string; meta?: string };

// One registered custom property drives the hover spread. Registering it lets CSS interpolate it,
// so the faces and the cutouts that follow them move together, and reverse mid-way when the
// pointer leaves. React hoists and dedupes this, however many groups are on the page.
const spreadRule = "@property --avatar-spread{syntax:'<length>';inherits:true;initial-value:0px}";

export type AvatarGroupProps = Omit<React.ComponentProps<"div">, "children"> & {
  people: AvatarGroupPerson[];
  /** Most circles drawn, the +N chip included. One extra person is shown rather than a "+1". */
  max?: number;
  size?: Size;
  /** What the group is: "Viewing now", "Assignees". Titles the list and names the button. */
  label?: string;
  /** Draws placeholder faces while the people load. */
  loading?: boolean;
  /** Rendered when there is nobody. Nothing by default. */
  empty?: React.ReactNode;
  /** Where the list popover and tooltips portal. Defaults to document.body. */
  container?: HTMLElement | React.RefObject<HTMLElement | null> | null;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * A stack of faces that opens the full list. The overlaps are real cutouts, so it sits on any
 * surface. On hover the stack eases apart and one tooltip glides from face to face.
 */
export function AvatarGroup({
  people,
  max = 4,
  size = "sm",
  label = "People",
  loading = false,
  empty = null,
  container,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  className,
  style,
  ...rest
}: AvatarGroupProps) {
  const reduce = useReducedMotion();
  const [tip] = useState(() => Tooltip.createHandle<Tip>());
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });

  const s = px[size];
  const overlap = Math.round(s * 0.3);
  const gap = s >= 32 ? 2 : 1.5;
  const cap = Math.max(2, max);
  const fits = people.length <= cap;
  const shown = fits ? people : people.slice(0, cap - 1);
  const hidden = fits ? [] : people.slice(cap - 1);

  if (!loading && people.length === 0) return <>{empty}</>;

  // Each face after the first has a circle punched out where the one before it sits, plus a gap,
  // so the stack reads the same on a card, a hover wash or a photo. Opaque stops only lend alpha.
  const cut = `radial-gradient(circle at calc(${overlap - s / 2}px - var(--avatar-spread)) 50%, transparent ${s / 2 + gap}px, var(--fg) ${s / 2 + gap + 0.5}px)`;
  const count = shown.length + (hidden.length > 0 ? 1 : 0);
  // The spread fans out from the middle, so the stack grows evenly into both sides of its slot.
  const item = (i: number, n = count): React.CSSProperties => ({
    zIndex: 20 - i,
    marginLeft: i === 0 ? 0 : -overlap,
    translate: `calc(var(--avatar-spread) * ${i - (n - 1) / 2}) 0`,
    maskImage: i === 0 ? undefined : cut,
    WebkitMaskImage: i === 0 ? undefined : cut,
  });

  const names = people.map((p) => p.name);
  const spoken =
    names.length <= 3
      ? `${label}: ${new Intl.ListFormat("en", { type: "conjunction" }).format(names)}`
      : `${label}: ${names.slice(0, 2).join(", ")} and ${names.length - 2} others`;

  const enter = reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 };
  const transition = reduce ? { duration: 0.15 } : spring.pop;

  if (loading)
    return (
      <div aria-busy aria-label={`Loading ${label.toLowerCase()}`} role="img" className={cn("inline-flex", className)} style={style} {...rest}>
        {Array.from({ length: Math.min(3, cap) }, (_, i) => (
          <span key={i} className="relative flex" style={item(i, 3)}>
            <Avatar loading size={s} alt="" />
          </span>
        ))}
      </div>
    );

  return (
    <div className={cn("inline-flex", className)} style={style} {...rest}>
      <style href="stealth-avatar-spread" precedence="default">
        {spreadRule}
      </style>
      <Popover.Root open={open} onOpenChange={(next) => setOpen(next)}>
        <Popover.Trigger
          aria-label={spoken}
          className={cn(
            "group/stack relative isolate inline-flex items-center rounded-full outline-none",
            "transition-[--avatar-spread,scale] duration-200 ease-out-quart active:scale-[0.97] active:duration-75",
            "hover:[--avatar-spread:3px] focus-visible:[--avatar-spread:3px] data-popup-open:[--avatar-spread:3px]",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            // The stack draws at 20–40px tall; on touch the target grows to 44px without moving it.
            "before:absolute before:-inset-y-2.5 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
          )}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((p, i) => (
              <motion.span
                key={p.id ?? p.name}
                layout={!reduce}
                initial={enter}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ ...enter, transition: { duration: dur.menu * 0.7, ease: ease.out } }}
                transition={transition}
                className="relative flex"
                style={item(i)}
              >
                <Tooltip.Trigger handle={tip} payload={{ title: p.name, meta: p.meta }} delay={400} render={<span className="flex rounded-full" />}>
                  <Avatar name={p.name} src={p.src} size={s} alt="" />
                </Tooltip.Trigger>
              </motion.span>
            ))}
            {hidden.length > 0 && (
              <motion.span
                key="overflow"
                layout={!reduce}
                initial={enter}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ ...enter, transition: { duration: dur.menu * 0.7, ease: ease.out } }}
                transition={transition}
                className="relative flex"
                style={item(shown.length)}
              >
                <Tooltip.Trigger
                  handle={tip}
                  payload={{ title: hiddenNames(hidden) }}
                  delay={400}
                  render={
                    <span
                      className={cn(
                        "grid place-items-center rounded-full bg-fg/[0.08] font-medium text-fg-2 tabular",
                        "transition-colors duration-150 group-hover/stack:bg-fg/[0.12] group-hover/stack:text-fg group-data-popup-open/stack:bg-fg/[0.12] group-data-popup-open/stack:text-fg",
                      )}
                      style={{ width: s, height: s, fontSize: Math.max(9.5, Math.round(s * 0.34 * 2) / 2) }}
                    />
                  }
                >
                  <NumberFlow value={hidden.length} prefix="+" className="leading-none" />
                </Tooltip.Trigger>
              </motion.span>
            )}
          </AnimatePresence>
        </Popover.Trigger>

        <Popover.Portal container={container}>
          <Popover.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={8} className="z-(--z-popover)">
            <Popover.Popup
              className={cn(
                "flex w-64 max-w-(--available-width) flex-col rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
                "origin-(--transform-origin) transition-[opacity,scale,translate,filter] duration-200 ease-out-expo",
                "data-starting-style:-translate-y-1 data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-starting-style:blur-[2px]",
                "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:ease-out-quart",
                "data-instant:transition-none",
              )}
            >
              <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-line px-3">
                <Popover.Title className="truncate text-[12.5px] font-medium text-fg">{label}</Popover.Title>
                <span className="font-mono text-2xs text-fg-3 tabular">{people.length}</span>
              </div>
              <ul
                aria-label={label}
                className="max-h-[228px] overflow-y-auto overscroll-contain p-1 [mask-image:linear-gradient(to_bottom,transparent,var(--fg)_6px,var(--fg)_calc(100%-6px),transparent)]"
              >
                {people.map((p) => (
                  <li key={p.id ?? p.name} className="flex h-10 items-center gap-2.5 rounded-lg px-2">
                    <Avatar name={p.name} src={p.src} size="sm" status={p.status} alt="" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{p.name}</span>
                    {p.meta && <span className="max-w-[45%] shrink-0 truncate text-[12px] text-fg-3">{p.meta}</span>}
                  </li>
                ))}
              </ul>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {/* One tooltip for the whole stack. It glides between faces instead of closing and reopening. */}
      <Tooltip.Root handle={tip} disabled={open}>
        {({ payload }) => (
          <Tooltip.Portal container={container}>
            <Tooltip.Positioner
              side="top"
              sideOffset={8}
              collisionPadding={8}
              className="z-(--z-tooltip) h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom] duration-200 ease-out-quart data-instant:transition-none"
            >
              <Tooltip.Popup
                className={cn(
                  "h-(--popup-height,auto) w-(--popup-width,auto) overflow-clip rounded-lg border border-line-2 bg-raised text-[12px] leading-4 text-fg shadow-pop outline-none",
                  "origin-(--transform-origin) transition-[opacity,scale,width,height] [transition-duration:150ms,150ms,200ms,200ms] ease-out-expo",
                  "data-starting-style:scale-96 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:[transition-duration:100ms]",
                  "data-instant:transition-none",
                )}
              >
                <Tooltip.Viewport
                  className={cn(
                    "relative h-full w-full",
                    "[&>*]:flex [&>*]:w-max [&>*]:max-w-[16rem] [&>*]:items-baseline [&>*]:gap-1.5 [&>*]:px-2 [&>*]:py-[5px]",
                    "[&>[data-previous]]:absolute [&>[data-previous]]:left-0 [&>[data-previous]]:top-0",
                    "[&>*]:transition-[opacity,filter] [&>*]:duration-150",
                    "[&>[data-current][data-starting-style]]:opacity-0 [&>[data-current][data-starting-style]]:blur-[2px]",
                    "[&>[data-previous][data-ending-style]]:opacity-0 [&>[data-previous]]:duration-100",
                  )}
                >
                  {payload && (
                    <>
                      <span className="truncate">{payload.title}</span>
                      {payload.meta && <span className="shrink-0 text-fg-3">{payload.meta}</span>}
                    </>
                  )}
                </Tooltip.Viewport>
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        )}
      </Tooltip.Root>
    </div>
  );
}

function hiddenNames(hidden: AvatarGroupPerson[]) {
  const first = hidden.slice(0, 2).map((p) => p.name.split(/\s+/)[0]);
  const rest = hidden.length - first.length;
  return rest > 0 ? `${first.join(", ")} and ${rest} more` : first.join(" and ");
}
