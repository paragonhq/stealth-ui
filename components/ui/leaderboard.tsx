"use client";
import NumberFlow, { type Format } from "@number-flow/react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

const noop = () => () => {};
function useLocale(locale?: string) {
  const detected = useSyncExternalStore(noop, () => Intl.NumberFormat().resolvedOptions().locale, () => "en-US");
  return locale ?? detected;
}

export type LeaderboardEntry = {
  id: string;
  name: string;
  score: number;
  /** A second line: a team, a region, a handle. */
  meta?: string;
  /** Image URL. Initials are drawn when it's missing or fails. */
  avatar?: string;
};

type Ranked = LeaderboardEntry & { rank: number };

/** Highest score first. Ties share a rank and the next rank is skipped: 1, 2, 2, 4. */
export function rankEntries(entries: LeaderboardEntry[]): Ranked[] {
  const sorted = [...entries].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  let rank = 0;
  return sorted.map((e, i) => {
    if (i === 0 || e.score !== sorted[i - 1].score) rank = i + 1;
    return { ...e, rank };
  });
}

export type LeaderboardProps = Omit<React.ComponentProps<"div">, "children"> & {
  entries: LeaderboardEntry[];
  /** The viewer's entry. Highlighted, and pinned below the list when it falls outside the limit. */
  youId?: string;
  /** How many rows to show before the pinned "you" row. */
  limit?: number;
  /** Names the list for screen readers. */
  label?: string;
  /** Intl options for scores, e.g. { style: "currency", currency: "USD", notation: "compact" }. */
  format?: Format;
  suffix?: string;
  locale?: string;
  /** Header for the score column. */
  scoreLabel?: string;
  loading?: boolean;
  emptyLabel?: string;
};

export function Leaderboard({
  entries,
  youId,
  limit = 8,
  label = "Leaderboard",
  format,
  suffix,
  locale: localeProp,
  scoreLabel = "Score",
  loading = false,
  emptyLabel = "No scores yet",
  className,
  ...rest
}: LeaderboardProps) {
  const locale = useLocale(localeProp);
  const reduce = useReducedMotion();
  const ranked = useMemo(() => rankEntries(entries), [entries]);

  // Movement since the last update, derived while rendering from the previous ranking.
  const [prev, setPrev] = useState<{ entries: LeaderboardEntry[]; ranks: Map<string, number>; moves: Map<string, number>; tick: number }>(() => ({
    entries,
    ranks: new Map(ranked.map((r) => [r.id, r.rank])),
    moves: new Map(),
    tick: 0,
  }));
  if (prev.entries !== entries) {
    const moves = new Map<string, number>();
    for (const r of ranked) {
      const before = prev.ranks.get(r.id);
      if (before != null && before !== r.rank) moves.set(r.id, before - r.rank);
    }
    setPrev({ entries, ranks: new Map(ranked.map((r) => [r.id, r.rank])), moves: moves.size ? moves : prev.moves, tick: moves.size ? prev.tick + 1 : prev.tick });
  }

  // Arrows describe the latest change only; they clear after a few seconds of calm.
  useEffect(() => {
    if (!prev.moves.size) return;
    const t = window.setTimeout(() => setPrev((p) => ({ ...p, moves: new Map() })), 4000);
    return () => window.clearTimeout(t);
  }, [prev.tick, prev.moves.size]);

  const you = youId ? ranked.find((r) => r.id === youId) : undefined;
  const pinned = you && !ranked.slice(0, limit).some((r) => r.id === you.id) ? you : undefined;
  // The board is always `limit` rows tall: when you're pinned, you take the last slot, so nothing jumps as you climb in or fall out.
  const top = ranked.slice(0, pinned ? limit - 1 : limit);
  const ordinal = useMemo(() => new Intl.PluralRules(locale, { type: "ordinal" }), [locale]);
  const suffixes: Record<string, string> = { one: "st", two: "nd", few: "rd", other: "th" };
  const nth = (n: number) => (locale.startsWith("en") ? `${n}${suffixes[ordinal.select(n)] ?? "th"}` : `#${n}`);
  const youMove = you ? prev.moves.get(you.id) : undefined;

  const row = (r: Ranked) => {
    const isYou = r.id === youId;
    const move = prev.moves.get(r.id);
    return (
      <motion.li
        key={r.id}
        layout={reduce ? false : "position"}
        // One layoutId per person, so the "you" row flies between the pinned slot and the list.
        layoutId={`row-${r.id}`}
        transition={{ layout: spring.soft }}
        initial={false}
        data-you={isYou || undefined}
        // The climber passes over the rows it overtakes.
        style={{ zIndex: move != null && move > 0 ? 1 : 0 }}
        className={cn(
          "relative grid h-11 grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg px-2.5",
          // Rows are opaque so two crossing mid-swap never show through each other; set --leaderboard-surface to match your card.
          isYou ? "bg-hover" : "bg-[var(--leaderboard-surface,var(--raised))]",
        )}
      >
        {/* A mover gets a brief wash in the color of its direction, keyed so it replays on every move. */}
        {move != null && (
          <motion.span
            key={`${prev.tick}`}
            aria-hidden
            className={cn("pointer-events-none absolute inset-0 rounded-lg", move > 0 ? "bg-success-soft" : "bg-danger-soft")}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: ease.outQuart, delay: 0.2 }}
          />
        )}
        {/* Rank and its movement share one column, so a name never gives up room to an arrow. */}
        <span className="relative flex items-center gap-1">
          <span className={cn("min-w-[1.25rem] font-mono text-[12px] tabular", r.rank <= 3 ? "text-fg" : "text-fg-3")}>
            <NumberFlow value={r.rank} animated={!reduce} locales={locale} />
          </span>
          <span className="relative grid w-6 place-items-start">
            <AnimatePresence initial={false} mode="popLayout">
              {move != null && (
                <motion.span
                  key={`${prev.tick}-${move}`}
                  className={cn("flex items-center gap-0.5 text-[11px] tabular", move > 0 ? "text-success" : "text-danger")}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: move > 0 ? 6 : -6, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={reduce ? { duration: 0.15 } : spring.pop}
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden className={move < 0 ? "rotate-180" : ""}>
                    <path d="M4 1.5 7 6H1z" fill="currentColor" />
                  </svg>
                  {Math.abs(move)}
                  <span className="sr-only">{move > 0 ? " places up" : " places down"}</span>
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </span>

        <span className="relative flex min-w-0 items-center gap-2.5">
          <Avatar name={r.name} src={r.avatar} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-medium tracking-[-0.005em] text-fg">{r.name}</span>
            {/* The "You" tag rides on the second line, so the name keeps its full width. */}
            {(r.meta || isYou) && (
              <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-fg-3">
                {isYou && <span className="shrink-0 rounded-[4px] border border-line-2 px-1 text-2xs leading-[14px] text-fg-2">You</span>}
                {r.meta && <span className="truncate">{r.meta}</span>}
              </span>
            )}
          </span>
        </span>

        <span className="relative flex items-center justify-end">
          <NumberFlow
            value={r.score}
            format={format}
            suffix={suffix}
            locales={locale}
            animated={!reduce}
            className="text-right text-[13px] text-fg tabular"
          />
        </span>
      </motion.li>
    );
  };

  return (
    <div data-slot="leaderboard" aria-busy={loading || undefined} className={cn("flex w-full min-w-0 flex-col", className)} {...rest}>
      <div aria-hidden className="grid grid-cols-[48px_minmax(0,1fr)_auto] gap-2.5 px-2.5 pb-1.5 font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">
        <span>#</span>
        <span>Name</span>
        <span>{scoreLabel}</span>
      </div>

      {loading && !entries.length ? (
        <ul aria-label={`${label}, loading`} className="flex flex-col">
          {Array.from({ length: Math.min(limit, 5) }, (_, i) => (
            <li key={i} className="grid h-11 grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-2.5 px-2.5">
              <span className="h-2.5 w-3 rounded bg-fg/[0.07]" />
              <span className="flex items-center gap-2.5">
                <span className="size-7 rounded-full bg-fg/[0.07] motion-safe:animate-pulse-soft" />
                <span className="h-2.5 rounded bg-fg/[0.07] motion-safe:animate-pulse-soft" style={{ width: 70 + ((i * 41) % 60) }} />
              </span>
              <span className="h-2.5 w-12 rounded bg-fg/[0.07] motion-safe:animate-pulse-soft" />
            </li>
          ))}
        </ul>
      ) : !ranked.length ? (
        <p role="status" className="grid h-24 place-items-center text-[12.5px] text-fg-3">
          {emptyLabel}
        </p>
      ) : (
        <LayoutGroup>
          <ol aria-label={label} className={cn("flex flex-col transition-opacity duration-200", loading && "opacity-50")}>
            {top.map((r) => row(r))}
          </ol>
          {pinned && (
            <ol
              aria-label="Your position"
              start={pinned.rank}
              className="relative flex flex-col before:absolute before:inset-x-2.5 before:top-0 before:h-px before:bg-line before:content-['']"
            >
              {row(pinned)}
            </ol>
          )}
        </LayoutGroup>
      )}

      <span role="status" aria-live="polite" className="sr-only">
        {you && youMove != null ? `You moved ${youMove > 0 ? "up" : "down"} to ${nth(you.rank)}` : ""}
      </span>
    </div>
  );
}

function Avatar({ name, src }: { name: string; src?: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="relative grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-fg/[0.07] text-[10.5px] font-medium text-fg-2">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={28} height={28} className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </span>
  );
}
