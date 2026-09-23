"use client";
import { autoUpdate, flip, FloatingPortal, offset, shift, size, useFloating } from "@floating-ui/react";
import { Toolbar } from "@base-ui/react/toolbar";
import { Tooltip } from "@base-ui/react/tooltip";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { AtSign, Check, Code, Loader } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * Types and text helpers
 * -----------------------------------------------------------------------------------------------*/

export type ComposerUser = {
  id: string;
  name: string;
  /** A second line in the suggestions: a role, a team, an email. */
  detail?: string;
  avatarUrl?: string;
};

export type ComposerMention = { id: string; name: string; start: number; end: number };

export type ComposerComment = { body: string; mentions: ComposerMention[] };

/**
 * Finds "@Name" for every known user in the text. Mentions are derived from the text rather
 * than tracked alongside it, so a controlled value, a paste or an undo can never desync them.
 */
export function findMentions(text: string, users: ComposerUser[]): ComposerMention[] {
  if (!users.length || !text.includes("@")) return [];
  const byLength = [...users].sort((a, b) => b.name.length - a.name.length);
  const out: ComposerMention[] = [];
  for (let i = text.indexOf("@"); i !== -1; i = text.indexOf("@", i + 1)) {
    if (i > 0 && !/[\s([{"'“]/.test(text[i - 1])) continue;
    const user = byLength.find((u) => text.startsWith(u.name, i + 1) && !/[\p{L}\p{N}_]/u.test(text[i + 1 + u.name.length] ?? ""));
    if (!user) continue;
    out.push({ id: user.id, name: user.name, start: i, end: i + 1 + user.name.length });
    i += user.name.length;
  }
  return out;
}

/** An "@query" that ends at the caret and isn't already a finished mention. */
function findTrigger(text: string, caret: number, mentions: ComposerMention[]) {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && !/[\s([{"'“]/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  // One space allowed, so "@mara ok" still narrows to Mara Okafor.
  if (!/^[^\s@]*( [^\s@]*)?$/.test(query)) return null;
  if (mentions.some((m) => at >= m.start && at < m.end)) return null;
  return { at, query };
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

/**
 * Edits through the browser's own insertText so Cmd+Z undoes a mention or a bold like any
 * typing. Falls back to setRangeText plus a synthetic input event where execCommand is gone.
 */
function replaceRange(el: HTMLTextAreaElement, text: string, start: number, end: number) {
  el.focus({ preventScroll: true });
  el.setSelectionRange(start, end);
  let ok = false;
  try {
    ok = document.execCommand("insertText", false, text);
  } catch {
    ok = false;
  }
  if (!ok) {
    el.setRangeText(text, start, end, "end");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

const noop = () => () => {};
const isApple = () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
const listFormat = typeof Intl !== "undefined" && "ListFormat" in Intl ? new Intl.ListFormat(undefined, { type: "conjunction" }) : null;

const storage = {
  read(key: string) {
    try {
      return window.localStorage.getItem(key) ?? "";
    } catch {
      return "";
    }
  },
  write(key: string, value: string) {
    try {
      if (value) window.localStorage.setItem(key, value);
      else window.localStorage.removeItem(key);
    } catch {
      /* Private mode or blocked storage: the draft just isn't persisted. */
    }
  },
};

/* -------------------------------------------------------------------------------------------------
 * Icons drawn on the library grid (16px, 1.4 stroke) that the shared set doesn't have
 * -----------------------------------------------------------------------------------------------*/

const glyph = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const BoldIcon = () => (
  <svg {...glyph} strokeWidth={1.7}>
    <path d="M5 3.25h3.6a2.3 2.3 0 0 1 0 4.6H5zM5 7.85h4.1a2.45 2.45 0 0 1 0 4.9H5z" />
  </svg>
);
const ItalicIcon = () => (
  <svg {...glyph}>
    <path d="M10.75 3.25h-4M9.25 12.75h-4M8.9 3.25 7.1 12.75" />
  </svg>
);

/* -------------------------------------------------------------------------------------------------
 * CommentComposer
 * -----------------------------------------------------------------------------------------------*/

type Phase = "idle" | "sending" | "sent";

export type CommentComposerProps = Omit<React.ComponentProps<"div">, "onSubmit" | "defaultValue" | "onChange" | "children"> & {
  /** Post the comment. Return a promise: while it's pending the field locks; a rejection keeps the text and shows an error. */
  onSubmit: (comment: ComposerComment) => void | Promise<unknown>;
  value?: string;
  defaultValue?: string;
  onValueChange?: (text: string) => void;
  /** People who can be @mentioned. Leave empty to turn mentions off. */
  users?: ComposerUser[];
  /** Shows the writer's avatar beside the field. */
  author?: { name: string; avatarUrl?: string };
  placeholder?: string;
  /** The send button's label. */
  submitLabel?: string;
  /** Persist the draft in localStorage under this key, so a reload or a closed tab doesn't lose it. */
  draftKey?: string;
  /** Characters allowed. A counter appears at 80%, and sending is blocked past it. */
  maxLength?: number;
  disabled?: boolean;
  /** Start expanded, e.g. when opened from a "Reply" button. */
  defaultExpanded?: boolean;
  autoFocus?: boolean;
  /** Where the mention list portals to. Defaults to document.body. */
  portalContainer?: HTMLElement | null;
};

export function CommentComposer({
  onSubmit,
  value: valueProp,
  defaultValue = "",
  onValueChange,
  users = [],
  author,
  placeholder = "Add a comment…",
  submitLabel = "Comment",
  draftKey,
  maxLength,
  disabled = false,
  defaultExpanded = false,
  autoFocus = false,
  portalContainer,
  className,
  ...rest
}: CommentComposerProps) {
  const reduce = !!useReducedMotion();
  const apple = useSyncExternalStore(noop, isApple, () => true);
  const uid = useId();
  const listId = `${uid}-mentions`;
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;

  const [text, setText] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const [open, setOpenState] = useState(defaultExpanded);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState<{ at: number; query: string } | null>(null);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const [flight, setFlight] = useState<{ id: number; text: string } | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const areaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const growRef = useRef(false);
  const sentTimer = useRef<number>(undefined);

  const mentions = useMemo(() => findMentions(text, users), [text, users]);
  const length = text.length;
  const over = maxLength != null && length > maxLength;
  const nearLimit = maxLength != null && length >= maxLength * 0.8;
  const empty = text.trim().length === 0;
  const busy = phase === "sending";
  const expanded = open || busy || phase === "sent";

  const setOpen = (next: boolean) => {
    if (next === open) return;
    growRef.current = true;
    setOpenState(next);
  };

  /* ----- draft ----- */
  const draftStorageKey = draftKey ? `stealth:comment-draft:${draftKey}` : null;
  const restored = useRef(false);
  useEffect(() => {
    if (!draftStorageKey || restored.current) return;
    restored.current = true;
    if (valueProp !== undefined || text) return;
    const saved = storage.read(draftStorageKey);
    // Restoring a saved draft is a one-time sync from storage after hydration.
    if (saved) setText(saved);
  }, [draftStorageKey, valueProp, text, setText]);
  useEffect(() => {
    if (!draftStorageKey || !restored.current) return;
    const t = window.setTimeout(() => storage.write(draftStorageKey, text), 300);
    return () => window.clearTimeout(t);
  }, [draftStorageKey, text]);

  useEffect(() => () => window.clearTimeout(sentTimer.current), []);

  /* ----- height: animated when it opens or closes, instant while typing ----- */
  const height = useMotionValue<number | string>("auto");
  useEffect(() => {
    const el = mirrorRef.current;
    if (!el) return;
    let last = el.offsetHeight;
    let running: AnimationPlaybackControls | undefined;
    const ro = new ResizeObserver(() => {
      const next = el.offsetHeight;
      if (next === last) return;
      const from = last;
      last = next;
      running?.stop();
      if (!growRef.current || reduce) return height.set(next);
      growRef.current = false;
      if (height.get() === "auto") height.set(from);
      running = animate(height, next, { duration: 0.24, ease: ease.inOut });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      running?.stop();
    };
  }, [height, reduce]);

  /* ----- mention suggestions ----- */
  const matches = useMemo(() => {
    if (!trigger || !users.length) return [];
    const q = trigger.query.toLocaleLowerCase();
    return users
      .map((u) => {
        const name = u.name.toLocaleLowerCase();
        const score = !q ? 1 : name.startsWith(q) ? 4 : name.split(/\s+/).some((w) => w.startsWith(q)) ? 3 : name.includes(q) ? 2 : (u.detail ?? "").toLocaleLowerCase().includes(q) ? 1 : 0;
        return { u, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((x) => x.u);
  }, [trigger, users]);
  const listOpen = Boolean(trigger) && dismissedAt !== trigger?.at && !busy && (matches.length > 0 || (trigger?.query.length ?? 0) > 0);
  const activeIndex = Math.min(active, Math.max(0, matches.length - 1));

  const {
    refs: { setFloating, setPositionReference },
    floatingStyles,
  } = useFloating({
    open: listOpen,
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset({ mainAxis: 6, crossAxis: -8 }),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({ padding: 8, apply: ({ availableHeight, elements }) => elements.floating.style.setProperty("--avail", `${Math.min(264, availableHeight)}px`) }),
    ],
  });
  const setAnchor = useCallback((el: HTMLSpanElement | null) => setPositionReference(el), [setPositionReference]);

  const refreshTrigger = (t: string, caret: number) => {
    const found = users.length ? findTrigger(t, caret, findMentions(t, users)) : null;
    setTrigger(found);
    if (!found || found.at !== trigger?.at) setActive(0);
    if (!found) setDismissedAt(null);
  };

  const pick = (user: ComposerUser) => {
    const el = areaRef.current;
    if (!el || !trigger) return;
    const caret = el.selectionStart;
    const after = text.slice(caret);
    replaceRange(el, `@${user.name}${after.startsWith(" ") ? "" : " "}`, trigger.at, caret);
    setTrigger(null);
    setAnnouncement(`${user.name} will be notified`);
  };

  /* ----- formatting ----- */
  const wrap = (before: string, after = before) => {
    const el = areaRef.current;
    if (!el || busy) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const selected = value.slice(s, e);
    // Pressing it again on wrapped text unwraps it.
    if (value.slice(s - before.length, s) === before && value.slice(e, e + after.length) === after) {
      replaceRange(el, selected, s - before.length, e + after.length);
      el.setSelectionRange(s - before.length, e - before.length);
      return;
    }
    replaceRange(el, before + selected + after, s, e);
    el.setSelectionRange(s + before.length, s + before.length + selected.length);
  };

  const startMention = () => {
    const el = areaRef.current;
    if (!el || busy) return;
    const s = el.selectionStart;
    const needsSpace = s > 0 && !/\s/.test(el.value[s - 1]);
    replaceRange(el, needsSpace ? " @" : "@", s, el.selectionEnd);
  };

  /* ----- send ----- */
  const submit = async () => {
    const body = text.trim();
    if (!body || over || busy || disabled) return;
    setPhase("sending");
    setError(null);
    setTrigger(null);
    window.clearTimeout(sentTimer.current);
    try {
      await onSubmit({ body, mentions: findMentions(body, users) });
      setFlight((f) => ({ id: (f?.id ?? 0) + 1, text }));
      setText("");
      if (draftStorageKey) storage.write(draftStorageKey, "");
      setPhase("sent");
      setAnnouncement("Comment posted");
      sentTimer.current = window.setTimeout(() => {
        setPhase("idle");
        if (document.activeElement !== areaRef.current) {
          growRef.current = true;
          setOpenState(false);
        }
      }, 1400);
    } catch {
      setPhase("idle");
      setError("Couldn’t post your comment. Try again.");
      setAnnouncement("Couldn’t post your comment");
    }
  };

  /* ----- mirror: the visible text, with mentions drawn as tokens behind a transparent textarea ----- */
  const segments = useMemo(() => {
    const out: { text: string; mention?: boolean; anchor?: boolean }[] = [];
    const anchorAt = listOpen && trigger ? trigger.at : -1;
    let at = 0;
    const push = (t: string) => {
      if (anchorAt >= at && anchorAt < at + t.length) {
        const i = anchorAt - at;
        if (i > 0) out.push({ text: t.slice(0, i) });
        out.push({ text: "@", anchor: true });
        if (t.length > i + 1) out.push({ text: t.slice(i + 1) });
      } else if (t) out.push({ text: t });
      at += t.length;
    };
    for (const m of mentions) {
      push(text.slice(at, m.start));
      out.push({ text: text.slice(m.start, m.end), mention: true });
      at = m.end;
    }
    push(text.slice(at));
    return out;
  }, [text, mentions, listOpen, trigger]);

  const notified = [...new Map(mentions.map((m) => [m.id, m.name])).values()];
  const shared = "whitespace-pre-wrap break-words px-3 py-2 text-base leading-5 sm:text-[13px] [overflow-wrap:anywhere]";
  const kbdMod = apple ? "⌘" : "Ctrl";

  return (
    <div className={cn("flex w-full min-w-0 items-start gap-2.5", className)} data-state={expanded ? "open" : "closed"} data-disabled={disabled || undefined} {...rest}>
      {author && (
        <span
          aria-hidden
          className="mt-1.5 grid size-6 shrink-0 select-none place-items-center overflow-hidden rounded-full bg-hover text-[10px] font-medium text-fg-2 shadow-[inset_0_0_0_1px_var(--line-2)]"
        >
          {author.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={author.avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            initials(author.name)
          )}
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div
          onMouseDown={(e) => {
            // A press anywhere on the field's padding or toolbar gaps puts the caret in the text.
            if (e.target === e.currentTarget) {
              e.preventDefault();
              areaRef.current?.focus();
            }
          }}
          className={cn(
            "relative min-w-0 rounded-xl border bg-raised shadow-[var(--shadow)]",
            "transition-[border-color,box-shadow] duration-150 ease-out",
            "focus-within:ring-3 focus-within:ring-fg/8",
            error || over ? "border-danger/60" : expanded ? "border-fg-4/70 focus-within:border-fg-4" : "border-line-2 hover:border-fg-4 focus-within:border-fg-4",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <motion.div style={{ height }} className="relative overflow-hidden rounded-t-xl">
            {/* The mirror sets the height and draws the text; the textarea sits over it with transparent ink. */}
            <div
              ref={mirrorRef}
              aria-hidden
              className={cn(
                shared,
                "pointer-events-none overflow-hidden text-fg",
                expanded ? "min-h-[76px] max-h-60" : "max-h-9 min-h-9",
                busy && "opacity-50 transition-opacity delay-150 duration-200",
                !expanded && text && "pr-16",
              )}
            >
              {segments.map((seg, i) =>
                seg.mention ? (
                  <span key={i} className="rounded-[4px] bg-fg/10 text-fg shadow-[0_0_0_1px_color-mix(in_oklab,var(--fg)_10%,transparent)] [box-decoration-break:clone]">
                    {seg.text}
                  </span>
                ) : seg.anchor ? (
                  <span key={i} ref={setAnchor}>
                    @
                  </span>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}
              {"​"}
            </div>

            <textarea
              ref={areaRef}
              value={text}
              rows={1}
              disabled={disabled}
              readOnly={busy}
              autoFocus={autoFocus}
              placeholder={placeholder}
              aria-label={placeholder.replace(/…$/, "")}
              aria-invalid={over || !!error || undefined}
              aria-describedby={cn(error ? errorId : "", hintId) || undefined}
              aria-keyshortcuts={`${apple ? "Meta" : "Control"}+Enter`}
              enterKeyHint="enter"
              role={users.length ? "combobox" : undefined}
              aria-autocomplete={users.length ? "list" : undefined}
              aria-expanded={users.length ? listOpen : undefined}
              aria-controls={listOpen ? listId : undefined}
              aria-activedescendant={listOpen && matches[activeIndex] ? `${listId}-${matches[activeIndex].id}` : undefined}
              onFocus={() => setOpen(true)}
              onBlur={() => {
                setTrigger(null);
                if (empty && phase === "idle") setOpen(false);
              }}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
                if (!open) setOpen(true);
                refreshTrigger(e.target.value, e.target.selectionStart ?? e.target.value.length);
              }}
              onSelect={(e) => {
                const el = e.currentTarget;
                if (el.selectionStart === el.selectionEnd) refreshTrigger(el.value, el.selectionStart);
                else setTrigger(null);
              }}
              onScroll={(e) => {
                if (mirrorRef.current) mirrorRef.current.scrollTop = e.currentTarget.scrollTop;
              }}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                const mod = e.metaKey || e.ctrlKey;
                if (listOpen && matches.length) {
                  if (e.key === "ArrowDown" || (e.key === "n" && e.ctrlKey)) {
                    e.preventDefault();
                    setActive((activeIndex + 1) % matches.length);
                    return;
                  }
                  if (e.key === "ArrowUp" || (e.key === "p" && e.ctrlKey)) {
                    e.preventDefault();
                    setActive((activeIndex - 1 + matches.length) % matches.length);
                    return;
                  }
                  if ((e.key === "Enter" && !mod) || e.key === "Tab") {
                    e.preventDefault();
                    pick(matches[activeIndex]);
                    return;
                  }
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  if (listOpen) setDismissedAt(trigger?.at ?? null);
                  else if (open) {
                    // Folds back to one line and keeps the draft; focus stays so typing reopens it.
                    setOpen(false);
                    e.currentTarget.scrollTop = 0;
                  }
                  return;
                }
                if (e.key === "Enter" && mod) {
                  e.preventDefault();
                  void submit();
                  return;
                }
                if (mod && !e.shiftKey && !e.altKey) {
                  const k = e.key.toLowerCase();
                  if (k === "b" || k === "i" || k === "e") {
                    e.preventDefault();
                    wrap(k === "b" ? "**" : k === "i" ? "_" : "`");
                    return;
                  }
                }
                // A mention is removed whole: Backspace at its end takes the name, not one letter.
                const el = e.currentTarget;
                if (e.key === "Backspace" && el.selectionStart === el.selectionEnd) {
                  const hit = mentions.find((m) => el.selectionStart === m.end);
                  if (hit) {
                    e.preventDefault();
                    replaceRange(el, "", hit.start, hit.end);
                  }
                }
              }}
              className={cn(
                shared,
                "absolute inset-0 block size-full resize-none overflow-y-auto bg-transparent text-transparent caret-fg outline-none placeholder:text-fg-4",
                "selection:bg-fg/20 selection:text-transparent [scrollbar-width:thin]",
                !expanded && "overflow-hidden",
                !expanded && text && "pr-16",
                busy && "cursor-progress",
              )}
            />

            {/* Collapsed with words in it: say it's a draft, so nobody thinks it was sent. */}
            <AnimatePresence initial={false}>
              {!expanded && text && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.08 } }}
                  className="pointer-events-none absolute right-3 top-2 font-mono text-[10.5px] uppercase leading-5 tracking-[0.08em] text-fg-3"
                >
                  Draft
                </motion.span>
              )}
            </AnimatePresence>

            {/* Sent: the words lift away toward the thread above while the field empties. */}
            <AnimatePresence>
              {flight && (
                <motion.div
                  key={flight.id}
                  aria-hidden
                  initial={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  animate={reduce ? { opacity: 0 } : { opacity: 0, y: -14, filter: "blur(3px)" }}
                  // It rises on the expo curve but fades on ease-in, so the words are seen leaving, not blinking out.
                  transition={reduce ? { duration: 0.15 } : { duration: 0.34, ease: ease.out, opacity: { duration: 0.3, ease: ease.in } }}
                  onAnimationComplete={() => setFlight(null)}
                  className={cn(shared, "pointer-events-none absolute inset-x-0 top-0 text-fg")}
                >
                  {flight.text}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="toolbar"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0, transition: { height: { duration: reduce ? 0 : 0.18, ease: ease.inOut }, opacity: { duration: 0.08 } } }}
                transition={reduce ? { duration: 0.12, height: { duration: 0 } } : { height: { duration: 0.24, ease: ease.inOut }, opacity: { duration: 0.18, delay: 0.05 } }}
                className="overflow-hidden"
              >
                <AnimatePresence initial={false}>
                  {notified.length > 0 && (
                    <motion.p
                      key="notify"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: reduce ? 0 : 0.2, ease: ease.inOut }}
                      className="overflow-hidden px-3 text-[12px] text-fg-3"
                    >
                      <span className="flex items-center gap-1.5 pb-1.5" suppressHydrationWarning>
                        <AtSign size={12} className="shrink-0" />
                        <span className="min-w-0 truncate">
                          Notifies <span className="text-fg-2">{listFormat ? listFormat.format(notified) : notified.join(", ")}</span>
                        </span>
                      </span>
                    </motion.p>
                  )}
                </AnimatePresence>

                <div className="flex min-w-0 items-center gap-2 border-t border-line py-1.5 pl-1.5 pr-1.5">
                  <Toolbar.Root aria-label="Formatting" className="flex items-center gap-0.5">
                    <ToolButton label="Bold" keys={[kbdMod, "B"]} onPress={() => wrap("**")} disabled={busy}>
                      <BoldIcon />
                    </ToolButton>
                    <ToolButton label="Italic" keys={[kbdMod, "I"]} onPress={() => wrap("_")} disabled={busy}>
                      <ItalicIcon />
                    </ToolButton>
                    <ToolButton label="Code" keys={[kbdMod, "E"]} onPress={() => wrap("`")} disabled={busy}>
                      <Code />
                    </ToolButton>
                    {users.length > 0 && (
                      <>
                        <Toolbar.Separator className="mx-1 h-4 w-px bg-line-2" />
                        <ToolButton label="Mention someone" keys={["@"]} onPress={startMention} disabled={busy}>
                          <AtSign />
                        </ToolButton>
                      </>
                    )}
                  </Toolbar.Root>

                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    {maxLength != null && nearLimit && (
                      <span className={cn("font-mono text-[11px] tabular", over ? "text-danger" : "text-fg-3")} aria-live="polite">
                        {length}/{maxLength}
                      </span>
                    )}
                    <SendButton
                      phase={phase}
                      label={submitLabel}
                      keys={[kbdMod, "↵"]}
                      disabled={empty || over || disabled}
                      onPress={() => void submit()}
                      reduce={reduce}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence initial={false}>
          {error && (
            <motion.p
              id={errorId}
              role="alert"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.18, ease: ease.out }}
              className="px-3 text-[12px] text-danger"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        <span id={hintId} className="sr-only">
          {`Press ${apple ? "Command" : "Control"} Enter to send.${users.length ? " Type @ to mention someone." : ""}`}
        </span>
      </div>

      {listOpen && (
        <FloatingPortal root={portalContainer ?? undefined}>
          <div ref={setFloating} style={floatingStyles} className="z-(--z-popover) w-[min(17rem,calc(100vw-16px))]">
            {/* It opens from typing, many times a day, so it only fades and settles 2px: 100ms. */}
            <motion.div
              id={listId}
              role="listbox"
              aria-label="People"
              initial={{ opacity: 0, y: reduce ? 0 : -2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.1, ease: ease.out }}
              onMouseDown={(e) => e.preventDefault()}
              className="max-h-(--avail) overflow-y-auto overscroll-contain rounded-xl border border-line-2 bg-raised p-1 shadow-pop"
            >
              {matches.length === 0 ? (
                <p className="px-2.5 py-2 text-[12.5px] text-fg-3">No one called “{trigger?.query}”</p>
              ) : (
                matches.map((u, i) => (
                  <div
                    key={u.id}
                    id={`${listId}-${u.id}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseMove={() => i !== activeIndex && setActive(i)}
                    onClick={() => pick(u)}
                    className="flex h-10 cursor-default select-none items-center gap-2.5 rounded-lg px-2 aria-selected:bg-fg/[0.06] pointer-coarse:h-11"
                  >
                    <span aria-hidden className="grid size-6 shrink-0 place-items-center overflow-hidden rounded-full bg-fg/10 text-[10px] font-medium text-fg-2">
                      {u.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatarUrl} alt="" className="size-full object-cover" />
                      ) : (
                        initials(u.name)
                      )}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[13px] leading-4 text-fg">
                        <Highlight text={u.name} query={trigger?.query ?? ""} />
                      </span>
                      {u.detail && <span className="truncate text-[11.5px] leading-4 text-fg-3">{u.detail}</span>}
                    </span>
                  </div>
                ))
              )}
            </motion.div>
          </div>
        </FloatingPortal>
      )}

      <span role="status" aria-live="polite" className="sr-only">
        {listOpen ? (matches.length ? `${matches.length} ${matches.length === 1 ? "person" : "people"} found` : "No matches") : announcement}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Parts
 * -----------------------------------------------------------------------------------------------*/

function Highlight({ text, query }: { text: string; query: string }) {
  const i = query ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="font-medium">{text.slice(i, i + query.length)}</span>
      {text.slice(i + query.length)}
    </>
  );
}

function Keys({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <kbd className={cn("flex items-center gap-0.5 font-sans", className)}>
      {keys.map((k) => (
        <span key={k} className={cn("inline-flex h-4 min-w-4 items-center justify-center rounded-[4px] px-1 text-[10.5px] leading-none", k.length > 1 && "font-mono")}>
          {k}
        </span>
      ))}
    </kbd>
  );
}

function ToolButton({
  label,
  keys,
  onPress,
  disabled,
  children,
}: {
  label: string;
  keys: string[];
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        delay={500}
        render={
          <Toolbar.Button
            aria-label={label}
            disabled={disabled}
            // Keeps the caret and the selection in the text while the button is pressed.
            onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
            onClick={onPress}
            className={cn(
              "relative grid size-7 place-items-center rounded-md text-fg-3 outline-none",
              "transition-[background-color,color,scale] duration-150 ease-out-quart hover:bg-fg/[0.06] hover:text-fg active:scale-[0.9] active:duration-75",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
              "data-disabled:opacity-40 data-disabled:hover:bg-transparent",
              "before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] pointer-fine:before:hidden",
            )}
          >
            {children}
          </Toolbar.Button>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" sideOffset={6} className="z-(--z-tooltip)">
          <Tooltip.Popup
            className={cn(
              "flex items-center gap-2 rounded-md border border-line-2 bg-raised py-1 pl-2 pr-1.5 text-[12px] leading-4 text-fg shadow-pop",
              "origin-(--transform-origin) transition-[opacity,scale] duration-150 ease-out-expo",
              "data-starting-style:scale-96 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-100",
              "data-instant:transition-none motion-reduce:data-starting-style:scale-100",
            )}
          >
            {label}
            <Keys keys={keys} className="text-fg-3 [&>span]:border [&>span]:border-line-2 [&>span]:bg-frame" />
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function SendButton({
  phase,
  label,
  keys,
  disabled,
  onPress,
  reduce,
}: {
  phase: Phase;
  label: string;
  keys: string[];
  disabled: boolean;
  onPress: () => void;
  reduce: boolean;
}) {
  const enter = reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" };
  const leave = reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" };
  const resting = (
    <span className="flex items-center gap-1.5">
      {label}
      <kbd className="font-sans text-[11px] tracking-[0.04em] text-frame/55 pointer-coarse:hidden">{keys.join("")}</kbd>
    </span>
  );

  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled && phase === "idle"}
      aria-busy={phase === "sending" || undefined}
      aria-disabled={phase !== "idle" || undefined}
      className={cn(
        "relative inline-flex h-7 shrink-0 select-none items-center justify-center overflow-hidden rounded-md bg-fg px-2.5 text-[12.5px] font-medium text-frame outline-none",
        "transition-[background-color,opacity,scale] duration-150 ease-out-quart hover:bg-fg/90 active:scale-[0.97] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "disabled:opacity-35 disabled:hover:bg-fg aria-busy:cursor-progress",
        "before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
      )}
    >
      {/* Every state is laid out in the same cell, so the button never changes width. */}
      <span className="grid place-items-center">
        <span aria-hidden className="invisible col-start-1 row-start-1">
          {resting}
        </span>
        <span aria-hidden className="invisible col-start-1 row-start-1 flex items-center gap-1.5">
          <Check size={14} />
          Posted
        </span>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={phase}
            className="col-start-1 row-start-1 flex items-center gap-1.5"
            initial={enter}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={leave}
            transition={reduce ? { duration: 0.12 } : phase === "sent" ? spring.pop : { duration: 0.2, ease: ease.out }}
          >
            {phase === "idle" ? (
              resting
            ) : phase === "sending" ? (
              <>
                <Loader size={14} className="animate-spin" />
                <span className="sr-only">Posting</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <motion.path
                    d="M3.5 8.5 6.5 11.5 12.5 4.5"
                    initial={reduce ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.3, ease: ease.out, delay: 0.05 }}
                  />
                </svg>
                Posted
              </>
            )}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
}
