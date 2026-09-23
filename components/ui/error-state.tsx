"use client";
import { Button } from "@base-ui/react/button";
import { Collapsible } from "@base-ui/react/collapsible";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

type RetryStatus = "idle" | "pending";

export type ErrorStateProps = Omit<React.ComponentProps<"div">, "title"> & {
  /** What happened, in plain words: “Couldn’t load invoices”. */
  heading: React.ReactNode;
  /** Why, if it helps, and what to do. */
  description?: React.ReactNode;
  /** block fills a region; inline is one row inside a card or under a field. */
  variant?: "block" | "inline";
  /** danger for failures; warning for conditions that will pass, like being offline. */
  tone?: "danger" | "warning";
  /** Runs the request again. Return a promise: the button spins while it runs, and a rejection counts as another failed attempt. */
  onRetry?: () => unknown;
  retryLabel?: string;
  /** A short machine code shown in the details and the copied report, e.g. ERR_UPSTREAM_TIMEOUT. */
  code?: string;
  /** HTTP status, if there was one. */
  status?: number;
  /** A request or trace id support can look up. */
  requestId?: string;
  /** When it failed. Printed in UTC so server and client agree. */
  occurredAt?: number | Date;
  /** The raw message or stack excerpt, for the details panel. */
  details?: string;
  /** More actions beside Try again, e.g. a status page link. */
  children?: React.ReactNode;
};

const svg = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function ErrorState({
  heading,
  description,
  variant = "block",
  tone = "danger",
  onRetry,
  retryLabel = "Try again",
  code,
  status,
  requestId,
  occurredAt,
  details,
  children,
  className,
  ...rest
}: ErrorStateProps) {
  const reduce = useReducedMotion();
  const [retry, setRetry] = useState<RetryStatus>("idle");
  const [spinning, setSpinning] = useState(false);
  // Every failed retry counts. Without it a failed retry looks exactly like nothing happened.
  const [attempts, setAttempts] = useState(1);
  const [announce, setAnnounce] = useState("");
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = async () => {
    if (!onRetry || busy.current) return;
    busy.current = true;
    setRetry("pending");
    setAnnounce("Trying again…");
    let shownAt = 0;
    const reveal = window.setTimeout(() => {
      shownAt = performance.now();
      setSpinning(true);
    }, 150);
    let ok = true;
    try {
      await onRetry();
    } catch {
      ok = false;
    }
    window.clearTimeout(reveal);
    if (shownAt) {
      const rest = 450 - (performance.now() - shownAt);
      if (rest > 0) await new Promise((r) => window.setTimeout(r, rest));
    }
    busy.current = false;
    if (!alive.current) return;
    setSpinning(false);
    setRetry("idle");
    if (!ok) {
      setAttempts((a) => a + 1);
      setAnnounce(`Still failing after ${attempts + 1} attempts`);
    } else setAnnounce("");
  };

  const when = occurredAt == null ? undefined : new Date(occurredAt).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const rows = [
    ["Code", code],
    ["Status", status != null ? String(status) : undefined],
    ["Request", requestId],
    ["Time", when],
  ].filter((r): r is [string, string] => !!r[1]);
  const report = [...rows.map(([k, v]) => `${k}: ${v}`), details ? `\n${details}` : ""].join("\n").trim();
  const hasDetails = rows.length > 0 || !!details;
  const pending = retry === "pending";

  const retryButton = onRetry && (
    <Button
      onClick={run}
      disabled={pending}
      focusableWhenDisabled
      aria-busy={pending || undefined}
      className={cn(
        "group/retry relative inline-flex shrink-0 select-none items-center justify-center font-medium",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color,border-color,color,scale] duration-150 ease-out active:duration-75",
        variant === "inline"
          ? "h-7 gap-1.5 rounded-md px-2 text-[12px] text-fg hover:bg-hover"
          : "h-8 gap-2 rounded-lg border border-line-2 bg-raised px-3 text-[12.5px] text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover",
        pending ? "cursor-default" : "active:scale-[0.97]",
        // Icon-sized on screen, finger-sized on touch.
        variant === "inline" && "before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] pointer-fine:before:hidden",
      )}
    >
      <span className="relative grid size-3.5 place-items-center">
        <AnimatePresence initial={false}>
          <motion.span
            key={spinning ? "spin" : "idle"}
            className="absolute inset-0 grid place-items-center"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.1 } }}
            transition={reduce ? { duration: 0.12, scale: { duration: 0 } } : spring.pop}
          >
            {spinning ? (
              <svg {...svg} className="size-3.5 animate-spin [animation-duration:0.8s]">
                <circle cx="8" cy="8" r="5.75" opacity="0.22" />
                <path d="M8 2.25a5.75 5.75 0 0 1 5.75 5.75" />
              </svg>
            ) : (
              // Winds back as the pointer arrives: “again”, before the label is read.
              <svg {...svg} className="size-3.5 transition-transform duration-300 ease-out group-hover/retry:-rotate-[60deg]">
                <path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.75V5h-2.25" />
              </svg>
            )}
          </motion.span>
        </AnimatePresence>
      </span>
      {retryLabel}
    </Button>
  );

  const toneText = tone === "warning" ? "text-warning" : "text-danger";

  if (variant === "inline")
    return (
      <div data-variant="inline" data-tone={tone} className={cn("flex min-h-8 min-w-0 items-center gap-2", className)} {...rest}>
        <span className={cn("grid size-4 shrink-0 place-items-center", toneText)}>
          <Glyph tone={tone} small attempt={attempts} reduce={!!reduce} />
        </span>
        <p role="alert" className="min-w-0 flex-1 text-[12.5px] leading-[18px] text-fg-2">
          <span className="text-fg">{heading}</span>
          {description != null && <span className="text-fg-3"> {description}</span>}
          {attempts > 1 && <Attempts n={attempts} />}
        </p>
        {retryButton}
        {children}
        <span role="status" aria-live="polite" className="sr-only">
          {announce}
        </span>
      </div>
    );

  return (
    // A container query, not a viewport one: in a narrow slot the tile stacks above the words so the details get the full width.
    <div data-variant="block" data-tone={tone} className={cn("@container min-w-0", className)} {...rest}>
      <div className="flex flex-col gap-3 @sm:flex-row @sm:gap-3.5">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg border",
            tone === "warning" ? "border-warning/25 bg-warning-soft text-warning" : "border-danger/25 bg-danger-soft text-danger",
          )}
        >
          <Glyph tone={tone} attempt={attempts} reduce={!!reduce} />
        </span>

        <div className="flex min-w-0 flex-1 flex-col">
          <div role="alert">
            <p className="text-balance @sm:pt-[5px] text-[14px] font-medium leading-[20px] tracking-[-0.012em] text-fg">{heading}</p>
            {description != null && <p className="mt-1 text-pretty text-[12.5px] leading-[19px] text-fg-2">{description}</p>}
          </div>
          {/* Grows open on the first repeat failure rather than shoving the actions down in one frame. */}
          <AnimatePresence initial={false}>
            {attempts > 1 && (
              <motion.p
                key="attempts"
                className="overflow-hidden text-[12px] text-fg-3"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                transition={reduce ? { duration: 0.15, height: { duration: 0 } } : { duration: 0.26, ease: ease.out }}
              >
                <span className="block pt-1.5">
                  <Attempts n={attempts} block />
                </span>
              </motion.p>
            )}
          </AnimatePresence>

          {(retryButton || children) && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              {retryButton}
              {children}
            </div>
          )}

          {hasDetails && (
            <Collapsible.Root className="mt-4 border-t border-line pt-2">
              <Collapsible.Trigger
                className={cn(
                  "group/details -mx-1.5 inline-flex h-7 max-w-[calc(100%+12px)] select-none items-center gap-1 rounded-md px-1.5 text-[12px] font-medium text-fg-3",
                  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                  "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg-2 active:scale-[0.98] data-panel-open:text-fg-2",
                )}
              >
                <svg
                  {...svg}
                  className="size-3.5 transition-transform duration-200 ease-in-out-quart group-data-panel-open/details:rotate-90 motion-reduce:transition-none"
                >
                  <path d="m6.25 4.5 3.5 3.5-3.5 3.5" />
                </svg>
                <span className="shrink-0 whitespace-nowrap">Technical details</span>
                {code && <span className="ml-1 min-w-0 truncate font-mono text-[11px] font-normal text-fg-4">{code}</span>}
              </Collapsible.Trigger>
              <Collapsible.Panel
                className={cn(
                  "h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-250 ease-in-out-quart",
                  "data-starting-style:h-0 data-starting-style:opacity-0 data-ending-style:h-0 data-ending-style:opacity-0 data-ending-style:duration-180",
                  "[&[hidden]:not([hidden='until-found'])]:hidden",
                )}
              >
                <div className="relative mt-2 rounded-lg border border-line bg-frame">
                  <div className="absolute right-1 top-1">
                    <CopyButton value={report} iconOnly variant="ghost" size="sm" label="Copy error details" copiedLabel="Copied error details" />
                  </div>
                  {rows.length > 0 && (
                    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 px-3 py-2.5 pr-10 font-mono text-[11.5px] leading-[17px]">
                      {rows.map(([k, v]) => (
                        <div key={k} className="contents">
                          <dt className="text-fg-4">{k}</dt>
                          <dd className="min-w-0 text-fg-2 [overflow-wrap:anywhere]">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {details && (
                    <pre
                      className={cn(
                        "max-h-32 overflow-auto whitespace-pre-wrap break-words px-3 pb-2.5 font-mono text-[11px] leading-[16px] text-fg-3",
                        rows.length ? "border-t border-line pt-2.5" : "pt-2.5 pr-10",
                      )}
                    >
                      {details}
                    </pre>
                  )}
                </div>
              </Collapsible.Panel>
            </Collapsible.Root>
          )}
        </div>
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

// “Attempt 3 failed”: the number rolls so a second failure is visibly different from the first.
function Attempts({ n, block }: { n: number; block?: boolean }) {
  return (
    <span className={cn("tabular", block ? "" : "ml-1.5 text-fg-4")}>
      {block ? "Still failing · attempt " : "· attempt "}
      <NumberFlow value={n} />
    </span>
  );
}

// The mark redraws each time an attempt fails: the same answer, visibly given again.
function Glyph({ tone, small, attempt, reduce }: { tone: "danger" | "warning"; small?: boolean; attempt: number; reduce: boolean }) {
  const draw = {
    initial: { pathLength: 0 },
    animate: { pathLength: 1 },
    transition: reduce ? { duration: 0 } : { duration: 0.34, ease: ease.out, delay: 0.05 },
  };
  return (
    <motion.svg
      key={attempt}
      {...svg}
      className={small ? "size-3.5" : "size-4"}
      initial={{ scale: attempt > 1 && !reduce ? 0.7 : 1 }}
      animate={{ scale: 1 }}
      transition={spring.pop}
    >
      {tone === "warning" ? (
        <>
          <path d="M7.1 2.9a1 1 0 0 1 1.8 0l5 9.1a1 1 0 0 1-.9 1.5H3a1 1 0 0 1-.9-1.5z" />
          <motion.path d="M8 6.25v3" {...(attempt > 1 ? draw : {})} />
          <circle cx="8" cy="11.1" r=".6" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="5.75" />
          <motion.path d="M8 5v3.5" {...(attempt > 1 ? draw : {})} />
          <circle cx="8" cy="10.9" r=".6" fill="currentColor" stroke="none" />
        </>
      )}
    </motion.svg>
  );
}
