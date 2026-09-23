"use client";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, type MotionValue } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ArrowRight, Pause, Play, X } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type Announcement = {
  id: string;
  content: React.ReactNode;
  /** Makes the whole message a link. */
  href?: string;
  /** Short call to action after the message, like "Read the changelog". Hidden on narrow bars. */
  cta?: string;
};

export type AnnouncementBarProps = Omit<React.ComponentProps<"section">, "children"> & {
  messages: Announcement[];
  /** Milliseconds each message stays before the next. */
  interval?: number;
  /** Rotate on its own. The person can still pause it. */
  autoPlay?: boolean;
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  variant?: "subtle" | "inverted";
  dismissible?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Remember the dismissal on this device. Change the key when the messages change. */
  storageKey?: string;
  /** Accessible name of the region. */
  label?: string;
};

// Remembered dismissal, read after hydration so server and client agree.
const PREFIX = "stealth-announcement:";
const EVENT = "stealth-announcement-change";
const readDismissed = (key: string) => {
  try {
    return window.localStorage.getItem(PREFIX + key) === "1";
  } catch {
    return false;
  }
};
const subscribe = (fn: () => void) => {
  window.addEventListener("storage", fn);
  window.addEventListener(EVENT, fn);
  return () => {
    window.removeEventListener("storage", fn);
    window.removeEventListener(EVENT, fn);
  };
};

/** Clear a remembered dismissal, so the bar shows again. */
export function resetAnnouncementBar(storageKey: string) {
  try {
    window.localStorage.removeItem(PREFIX + storageKey);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function AnnouncementBar({
  messages,
  interval = 5000,
  autoPlay = true,
  index: indexProp,
  defaultIndex = 0,
  onIndexChange,
  variant = "subtle",
  dismissible = false,
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  storageKey,
  label = "Announcements",
  className,
  ...rest
}: AnnouncementBarProps) {
  const reduce = useReducedMotion();
  const count = messages.length;
  const [rawIndex, setIndex] = useControllableState({ value: indexProp, defaultValue: defaultIndex, onChange: onIndexChange });
  const index = count ? ((rawIndex % count) + count) % count : 0;
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const remembered = useSyncExternalStore(subscribe, () => (storageKey ? readDismissed(storageKey) : false), () => false);

  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [inView, setInView] = useState(true);
  const [dir, setDir] = useState(1);
  const ref = useRef<HTMLElement>(null);
  const progress = useMotionValue(0);

  const rotating = autoPlay && count > 1;
  // Waits while it is being read, pointed at, or can't be seen.
  const running = rotating && !paused && !hovered && !focused && inView;

  const go = useCallback(
    (next: number, direction: number) => {
      setDir(direction);
      progress.set(0);
      setIndex(((next % count) + count) % count);
    },
    [count, progress, setIndex],
  );

  // The clock: accumulates only while running, so pausing keeps the place in the current message.
  const advance = useRef(() => {});
  useEffect(() => {
    advance.current = () => go(index + 1, 1);
  });
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(now - last, 50);
      last = now;
      if (document.visibilityState === "visible") {
        const next = progress.get() + delta / interval;
        if (next >= 1) advance.current();
        else progress.set(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, interval, progress]);

  // Off screen, nothing runs.
  useEffect(() => {
    const node = ref.current;
    if (!node || !rotating) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    io.observe(node);
    return () => io.disconnect();
  }, [rotating]);

  const dismiss = () => {
    if (storageKey) {
      try {
        window.localStorage.setItem(PREFIX + storageKey, "1");
      } catch {}
      window.dispatchEvent(new Event(EVENT));
    }
    setOpen(false);
  };

  const inverted = variant === "inverted";
  const message = messages[index];
  const shown = open && !remembered && count > 0;

  return (
    <AnimatePresence initial={false}>
      {shown && (
        <motion.div
          key="bar"
          className="shrink-0 overflow-hidden"
          initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={reduce ? { duration: 0.15 } : { height: { duration: 0.26, ease: ease.inOut }, opacity: { duration: 0.14 } }}
        >
          <section
            ref={ref}
            aria-label={label}
            aria-roledescription={rotating ? "carousel" : undefined}
            data-variant={variant}
            data-state={running ? "playing" : "paused"}
            onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            onFocus={() => setFocused(true)}
            onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFocused(false)}
            className={cn(
              "@container relative grid h-9 grid-cols-[minmax(0,1fr)_minmax(0,max-content)_1fr] items-center gap-2 px-2 text-[12.5px]",
              inverted ? "bg-fg text-frame" : "border-b border-line bg-raised text-fg",
              className,
            )}
            {...rest}
          >
            <span aria-hidden />

            {/* One message at a time, in a fixed-height window. Announced only when the person is in control. */}
            <div className="relative h-9 min-w-0 overflow-hidden" aria-live={running ? "off" : "polite"} aria-atomic="true">
              <AnimatePresence initial={false} mode="popLayout" custom={dir}>
                <motion.div
                  key={message.id}
                  custom={dir}
                  className="flex h-9 min-w-0 items-center justify-center"
                  variants={{
                    enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, y: d * 14, filter: "blur(2px)" }),
                    center: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.34, ease: ease.out } },
                    exit: (d: number) => (reduce ? { opacity: 0, transition: { duration: 0.15 } } : { opacity: 0, y: d * -14, filter: "blur(2px)", transition: { duration: 0.22, ease: ease.out } }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  role={rotating ? "group" : undefined}
                  aria-roledescription={rotating ? "slide" : undefined}
                  aria-label={rotating ? `${index + 1} of ${count}` : undefined}
                >
                  <Message message={message} inverted={inverted} />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-end gap-0.5">
              {rotating && (
                <>
                  <div className="flex items-center @max-[420px]:hidden" aria-label="Choose an announcement" role="group">
                    {messages.map((m, i) => (
                      <Segment
                        key={m.id}
                        state={i < index ? "done" : i === index ? "current" : "todo"}
                        progress={progress}
                        inverted={inverted}
                        label={`Show announcement ${i + 1} of ${count}`}
                        onClick={() => i !== index && go(i, i > index ? 1 : -1)}
                      />
                    ))}
                  </div>
                  <IconButton inverted={inverted} label={paused ? "Play announcements" : "Pause announcements"} onClick={() => setPaused((p) => !p)}>
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span
                        key={paused ? "play" : "pause"}
                        className="grid place-items-center"
                        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                        transition={{ duration: 0.16, ease: ease.out }}
                      >
                        {paused ? <Play size={12} /> : <Pause size={12} />}
                      </motion.span>
                    </AnimatePresence>
                  </IconButton>
                </>
              )}
              {dismissible && (
                <IconButton inverted={inverted} label="Dismiss announcements" onClick={dismiss}>
                  <X size={14} />
                </IconButton>
              )}
            </div>
          </section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Message({ message, inverted }: { message: Announcement; inverted: boolean }) {
  const body = (
    <>
      <span className="truncate">{message.content}</span>
      {message.cta && (
        <span className={cn("shrink-0 font-medium @max-[520px]:hidden", inverted ? "text-frame" : "text-fg")}>
          <span aria-hidden className={cn("mx-2", inverted ? "opacity-40" : "text-fg-4")}>
            ·
          </span>
          {message.cta}
        </span>
      )}
    </>
  );
  if (!message.href) return <span className={cn("flex min-w-0 items-center", inverted ? "text-frame/80" : "text-fg-2")}>{body}</span>;
  return (
    <a
      href={message.href}
      className={cn(
        "group/msg flex min-w-0 items-center rounded-md px-1.5 py-1 outline-none transition-colors duration-150",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0",
        inverted ? "text-frame/80 hover:text-frame focus-visible:outline-frame/60" : "text-fg-2 hover:text-fg focus-visible:outline-fg-3",
      )}
    >
      {body}
      <ArrowRight
        size={14}
        className={cn(
          "ml-1 shrink-0 transition-[translate,opacity] duration-200 ease-out-expo group-hover/msg:translate-x-0.5",
          inverted ? "opacity-70 group-hover/msg:opacity-100" : "text-fg-3 group-hover/msg:text-fg",
        )}
      />
    </a>
  );
}

// A 2px track that fills while its message is showing. The hit area is the full bar height.
function Segment({ state, progress, inverted, label, onClick }: { state: "done" | "current" | "todo"; progress: MotionValue<number>; inverted: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={state === "current" ? "true" : undefined}
      onClick={onClick}
      className="group/seg grid h-9 w-5 place-items-center outline-none"
    >
      <span
        className={cn(
          "relative h-0.5 w-3.5 overflow-hidden rounded-full transition-[width,background-color] duration-200",
          inverted ? "bg-frame/20 group-hover/seg:bg-frame/35" : "bg-fg/10 group-hover/seg:bg-fg/20",
          "group-focus-visible/seg:outline-solid group-focus-visible/seg:outline-1 group-focus-visible/seg:outline-offset-4",
          inverted ? "group-focus-visible/seg:outline-frame/60" : "group-focus-visible/seg:outline-fg-3",
        )}
      >
        <motion.span className={cn("absolute inset-0 origin-left", inverted ? "bg-frame" : "bg-fg/70")} style={{ scaleX: state === "current" ? progress : state === "done" ? 1 : 0 }} />
      </span>
    </button>
  );
}

function IconButton({ inverted, label, onClick, children }: { inverted: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "relative grid size-7 shrink-0 place-items-center rounded-md outline-none",
        "transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.9] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0",
        "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
        inverted ? "text-frame/70 hover:bg-frame/10 hover:text-frame focus-visible:outline-frame/60" : "text-fg-3 hover:bg-hover hover:text-fg focus-visible:outline-fg-3",
      )}
    >
      {children}
    </button>
  );
}
