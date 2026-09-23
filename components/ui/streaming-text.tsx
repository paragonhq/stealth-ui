"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/cn";
import { Alert, ArrowUpRight, Refresh } from "@/lib/icons";
import { ease } from "@/lib/motion";

export type StreamStatus = "streaming" | "done" | "stopped" | "error";

type Chunk = { start: number; at: number };
type View = { shown: string; chunks: Chunk[] };

/** How long a chunk takes to fade in, and how long it keeps its own span. */
const FADE = 380;
const FRESH = 700;
/** Revealing at most every other frame keeps the number of chunks (and spans) down. */
const MIN_STEP = 32;

// The server's pacing is bursty: forty characters at once, then nothing for 300ms.
// This reveals whatever has arrived over the next few frames, a whole word at a
// time, so the text flows instead of landing in lumps. It never runs behind the
// stream by more than ~100ms, and never slower than it: the whole backlog is
// always out within a handful of frames.
function useRevealedText(text: string, { streaming, smooth }: { streaming: boolean; smooth: boolean }): View {
  const model = useRef<View & { last: number }>({ shown: text, chunks: [], last: 0 });
  const [view, setView] = useState<View>({ shown: text, chunks: [] });

  useEffect(() => {
    const m = model.current;
    let raf = 0;
    let dirty = false;

    // A different text (a regenerated reply, another message) starts over. When
    // nothing is streaming there is nothing to reveal: show it as it is.
    if (!text.startsWith(m.shown)) {
      m.shown = streaming ? "" : text;
      m.chunks = [];
      m.last = 0;
      dirty = true;
    }

    const step = (now: number) => {
      const backlog = text.length - m.shown.length;
      if (backlog > 0 && !(smooth && now - m.last < MIN_STEP)) {
        const dt = m.last ? Math.min(now - m.last, 100) : MIN_STEP;
        // Catch up on about a third of the backlog per step, faster once the stream has ended.
        let end = smooth ? m.shown.length + Math.max(3, Math.ceil(backlog * Math.min(1, dt / (streaming ? 100 : 50)))) : text.length;
        if (end < text.length) {
          // Finish the word in progress so a word never arrives in two halves.
          const next = text.slice(end, end + 18).search(/\s/);
          end = next >= 0 ? end + next : end + 18;
        }
        end = Math.min(end, text.length);
        m.chunks = [...m.chunks.filter((c) => now - c.at < FRESH * 2), { start: m.shown.length, at: now }];
        m.shown = text.slice(0, end);
        m.last = now;
        dirty = true;
      }
      if (dirty) {
        setView({ shown: m.shown, chunks: m.chunks });
        dirty = false;
      }
      if (m.shown.length < text.length) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, streaming, smooth]);

  return view;
}

/**
 * The text a streaming reply should show right now, revealed a word at a time
 * without falling behind the stream. Use it on its own when you render the text
 * yourself.
 */
export function useSmoothText(text: string, streaming = true) {
  return useRevealedText(text, { streaming, smooth: true }).shown;
}

/* -------------------------------------------------------------------------------------------------
 * Blocks: a small, forgiving markdown reader. It knows what an unfinished block
 * looks like, so a reply never flashes raw syntax on its way to being formatted.
 * -----------------------------------------------------------------------------------------------*/

type Range = [number, number];
type Block =
  | { kind: "p"; start: number; lines: Range[] }
  | { kind: "h"; start: number; level: number; lines: Range[] }
  | { kind: "quote"; start: number; lines: Range[] }
  | { kind: "list"; start: number; ordered: boolean; items: { start: number; n: number; depth: number; lines: Range[] }[] }
  | { kind: "code"; start: number; lang: string; body: Range; closed: boolean }
  | { kind: "hr"; start: number };

const fenceRe = /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/;
const headingRe = /^ {0,3}(#{1,6})\s+/;
const bulletRe = /^(\s*)([-*+])\s+/;
const orderedRe = /^(\s*)(\d{1,9})[.)]\s+/;
const quoteRe = /^ {0,3}>\s?/;
const hrRe = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
// A last line that could still turn into a heading, list, quote, rule or fence:
// hold it back until the next character decides, instead of flashing "#" or "-".
const pendingRe = /^\s*(#{1,6}|[-*+]|\d{1,9}[.)]?|>|`{1,3}[\w+#.-]*|~{1,3}|-{2,}|\*{2,}|_{2,})$/;

function parse(src: string, streaming: boolean): { blocks: Block[]; end: number } {
  const lines: Range[] = [];
  let at = 0;
  while (at <= src.length) {
    const nl = src.indexOf("\n", at);
    const e = nl < 0 ? src.length : nl;
    lines.push([at, e]);
    if (nl < 0) break;
    at = nl + 1;
  }
  let end = src.length;
  const last = lines[lines.length - 1];
  if (streaming && last && pendingRe.test(src.slice(last[0], last[1]))) {
    end = last[0];
    lines.pop();
  }

  const blocks: Block[] = [];
  const line = (r: Range) => src.slice(r[0], r[1]);
  let i = 0;
  while (i < lines.length) {
    const r = lines[i];
    const text = line(r);
    if (!text.trim()) {
      i++;
      continue;
    }
    const fence = fenceRe.exec(text);
    if (fence) {
      const marker = fence[1];
      const bodyStart = r[1] + 1;
      let j = i + 1;
      while (j < lines.length && !line(lines[j]).trimStart().startsWith(marker)) j++;
      const closed = j < lines.length;
      const bodyEnd = closed ? Math.max(bodyStart, lines[j][0] - 1) : end;
      blocks.push({ kind: "code", start: r[0], lang: fence[2], body: [Math.min(bodyStart, end), Math.max(Math.min(bodyStart, end), bodyEnd)], closed });
      i = closed ? j + 1 : lines.length;
      continue;
    }
    if (hrRe.test(text)) {
      blocks.push({ kind: "hr", start: r[0] });
      i++;
      continue;
    }
    const heading = headingRe.exec(text);
    if (heading) {
      blocks.push({ kind: "h", start: r[0], level: heading[1].length, lines: [[r[0] + heading[0].length, r[1]]] });
      i++;
      continue;
    }
    if (quoteRe.test(text)) {
      const out: Range[] = [];
      while (i < lines.length && quoteRe.test(line(lines[i]))) {
        const m = quoteRe.exec(line(lines[i]))!;
        out.push([lines[i][0] + m[0].length, lines[i][1]]);
        i++;
      }
      blocks.push({ kind: "quote", start: r[0], lines: out });
      continue;
    }
    const first = bulletRe.exec(text) ?? orderedRe.exec(text);
    if (first) {
      const ordered = !bulletRe.test(text);
      const items: { start: number; n: number; depth: number; lines: Range[] }[] = [];
      while (i < lines.length) {
        const t = line(lines[i]);
        const m = ordered ? orderedRe.exec(t) : bulletRe.exec(t);
        if (m) {
          items.push({ start: lines[i][0], n: ordered ? Number(m[2]) : 0, depth: Math.min(3, Math.floor(m[1].replace(/\t/g, "  ").length / 2)), lines: [[lines[i][0] + m[0].length, lines[i][1]]] });
          i++;
        } else if (t.trim() && /^\s{2,}/.test(t) && items.length) {
          // An indented line continues the item above it.
          const lead = t.length - t.trimStart().length;
          items[items.length - 1].lines.push([lines[i][0] + lead, lines[i][1]]);
          i++;
        } else break;
      }
      blocks.push({ kind: "list", start: r[0], ordered, items });
      continue;
    }
    const out: Range[] = [];
    while (i < lines.length) {
      const t = line(lines[i]);
      if (!t.trim() || fenceRe.test(t) || headingRe.test(t) || quoteRe.test(t) || bulletRe.test(t) || orderedRe.test(t) || hrRe.test(t)) break;
      out.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "p", start: r[0], lines: out });
  }
  return { blocks, end };
}

const safeHref = (href: string) => (/^(https?:|mailto:)/i.test(href.trim()) ? href.trim() : undefined);

type Ctx = {
  src: string;
  /** Where the visible text ends. Unclosed marks are only forgiven here, and only while streaming. */
  tail: number;
  streaming: boolean;
  fresh: Chunk[];
};

/** Plain text for [a, b), cut into one span per recent chunk so each can fade on its own. */
function runs(ctx: Ctx, a: number, b: number): React.ReactNode[] {
  if (a >= b) return [];
  const out: React.ReactNode[] = [];
  const cuts = ctx.fresh.filter((c) => c.start < b);
  const firstFresh = cuts.find((c, k) => c.start >= a || (cuts[k + 1]?.start ?? Infinity) > a);
  let p = a;
  if (!firstFresh) return [ctx.src.slice(a, b)];
  if (firstFresh.start > a) {
    out.push(ctx.src.slice(a, firstFresh.start));
    p = firstFresh.start;
  }
  for (let k = cuts.indexOf(firstFresh); k < cuts.length && p < b; k++) {
    const q = Math.min(b, cuts[k + 1]?.start ?? b);
    if (q > p) {
      out.push(
        <span key={p} data-chunk="" data-at={cuts[k].at}>
          {ctx.src.slice(p, q)}
        </span>,
      );
    }
    p = q;
  }
  return out;
}

const closer = (src: string, from: number, to: number, mark: string) => {
  for (let j = src.indexOf(mark, from); j >= 0 && j + mark.length <= to; j = src.indexOf(mark, j + 1)) {
    if (src[j - 1] !== " " && src[j - 1] !== "\\") return j;
  }
  return -1;
};

function inline(ctx: Ctx, a: number, b: number): React.ReactNode[] {
  const { src } = ctx;
  const atTail = ctx.streaming && b >= ctx.tail;
  const out: React.ReactNode[] = [];
  let text = a;
  let i = a;
  const flush = (to: number) => {
    out.push(...runs(ctx, text, to));
  };
  while (i < b) {
    const ch = src[i];
    if (ch === "\\" && i + 1 < b && /[\\`*_[\]()#>~-]/.test(src[i + 1])) {
      flush(i);
      text = i + 1;
      i += 2;
      continue;
    }
    if (ch === "`") {
      const j = src.indexOf("`", i + 1);
      const end = j >= 0 && j < b ? j : atTail ? b : -1;
      if (end > i) {
        flush(i);
        out.push(
          <code key={`c${i}`} className="rounded-[5px] border border-line bg-fg/[0.04] px-[5px] py-px font-mono text-[0.88em] text-fg [overflow-wrap:anywhere]">
            {runs(ctx, i + 1, end)}
          </code>,
        );
        i = text = Math.min(b, end + 1);
        continue;
      }
    }
    const double = (src.startsWith("**", i) || src.startsWith("__", i)) && src[i + 2] && src[i + 2] !== " ";
    if (double) {
      const mark = src.slice(i, i + 2);
      const j = closer(src, i + 2, b, mark);
      const end = j >= 0 ? j : atTail ? b : -1;
      if (end > i) {
        flush(i);
        out.push(
          <strong key={`s${i}`} className="font-medium text-fg">
            {inline(ctx, i + 2, end)}
          </strong>,
        );
        i = text = Math.min(b, end + 2);
        continue;
      }
    }
    const single = (ch === "*" || (ch === "_" && !/\w/.test(src[i - 1] ?? ""))) && src[i + 1] && src[i + 1] !== " " && src[i + 1] !== ch;
    if (single) {
      const j = closer(src, i + 1, b, ch);
      const end = j >= 0 && src[j + 1] !== ch ? j : atTail && j < 0 ? b : -1;
      if (end > i) {
        flush(i);
        out.push(<em key={`e${i}`}>{inline(ctx, i + 1, end)}</em>);
        i = text = Math.min(b, end + 1);
        continue;
      }
    }
    if (ch === "[") {
      const close = src.indexOf("]", i + 1);
      if (close >= 0 && close < b && src[close + 1] === "(") {
        const paren = src.indexOf(")", close + 2);
        if (paren >= 0 && paren < b) {
          flush(i);
          const href = safeHref(src.slice(close + 2, paren));
          const label = inline(ctx, i + 1, close);
          out.push(
            href ? (
              <a
                key={`a${i}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-fg underline decoration-fg-4 underline-offset-[3px] transition-[text-decoration-color] duration-150 hover:decoration-fg-2"
              >
                {label}
                <ArrowUpRight size={12} className="ml-0.5 inline-block -translate-y-px align-middle text-fg-3" />
              </a>
            ) : (
              <Fragment key={`a${i}`}>{label}</Fragment>
            ),
          );
          i = text = paren + 1;
          continue;
        }
        if (atTail) {
          // The address is still arriving: show the words, hide the half-written URL.
          flush(i);
          out.push(<span key={`a${i}`} className="text-fg underline decoration-fg-4 underline-offset-[3px]">{inline(ctx, i + 1, close)}</span>);
          i = text = b;
          continue;
        }
      } else if (atTail && (close < 0 || close >= b)) {
        flush(i);
        out.push(<Fragment key={`a${i}`}>{inline(ctx, i + 1, b)}</Fragment>);
        i = text = b;
        continue;
      }
    }
    i++;
  }
  flush(b);
  return out;
}

/* -------------------------------------------------------------------------------------------------
 * StreamingText
 * -----------------------------------------------------------------------------------------------*/

export type StreamingTextProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Everything received so far. Append to it as tokens arrive; replace it to start over. */
  text: string;
  /** "streaming" while tokens arrive. "stopped" and "error" keep the partial text and say so beneath it. */
  status?: StreamStatus;
  /** Reveal bursts a word at a time over a few frames instead of in lumps. */
  smooth?: boolean;
  /** "md" for the reply itself; "sm" for secondary streams such as reasoning or a side panel. */
  size?: "sm" | "md";
  /** Shown under a stopped reply. */
  stoppedLabel?: string;
  /** Shown under a reply that failed partway. */
  errorLabel?: string;
  /** Adds a Continue button to a stopped reply. */
  onContinue?: () => void;
  /** Adds a Try again button to a failed reply. */
  onRetry?: () => void;
};

export function StreamingText({
  text,
  status = "done",
  smooth = true,
  size = "md",
  stoppedLabel = "Stopped",
  errorLabel = "The reply didn’t finish",
  onContinue,
  onRetry,
  className,
  ref,
  ...rest
}: StreamingTextProps) {
  const reduce = !!useReducedMotion();
  const streaming = status === "streaming";
  const { shown, chunks } = useRevealedText(text, { streaming, smooth: smooth && !reduce });
  const rootRef = useRef<HTMLDivElement | null>(null);

  const latest = chunks.length ? chunks[chunks.length - 1].at : 0;
  const fresh = chunks.filter((c) => latest - c.at < FRESH);
  const { blocks, end } = parse(shown, streaming);
  const ctx: Ctx = { src: shown, tail: end, streaming, fresh };
  const lastBlock = blocks[blocks.length - 1];

  // Each new chunk fades in once. A span that React re-creates (because the
  // text around it became bold or a list) resumes its fade where it was rather
  // than starting again, so formatting never makes old words flicker.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || reduce) return;
    const now = performance.now();
    root.querySelectorAll<HTMLElement>("[data-chunk]:not([data-faded])").forEach((el) => {
      el.setAttribute("data-faded", "");
      const age = now - Number(el.dataset.at);
      if (age >= FADE) return;
      const anim = el.animate([{ opacity: 0, filter: "blur(2px)" }, { opacity: 1, filter: "blur(0px)" }], {
        duration: FADE,
        easing: `cubic-bezier(${ease.out.join(",")})`,
        fill: "backwards",
      });
      anim.currentTime = Math.max(0, age);
    });
  });

  // The caret is re-keyed by every chunk: it holds steady while words arrive and
  // starts to blink only after the stream has gone quiet for half a second.
  const caret = streaming ? <Caret key={`caret-${latest}`} /> : null;

  return (
    <div
      ref={(node) => {
        rootRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      data-status={status}
      data-size={size}
      aria-busy={streaming || undefined}
      className={cn(
        "flex min-w-0 flex-col [overflow-wrap:break-word]",
        size === "sm" ? "gap-2 text-[12.5px] leading-5 text-fg-2" : "gap-3 text-[13.5px] leading-[22px] text-fg",
        className,
      )}
      {...rest}
    >
      {blocks.map((block) => (
        <BlockView key={block.start} block={block} ctx={ctx} caret={block === lastBlock ? caret : null} />
      ))}
      {!blocks.length && streaming && <p className="min-h-[1lh]">{caret}</p>}

      <AnimatePresence initial={false}>
        {(status === "stopped" || status === "error") && (
          <motion.div
            key={status}
            role="status"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.24, ease: ease.out }}
            className={cn("-mt-0.5 flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-4", status === "error" ? "text-danger" : "text-fg-3")}
          >
            {status === "error" ? <Alert size={14} className="shrink-0" /> : <span aria-hidden className="size-2 shrink-0 rounded-[2px] bg-current" />}
            <span>{status === "error" ? errorLabel : stoppedLabel}</span>
            {status === "stopped" && onContinue && <FooterButton onClick={onContinue}>Continue</FooterButton>}
            {status === "error" && onRetry && (
              <FooterButton onClick={onRetry} icon>
                Try again
              </FooterButton>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FooterButton({ children, icon, ...rest }: React.ComponentProps<"button"> & { icon?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "relative -my-1 inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none",
        "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
      )}
      {...rest}
    >
      {icon && <Refresh size={14} className="text-fg-3" />}
      {children}
    </button>
  );
}

function Caret() {
  return (
    <span
      aria-hidden
      data-caret=""
      className={cn(
        "ml-[2px] inline-block h-[1.1em] w-[0.52em] translate-y-[0.2em] rounded-[2px] bg-current opacity-80",
        "animate-caret [animation-delay:500ms] motion-reduce:animate-none",
      )}
    />
  );
}

const headingClass: Record<number, string> = {
  1: "text-[15px] leading-[22px] font-medium tracking-[-0.015em] text-fg",
  2: "text-[14px] leading-[22px] font-medium tracking-[-0.01em] text-fg",
  3: "text-[13.5px] leading-[22px] font-medium text-fg",
};

function Lines({ ctx, lines, caret }: { ctx: Ctx; lines: Range[]; caret?: React.ReactNode }) {
  return (
    <>
      {lines.map((r, k) => (
        <Fragment key={r[0]}>
          {k > 0 && <br />}
          {inline(ctx, r[0], r[1])}
        </Fragment>
      ))}
      {caret}
    </>
  );
}

function BlockView({ block, ctx, caret }: { block: Block; ctx: Ctx; caret: React.ReactNode }) {
  switch (block.kind) {
    case "p":
      return (
        <p>
          <Lines ctx={ctx} lines={block.lines} caret={caret} />
        </p>
      );
    case "h": {
      // A reply is not a page: its headings sit a level or two below the app's.
      const Tag = (["h3", "h4", "h5"] as const)[Math.min(block.level, 3) - 1];
      return (
        <Tag className={cn("-mb-1 pt-1", headingClass[Math.min(block.level, 3)])}>
          <Lines ctx={ctx} lines={block.lines} caret={caret} />
        </Tag>
      );
    }
    case "quote":
      return (
        <blockquote className="border-s-2 border-line-2 ps-3 text-fg-2">
          <Lines ctx={ctx} lines={block.lines} caret={caret} />
        </blockquote>
      );
    case "hr":
      return <hr className="my-1 border-0 border-t border-line" />;
    case "list": {
      const List = block.ordered ? "ol" : "ul";
      const last = block.items[block.items.length - 1];
      return (
        <List role="list" className="flex flex-col gap-1.5">
          {block.items.map((item) => (
            <li key={item.start} value={block.ordered ? item.n : undefined} style={{ marginInlineStart: item.depth * 18 }} className="relative ps-5">
              {block.ordered ? (
                <span aria-hidden className="absolute start-0 top-0 font-mono text-[12px] text-fg-3 tabular">
                  {item.n}.
                </span>
              ) : (
                <span aria-hidden className="absolute start-1.5 top-[calc(0.5lh-2.5px)] size-[5px] rounded-full bg-fg-4" />
              )}
              <Lines ctx={ctx} lines={item.lines} caret={item === last ? caret : null} />
            </li>
          ))}
        </List>
      );
    }
    case "code": {
      const code = ctx.src.slice(block.body[0], block.body[1]);
      const done = block.closed || !ctx.streaming;
      return (
        <div className="overflow-hidden rounded-lg border border-line bg-raised">
          <div className="flex h-8 items-center justify-between gap-2 border-b border-line pl-3 pr-1">
            <span className="truncate font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">{block.lang || "code"}</span>
            <motion.span initial={false} animate={{ opacity: done ? 1 : 0 }} transition={{ duration: 0.16 }} inert={!done}>
              <CopyButton value={code} iconOnly variant="ghost" size="sm" label="Copy code" />
            </motion.span>
          </div>
          <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[12.5px] leading-5 text-fg [scrollbar-width:thin]">
            <code>
              {runs(ctx, block.body[0], block.body[1])}
              {caret}
            </code>
          </pre>
        </div>
      );
    }
  }
}
