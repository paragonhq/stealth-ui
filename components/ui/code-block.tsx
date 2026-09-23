"use client";
import { Toggle } from "@base-ui/react/toggle";
import { Tooltip } from "@base-ui/react/tooltip";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { parse } from "sugar-high/core";
import { languages, type Language } from "sugar-high/lang";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/cn";
import { ChevronDown, Code, File } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * Highlighting
 * -----------------------------------------------------------------------------------------------*/

const NAMES: Record<string, string> = {
  javascript: "JavaScript", typescript: "TypeScript", css: "CSS", python: "Python", c: "C", go: "Go", java: "Java",
  rust: "Rust", json: "JSON", diff: "Diff", shell: "Shell", cpp: "C++", csharp: "C#", sql: "SQL", html: "HTML",
  yaml: "YAML", markdown: "Markdown", plaintext: "Text", ruby: "Ruby", kotlin: "Kotlin", swift: "Swift", php: "PHP",
  toml: "TOML", powershell: "PowerShell", dockerfile: "Dockerfile", graphql: "GraphQL", hcl: "HCL", zig: "Zig", lua: "Lua",
};

const find = (name?: string) => {
  const n = name?.trim().toLowerCase().replace(/^\./, "");
  return n ? languages.find((l) => l.id === n || l.extension === n || l.aliases.includes(n)) : undefined;
};

export type CodeLanguage = Language & { label: string };

/** The language from an explicit name or alias, else the filename's extension, else plain text. */
export function resolveLanguage(lang?: string, filename?: string): CodeLanguage {
  const base = filename?.split("/").pop();
  const l = find(lang) ?? find(base?.split(".").pop()) ?? find(base) ?? find("plaintext")!;
  return { ...l, label: NAMES[l.id] ?? l.id };
}

export type CodeToken = { type: string; value: string };

/** Splits code into lines of tokens. Pure, so it runs the same on the server and the client. */
export function tokenize(code: string, language: Language): CodeToken[][] {
  // One trailing newline is the file ending, not an empty last line.
  const text = code.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  const lines = parse(text, language.config).lines.map((l) => l.tokens.map(({ type, value }) => ({ type, value })));
  return lines.length ? lines : [[]];
}

/**
 * Monochrome syntax colors, built only from the foreground steps: names you scan
 * for are brightest, structure (keywords, punctuation) recedes, comments sit
 * quietest. Every value is a --sh-* variable, so a product can retheme it.
 */
export const codeTheme = {
  "--sh-identifier": "color-mix(in oklab, var(--fg) 86%, var(--fg-2))",
  "--sh-property": "color-mix(in oklab, var(--fg) 86%, var(--fg-2))",
  "--sh-entity": "var(--fg)",
  "--sh-class": "var(--fg)",
  "--sh-jsxliterals": "var(--fg)",
  "--sh-string": "var(--fg-2)",
  "--sh-keyword": "color-mix(in oklab, var(--fg-2) 55%, var(--fg-3))",
  "--sh-sign": "var(--fg-3)",
  "--sh-comment": "var(--fg-3)",
} as React.CSSProperties;

export function Tokens({ tokens }: { tokens: CodeToken[] }) {
  return tokens.map((t, i) =>
    t.type === "space" ? (
      t.value
    ) : (
      <span key={i} style={{ color: `var(--sh-${t.type})` }} className={t.type === "comment" ? "italic" : undefined}>
        {t.value}
      </span>
    ),
  );
}

/** Leading whitespace of a tokenized line, in columns (tabs count as two). */
export const indentOf = (tokens: CodeToken[]) => {
  let n = 0;
  for (const t of tokens) {
    const m = t.value.match(/^[ \t]*/)![0];
    n += m.replace(/\t/g, "  ").length;
    if (m.length < t.value.length) break;
  }
  return n;
};

/** Line numbers as a flat set from `[3, [8, 12]]`. */
export function lineSet(ranges: Array<number | [number, number]> = []) {
  const set = new Set<number>();
  for (const r of ranges) {
    if (typeof r === "number") set.add(r);
    else for (let n = Math.min(...r); n <= Math.max(...r); n++) set.add(n);
  }
  return set;
}

/* -------------------------------------------------------------------------------------------------
 * CodeLines: the <code> itself, reusable anywhere a block of highlighted lines is needed
 * -----------------------------------------------------------------------------------------------*/

export type CodeLinesProps = Omit<React.ComponentProps<"code">, "children"> & {
  lines: CodeToken[][];
  lineNumbers?: boolean;
  /** The number of the first line, for excerpts from the middle of a file. */
  startLine?: number;
  /** 1-based line numbers (relative to startLine) to mark. */
  highlight?: Set<number>;
  wrap?: boolean;
  /** Reserve the gutter for at least this many digits, so sibling blocks (tabs, panes) line their code up. */
  minDigits?: number;
};

export function CodeLines({ lines, lineNumbers = true, startLine = 1, highlight, wrap = false, minDigits = 1, className, style, ...rest }: CodeLinesProps) {
  const digits = Math.max(minDigits, String(startLine + lines.length - 1).length);
  return (
    <code
      data-wrap={wrap || undefined}
      style={{ ...codeTheme, "--digits": digits, ...style } as React.CSSProperties}
      className={cn("grid font-mono text-[12.5px] leading-5", wrap ? "w-full" : "w-max min-w-full", className)}
      {...rest}
    >
      {lines.map((tokens, i) => {
        const n = startLine + i;
        const hl = highlight?.has(n);
        return (
          // Lines are blocks, so a selection copies with real line breaks and without the numbers.
          <span
            key={i}
            data-line={n}
            data-highlighted={hl || undefined}
            className={cn(
              "group/line grid min-h-5",
              lineNumbers ? "grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-[minmax(0,1fr)]",
              // Opaque washes: the sticky gutter has to hide the code that scrolls under it.
              "[--line-bg:var(--raised)] data-highlighted:[--line-bg:color-mix(in_oklab,var(--fg)_6%,var(--raised))]",
              "bg-(--line-bg)",
              !lineNumbers && "data-highlighted:shadow-[inset_2px_0_var(--fg-3)]",
            )}
          >
            {lineNumbers && (
              <span
                aria-hidden
                className={cn(
                  "sticky left-0 z-[1] select-none bg-(--line-bg) pl-4 pr-4 text-right tabular text-fg-4",
                  "min-w-[calc(var(--digits)*1ch+2rem)] transition-colors duration-150 ease-out",
                  "group-hover/line:text-fg-3 group-data-highlighted/line:text-fg-2 group-data-highlighted/line:shadow-[inset_2px_0_var(--fg-3)]",
                )}
              >
                {n}
              </span>
            )}
            <span
              className={cn("pr-4", !lineNumbers && "pl-4", wrap ? "whitespace-pre-wrap [overflow-wrap:anywhere]" : "whitespace-pre")}
              // A wrapped line hangs its continuation two columns past its own indent, so it still reads as one statement.
              style={wrap ? { paddingInlineStart: `calc(${indentOf(tokens) + 2}ch + ${lineNumbers ? 0 : 16}px)`, textIndent: `-${indentOf(tokens) + 2}ch` } : undefined}
            >
              {/* An empty block copies as nothing; the break keeps blank lines in a copied selection. */}
              {tokens.length ? <Tokens tokens={tokens} /> : <br />}
            </span>
          </span>
        );
      })}
    </code>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Small shared pieces
 * -----------------------------------------------------------------------------------------------*/

export function Hint({ label, children }: { label: string; children: React.ReactElement }) {
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

/** Marks an element that scrolls sideways with data-overflow and --fade-end, straight on the DOM so scrolling never re-renders. */
export function useSideScroll(ref: React.RefObject<HTMLElement | null>) {
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = el.scrollWidth - el.clientWidth;
        const more = max - el.scrollLeft > 1;
        el.style.setProperty("--fade-end", more ? "32px" : "0px");
        el.toggleAttribute("data-scrolled", el.scrollLeft > 1);
        setOverflows(max > 1);
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [ref]);
  return overflows;
}

const iconButton = cn(
  "relative grid size-7 shrink-0 place-items-center rounded-md text-fg-3 outline-none",
  "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
  "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
);

function WrapIcon({ on }: { on: boolean }) {
  const reduce = useReducedMotion();
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.75 4h10.5M2.75 12h3" />
      {/* The middle line folds back on itself when wrapping is on, and runs straight off the edge when it's off. */}
      <AnimatePresence initial={false} mode="popLayout">
        {on ? (
          <motion.path
            key="on"
            d="M2.75 8h8.25a2 2 0 0 1 0 4H8.5m1.5-1.5L8.5 12l1.5 1.5"
            initial={reduce ? { opacity: 0 } : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ duration: reduce ? 0.12 : 0.34, ease: ease.out }}
          />
        ) : (
          <motion.path
            key="off"
            d="M2.75 8h10.5"
            initial={reduce ? { opacity: 0 } : { pathLength: 0.4, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ duration: reduce ? 0.12 : 0.24, ease: ease.out }}
          />
        )}
      </AnimatePresence>
    </svg>
  );
}

/* -------------------------------------------------------------------------------------------------
 * CodeBlock
 * -----------------------------------------------------------------------------------------------*/

const LINE = 20; // leading-5
const PAD = 12; // py-3

export type CodeBlockProps = Omit<React.ComponentProps<"figure">, "children"> & {
  code: string;
  /** Any language name, alias or extension ("ts", "bash", "yml"). Falls back to the filename's extension, then plain text. */
  lang?: string;
  /** Shown in the header. Directories truncate before the file name does. */
  filename?: string;
  lineNumbers?: boolean;
  startLine?: number;
  /** Lines to mark, as numbers or inclusive ranges: `[4, [9, 12]]`. */
  highlightLines?: Array<number | [number, number]>;
  wrap?: boolean;
  defaultWrap?: boolean;
  onWrapChange?: (wrap: boolean) => void;
  /** Blocks longer than this collapse to it, with a control to show the rest. `false` never collapses. */
  maxLines?: number | false;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Hide the copy button, for code that isn't meant to be run. */
  copyable?: boolean;
};

export function CodeBlock({
  code,
  lang,
  filename,
  lineNumbers = true,
  startLine = 1,
  highlightLines,
  wrap: wrapProp,
  defaultWrap = false,
  onWrapChange,
  maxLines = 16,
  expanded: expandedProp,
  defaultExpanded = false,
  onExpandedChange,
  copyable = true,
  className,
  ...rest
}: CodeBlockProps) {
  const reduce = useReducedMotion();
  const id = useId();
  const figure = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLPreElement>(null);
  const language = useMemo(() => resolveLanguage(lang, filename), [lang, filename]);
  const lines = useMemo(() => tokenize(code, language), [code, language]);
  const highlight = useMemo(() => lineSet(highlightLines), [highlightLines]);
  const [wrap, setWrap] = useControllableState({ value: wrapProp, defaultValue: defaultWrap, onChange: onWrapChange });
  const [expanded, setExpanded] = useControllableState({ value: expandedProp, defaultValue: defaultExpanded, onChange: onExpandedChange });
  const overflows = useSideScroll(scroller);

  // Collapsing to hide two or three lines is more friction than it saves.
  const collapsible = maxLines !== false && lines.length > maxLines + 4;
  const collapsed = collapsible && !expanded;
  const hidden = collapsible ? lines.length - maxLines : 0;

  const slash = filename?.lastIndexOf("/") ?? -1;
  const dir = filename && slash >= 0 ? filename.slice(0, slash + 1) : "";
  const base = filename ? filename.slice(slash + 1) : "";

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    // Collapsing a long block can leave the reader below it. Bring its top back if it went off screen.
    if (!next && figure.current && figure.current.getBoundingClientRect().top < 0) {
      figure.current.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    }
  };

  return (
    <figure
      ref={figure}
      data-wrap={wrap || undefined}
      data-state={collapsible ? (collapsed ? "collapsed" : "expanded") : undefined}
      className={cn("@container relative m-0 flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]", className)}
      {...rest}
    >
      <Tooltip.Provider delay={500}>
        <figcaption className="flex h-10 shrink-0 items-center gap-2 border-b border-line pl-3.5 pr-1.5">
          {filename ? (
            <>
              <File size={14} className="shrink-0 text-fg-3" />
              <span className="flex min-w-0 flex-1 font-mono text-[12px]">
                <span className="truncate text-fg-3">{dir}</span>
                <span className="shrink-0 text-fg">{base}</span>
              </span>
              <span className="shrink-0 font-mono text-2xs uppercase tracking-[0.08em] text-fg-4 @max-[400px]:hidden">{language.label}</span>
            </>
          ) : (
            <>
              <Code size={14} className="shrink-0 text-fg-3" />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg-2">{language.label}</span>
            </>
          )}
          <span className="ml-1 flex items-center gap-0.5">
            <Hint label={wrap ? "Don’t wrap lines" : "Wrap lines"}>
              <Toggle pressed={wrap} onPressedChange={setWrap} aria-label="Wrap lines" className={cn(iconButton, "data-pressed:text-fg")}>
                <WrapIcon on={wrap} />
              </Toggle>
            </Hint>
            {copyable && (
              <Hint label="Copy code">
                <CopyButton value={code.replace(/\n$/, "")} iconOnly variant="ghost" size="sm" label="Copy code" />
              </Hint>
            )}
          </span>
        </figcaption>
      </Tooltip.Provider>

      <div
        className={cn(
          "relative min-w-0",
          // The focus ring sits on top of the code: the rows' own backgrounds would paint over an outline on the scroller.
          "after:pointer-events-none after:absolute after:inset-0 after:z-[2] after:rounded-[inherit] after:content-['']",
          "has-[pre:focus-visible]:after:shadow-[inset_0_0_0_1px_var(--fg-3)]",
        )}
      >
        <motion.pre
          ref={scroller}
          id={id}
          // Only a block that actually scrolls sideways joins the tab order, so arrow keys can scroll it.
          tabIndex={overflows && !wrap ? 0 : undefined}
          aria-label={overflows && !wrap ? `${filename ?? language.label} code` : undefined}
          initial={false}
          animate={{ height: collapsed ? PAD + maxLines * LINE : "auto" }}
          transition={reduce ? { duration: 0 } : { duration: 0.34, ease: ease.inOut }}
          className={cn(
            "m-0 overflow-x-auto overflow-y-hidden overscroll-x-contain py-3 outline-none",
            "[mask-image:linear-gradient(to_left,transparent,var(--fg)_var(--fade-end,0px))]",
          )}
        >
          <CodeLines lines={lines} lineNumbers={lineNumbers} startLine={startLine} highlight={highlight} wrap={wrap} />
        </motion.pre>
        {collapsible && (
          // The cut edge: code fades out where it's hidden, so the block reads as "more below", not as the end.
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-b from-transparent to-raised",
              "transition-opacity duration-300 ease-out",
              collapsed ? "opacity-100" : "opacity-0",
            )}
          />
        )}
      </div>

      {collapsible && (
        <div className="flex h-10 shrink-0 items-center border-t border-line px-1.5">
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={id}
            onClick={toggle}
            className={cn(
              "group/more relative inline-flex h-7 select-none items-center gap-1.5 rounded-md pl-1.5 pr-2 text-[12.5px] font-medium text-fg-2 outline-none",
              "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              "before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
            )}
          >
            <ChevronDown
              size={14}
              className={cn("text-fg-3 transition-transform duration-300 ease-in-out-quart group-hover/more:text-fg-2", !collapsed && "-rotate-180")}
            />
            {/* Both labels share one cell, so the button keeps one width. */}
            <span className="grid overflow-hidden text-left">
              <span aria-hidden className="invisible col-start-1 row-start-1">Show {hidden} more lines</span>
              <span aria-hidden className="invisible col-start-1 row-start-1">Show less</span>
              <AnimatePresence initial={false}>
                <motion.span
                  key={collapsed ? "more" : "less"}
                  className="col-start-1 row-start-1 tabular"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: collapsed ? -8 : 8, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: collapsed ? 8 : -8, filter: "blur(2px)", transition: { duration: 0.14 } }}
                  transition={{ duration: reduce ? 0.12 : 0.22, ease: ease.out }}
                >
                  {collapsed ? `Show ${hidden} more lines` : "Show less"}
                </motion.span>
              </AnimatePresence>
            </span>
          </button>
          <span className="ml-auto pr-2 font-mono text-2xs tabular text-fg-4">{lines.length} lines</span>
        </div>
      )}
    </figure>
  );
}
