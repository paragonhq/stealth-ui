"use client";
import NumberFlow from "@number-flow/react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/**
 * Calls back once an element has been fully on screen, in a visible tab, for `delay` ms
 * without a break. Scrolling it away or switching tabs restarts the wait.
 */
export function useSeen(ref: React.RefObject<Element | null>, { delay = 3000, enabled = true, onSeen }: { delay?: number; enabled?: boolean; onSeen: () => void }) {
  const cb = useRef(onSeen);
  useEffect(() => {
    cb.current = onSeen;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let visible = false;
    let timer: number | undefined;
    const sync = () => {
      window.clearTimeout(timer);
      timer = undefined;
      if (visible && document.visibilityState === "visible") timer = window.setTimeout(() => cb.current(), delay);
    };
    // The browser clips the target by every scrolling ancestor, so this works inside a chat pane too.
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = !!entry && entry.intersectionRatio >= 0.98;
        sync();
      },
      { threshold: [0, 0.98, 1] },
    );
    io.observe(el);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      window.clearTimeout(timer);
    };
  }, [ref, delay, enabled]);
}

function scrollParent(el: HTMLElement) {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if (/(auto|scroll|overlay)/.test(overflowY) && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

export type UnreadDividerProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** How many messages are new. Rolls when more arrive. Leave out for a plain "New messages". */
  count?: number;
  /** Replace the words. A function receives the count, for other languages. */
  label?: string | ((count: number | undefined) => string);
  /** Controlled seen state. Once true the divider plays its exit. */
  seen?: boolean;
  defaultSeen?: boolean;
  /** Called once, when it has been fully visible for `seenDelay` ms (or `seen` is set). */
  onSeenChange?: (seen: boolean) => void;
  /** Milliseconds fully on screen before it counts as read. */
  seenDelay?: number;
  /** What happens once seen: collapse away, dim to a quiet line that keeps its place, or stay. */
  afterSeen?: "collapse" | "dim" | "keep";
  /** On mount, scroll the nearest scrolling ancestor so the divider sits a quarter of the way down. */
  scrollOnMount?: boolean;
};

const defaultLabel = (count?: number) => (count === undefined ? "New messages" : count === 1 ? "new message" : "new messages");

/**
 * The "new messages" line above the first unread message. Its lines draw outward from the label
 * when it arrives; once it has been on screen for a few seconds they retract into it, and the row
 * folds away without yanking what you're reading.
 */
export function UnreadDivider({
  count,
  label = defaultLabel,
  seen: seenProp,
  defaultSeen = false,
  onSeenChange,
  seenDelay = 3000,
  afterSeen = "collapse",
  scrollOnMount = false,
  className,
  ref,
  ...rest
}: UnreadDividerProps) {
  const reduce = !!useReducedMotion();
  const root = useRef<HTMLDivElement | null>(null);
  const [seen, setSeen] = useControllableState({ value: seenProp, defaultValue: defaultSeen, onChange: onSeenChange });

  useSeen(root, { delay: seenDelay, enabled: !seen, onSeen: () => setSeen(true) });

  useEffect(() => {
    const el = root.current;
    if (!scrollOnMount || !el) return;
    // Scroll only the chat pane, never the page around it.
    const pane = scrollParent(el);
    if (!pane) return;
    const top = el.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;
    pane.scrollTop = Math.max(0, top - pane.clientHeight * 0.25);
    // Only on mount: later count changes must not move the reader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const custom = typeof label === "function" && label !== defaultLabel;
  const text = typeof label === "string" ? label : label(count);
  const spoken = custom || typeof label === "string" || count === undefined ? text : `${count} ${text}`;

  const gone = seen && afterSeen === "collapse";
  const dim = seen && afterSeen === "dim";
  const state = gone ? "gone" : dim ? "dim" : "new";

  // Lines grow out of the label on arrival and retract into it on the way out. The starting
  // style is the same on the server and client; reduced motion just zeroes the travel.
  const still = { duration: 0 };
  const line = (side: "left" | "right") => (
    <motion.span
      aria-hidden
      className={cn("h-px flex-1 transition-colors duration-500", dim ? "bg-fg/10" : "bg-fg/25", side === "left" ? "origin-right" : "origin-left")}
      initial={{ scaleX: 0, opacity: 0 }}
      animate={gone ? { scaleX: reduce ? 1 : 0, opacity: 0 } : { scaleX: 1, opacity: 1 }}
      transition={
        gone
          ? { duration: reduce ? 0.2 : 0.3, ease: ease.in, scaleX: reduce ? still : undefined }
          : { duration: reduce ? 0.2 : 0.55, ease: ease.out, delay: reduce ? 0 : 0.06, scaleX: reduce ? still : undefined }
      }
    />
  );

  return (
    <div
      ref={(node) => {
        root.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      role="separator"
      aria-label={spoken}
      aria-hidden={gone || undefined}
      data-state={state}
      className={cn(
        // grid-template-rows folds the row to nothing once the label has gone, after a short hold.
        "grid transition-[grid-template-rows] duration-300 ease-in-out-quart",
        gone ? "grid-rows-[0fr] delay-300" : "grid-rows-[1fr]",
        className,
      )}
      {...rest}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="flex items-center gap-3 py-2">
          {line("left")}
          <motion.span
            aria-hidden
            className={cn(
              "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-2 text-[11px] font-medium leading-none tabular transition-[color,border-color,background-color] duration-500",
              dim ? "border-line bg-transparent text-fg-3" : "border-line-2 bg-raised text-fg shadow-[var(--shadow)]",
            )}
            initial={{ opacity: 0, scale: 0.94, y: 3, filter: "blur(2px)" }}
            animate={gone && !reduce ? { opacity: 0, scale: 0.94, filter: "blur(2px)" } : { opacity: gone ? 0 : 1, scale: 1, y: 0, filter: "blur(0px)" }}
            transition={{
              duration: gone ? 0.2 : reduce ? 0.2 : 0.32,
              ease: gone ? ease.in : ease.out,
              delay: gone && !reduce ? 0.14 : 0,
              ...(reduce ? { scale: still, y: still, filter: still } : {}),
            }}
          >
            {!custom && typeof label !== "string" && count !== undefined && <NumberFlow value={count} animated={!reduce} className="leading-none" />}
            <span>{text}</span>
          </motion.span>
          {line("right")}
        </div>
      </div>
    </div>
  );
}
