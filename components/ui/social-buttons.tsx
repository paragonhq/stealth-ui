"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Alert } from "@/lib/icons";
import { ease, spring, swap } from "@/lib/motion";

export type SocialProvider = "google" | "github" | "apple" | "microsoft" | "sso";

const names: Record<SocialProvider, string> = {
  google: "Google",
  github: "GitHub",
  apple: "Apple",
  microsoft: "Microsoft",
  sso: "SSO",
};

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : typeof error === "string" && error ? error : fallback;

/**
 * Provider marks, one color, drawn to sit at 16px beside text. Brand glyphs are
 * filled on a 24-unit box; SSO is a stroked key on the Stealth 16px grid.
 */
export function ProviderGlyph({ provider, size = 16, className }: { provider: SocialProvider; size?: number; className?: string }) {
  const common = { width: size, height: size, "aria-hidden": true, focusable: false, className } as const;
  switch (provider) {
    case "google":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
        </svg>
      );
    case "github":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
      );
    case "apple":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
        </svg>
      );
    case "microsoft":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="currentColor">
          <path d="M1.5 1.5h10v10h-10zM12.5 1.5h10v10h-10zM1.5 12.5h10v10h-10zM12.5 12.5h10v10h-10z" />
        </svg>
      );
    case "sso":
      return (
        <svg {...common} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5.5" cy="10.5" r="2.75" />
          <path d="m7.5 8.5 5.75-5.75M11 5l1.75 1.75M9.5 6.5l1.25 1.25" />
        </svg>
      );
  }
}

export type SocialButtonProps = Omit<React.ComponentProps<"button">, "children"> & {
  provider: SocialProvider;
  /** Overrides the default "Continue with Google". */
  label?: React.ReactNode;
  loading?: boolean;
  /** Marks the provider this person signed in with last time. */
  lastUsed?: boolean;
  lastUsedLabel?: string;
  /** Give buttons in a group the same id and the badge glides to whichever one becomes last used. */
  lastUsedLayoutId?: string;
  /** Hide the label when the surrounding `@container/social` is narrower than 20rem. Name it with aria-label. */
  compact?: boolean;
  size?: "md" | "lg";
};

/** One provider button. The glyph slot turns into a spinner while loading, so nothing around it moves. */
export function SocialButton({
  provider,
  label,
  loading = false,
  lastUsed = false,
  lastUsedLabel = "Last used",
  lastUsedLayoutId,
  compact = false,
  size = "lg",
  disabled,
  className,
  onClick,
  ...rest
}: SocialButtonProps) {
  const reduce = useReducedMotion();
  const text = label ?? `Continue with ${names[provider]}`;
  return (
    <button
      type="button"
      data-provider={provider}
      data-state={loading ? "loading" : "idle"}
      data-size={size}
      data-last-used={lastUsed ? "" : undefined}
      aria-busy={loading || undefined}
      aria-disabled={disabled || loading || undefined}
      onClick={(e) => {
        // Busy and disabled buttons stay focusable (so focus isn't dropped mid-redirect) but inert to presses.
        if (disabled || loading) return e.preventDefault();
        onClick?.(e);
      }}
      className={cn(
        "group/social relative inline-flex w-full min-w-0 select-none items-center justify-center gap-2 rounded-lg border border-line-2 bg-raised px-3 font-medium tracking-[-0.005em] text-fg shadow-[var(--shadow)] outline-none",
        "transition-[background-color,border-color,opacity,scale] duration-150 ease-out",
        "hover:border-fg-4 hover:bg-hover active:scale-[0.98] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "data-[state=loading]:cursor-default data-[state=loading]:bg-hover data-[state=loading]:active:scale-100",
        "aria-disabled:not-data-[state=loading]:pointer-events-none aria-disabled:not-data-[state=loading]:opacity-50",
        size === "lg" ? "h-9 text-[13px] pointer-coarse:h-11" : "h-8 text-[12.5px] pointer-coarse:h-10",
        className,
      )}
      {...rest}
    >
      <span className="relative grid size-4 shrink-0 place-items-center">
        <AnimatePresence initial={false}>
          <motion.span
            key={loading ? "spin" : "glyph"}
            className="absolute inset-0 grid place-items-center"
            initial={reduce ? { opacity: 0 } : swap.initial}
            animate={swap.animate}
            exit={reduce ? { opacity: 0 } : swap.exit}
            transition={reduce ? { duration: 0.12 } : spring.pop}
          >
            {loading ? <Spinner /> : <ProviderGlyph provider={provider} size={provider === "sso" ? 16 : 15} />}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className={cn("min-w-0 truncate", compact && "hidden @[20rem]/social:inline")}>{text}</span>
      {lastUsed && <span className="sr-only">{` (${lastUsedLabel.toLowerCase()})`}</span>}
      <AnimatePresence initial={false}>
        {lastUsed && (
          <motion.span
            aria-hidden
            layoutId={lastUsedLayoutId}
            // Sits on the top edge like a tab, so it never crowds a centered label.
            className="pointer-events-none absolute -top-1.5 right-2.5 inline-flex h-4 origin-bottom-right items-center rounded-full border border-line-2 bg-raised px-1.5 text-[10px] font-medium leading-none tracking-[0.01em] text-fg-2"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 3 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, transition: { duration: 0.1 } }}
            transition={reduce ? { duration: 0.15, layout: { duration: 0 } } : { ...spring.pop, layout: spring.soft }}
          >
            {lastUsedLabel}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

export type SocialButtonsProps = Omit<React.ComponentProps<"div">, "children" | "onError"> & {
  providers?: SocialProvider[];
  /** Start sign-in with a provider. While the promise is pending that button spins and the others step back. */
  onSignIn?: (provider: SocialProvider) => Promise<unknown> | unknown;
  /** Controlled loading provider, for redirects you track yourself. */
  loading?: SocialProvider | null;
  onLoadingChange?: (provider: SocialProvider | null) => void;
  lastUsed?: SocialProvider | null;
  lastUsedLabel?: string;
  /** "list" stacks full-width "Continue with …" buttons; "grid" puts short names side by side. */
  layout?: "list" | "grid";
  size?: "md" | "lg";
  disabled?: boolean;
  onError?: (provider: SocialProvider, error: unknown) => void;
};

export function SocialButtons({
  providers = ["google", "github", "apple"],
  onSignIn,
  loading: loadingProp,
  onLoadingChange,
  lastUsed = null,
  lastUsedLabel = "Last used",
  layout = "list",
  size = "lg",
  disabled = false,
  onError,
  className,
  ...rest
}: SocialButtonsProps) {
  const reduce = useReducedMotion();
  // Set from inside an await, so it can't compare against a value captured before the await.
  const [innerLoading, setInnerLoading] = useState<SocialProvider | null>(null);
  const loading = loadingProp !== undefined ? loadingProp : innerLoading;
  const setLoading = (next: SocialProvider | null) => {
    setInnerLoading(next);
    onLoadingChange?.(next);
  };
  const [error, setError] = useState<{ provider: SocialProvider; message: string } | null>(null);
  const [announce, setAnnounce] = useState("");
  const ticket = useRef(0);
  const badgeId = useId();

  async function start(provider: SocialProvider) {
    if (loading || disabled) return;
    const mine = ++ticket.current;
    setError(null);
    setLoading(provider);
    setAnnounce(`Connecting to ${names[provider]}…`);
    try {
      await onSignIn?.(provider);
    } catch (err) {
      if (mine !== ticket.current) return;
      const message = messageOf(err, `Couldn’t connect to ${names[provider]}. Try again.`);
      setError({ provider, message });
      setAnnounce("");
      onError?.(provider, err);
    } finally {
      // A resolved promise usually means the page is navigating away; clear anyway in case it isn't.
      if (mine === ticket.current) setLoading(null);
    }
  }

  return (
    <div data-layout={layout} className={cn("flex w-full flex-col gap-2", className)} {...rest}>
      <div
        role="group"
        aria-label="Sign in with"
        // In a narrow grid the names drop out and the marks carry it; each button keeps its full accessible name.
        className={cn(layout === "grid" ? "@container/social grid gap-2" : "flex flex-col gap-2")}
        style={layout === "grid" ? { gridTemplateColumns: `repeat(${Math.min(providers.length, 3)}, minmax(0, 1fr))` } : undefined}
      >
        {providers.map((p) => (
          <SocialButton
            key={p}
            provider={p}
            size={size}
            label={layout === "grid" ? names[p] : undefined}
            compact={layout === "grid"}
            aria-label={layout === "grid" ? `Continue with ${names[p]}${lastUsed === p ? ` (${lastUsedLabel.toLowerCase()})` : ""}` : undefined}
            loading={loading === p}
            disabled={disabled || (!!loading && loading !== p)}
            lastUsed={lastUsed === p}
            lastUsedLabel={lastUsedLabel}
            lastUsedLayoutId={`${badgeId}-last`}
            onClick={() => start(p)}
          />
        ))}
      </div>
      <AnimatePresence initial={false}>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0, transition: { duration: reduce ? 0.1 : 0.16, ease: ease.in } }}
            transition={reduce ? { duration: 0.12, height: { duration: 0 } } : { duration: 0.22, ease: ease.out }}
            className="overflow-hidden"
          >
            <p role="alert" className="flex items-start gap-1.5 pt-0.5 text-[12px] leading-4 text-danger">
              <Alert size={14} className="mt-px shrink-0" />
              <span className="min-w-0 text-pretty">{error.message}</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="animate-spin [animation-duration:0.7s] motion-reduce:[animation-duration:1.6s]!">
      <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
      <path d="M13.75 8A5.75 5.75 0 0 0 8 2.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
