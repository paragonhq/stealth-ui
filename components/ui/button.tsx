"use client";
import { Button as BaseButton } from "@base-ui/react/button";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const sizes: Record<ButtonSize, { box: string; gap: string; start: string; end: string }> = {
  sm: { box: "h-7 rounded-md px-2 text-[12px] [&_svg:not([class*='size-'])]:size-3.5", gap: "gap-1.5", start: "pl-1.5", end: "pr-1.5" },
  md: { box: "h-8 rounded-lg px-2.5 text-[12.5px] [&_svg:not([class*='size-'])]:size-4", gap: "gap-1.5", start: "pl-2", end: "pr-2" },
  lg: { box: "h-9 rounded-lg px-3 text-[13px] [&_svg:not([class*='size-'])]:size-4", gap: "gap-2", start: "pl-2.5", end: "pr-2.5" },
};

// Inside a ButtonGroup, secondary and ghost buttons become flat segments: the
// group draws the border, the shadow, the hairlines and the hover wash.
const segment =
  "in-data-[slot=button-group]:rounded-none in-data-[slot=button-group]:border-0 in-data-[slot=button-group]:bg-transparent in-data-[slot=button-group]:shadow-none in-data-[slot=button-group]:hover:bg-transparent in-data-[slot=button-group]:data-popup-open:bg-transparent in-data-[slot=button-group]:active:scale-100 in-data-[slot=button-group]:focus-visible:-outline-offset-3 in-data-[slot=button-group]:focus-visible:rounded-[5px]";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-fg text-frame shadow-[var(--shadow)] hover:bg-fg/90 data-popup-open:bg-fg/90",
  secondary:
    "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover data-popup-open:border-fg-4 data-popup-open:bg-hover " + segment,
  ghost: "text-fg-2 hover:bg-hover hover:text-fg data-popup-open:bg-hover data-popup-open:text-fg " + segment,
  danger:
    "border border-danger/25 bg-danger-soft text-danger hover:border-danger/45 hover:bg-danger/15 data-popup-open:bg-danger/15",
};

/**
 * The button's classes on their own, for putting the look on an element that
 * isn't a Button (a menu trigger, a label, a router link you render yourself).
 */
export function buttonVariants({
  variant = "secondary",
  size = "md",
  leading = false,
  trailing = false,
}: { variant?: ButtonVariant; size?: ButtonSize; leading?: boolean; trailing?: boolean } = {}) {
  const s = sizes[size];
  return cn(
    "group/button relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium tracking-[-0.005em]",
    "touch-manipulation [-webkit-tap-highlight-color:transparent]",
    "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
    // Press: quick in (75ms), softer out (150ms). Busy buttons don't flinch.
    "transition-[background-color,border-color,color,scale] duration-150 ease-out-quart active:not-data-busy:scale-[0.97] active:not-data-busy:duration-75",
    "data-disabled:not-data-busy:pointer-events-none data-disabled:not-data-busy:opacity-50 data-busy:cursor-progress",
    // A 28px button still takes a 44px tap on touch screens.
    size === "sm" && "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2",
    s.box,
    leading && s.start,
    trailing && s.end,
    variants[variant],
  );
}

/** The busy glyph: a faint track and a quarter arc turning on it. Sized by its parent's svg rule. */
export function Spinner({ className, ...rest }: React.ComponentProps<"svg">) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden focusable={false} className={cn("shrink-0 animate-[spin_0.7s_linear_infinite]", className)} {...rest}>
      <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.5" />
      <path d="M8 2.25A5.75 5.75 0 0 1 13.75 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Loading as the eye sees it: nothing for the first 150ms (most requests are done
 * by then and a flash reads as a glitch), then held for at least 400ms so it
 * never flickers.
 */
export function useBusyDisplay(loading: boolean, { delay = 150, minimum = 400 } = {}) {
  const [shown, setShown] = useState(false);
  const since = useRef(0);
  useEffect(() => {
    if (loading) {
      const t = window.setTimeout(() => {
        since.current = performance.now();
        setShown(true);
      }, delay);
      return () => window.clearTimeout(t);
    }
    const left = Math.max(0, minimum - (performance.now() - since.current));
    const t = window.setTimeout(() => setShown(false), left);
    return () => window.clearTimeout(t);
  }, [loading, delay, minimum]);
  return shown;
}

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon before the label. Decorative; the label names the button. */
  leadingIcon?: React.ReactNode;
  /** Icon after the label: a chevron, an arrow, an external-link mark. */
  trailingIcon?: React.ReactNode;
};

export type ButtonProps = Omit<BaseButton.Props, "render" | "className"> &
  Common & {
    className?: string;
    /** Blocks presses at once and shows a spinner over the label after 150ms, without changing the width. */
    loading?: boolean;
    /** Replaces the label while loading ("Deploying…"). The button reserves room for the longer of the two. */
    loadingText?: string;
    /**
     * Render as another element, usually a link: `render={<a href="/new" />}`.
     * It gets the look and the content, and keeps its own semantics (no button role).
     */
    render?: React.ReactElement;
  };

export function Button({ render, ...props }: ButtonProps) {
  if (render) return <ButtonElement render={render} {...props} />;
  return <ButtonRoot {...props} />;
}

function ButtonRoot({
  variant = "secondary",
  size = "md",
  leadingIcon,
  trailingIcon,
  loading = false,
  loadingText,
  disabled,
  className,
  children,
  ...rest
}: Omit<ButtonProps, "render">) {
  const shown = useBusyDisplay(loading);
  const busy = loading || shown;
  return (
    <BaseButton
      data-variant={variant}
      data-size={size}
      // Busy styling starts with the press; the spinner itself waits its 150ms.
      data-busy={busy ? "" : undefined}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      // Keep focus on the button while it works, so keyboard users aren't dropped to <body>.
      focusableWhenDisabled={busy && !disabled}
      className={cn(buttonVariants({ variant, size, leading: !!leadingIcon, trailing: !!trailingIcon }), className)}
      {...rest}
    >
      <Content size={size} leadingIcon={leadingIcon} trailingIcon={trailingIcon} busy={shown} loadingText={loadingText}>
        {children}
      </Content>
    </BaseButton>
  );
}

function ButtonElement({
  render,
  variant = "secondary",
  size = "md",
  leadingIcon,
  trailingIcon,
  className,
  children,
  // Loading and disabled don't apply to links: a link that can't be followed shouldn't be a link.
  loading: _loading,
  loadingText: _loadingText,
  disabled: _disabled,
  focusableWhenDisabled: _focusable,
  nativeButton: _native,
  ...rest
}: ButtonProps & { render: React.ReactElement }) {
  return useRender({
    render,
    props: mergeProps(
      {
        "data-variant": variant,
        "data-size": size,
        className: cn(buttonVariants({ variant, size, leading: !!leadingIcon, trailing: !!trailingIcon }), "cursor-pointer", className),
        children: (
          <Content size={size} leadingIcon={leadingIcon} trailingIcon={trailingIcon} busy={false}>
            {children}
          </Content>
        ),
      },
      rest as Record<string, unknown>,
    ),
  });
}

function Content({
  size,
  leadingIcon,
  trailingIcon,
  busy,
  loadingText,
  children,
}: Common & { size: ButtonSize; busy: boolean; loadingText?: string; children?: React.ReactNode }) {
  const reduce = useReducedMotion();
  const gap = sizes[size].gap;
  const t = { duration: reduce ? 0.15 : 0.22, ease: ease.out };
  // The idle row leaves upward while the busy row arrives from below, so it reads
  // as one thing replacing another, never as the button blinking.
  const away = reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" };
  const below = reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" };
  const here = { opacity: 1, y: 0, filter: "blur(0px)" };

  return (
    // In a group the whole button can't shrink without tearing the border, so its content squashes instead.
    <span className="grid place-items-center transition-[scale] duration-100 ease-out-quart in-data-[slot=button-group]:group-active/button:scale-[0.95]">
      {/* Holds room for the busy row, so the button is as wide as the longer of the two. */}
      <span aria-hidden className={cn("invisible col-start-1 row-start-1 inline-flex items-center", gap)}>
        <span className={size === "sm" ? "size-3.5" : "size-4"} />
        {loadingText}
      </span>
      <motion.span
        // With busy text showing, the idle label steps out of the accessible name too.
        aria-hidden={(busy && !!loadingText) || undefined}
        className={cn("col-start-1 row-start-1 inline-flex min-w-0 items-center", gap)}
        initial={false}
        animate={busy ? away : here}
        transition={t}
      >
        {leadingIcon && (
          <span aria-hidden className="inline-flex shrink-0">
            {leadingIcon}
          </span>
        )}
        <span>{children}</span>
        {trailingIcon && (
          <span aria-hidden className="inline-flex shrink-0">
            {trailingIcon}
          </span>
        )}
      </motion.span>
      <AnimatePresence initial={false}>
        {busy && (
          <motion.span
            key="busy"
            className={cn("col-start-1 row-start-1 inline-flex items-center", gap)}
            initial={below}
            animate={here}
            exit={{ ...below, transition: { duration: reduce ? 0.1 : 0.16, ease: ease.out } }}
            transition={t}
          >
            <Spinner />
            {loadingText && <span>{loadingText}</span>}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
