"use client";
import { Menu } from "@base-ui/react/menu";
import { Popover } from "@base-ui/react/popover";
import { Toolbar } from "@base-ui/react/toolbar";
import { Tooltip } from "@base-ui/react/tooltip";
import {
  AnimatePresence,
  animate,
  motion,
  useAnimate,
  useMotionValue,
  useReducedMotion,
  type AnimationPlaybackControls,
} from "motion/react";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { useCopy } from "@/components/ui/copy-button";
import { cn } from "@/lib/cn";
import { Check, Copy, MoreH, Refresh, Share, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * Root
 * -----------------------------------------------------------------------------------------------*/

type Ctx = { announce: (message: string) => void };
const ActionsContext = createContext<Ctx>({ announce: () => {} });

export type MessageActionsProps = Omit<Toolbar.Root.Props, "className" | "orientation"> & {
  className?: string;
  /**
   * `hover` keeps the row invisible until the message (any ancestor with `data-message`) or the
   * row itself is hovered, or a control inside is focused from the keyboard. Touch screens always
   * show it. `always` is for the latest reply.
   */
  reveal?: "hover" | "always";
};

/**
 * The row under a reply. A toolbar: one Tab stop, arrow keys move between actions, Home and End
 * jump to the ends. Its height is always reserved, so revealing it never moves the thread.
 */
export function MessageActions({ reveal = "always", className, children, "aria-label": ariaLabel = "Message actions", ...rest }: MessageActionsProps) {
  const [message, setMessage] = useState("");
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  // Clearing first lets the same sentence be announced twice in a row.
  const announce = useCallback((next: string) => {
    setMessage("");
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => setMessage(next));
  }, []);

  return (
    <ActionsContext value={{ announce }}>
      {/* One warm-up for every tooltip in the row: the first waits, its neighbors open on contact. */}
      <Tooltip.Provider delay={500} timeout={400}>
        <Toolbar.Root
          aria-label={ariaLabel}
          data-mode={reveal}
          className={cn(
            "relative flex min-h-7 items-center gap-0.5 pointer-coarse:min-h-9",
            // --reveal drives every action's opacity. Hidden only on fine pointers; the :where keeps the
            // hiding rule weaker than every rule that reveals.
            "pointer-fine:[&:where([data-mode=hover])]:[--reveal:0]",
            "[[data-message]:hover_&]:[--reveal:1] data-[mode=hover]:hover:[--reveal:1]",
            "data-[mode=hover]:has-[:focus-visible]:[--reveal:1] data-[mode=hover]:has-[[data-popup-open]]:[--reveal:1]",
            className,
          )}
          {...rest}
        >
          {children}
          <span role="status" aria-live="polite" className="sr-only">
            {message}
          </span>
        </Toolbar.Root>
      </Tooltip.Provider>
    </ActionsContext>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Shared pieces: the button look and its tooltip
 * -----------------------------------------------------------------------------------------------*/

const buttonClass = cn(
  "relative inline-flex size-7 shrink-0 select-none items-center justify-center rounded-md text-fg-3 outline-none",
  "touch-manipulation [-webkit-tap-highlight-color:transparent]",
  "opacity-[var(--reveal,1)] data-keep:opacity-100",
  "transition-[opacity,background-color,color,scale] duration-150 ease-out active:scale-[0.9] active:duration-75",
  "hover:bg-hover hover:text-fg data-popup-open:bg-hover data-popup-open:text-fg aria-pressed:text-fg",
  "data-[state=failed]:text-danger data-[state=failed]:hover:text-danger data-busy:cursor-progress data-busy:text-fg-2 data-busy:hover:text-fg-2",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
  "data-disabled:cursor-not-allowed data-disabled:text-fg-4 data-disabled:hover:bg-transparent",
  // Draws at 28px. On touch it grows to 36px and the hit area reaches 44px.
  "pointer-coarse:size-9 before:absolute before:-inset-1 before:content-[''] pointer-fine:before:hidden",
  "motion-reduce:active:scale-100",
);

function Tip({ label, closeOnClick = true, children }: { label: React.ReactNode; closeOnClick?: boolean; children: React.ReactElement<Record<string, unknown>> }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} closeOnClick={closeOnClick} />
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" sideOffset={6} collisionPadding={8} className="z-(--z-tooltip)">
          <Tooltip.Popup
            className={cn(
              "origin-(--transform-origin) whitespace-nowrap rounded-md border border-line-2 bg-raised px-1.5 py-[3px] text-[11.5px] leading-4 text-fg shadow-pop",
              "transition-[opacity,scale,translate] duration-150 ease-out-expo",
              "data-starting-style:scale-96 data-starting-style:translate-y-0.5 data-starting-style:opacity-0",
              "data-ending-style:opacity-0 data-ending-style:duration-100 data-instant:transition-none",
              "motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:translate-y-0",
            )}
          >
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Generic action
 * -----------------------------------------------------------------------------------------------*/

export type MessageActionProps = Omit<Toolbar.Button.Props, "className" | "children"> & {
  /** The accessible name, and the tooltip unless `tooltip` says otherwise. Say what it does. */
  label: string;
  tooltip?: React.ReactNode;
  /** Keep this action visible while the rest of a hover row is hidden. */
  keep?: boolean;
  className?: string;
  /** The icon. */
  children: React.ReactNode;
};

/** Any icon action: read aloud, edit, bookmark. Share is this with a Share icon. */
export function MessageAction({ label, tooltip, keep, className, children, ...rest }: MessageActionProps) {
  return (
    <Tip label={tooltip ?? label}>
      <Toolbar.Button aria-label={label} data-keep={keep ? "" : undefined} className={cn(buttonClass, className)} {...rest}>
        {children}
      </Toolbar.Button>
    </Tip>
  );
}

export type MessageActionShareProps = Omit<MessageActionProps, "label" | "children"> & { label?: string };

export function MessageActionShare({ label = "Share", ...rest }: MessageActionShareProps) {
  return (
    <MessageAction label={label} {...rest}>
      <Share />
    </MessageAction>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Copy
 * -----------------------------------------------------------------------------------------------*/

export type MessageActionCopyProps = Omit<Toolbar.Button.Props, "className" | "children" | "value" | "onCopy"> & {
  /** The reply's markdown source (not the rendered text), or a function that returns it. */
  value: string | (() => string | Promise<string>);
  label?: string;
  copiedLabel?: string;
  failedLabel?: string;
  onCopied?: (text: string) => void;
  onError?: (error: unknown) => void;
  className?: string;
};

export function MessageActionCopy({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  failedLabel = "Couldn’t copy",
  onCopied,
  onError,
  className,
  onClick,
  ...rest
}: MessageActionCopyProps) {
  const { announce } = useContext(ActionsContext);
  const reduce = !!useReducedMotion();
  const { state, copy } = useCopy({
    timeout: 1600,
    onCopied: (text) => {
      announce(copiedLabel);
      onCopied?.(text);
    },
    onError: (error) => {
      announce(`${failedLabel}. Select the text and copy it instead.`);
      onError?.(error);
    },
  });
  const text = state === "copied" ? copiedLabel : state === "failed" ? failedLabel : label;

  return (
    <Tip label={text} closeOnClick={false}>
      <Toolbar.Button
        aria-label={label}
        data-state={state}
        data-keep={state !== "idle" ? "" : undefined}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) copy(value);
        }}
        className={cn(buttonClass, className)}
        {...rest}
      >
        <SwapIcon id={state} reduce={reduce}>
          {state === "copied" ? <DrawnCheck reduce={reduce} /> : state === "failed" ? <X /> : <Copy />}
        </SwapIcon>
      </Toolbar.Button>
    </Tip>
  );
}

function SwapIcon({ id, reduce, children }: { id: string; reduce: boolean; children: React.ReactNode }) {
  return (
    <span className="relative grid size-4 place-items-center">
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className="absolute inset-0 grid place-items-center"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(3px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(3px)" }}
          transition={reduce ? { duration: 0.12 } : spring.pop}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function DrawnCheck({ reduce }: { reduce: boolean }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <motion.path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: ease.out, delay: 0.04 }}
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Regenerate
 * -----------------------------------------------------------------------------------------------*/

export type MessageActionRegenerateProps = Omit<Toolbar.Button.Props, "className" | "children"> & {
  /** Return a promise and the arrow keeps turning until it settles. */
  onRegenerate?: () => void | Promise<unknown>;
  /** Controlled busy state, for when the new reply streams in elsewhere. */
  busy?: boolean;
  label?: string;
  busyLabel?: string;
  className?: string;
};

export function MessageActionRegenerate({
  onRegenerate,
  busy: busyProp,
  label = "Regenerate",
  busyLabel = "Regenerating…",
  className,
  onClick,
  ...rest
}: MessageActionRegenerateProps) {
  const { announce } = useContext(ActionsContext);
  const reduce = !!useReducedMotion();
  const [pending, setPending] = useState(false);
  const busy = busyProp ?? pending;
  const rotate = useMotionValue(0);
  const turn = useRef<AnimationPlaybackControls | null>(null);

  // While busy the arrow turns steadily. When the work ends it doesn't snap back: it eases
  // forward to the next full turn, so it always comes to rest pointing the way it started.
  useEffect(() => {
    if (reduce) return;
    turn.current?.stop();
    const from = rotate.get();
    if (busy) {
      turn.current = animate(rotate, [from, from + 360], { duration: 0.9, ease: "linear", repeat: Infinity });
    } else if (from % 360 !== 0) {
      const rest = Math.ceil(from / 360) * 360 + (from % 360 > 270 ? 360 : 0);
      turn.current = animate(rotate, rest, { duration: 0.5, ease: ease.out });
    }
    return () => turn.current?.stop();
  }, [busy, reduce, rotate]);

  return (
    <Tip label={busy ? busyLabel : label} closeOnClick={false}>
      <Toolbar.Button
        aria-label={busy ? busyLabel : label}
        aria-disabled={busy || undefined}
        data-busy={busy ? "" : undefined}
        data-keep={busy ? "" : undefined}
        onClick={(e) => {
          onClick?.(e);
          if (e.defaultPrevented || busy) return;
          if (!reduce) {
            // Starts turning on the press itself; a busy state picks the turn up from here.
            turn.current?.stop();
            turn.current = animate(rotate, rotate.get() + 360, { duration: 0.6, ease: ease.inOut });
          }
          announce(busyLabel);
          const result = onRegenerate?.();
          if (result && typeof (result as Promise<unknown>).then === "function") {
            setPending(true);
            (result as Promise<unknown>).finally(() => setPending(false));
          }
        }}
        className={cn(buttonClass, className)}
        {...rest}
      >
        <motion.span style={{ rotate }} className="grid size-4 place-items-center">
          <Refresh />
        </motion.span>
      </Toolbar.Button>
    </Tip>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Feedback: thumbs up and down, with an optional "what went wrong" follow-up
 * -----------------------------------------------------------------------------------------------*/

export type MessageFeedback = "up" | "down" | null;

export type MessageFeedbackDetails = { reasons: string[]; comment: string };

export type MessageActionFeedbackProps = {
  value?: MessageFeedback;
  defaultValue?: MessageFeedback;
  onValueChange?: (value: MessageFeedback) => void;
  /** Offer these after a thumbs down. Leave empty to skip the follow-up. */
  reasons?: string[];
  /** Called when the follow-up is sent. */
  onDetailsSubmit?: (details: MessageFeedbackDetails) => void;
  upLabel?: string;
  downLabel?: string;
  disabled?: boolean;
};

const UP = "M5 7.25v6H3a.75.75 0 0 1-.75-.75V8A.75.75 0 0 1 3 7.25zm0 0 2.5-4.5a1.4 1.4 0 0 1 1.9 1.3l-.4 2.2h3.3a1.25 1.25 0 0 1 1.2 1.6l-1.3 4.3a1.25 1.25 0 0 1-1.2.85H5";
const DOWN = "M11 8.75v-6h2a.75.75 0 0 1 .75.75V8a.75.75 0 0 1-.75.75zm0 0-2.5 4.5a1.4 1.4 0 0 1-1.9-1.3l.4-2.2H3.7a1.25 1.25 0 0 1-1.2-1.6l1.3-4.3a1.25 1.25 0 0 1 1.2-.85H11";

export function MessageActionFeedback({
  value,
  defaultValue = null,
  onValueChange,
  reasons = [],
  onDetailsSubmit,
  upLabel = "Good response",
  downLabel = "Bad response",
  disabled,
}: MessageActionFeedbackProps) {
  const { announce } = useContext(ActionsContext);
  const [current, setCurrent] = useControllableState<MessageFeedback>({ value, defaultValue, onChange: onValueChange });
  const [open, setOpen] = useState(false);
  const downRef = useRef<HTMLButtonElement>(null);

  const choose = (next: "up" | "down") => {
    const resolved = current === next ? null : next;
    setCurrent(resolved);
    announce(resolved === "up" ? `Marked as ${upLabel.toLowerCase()}` : resolved === "down" ? `Marked as ${downLabel.toLowerCase()}` : "Feedback removed");
    setOpen(resolved === "down" && reasons.length > 0);
  };

  return (
    <>
      <Thumb dir="up" label={upLabel} pressed={current === "up"} disabled={disabled} onPress={() => choose("up")} />
      <Thumb ref={downRef} dir="down" label={downLabel} pressed={current === "down"} disabled={disabled} onPress={() => choose("down")} popupOpen={open} />
      {reasons.length > 0 && (
        <FeedbackDetails
          open={open}
          onOpenChange={setOpen}
          anchor={downRef}
          reasons={reasons}
          onSubmit={(details) => {
            setOpen(false);
            announce("Feedback sent");
            onDetailsSubmit?.(details);
          }}
        />
      )}
    </>
  );
}

function Thumb({
  dir,
  label,
  pressed,
  disabled,
  popupOpen,
  onPress,
  ref,
}: {
  dir: "up" | "down";
  label: string;
  pressed: boolean;
  disabled?: boolean;
  popupOpen?: boolean;
  onPress: () => void;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  const reduce = !!useReducedMotion();
  const [scope, run] = useAnimate<HTMLSpanElement>();

  return (
    <Tip label={label}>
      <Toolbar.Button
        ref={ref}
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        data-keep={pressed ? "" : undefined}
        data-popup-open={popupOpen ? "" : undefined}
        onClick={() => {
          // The acknowledgement: a small nod in the thumb's own direction as it fills.
          if (!pressed && !reduce)
            run(scope.current, { rotate: [0, dir === "up" ? -14 : 14, 0], scale: [1, 0.86, 1], y: [0, dir === "up" ? -1.5 : 1.5, 0] }, { duration: 0.42, ease: ease.out });
          onPress();
        }}
        className={buttonClass}
      >
        <span ref={scope} className="grid size-4 place-items-center">
          <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <motion.path
              d={dir === "up" ? UP : DOWN}
              fill="currentColor"
              initial={false}
              animate={{ fillOpacity: pressed ? 1 : 0 }}
              transition={{ duration: pressed ? 0.2 : 0.14, ease: ease.out, delay: pressed && !reduce ? 0.06 : 0 }}
            />
          </svg>
        </span>
      </Toolbar.Button>
    </Tip>
  );
}

function FeedbackDetails({
  open,
  onOpenChange,
  anchor,
  reasons,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: React.RefObject<HTMLButtonElement | null>;
  reasons: string[];
  onSubmit: (details: MessageFeedbackDetails) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const id = useId();
  const empty = picked.length === 0 && comment.trim() === "";

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => onOpenChange(next)}
      onOpenChangeComplete={(next) => {
        if (!next) {
          setPicked([]);
          setComment("");
        }
      }}
    >
      <Popover.Portal>
        <Popover.Positioner anchor={anchor} side="bottom" align="start" sideOffset={8} collisionPadding={12} className="z-(--z-popover)">
          <Popover.Popup
            finalFocus={anchor}
            className={cn(
              "w-[min(20rem,calc(100vw-24px))] origin-(--transform-origin) rounded-xl border border-line-2 bg-raised p-3 text-fg shadow-pop outline-none",
              "transition-[opacity,scale,translate] duration-180 ease-out-expo",
              "data-starting-style:scale-96 data-starting-style:-translate-y-1 data-starting-style:opacity-0",
              "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-120",
              "data-instant:transition-none motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:translate-y-0",
            )}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!empty) onSubmit({ reasons: picked, comment: comment.trim() });
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <Popover.Title className="text-[13px] font-medium tracking-[-0.01em]">What went wrong?</Popover.Title>
                <Popover.Close
                  aria-label="Skip feedback"
                  className={cn(
                    "relative -mr-1 -mt-1 grid size-6 shrink-0 place-items-center rounded-md text-fg-3 outline-none transition-[background-color,color,scale] duration-150",
                    "hover:bg-hover hover:text-fg active:scale-[0.9] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                  )}
                >
                  <X size={14} />
                </Popover.Close>
              </div>
              <Popover.Description className="mt-0.5 text-[12px] text-fg-3">Pick any that apply. It helps the next answer.</Popover.Description>

              <div role="group" aria-label="Reasons" className="mt-3 flex flex-wrap gap-1.5">
                {reasons.map((r) => {
                  const on = picked.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPicked((p) => (on ? p.filter((x) => x !== r) : [...p, r]))}
                      className={cn(
                        "inline-flex h-7 select-none items-center gap-1 rounded-full border px-2.5 text-[12px] outline-none",
                        "transition-[background-color,border-color,color,scale,padding] duration-150 ease-out active:scale-[0.96] active:duration-75",
                        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                        on ? "border-fg bg-fg pl-1.5 text-frame" : "border-line-2 text-fg-2 hover:border-fg-4 hover:bg-hover hover:text-fg",
                      )}
                    >
                      <AnimatePresence initial={false}>
                        {on && (
                          <motion.span
                            key="check"
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 14, opacity: 1 }}
                            exit={{ width: 0, opacity: 0, transition: { duration: 0.12 } }}
                            transition={{ duration: 0.18, ease: ease.out }}
                            className="grid shrink-0 place-items-center overflow-hidden"
                          >
                            <Check size={14} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {r}
                    </button>
                  );
                })}
              </div>

              <label htmlFor={`${id}-comment`} className="sr-only">
                Details
              </label>
              <textarea
                id={`${id}-comment`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="What should the answer have said? (optional)"
                className={cn(
                  "mt-3 block w-full resize-none rounded-lg border border-line-2 bg-frame px-2.5 py-2 text-base leading-5 text-fg outline-none sm:text-[13px]",
                  "placeholder:text-fg-4 transition-[border-color,box-shadow] duration-150 focus:border-fg-4 focus:ring-2 focus:ring-fg/10",
                )}
              />

              <div className="mt-3 flex items-center justify-end gap-2">
                <Popover.Close
                  className={cn(
                    "h-7 rounded-md px-2.5 text-[12px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150",
                    "hover:bg-hover hover:text-fg active:scale-[0.97] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                  )}
                >
                  Skip
                </Popover.Close>
                <button
                  type="submit"
                  disabled={empty}
                  className={cn(
                    "h-7 rounded-md bg-fg px-2.5 text-[12px] font-medium text-frame outline-none transition-[background-color,opacity,scale] duration-150",
                    "hover:bg-fg/90 active:scale-[0.97] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                    "disabled:pointer-events-none disabled:opacity-40",
                  )}
                >
                  Send feedback
                </button>
              </div>
            </form>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* -------------------------------------------------------------------------------------------------
 * More: the overflow menu
 * -----------------------------------------------------------------------------------------------*/

export type MessageActionsMoreProps = {
  label?: string;
  align?: "start" | "center" | "end";
  /** `MessageActionsMenuItem`s and `MessageActionsMenuSeparator`s. */
  children: React.ReactNode;
};

export function MessageActionsMore({ label = "More actions", align = "start", children }: MessageActionsMoreProps) {
  const [popup, setPopup] = useState<HTMLDivElement | null>(null);
  const glide = useGlide(popup);

  return (
    <Menu.Root>
      <Tip label={label}>
        <Toolbar.Button render={<Menu.Trigger />} aria-label={label} className={buttonClass}>
          <MoreH />
        </Toolbar.Button>
      </Tip>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align={align} sideOffset={6} collisionPadding={8} className="z-(--z-dropdown) outline-none">
          <Menu.Popup
            ref={setPopup}
            className={cn(
              "relative isolate min-w-48 max-w-[min(18rem,var(--available-width))] origin-(--transform-origin) rounded-xl border border-line-2 bg-raised p-1 text-fg shadow-pop outline-none",
              "transition-[opacity,scale,translate] duration-180 ease-out-expo",
              "data-starting-style:scale-96 data-starting-style:-translate-y-1 data-starting-style:opacity-0",
              "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-120",
              "data-instant:duration-0 motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:translate-y-0",
            )}
          >
            <motion.div
              aria-hidden
              style={glide}
              data-glide=""
              data-tone="default"
              className="pointer-events-none absolute inset-x-1 top-0 -z-10 rounded-lg bg-fg/[0.06] data-[tone=danger]:bg-danger-soft"
            />
            {children}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export type MessageActionsMenuItemProps = Omit<Menu.Item.Props, "className"> & {
  icon?: React.ReactNode;
  variant?: "default" | "danger";
  /** A short hint on the right, like a shortcut. */
  hint?: React.ReactNode;
  className?: string;
};

export function MessageActionsMenuItem({ icon, variant = "default", hint, className, children, ...rest }: MessageActionsMenuItemProps) {
  return (
    <Menu.Item
      data-variant={variant}
      className={cn(
        "flex h-8 cursor-default select-none items-center gap-2 rounded-lg px-2 text-[13px] text-fg outline-none",
        "data-disabled:text-fg-4 data-[variant=danger]:text-danger",
        className,
      )}
      {...rest}
    >
      {icon && <span className="grid size-4 shrink-0 place-items-center text-fg-3 [[data-variant=danger]_&]:text-danger">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 pl-3 font-mono text-[11px] text-fg-4">{hint}</span>}
    </Menu.Item>
  );
}

export function MessageActionsMenuSeparator({ className, ...rest }: Omit<Menu.Separator.Props, "className"> & { className?: string }) {
  return <Menu.Separator className={cn("mx-2 my-1 h-px bg-line", className)} {...rest} />;
}

// One highlight for the whole menu, moved to the highlighted row. It springs after the pointer
// and jumps for arrow keys, where motion would read as lag.
function useGlide(popup: HTMLDivElement | null) {
  const reduce = useReducedMotion();
  const y = useMotionValue(0);
  const height = useMotionValue(32);
  const opacity = useMotionValue(0);

  useEffect(() => {
    if (!popup) return;
    let keyboard = false;
    let shown = false;
    const hl = popup.querySelector<HTMLElement>("[data-glide]");
    const sync = () => {
      const row = popup.querySelector<HTMLElement>("[data-highlighted]");
      if (!row) {
        if (shown) animate(opacity, 0, { duration: 0.1 });
        shown = false;
        return;
      }
      if (hl) hl.dataset.tone = row.dataset.variant === "danger" ? "danger" : "default";
      if (!shown || keyboard || reduce) {
        y.jump(row.offsetTop);
        height.jump(row.offsetHeight);
      } else {
        animate(y, row.offsetTop, spring.follow);
        animate(height, row.offsetHeight, spring.follow);
      }
      if (!shown) animate(opacity, 1, { duration: keyboard || reduce ? 0 : 0.08 });
      shown = true;
    };
    const onKey = () => (keyboard = true);
    const onMove = () => (keyboard = false);
    const observer = new MutationObserver(sync);
    observer.observe(popup, { subtree: true, attributes: true, attributeFilter: ["data-highlighted"] });
    popup.addEventListener("keydown", onKey, true);
    popup.addEventListener("pointermove", onMove, true);
    sync();
    return () => {
      observer.disconnect();
      popup.removeEventListener("keydown", onKey, true);
      popup.removeEventListener("pointermove", onMove, true);
      opacity.jump(0);
    };
  }, [popup, reduce, y, height, opacity]);

  return { y, height, opacity };
}
