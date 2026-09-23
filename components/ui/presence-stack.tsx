"use client";
import { Avatar } from "@base-ui/react/avatar";
import { Popover } from "@base-ui/react/popover";
import { Tooltip } from "@base-ui/react/tooltip";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

export type PresencePerson = {
  /** Stable id from your presence channel. Keys the arrival and exit animations. */
  id: string;
  name: string;
  src?: string;
  /** A short second line: "Editing Pricing", "Viewing", "Idle 4m". */
  meta?: string;
  /** Connected but not active. Their face dims; they stay in the stack. */
  idle?: boolean;
  /** The viewer themselves. Labeled "(you)" and never announced. */
  self?: boolean;
};

type Size = "sm" | "md" | "lg";
const sizes: Record<Size, number> = { sm: 24, md: 28, lg: 32 };

/* -------------------------------------------------------------------------------------------------
 * Faces
 * -----------------------------------------------------------------------------------------------*/

function initials(name: string) {
  const words = name.replace(/\(.*?\)/g, " ").split("@")[0].trim().split(/[\s._-]+/).filter(Boolean);
  const first = (w: string) => Array.from(w)[0] ?? "";
  if (!words.length) return "";
  if (words.length === 1) return first(words[0]).toUpperCase();
  return (first(words[0]) + first(words[words.length - 1])).toUpperCase();
}

// Steps of the foreground, not hues: people are told apart by initials and names, and color
// stays reserved for meaning. The same id always lands on the same step.
const tones = ["bg-fg/[0.07] text-fg-2", "bg-fg/[0.1] text-fg-2", "bg-fg/[0.13] text-fg", "bg-fg/[0.17] text-fg", "bg-fg/[0.22] text-fg"];
function tone(key: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  return tones[(h >>> 0) % tones.length];
}

// `shift` moves initials right when a neighbor covers the left edge, so they center in what shows.
function Face({ person, size, mask, shift = 0, active }: { person: PresencePerson; size: number; mask?: string; shift?: number; active?: boolean }) {
  return (
    <Avatar.Root
      data-idle={person.idle || undefined}
      className="relative block shrink-0 overflow-hidden rounded-full transition-[opacity,filter] duration-300 ease-out-quart data-idle:opacity-45 data-idle:grayscale"
      style={{ width: size, height: size, maskImage: mask, WebkitMaskImage: mask }}
    >
      <Avatar.Fallback
        className={cn("absolute inset-0 grid place-items-center font-medium leading-none tracking-[0.01em]", tone(person.id))}
        style={{ fontSize: Math.round(size * 0.38 * 2) / 2, paddingLeft: shift }}
      >
        {initials(person.name)}
      </Avatar.Fallback>
      {person.src && (
        <Avatar.Image
          src={person.src}
          alt=""
          className="absolute inset-0 size-full object-cover transition-opacity duration-200 ease-out-quart data-starting-style:opacity-0"
        />
      )}
      {/* The follow ring draws inward from the edge: a foreground line, then a gap, then the face. */}
      <span
        aria-hidden
        data-active={active || undefined}
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full transition-[box-shadow] duration-240 ease-out-expo",
          "shadow-[inset_0_0_0_0_var(--fg),inset_0_0_0_0_var(--frame)]",
          "data-active:shadow-[inset_0_0_0_1.5px_var(--fg),inset_0_0_0_3px_var(--frame)]",
        )}
      />
    </Avatar.Root>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Words
 * -----------------------------------------------------------------------------------------------*/

const displayName = (p: PresencePerson) => (p.self ? `${p.name} (you)` : p.name);
const list = new Intl.ListFormat("en", { type: "conjunction" });

function summarize(label: string, people: PresencePerson[]) {
  const names = people.map(displayName);
  if (names.length <= 3) return `${label}: ${list.format(names)}`;
  return `${label}: ${names.slice(0, 2).join(", ")} and ${names.length - 2} others`;
}

function shortNames(people: PresencePerson[]) {
  const first = people.slice(0, 2).map((p) => (p.self ? "You" : p.name.split(/\s+/)[0]));
  const rest = people.length - first.length;
  return rest > 0 ? `${first.join(", ")} and ${rest} more` : list.format(first);
}

// "Maya Okafor joined", "Jon Park and Lena Fischer left", "3 people joined".
function change(people: PresencePerson[], verb: "joined" | "left") {
  const others = people.filter((p) => !p.self);
  if (!others.length) return "";
  if (others.length > 2) return `${others.length} people ${verb}`;
  return `${list.format(others.map((p) => p.name))} ${verb}`;
}

/* -------------------------------------------------------------------------------------------------
 * PresenceStack
 * -----------------------------------------------------------------------------------------------*/

type Tip = { title: string; meta?: string; hint?: string };

export type PresenceStackProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Everyone connected right now, in the order to draw them. */
  people: PresencePerson[];
  /** Most circles drawn, the +N chip included. One extra person is drawn rather than a "+1". */
  max?: number;
  size?: Size;
  /** What the stack is. Names the group and titles the full list. */
  label?: string;
  /** Makes each face a button: follow them, jump to their cursor. */
  onPersonClick?: (person: PresencePerson) => void;
  /** The person being followed. Their face gets a ring that draws in. */
  activeId?: string | null;
  /** Tooltip hint on faces when they are buttons. */
  actionHint?: string;
  /** Announce arrivals and departures to screen readers. */
  announce?: boolean;
  /** Placeholder faces while the presence channel connects. */
  loading?: boolean;
  /** Rendered when nobody is here. Nothing by default. */
  empty?: React.ReactNode;
  /** Where the tooltip and list portal. Defaults to document.body. */
  container?: HTMLElement | React.RefObject<HTMLElement | null> | null;
};

/**
 * Who is here right now. Arrivals slide in and ping once, leavers fade while the rest close
 * ranks, the overflow count rolls, and one tooltip glides from face to face.
 */
export function PresenceStack({
  people,
  max = 4,
  size = "md",
  label = "Viewing now",
  onPersonClick,
  activeId = null,
  actionHint = "Click to follow",
  announce = true,
  loading = false,
  empty = null,
  container,
  className,
  onKeyDown,
  ...rest
}: PresenceStackProps) {
  const reduce = useReducedMotion();
  const [tip] = useState(() => Tooltip.createHandle<Tip>());
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);

  // Diff the list as it changes, during render, so the announcement lands with the new faces.
  // Only the latest arrivals ping: a face that slides out of the overflow later is not news.
  const [prev, setPrev] = useState(people);
  const [message, setMessage] = useState("");
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  if (prev !== people) {
    const before = new Set(prev.map((p) => p.id));
    const after = new Set(people.map((p) => p.id));
    const arrivals = people.filter((p) => !before.has(p.id));
    const joined = change(arrivals, "joined");
    const left = change(prev.filter((p) => !after.has(p.id)), "left");
    setPrev(people);
    if (arrivals.length || left) setFresh(new Set(arrivals.map((p) => p.id)));
    if (joined || left) setMessage([joined, left].filter(Boolean).join(". "));
  }

  const s = sizes[size];
  const overlap = Math.round(s * 0.28);
  const gap = s >= 28 ? 2 : 1.5;
  const cap = Math.max(2, max);
  const fits = people.length <= cap;
  const shown = fits ? people : people.slice(0, cap - 1);
  const hidden = fits ? [] : people.slice(cap - 1);
  const interactive = !!onPersonClick;
  const count = shown.length + (hidden.length ? 1 : 0);
  const current = Math.min(focusIndex, Math.max(0, count - 1));

  // Each circle after the first has the one before it punched out, plus a hairline of air, so the
  // stack reads on any surface: a card, a hover wash, a photo. The opaque stop only lends alpha.
  const cut = `radial-gradient(circle at ${overlap - s / 2}px 50%, transparent ${s / 2 + gap}px, var(--fg) ${s / 2 + gap + 0.5}px)`;
  const slot = (i: number): React.CSSProperties => ({ zIndex: 20 - i, marginLeft: i === 0 ? 0 : -overlap });

  const enter = reduce ? { opacity: 0 } : { opacity: 0, x: 8, scale: 0.7 };
  const leave = reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, scale: 0.7, filter: "blur(2px)", transition: { duration: 0.16, ease: ease.out } };
  const transition = reduce ? { duration: 0.15 } : { ...spring.pop, opacity: { duration: 0.18, ease: ease.out }, layout: spring.snappy };

  // Roving focus: one tab stop for the whole stack, arrows move between faces.
  const move = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (!interactive || e.defaultPrevented) return;
    const last = count - 1;
    const next = e.key === "ArrowRight" ? Math.min(last, current + 1) : e.key === "ArrowLeft" ? Math.max(0, current - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
    if (next < 0) return;
    e.preventDefault();
    setFocusIndex(next);
    e.currentTarget.querySelectorAll<HTMLElement>("[data-presence-item]")[next]?.focus();
  };

  if (loading)
    return (
      <div role="img" aria-busy aria-label={`Loading ${label.toLowerCase()}`} className={cn("inline-flex", className)} {...rest}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block animate-pulse-soft rounded-full bg-hover motion-reduce:animate-none"
            style={{ ...slot(i), width: s, height: s, maskImage: i ? cut : undefined, WebkitMaskImage: i ? cut : undefined }}
          />
        ))}
      </div>
    );

  const live = announce && (
    <span role="status" aria-live="polite" className="sr-only">
      {message}
    </span>
  );

  if (people.length === 0)
    return (
      <>
        {empty}
        {live}
      </>
    );

  return (
    <div
      role={interactive ? "toolbar" : "group"}
      aria-label={summarize(label, people)}
      onKeyDown={move}
      className={cn("relative isolate inline-flex items-center", className)}
      {...rest}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {shown.map((p, i) => {
          const arrived = fresh.has(p.id);
          const active = p.id === activeId;
          const face = <Face person={p} size={s} mask={i === 0 ? undefined : cut} shift={i === 0 ? 0 : Math.round(overlap / 2)} active={active} />;
          const tipPayload: Tip = { title: displayName(p), meta: p.idle && !p.meta ? "Idle" : p.meta, hint: interactive && !p.self ? (active ? "Following" : actionHint) : undefined };
          return (
            <motion.span
              key={p.id}
              layout={!reduce}
              initial={enter}
              animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
              exit={leave}
              transition={transition}
              className="relative flex rounded-full"
              style={slot(i)}
            >
              {/* A single ring that ripples out once, so a new face is noticed without a toast. */}
              {arrived && !reduce && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full border border-fg"
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 1.6, opacity: 0 }}
                  transition={{ duration: 0.9, ease: ease.out, delay: 0.12 }}
                />
              )}
              <Tooltip.Trigger
                handle={tip}
                payload={tipPayload}
                delay={350}
                render={
                  interactive ? (
                    <button
                      type="button"
                      data-presence-item=""
                      aria-label={`${displayName(p)}${p.meta ? `, ${p.meta}` : ""}`}
                      aria-pressed={active}
                      tabIndex={i === current ? 0 : -1}
                      onFocus={() => setFocusIndex(i)}
                      onClick={() => onPersonClick?.(p)}
                      className={cn(
                        "relative flex rounded-full outline-none",
                        "transition-[translate,scale] duration-150 ease-out-quart hover:-translate-y-0.5 active:scale-[0.92] active:duration-75",
                        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                        "motion-reduce:hover:translate-y-0",
                      )}
                    />
                  ) : (
                    <span className="flex rounded-full" />
                  )
                }
              >
                {face}
              </Tooltip.Trigger>
            </motion.span>
          );
        })}

        {hidden.length > 0 && (
          <motion.span
            key="overflow"
            layout={!reduce}
            initial={enter}
            animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
            exit={leave}
            transition={transition}
            className="relative flex rounded-full"
            style={slot(shown.length)}
          >
            <Popover.Root open={open} onOpenChange={setOpen}>
              <Popover.Trigger
                data-presence-item=""
                aria-label={`${hidden.length} more: ${hidden.map(displayName).join(", ")}. Show everyone`}
                tabIndex={interactive && shown.length !== current ? -1 : 0}
                onFocus={() => setFocusIndex(shown.length)}
                className={cn(
                  "group/more relative flex rounded-full outline-none",
                  "transition-[scale] duration-150 ease-out-quart active:scale-[0.92] active:duration-75",
                  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                  // Draws at 24–32px; on touch the target grows to 44px without moving anything.
                  "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
                )}
              >
                <Tooltip.Trigger
                  handle={tip}
                  payload={{ title: shortNames(hidden) }}
                  delay={350}
                  render={
                    <span
                      className={cn(
                        "grid place-items-center rounded-full bg-fg/[0.08] font-medium leading-none text-fg-2 tabular",
                        "transition-colors duration-150 group-hover/more:bg-fg/[0.13] group-hover/more:text-fg group-data-popup-open/more:bg-fg/[0.13] group-data-popup-open/more:text-fg",
                      )}
                      style={{ width: s, height: s, fontSize: s >= 28 ? 11 : 10.5, paddingLeft: shown.length ? Math.round(overlap / 2) : 0, maskImage: shown.length ? cut : undefined, WebkitMaskImage: shown.length ? cut : undefined }}
                    />
                  }
                >
                  <NumberFlow value={hidden.length} prefix="+" className="leading-none" />
                </Tooltip.Trigger>
              </Popover.Trigger>
              <Popover.Portal container={container}>
                <Popover.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={8} className="z-(--z-popover)">
                  <Popover.Popup
                    className={cn(
                      "flex w-64 max-w-(--available-width) flex-col rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
                      "origin-(--transform-origin) transition-[opacity,scale,translate,filter] duration-200 ease-out-expo",
                      "data-starting-style:-translate-y-1 data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-starting-style:blur-[2px]",
                      "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:ease-out-quart",
                      "data-instant:transition-none motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:blur-none",
                    )}
                  >
                    <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-line px-3">
                      <Popover.Title className="truncate text-[12.5px] font-medium text-fg">{label}</Popover.Title>
                      <NumberFlow value={people.length} className="font-mono text-2xs text-fg-3" />
                    </div>
                    <ul
                      aria-label={label}
                      className="max-h-[232px] overflow-y-auto overscroll-contain p-1 [mask-image:linear-gradient(to_bottom,transparent,var(--fg)_6px,var(--fg)_calc(100%-6px),transparent)]"
                    >
                      {people.map((p) => {
                        const active = p.id === activeId;
                        const row = (
                          <>
                            <Face person={p} size={24} active={active} />
                            <span className="min-w-0 flex-1 truncate text-left text-[13px] text-fg">{displayName(p)}</span>
                            <span className={cn("max-w-[45%] shrink-0 truncate text-[12px]", active ? "text-fg" : "text-fg-3")}>
                              {active ? "Following" : p.idle && !p.meta ? "Idle" : p.meta}
                            </span>
                          </>
                        );
                        return (
                          <li key={p.id}>
                            {interactive && !p.self ? (
                              <button
                                type="button"
                                aria-pressed={active}
                                onClick={() => {
                                  onPersonClick?.(p);
                                  setOpen(false);
                                }}
                                className={cn(
                                  "flex h-10 w-full items-center gap-2.5 rounded-lg px-2 outline-none",
                                  "transition-colors duration-150 hover:bg-hover focus-visible:bg-hover",
                                  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-4",
                                )}
                              >
                                {row}
                              </button>
                            ) : (
                              <div className="flex h-10 items-center gap-2.5 px-2">{row}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </motion.span>
        )}
      </AnimatePresence>

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
                  "data-instant:transition-none motion-reduce:data-starting-style:scale-100",
                )}
              >
                <Tooltip.Viewport
                  className={cn(
                    "relative h-full w-full",
                    "[&>*]:flex [&>*]:w-max [&>*]:max-w-[16rem] [&>*]:flex-col [&>*]:px-2 [&>*]:py-[5px]",
                    "[&>[data-previous]]:absolute [&>[data-previous]]:left-0 [&>[data-previous]]:top-0",
                    "[&>*]:transition-[opacity,filter] [&>*]:duration-150",
                    "[&>[data-current][data-starting-style]]:opacity-0 [&>[data-current][data-starting-style]]:blur-[2px]",
                    "[&>[data-previous][data-ending-style]]:opacity-0 [&>[data-previous]]:duration-100",
                  )}
                >
                  {payload && (
                    <>
                      <span className="flex items-baseline gap-1.5">
                        <span className="truncate">{payload.title}</span>
                        {payload.meta && <span className="shrink-0 text-fg-3">{payload.meta}</span>}
                      </span>
                      {payload.hint && <span className="text-2xs text-fg-3">{payload.hint}</span>}
                    </>
                  )}
                </Tooltip.Viewport>
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        )}
      </Tooltip.Root>
      {live}
    </div>
  );
}
