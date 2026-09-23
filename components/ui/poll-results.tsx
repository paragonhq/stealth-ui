"use client";
import NumberFlow from "@number-flow/react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

const noop = () => () => {};
function useLocale(locale?: string) {
  const detected = useSyncExternalStore(
    noop,
    () => Intl.NumberFormat().resolvedOptions().locale,
    () => "en-US",
  );
  return locale ?? detected;
}

export type PollOption = { id: string; label: string; votes: number };

/** Whole percentages that always add up to 100 (largest remainder), so 33 + 33 + 33 never shows. */
export function pollPercents(votes: number[]) {
  const total = votes.reduce((a, b) => a + b, 0);
  if (!total) return votes.map(() => 0);
  const raw = votes.map((v) => (v / total) * 100);
  const floor = raw.map(Math.floor);
  let left = 100 - floor.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - floor[i], i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left-- <= 0) break;
    floor[i] += 1;
  }
  return floor;
}

const expo = `cubic-bezier(${ease.out.join(",")})`;
const timing = {
  transformTiming: { duration: 700, easing: expo },
  spinTiming: { duration: 700, easing: expo },
  opacityTiming: { duration: 200, easing: "ease-out" },
};

export type PollResultsProps = Omit<React.ComponentProps<"section">, "children" | "defaultValue"> & {
  question: string;
  /** Vote counts from the server. If value is set on first render, its count is assumed to include that vote. */
  options: PollOption[];
  /** The viewer's vote: an option id, or null before voting. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  /** Persist the vote (null when withdrawn). Return a promise to get optimistic UI that reverts if it rejects. */
  onVote?: (value: string | null) => void | Promise<unknown>;
  /** Voting has ended: results only, the winner marked final. */
  closed?: boolean;
  /** Let people take their vote back and pick again. */
  allowChange?: boolean;
  /** Quiet line after the total: "2 days left", "Closed Sep 12". */
  meta?: React.ReactNode;
  locale?: string;
};

export function PollResults({
  question,
  options,
  value: valueProp,
  defaultValue = null,
  onValueChange,
  onVote,
  closed = false,
  allowChange = true,
  meta,
  locale: localeProp,
  className,
  ...rest
}: PollResultsProps) {
  const locale = useLocale(localeProp);
  const reduce = useReducedMotion();
  const titleId = useId();
  const [vote, setVote] = useControllableState<string | null>({ value: valueProp, defaultValue, onChange: onValueChange });
  // The vote the server already counted. Local changes add or remove one on top of it.
  const [counted] = useState(() => (valueProp !== undefined ? valueProp : defaultValue));
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const list = useRef<HTMLUListElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<"results" | "options" | null>(null);
  const firstOption = useRef<HTMLButtonElement>(null);
  // A failed request settles after later renders; it must revert through the newest setter, not the one it closed over.
  const latestSet = useRef(setVote);
  useEffect(() => {
    latestSet.current = setVote;
  });

  const showResults = closed || vote != null;
  const votes = options.map((o) => Math.max(0, o.votes + (o.id === vote ? 1 : 0) - (o.id === counted ? 1 : 0)));
  const total = votes.reduce((a, b) => a + b, 0);
  const pct = pollPercents(votes);
  const top = Math.max(...votes);
  const winners = new Set(top > 0 ? options.filter((_, i) => votes[i] === top).map((o) => o.id) : []);
  const tied = winners.size > 1;
  const fmt = new Intl.NumberFormat(locale);

  // Move focus to where the next action is once the view has swapped, so it isn't lost with the pressed button.
  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === "results") (changeButton.current ?? list.current)?.focus();
    else if (target === "options") firstOption.current?.focus();
  }, [showResults]);

  const commit = (next: string | null) => {
    const prev = vote;
    setVote(next);
    setError(null);
    focusNext.current = next ? "results" : "options";
    if (next) {
      const i = options.findIndex((o) => o.id === next);
      const after = options.map((o, j) => votes[j] + (o.id === next ? 1 : 0) - (o.id === prev ? 1 : 0));
      const p = pollPercents(after)[i];
      setAnnouncement(`Vote recorded for ${options[i].label}, ${p}%.`);
    } else setAnnouncement("Vote removed. Choose an option.");
    const result = onVote?.(next);
    if (result && typeof (result as Promise<unknown>).then === "function") {
      (result as Promise<unknown>).catch(() => {
        focusNext.current = prev ? "results" : "options";
        latestSet.current(prev);
        setError(next ? "Couldn’t record your vote. Try again." : "Couldn’t remove your vote. Try again.");
        setAnnouncement("");
      });
    }
  };

  return (
    <section
      aria-labelledby={titleId}
      data-state={closed ? "closed" : showResults ? "voted" : "open"}
      className={cn("flex w-full min-w-0 flex-col gap-3", className)}
      {...rest}
    >
      <h3 id={titleId} className="text-[14px] font-medium leading-snug tracking-[-0.015em] text-balance text-fg">
        {question}
      </h3>

      <ul
        ref={list}
        tabIndex={-1}
        aria-label={showResults ? "Results" : "Options"}
        className="flex flex-col gap-1.5 rounded-lg outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-fg-3"
      >
        {options.map((o, i) => {
          const mine = o.id === vote;
          const lead = showResults && winners.has(o.id);
          return (
            <li
              key={o.id}
              data-winner={lead || undefined}
              data-selected={mine || undefined}
              className={cn(
                "relative min-h-10 overflow-hidden rounded-lg border transition-[border-color,background-color] duration-300",
                showResults ? "border-transparent bg-fg/[0.03]" : "border-line-2 bg-raised",
              )}
            >
              {/* One bar per row that lives through both states: it grows on vote and drains on change. */}
              <motion.span
                aria-hidden
                initial={{ width: "0%" }}
                animate={{ width: showResults ? `${pct[i]}%` : "0%" }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : showResults
                      ? { duration: 0.7, ease: ease.out, delay: Math.min(i, 6) * 0.04 }
                      : { duration: 0.25, ease: ease.inOut }
                }
                className={cn(
                  "absolute inset-y-0 left-0 transition-colors duration-300",
                  lead ? "bg-fg/[0.16]" : "bg-fg/[0.07]",
                )}
              />
              {/* The results layer is always mounted, so its numbers roll up from 0 the moment a vote lands. */}
              <div
                aria-hidden={!showResults}
                className={cn("relative flex min-h-10 items-center gap-2 px-3 py-2", !showResults && "invisible")}
              >
                <span className={cn("min-w-0 flex-1 text-[13px] transition-colors duration-300", lead ? "font-medium text-fg" : mine || !showResults ? "text-fg" : "text-fg-2")}>
                  <span className="break-words">{o.label}</span>
                  {mine && <Tick reduce={!!reduce} />}
                </span>
                <span aria-hidden className="shrink-0 text-[12px] text-fg-3 tabular">
                  <span className="inline-flex h-[1lh] items-center">
                    <NumberFlow value={showResults ? votes[i] : 0} locales={locale} animated={!reduce} {...timing} />
                  </span>
                </span>
                <span aria-hidden className={cn("inline-flex h-[1lh] w-10 shrink-0 items-center justify-end text-[13px] tabular", lead ? "font-medium text-fg" : "text-fg-2")}>
                  <NumberFlow value={showResults ? pct[i] : 0} suffix="%" locales={locale} animated={!reduce} {...timing} />
                </span>
                <span className="sr-only">
                  {`, ${pct[i]}%, ${fmt.format(votes[i])} ${votes[i] === 1 ? "vote" : "votes"}${mine ? ", your vote" : ""}${lead ? (tied ? ", tied for first" : closed ? ", winner" : ", leading") : ""}`}
                </span>
              </div>
              {!showResults && (
                <button
                  ref={i === 0 ? firstOption : undefined}
                  type="button"
                  onClick={() => commit(o.id)}
                  className={cn(
                    "group/opt absolute inset-0 flex w-full items-center gap-2 rounded-[7px] px-3 py-2 text-left outline-none",
                    "transition-[background-color,scale] duration-150 hover:bg-hover active:scale-[0.985]",
                    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
                  )}
                >
                  <span className="min-w-0 flex-1 break-words text-[13px] text-fg">{o.label}</span>
                  <span
                    aria-hidden
                    className="size-4 shrink-0 rounded-full border border-line-2 transition-[border-color,border-width] duration-150 group-hover/opt:border-fg-4 group-active/opt:border-[5px] group-active/opt:border-fg"
                  />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12px] text-fg-3">
        {error ? (
          <span role="alert" className="text-danger">
            {error}
          </span>
        ) : (
          <span className="flex items-center gap-1 tabular">
            <span className="inline-flex h-[1lh] items-center">
              <NumberFlow value={total} locales={locale} animated={!reduce} {...timing} />
            </span>
            <span>{total === 1 ? "vote" : "votes"}</span>
            {closed ? <span>· Final results</span> : meta ? <span>· {meta}</span> : null}
          </span>
        )}
        {!closed && vote != null && allowChange && (
          <button
            ref={changeButton}
            type="button"
            onClick={() => commit(null)}
            className="-mr-2 h-7 rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.97]"
          >
            Change vote
          </button>
        )}
      </div>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </section>
  );
}

function Tick({ reduce }: { reduce: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="ml-1.5 inline-block -translate-y-px align-middle">
      <motion.path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.32, ease: ease.out, delay: 0.25 }}
      />
    </svg>
  );
}
