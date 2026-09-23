"use client";
import { Toast } from "@base-ui/react/toast";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { Info, Warning, X } from "@/lib/icons";
import { ease } from "@/lib/motion";

export type ToastTone = "neutral" | "success" | "error" | "warning" | "info" | "loading";
export type ToastPosition = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";

export type ToastAction = {
  label: string;
  /** Runs, then the toast closes. Call `event.preventDefault()` to keep it open (to update it in place, say). */
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

export type ToastOptions = {
  /** Reusing an id updates that toast in place instead of stacking a duplicate. */
  id?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  tone?: ToastTone;
  /** Replace the tone's icon, or `false` for none. */
  icon?: React.ReactNode | false;
  action?: ToastAction;
  /** 0–1. Draws a bar along the bottom edge and a rolling percentage. */
  progress?: number;
  /** Milliseconds before it closes; 0 keeps it open. Defaults depend on tone and action. */
  timeout?: number;
  /** "high" announces immediately and interrupts the screen reader. */
  priority?: "low" | "high";
  /** Show the close button. Swipe and Escape still work. */
  dismissible?: boolean;
  onClose?: () => void;
  onRemove?: () => void;
};

type ToastData = {
  tone: ToastTone;
  icon?: React.ReactNode | false;
  action?: ToastAction;
  progress?: number;
  dismissible: boolean;
  /** Increments when the same id is shown again, to replay a small nudge. */
  bump: number;
};

type BaseManager = Pick<ReturnType<typeof Toast.createToastManager>, "add" | "update" | "close">;
type ToastObject = Toast.Root.ToastObject<ToastData>;

// A toast with somewhere to go stays long enough to reach it; errors stay longer
// than successes; loading never times out on its own.
function defaultTimeout(tone: ToastTone, action?: ToastAction) {
  if (tone === "loading") return 0;
  if (action) return 8000;
  return tone === "error" || tone === "warning" ? 7000 : 5000;
}

const dataKeys = ["icon", "action", "progress", "dismissible"] as const;

function bind(manager: BaseManager, existing?: (id: string) => ToastObject | undefined) {
  const add = (options: ToastOptions) => {
    const { tone = "neutral", icon, action, progress, dismissible = true, timeout, id, ...rest } = options;
    const prev = id ? existing?.(id) : undefined;
    return manager.add<ToastData>({
      ...rest,
      id,
      type: tone,
      timeout: timeout ?? defaultTimeout(tone, action),
      data: { tone, icon, action, progress, dismissible, bump: prev ? (prev.data?.bump ?? 0) + 1 : 0 },
    });
  };

  // Only the fields you pass change. A new tone without a timeout gets that tone's default.
  const update = (id: string, patch: Omit<ToastOptions, "id">) =>
    manager.update<ToastData>(id, (prev) => {
      const data: ToastData = { tone: "neutral", dismissible: true, bump: 0, ...prev.data };
      for (const key of dataKeys) if (Object.hasOwn(patch, key)) Object.assign(data, { [key]: patch[key] });
      const tone = patch.tone ?? data.tone;
      const toneChanged = tone !== data.tone;
      data.tone = tone;
      return {
        type: tone,
        data,
        ...(Object.hasOwn(patch, "title") && { title: patch.title }),
        ...(Object.hasOwn(patch, "description") && { description: patch.description }),
        ...(patch.priority && { priority: patch.priority }),
        ...(patch.onClose && { onClose: patch.onClose }),
        ...(patch.onRemove && { onRemove: patch.onRemove }),
        ...(patch.timeout !== undefined ? { timeout: patch.timeout } : toneChanged && { timeout: defaultTimeout(tone, data.action) }),
      };
    });

  return { add, update, close: (id?: string) => manager.close(id) };
}

export type ToastApi = ReturnType<typeof bind>;

/** Show, update and close toasts from inside a `ToastProvider`. */
export function useToast() {
  const manager = Toast.useToastManager();
  const find = (id: string) => (manager.toasts as ToastObject[]).find((t) => t.id === id && t.transitionStatus !== "ending");
  return { ...bind(manager, find), toasts: manager.toasts as ToastObject[] };
}

/**
 * A manager you can call from anywhere, outside React included (API clients,
 * stores). Pass `manager` to `ToastProvider` so its toasts render in your Toaster.
 */
export function createToastManager() {
  const manager = Toast.createToastManager();
  return { manager, ...bind(manager) };
}

export type ToastProviderProps = {
  children: React.ReactNode;
  /** How many are visible at once. Older ones fade out behind the stack. */
  limit?: number;
  /** Default milliseconds, used when a tone has no default of its own. */
  timeout?: number;
  /** From `createToastManager()`, to show toasts from outside React. */
  manager?: ReturnType<typeof createToastManager>;
};

export function ToastProvider({ children, limit = 3, timeout = 5000, manager }: ToastProviderProps) {
  return (
    <Toast.Provider limit={limit} timeout={timeout} toastManager={manager?.manager}>
      {children}
    </Toast.Provider>
  );
}

export type ToasterProps = Omit<React.ComponentProps<"div">, "children"> & {
  position?: ToastPosition;
  /** Render inside the nearest positioned ancestor instead of fixed to the window. */
  contained?: boolean;
  /** Where the portal mounts when not contained. Defaults to `document.body`. */
  container?: HTMLElement | null;
};

const place: Record<ToastPosition, string> = {
  "top-left": "top-4 left-4",
  "top-center": "top-4 left-1/2 -translate-x-1/2",
  "top-right": "top-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
  "bottom-right": "bottom-4 right-4",
};

// Swipe toward the edge it lives on, or sideways toward the nearer side.
const swipe: Record<ToastPosition, ("up" | "down" | "left" | "right")[]> = {
  "top-left": ["up", "left"],
  "top-center": ["up", "left", "right"],
  "top-right": ["up", "right"],
  "bottom-left": ["down", "left"],
  "bottom-center": ["down", "left", "right"],
  "bottom-right": ["down", "right"],
};

/** Renders the stack. Put one inside `ToastProvider`, once per app. */
export function Toaster({ position = "bottom-right", contained = false, container, className, ...rest }: ToasterProps) {
  const viewport = (
    <Toast.Viewport
      data-position={position}
      className={cn(
        "z-(--z-toast) outline-none",
        contained ? "absolute w-[min(356px,calc(100%-32px))]" : "fixed w-[356px] max-sm:inset-x-4 max-sm:w-auto max-sm:translate-x-0",
        place[position],
        !contained && position.startsWith("bottom") && "max-sm:bottom-[max(16px,env(safe-area-inset-bottom))]",
        className,
      )}
      {...rest}
    >
      <ToastList position={position} />
      <style href="stealth-toast" precedence="default">
        {CSS}
      </style>
    </Toast.Viewport>
  );
  if (contained) return viewport;
  return <Toast.Portal container={container}>{viewport}</Toast.Portal>;
}

function ToastList({ position }: { position: ToastPosition }) {
  const { toasts, close } = Toast.useToastManager();
  return (toasts as ToastObject[]).map((toast) => <ToastCard key={toast.id} toast={toast} position={position} close={close} />);
}

function ToastCard({ toast, position, close }: { toast: ToastObject; position: ToastPosition; close: (id: string) => void }) {
  const reduce = useReducedMotion();
  const data = toast.data;
  const tone = data?.tone ?? (toast.type as ToastTone) ?? "neutral";
  const progress = data?.progress;
  const bump = data?.bump ?? 0;
  const hasGlyph = data?.icon !== false && (data?.icon != null || tone !== "neutral");

  return (
    <Toast.Root
      toast={toast}
      swipeDirection={swipe[position]}
      data-tone={tone}
      data-bump={bump > 0 ? (bump % 2 ? "a" : "b") : undefined}
      className={cn(
        "stealth-toast @container select-none rounded-xl border border-line-2 shadow-pop",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
      )}
    >
      {/* Glyph, copy, action, close. On a narrow toast the action drops under the copy instead of squeezing it. */}
      <Toast.Content className="stealth-toast-content relative grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-start overflow-hidden rounded-[11px] p-3 pr-2">
        <AnimatePresence initial={false}>
          {hasGlyph && (
            <motion.span
              key="glyph"
              className="col-start-1 row-start-1 flex shrink-0 overflow-hidden"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 26, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.22, ease: ease.out }}
            >
              <span className="mt-1.5 grid size-4 place-items-center">
                <Glyph tone={tone} icon={data?.icon} reduce={!!reduce} />
              </span>
            </motion.span>
          )}
        </AnimatePresence>

        {/* The copy swaps in place when the tone changes; the root animates to the new height. */}
        <div className="relative col-start-2 row-start-1 min-w-0 py-[5px]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={tone}
              className="min-w-0"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -4, filter: "blur(2px)", transition: { duration: 0.12 } }}
              transition={{ duration: 0.22, ease: ease.out }}
            >
              <div className="flex items-start gap-2">
                <Toast.Title className="min-w-0 flex-1 text-[13px] font-medium leading-[18px] tracking-[-0.005em] text-fg [overflow-wrap:anywhere]" />
                {/* Done is said by the tick; the percentage stays only while it matters. */}
                {progress != null && tone !== "success" && (
                  <span className="flex h-[18px] shrink-0 items-center text-[12px] text-fg-3 tabular">
                    <NumberFlow value={Math.min(1, Math.max(0, progress))} format={{ style: "percent", maximumFractionDigits: 0 }} animated={!reduce} />
                  </span>
                )}
              </div>
              <Toast.Description className="mt-0.5 text-[12.5px] leading-[18px] text-fg-2 [overflow-wrap:anywhere] empty:hidden" />
            </motion.div>
          </AnimatePresence>
        </div>

        {data?.action && (
          <Toast.Action
            onClick={(e) => {
              data.action?.onClick(e);
              if (!e.defaultPrevented) close(toast.id);
            }}
            className={cn(
              "relative col-start-3 row-start-1 ml-2.5 h-7 shrink-0 rounded-md bg-fg px-2.5 text-[12px] font-medium text-frame",
              "@max-[320px]:col-start-2 @max-[320px]:row-start-2 @max-[320px]:ml-0 @max-[320px]:mt-1.5 @max-[320px]:justify-self-start",
              "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              "transition-[background-color,scale] duration-150 ease-out hover:bg-fg/90 active:scale-[0.96] active:duration-75",
              "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
            )}
          >
            {data.action.label}
          </Toast.Action>
        )}

        {data?.dismissible !== false && (
          <Toast.Close
            aria-label="Dismiss notification"
            className={cn(
              "relative col-start-4 row-start-1 ml-1.5 grid size-7 shrink-0 place-items-center rounded-md text-fg-3",
              "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
              "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.9] active:duration-75",
              "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
            )}
          >
            <X size={14} />
          </Toast.Close>
        )}

        {progress != null && (
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-fg/[0.06]">
            <span
              className={cn(
                "absolute inset-0 origin-left transition-[transform,background-color,opacity] duration-300 ease-out-expo",
                tone === "success" ? "bg-success" : tone === "error" ? "bg-danger" : "bg-fg/60",
                tone !== "loading" && "opacity-0 delay-500",
              )}
              style={{ transform: `scaleX(${tone === "success" ? 1 : Math.min(1, Math.max(0, progress))})` }}
            />
          </span>
        )}
      </Toast.Content>
    </Toast.Root>
  );
}

function Glyph({ tone, icon, reduce }: { tone: ToastTone; icon?: React.ReactNode | false; reduce: boolean }) {
  const kind = icon ? "custom" : tone === "info" || tone === "warning" ? tone : "ring";
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span
        key={kind}
        className={cn(
          "grid size-4 place-items-center transition-colors duration-200",
          kind === "custom" && "text-fg-2",
          kind === "info" && "text-info",
          kind === "warning" && "text-warning",
        )}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" }}
        transition={{ duration: 0.2, ease: ease.out }}
      >
        {kind === "custom" ? icon : kind === "info" ? <Info /> : kind === "warning" ? <Warning /> : <Ring tone={tone} reduce={reduce} />}
      </motion.span>
    </AnimatePresence>
  );
}

/**
 * One ring for loading, success and error. While loading, a short arc spins;
 * when the promise settles the arc glides to rest at the top and closes into a
 * full circle, then the tick or cross draws inside it.
 */
function Ring({ tone, reduce }: { tone: ToastTone; reduce: boolean }) {
  const rotate = useMotionValue(0);
  const loading = tone === "loading";

  useEffect(() => {
    if (reduce) return;
    if (loading) {
      const from = rotate.get();
      const spin = animate(rotate, [from, from + 360], { duration: 0.8, ease: "linear", repeat: Infinity });
      return () => spin.stop();
    }
    const rest = animate(rotate, Math.ceil(rotate.get() / 360) * 360, { duration: 0.45, ease: ease.out });
    return () => rest.stop();
  }, [loading, reduce, rotate]);

  const color = tone === "success" ? "text-success" : tone === "error" ? "text-danger" : "text-fg-3";
  const draw = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 } }
      : { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: { duration: 0.28, ease: ease.out, delay } };

  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cn("transition-colors duration-300", color)}>
      <motion.circle
        cx="8"
        cy="8"
        r="5.75"
        style={{ rotate: reduce ? -90 : rotate, originX: "50%", originY: "50%" }}
        initial={{ pathLength: loading ? 0.28 : 0 }}
        animate={reduce && loading ? { pathLength: 0.28, opacity: [1, 0.4, 1] } : { pathLength: loading ? 0.28 : 1, opacity: 1 }}
        transition={
          reduce && loading
            ? { opacity: { duration: 1.6, repeat: Infinity, ease: "easeInOut" } }
            : { pathLength: { duration: reduce ? 0 : 0.45, ease: ease.out } }
        }
      />
      {tone === "success" && <motion.path d="m5.5 8.25 1.75 1.75 3.25-3.75" {...draw(0.22)} />}
      {tone === "error" && (
        <>
          <motion.path d="m6 6 4 4" {...draw(0.22)} />
          <motion.path d="M10 6 6 10" {...draw(0.32)} />
        </>
      )}
    </svg>
  );
}

// Stack geometry. Base UI measures each toast and hands us --toast-index,
// --toast-height, --toast-offset-y and the live swipe offsets; everything
// else is derived here so the stack, the hover spread, the entrance and the
// swipe exit share one transform.
const CSS = `
.stealth-toast {
  --dir: 1;
  --gap: 8px;
  --peek: 8px;
  --scale: max(0, 1 - var(--toast-index) * 0.05);
  --height: var(--toast-frontmost-height, var(--toast-height));
  --y: calc(var(--dir) * -1 * (var(--toast-index) * var(--peek) + (1 - var(--scale)) * var(--height)));
  --s: var(--scale);
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  height: var(--height);
  z-index: calc(10 - var(--toast-index));
  transform-origin: 50% 100%;
  transform: translateX(var(--toast-swipe-movement-x)) translateY(calc(var(--y) + var(--toast-swipe-movement-y))) scale(var(--s));
  background-color: color-mix(in oklab, var(--raised), var(--page) calc(min(var(--toast-index), 3) * 24%));
  transition:
    transform 420ms var(--ease-out-expo),
    opacity 240ms var(--ease-out-expo),
    height 260ms var(--ease-out-expo),
    background-color 240ms var(--ease-out-quart);
  cursor: default;
  touch-action: none;
}
[data-position^="top"] .stealth-toast { --dir: -1; top: 0; bottom: auto; transform-origin: 50% 0; }
.stealth-toast[data-expanded] {
  --y: calc(var(--dir) * -1 * (var(--toast-offset-y) + var(--toast-index) * var(--gap)));
  --s: 1;
  height: var(--toast-height);
  background-color: var(--raised);
}
.stealth-toast[data-starting-style] { transform: translateY(calc(var(--dir) * (100% + 24px))); opacity: 0; }
.stealth-toast[data-ending-style] { opacity: 0; transition-duration: 200ms, 160ms, 200ms, 200ms; }
.stealth-toast[data-ending-style]:not([data-swipe-direction]) { transform: translateY(calc(var(--y) + var(--dir) * 10px)) scale(calc(var(--s) * 0.97)); }
.stealth-toast[data-ending-style][data-swipe-direction="right"] { transform: translateX(calc(var(--toast-swipe-movement-x) + 110%)) translateY(var(--y)); }
.stealth-toast[data-ending-style][data-swipe-direction="left"] { transform: translateX(calc(var(--toast-swipe-movement-x) - 110%)) translateY(var(--y)); }
.stealth-toast[data-ending-style][data-swipe-direction="down"] { transform: translateY(calc(var(--y) + var(--toast-swipe-movement-y) + 110%)); }
.stealth-toast[data-ending-style][data-swipe-direction="up"] { transform: translateY(calc(var(--y) + var(--toast-swipe-movement-y) - 110%)); }
.stealth-toast[data-limited] { opacity: 0; pointer-events: none; }
.stealth-toast[data-swiping] { transition-property: opacity, height, background-color; }
.stealth-toast[data-bump="a"] { animation: stealth-toast-bump-a 320ms var(--ease-out-expo); }
.stealth-toast[data-bump="b"] { animation: stealth-toast-bump-b 320ms var(--ease-out-expo); }
@keyframes stealth-toast-bump-a { 40% { scale: 1.025; } }
@keyframes stealth-toast-bump-b { 40% { scale: 1.025; } }
/* Keeps the stack expanded while the pointer crosses the gaps between toasts. */
.stealth-toast::after { content: ""; position: absolute; inset-inline: 0; top: 100%; height: calc(var(--gap) + 1px); }
[data-position^="top"] .stealth-toast::after { top: auto; bottom: 100%; }
.stealth-toast-content { transition: opacity 200ms var(--ease-out-quart); }
.stealth-toast-content[data-behind]:not([data-expanded]) { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .stealth-toast[data-starting-style],
  .stealth-toast[data-ending-style]:not([data-swipe-direction]) { transform: translateY(var(--y)) scale(var(--s)); }
}
`;
