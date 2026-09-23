"use client";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Toggle } from "@base-ui/react/toggle";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { codeTheme, indentOf, resolveLanguage, tokenize, type CodeToken } from "@/components/ui/code-block";
import { cn } from "@/lib/cn";
import { ArrowRight, ChevronsUpDown, File } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * Diffing: Myers' O((N+M)D) shortest edit script, for lines and for the words inside a changed line.
 * -----------------------------------------------------------------------------------------------*/

type Edit = { op: "=" | "-" | "+"; a: number; b: number };

export function diff<T>(a: readonly T[], b: readonly T[]): Edit[] {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const off = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  outer: for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[off + k] = x;
      if (x >= n && y >= m) break outer;
    }
  }
  const out: Edit[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const t = trace[d];
    const k = x - y;
    const pk = k === -d || (k !== d && t[off + k - 1] < t[off + k + 1]) ? k + 1 : k - 1;
    const px = t[off + pk];
    const py = px - pk;
    while (x > px && y > py) out.push({ op: "=", a: --x, b: --y });
    if (d > 0) out.push(x === px ? { op: "+", a: x, b: --y } : { op: "-", a: --x, b: y });
    x = px;
    y = py;
  }
  return out.reverse();
}

type Range = [number, number];

/** Character ranges that changed between two versions of a line, or null when so much changed that marking it all is noise. */
function wordMarks(before: string, after: string): [Range[], Range[], number] | null {
  const split = (s: string) => s.match(/\w+|\s+|[^\w\s]/g) ?? [];
  const a = split(before);
  const b = split(after);
  const edits = diff(a, b);
  const ra: Range[] = [];
  const rb: Range[] = [];
  let ia = 0;
  let ib = 0;
  let same = 0;
  const push = (list: Range[], at: number, len: number) => {
    const last = list[list.length - 1];
    if (last && last[1] === at) last[1] += len;
    else list.push([at, at + len]);
  };
  for (const e of edits) {
    if (e.op === "=") {
      same += a[e.a].length;
      ia += a[e.a].length;
      ib += b[e.b].length;
    } else if (e.op === "-") {
      push(ra, ia, a[e.a].length);
      ia += a[e.a].length;
    } else {
      push(rb, ib, b[e.b].length);
      ib += b[e.b].length;
    }
  }
  const longest = Math.max(before.trim().length, after.trim().length, 1);
  const score = same / longest;
  return score < 0.6 ? null : [ra, rb, score];
}

/* -------------------------------------------------------------------------------------------------
 * Model: the file as runs of unchanged lines and blocks of changes
 * -----------------------------------------------------------------------------------------------*/

type Line = { no: number; tokens: CodeToken[]; marks?: Range[] };
type Change = { kind: "change"; dels: Line[]; adds: Line[]; rows: { del?: Line; add?: Line }[] };
type Same = { kind: "same"; id: number; rows: { a: Line; b: Line }[]; keepTop: number; keepBottom: number; gap: number; first: boolean; last: boolean };
type Segment = Change | Same;

const text = (t: CodeToken[]) => t.map((x) => x.value).join("");

function model(before: string, after: string, lang: string | undefined, filename: string | undefined, context: number) {
  const language = resolveLanguage(lang, filename);
  const A = tokenize(before, language);
  const B = tokenize(after, language);
  const edits = diff(A.map(text), B.map(text));
  const segments: Segment[] = [];
  let adds = 0;
  let dels = 0;
  for (const e of edits) {
    const last = segments[segments.length - 1];
    if (e.op === "=") {
      const row = { a: { no: e.a + 1, tokens: A[e.a] }, b: { no: e.b + 1, tokens: B[e.b] } };
      if (last?.kind === "same") last.rows.push(row);
      else segments.push({ kind: "same", id: segments.length, rows: [row], keepTop: 0, keepBottom: 0, gap: 0, first: false, last: false });
    } else {
      const block = last?.kind === "change" ? last : (segments[segments.push({ kind: "change", dels: [], adds: [], rows: [] }) - 1] as Change);
      if (e.op === "-") {
        block.dels.push({ no: e.a + 1, tokens: A[e.a] });
        dels++;
      } else {
        block.adds.push({ no: e.b + 1, tokens: B[e.b] });
        adds++;
      }
    }
  }
  segments.forEach((s, i) => {
    if (s.kind === "change") {
      // Pair each removed line with the added line that most resembles it (in order), and mark only the words that changed.
      const pairs: [number, number][] = [];
      let from = 0;
      s.dels.forEach((d, i) => {
        let best: { j: number; m: [Range[], Range[]]; score: number } | null = null;
        for (let j = from; j < s.adds.length; j++) {
          const m = wordMarks(text(d.tokens), text(s.adds[j].tokens));
          if (m && (!best || m[2] > best.score)) best = { j, m: [m[0], m[1]], score: m[2] };
        }
        if (!best) return;
        [d.marks, s.adds[best.j].marks] = best.m;
        pairs.push([i, best.j]);
        from = best.j + 1;
      });
      // Split rows: unpaired lines sit side by side, pairs share a row so the eye can compare them.
      let di = 0;
      let aj = 0;
      const fill = (toD: number, toA: number) => {
        while (di < toD || aj < toA) s.rows.push({ del: di < toD ? s.dels[di++] : undefined, add: aj < toA ? s.adds[aj++] : undefined });
      };
      for (const [pi, pj] of pairs) {
        fill(pi, pj);
        s.rows.push({ del: s.dels[di++], add: s.adds[aj++] });
      }
      fill(s.dels.length, s.adds.length);
      return;
    }
    s.first = i === 0;
    s.last = i === segments.length - 1;
    s.keepTop = s.first ? 0 : context;
    s.keepBottom = s.last ? 0 : context;
    const hidden = s.rows.length - s.keepTop - s.keepBottom;
    // Folding away three lines costs more than it saves.
    if (hidden >= 4) s.gap = hidden;
    else s.keepTop = s.rows.length;
  });
  return { segments, adds, dels, digits: String(Math.max(A.length, B.length)).length };
}

/* -------------------------------------------------------------------------------------------------
 * DiffViewer
 * -----------------------------------------------------------------------------------------------*/

const STEP = 20;
// NumberFlow animates through the Web Animations API, which needs the curve as a string.
const easeOut = `cubic-bezier(${ease.out.join(", ")})`;

export type DiffView = "unified" | "split";

export type DiffViewerProps = Omit<React.ComponentProps<"div">, "children"> & {
  before: string;
  after: string;
  /** Language name, alias or extension. Falls back to the filename's extension. */
  lang?: string;
  filename?: string;
  /** Set when the file was renamed; the header shows old → new. */
  previousFilename?: string;
  view?: DiffView;
  defaultView?: DiffView;
  onViewChange?: (view: DiffView) => void;
  /** Unchanged lines kept around each change before the rest folds away. */
  context?: number;
};

export function DiffViewer({
  before,
  after,
  lang,
  filename,
  previousFilename,
  view: viewProp,
  defaultView = "unified",
  onViewChange,
  context = 3,
  className,
  style,
  ...rest
}: DiffViewerProps) {
  const reduce = useReducedMotion();
  const pillId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [view, setView] = useControllableState<DiffView>({ value: viewProp, defaultValue: defaultView, onChange: onViewChange });
  const [narrow, setNarrow] = useState(false);
  const [open, setOpen] = useState<Record<number, { top: number[]; bottom: number[] }>>({});
  const { segments, adds, dels, digits } = useMemo(() => model(before, after, lang, filename, context), [before, after, lang, filename, context]);

  // Split needs room for two columns of code; below that it reads as unified, whatever was chosen.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 560));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const shown: DiffView = narrow ? "unified" : view;

  const reveal = (id: number, side: "top" | "bottom", count: number) =>
    setOpen((o) => {
      const cur = o[id] ?? { top: [], bottom: [] };
      return { ...o, [id]: { ...cur, [side]: [...cur[side], count] } };
    });

  const unchanged = adds === 0 && dels === 0;
  const total = adds + dels;
  const blocks = Array.from({ length: 5 }, (_, i) => (total === 0 ? "none" : i < Math.round((adds / total) * 5) ? "add" : "del"));

  return (
    <div
      ref={root}
      data-diff=""
      data-view={shown}
      tabIndex={-1}
      style={{ ...codeTheme, "--digits": digits, ...style } as React.CSSProperties}
      className={cn("@container flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)] outline-none", className)}
      {...rest}
    >
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-line pl-3.5 pr-1.5">
        <File size={14} className="shrink-0 text-fg-3" />
        <span className="flex min-w-0 flex-1 items-center gap-1.5 font-mono text-[12px]">
          {previousFilename && previousFilename !== filename && (
            <>
              <span className="min-w-0 truncate text-fg-3 line-through decoration-fg-4">{previousFilename}</span>
              <ArrowRight size={12} className="shrink-0 text-fg-4" />
            </>
          )}
          <span className="min-w-0 truncate text-fg">{filename}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 font-mono text-[11.5px] tabular" aria-label={`${adds} added, ${dels} removed`}>
          <span aria-hidden className="text-success">+{adds}</span>
          <span aria-hidden className="text-danger">−{dels}</span>
          <span aria-hidden className="hidden gap-0.5 @[420px]:flex">
            {blocks.map((b, i) => (
              <span key={i} className={cn("size-2 rounded-[2px]", b === "add" ? "bg-success" : b === "del" ? "bg-danger" : "bg-fg/10")} />
            ))}
          </span>
        </span>
        <ToggleGroup
          value={[shown]}
          onValueChange={(v) => v[0] && setView(v[0] as DiffView)}
          aria-label="Diff layout"
          className="relative ml-1 hidden shrink-0 items-center rounded-lg bg-fg/[0.05] p-0.5 @[420px]:flex"
        >
          {(["unified", "split"] as const).map((v) => (
            <Toggle
              key={v}
              value={v}
              disabled={v === "split" && narrow}
              title={v === "split" && narrow ? "Needs a wider space" : undefined}
              className={cn(
                "relative h-6 select-none rounded-md px-2 text-[12px] font-medium text-fg-3 outline-none",
                "transition-[color,scale] duration-150 ease-out hover:text-fg-2 active:scale-[0.96] active:duration-75 data-pressed:text-fg",
                "data-disabled:pointer-events-none data-disabled:text-fg-4",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
              )}
            >
              {shown === v && (
                <motion.span
                  layoutId={pillId}
                  aria-hidden
                  className="absolute inset-0 rounded-md bg-raised shadow-[0_1px_2px_rgb(0_0_0/0.12)] ring-1 ring-fg/[0.07]"
                  transition={reduce ? { duration: 0 } : spring.snappy}
                />
              )}
              <span className="relative">{v === "unified" ? "Unified" : "Split"}</span>
            </Toggle>
          ))}
        </ToggleGroup>
      </div>

      {unchanged ? (
        <p className="px-4 py-6 text-center text-[12.5px] text-fg-3">No changes between these versions</p>
      ) : (
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={shown}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ duration: reduce ? 0.1 : 0.16, ease: ease.out }}
            className="font-mono text-[12.5px] leading-5"
          >
            {segments.map((s, i) =>
              s.kind === "change" ? (
                <Fragment key={i}>{shown === "unified" ? <UnifiedChange block={s} /> : <SplitChange block={s} />}</Fragment>
              ) : (
                <Unchanged key={i} seg={s} view={shown} open={open[s.id] ?? { top: [], bottom: [] }} reveal={reveal} reduce={!!reduce} />
              ),
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Rows
 * -----------------------------------------------------------------------------------------------*/

type Tone = "same" | "add" | "del";

const ROW: Record<Tone, string> = { same: "", add: "bg-success-soft", del: "bg-danger-soft" };
const NUM: Record<Tone, string> = { same: "text-fg-4", add: "text-success/60", del: "text-danger/60" };
const SIGN: Record<Tone, string> = { same: "text-fg-4", add: "text-success", del: "text-danger" };
// Square washes: a changed run spans several tokens, and rounded pieces would read as separate boxes.
const MARK: Record<Tone, string> = { same: "", add: "bg-success/20", del: "bg-danger/20" };

// On a phone the gutters tighten so the code keeps as much of the width as it can.
const numCell = "w-[calc(var(--digits)*1ch+1.25rem)] shrink-0 select-none pr-2.5 text-right tabular @max-[420px]:w-[calc(var(--digits)*1ch+0.75rem)] @max-[420px]:pr-1.5";
const signCell = "w-6 shrink-0 select-none text-center @max-[420px]:w-5";

/** Tokens with the changed words washed, splitting a token wherever a mark starts or ends. */
function Code({ line, tone }: { line?: Line; tone: Tone }) {
  if (!line) return null;
  const indent = indentOf(line.tokens) + 2;
  const marks = line.marks ?? [];
  const out: React.ReactNode[] = [];
  let at = 0;
  line.tokens.forEach((t, ti) => {
    const end = at + t.value.length;
    const cuts = new Set([at, end]);
    for (const [s, e] of marks) {
      if (s > at && s < end) cuts.add(s);
      if (e > at && e < end) cuts.add(e);
    }
    const points = [...cuts].sort((x, y) => x - y);
    for (let p = 0; p < points.length - 1; p++) {
      const [s, e] = [points[p], points[p + 1]];
      const marked = marks.some(([ms, me]) => s >= ms && e <= me);
      out.push(
        <span
          key={`${ti}-${p}`}
          style={t.type === "space" ? undefined : { color: `var(--sh-${t.type})` }}
          className={cn(t.type === "comment" && "italic", marked && MARK[tone])}
        >
          {t.value.slice(s - at, e - at)}
        </span>,
      );
    }
    at = end;
  });
  return (
    <span
      className="min-w-0 flex-1 whitespace-pre-wrap pr-4 [overflow-wrap:anywhere]"
      // Wrapped lines hang past their own indent, so a long line still reads as one statement.
      style={{ paddingInlineStart: `${indent}ch`, textIndent: `-${indent}ch` }}
    >
      {out.length ? out : <br />}
    </span>
  );
}

function Unified({ line, tone, a, b }: { line: Line; tone: Tone; a?: number; b?: number }) {
  return (
    <div data-tone={tone} className={cn("flex min-h-5", ROW[tone])}>
      <span aria-hidden className={cn(numCell, NUM[tone])}>{a ?? ""}</span>
      <span aria-hidden className={cn(numCell, NUM[tone])}>{b ?? ""}</span>
      <span className={cn(signCell, SIGN[tone])}>
        <span aria-hidden>{tone === "add" ? "+" : tone === "del" ? "−" : ""}</span>
        {tone !== "same" && <span className="sr-only">{tone === "add" ? "Added line" : "Removed line"}</span>}
      </span>
      <Code line={line} tone={tone} />
    </div>
  );
}

function UnifiedChange({ block }: { block: Change }) {
  return (
    <>
      {block.dels.map((l) => (
        <Unified key={`d${l.no}`} line={l} tone="del" a={l.no} />
      ))}
      {block.adds.map((l) => (
        <Unified key={`a${l.no}`} line={l} tone="add" b={l.no} />
      ))}
    </>
  );
}

function Half({ line, tone }: { line?: Line; tone: Tone }) {
  return (
    <div
      className={cn(
        "flex min-h-5 min-w-0",
        line ? ROW[tone] : "bg-[repeating-linear-gradient(135deg,transparent_0_5px,color-mix(in_oklab,var(--fg)_5%,transparent)_5px_6px)]",
      )}
    >
      <span aria-hidden className={cn(numCell, NUM[tone])}>{line?.no ?? ""}</span>
      <span className={cn(signCell, SIGN[tone])}>
        <span aria-hidden>{line && tone === "add" ? "+" : line && tone === "del" ? "−" : ""}</span>
        {line && tone !== "same" && <span className="sr-only">{tone === "add" ? "Added line" : "Removed line"}</span>}
      </span>
      <Code line={line} tone={tone} />
    </div>
  );
}

const splitRow = "grid grid-cols-2 [&>*:first-child]:border-r [&>*:first-child]:border-line";

function SplitChange({ block }: { block: Change }) {
  return block.rows.map((r, i) => (
    <div key={i} className={splitRow}>
      <Half line={r.del} tone="del" />
      <Half line={r.add} tone="add" />
    </div>
  ));
}

function SameRows({ rows, view }: { rows: Same["rows"]; view: DiffView }) {
  return rows.map((r) =>
    view === "unified" ? (
      <Unified key={r.b.no} line={r.b} tone="same" a={r.a.no} b={r.b.no} />
    ) : (
      <div key={r.b.no} className={splitRow}>
        <Half line={r.a} tone="same" />
        <Half line={r.b} tone="same" />
      </div>
    ),
  );
}

/* -------------------------------------------------------------------------------------------------
 * Unchanged runs, folded, with controls to reveal them in steps from either end
 * -----------------------------------------------------------------------------------------------*/

function Unchanged({
  seg,
  view,
  open,
  reveal,
  reduce,
}: {
  seg: Same;
  view: DiffView;
  open: { top: number[]; bottom: number[] };
  reveal: (id: number, side: "top" | "bottom", count: number) => void;
  reduce: boolean;
}) {
  const { rows, keepTop, keepBottom, gap } = seg;
  const top = open.top.reduce((a, b) => a + b, 0);
  const bottom = open.bottom.reduce((a, b) => a + b, 0);
  const left = Math.max(0, gap - top - bottom);
  const start = keepTop;
  const end = rows.length - keepBottom;

  const chunk = (key: string, from: number, to: number) => (
    <motion.div
      key={key}
      initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      transition={reduce ? { duration: 0.12 } : { height: { duration: 0.28, ease: ease.inOut }, opacity: { duration: 0.2, delay: 0.06 } }}
      className="overflow-hidden"
    >
      <SameRows rows={rows.slice(from, to)} view={view} />
    </motion.div>
  );

  // Chunks revealed downward from the change above, in the order they were opened.
  const before = (list: number[], i: number) => list.slice(0, i).reduce((a, b) => a + b, 0);
  const topChunks = open.top.map((n, i) => chunk(`t${i}`, start + before(open.top, i), start + before(open.top, i) + n));
  // Chunks revealed upward from the change below: each new one lands above the last.
  const bottomChunks = open.bottom.map((n, i) => chunk(`b${i}`, end - before(open.bottom, i) - n, end - before(open.bottom, i))).reverse();

  const { first, last } = seg;
  const hiddenFrom = start + top;

  return (
    <>
      <SameRows rows={rows.slice(0, gap ? start : rows.length)} view={view} />
      {gap > 0 && (
        <>
          {topChunks}
          <AnimatePresence initial={false}>
            {left > 0 && (
              <motion.div
                key="gap"
                exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0, transition: { duration: 0.2, ease: ease.inOut } }}
                className="overflow-hidden"
              >
                <Expander
                  left={left}
                  view={view}
                  from={rows[hiddenFrom]?.b.no ?? 0}
                  atTop={first && top === 0}
                  atBottom={last && bottom === 0}
                  // At the top of the file there's nothing above to extend down from, and at the end nothing below to extend up from.
                  canDown={!first}
                  canUp={!last}
                  onDown={() => reveal(seg.id, "top", Math.min(STEP, left))}
                  onUp={() => reveal(seg.id, "bottom", Math.min(STEP, left))}
                  onAll={() => reveal(seg.id, "top", left)}
                />
              </motion.div>
            )}
          </AnimatePresence>
          {bottomChunks}
          <SameRows rows={rows.slice(end)} view={view} />
        </>
      )}
    </>
  );
}

function Expander({
  left,
  view,
  from,
  atTop,
  atBottom,
  canUp,
  canDown,
  onUp,
  onDown,
  onAll,
}: {
  left: number;
  view: DiffView;
  from: number;
  atTop: boolean;
  atBottom: boolean;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onAll: () => void;
}) {
  const reduce = useReducedMotion();
  const partial = left > STEP;
  // Showing everything removes this row. If it held keyboard focus, hand focus to the next fold, or to the viewer.
  const all = (e: React.MouseEvent<HTMLButtonElement>) => {
    const from = e.currentTarget;
    const keyboard = from.matches(":focus-visible");
    const viewer = from.closest<HTMLElement>("[data-diff]");
    const rows = viewer ? [...viewer.querySelectorAll<HTMLElement>("[data-expand-all]")] : [];
    const mine = from.closest("[data-expander]")?.querySelector<HTMLElement>("[data-expand-all]");
    const next = rows[rows.indexOf(mine as HTMLElement) + 1] ?? viewer;
    onAll();
    if (keyboard) requestAnimationFrame(() => next?.focus({ preventScroll: true }));
  };
  const icon = cn(
    "relative grid size-6 place-items-center rounded-md text-fg-3 outline-none",
    "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.9] active:duration-75",
    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
    "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
  );
  return (
    <div data-expander="" className={cn("flex h-8 items-center border-y border-line bg-fg/[0.025] font-sans", atTop && "border-t-0", atBottom && "border-b-0")}>
      {/* The controls sit in the gutter and the label starts where the code does. */}
      <div
        className={cn(
          "flex shrink-0 items-center justify-end gap-0.5 pr-1.5 font-mono",
          view === "unified" ? "w-[calc(var(--digits)*2ch+2.5rem)] @max-[420px]:w-[calc(var(--digits)*2ch+1.5rem)]" : "w-[calc(var(--digits)*1ch+1.25rem)]",
        )}
      >
        {partial && canDown && (
          <button type="button" onClick={onDown} aria-label={`Show ${STEP} lines below the change above`} className={icon}>
            <FoldIcon dir="down" />
          </button>
        )}
        {partial && canUp && (
          <button type="button" onClick={onUp} aria-label={`Show ${STEP} lines above the change below`} className={icon}>
            <FoldIcon dir="up" />
          </button>
        )}
        {!partial && (
          // The label beside it does the same thing, so this one stays out of the tab order.
          <button type="button" tabIndex={-1} onClick={all} aria-label={`Show ${left} unchanged lines`} className={icon}>
            <ChevronsUpDown size={14} />
          </button>
        )}
      </div>
      <button
        type="button"
        data-expand-all=""
        onClick={all}
        className={cn(
          "group/all flex h-full min-w-0 flex-1 items-center gap-2 pl-6 pr-3 @max-[420px]:pl-5 text-left text-[12px] text-fg-3 outline-none",
          "rounded-md transition-colors duration-150 hover:text-fg-2",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-4 focus-visible:outline-fg-3",
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          <NumberFlow
            value={left}
            className="tabular"
            transformTiming={{ duration: reduce ? 0 : 420, easing: easeOut }}
            spinTiming={{ duration: reduce ? 0 : 420, easing: easeOut }}
            opacityTiming={{ duration: reduce ? 120 : 240, easing: "ease-out" }}
          />{" "}
          unchanged {left === 1 ? "line" : "lines"}
        </span>
        <span className="shrink-0 font-mono text-2xs tabular text-fg-4 transition-colors duration-150 group-hover/all:text-fg-3">
          {left === 1 ? `Line ${from}` : `Lines ${from}–${from + left - 1}`}
        </span>
      </button>
    </div>
  );
}

function FoldIcon({ dir }: { dir: "up" | "down" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {dir === "up" ? <path d="M4.5 7.5 8 4l3.5 3.5M3 12h10" /> : <path d="M3 4h10M4.5 8.5 8 12l3.5-3.5" />}
    </svg>
  );
}
