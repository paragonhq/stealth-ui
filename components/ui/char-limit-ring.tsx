"use client";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

/**
 * Counts what a person sees as characters: "👍🏽" and "é" are one each, not
 * two or four. Falls back to code points where Intl.Segmenter is missing.
 */
export function countCharacters(text: string) {
  if (!text) return 0;
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].length;
  }
  return Array.from(text).length;
}

type Level = "empty" | "ok" | "near" | "warn" | "over";

export type CharLimitRingProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** Characters typed. Use countCharacters(text) so emoji count as one. */
  count: number;
  limit: number;
  /** Fraction of the limit where the ring turns to the warning color. */
  warnAt?: number;
  /** Remaining characters at which the number appears inside the ring. */
  countFrom?: number;
  size?: "sm" | "md";
  /** Hide the ring until the first character. */
  hideWhenEmpty?: boolean;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function CharLimitRing({ count, limit, warnAt = 0.9, countFrom = 20, size = "md", hideWhenEmpty = true, className, ...rest }: CharLimitRingProps) {
  const reduce = useReducedMotion();
  const remaining = limit - count;
  const level: Level = count === 0 ? "empty" : remaining < 0 ? "over" : count >= limit * warnAt ? "warn" : remaining <= countFrom ? "near" : "ok";
  const showCount = count > 0 && remaining <= countFrom;
  const fill = Math.min(1, Math.max(0, count / limit));

  // Announce crossings, not keystrokes: entering the last stretch, reaching the limit, going over, coming back.
  const band = remaining < 0 ? "over" : remaining === 0 ? "zero" : remaining <= 10 ? "ten" : remaining <= countFrom ? "near" : "fine";
  const [prev, setPrev] = useState(band);
  const [said, setSaid] = useState("");
  const [bumps, setBumps] = useState(0);
  if (band !== prev) {
    setPrev(band);
    setSaid(
      band === "over"
        ? `${plural(-remaining, "character")} over the limit`
        : band === "zero"
          ? "Character limit reached"
          : band === "ten"
            ? `${remaining} characters left`
            : band === "near"
              ? `${remaining} characters left`
              : prev === "over"
                ? "Back under the limit"
                : "",
    );
    // Going over earns one small pop, so the moment is felt without a shake.
    if (band === "over" && prev !== "over") setBumps((b) => b + 1);
  }

  const base = size === "sm" ? 18 : 22;
  const stroke = size === "sm" ? 2 : 2.25;
  const r = (base - stroke) / 2;
  // The ring grows to make room for the number, then settles back.
  const grow = showCount ? (size === "sm" ? 1.35 : 1.3) : 1;
  const digits = String(remaining).length;

  return (
    <span
      data-slot="char-limit-ring"
      data-level={level}
      className={cn(
        "relative inline-grid shrink-0 place-items-center transition-opacity duration-200 ease-out",
        hideWhenEmpty && count === 0 && "opacity-0",
        className,
      )}
      style={{ width: base * 1.35, height: base * 1.35 }}
      {...rest}
    >
      {/* CSS, not Motion, for the growth: its value renders the same on the server and a reduced-motion client. */}
      <span
        aria-hidden
        className="relative grid place-items-center transition-[scale] duration-300 ease-out-expo motion-reduce:transition-none"
        style={{ width: base, height: base, scale: grow }}
      >
        <motion.span
          key={bumps}
          className="absolute inset-0"
          initial={bumps && !reduce ? { scale: 1.18 } : false}
          animate={{ scale: 1 }}
          transition={spring.bouncy}
        >
          <svg width={base} height={base} viewBox={`0 0 ${base} ${base}`} className="-rotate-90 overflow-visible">
            <circle cx={base / 2} cy={base / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-fg/15" />
            <circle
              cx={base / 2}
              cy={base / 2}
              r={r}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1 1"
              className={cn(
                "transition-[stroke-dashoffset,stroke] duration-150 ease-out",
                level === "over" ? "stroke-danger" : level === "warn" ? "stroke-warning" : "stroke-fg-2",
              )}
              style={{ strokeDashoffset: 1 - fill }}
            />
          </svg>
        </motion.span>
        <span
          className={cn(
            "relative font-medium leading-none tabular tracking-[-0.02em] transition-[opacity,color] duration-150",
            showCount ? "opacity-100" : "opacity-0",
            level === "over" ? "text-danger" : level === "warn" ? "text-warning" : "text-fg-2",
          )}
          // Shrinks a touch for three or four characters so "-120" still fits inside.
          style={{ fontSize: (size === "sm" ? 9 : 10) - Math.max(0, digits - 2) }}
        >
          {/* Plain digits: this changes on every keystroke, where rolling numbers would read as lag. */}
          {showCount ? remaining : countFrom}
        </span>
      </span>

      <span className="sr-only">
        {remaining >= 0 ? `${plural(remaining, "character")} left of ${limit}` : `${plural(-remaining, "character")} over the ${limit} limit`}
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {said}
      </span>
    </span>
  );
}
