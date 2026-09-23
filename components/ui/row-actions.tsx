"use client";
import { Menu } from "@base-ui/react/menu";
import { Fragment, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { MoreH } from "@/lib/icons";
import { Tooltip, TooltipProvider, TooltipShortcut } from "@/components/ui/tooltip";

export type RowAction = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  /** Shown inline on hover and focus. Everything else lives in the menu; on touch, everything does. */
  inline?: boolean;
  /** A single key (e.g. "e") that runs the action while the row has focus, shown in tooltips and the menu. */
  shortcut?: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  /** Draw a separator above this item in the menu. */
  separated?: boolean;
};

// Touch screens have no hover to reveal inline actions, so they move into the menu. The inline
// buttons hide with CSS (no hydration risk); the menu, which only renders once opened, asks JS.
const coarse = "(hover: none), (pointer: coarse)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(coarse);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
function useTouch() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(coarse).matches, () => false);
}

export type RowActionsProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The row's name, used to label its actions for screen readers: "Actions for Launch review". */
  label: string;
  actions: RowAction[];
  /** The row's content. Make its primary link or button cover the row with after:absolute after:inset-0. */
  children: React.ReactNode;
  /** Trailing meta (a time, a count) that gives way to the actions on hover instead of being pushed aside. */
  trailing?: React.ReactNode;
  /** Label of the overflow button. */
  menuLabel?: string;
};

/**
 * A list row whose actions slide in from the right when it's hovered or focused, over the
 * trailing meta rather than beside it, so nothing in the row reflows. A menu holds the rest.
 */
export function RowActions({ label, actions, children, trailing, menuLabel = "More actions", className, onKeyDown, ...rest }: RowActionsProps) {
  const touch = useTouch();
  const inline = actions.filter((a) => a.inline);
  const menu = touch ? actions : actions.filter((a) => !a.inline);

  return (
    <div
      data-slot="row"
      className={cn(
        "group/row relative isolate flex min-h-12 items-center gap-3 rounded-lg px-2.5 py-2 transition-colors duration-150",
        "hover:bg-fg/[0.035] focus-within:bg-fg/[0.035] has-data-popup-open:bg-fg/[0.035]",
        className,
      )}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
        if ((e.target as HTMLElement).closest("input,textarea,[contenteditable=true],[role=menu]")) return;
        const hit = actions.find((a) => a.shortcut?.toLowerCase() === e.key.toLowerCase() && !a.disabled);
        if (hit) {
          e.preventDefault();
          hit.onSelect();
        }
      }}
      {...rest}
    >
      <div className="min-w-0 flex-1">{children}</div>

      {/* One grid cell holds both the meta and the actions, so the row keeps its width either way. */}
      <div className="relative grid shrink-0 items-center justify-items-end pointer-coarse:flex pointer-coarse:gap-2">
        {trailing != null && (
          <div
            className={cn(
              "col-start-1 row-start-1 flex items-center text-[12px] text-fg-3 tabular transition-[opacity,translate] duration-150 ease-out-quart",
              "pointer-fine:group-hover/row:-translate-x-1 pointer-fine:group-hover/row:opacity-0",
              "pointer-fine:group-focus-within/row:-translate-x-1 pointer-fine:group-focus-within/row:opacity-0",
              "pointer-fine:group-has-data-popup-open/row:opacity-0",
              "motion-reduce:translate-none",
            )}
          >
            {trailing}
          </div>
        )}

        <div
          role="group"
          aria-label={`Actions for ${label}`}
          className={cn(
            "relative z-10 col-start-1 row-start-1 flex items-center gap-0.5",
            // Hidden until the row is hovered or focused; still in the tab order, so focusing an action reveals it.
            "pointer-fine:opacity-0 pointer-fine:group-hover/row:opacity-100 pointer-fine:group-focus-within/row:opacity-100 pointer-fine:group-has-data-popup-open/row:opacity-100",
            "transition-opacity duration-150",
          )}
        >
          <TooltipProvider delay={600}>
            {inline.map((a, i) => (
              <Tooltip key={a.id} content={a.label} shortcut={a.shortcut ? [a.shortcut] : undefined}>
                <button
                  type="button"
                  aria-label={a.label}
                  aria-keyshortcuts={a.shortcut?.toUpperCase()}
                  disabled={a.disabled}
                  onClick={a.onSelect}
                  // Buttons arrive from the right, nearest the edge first, 20ms apart; they leave together.
                  style={{ "--i": inline.length - i } as React.CSSProperties}
                  className={cn(
                    "relative hidden size-7 items-center justify-center rounded-md text-fg-3 outline-none pointer-fine:inline-flex",
                    "transition-[opacity,translate,background-color,color,scale] duration-200 ease-out-expo",
                    "translate-x-2 opacity-0 group-hover/row:translate-x-0 group-hover/row:opacity-100 group-focus-within/row:translate-x-0 group-focus-within/row:opacity-100",
                    "group-hover/row:[transition-delay:calc(var(--i)*20ms),calc(var(--i)*20ms),0ms,0ms,0ms]",
                    "hover:bg-fg/[0.07] hover:text-fg active:scale-[0.9] active:duration-75",
                    a.tone === "danger" && "hover:bg-danger-soft hover:text-danger",
                    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
                    "disabled:pointer-events-none disabled:opacity-40",
                    "motion-reduce:translate-x-0 [&_svg]:size-4",
                  )}
                >
                  {a.icon}
                </button>
              </Tooltip>
            ))}
          </TooltipProvider>

          {menu.length > 0 && (
            <Menu.Root>
              <Menu.Trigger
                aria-label={menuLabel}
                className={cn(
                  "relative inline-flex size-7 items-center justify-center rounded-md text-fg-3 outline-none",
                  "transition-[background-color,color,scale] duration-150 hover:bg-fg/[0.07] hover:text-fg active:scale-[0.9] active:duration-75",
                  "data-popup-open:bg-fg/[0.09] data-popup-open:text-fg",
                  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
                  "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
                )}
              >
                <MoreH />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner side="bottom" align="end" sideOffset={4} collisionPadding={8} className="z-(--z-dropdown)">
                  <Menu.Popup
                    className={cn(
                      "min-w-44 max-w-(--available-width) rounded-xl border border-line-2 bg-raised p-1 text-fg shadow-pop outline-none",
                      "origin-(--transform-origin) transition-[opacity,scale,translate] duration-160 ease-out-expo",
                      "data-starting-style:scale-96 data-starting-style:opacity-0 data-starting-style:-translate-y-1",
                      "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-100",
                      "data-instant:transition-none motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:translate-y-0",
                    )}
                  >
                    {menu.map((a, i) => (
                      <Fragment key={a.id}>
                        {i > 0 && (a.separated || (touch && i === inline.length)) && <Menu.Separator className="mx-2 my-1 h-px bg-line" />}
                        <Menu.Item
                          disabled={a.disabled}
                          onClick={a.onSelect}
                          className={cn(
                            "flex h-8 cursor-default select-none items-center gap-2.5 rounded-lg px-2 text-[13px] outline-none pointer-coarse:h-10 pointer-coarse:text-[14px]",
                            "transition-colors duration-75 data-highlighted:bg-fg/[0.06]",
                            "data-disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
                            a.tone === "danger" ? "text-danger data-highlighted:bg-danger-soft" : "text-fg [&_svg]:text-fg-3",
                          )}
                        >
                          {a.icon}
                          <span className="min-w-0 flex-1 truncate">{a.label}</span>
                          {a.shortcut && !touch && <TooltipShortcut keys={[a.shortcut]} className="mr-0 opacity-80" />}
                        </Menu.Item>
                      </Fragment>
                    ))}
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          )}
        </div>
      </div>
    </div>
  );
}
