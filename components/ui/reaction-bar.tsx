"use client";
import { Popover } from "@base-ui/react/popover";
import { Tooltip } from "@base-ui/react/tooltip";
import NumberFlow from "@number-flow/react";
import {
  AnimatePresence,
  motion,
  useAnimate,
  useReducedMotion,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type Reaction = {
  emoji: string;
  /** Total people who reacted with it, the viewer included. */
  count: number;
  /** Whether the viewer is one of them. */
  reacted?: boolean;
  /** Names of some or all of the people, for the tooltip. The viewer is added and removed for you. */
  people?: string[];
};

export type ReactionChoice = { emoji: string; label: string };

export const defaultChoices: ReactionChoice[] = [
  { emoji: "👍", label: "Thumbs up" },
  { emoji: "❤️", label: "Heart" },
  { emoji: "😂", label: "Laughing" },
  { emoji: "🎉", label: "Party popper" },
  { emoji: "😮", label: "Surprised" },
  { emoji: "🙏", label: "Thank you" },
  { emoji: "👀", label: "Eyes" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "✅", label: "Done" },
  { emoji: "🚀", label: "Rocket" },
  { emoji: "💯", label: "Hundred" },
  { emoji: "👏", label: "Clapping" },
  { emoji: "🤔", label: "Thinking" },
  { emoji: "😢", label: "Sad" },
  { emoji: "👎", label: "Thumbs down" },
  { emoji: "💡", label: "Idea" },
];

/* -------------------------------------------------------------------------------------------------
 * The reducer: one toggle, used for the optimistic change and for its rollback
 * -----------------------------------------------------------------------------------------------*/

/** Adds or removes the viewer's reaction. A reaction nobody has any more disappears. */
export function toggleReaction(
  list: Reaction[],
  emoji: string,
  you = "You",
): Reaction[] {
  const found = list.find((r) => r.emoji === emoji);
  if (!found)
    return [...list, { emoji, count: 1, reacted: true, people: [you] }];
  return list
    .map((r) => {
      if (r.emoji !== emoji) return r;
      const people = (r.people ?? []).filter((p) => p !== you);
      return r.reacted
        ? { ...r, reacted: false, count: Math.max(0, r.count - 1), people }
        : { ...r, reacted: true, count: r.count + 1, people: [you, ...people] };
    })
    .filter((r) => r.count > 0);
}

const list = new Intl.ListFormat("en", { type: "conjunction" });

// "You, Maya and Jon", "Maya, Jon and 4 others". The viewer always comes first.
function who(r: Reaction, you: string) {
  const names = [
    ...(r.reacted ? [you] : []),
    ...(r.people ?? []).filter((p) => p !== you),
  ];
  const shown = names.slice(0, 3);
  const rest = Math.max(0, r.count - shown.length);
  if (!shown.length) return r.count === 1 ? "1 person" : `${r.count} people`;
  return rest > 0
    ? `${shown.join(", ")} and ${rest} ${rest === 1 ? "other" : "others"}`
    : list.format(shown);
}

/* -------------------------------------------------------------------------------------------------
 * ReactionBar
 * -----------------------------------------------------------------------------------------------*/

type Tip = { title: string; sub?: string; emoji?: string };

export type ReactionBarProps = Omit<
  React.ComponentProps<"div">,
  "defaultValue" | "onChange"
> & {
  value?: Reaction[];
  defaultValue?: Reaction[];
  /** Fires on every change, including a rollback after a failed save. */
  onValueChange?: (next: Reaction[]) => void;
  /** Persist one toggle. Return a promise; if it rejects, that toggle is undone and the bar says so. */
  onReact?: (emoji: string, reacted: boolean) => unknown;
  /** What the picker offers, in order. */
  choices?: ReactionChoice[];
  /** How the viewer appears in the people list. */
  you?: string;
  size?: "sm" | "md";
  /** Shows the reactions without letting anyone change them: archived threads, signed-out views. */
  readOnly?: boolean;
  /** Where the picker and tooltips portal. Defaults to document.body. */
  container?: HTMLElement | React.RefObject<HTMLElement | null> | null;
};

/**
 * Reactions under a message. Yours pops and its count rolls; a new one springs into the row
 * while its neighbors make room; the tooltip says who. Saves are optimistic and roll back.
 */
export function ReactionBar({
  value: valueProp,
  defaultValue = [],
  onValueChange,
  onReact,
  choices = defaultChoices,
  you = "You",
  size = "md",
  readOnly = false,
  container,
  className,
  ...rest
}: ReactionBarProps) {
  const reduce = useReducedMotion();
  const [value, setValue] = useControllableState({
    value: valueProp,
    defaultValue,
    onChange: onValueChange,
  });
  const [tip] = useState(() => Tooltip.createHandle<Tip>());
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<{ emoji: string; message: string } | null>(
    null,
  );
  const [bumps, setBumps] = useState<Record<string, number>>({});
  const latest = useRef(value);
  const errorTimer = useRef<number>(undefined);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  useEffect(() => () => window.clearTimeout(errorTimer.current), []);

  const label = (emoji: string) =>
    choices.find((c) => c.emoji === emoji)?.label ?? emoji;

  const react = (emoji: string) => {
    const before = latest.current.find((r) => r.emoji === emoji);
    const adding = !before?.reacted;
    const next = toggleReaction(latest.current, emoji, you);
    latest.current = next;
    setValue(next);
    setError(null);
    if (adding) setBumps((b) => ({ ...b, [emoji]: (b[emoji] ?? 0) + 1 }));
    if (!onReact) return;
    Promise.resolve()
      .then(() => onReact(emoji, adding))
      .catch(() => {
        // Undo just this toggle, on top of whatever else has changed since.
        const undone = toggleReaction(latest.current, emoji, you);
        latest.current = undone;
        setValue(undone);
        setError({
          emoji,
          message: `Couldn’t ${adding ? "add" : "remove"} ${label(emoji).toLowerCase()}`,
        });
        window.clearTimeout(errorTimer.current);
        errorTimer.current = window.setTimeout(() => setError(null), 5000);
      });
  };

  const h = size === "sm" ? "h-6 text-[11.5px]" : "h-7 text-[12px]";
  const chipBase = cn(
    "relative inline-flex items-center gap-1.5 rounded-full border px-2 font-medium tabular outline-none select-none",
    "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.94] active:duration-75",
    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
    // Chips draw at 24–28px; on touch each grows a 44px target without moving.
    "before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
    h,
  );

  return (
    <div
      role="group"
      aria-label="Reactions"
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      {...rest}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {value.map((r) => (
          <motion.span
            key={r.emoji}
            layout={reduce ? false : "position"}
            initial={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.6, filter: "blur(2px)" }
            }
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={
              reduce
                ? { opacity: 0, transition: { duration: 0.1 } }
                : {
                    opacity: 0,
                    scale: 0.6,
                    filter: "blur(2px)",
                    transition: { duration: 0.14, ease: ease.out },
                  }
            }
            transition={
              reduce
                ? { duration: 0.15 }
                : { ...spring.pop, layout: spring.snappy }
            }
            className="flex"
          >
            <Tooltip.Trigger
              handle={tip}
              payload={{
                title: who(r, you),
                sub: `reacted with ${label(r.emoji).toLowerCase()}`,
                emoji: r.emoji,
              }}
              delay={400}
              disabled={open}
              render={
                <Chip
                  reaction={r}
                  label={label(r.emoji)}
                  bump={bumps[r.emoji] ?? 0}
                  failed={error?.emoji === r.emoji}
                  readOnly={readOnly}
                  className={chipBase}
                  onClick={() => react(r.emoji)}
                />
              }
            />
          </motion.span>
        ))}

        {!readOnly && (
          <motion.span
            key="add"
            layout={reduce ? false : "position"}
            transition={spring.snappy}
            className="flex"
          >
            <Popover.Root open={open} onOpenChange={setOpen}>
              <Popover.Trigger
                aria-label="Add reaction"
                className={cn(
                  chipBase,
                  "group/add justify-center border-line-2 bg-raised text-fg-3 hover:border-fg-4 hover:bg-hover hover:text-fg data-popup-open:border-fg-4 data-popup-open:bg-hover data-popup-open:text-fg",
                  size === "sm" ? "w-8 px-0" : "w-9 px-0",
                )}
              >
                <Tooltip.Trigger
                  handle={tip}
                  payload={{ title: "Add reaction" }}
                  delay={400}
                  disabled={open}
                  render={
                    <span className="grid size-full place-items-center" />
                  }
                >
                  <AddGlyph size={size === "sm" ? 14 : 16} />
                </Tooltip.Trigger>
              </Popover.Trigger>
              <Popover.Portal container={container}>
                <Popover.Positioner
                  side="top"
                  align="start"
                  sideOffset={8}
                  collisionPadding={8}
                  className="z-(--z-popover)"
                >
                  <Popover.Popup
                    className={cn(
                      "rounded-xl border border-line-2 bg-raised p-1.5 text-fg shadow-pop outline-none",
                      "origin-(--transform-origin) transition-[opacity,scale,translate,filter] duration-180 ease-out-expo",
                      "data-starting-style:scale-[0.94] data-starting-style:opacity-0 data-starting-style:blur-[2px]",
                      "data-[side=top]:data-starting-style:translate-y-1 data-[side=bottom]:data-starting-style:-translate-y-1",
                      "data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-ending-style:duration-120 data-ending-style:ease-out-quart",
                      "data-instant:transition-none motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:blur-none",
                    )}
                  >
                    <Popover.Title className="sr-only">
                      Add reaction
                    </Popover.Title>
                    <Picker
                      choices={choices}
                      mine={
                        new Set(
                          value.filter((r) => r.reacted).map((r) => r.emoji),
                        )
                      }
                      onPick={(emoji) => {
                        react(emoji);
                        setOpen(false);
                      }}
                    />
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </motion.span>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {error && (
          // Its own line, opened to height, so the thread below eases down instead of jumping.
          <motion.span
            key="error"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{
              height: 0,
              opacity: 0,
              transition: { duration: reduce ? 0 : 0.16, ease: ease.inOut },
            }}
            transition={
              reduce
                ? { duration: 0 }
                : {
                    height: { duration: 0.22, ease: ease.inOut },
                    opacity: { duration: 0.18, ease: ease.out },
                  }
            }
            className="-mt-1.5 basis-full overflow-hidden"
          >
            <span className="flex items-center gap-1.5 pl-1 pt-1.5 text-[12px] text-danger">
              {error.message}
              <button
                type="button"
                onClick={() => react(error.emoji)}
                className="rounded-sm font-medium text-fg underline decoration-fg-4 underline-offset-[3px] outline-none transition-[text-decoration-color] duration-150 hover:decoration-fg-2 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
              >
                Try again
              </button>
            </span>
          </motion.span>
        )}
      </AnimatePresence>
      <span role="status" aria-live="polite" className="sr-only">
        {error ? `${error.message}. Try again.` : ""}
      </span>

      {/* One tooltip for the row. It glides between chips instead of closing and reopening. */}
      <Tooltip.Root handle={tip}>
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
                  "data-instant:transition-none motion-reduce:data-starting-style:scale-100",
                )}
              >
                <Tooltip.Viewport
                  className={cn(
                    "relative h-full w-full",
                    "[&>*]:flex [&>*]:w-max [&>*]:max-w-[15rem] [&>*]:items-center [&>*]:gap-2 [&>*]:px-2 [&>*]:py-[5px]",
                    "[&>[data-previous]]:absolute [&>[data-previous]]:left-0 [&>[data-previous]]:top-0",
                    "[&>*]:transition-[opacity,filter] [&>*]:duration-150",
                    "[&>[data-current][data-starting-style]]:opacity-0 [&>[data-current][data-starting-style]]:blur-[2px]",
                    "[&>[data-previous][data-ending-style]]:opacity-0 [&>[data-previous]]:duration-100",
                  )}
                >
                  {payload && (
                    <>
                      {payload.emoji && (
                        <span className="shrink-0 text-[20px] leading-none">
                          {payload.emoji}
                        </span>
                      )}
                      <span className="flex min-w-0 flex-col">
                        <span className="text-pretty">{payload.title}</span>
                        {payload.sub && (
                          <span className="text-fg-3">{payload.sub}</span>
                        )}
                      </span>
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

/* -------------------------------------------------------------------------------------------------
 * Chip
 * -----------------------------------------------------------------------------------------------*/

type ChipProps = Omit<React.ComponentProps<"button">, "children"> & {
  reaction: Reaction;
  label: string;
  /** Increments each time the viewer adds this reaction; each increment pops the emoji once. */
  bump: number;
  failed: boolean;
  readOnly: boolean;
};

function Chip({
  reaction: r,
  label,
  bump,
  failed,
  readOnly,
  className,
  ...rest
}: ChipProps) {
  const reduce = useReducedMotion();
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const seen = useRef(bump);

  useEffect(() => {
    if (bump === seen.current) return;
    seen.current = bump;
    if (reduce || !scope.current) return;
    // Up, a little past, settle: the emoji takes the press like something soft.
    animate(
      scope.current,
      { scale: [1, 1.38, 0.92, 1], rotate: [0, -8, 4, 0] },
      { duration: 0.46, ease: ease.out, times: [0, 0.3, 0.65, 1] },
    );
  }, [bump, reduce, animate, scope]);

  const count = `${r.count} ${r.count === 1 ? "reaction" : "reactions"}`;
  return (
    <button
      type="button"
      aria-pressed={r.reacted ?? false}
      aria-label={`${label}, ${count}${r.reacted ? ", including you" : ""}`}
      aria-disabled={readOnly || undefined}
      data-reacted={r.reacted || undefined}
      data-failed={failed || undefined}
      className={cn(
        className,
        "border-line-2 bg-raised text-fg-2 hover:border-fg-4 hover:bg-hover hover:text-fg",
        "data-reacted:border-fg/30 data-reacted:bg-fg/[0.08] data-reacted:text-fg data-reacted:hover:bg-fg/[0.12]",
        "data-failed:border-danger/40 data-failed:text-danger",
        // Read-only chips still take focus and hover, so the names stay reachable; they just don't press.
        readOnly &&
          "cursor-default active:scale-100 hover:border-line-2 hover:bg-raised data-reacted:hover:bg-fg/[0.08]",
      )}
      {...rest}
      onClick={readOnly ? undefined : rest.onClick}
    >
      <span
        ref={scope}
        aria-hidden
        className="inline-block text-[1.2em] leading-none"
      >
        {r.emoji}
      </span>
      <NumberFlow value={r.count} aria-hidden className="leading-none" />
    </button>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Picker: a grid with arrow keys, one tab stop
 * -----------------------------------------------------------------------------------------------*/

const COLUMNS = 8;

function Picker({
  choices,
  mine,
  onPick,
}: {
  choices: ReactionChoice[];
  mine: Set<string>;
  onPick: (emoji: string) => void;
}) {
  const [active, setActive] = useState(0);
  const grid = useRef<HTMLDivElement>(null);

  const move = (e: React.KeyboardEvent) => {
    const last = choices.length - 1;
    const next =
      e.key === "ArrowRight"
        ? Math.min(last, active + 1)
        : e.key === "ArrowLeft"
          ? Math.max(0, active - 1)
          : e.key === "ArrowDown"
            ? Math.min(last, active + COLUMNS)
            : e.key === "ArrowUp"
              ? Math.max(0, active - COLUMNS)
              : e.key === "Home"
                ? 0
                : e.key === "End"
                  ? last
                  : -1;
    if (next < 0) return;
    e.preventDefault();
    setActive(next);
    grid.current
      ?.querySelectorAll<HTMLElement>("[role=gridcell]")
      [next]?.focus();
  };

  const rows = Array.from(
    { length: Math.ceil(choices.length / COLUMNS) },
    (_, i) => choices.slice(i * COLUMNS, i * COLUMNS + COLUMNS),
  );
  return (
    <div
      ref={grid}
      role="grid"
      aria-label="Reactions"
      onKeyDown={move}
      className="flex flex-col gap-0.5"
    >
      {rows.map((row, ri) => (
        <div key={ri} role="row" className="flex gap-0.5">
          {row.map((c, ci) => {
            const i = ri * COLUMNS + ci;
            const on = mine.has(c.emoji);
            return (
              <button
                key={c.emoji}
                type="button"
                role="gridcell"
                aria-label={c.label}
                aria-selected={on}
                tabIndex={i === active ? 0 : -1}
                onFocus={() => setActive(i)}
                onClick={() => onPick(c.emoji)}
                className={cn(
                  "group/cell grid size-8 place-items-center rounded-lg outline-none",
                  "transition-[background-color,scale] duration-150 ease-out hover:bg-hover active:scale-[0.9] active:duration-75",
                  "focus-visible:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-4",
                  on &&
                    "bg-fg/[0.08] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--fg)_22%,transparent)]",
                )}
              >
                <span
                  aria-hidden
                  className="text-[18px] leading-none transition-transform duration-200 ease-out-expo group-hover/cell:scale-[1.18] group-focus-visible/cell:scale-[1.18] motion-reduce:transition-none motion-reduce:group-hover/cell:scale-100"
                >
                  {c.emoji}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function AddGlyph({ size }: { size: number }) {
  // A face with a plus where its shoulder would be: "add a reaction", on the 16px grid.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13.2 8.6A5.75 5.75 0 1 1 7.4 2.3" />
      <path d="M5.6 9.5c.55.8 1.4 1.25 2.4 1.25s1.85-.45 2.4-1.25" />
      <circle cx="5.9" cy="6.6" r=".6" fill="currentColor" stroke="none" />
      <circle cx="10.1" cy="6.6" r=".6" fill="currentColor" stroke="none" />
      <path
        d="M12.25 1.75v3.5M10.5 3.5H14"
        className="transition-transform duration-200 ease-out-expo [transform-box:fill-box] [transform-origin:center] group-hover/add:rotate-90 motion-reduce:transition-none"
      />
    </svg>
  );
}
