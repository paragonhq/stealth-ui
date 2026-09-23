"use client";
import { Popover } from "@base-ui/react/popover";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ArrowUpRight } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

// Dismissals live in localStorage, with an in-memory fallback for when storage
// is blocked (private windows, strict embeds). Every hotspot on the page, and
// every tab, hears about a change.
const PREFIX = "hotspot:";
const memory = new Map<string, string>();
const EVENT = "hotspot-change";

function read(key: string) {
  try {
    return window.localStorage.getItem(PREFIX + key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}
function write(key: string, value: string | null) {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (value === null) window.localStorage.removeItem(PREFIX + key);
    else window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // Storage refused: the in-memory copy still holds for this page.
  }
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(notify: () => void) {
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(EVENT, notify);
    window.removeEventListener("storage", notify);
  };
}

/** Forget a dismissal, so the hotspot shows again. */
export function resetHotspot(storageKey: string) {
  write(storageKey, null);
}

/**
 * The dismissal state on its own. `ready` is false on the server and during
 * hydration, so nothing renders until the browser has been asked.
 */
export function useHotspot(storageKey: string) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(storageKey) ?? "",
    () => null,
  );
  const dismiss = useCallback(() => write(storageKey, new Date().toISOString()), [storageKey]);
  const reset = useCallback(() => write(storageKey, null), [storageKey]);
  return { ready: value !== null, dismissed: !!value, dismiss, reset };
}

type Corner = "top-right" | "top-left" | "bottom-right" | "bottom-left";

export type HotspotProps = Omit<React.ComponentProps<"span">, "title"> & {
  /** Where the dismissal is remembered. Change it to show the hotspot again for a new release. */
  storageKey: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Link to the docs or changelog entry, opened in a new tab. */
  learnMoreHref?: string;
  learnMoreLabel?: string;
  dismissLabel?: string;
  /** Short label above the title. */
  eyebrow?: string;
  /** Wrap a control to pin the beacon to one of its corners. Without children the beacon sits inline. */
  children?: React.ReactNode;
  corner?: Corner;
  /** How far inside the corner the beacon's center sits, in px. */
  inset?: number;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  /** Portal target for the popover, e.g. a scroll container. Defaults to document.body. */
  container?: HTMLElement | null;
  onDismiss?: () => void;
};

// The beacon's center sits on the corner, pulled in by --hotspot-inset so it overlaps rounded controls.
const corners: Record<Corner, string> = {
  "top-right": "right-(--hotspot-inset) top-(--hotspot-inset) translate-x-1/2 -translate-y-1/2",
  "top-left": "left-(--hotspot-inset) top-(--hotspot-inset) -translate-x-1/2 -translate-y-1/2",
  "bottom-right": "right-(--hotspot-inset) bottom-(--hotspot-inset) translate-x-1/2 translate-y-1/2",
  "bottom-left": "left-(--hotspot-inset) bottom-(--hotspot-inset) -translate-x-1/2 translate-y-1/2",
};

/**
 * A pulsing beacon on something new. It pulses until it's been looked at,
 * explains itself in a small popover, and once dismissed stays gone.
 */
export function Hotspot({
  storageKey,
  title,
  description,
  learnMoreHref,
  learnMoreLabel = "Learn more",
  dismissLabel = "Got it",
  eyebrow = "New",
  children,
  corner = "top-right",
  inset = 4,
  side = "bottom",
  align = "center",
  container,
  onDismiss,
  className,
  ...rest
}: HotspotProps) {
  const { ready, dismissed, dismiss } = useHotspot(storageKey);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const [visible, setVisible] = useState(true);
  const leaving = useRef(false);
  const wrapper = useRef<HTMLSpanElement>(null);
  const beacon = useRef<HTMLButtonElement>(null);
  const gotIt = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();

  // The pulse is a loop: stop it when the beacon scrolls away.
  useEffect(() => {
    const el = beacon.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [ready, dismissed]);

  const show = ready && !dismissed;
  const plain = typeof title === "string" ? title : "New feature";

  const trigger = (
    <AnimatePresence>
      {show && (
        <Popover.Root
          key="beacon"
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) setSeen(true);
          }}
        >
          <Popover.Trigger
            ref={beacon}
            aria-label={`${eyebrow}: ${plain}`}
            data-seen={seen ? "" : undefined}
            render={
              <motion.button
                type="button"
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4, transition: { duration: 0.16, ease: ease.in } }}
                transition={reduce ? { duration: 0.15 } : spring.pop}
              />
            }
            className={cn(
              "group/beacon grid size-5 place-items-center rounded-full outline-none",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
              // 20px on a mouse, 44px under a finger.
              "before:absolute before:-inset-3 before:rounded-full before:content-[''] pointer-fine:before:hidden",
              children ? cn("absolute z-[1]", corners[corner]) : "relative inline-grid align-middle",
            )}
          >
            {/* The ring pulses until the hotspot has been opened once, and pauses off screen. */}
            <span
              aria-hidden
              className={cn(
                "absolute size-2 rounded-full bg-fg/50",
                "animate-ping-soft motion-reduce:hidden group-data-seen/beacon:hidden group-data-popup-open/beacon:hidden",
                !visible && "[animation-play-state:paused]",
              )}
            />
            <span
              aria-hidden
              className={cn(
                "relative size-2 rounded-full bg-fg ring-2 ring-raised",
                "transition-[scale] duration-150 ease-out-expo group-hover/beacon:scale-125 group-active/beacon:scale-90 group-data-popup-open/beacon:scale-125",
              )}
            />
          </Popover.Trigger>
          <Popover.Portal container={container ?? undefined}>
            <Popover.Positioner side={side} align={align} sideOffset={10} collisionPadding={12} arrowPadding={14} className="z-(--z-popover)">
              <Popover.Popup
                initialFocus={gotIt}
                finalFocus={() => {
                  if (!leaving.current) return true;
                  leaving.current = false;
                  // The beacon is gone; land on the thing it pointed at instead of the page.
                  return wrapper.current?.querySelector<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") ?? false;
                }}
                className={cn(
                  "relative w-64 max-w-[var(--available-width)] rounded-xl border border-line-2 bg-raised p-3.5 text-fg shadow-pop outline-none",
                  "origin-[var(--transform-origin)] transition-[opacity,scale,translate,filter] duration-200 ease-out-expo",
                  "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-starting-style:blur-[2px]",
                  "data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1",
                  "data-[side=left]:data-starting-style:translate-x-1 data-[side=right]:data-starting-style:-translate-x-1",
                  "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:ease-out-quart",
                  "data-instant:transition-none",
                  "motion-reduce:data-starting-style:translate-0 motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:blur-none motion-reduce:data-ending-style:scale-100",
                )}
              >
                <HotspotArrow />
                {eyebrow && <p className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-3">{eyebrow}</p>}
                <Popover.Title className="text-[13.5px] font-medium leading-[1.3] tracking-[-0.01em] text-fg text-balance">{title}</Popover.Title>
                {description && <Popover.Description className="mt-1 text-[12.5px] leading-[1.5] text-fg-2 text-pretty">{description}</Popover.Description>}
                <div className="mt-3 flex items-center justify-between gap-2">
                  {learnMoreHref ? (
                    <a
                      href={learnMoreHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "group/link -ml-1 inline-flex h-7 items-center gap-1 rounded-md px-1 text-[12px] text-fg-2 outline-none",
                        "transition-colors duration-150 hover:text-fg",
                        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                      )}
                    >
                      {learnMoreLabel}
                      <ArrowUpRight className="size-3.5 transition-transform duration-150 ease-out-expo group-hover/link:-translate-y-px group-hover/link:translate-x-px" />
                    </a>
                  ) : (
                    <span />
                  )}
                  <button
                    ref={gotIt}
                    type="button"
                    onClick={() => {
                      leaving.current = true;
                      setOpen(false);
                      dismiss();
                      onDismiss?.();
                    }}
                    className={cn(
                      "inline-flex h-7 items-center rounded-md bg-fg px-2.5 text-[12px] font-medium text-frame shadow-[var(--shadow)] outline-none",
                      "transition-[background-color,scale] duration-150 hover:bg-fg/90 active:scale-[0.97] active:duration-75",
                      "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                    )}
                  >
                    {dismissLabel}
                  </button>
                </div>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      )}
    </AnimatePresence>
  );

  if (!children) return trigger;
  return (
    <span
      ref={wrapper}
      data-hotspot={show ? "active" : "idle"}
      className={cn("relative inline-flex", className)}
      {...rest}
      style={{ "--hotspot-inset": `${inset}px`, ...rest.style } as React.CSSProperties}
    >
      {children}
      {trigger}
    </span>
  );
}

function HotspotArrow() {
  return (
    <Popover.Arrow
      className={cn(
        "pointer-events-none flex h-2.5 w-5",
        "data-[side=bottom]:-top-[9px]",
        "data-[side=top]:-bottom-[9px] data-[side=top]:rotate-180",
        "data-[side=left]:-right-3.5 data-[side=left]:rotate-90",
        "data-[side=right]:-left-3.5 data-[side=right]:-rotate-90",
      )}
    >
      <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden className="block overflow-visible">
        <path d="M0 10c3.6 0 5.7-1.4 7.4-5.2L8.2 3c.8-1.6 2.8-1.6 3.6 0l.8 1.8c1.7 3.8 3.8 5.2 7.4 5.2z" className="fill-raised" />
        <path d="M0 10c3.6 0 5.7-1.4 7.4-5.2L8.2 3c.8-1.6 2.8-1.6 3.6 0l.8 1.8c1.7 3.8 3.8 5.2 7.4 5.2" className="stroke-line-2" vectorEffect="non-scaling-stroke" />
      </svg>
    </Popover.Arrow>
  );
}
