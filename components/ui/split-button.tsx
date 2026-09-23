"use client";
import { Button as BaseButton } from "@base-ui/react/button";
import { Menu } from "@base-ui/react/menu";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { Spinner, useBusyDisplay } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type SplitButtonAction = {
  value: string;
  label: string;
  /** A second line in the menu: what this choice does differently. */
  description?: string;
  icon?: React.ReactNode;
  /** Keys shown at the end of the menu row, space-separated: "⌘ ⇧ S". */
  shortcut?: string;
  disabled?: boolean;
  /** Destructive: shown in the danger color, after a separator. */
  danger?: boolean;
  /** Runs when the row is chosen (menu mode only). */
  onSelect?: () => void;
};

export type SplitButtonProps = Omit<React.ComponentProps<"div">, "onClick" | "defaultValue"> & {
  /** The main action's label. In select mode the chosen action's label is shown instead. */
  children?: React.ReactNode;
  /** Icon before the main label. */
  icon?: React.ReactNode;
  actions: SplitButtonAction[];
  /** Runs the main action. In select mode it receives the chosen action's value. */
  onClick?: (value?: string) => void;
  /**
   * Select mode: choosing a menu row makes it the main action (the label morphs
   * in place) instead of running it. Turned on by passing value or defaultValue.
   */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  /** Accessible name of the chevron. */
  menuLabel?: string;
  /** Where the menu renders; defaults to the body. */
  container?: HTMLElement | null;
};

const sizes = {
  sm: { h: "h-7 text-[12px] [&_svg]:size-3.5", main: "px-2 has-[[data-icon]]:pl-1.5 rounded-s-md", chevron: "w-6 rounded-e-md", radius: "rounded-md" },
  md: { h: "h-8 text-[12.5px] [&_svg]:size-4", main: "px-2.5 has-[[data-icon]]:pl-2 rounded-s-lg", chevron: "w-7 rounded-e-lg", radius: "rounded-lg" },
  lg: { h: "h-9 text-[13px] [&_svg]:size-4", main: "px-3 has-[[data-icon]]:pl-2.5 rounded-s-lg", chevron: "w-8 rounded-e-lg", radius: "rounded-lg" },
};

const looks = {
  primary: {
    part: "bg-fg text-frame hover:bg-fg/90 data-popup-open:bg-fg/85",
    divider: "bg-frame/20",
  },
  secondary: {
    part: "border border-line-2 bg-raised text-fg hover:bg-hover data-popup-open:bg-hover",
    divider: "bg-line-2",
  },
};

const item =
  "group/item relative flex cursor-default select-none items-start gap-2.5 rounded-lg px-2 py-[7px] text-[13px] leading-[18px] outline-none data-disabled:opacity-45";

/**
 * A main action with its alternatives one press away. The chevron opens a menu
 * that grows from it; in select mode the choice becomes the main action.
 */
export function SplitButton({
  children,
  icon,
  actions,
  onClick,
  value,
  defaultValue,
  onValueChange,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  menuLabel = "More options",
  container,
  className,
  ...rest
}: SplitButtonProps) {
  const reduce = useReducedMotion();
  const selectable = value !== undefined || defaultValue !== undefined;
  const [selected, setSelected] = useControllableState({ value, defaultValue: defaultValue ?? actions[0]?.value ?? "", onChange: onValueChange });
  const current = selectable ? actions.find((a) => a.value === selected) : undefined;
  const shown = useBusyDisplay(loading);
  const busy = loading || shown;
  const groupRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLButtonElement>(null);
  const chose = useRef(false);
  const s = sizes[size];
  const look = looks[variant];
  const mainIcon = current?.icon ?? icon;
  const regular = actions.filter((a) => !a.danger);
  const dangerous = actions.filter((a) => a.danger);

  const part = cn(
    "relative inline-flex shrink-0 select-none items-center justify-center font-medium tracking-[-0.005em] outline-none",
    "touch-manipulation [-webkit-tap-highlight-color:transparent] focus-visible:z-10",
    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
    "transition-[background-color,border-color,color] duration-150 ease-out-quart",
    "data-disabled:pointer-events-none",
    s.h,
    look.part,
  );

  // Every label in one grid cell: the button is as wide as the longest choice, so
  // switching never moves anything around it.
  const labels = selectable ? actions.map((a) => a.label) : [];
  const swapIn = reduce ? { opacity: 0 } : { opacity: 0, y: 7, filter: "blur(3px)" };
  const swapOut = reduce ? { opacity: 0 } : { opacity: 0, y: -7, filter: "blur(3px)" };
  const here = { opacity: 1, y: 0, filter: "blur(0px)" };

  return (
    <div
      ref={groupRef}
      role="group"
      data-variant={variant}
      data-size={size}
      data-disabled={disabled ? "" : undefined}
      className={cn(
        "inline-flex shrink-0 items-stretch shadow-[var(--shadow)] transition-[scale,opacity] duration-150 ease-out-quart",
        // One object: pressing either half pushes the whole thing, so the seam never opens.
        "has-[button:active:not([data-disabled])]:scale-[0.98] has-[button:active]:duration-75",
        disabled && "opacity-50",
        s.radius,
        className,
      )}
      {...rest}
    >
      <BaseButton
        ref={mainRef}
        disabled={disabled || busy}
        focusableWhenDisabled={busy && !disabled}
        aria-busy={busy || undefined}
        data-busy={busy ? "" : undefined}
        onClick={() => onClick?.(current?.value)}
        className={cn(part, s.main, "data-busy:cursor-progress", variant === "secondary" && "border-e-0")}
      >
        <span className="grid place-items-center">
          <motion.span
            className="col-start-1 row-start-1 inline-flex items-center gap-1.5"
            initial={false}
            animate={shown ? swapOut : here}
            transition={{ duration: reduce ? 0.15 : 0.22, ease: ease.out }}
          >
            {mainIcon && (
              <span data-icon aria-hidden className="relative grid size-4 shrink-0 place-items-center [&>*]:col-start-1 [&>*]:row-start-1">
                <AnimatePresence initial={false}>
                  <motion.span
                    key={current?.value ?? "icon"}
                    className="grid place-items-center"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(3px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(3px)" }}
                    transition={reduce ? { duration: 0.15 } : spring.pop}
                  >
                    {mainIcon}
                  </motion.span>
                </AnimatePresence>
              </span>
            )}
            {selectable ? (
              <span className="grid overflow-hidden py-1 text-left">
                {labels.map((l) => (
                  <span key={l} aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap">
                    {l}
                  </span>
                ))}
                <AnimatePresence initial={false}>
                  <motion.span
                    key={current?.value}
                    className="col-start-1 row-start-1 whitespace-nowrap"
                    initial={swapIn}
                    animate={here}
                    exit={swapOut}
                    transition={{ duration: reduce ? 0.15 : 0.24, ease: ease.out }}
                  >
                    {current?.label}
                  </motion.span>
                </AnimatePresence>
              </span>
            ) : (
              <span className="whitespace-nowrap">{children}</span>
            )}
          </motion.span>
          <AnimatePresence initial={false}>
            {shown && (
              <motion.span
                key="busy"
                className="col-start-1 row-start-1 grid place-items-center"
                initial={swapIn}
                animate={here}
                exit={{ ...swapIn, transition: { duration: 0.15 } }}
                transition={{ duration: reduce ? 0.15 : 0.22, ease: ease.out }}
              >
                <Spinner />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </BaseButton>

      <span aria-hidden className={cn("w-px shrink-0", look.divider)} />

      <Menu.Root modal={false} disabled={disabled || busy}>
        <Menu.Trigger aria-label={menuLabel} className={cn(part, s.chevron, "group/chevron", variant === "secondary" && "border-s-0")}>
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="transition-transform duration-200 ease-out-expo group-data-popup-open/chevron:rotate-180 motion-reduce:transition-none"
          >
            <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
          </svg>
        </Menu.Trigger>
        <Menu.Portal container={container}>
          <Menu.Positioner anchor={groupRef} side="bottom" align="end" sideOffset={6} collisionPadding={8} className="z-(--z-dropdown) outline-none">
            <Menu.Popup
              finalFocus={() => {
                // After choosing a new main action, focus lands on it so Enter runs it.
                const next = chose.current ? mainRef.current : true;
                chose.current = false;
                return next;
              }}
              className={cn(
                "min-w-(--anchor-width) max-w-[min(320px,var(--available-width))] rounded-xl border border-line-2 bg-raised p-1 shadow-pop outline-none",
                "origin-(--transform-origin) transition-[opacity,scale,translate] duration-180 ease-out-expo",
                "data-starting-style:-translate-y-1 data-starting-style:scale-96 data-starting-style:opacity-0",
                "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-120",
                "data-instant:duration-0",
              )}
            >
              {selectable ? (
                <Menu.RadioGroup
                  value={selected}
                  onValueChange={(v: string) => {
                    chose.current = true;
                    setSelected(v);
                  }}
                >
                  {actions.map((a) => (
                    <Menu.RadioItem key={a.value} value={a.value} label={a.label} disabled={a.disabled} closeOnClick className={cn(item, "text-fg data-highlighted:bg-fg/[0.06]")}>
                      <span className="mt-px grid size-4 shrink-0 place-items-center text-fg">
                        <Menu.RadioItemIndicator keepMounted className="grid place-items-center">
                          <Tick />
                        </Menu.RadioItemIndicator>
                      </span>
                      <Row action={a} />
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
              ) : (
                <>
                  {regular.map((a) => (
                    <Menu.Item key={a.value} label={a.label} disabled={a.disabled} onClick={a.onSelect} className={cn(item, "text-fg data-highlighted:bg-fg/[0.06]")}>
                      {a.icon && <span aria-hidden className="mt-px grid size-4 shrink-0 place-items-center text-fg-3 [&_svg]:size-4 group-data-highlighted/item:text-fg-2">{a.icon}</span>}
                      <Row action={a} />
                    </Menu.Item>
                  ))}
                  {dangerous.length > 0 && regular.length > 0 && <Menu.Separator className="mx-2 my-1 h-px bg-line" />}
                  {dangerous.map((a) => (
                    <Menu.Item
                      key={a.value}
                      label={a.label}
                      disabled={a.disabled}
                      onClick={a.onSelect}
                      className={cn(item, "text-danger data-highlighted:bg-danger-soft")}
                    >
                      {a.icon && <span aria-hidden className="mt-px grid size-4 shrink-0 place-items-center [&_svg]:size-4">{a.icon}</span>}
                      <Row action={a} />
                    </Menu.Item>
                  ))}
                </>
              )}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}

function Row({ action }: { action: SplitButtonAction }) {
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{action.label}</span>
        {action.description && <span className="text-[12px] leading-[17px] text-fg-3">{action.description}</span>}
      </span>
      {action.shortcut && (
        <kbd className="ml-3 mt-px flex shrink-0 gap-0.5 font-sans">
          {action.shortcut.split(" ").map((k, i) => (
            <span key={i} className="grid h-4 min-w-4 place-items-center rounded-[4px] border border-line-2 px-1 font-mono text-[10px] leading-none text-fg-3">
              {k}
            </span>
          ))}
        </kbd>
      )}
    </>
  );
}

// Draws itself when its row becomes the chosen one; unchosen rows keep it at zero length.
function Tick() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        pathLength={1}
        className="[stroke-dasharray:1] [stroke-dashoffset:1] transition-[stroke-dashoffset] duration-300 ease-out-expo in-data-checked:[stroke-dashoffset:0] motion-reduce:transition-none"
      />
    </svg>
  );
}
