"use client";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

export type EmptyStateVariant = "default" | "first-use" | "no-results" | "inbox-zero";

export type EmptyStateProps = Omit<React.ComponentProps<"div">, "title"> & {
  /**
   * default: something could be here. first-use: nothing has been made yet (dashed edge, a place to fill).
   * no-results: a search or filter came back empty. inbox-zero: everything is done, and that is good news.
   */
  variant?: EmptyStateVariant;
  /** One line saying what would be here: “No projects yet”. */
  heading: React.ReactNode;
  /** One short line on why it matters or how it fills. */
  description?: React.ReactNode;
  /** Replaces the variant's drawn icon. 20px, currentColor. Pass null for none. */
  icon?: React.ReactNode;
  /** The action that fills it, usually one primary button, optionally a quieter second. */
  children?: React.ReactNode;
  /** sm sits inside a table, menu or popover; md fills a region. */
  size?: "sm" | "md";
  headingLevel?: 2 | 3 | 4;
};

export function EmptyState({
  variant = "default",
  heading,
  description,
  icon,
  children,
  size = "md",
  headingLevel = 3,
  className,
  ...rest
}: EmptyStateProps) {
  const reduce = useReducedMotion();
  const H = `h${headingLevel}` as const;
  const sm = size === "sm";

  // A quiet arrival: the tile settles first, then the words, then the action.
  // Only on mount; it never replays on re-render or filter change. The starting
  // pose is the same with reduced motion (so server and client HTML match); only
  // the opacity is animated then, and the travel and blur resolve at once.
  const still = { y: { duration: 0 }, scale: { duration: 0 }, filter: { duration: 0 } };
  const rise = (i: number) => ({
    initial: { opacity: 0, y: 6, filter: "blur(2px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: reduce ? { duration: 0.2, delay: i * 0.03, ...still } : { duration: 0.42, ease: ease.out, delay: 0.06 + i * 0.05 },
  });

  return (
    <div
      role="status"
      data-variant={variant}
      data-size={size}
      className={cn(
        "flex w-full flex-col items-center justify-center text-center",
        sm ? "gap-3 px-4 py-6" : "gap-4 px-6 py-10",
        variant === "first-use" && "rounded-xl border border-dashed border-line-2",
        className,
      )}
      {...rest}
    >
      {icon !== null && (
        <motion.div
          aria-hidden
          initial={{ opacity: 0, y: 6, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={reduce ? { duration: 0.2, ...still } : { duration: 0.46, ease: ease.out }}
          className={cn(
            "relative grid shrink-0 place-items-center border bg-raised shadow-[var(--shadow)]",
            sm ? "size-8 rounded-lg [&_svg]:size-4" : "size-10 rounded-xl [&_svg]:size-5",
            variant === "inbox-zero" ? "border-success/25 text-success" : "border-line-2 text-fg-2",
          )}
        >
          {icon ?? <Glyph variant={variant} reduce={!!reduce} />}
        </motion.div>
      )}

      <div className={cn("flex max-w-[34ch] flex-col", sm ? "gap-0.5" : "gap-1")}>
        <motion.div {...rise(1)}>
          <H className={cn("text-balance font-medium text-fg", sm ? "text-[13px] tracking-[-0.006em]" : "text-[14.5px] tracking-[-0.015em]")}>{heading}</H>
        </motion.div>
        {description != null && (
          <motion.p {...rise(2)} className={cn("text-pretty text-fg-3", sm ? "text-[12px] leading-[17px]" : "text-[12.5px] leading-[19px]")}>
            {description}
          </motion.p>
        )}
      </div>

      {children != null && (
        <motion.div {...rise(3)} className={cn("flex flex-wrap items-center justify-center gap-2", !sm && "pt-1")}>
          {children}
        </motion.div>
      )}
    </div>
  );
}

// Each variant's icon draws itself in as the tile lands: stroke first, detail last.
function Glyph({ variant, reduce }: { variant: EmptyStateVariant; reduce: boolean }) {
  // Same starting pose either way so the server HTML matches; reduced motion just skips to the end.
  const draw = (delay: number, duration = 0.4) => ({
    initial: { pathLength: 0 },
    animate: { pathLength: 1 },
    transition: reduce ? { duration: 0 } : { duration, ease: ease.out, delay },
  });
  const props = { width: 20, height: 20, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.25, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  if (variant === "first-use")
    return (
      <svg {...props}>
        <motion.rect x="2.75" y="2.75" width="10.5" height="10.5" rx="2.25" {...draw(0.12, 0.5)} />
        <motion.path d="M8 5.5v5M5.5 8h5" {...draw(0.4, 0.26)} />
      </svg>
    );
  if (variant === "no-results")
    return (
      <svg {...props}>
        <motion.circle cx="7" cy="7" r="4.25" {...draw(0.12, 0.5)} />
        <motion.path d="m10.25 10.25 3 3" {...draw(0.46, 0.2)} />
        <motion.path d="M5.6 7h2.8" {...draw(0.58, 0.18)} />
      </svg>
    );
  if (variant === "inbox-zero")
    return (
      <svg {...props}>
        <motion.circle cx="8" cy="8" r="5.75" {...draw(0.1, 0.5)} />
        <motion.path d="m5.5 8.25 1.75 1.75 3.25-3.75" {...draw(0.42, 0.32)} />
      </svg>
    );
  return (
    <svg {...props}>
      <motion.path d="M2.5 9.5 4 3.75h8L13.5 9.5v3a.75.75 0 0 1-.75.75H3.25a.75.75 0 0 1-.75-.75z" {...draw(0.12, 0.55)} />
      <motion.path d="M2.5 9.5h3l.75 1.5h3.5l.75-1.5h3" {...draw(0.42, 0.3)} />
    </svg>
  );
}
