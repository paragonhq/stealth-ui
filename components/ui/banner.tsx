"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Alert, ArrowRight, CircleCheck, Info, Warning, X } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type BannerTone = "neutral" | "info" | "success" | "warning" | "danger";

// ---------------------------------------------------------------------------
// Remembered dismissal. One localStorage key per banner, shared across tabs,
// read after hydration so the server and the first client render agree.

const PREFIX = "stealth-banner:";
const EVENT = "stealth-banner-change";

function read(key: string) {
  try {
    return window.localStorage.getItem(PREFIX + key) === "1";
  } catch {
    return false;
  }
}

function write(key: string, dismissed: boolean) {
  try {
    if (dismissed) window.localStorage.setItem(PREFIX + key, "1");
    else window.localStorage.removeItem(PREFIX + key);
  } catch {
    // Private mode or storage disabled: the banner still hides for this visit.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** Whether a banner with this key was dismissed on this device, and ways to change it. */
export function useBannerDismissal(key: string | undefined) {
  const dismissed = useSyncExternalStore(
    subscribe,
    () => (key ? read(key) : false),
    () => false,
  );
  const dismiss = useCallback(() => key && write(key, true), [key]);
  const restore = useCallback(() => key && write(key, false), [key]);
  return { dismissed, dismiss, restore };
}

// When the dismissed banner held focus, hand it to the next thing on the page
// rather than dropping it on <body>.
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
function focusAfter(node: HTMLElement) {
  if (!node.contains(document.activeElement)) return;
  const all = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !node.contains(el) && el.getClientRects().length > 0);
  const next = all.find((el) => node.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) ?? all.findLast((el) => node.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING);
  next?.focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------

const tones: Record<BannerTone, { icon: React.ReactNode; surface: string; bar: string; glyph: string; label: string }> = {
  neutral: { icon: <Info />, surface: "bg-raised", bar: "border-line", glyph: "text-fg-3", label: "Note" },
  info: { icon: <Info />, surface: "bg-info-soft", bar: "border-info/20", glyph: "text-info", label: "Info" },
  success: { icon: <CircleCheck />, surface: "bg-success-soft", bar: "border-success/20", glyph: "text-success", label: "Success" },
  warning: { icon: <Warning />, surface: "bg-warning-soft", bar: "border-warning/25", glyph: "text-warning", label: "Warning" },
  danger: { icon: <Alert />, surface: "bg-danger-soft", bar: "border-danger/25", glyph: "text-danger", label: "Error" },
};

export type BannerProps = Omit<React.ComponentProps<"div">, "title" | "children"> & {
  tone?: BannerTone;
  /** Full-bleed strip across a region, or a rounded block inside a content column. */
  variant?: "bar" | "inset";
  /** Replace the tone's icon, or `false` for none. */
  icon?: React.ReactNode | false;
  /** A few words, set in the primary color ahead of the message. */
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** Usually a `BannerAction`. */
  action?: React.ReactNode;
  /** Show a close button. */
  dismissible?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Remember the dismissal on this device under this key. Change the key to show a new message again. */
  storageKey?: string;
  /** Accessible name for the close button. */
  dismissLabel?: string;
};

export function Banner({
  tone = "neutral",
  variant = "bar",
  icon,
  title,
  children,
  action,
  dismissible = false,
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  storageKey,
  dismissLabel = "Dismiss",
  className,
  ...rest
}: BannerProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const remembered = useBannerDismissal(storageKey);
  const t = tones[tone];
  const shown = open && !remembered.dismissed;
  const glyph = icon === false ? null : (icon ?? t.icon);

  const dismiss = () => {
    if (ref.current) focusAfter(ref.current);
    remembered.dismiss();
    setOpen(false);
  };

  return (
    <AnimatePresence initial={false}>
      {shown && (
        // The outer box animates height so what sits below slides up as the banner closes.
        <motion.div
          key="banner"
          className={cn("shrink-0 overflow-hidden", variant === "inset" && "-m-1 p-1")}
          initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={
            reduce
              ? { duration: 0.15 }
              : { height: { duration: 0.28, ease: ease.inOut }, opacity: { duration: 0.16, ease: ease.out } }
          }
        >
          <div
            ref={ref}
            role={tone === "danger" || tone === "warning" ? "alert" : "status"}
            data-tone={tone}
            data-variant={variant}
            className={cn(
              "@container relative text-[13px] leading-5",
              t.surface,
              variant === "bar" ? cn("border-b", t.bar) : cn("rounded-xl border", t.bar),
              className,
            )}
            {...rest}
          >
            <div
              className={cn(
                "grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-start py-2.5",
                variant === "bar" ? "px-4" : "px-3",
              )}
            >
              {glyph && <span className={cn("col-start-1 row-start-1 mr-2.5 mt-1.5 grid size-4 place-items-center", t.glyph)}>{glyph}</span>}
              <p className="col-start-2 row-start-1 min-w-0 py-1 text-fg-2 text-pretty">
                <span className="sr-only">{t.label}: </span>
                {title != null && <span className="font-medium text-fg">{title} </span>}
                {children}
              </p>
              {action != null && (
                <div className="col-start-3 row-start-1 ml-3 flex items-center gap-1.5 @max-[480px]:col-start-2 @max-[480px]:row-start-2 @max-[480px]:-ml-2 @max-[480px]:mt-1">
                  {action}
                </div>
              )}
              {dismissible && (
                <button
                  type="button"
                  aria-label={dismissLabel}
                  onClick={dismiss}
                  className={cn(
                    "relative col-start-4 row-start-1 ml-1.5 grid size-7 place-items-center rounded-md text-fg-3",
                    "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
                    "transition-[background-color,color,scale] duration-150 ease-out hover:bg-fg/[0.06] hover:text-fg active:scale-[0.9] active:duration-75",
                    "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
                    variant === "bar" ? "-mr-2" : "-mr-1",
                  )}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export type BannerActionProps = (Omit<React.ComponentProps<"button">, "type"> & { href?: undefined }) | (React.ComponentProps<"a"> & { href: string });

/** A text action with an arrow that leans forward on hover. Renders a link when given `href`. */
export function BannerAction({ className, children, ...rest }: BannerActionProps) {
  const cls = cn(
    "group/action inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[12.5px] font-medium text-fg",
    "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
    "transition-[background-color,scale] duration-150 ease-out hover:bg-fg/[0.06] active:scale-[0.97] active:duration-75",
    className,
  );
  const inner = (
    <>
      {children}
      <ArrowRight size={14} className="text-fg-3 transition-[translate,color] duration-200 ease-out-expo group-hover/action:translate-x-0.5 group-hover/action:text-fg" />
    </>
  );
  if (rest.href !== undefined) {
    return (
      <a className={cls} {...(rest as React.ComponentProps<"a">)}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" className={cls} {...(rest as React.ComponentProps<"button">)}>
      {inner}
    </button>
  );
}
