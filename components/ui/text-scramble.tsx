"use client";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
/** How often each scrambling character picks a new glyph, in ms. Faster reads as noise, slower as stutter. */
const GLYPH_MS = 55;

// Server and client render identically on the first pass; layout effects run
// after hydration, so the isomorphic version only skips the server warning.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type ScrambleCell =
  /** Settled: the real character. */
  | { char: string; show: "final" }
  /** The wave hasn't reached it: the character that was there before, or nothing. */
  | { char: string; show: "before"; glyph: string }
  /** Decoding: a stand-in glyph of the same kind (letter, digit, case). */
  | { char: string; show: "glyph"; glyph: string };

type Run = { id: number; from: string; seed: number };

// A cheap integer hash, so a glyph is a pure function of (character, tick, run):
// rendering stays pure and every frame of a run is reproducible.
function hash(n: number) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}

function pool(char: string, charset?: string) {
  if (/\s/.test(char)) return null;
  if (charset) return charset;
  if (DIGITS.includes(char)) return DIGITS;
  if (UPPER.includes(char)) return UPPER;
  if (LOWER.includes(char)) return LOWER;
  // Punctuation and symbols (_ - . / :) hold still: they are the string's structure.
  return null;
}

/**
 * The scramble on its own: give it the text, get back one cell per character
 * for the current frame. Changing `text` decodes from the old string into the
 * new one; `play(from)` runs it on demand ("" decodes from nothing).
 */
export function useScramble(
  text: string,
  { duration = 0.8, charset, scrambleOnChange = true, onSettled }: { duration?: number; charset?: string; scrambleOnChange?: boolean; onSettled?: () => void } = {},
) {
  const reduce = useReducedMotion();
  const [run, setRun] = useState<Run | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [prevText, setPrevText] = useState(text);
  const settled = useRef(onSettled);
  useEffect(() => {
    settled.current = onSettled;
  });

  // A new string decodes from whatever was showing before it.
  if (text !== prevText) {
    setPrevText(text);
    if (scrambleOnChange && !reduce) {
      setRun((r) => ({ id: (r?.id ?? 0) + 1, from: prevText, seed: (r?.seed ?? 7) * 31 + text.length }));
      setElapsed(0);
    }
  }

  const play = useCallback(
    (from = "") => {
      if (reduce) return settled.current?.();
      setRun((r) => ({ id: (r?.id ?? 0) + 1, from, seed: Math.floor(Math.random() * 1e9) }));
      setElapsed(0);
    },
    [reduce],
  );

  const total = duration * 1000;
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    let start = 0;
    const frame = (now: number) => {
      start ||= now;
      const t = now - start;
      if (t >= total) {
        setRun(null);
        setElapsed(0);
        settled.current?.();
        return;
      }
      setElapsed(t);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [run, total]);

  const chars = Array.from(text);
  const from = run ? Array.from(run.from) : [];
  // The wave spans only the stretch that changes, so "sk_demo_••••4f2a" to the
  // full key spends the whole duration on the secret, not the fixed prefix.
  let lo = -1;
  let hi = -1;
  if (run)
    chars.forEach((c, i) => {
      if (from[i] === c) return;
      if (lo < 0) lo = i;
      hi = i;
    });
  const cells: ScrambleCell[] = chars.map((char, i) => {
    if (!run) return { char, show: "final" };
    const before = from[i] ?? "";
    // Characters that were already right never move.
    if (before === char) return { char, show: "final" };
    // A wave left to right: each character starts scrambling at 40% of its
    // position through the run and settles 60% of the run later, so the last
    // one lands exactly at `duration` whatever the length.
    const p = hi > lo ? (i - lo) / (hi - lo) : 0;
    const startAt = p * total * 0.4;
    if (elapsed >= startAt + total * 0.6) return { char, show: "final" };
    const kinds = pool(char, charset);
    // Punctuation has nothing to scramble through: it waits, then swaps when its turn settles.
    if (elapsed < startAt || !kinds) return { char, show: "before", glyph: before };
    const tick = Math.floor(elapsed / GLYPH_MS);
    return { char, show: "glyph", glyph: kinds[hash(run.seed + i * 7919 + tick * 104729) % kinds.length] };
  });

  return { cells, scrambling: run !== null, play };
}

type Tag = "span" | "p" | "div" | "code" | "h1" | "h2" | "h3" | "h4";

export type TextScrambleProps = Omit<React.HTMLAttributes<HTMLElement>, "children"> & {
  /** The text to show. Changing it decodes from the old string into the new one. */
  children: string;
  as?: Tag;
  /** Decode from nothing when it scrolls into view, as it mounts, or never (only on change). */
  trigger?: "view" | "mount" | "none";
  /** Seconds for a whole run, whatever the length of the text. */
  duration?: number;
  /** Glyphs to scramble through. By default each character scrambles within its own kind: digits, capitals or lowercase. */
  charset?: string;
  /** Decode from the previous text when `children` changes. */
  scrambleOnChange?: boolean;
  /** Called each time a run settles on the final text. */
  onSettled?: () => void;
  ref?: React.Ref<HTMLElement>;
};

/**
 * Text that decodes from random glyphs into the real string, left to right,
 * in a fixed time. Each character keeps the width of its final glyph, so the
 * line never jitters, and the real string is always there for assistive tech.
 */
export function TextScramble({
  children,
  as: Tag = "span",
  trigger = "view",
  duration = 0.8,
  charset,
  scrambleOnChange = true,
  onSettled,
  className,
  ref,
  ...rest
}: TextScrambleProps) {
  const reduce = useReducedMotion();
  const self = useRef<HTMLElement>(null);
  const { cells, scrambling, play } = useScramble(children, { duration, charset, scrambleOnChange, onSettled });

  // "Armed" lifts the pre-reveal hiding. It is set in the same frame the first
  // run renders, so the settled text never flashes before it decodes.
  useIsoLayoutEffect(() => {
    if (scrambling || reduce) self.current?.setAttribute("data-armed", "");
  }, [scrambling, reduce]);

  useEffect(() => {
    const el = self.current;
    if (!el || trigger === "none" || el.hasAttribute("data-armed") || reduce) return;
    if (trigger === "mount") {
      const raf = requestAnimationFrame(() => play(""));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(([entry]) => {
      const above = entry.boundingClientRect.bottom < (entry.rootBounds?.top ?? 0);
      if (!entry.isIntersecting && !above) return;
      io.disconnect();
      if (above) el.setAttribute("data-armed", "");
      else play("");
    });
    io.observe(el);
    return () => io.disconnect();
  }, [trigger, reduce, play]);

  // Words are grouped so a line only ever breaks between words, never inside one.
  const words: { cells: ScrambleCell[]; start: number }[] = [];
  let index = 0;
  for (const part of children.split(/(\s+)/)) {
    if (part) words.push({ cells: cells.slice(index, index + Array.from(part).length), start: index });
    index += Array.from(part).length;
  }

  return (
    <>
      <Tag
        ref={(node: HTMLElement | null) => {
          self.current = node;
          if (typeof ref === "function") return ref(node);
          if (ref) (ref as React.RefObject<HTMLElement | null>).current = node;
        }}
        data-text-scramble=""
        data-state={scrambling ? "scrambling" : "settled"}
        className={cn(
          trigger !== "none" && "motion-safe:[&:not([data-armed])_[data-cell]]:opacity-0",
          "print:[&_[data-cell]]:opacity-100!",
          className,
        )}
        {...rest}
      >
        <span className="sr-only select-none">{children}</span>
        <span aria-hidden>
          {words.map((word) =>
            /^\s+$/.test(word.cells.map((c) => c.char).join("")) ? (
              word.cells.map((c) => c.char).join("")
            ) : (
              <span key={word.start} className="whitespace-nowrap">
                {word.cells.map((cell, i) => (
                  <span key={i} data-cell="" data-show={cell.show} className="relative inline-block">
                    {/* The real character always holds the cell's width; stand-ins draw over it. */}
                    <span className={cell.show === "final" ? undefined : "opacity-0"}>{cell.char}</span>
                    {cell.show !== "final" && (
                      <span className={cn("absolute inset-0 text-center", cell.show === "glyph" && "opacity-45")}>{cell.glyph}</span>
                    )}
                  </span>
                ))}
              </span>
            ),
          )}
        </span>
      </Tag>
      <noscript>
        <style>{"[data-text-scramble] [data-cell]{opacity:1!important}"}</style>
      </noscript>
    </>
  );
}
