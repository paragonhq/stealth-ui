import { Fragment, useMemo } from "react";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* Folding                                                             */
/* ------------------------------------------------------------------ */

// Letters that don't decompose under NFD but that people type without the stroke.
const FOLD: Record<string, string> = { ß: "ss", æ: "ae", œ: "oe", ø: "o", đ: "d", ð: "d", ł: "l", ı: "i", þ: "th", ŋ: "n", ħ: "h" };

const foldChar = (cp: string) => {
  let out = "";
  for (const c of cp.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")) out += FOLD[c] ?? c;
  return out;
};

/** Lowercases, strips accents and folds ligatures, so "Łódź" and "lodz" compare equal. */
export function fold(text: string) {
  let out = "";
  for (const cp of text) out += foldChar(cp);
  return out;
}

type Folded = { norm: string; start: number[]; end: number[] };

// The folded text plus, for every folded character, where its source code point sits in the
// original. That's what lets a match found in "lodz" be drawn over "Łódź" without drifting.
function foldWithMap(text: string): Folded {
  let norm = "";
  const start: number[] = [];
  const end: number[] = [];
  let i = 0;
  for (const cp of text) {
    const f = foldChar(cp);
    for (const c of f) {
      norm += c;
      start.push(i);
      end.push(i + cp.length);
    }
    // A bare combining mark folds to nothing; stretch the previous character over it so "é"
    // written as e + ◌́ is never split down the middle.
    if (!f && end.length) end[end.length - 1] = i + cp.length;
    i += cp.length;
  }
  return { norm, start, end };
}

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

export type MatchMode = "words" | "substring" | "fuzzy";
export type MatchRange = readonly [start: number, end: number];
export type Match = { ranges: MatchRange[]; score: number };

const isBoundary = (s: string, j: number) => j === 0 || /[\s\-_./:@#([]/.test(s[j - 1]);

function toRanges(f: Folded, spans: [number, number][]): MatchRange[] {
  // Spans are in folded characters; map them back and merge anything touching.
  const mapped = spans
    .map(([a, b]) => [f.start[a], f.end[b - 1]] as [number, number])
    .sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const r of mapped) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

function occurrences(hay: string, needle: string) {
  const spans: [number, number][] = [];
  if (!needle) return spans;
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + needle.length)) spans.push([at, at + needle.length]);
  return spans;
}

// Best-scoring subsequence alignment: rewards consecutive runs and letters that start a word,
// charges for gaps. Linear gap cost keeps it O(query × text).
function fuzzy(f: Folded, q: string): Match | null {
  const t = f.norm;
  const n = t.length;
  const m = q.length;
  if (!m || m > n || n > 1000) return null;
  const NEG = -1e9;
  const GAP = 0.15;
  const score: Float64Array[] = [];
  const from: Int32Array[] = [];
  for (let i = 0; i < m; i++) {
    const row = new Float64Array(n).fill(NEG);
    const back = new Int32Array(n).fill(-1);
    let best = NEG;
    let bestAt = -1;
    for (let j = 0; j < n; j++) {
      // Running best over every earlier k of prev[k] + GAP * k, so the gap cost is one subtraction.
      if (i > 0 && j > 0) {
        const cand = score[i - 1][j - 1] + GAP * (j - 1);
        if (cand > best) {
          best = cand;
          bestAt = j - 1;
        }
      }
      if (t[j] !== q[i]) continue;
      const bonus = 1 + (isBoundary(t, j) ? 1.5 : 0) + (j === 0 ? 0.5 : 0);
      if (i === 0) {
        row[j] = bonus - j * 0.01;
        continue;
      }
      const run = score[i - 1][j - 1];
      const viaRun = j > 0 && run > NEG ? run + bonus + 2 : NEG;
      const viaGap = bestAt >= 0 && best > NEG / 2 ? best - GAP * (j - 1) - GAP + bonus : NEG;
      if (viaRun >= viaGap && viaRun > NEG) {
        row[j] = viaRun;
        back[j] = j - 1;
      } else if (viaGap > NEG) {
        row[j] = viaGap;
        back[j] = bestAt;
      }
    }
    score.push(row);
    from.push(back);
  }
  let end = -1;
  let top = NEG;
  for (let j = 0; j < n; j++) if (score[m - 1][j] > top) (top = score[m - 1][j]), (end = j);
  if (end < 0 || top <= NEG / 2) return null;
  const hits: number[] = [];
  for (let i = m - 1, j = end; i >= 0; i--) {
    hits.push(j);
    j = from[i][j];
  }
  hits.reverse();
  const spans: [number, number][] = [];
  for (const h of hits) {
    const last = spans[spans.length - 1];
    if (last && last[1] === h) last[1] = h + 1;
    else spans.push([h, h + 1]);
  }
  return { ranges: toRanges(f, spans), score: top / m };
}

const terms = (query: string) => [...new Set(fold(query).split(/\s+/).filter(Boolean))];

function literal(f: Folded, needles: string[], strict: boolean): Match | null {
  const spans: [number, number][] = [];
  let score = 0;
  for (const needle of needles) {
    const hits = occurrences(f.norm, needle);
    if (!hits.length) {
      if (strict) return null;
      continue;
    }
    const first = hits[0][0];
    // Earlier is better, the start of a word is better still, and the whole text is best.
    score += 1 + (isBoundary(f.norm, first) ? 1 : 0) + (first === 0 ? 0.5 : 0) + 1 / (1 + first / 12);
    if (needle.length === f.norm.length) score += 2;
    spans.push(...hits);
  }
  if (!spans.length) return null;
  return { ranges: toRanges(f, spans), score: score / needles.length };
}

/**
 * Where `query` matches `text`, case and accent insensitive, or null when it doesn't.
 * - `words` (default): every word of the query must appear, in any order.
 * - `substring`: the query as typed, spaces and all.
 * - `fuzzy`: the query's letters in order, gaps allowed, favouring runs and word starts.
 * `score` is higher for better matches; compare it only within one mode.
 */
export function findMatches(text: string, query: string, mode: MatchMode = "words"): Match | null {
  const f = foldWithMap(text);
  if (mode === "fuzzy") return fuzzy(f, fold(query).replace(/\s+/g, ""));
  if (mode === "substring") {
    const q = fold(query).replace(/\s+/g, " ").trim();
    return q ? literal(f, [q], true) : null;
  }
  const t = terms(query);
  return t.length ? literal(f, t, true) : null;
}

// Rendering is forgiving where filtering is strict: a snippet shows every word it does contain.
function rangesFor(text: string, query: string | string[], mode: MatchMode): MatchRange[] {
  if (Array.isArray(query)) return query.flatMap((q) => rangesFor(text, q, mode)).sort((a, b) => a[0] - b[0]);
  if (!query.trim()) return [];
  const f = foldWithMap(text);
  if (mode === "fuzzy") return fuzzy(f, fold(query).replace(/\s+/g, ""))?.ranges ?? [];
  const needles = mode === "substring" ? [fold(query).replace(/\s+/g, " ").trim()] : terms(query);
  return literal(f, needles, false)?.ranges ?? [];
}

/* ------------------------------------------------------------------ */
/* Excerpt                                                             */
/* ------------------------------------------------------------------ */

// A window of about `size` characters that opens a few words before the first match, snapped
// to whole words, so long body text becomes a snippet with the match near its start. The lead is
// kept short on purpose: a snippet is usually clamped to one line, and a match pushed past the
// clamp is a match nobody sees.
function snippet(text: string, ranges: MatchRange[], size: number) {
  if (text.length <= size) return { from: 0, to: text.length };
  const anchor = ranges[0]?.[0] ?? 0;
  let from = Math.max(0, anchor - Math.min(24, Math.round(size * 0.25)));
  let to = Math.min(text.length, from + size);
  if (from > 0) {
    const space = text.indexOf(" ", from);
    if (space !== -1 && space < anchor) from = space + 1;
  }
  if (to < text.length) {
    const space = text.lastIndexOf(" ", to);
    if (space > from && space > (ranges[0]?.[1] ?? 0)) to = space;
  }
  return { from, to };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export type HighlightMatchProps = Omit<React.ComponentProps<"span">, "children"> & {
  text: string;
  /** What to mark. An array marks several queries at once, e.g. one per active search term. */
  query: string | string[];
  mode?: MatchMode;
  /** Precomputed ranges (from findMatches) instead of a query, so a list doesn't match twice. */
  ranges?: readonly MatchRange[];
  /** "fill" washes the match like find-in-page; "text" lifts it to full contrast and medium weight. */
  variant?: "fill" | "text";
  /** Show a snippet of about this many characters around the first match, with ellipses. */
  excerpt?: number;
  markClassName?: string;
};

export function HighlightMatch({ text, query, mode = "words", ranges: given, variant = "fill", excerpt, markClassName, className, ...rest }: HighlightMatchProps) {
  const ranges = useMemo(() => (given ? [...given] : rangesFor(text, query, mode)), [given, text, query, mode]);
  const { from, to } = excerpt ? snippet(text, ranges, excerpt) : { from: 0, to: text.length };

  const parts: React.ReactNode[] = [];
  let at = from;
  for (const [a, b] of ranges) {
    const s = Math.max(a, from, at);
    const e = Math.min(b, to);
    if (e <= s) continue;
    if (s > at) parts.push(<Fragment key={`t${at}`}>{text.slice(at, s)}</Fragment>);
    parts.push(
      // Keyed by where the match starts: a match that grows as you type stays the same element
      // and simply widens, while a match that is new washes in from nothing.
      <mark
        key={`m${a}`}
        data-match=""
        data-variant={variant}
        className={cn(
                    variant === "fill"
            ? "-mx-px box-decoration-clone rounded-[3px] bg-fg/[0.13] px-px text-fg transition-[background-color] duration-150 ease-out starting:bg-transparent"
            : "bg-transparent font-medium text-fg transition-[color] duration-150 ease-out starting:text-inherit",
          "motion-reduce:transition-none",
          markClassName,
        )}
      >
        {text.slice(s, e)}
      </mark>,
    );
    at = e;
  }
  if (at < to) parts.push(<Fragment key={`t${at}`}>{text.slice(at, to)}</Fragment>);

  return (
    <span className={className} {...rest}>
      {from > 0 && <span aria-hidden>…</span>}
      {parts}
      {to < text.length && <span aria-hidden>…</span>}
    </span>
  );
}
