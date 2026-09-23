"use client";
import { Tooltip } from "@base-ui/react/tooltip";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/cn";
import { Refresh } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

export type TerminalTone = "default" | "muted" | "success" | "error" | "warning" | "info";

export type TerminalLine =
  /** Typed character by character, after the prompt. */
  | { kind: "command"; text: string; cwd?: string }
  /** Streams in after the command that produced it. */
  | { kind: "output"; text: string; tone?: TerminalTone }
  /** A spinner for `duration` ms, then a tick (or a cross) and the `done` text. */
  | { kind: "task"; text: string; done?: string; duration?: number; failed?: boolean }
  | { kind: "blank" };

const TONE: Record<TerminalTone, string> = {
  default: "text-fg-2",
  muted: "text-fg-3",
  success: "text-success",
  error: "text-danger",
  warning: "text-warning",
  info: "text-info",
};

/* -------------------------------------------------------------------------------------------------
 * Pacing. Deterministic per line, so a replay types the same way and nothing random reaches render.
 * -----------------------------------------------------------------------------------------------*/

function seeded(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Milliseconds before each character of a command, the way a person types: bursts inside words, a beat at spaces and symbols. */
function keystrokes(text: string, speed: number) {
  const rand = seeded(text);
  return [...text].map((ch, i) => {
    let ms = 34 + rand() * 46;
    if (ch === " ") ms += 40 + rand() * 50;
    if (/[-@/.=]/.test(ch)) ms += 30;
    if (i > 0 && text[i - 1] === ch) ms *= 0.6; // double letters roll
    if (rand() < 0.04) ms += 160; // the occasional hesitation
    return ms / speed;
  });
}

/* -------------------------------------------------------------------------------------------------
 * Terminal
 * -----------------------------------------------------------------------------------------------*/

export type TerminalProps = Omit<React.ComponentProps<"div">, "title"> & {
  lines: TerminalLine[];
  /** Window title, e.g. "zsh — ~/storefront". */
  title?: string;
  /** Prompt glyph before each command. */
  prompt?: string;
  /** Type and stream when it scrolls into view. Off renders the whole session at once. */
  animate?: boolean;
  /** Pacing multiplier: 2 is twice as fast. */
  speed?: number;
  /** Called once the last line has played. */
  onDone?: () => void;
};

type Pos = { line: number; chars: number };

const REDUCE = "(prefers-reduced-motion: reduce)";
const onReduceChange = (notify: () => void) => {
  const m = window.matchMedia(REDUCE);
  m.addEventListener("change", notify);
  return () => m.removeEventListener("change", notify);
};
/** Reduced motion that hydrates as "no preference" and then corrects itself, because what renders (typed or complete) depends on it. */
function useReduce() {
  return useSyncExternalStore(onReduceChange, () => window.matchMedia(REDUCE).matches, () => false);
}

export function Terminal({
  lines,
  title = "Terminal",
  prompt = "$",
  animate = true,
  speed = 1,
  onDone,
  className,
  ...rest
}: TerminalProps) {
  const reduce = useReduce();
  const playing = animate && !reduce;
  const end: Pos = { line: lines.length, chars: 0 };
  const [pos, setPos] = useState<Pos>({ line: 0, chars: 0 });
  const [run, setRun] = useState(0); // bumps on replay
  const [visible, setVisible] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const doneRef = useRef(onDone);
  const reported = useRef(false);
  useEffect(() => {
    doneRef.current = onDone;
  });

  const shown = playing ? pos : end;
  const finished = shown.line >= lines.length;

  // Only plays while on screen and while the tab is visible; it picks up where it left off.
  useEffect(() => {
    const el = root.current;
    if (!el || !playing) return;
    let inView = false;
    const sync = () => setVisible(inView && document.visibilityState === "visible");
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    }, { threshold: 0.35 });
    io.observe(el);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [playing]);

  // The clock: one timeout at a time, scheduling the next beat from the current position.
  useEffect(() => {
    if (!playing || !visible) return;
    if (pos.line >= lines.length) {
      // Once per playthrough, even if it scrolls away and back after finishing.
      if (!reported.current) doneRef.current?.();
      reported.current = true;
      return;
    }
    const line = lines[pos.line];
    const prev = lines[pos.line - 1];
    let wait: number;
    let next: Pos;
    if (line.kind === "command") {
      const keys = keystrokes(line.text, speed);
      if (pos.chars < line.text.length) {
        // A pause to "think" before the first key of a command, longer after output than at the start.
        wait = pos.chars === 0 ? (pos.line === 0 ? 500 : 650) / speed : keys[pos.chars];
        next = { line: pos.line, chars: pos.chars + 1 };
      } else {
        wait = 320 / speed; // the beat before Enter
        next = { line: pos.line + 1, chars: 0 };
      }
    } else if (line.kind === "task") {
      wait = (line.duration ?? 1100) / speed;
      next = { line: pos.line + 1, chars: 0 };
    } else {
      // Output streams: the first line after a command takes a moment, the rest arrive in a burst.
      const rand = seeded(`${pos.line}${line.kind === "output" ? line.text : ""}`);
      wait = (prev?.kind === "command" ? 180 + rand() * 160 : 40 + rand() * 90) / speed;
      next = { line: pos.line + 1, chars: 0 };
    }
    const t = window.setTimeout(() => setPos(next), wait);
    return () => window.clearTimeout(t);
  }, [playing, visible, pos, lines, speed, run]);

  // Fades whichever edge has more to scroll to, written straight to the element so scrolling never re-renders.
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // While it plays, lines below the active one are laid out but not shown yet, so they don't count as "more".
        const last = el.querySelector<HTMLElement>("[data-active]");
        const end = last ? last.offsetTop + last.offsetHeight + 16 : el.scrollHeight;
        const below = Math.min(el.scrollHeight, end) - el.clientHeight - el.scrollTop;
        el.style.setProperty("--fade-top", el.scrollTop > 2 ? "28px" : "0px");
        el.style.setProperty("--fade-bottom", below > 2 ? "28px" : "0px");
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [pos, playing]);

  // Keep the active line in view while it plays, unless the reader has scrolled away to look at something.
  useEffect(() => {
    const el = body.current;
    if (!el || !playing || !follow.current) return;
    const active = el.querySelector<HTMLElement>("[data-active]");
    if (!active) return;
    const bottom = active.offsetTop + active.offsetHeight + 16;
    if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
  }, [pos, playing]);

  const replay = () => {
    follow.current = true;
    reported.current = false;
    if (body.current) body.current.scrollTop = 0;
    setPos({ line: 0, chars: 0 });
    setRun((r) => r + 1);
  };
  const skip = () => setPos(end);

  const commands = lines.flatMap((l) => (l.kind === "command" ? [l.text] : [])).join("\n");

  return (
    <div
      ref={root}
      data-state={finished ? "done" : "running"}
      className={cn("flex min-w-0 flex-col overflow-hidden rounded-xl border border-line-2 bg-frame shadow-[var(--shadow)]", className)}
      {...rest}
    >
      <Tooltip.Provider delay={500}>
        <div className="relative flex h-10 shrink-0 items-center border-b border-line bg-raised px-3">
          <span aria-hidden className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2.5 rounded-full bg-fg/12 ring-1 ring-inset ring-fg/[0.06]" />
            ))}
          </span>
          <span className="pointer-events-none absolute inset-x-24 truncate text-center font-mono text-[11.5px] text-fg-3">{title}</span>
          <span className="ml-auto flex items-center gap-0.5">
            {playing && (
              <Hint label={finished ? "Replay" : "Skip to the end"}>
                <button type="button" onClick={finished ? replay : skip} aria-label={finished ? "Replay" : "Skip to the end"} className={iconButton}>
                  <span className="relative grid size-4 place-items-center">
                    <AnimatePresence initial={false}>
                      <motion.span
                        key={finished ? "replay" : "skip"}
                        className="absolute inset-0 grid place-items-center"
                        initial={{ opacity: 0, scale: 0.5, filter: "blur(3px)" }}
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, scale: 0.5, filter: "blur(3px)" }}
                        transition={spring.pop}
                      >
                        {finished ? <Refresh size={15} className="transition-transform duration-500 ease-out-expo group-hover/icon:-rotate-90" /> : <SkipIcon />}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                </button>
              </Hint>
            )}
            {commands && (
              <Hint label="Copy commands">
                <CopyButton value={commands} iconOnly variant="ghost" size="sm" label="Copy commands" />
              </Hint>
            )}
          </span>
        </div>
      </Tooltip.Provider>

      {/* Screen readers get the whole session once; the typing is for eyes only. */}
      <div className="sr-only">
        {lines.map((l, i) => (
          <p key={i}>{l.kind === "command" ? `${prompt} ${l.text}` : l.kind === "task" ? (l.done ?? l.text) : l.kind === "output" ? l.text : ""}</p>
        ))}
      </div>

      <div
        className={cn(
          "relative flex min-h-0 flex-1 flex-col",
          // The focus ring sits above the scroller, whose edge fades would otherwise fade the ring too.
          "after:pointer-events-none after:absolute after:inset-0 after:rounded-b-[calc(var(--radius-xl)-1px)] after:content-['']",
          "has-[[role=region]:focus-visible]:after:shadow-[inset_0_0_0_1px_var(--fg-3)]",
        )}
      >
        <div
          ref={body}
          // The scroller is focusable so arrow keys can page through it; what it shows is for eyes only (see the transcript above).
          role="region"
          aria-label={`${title} output`}
          tabIndex={0}
          onWheel={() => (follow.current = false)}
          onTouchMove={() => (follow.current = false)}
          onKeyDown={() => (follow.current = false)}
          className={cn(
            "min-h-0 flex-1 overflow-auto overscroll-contain p-4 font-mono text-[12.5px] leading-5 outline-none",
            // Lines fade under the title bar and at the bottom edge instead of being sliced, and only where there is more.
            "[mask-image:linear-gradient(to_bottom,transparent,var(--fg)_var(--fade-top,0px),var(--fg)_calc(100%-var(--fade-bottom,0px)),transparent)]",
          )}
        >
          <div aria-hidden className="w-max min-w-full">
            {/* Every line is laid out from the start and revealed in place, so the window never grows while it plays. */}
            {lines.map((line, i) => {
              const state = i < shown.line ? "done" : i === shown.line ? "active" : "pending";
              return <Row key={`${run}-${i}`} line={line} state={state} chars={shown.chars} prompt={prompt} playing={playing} reduce={!!reduce} />;
            })}
            <div data-active={finished || undefined} className={cn("flex whitespace-pre", !finished && "invisible")}>
              <Prompt prompt={prompt} cwd={lastCwd(lines)} />
              <Caret />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const lastCwd = (lines: TerminalLine[]) => {
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (l.kind === "command") return l.cwd;
  }
};

function Row({ line, state, chars, prompt, playing, reduce }: { line: TerminalLine; state: "done" | "active" | "pending"; chars: number; prompt: string; playing: boolean; reduce: boolean }) {
  const pending = state === "pending";
  const active = state === "active";

  if (line.kind === "blank") return <div data-active={active || undefined} className="h-5" />;

  if (line.kind === "command") {
    const typing = active && playing;
    return (
      <div data-active={active || undefined} className={cn("flex min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]", pending && "invisible", !pending && "mt-1 first:mt-0")}>
        <Prompt prompt={prompt} cwd={line.cwd} />
        {typing ? (
          // The full command reserves the space; the typed part sits on top of it.
          <span className="grid min-w-0 flex-1">
            <span className="invisible col-start-1 row-start-1">{line.text}</span>
            <span className="col-start-1 row-start-1 text-fg">
              {line.text.slice(0, chars)}
              <Caret />
            </span>
          </span>
        ) : (
          <span className="min-w-0 flex-1 text-fg">{line.text}</span>
        )}
      </div>
    );
  }

  if (line.kind === "task") {
    const running = active && playing;
    const glyph = running ? "spin" : line.failed ? "fail" : "ok";
    return (
      <div data-active={active || undefined} className={cn("flex min-w-0 gap-2 whitespace-pre-wrap", pending && "invisible")}>
        <span className="relative grid w-[1ch] shrink-0 place-items-center">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={glyph}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              transition={reduce ? { duration: 0.12 } : spring.pop}
              className={cn(glyph === "ok" ? "text-success" : glyph === "fail" ? "text-danger" : "text-fg-3")}
            >
              {glyph === "spin" ? <Spinner /> : glyph === "ok" ? "✓" : "✗"}
            </motion.span>
          </AnimatePresence>
        </span>
        {/* Both texts share one cell, so resolving never reflows the lines below. */}
        <span className="grid min-w-0 flex-1">
          <span className="invisible col-start-1 row-start-1">{line.text}</span>
          {line.done && <span className="invisible col-start-1 row-start-1">{line.done}</span>}
          <AnimatePresence initial={false}>
            <motion.span
              key={running ? "run" : "done"}
              className={cn("col-start-1 row-start-1", running ? "text-fg-2" : line.failed ? "text-danger" : "text-fg")}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              transition={{ duration: 0.16, ease: ease.out }}
            >
              {running ? line.text : (line.done ?? line.text)}
            </motion.span>
          </AnimatePresence>
        </span>
      </div>
    );
  }

  return (
    <div
      data-active={active || undefined}
      className={cn(
        // Output keeps its columns (tables, progress bars); a narrow window scrolls sideways instead of wrapping them apart.
        "whitespace-pre transition-opacity duration-100 ease-out",
        TONE[line.tone ?? "default"],
        pending ? "invisible opacity-0" : "opacity-100",
      )}
    >
      {line.text || " "}
    </div>
  );
}

function Prompt({ prompt, cwd }: { prompt: string; cwd?: string }) {
  return (
    <span className="shrink-0 select-none">
      {cwd && <span className="text-fg-3">{cwd} </span>}
      <span className="text-fg-4">{prompt} </span>
    </span>
  );
}

// A block caret, blinking on the steps the terminal uses.
function Caret() {
  return <span aria-hidden className="ml-px inline-block h-4 w-[0.6em] translate-y-[3px] animate-caret bg-fg/70 align-top motion-reduce:animate-none" />;
}

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
function Spinner() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => (n + 1) % FRAMES.length), 80);
    return () => window.clearInterval(t);
  }, []);
  return <span>{FRAMES[i]}</span>;
}

function SkipIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 4.5 7.5 8l-4 3.5zM8.5 4.5l4 3.5-4 3.5zM12.75 4v8" />
    </svg>
  );
}

const iconButton = cn(
  "group/icon relative grid size-7 shrink-0 place-items-center rounded-md text-fg-3 outline-none",
  "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
  "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
);

function Hint({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" sideOffset={6} collisionPadding={8} className="z-(--z-tooltip)">
          <Tooltip.Popup
            className={cn(
              "flex min-h-[26px] items-center rounded-lg border border-line-2 bg-raised px-2 py-[3px] text-[12px] leading-4 text-fg shadow-pop outline-none",
              "origin-(--transform-origin) transition-[opacity,scale,translate] duration-150 ease-out-expo",
              "data-starting-style:scale-96 data-starting-style:translate-y-0.5 data-starting-style:opacity-0",
              "data-ending-style:opacity-0 data-ending-style:duration-100 data-instant:transition-none",
            )}
          >
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
