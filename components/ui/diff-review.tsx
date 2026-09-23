"use client";
import { Tabs } from "@base-ui/react/tabs";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { highlight } from "sugar-high";
import { cn } from "@/lib/cn";
import { ArrowRight, Undo } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * Data
 * -----------------------------------------------------------------------------------------------*/

/** One hunk of a unified diff. Lines keep their prefix: "+" added, "-" removed, " " unchanged. */
export type DiffHunk = {
  /** Stable id. Falls back to the hunk's index in its file. */
  id?: string;
  oldStart: number;
  newStart: number;
  /** The text after the second @@, usually the enclosing function. */
  section?: string;
  lines: string[];
};

export type DiffFile = {
  path: string;
  status?: "modified" | "added" | "deleted" | "renamed";
  hunks: DiffHunk[];
};

export type HunkDecision = "accepted" | "rejected";
/** Decisions by hunk key (see `hunkKey`). A hunk that isn't in the record is still pending. */
export type DiffDecisions = Record<string, HunkDecision>;

export const hunkKey = (file: DiffFile, hunk: DiffHunk, index: number) => `${file.path}#${hunk.id ?? index}`;

const HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;
const stripPath = (p: string) => p.replace(/\t.*$/, "").replace(/^[ab]\//, "");

/** Turns `git diff` output (one or many files) into the shape DiffReview takes. */
export function parsePatch(patch: string): DiffFile[] {
  const files: DiffFile[] = [];
  let file: DiffFile | null = null;
  let hunk: DiffHunk | null = null;
  let oldLeft = 0;
  let newLeft = 0;
  const start = (path = "") => {
    file = { path, status: "modified", hunks: [] };
    files.push(file);
    hunk = null;
    return file;
  };

  for (const raw of patch.split(/\r?\n/)) {
    // Inside a hunk, the header's counts say where it ends, so a removed line
    // that happens to start with "--" is never mistaken for a file header.
    // A line that can't belong to a hunk ends it early, so a header with wrong counts can't swallow the next file.
    if (hunk && (oldLeft > 0 || newLeft > 0) && /^[+\- \\]|^$/.test(raw)) {
      if (raw.startsWith("\\")) continue;
      const sign = raw[0];
      if (sign !== "+") oldLeft--;
      if (sign !== "-") newLeft--;
      (hunk as DiffHunk).lines.push(sign === "+" || sign === "-" ? raw : ` ${raw.slice(1)}`);
      continue;
    }
    const h = HEADER.exec(raw);
    if (h) {
      const f: DiffFile = file ?? start("untitled");
      hunk = { oldStart: +h[1], newStart: +h[3], section: h[5] || undefined, lines: [] };
      oldLeft = h[2] === undefined ? 1 : +h[2];
      newLeft = h[4] === undefined ? 1 : +h[4];
      f.hunks.push(hunk);
    } else if (raw.startsWith("diff --git ")) {
      start(/ b\/(.+)$/.exec(raw)?.[1] ?? raw.slice(11));
    } else if (raw.startsWith("--- ")) {
      const current = file as DiffFile | null;
      const f: DiffFile = !current || current.hunks.length ? start() : current;
      if (raw.slice(4).startsWith("/dev/null")) f.status = "added";
      else if (!f.path) f.path = stripPath(raw.slice(4));
    } else if (raw.startsWith("+++ ") && file) {
      const f: DiffFile = file;
      if (raw.slice(4).startsWith("/dev/null")) f.status = "deleted";
      else f.path = stripPath(raw.slice(4));
    } else if (file && raw.startsWith("new file mode")) (file as DiffFile).status = "added";
    else if (file && raw.startsWith("deleted file mode")) (file as DiffFile).status = "deleted";
    else if (file && raw.startsWith("rename to ")) Object.assign(file as DiffFile, { status: "renamed", path: raw.slice(10) });
  }
  return files.filter((f) => f.hunks.length);
}

type Row = { sign: "+" | "-" | " "; html: string; old?: number; new?: number };
type HunkModel = { key: string; hunk: DiffHunk; rows: Row[]; adds: number; dels: number; from: number; to: number };

function model(file: DiffFile): HunkModel[] {
  return file.hunks.map((hunk, i) => {
    let o = hunk.oldStart;
    let n = hunk.newStart;
    let adds = 0;
    let dels = 0;
    const rows = hunk.lines.map((line): Row => {
      const sign = line[0] === "+" || line[0] === "-" ? line[0] : " ";
      // Highlighted one line at a time: good enough for review, and cheap.
      const html = highlight(line.slice(1) || " ");
      if (sign === "+") {
        adds++;
        return { sign, html, new: n++ };
      }
      if (sign === "-") {
        dels++;
        return { sign, html, old: o++ };
      }
      return { sign, html, old: o++, new: n++ };
    });
    const pureDelete = n === hunk.newStart;
    const from = pureDelete ? hunk.oldStart : hunk.newStart;
    const to = Math.max(from, (pureDelete ? o : n) - 1);
    return { key: hunkKey(file, hunk, i), hunk, rows, adds, dels, from, to };
  });
}

const tally = (hunks: HunkModel[], d: DiffDecisions) => {
  let decided = 0;
  let accepted = 0;
  for (const h of hunks) {
    if (d[h.key]) decided++;
    if (d[h.key] === "accepted") accepted++;
  }
  return { decided, accepted, rejected: decided - accepted, total: hunks.length };
};

/* -------------------------------------------------------------------------------------------------
 * DiffReview
 * -----------------------------------------------------------------------------------------------*/

export type DiffReviewProps = Omit<React.ComponentProps<"section">, "defaultValue" | "onChange"> & {
  files: DiffFile[];
  /** Decisions by hunk key. Controlled. */
  value?: DiffDecisions;
  defaultValue?: DiffDecisions;
  onValueChange?: (value: DiffDecisions) => void;
  /** Called once each time the last pending hunk is decided. */
  onComplete?: (value: DiffDecisions) => void;
  title?: string;
  /** The file shown first. Defaults to the first file with pending changes. */
  defaultFile?: string;
  /** Show the changes but block decisions, e.g. while the agent is still writing them. */
  disabled?: boolean;
};

type Focus = { key: string; part: "accept" | "undo" } | null;

// Diff tokens in four foreground steps: structure without a rainbow.
const tokens = {
  "--sh-keyword": "var(--fg)",
  "--sh-class": "var(--fg)",
  "--sh-entity": "var(--fg)",
  "--sh-identifier": "var(--fg)",
  "--sh-property": "var(--fg-2)",
  "--sh-string": "var(--fg-2)",
  "--sh-jsxliterals": "var(--fg-2)",
  "--sh-sign": "var(--fg-3)",
  "--sh-comment": "var(--fg-3)",
} as React.CSSProperties;

export function DiffReview({
  files,
  value,
  defaultValue,
  onValueChange,
  onComplete,
  title = "Proposed changes",
  defaultFile,
  disabled = false,
  className,
  style,
  ...rest
}: DiffReviewProps) {
  const reduce = !!useReducedMotion();
  const id = useId();
  const [decisions, setDecisions] = useControllableState<DiffDecisions>({ value, defaultValue: defaultValue ?? {}, onChange: onValueChange });
  const models = useMemo(() => files.map((f) => ({ file: f, hunks: model(f) })), [files]);
  const all = useMemo(() => models.flatMap((m) => m.hunks), [models]);
  const totals = tally(all, decisions);
  const done = totals.total > 0 && totals.decided === totals.total;

  // Chosen once: the requested file, else the first with something left to review.
  // Finishing a file never switches the view on its own; Next file does.
  const [picked, setPicked] = useState<string | undefined>(() => defaultFile ?? models.find((m) => m.hunks.some((h) => !decisions[h.key]))?.file.path);
  const active = models.some((m) => m.file.path === picked) ? picked! : models[0]?.file.path;

  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const focusNext = useRef<Focus>(null);
  const [announcement, setAnnouncement] = useState("");

  // Focus moves after the render that mounted its target (an Undo, or the next Accept).
  useEffect(() => {
    const f = focusNext.current;
    if (!f) return;
    focusNext.current = null;
    buttons.current.get(`${f.part}:${f.key}`)?.focus({ preventScroll: false });
  });

  const commit = (next: DiffDecisions, message: string) => {
    setDecisions(next);
    setAnnouncement(message);
    const t = tally(all, next);
    if (t.total && t.decided === t.total && totals.decided !== totals.total) onComplete?.(next);
  };

  const decide = (fileIndex: number, h: HunkModel, decision: HunkDecision | null, viaKeyboard: boolean) => {
    if (disabled) return;
    const { file, hunks } = models[fileIndex];
    const next = { ...decisions };
    if (decision) next[h.key] = decision;
    else delete next[h.key];
    const n = hunks.indexOf(h) + 1;
    commit(next, decision ? `${decision === "accepted" ? "Accepted" : "Rejected"} change ${n} in ${basename(file.path)}` : `Change ${n} in ${basename(file.path)} is pending again`);

    if (!decision) {
      focusNext.current = { key: h.key, part: "accept" };
      return;
    }
    // Keep a keyboard reviewer moving: on to the next pending hunk in this file,
    // or onto this hunk's Undo when the file is finished. Pointers stay put.
    if (!viaKeyboard) return;
    const i = hunks.indexOf(h);
    const after = [...hunks.slice(i + 1), ...hunks.slice(0, i)].find((x) => !next[x.key]);
    focusNext.current = { key: (after ?? h).key, part: after ? "accept" : "undo" };
  };

  const acceptAll = () => {
    if (disabled || done) return;
    const next = { ...decisions };
    let count = 0;
    for (const h of all) {
      if (next[h.key]) continue;
      next[h.key] = "accepted";
      count++;
    }
    commit(next, `Accepted ${count} remaining ${count === 1 ? "change" : "changes"}`);
  };

  const openFile = (path: string) => {
    setPicked(path);
    const m = models.find((x) => x.file.path === path);
    const h = m?.hunks.find((x) => !decisions[x.key]);
    if (h) focusNext.current = { key: h.key, part: "accept" };
  };

  if (!files.length)
    return (
      <section aria-labelledby={`${id}-t`} className={cn("rounded-xl border border-line bg-raised px-4 py-8 text-center", className)} style={style} {...rest}>
        <h3 id={`${id}-t`} className="text-[13px] font-medium tracking-[-0.01em] text-fg">No changes to review</h3>
        <p className="mt-1 text-[12px] text-fg-3">When the agent proposes edits, they appear here file by file.</p>
      </section>
    );

  const fileCount = `${files.length} ${files.length === 1 ? "file" : "files"}`;

  return (
    <section
      aria-labelledby={`${id}-t`}
      data-state={done ? "done" : "pending"}
      data-disabled={disabled ? "" : undefined}
      className={cn("flex min-h-0 flex-col overflow-hidden rounded-xl border border-line-2 bg-raised shadow-[var(--shadow)]", className)}
      style={{ ...tokens, ...style }}
      {...rest}
    >
      <header className="relative flex items-center gap-3 border-b border-line py-2.5 pl-3.5 pr-2.5">
        <div className="min-w-0 flex-1">
          <h3 id={`${id}-t`} className="text-balance text-[13px] font-medium tracking-[-0.01em] text-fg">{title}</h3>
          <p className="tabular mt-px truncate text-[12px] text-fg-3">
            {fileCount}
            <span className="px-1.5 text-fg-4">·</span>
            <NumberFlow value={totals.decided} className="text-fg-2" /> of {totals.total} reviewed
          </p>
        </div>
        <AcceptAll done={done} pending={totals.total - totals.decided} disabled={disabled} reduce={reduce} onPress={acceptAll} />
        {/* Review progress along the header's edge. The text above says the same thing to a screen reader. */}
        <span aria-hidden className="absolute inset-x-0 -bottom-px h-px overflow-hidden">
          <span
            className="block h-full origin-left bg-fg-2 transition-transform duration-500 ease-out-expo motion-reduce:transition-none"
            style={{ transform: `scaleX(${totals.total ? totals.decided / totals.total : 0})` }}
          />
        </span>
      </header>

      <Tabs.Root orientation="vertical" value={active} onValueChange={(v) => setPicked(v as string)} className="flex min-h-0 flex-1 flex-col">
        <Tabs.List activateOnFocus aria-label="Changed files" className="relative flex shrink-0 flex-col border-b border-line p-1">
          <Tabs.Indicator className="absolute left-1 right-1 top-0 h-(--active-tab-height) translate-y-(--active-tab-top) rounded-md bg-fg/[0.06] transition-[translate,height] duration-220 ease-in-out-quart motion-reduce:transition-none" />
          {models.map(({ file, hunks }) => (
            <FileTab key={file.path} file={file} hunks={hunks} decisions={decisions} reduce={reduce} />
          ))}
        </Tabs.List>

        {models.map(({ file, hunks }, fi) => {
          const t = tally(hunks, decisions);
          const nextFile = models.find((m, i) => i !== fi && m.hunks.some((h) => !decisions[h.key]))?.file.path;
          return (
            <Tabs.Panel
              key={file.path}
              value={file.path}
              aria-label={`Changes in ${file.path}`}
              className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-2 outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3"
            >
              {hunks.map((h, hi) => (
                <Hunk
                  key={h.key}
                  model={h}
                  index={hi}
                  count={hunks.length}
                  decision={decisions[h.key]}
                  disabled={disabled}
                  reduce={reduce}
                  register={(part, el) => {
                    const k = `${part}:${h.key}`;
                    if (el) buttons.current.set(k, el);
                    else buttons.current.delete(k);
                  }}
                  onDecide={(d, viaKeyboard) => decide(fi, h, d, viaKeyboard)}
                />
              ))}
              <AnimatePresence initial={false}>
                {t.decided === t.total && (
                  <motion.div
                    key="done"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    transition={{ duration: 0.24, ease: ease.out, delay: reduce ? 0 : 0.12 }}
                    className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 px-1.5 text-[12px] text-fg-3"
                  >
                    <span className="min-w-0 flex-1">
                      {done ? `Review complete: ${outcome(totals)}` : `${basename(file.path)} reviewed: ${outcome(t)}`}
                    </span>
                    {nextFile && (
                      <button
                        type="button"
                        onClick={() => openFile(nextFile)}
                        className={cn(ghost, "group/next -mr-1 h-7 gap-1.5 px-2 text-[12px] text-fg-2")}
                      >
                        Next file
                        <ArrowRight size={14} className="transition-transform duration-150 ease-out group-hover/next:translate-x-0.5" />
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </Tabs.Panel>
          );
        })}
      </Tabs.Root>

      <footer aria-hidden className="hidden shrink-0 items-center gap-3 border-t border-line px-3.5 py-2 font-mono text-2xs text-fg-4 pointer-fine:flex">
        <span className="whitespace-nowrap"><Kbd>A</Kbd>accept</span>
        <span className="whitespace-nowrap"><Kbd>R</Kbd>reject</span>
        <span className="whitespace-nowrap"><Kbd>U</Kbd>undo</span>
        <span className="ml-auto hidden truncate min-[480px]:block">in the focused change</span>
      </footer>

      <span role="status" aria-live="polite" className="sr-only">{announcement}</span>
    </section>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Parts
 * -----------------------------------------------------------------------------------------------*/

const focusRing = "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3";
const pressable = cn(
  focusRing,
  "relative inline-flex shrink-0 select-none items-center justify-center rounded-md font-medium",
  "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.96] active:duration-75",
  "disabled:pointer-events-none disabled:opacity-50",
  // 28px to draw, 44px to touch.
  "before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] pointer-fine:before:hidden",
);
const ghost = cn(pressable, "text-fg-2 hover:bg-hover hover:text-fg");

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="mr-1 inline-grid h-4 min-w-4 place-items-center rounded border border-line-2 bg-frame px-1 text-[10px] text-fg-3">{children}</kbd>;
}

const basename = (p: string) => p.slice(p.lastIndexOf("/") + 1);
const outcome = ({ accepted, rejected }: { accepted: number; rejected: number }) =>
  [accepted && `${accepted} accepted`, rejected && `${rejected} rejected`].filter(Boolean).join(", ");

function AcceptAll({ done, pending, disabled, reduce, onPress }: { done: boolean; pending: number; disabled: boolean; reduce: boolean; onPress: () => void }) {
  const labels = ["Accept all", "All reviewed"];
  return (
    <button
      type="button"
      // Stays focusable once everything is reviewed so focus isn't dropped on the page.
      aria-disabled={done || undefined}
      disabled={disabled}
      data-state={done ? "done" : "pending"}
      aria-label={done ? "All changes reviewed" : `Accept all ${pending} remaining ${pending === 1 ? "change" : "changes"}`}
      onClick={onPress}
      className={cn(
        pressable,
        "h-7 gap-1.5 rounded-md px-2.5 text-[12px]",
        done
          ? "cursor-default border border-line-2 bg-transparent text-fg-2 active:scale-100"
          : "border border-transparent bg-fg text-frame hover:bg-fg/90",
      )}
    >
      <span className="relative grid size-3.5 place-items-center">
        <AnimatePresence initial={false}>
          {done && (
            <motion.svg
              key="tick"
              width={14}
              height={14}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="absolute"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={reduce ? { duration: 0.15 } : spring.pop}
            >
              <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.32, ease: ease.out, delay: 0.06 }} />
            </motion.svg>
          )}
          {!done && (
            <motion.svg
              key="all"
              width={14}
              height={14}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="absolute"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: reduce ? 1 : 0.6, transition: { duration: 0.1 } }}
              transition={reduce ? { duration: 0.15 } : spring.pop}
            >
              <path d="M1.75 8.25 4.5 11 10 4.75M8 10.25l.75.75 5.5-6.25" />
            </motion.svg>
          )}
        </AnimatePresence>
      </span>
      {/* Both labels share one grid cell, so the button keeps its width when it flips. */}
      <span className="grid text-left">
        {labels.map((l) => (
          <span key={l} aria-hidden className="invisible col-start-1 row-start-1">{l}</span>
        ))}
        <AnimatePresence initial={false}>
          <motion.span
            key={done ? "done" : "todo"}
            className="col-start-1 row-start-1"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" }}
            transition={{ duration: reduce ? 0.15 : 0.22, ease: ease.out }}
          >
            {done ? labels[1] : labels[0]}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
}

function FileTab({ file, hunks, decisions, reduce }: { file: DiffFile; hunks: HunkModel[]; decisions: DiffDecisions; reduce: boolean }) {
  const t = tally(hunks, decisions);
  const adds = hunks.reduce((s, h) => s + h.adds, 0);
  const dels = hunks.reduce((s, h) => s + h.dels, 0);
  const slash = file.path.lastIndexOf("/");
  const dir = slash >= 0 ? file.path.slice(0, slash + 1) : "";
  const name = file.path.slice(slash + 1);
  const spoken = t.decided === t.total ? "reviewed" : `${t.decided} of ${t.total} reviewed`;

  return (
    <Tabs.Tab
      value={file.path}
      aria-label={`${file.path}, ${adds} added, ${dels} removed, ${spoken}`}
      className={cn(
        "group/tab relative z-1 flex h-8 min-w-0 items-center gap-2 rounded-md px-2 text-left text-[12.5px] text-fg-2",
        "outline-none transition-[color,scale] duration-150 ease-out hover:text-fg active:scale-[0.99] data-active:text-fg",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
      )}
    >
      <FileProgress decided={t.decided} total={t.total} rejectedAll={t.rejected === t.total} reduce={reduce} />
      <span className="flex min-w-0 flex-1 items-baseline font-mono text-[12px]">
        <span className="min-w-0 truncate text-fg-4">{dir}</span>
        <span className="shrink-0">{name}</span>
        {file.status && file.status !== "modified" && (
          <span className="ml-2 shrink-0 rounded-sm border border-line-2 px-1 text-[10px] leading-3.5 text-fg-3">
            {file.status === "added" ? "new" : file.status}
          </span>
        )}
      </span>
      <span aria-hidden className="tabular flex shrink-0 gap-1.5 font-mono text-[11px]">
        {adds > 0 && <span className="text-success">+{adds}</span>}
        {dels > 0 && <span className="text-danger">−{dels}</span>}
      </span>
    </Tabs.Tab>
  );
}

/** A ring that fills as hunks are decided, then turns into a tick (or a cross when all were rejected). */
function FileProgress({ decided, total, rejectedAll, reduce }: { decided: number; total: number; rejectedAll: boolean; reduce: boolean }) {
  const complete = decided === total;
  const c = 2 * Math.PI * 5.25;
  return (
    <span aria-hidden className="relative grid size-4 shrink-0 place-items-center">
      <AnimatePresence initial={false} mode="popLayout">
        {complete ? (
          <motion.svg
            key={rejectedAll ? "x" : "tick"}
            width={16}
            height={16}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={rejectedAll ? "text-fg-3" : "text-success"}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={reduce ? { duration: 0.15 } : spring.pop}
          >
            {rejectedAll ? (
              <path d="m5 5 6 6M11 5l-6 6" />
            ) : (
              <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: ease.out, delay: 0.05 }} />
            )}
          </motion.svg>
        ) : (
          <motion.svg key="ring" width={16} height={16} viewBox="0 0 16 16" fill="none" className="-rotate-90" exit={{ opacity: 0, scale: reduce ? 1 : 0.6, transition: { duration: 0.12 } }}>
            <circle cx="8" cy="8" r="5.25" stroke="var(--fg-4)" strokeOpacity={0.6} strokeWidth={1.5} />
            <circle
              cx="8"
              cy="8"
              r="5.25"
              stroke="var(--fg-2)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - decided / total)}
              className="transition-[stroke-dashoffset] duration-300 ease-out-expo motion-reduce:transition-none"
              opacity={decided ? 1 : 0}
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </span>
  );
}

function Hunk({
  model: h,
  index,
  count,
  decision,
  disabled,
  reduce,
  register,
  onDecide,
}: {
  model: HunkModel;
  index: number;
  count: number;
  decision?: HunkDecision;
  disabled: boolean;
  reduce: boolean;
  register: (part: "accept" | "undo", el: HTMLButtonElement | null) => void;
  onDecide: (decision: HunkDecision | null, viaKeyboard: boolean) => void;
}) {
  const decided = !!decision;
  const range = h.from === h.to ? `Line ${h.from}` : `Lines ${h.from}–${h.to}`;
  // detail is 0 for clicks that came from Enter or Space.
  const kb = (e: React.MouseEvent) => e.detail === 0;

  return (
    <div
      role="group"
      aria-label={`Change ${index + 1} of ${count}, ${range.toLowerCase()}${decision ? `, ${decision}` : ""}`}
      data-state={decision ?? "pending"}
      onKeyDown={(e) => {
        if (disabled || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
        const k = e.key.toLowerCase();
        if (!decided && (k === "a" || k === "r")) {
          e.preventDefault();
          onDecide(k === "a" ? "accepted" : "rejected", true);
        } else if (decided && k === "u") {
          e.preventDefault();
          onDecide(null, true);
        }
      }}
      className={cn(
        "shrink-0 overflow-hidden rounded-lg border transition-[background-color,border-color] duration-200 ease-out",
        decided ? "border-line bg-frame/60" : "border-line-2 bg-frame",
      )}
    >
      <div className="flex h-10 items-center gap-2 pl-2.5 pr-1.5">
        <span aria-hidden className="relative grid size-4 shrink-0 place-items-center">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={decision ?? "pending"}
              className="grid place-items-center"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={reduce ? { duration: 0.15 } : spring.pop}
            >
              <HunkGlyph decision={decision} reduce={reduce} />
            </motion.span>
          </AnimatePresence>
        </span>

        <span className="flex min-w-0 flex-1 items-baseline gap-2 font-mono text-[11.5px]">
          <span className={cn("shrink-0 transition-colors duration-200", decided ? "text-fg-3" : "text-fg-2")}>
            {decision === "accepted" ? "Accepted" : decision === "rejected" ? "Rejected" : range}
          </span>
          {decided && <span className="shrink-0 text-fg-4">{range}</span>}
          {!decided && h.hunk.section && <span className="min-w-0 truncate text-fg-4">{h.hunk.section}</span>}
          <span aria-hidden className={cn("tabular ml-auto hidden shrink-0 gap-1.5 text-[11px] min-[420px]:flex", decision === "rejected" && "line-through decoration-fg-4")}>
            {h.adds > 0 && <span className={decided ? "text-fg-4" : "text-success"}>+{h.adds}</span>}
            {h.dels > 0 && <span className={decided ? "text-fg-4" : "text-danger"}>−{h.dels}</span>}
          </span>
        </span>

        {/* The actions swap in place; the row never changes height. */}
        <span className="relative flex shrink-0 items-center justify-end">
          <AnimatePresence initial={false} mode="popLayout">
            {decided ? (
              <motion.span
                key="undo"
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 6, filter: "blur(2px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: 6, filter: "blur(2px)", transition: { duration: 0.12 } }}
                transition={{ duration: 0.22, ease: ease.out, delay: reduce ? 0 : 0.08 }}
                className="flex"
              >
                <button
                  ref={(el) => register("undo", el)}
                  type="button"
                  disabled={disabled}
                  aria-keyshortcuts="u"
                  aria-label={`Undo ${decision === "accepted" ? "accept" : "reject"}, ${range.toLowerCase()}`}
                  onClick={(e) => onDecide(null, kb(e))}
                  className={cn(ghost, "group/undo h-7 gap-1.5 px-2 text-[12px]")}
                >
                  <Undo size={14} className="transition-transform duration-200 ease-out group-hover/undo:-rotate-12" />
                  Undo
                </button>
              </motion.span>
            ) : (
              <motion.span
                key="actions"
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: -6, filter: "blur(2px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, filter: "blur(2px)", transition: { duration: 0.12 } }}
                transition={{ duration: 0.22, ease: ease.out }}
                className="flex gap-1"
              >
                <button
                  type="button"
                  disabled={disabled}
                  aria-keyshortcuts="r"
                  aria-label={`Reject, ${range.toLowerCase()}`}
                  onClick={(e) => onDecide("rejected", kb(e))}
                  className={cn(ghost, "h-7 px-2 text-[12px] hover:text-danger")}
                >
                  Reject
                </button>
                <button
                  ref={(el) => register("accept", el)}
                  type="button"
                  disabled={disabled}
                  aria-keyshortcuts="a"
                  aria-label={`Accept, ${range.toLowerCase()}`}
                  onClick={(e) => onDecide("accepted", kb(e))}
                  className={cn(pressable, "h-7 border border-line-2 bg-raised px-2.5 text-[12px] text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover")}
                >
                  Accept
                </button>
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </div>

      {/* Decided hunks fold away to their header; Undo unfolds them from the same place. */}
      <motion.div
        initial={false}
        animate={decided ? { height: 0, opacity: 0 } : { height: "auto", opacity: 1 }}
        transition={
          reduce
            ? { duration: 0.15 }
            : decided
              ? { height: { duration: 0.28, ease: ease.inOut, delay: 0.06 }, opacity: { duration: 0.16, ease: ease.out } }
              : { height: { duration: 0.3, ease: ease.out }, opacity: { duration: 0.2, ease: ease.out, delay: 0.06 } }
        }
        inert={decided}
        className="overflow-hidden"
      >
        <div className="overflow-x-auto overscroll-x-contain border-t border-line">
          <div className="w-max min-w-full py-1 font-mono text-[12px] leading-5">
            {h.rows.map((r, i) => (
              <div
                key={i}
                className={cn(
                  "flex whitespace-pre",
                  r.sign === "+" && "bg-success-soft",
                  r.sign === "-" && "bg-danger-soft",
                )}
              >
                <span aria-hidden className="tabular w-9 shrink-0 select-none pr-1.5 text-right text-fg-4">{r.old ?? ""}</span>
                <span aria-hidden className="tabular w-9 shrink-0 select-none pr-1.5 text-right text-fg-4">{r.new ?? ""}</span>
                <span aria-hidden className={cn("w-4 shrink-0 select-none text-center", r.sign === "+" ? "text-success" : r.sign === "-" ? "text-danger" : "text-fg-4")}>
                  {r.sign === "+" ? "+" : r.sign === "-" ? "−" : ""}
                </span>
                {r.sign !== " " && <span className="sr-only">{r.sign === "+" ? "Added: " : "Removed: "}</span>}
                <code className={cn("pr-4", r.sign === "-" && "opacity-80")} dangerouslySetInnerHTML={{ __html: r.html }} />
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function HunkGlyph({ decision, reduce }: { decision?: HunkDecision; reduce: boolean }) {
  const draw = reduce ? {} : { initial: { pathLength: 0 }, animate: { pathLength: 1 } };
  if (decision === "accepted")
    return (
      <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="text-success">
        <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" {...draw} transition={{ duration: 0.32, ease: ease.out, delay: 0.05 }} />
      </svg>
    );
  if (decision === "rejected")
    return (
      <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" className="text-fg-3">
        <motion.path d="m4.5 4.5 7 7" {...draw} transition={{ duration: 0.2, ease: ease.out, delay: 0.04 }} />
        <motion.path d="m11.5 4.5-7 7" {...draw} transition={{ duration: 0.2, ease: ease.out, delay: 0.14 }} />
      </svg>
    );
  return <span className="size-1.5 rounded-full bg-fg-4" />;
}
