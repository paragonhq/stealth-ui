"use client";
import { cloneElement, createContext, isValidElement, use, useRef } from "react";
import { cn } from "@/lib/cn";

const CardContext = createContext<{ disabled: boolean }>({ disabled: false });

export type InteractiveCardProps = React.ComponentProps<"div"> & {
  /** A faint light that follows the mouse across the surface. Mouse only; off under reduced motion. */
  glow?: boolean;
  /** Dims the card and takes its link out of the tab order. Nested actions keep their own state. */
  disabled?: boolean;
};

/**
 * A card whose whole surface is one link. The link's ::after stretches over the
 * card, so the target is the card while the name is still the link's only text;
 * nested controls sit above that layer in InteractiveCardAction.
 */
export function InteractiveCard({ glow = false, disabled = false, className, children, onPointerMove, onPointerLeave, ...rest }: InteractiveCardProps) {
  const frame = useRef(0);

  return (
    <CardContext value={{ disabled }}>
      <div
        data-disabled={disabled || undefined}
        data-glow={glow || undefined}
        onPointerMove={(e) => {
          onPointerMove?.(e);
          if (!glow || e.pointerType !== "mouse") return;
          const el = e.currentTarget;
          const { clientX, clientY } = e;
          // Written straight to CSS variables, once per frame, so following the mouse never re-renders.
          cancelAnimationFrame(frame.current);
          frame.current = requestAnimationFrame(() => {
            const r = el.getBoundingClientRect();
            el.style.setProperty("--glow-x", `${clientX - r.left}px`);
            el.style.setProperty("--glow-y", `${clientY - r.top}px`);
          });
        }}
        onPointerLeave={(e) => {
          onPointerLeave?.(e);
          cancelAnimationFrame(frame.current);
        }}
        className={cn(
          "group/card relative isolate flex min-w-0 flex-col rounded-xl border border-line-2 bg-raised shadow-[var(--shadow)]",
          "transition-[border-color,background-color,scale] duration-150 ease-out",
          "hover:border-fg-4 data-disabled:hover:border-line-2",
          // Press feedback belongs to the link only; pressing a nested action leaves the card still.
          "has-[[data-card-link]:active]:scale-[0.985] has-[[data-card-link]:active]:duration-100 motion-reduce:has-[[data-card-link]:active]:scale-100",
          // The ring draws around the card, because the card is what the link opens.
          "has-[[data-card-link]:focus-visible]:outline-solid has-[[data-card-link]:focus-visible]:outline-1 has-[[data-card-link]:focus-visible]:outline-offset-2 has-[[data-card-link]:focus-visible]:outline-fg-3",
          "data-disabled:opacity-60",
          glow &&
            cn(
              "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:opacity-0 before:content-['']",
              "before:bg-[radial-gradient(260px_circle_at_var(--glow-x,50%)_var(--glow-y,0px),color-mix(in_oklab,var(--fg)_6%,transparent),transparent_70%)]",
              "before:transition-opacity before:duration-300 hover:before:opacity-100 data-disabled:before:hidden motion-reduce:before:hidden",
            ),
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    </CardContext>
  );
}

export type InteractiveCardLinkProps = React.ComponentProps<"a"> & {
  /** Render your router's link instead of an <a>: `render={<Link href="/projects/web" />}`. */
  render?: React.ReactElement<{ className?: string; children?: React.ReactNode }>;
};

/** The card's one destination. Put the card's name in it, nothing else. */
export function InteractiveCardLink({ render, className, children, onClick, ...rest }: InteractiveCardLinkProps) {
  const { disabled } = use(CardContext);
  const classes = cn(
    "rounded-sm text-fg outline-none",
    // The stretched hit area, with the card's radius so the corners press as they look.
    "after:absolute after:inset-0 after:z-0 after:rounded-xl after:content-['']",
    "[-webkit-tap-highlight-color:transparent] touch-manipulation",
    disabled ? "cursor-not-allowed after:cursor-not-allowed" : "cursor-pointer",
    className,
  );
  const shared = {
    "data-card-link": "",
    "aria-disabled": disabled || undefined,
    tabIndex: disabled ? -1 : undefined,
    onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (disabled) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    },
  };

  if (render && isValidElement(render)) {
    return cloneElement(render, { ...rest, ...shared, className: cn(classes, render.props.className), children } as React.HTMLAttributes<HTMLElement>);
  }
  return (
    <a className={classes} {...rest} {...shared}>
      {children}
    </a>
  );
}

export type InteractiveCardActionProps = React.ComponentProps<"div">;

/** Lifts buttons, menus and secondary links above the card's link so they get their own clicks. */
export function InteractiveCardAction({ className, ...rest }: InteractiveCardActionProps) {
  return <div className={cn("relative z-10 flex items-center", className)} {...rest} />;
}

export type InteractiveCardArrowProps = React.ComponentProps<"svg"> & {
  /** Points right for a page in this app, up-right for somewhere else. */
  external?: boolean;
};

/** A quiet arrow that leans toward the destination while the card is hovered. */
export function InteractiveCardArrow({ external = false, className, ...rest }: InteractiveCardArrowProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn(
        "shrink-0 text-fg-4 transition-[translate,color] duration-200 ease-out-quart group-hover/card:text-fg-2 motion-reduce:transition-colors",
        external ? "group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5" : "group-hover/card:translate-x-0.5",
        "group-data-disabled/card:translate-0! group-data-disabled/card:text-fg-4!",
        className,
      )}
      {...rest}
    >
      {external ? <path d="M5 11 11 5M6 5h5v5" /> : <path d="M3 8h10M9 4l4 4-4 4" />}
    </svg>
  );
}
