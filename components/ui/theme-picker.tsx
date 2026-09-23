"use client";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const query = "(prefers-color-scheme: dark)";
const subscribe = (fn: () => void) => {
  const mq = window.matchMedia(query);
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
};

/** What the device prefers right now, following changes live. Null on the server and during hydration. */
export function useSystemTheme(): ResolvedTheme | null {
  return useSyncExternalStore(
    subscribe,
    () => (window.matchMedia(query).matches ? "dark" : "light"),
    () => null,
  );
}

/** Resolves a choice to the theme to paint: System follows the device. */
export function useResolvedTheme(theme: Theme): ResolvedTheme | null {
  const system = useSystemTheme();
  return theme === "system" ? system : theme;
}

const defaults: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export type ThemePickerProps = Omit<
  React.ComponentProps<"div">,
  "defaultValue" | "onChange"
> & {
  value?: Theme;
  defaultValue?: Theme;
  /** Apply the theme here: set a data attribute, write a cookie, save to the account. */
  onValueChange?: (theme: Theme) => void;
  /** Which cards to show and in what order. */
  themes?: Theme[];
  /** Rename the cards, for another language or house style. */
  labels?: Partial<Record<Theme, React.ReactNode>>;
  disabled?: boolean;
  /** Submitted with a form. */
  name?: string;
};

/**
 * Three cards, each a small drawing of the app in that theme. One ring slides
 * to the chosen card; System shows what it resolves to right now.
 */
export function ThemePicker({
  value,
  defaultValue = "system",
  onValueChange,
  themes = ["light", "dark", "system"],
  labels,
  disabled = false,
  name,
  className,
  ...rest
}: ThemePickerProps) {
  const id = useId();
  const reduce = useReducedMotion();
  const system = useSystemTheme();
  const [theme, setTheme] = useControllableState<Theme>({
    value,
    defaultValue,
    onChange: onValueChange,
  });
  // Arrow keys move the choice instantly; a click earns the slide.
  const [keyboard, setKeyboard] = useState(false);

  return (
    <RadioGroup
      value={theme}
      onValueChange={(v) => setTheme(v as Theme)}
      disabled={disabled}
      name={name}
      onKeyDownCapture={() => setKeyboard(true)}
      onPointerDownCapture={() => setKeyboard(false)}
      className={cn("grid w-full gap-3", disabled && "opacity-50", className)}
      style={{
        gridTemplateColumns: `repeat(${themes.length}, minmax(0, 1fr))`,
      }}
      {...rest}
    >
      {themes.map((t) => {
        const checked = theme === t;
        return (
          <Radio.Root
            key={t}
            value={t}
            className={cn(
              "group/card relative flex min-w-0 cursor-default select-none flex-col gap-2 rounded-xl outline-none",
              // Focus sits outside the selection ring so the two never merge.
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-[6px] focus-visible:outline-fg-3",
              "data-disabled:cursor-not-allowed",
            )}
          >
            <span className="relative block">
              {checked && (
                <motion.span
                  layoutId={`${id}-ring`}
                  aria-hidden
                  className="pointer-events-none absolute -inset-[3px] z-[1] rounded-[13px] border-[1.5px] border-fg"
                  transition={
                    reduce || keyboard ? { duration: 0 } : spring.snappy
                  }
                />
              )}
              <span
                className={cn(
                  "relative block aspect-[8/5] overflow-hidden rounded-[10px] border border-line-2",
                  "transition-[border-color,scale] duration-150 ease-out group-active/card:scale-[0.98] group-active/card:duration-75",
                  "group-hover/card:border-fg-4 group-data-disabled/card:group-hover/card:border-line-2 group-data-disabled/card:group-active/card:scale-100",
                )}
              >
                {t === "system" ? (
                  <>
                    <Preview theme="light" />
                    {/* The same drawing twice, the dark one clipped to the right half. */}
                    <span className="absolute inset-0 block [clip-path:inset(0_0_0_50%)]">
                      <Preview theme="dark" />
                    </span>
                  </>
                ) : (
                  <Preview theme={t} />
                )}
              </span>
            </span>
            <span className="flex min-w-0 items-center gap-2 px-0.5">
              <Indicator checked={checked} reduce={!!reduce} />
              <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                <span
                  className={cn(
                    "truncate text-[13px] leading-5 transition-colors duration-150",
                    checked ? "text-fg" : "text-fg-2 group-hover/card:text-fg",
                  )}
                >
                  {labels?.[t] ?? defaults[t]}
                </span>
                {t === "system" && system && (
                  <span
                    className="hidden truncate text-[12px] text-fg-4 min-[420px]:inline"
                    suppressHydrationWarning
                  >
                    {system === "dark" ? "Dark now" : "Light now"}
                  </span>
                )}
              </span>
            </span>
          </Radio.Root>
        );
      })}
    </RadioGroup>
  );
}

function Indicator({ checked, reduce }: { checked: boolean; reduce: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative grid size-3.5 shrink-0 place-items-center rounded-full border transition-colors duration-150",
        checked
          ? "border-fg bg-fg"
          : "border-line-2 group-hover/card:border-fg-4",
      )}
    >
      <AnimatePresence initial={false}>
        {checked && (
          <motion.svg
            key="check"
            viewBox="0 0 16 16"
            className="size-2.5 text-frame"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.5, transition: { duration: 0.1 } }
            }
            transition={reduce ? { duration: 0.12 } : spring.pop}
          >
            <motion.path
              d="M3.5 8.5 6.5 11.5 12.5 4.5"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.26, ease: ease.out, delay: 0.05 }}
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </span>
  );
}

// A small drawing of an app window. Setting data-theme on it swaps every token
// underneath, so the drawing is always in the real palette of that theme.
function Preview({ theme }: { theme: ResolvedTheme }) {
  // Sized in container units so the drawing keeps its proportions from a phone to a wide card.
  return (
    <span
      data-theme={theme}
      aria-hidden
      className="absolute inset-0 block bg-page [container-type:size]"
    >
      <span className="absolute inset-0 flex pt-[13cqh] pl-[10cqw]">
        <span className="flex flex-1 overflow-hidden rounded-tl-[6px] border-t border-l border-line-2 bg-frame shadow-[var(--shadow)]">
          <span className="flex w-[30%] flex-col gap-[8cqh] border-r border-line px-[3cqw] pt-[11cqh]">
            <span className="flex items-center gap-[2cqw]">
              <span className="size-[7cqh] shrink-0 rounded-full bg-fg-3" />
              <span className="h-[4.5cqh] flex-1 rounded-full bg-fg-4" />
            </span>
            <span className="h-[4.5cqh] w-[80%] rounded-full bg-line-2" />
            <span className="h-[4.5cqh] w-[60%] rounded-full bg-line-2" />
            <span className="h-[4.5cqh] w-[70%] rounded-full bg-line-2" />
          </span>
          <span className="flex flex-1 flex-col items-start gap-[8cqh] px-[5cqw] pt-[11cqh]">
            <span className="h-[5cqh] w-[45%] rounded-full bg-fg-2" />
            <span className="flex w-full flex-col gap-[5cqh] rounded-[4px] border border-line bg-raised p-[6cqh]">
              <span className="h-[4.5cqh] w-[85%] rounded-full bg-line-2" />
              <span className="h-[4.5cqh] w-[60%] rounded-full bg-line-2" />
            </span>
            <span className="h-[10cqh] w-[34%] rounded-full bg-fg" />
          </span>
        </span>
      </span>
    </span>
  );
}
