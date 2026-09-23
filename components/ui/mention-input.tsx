"use client";
import { autoUpdate, flip, FloatingPortal, offset, shift, size, useFloating } from "@floating-ui/react";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

export type MentionUser = {
  id: string;
  name: string;
  /** A second line: a role, a team, an email. */
  detail?: string;
  avatar?: string;
};

export type Mention = { id: string; label: string; start: number; end: number };

export type MentionInputProps = Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange" | "children"> & {
  /** People who can be mentioned. Filtered by name and detail as you type. */
  users: MentionUser[];
  value?: string;
  defaultValue?: string;
  /** Mentions that already exist in defaultValue, by character range. */
  defaultMentions?: Mention[];
  /** The plain text and every mention in it, with ranges that stay correct as the text is edited. */
  onValueChange?: (text: string, mentions: Mention[]) => void;
  /** Most suggestions shown at once. */
  limit?: number;
  /** Rows before the field starts scrolling. */
  maxRows?: number;
  label?: React.ReactNode;
  /** Where the suggestion list portals to. Defaults to document.body. */
  portalRoot?: HTMLElement | null;
};

/** Turn text + mentions into your storage format, e.g. "Thanks <@u_42>". */
export function mentionsToMarkup(text: string, mentions: Mention[], format: (m: Mention) => string = (m) => `<@${m.id}>`) {
  let out = "";
  let at = 0;
  for (const m of [...mentions].sort((a, b) => a.start - b.start)) {
    out += text.slice(at, m.start) + format(m);
    at = m.end;
  }
  return out + text.slice(at);
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

/** Finds an "@query" that ends at the caret and isn't inside an existing mention. */
function findTrigger(text: string, caret: number, mentions: Mention[]) {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && !/[\s([{"'“]/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  // One space is allowed so "@maya ch" still narrows to Maya Chen.
  if (!/^[^\s@]*( [^\s@]*)?$/.test(query)) return null;
  if (mentions.some((m) => at >= m.start && at < m.end)) return null;
  return { at, query };
}

export function MentionInput({
  users,
  value: valueProp,
  defaultValue = "",
  defaultMentions = [],
  onValueChange,
  limit = 6,
  maxRows = 8,
  label,
  portalRoot,
  className,
  placeholder,
  disabled,
  readOnly,
  id: idProp,
  onKeyDown,
  onBlur,
  rows = 3,
  ...rest
}: MentionInputProps) {
  const reduce = useReducedMotion();
  const autoId = useId();
  const id = idProp ?? `mention-${autoId}`;
  const listId = `${id}-list`;
  const [inner, setInner] = useState(defaultValue);
  const text = valueProp ?? inner;
  const [mentions, setMentions] = useState<Mention[]>(defaultMentions);
  const [trigger, setTrigger] = useState<{ at: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const pendingCaret = useRef<number | null>(null);

  const matches = useMemo(() => {
    if (!trigger) return [];
    const q = trigger.query.toLocaleLowerCase();
    const scored = users
      .map((u) => {
        const name = u.name.toLocaleLowerCase();
        const detail = (u.detail ?? "").toLocaleLowerCase();
        const words = name.split(/\s+/);
        const score = !q ? 1 : name.startsWith(q) ? 4 : words.some((w) => w.startsWith(q)) ? 3 : name.includes(q) ? 2 : detail.includes(q) ? 1 : 0;
        return { u, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((x) => x.u);
  }, [trigger, users, limit]);

  const open = Boolean(trigger) && dismissedAt !== trigger?.at && !disabled && !readOnly && (matches.length > 0 || (trigger?.query.length ?? 0) > 0);
  const activeIndex = Math.min(active, Math.max(0, matches.length - 1));

  const {
    refs: { setFloating, setPositionReference },
    floatingStyles,
  } = useFloating({
    open,
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset({ mainAxis: 6, crossAxis: -8 }),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({ padding: 8, apply: ({ availableHeight, elements }) => elements.floating.style.setProperty("--avail", `${Math.min(280, availableHeight)}px`) }),
    ],
  });

  const emit = (nextText: string, nextMentions: Mention[]) => {
    if (valueProp === undefined) setInner(nextText);
    setMentions(nextMentions);
    onValueChange?.(nextText, nextMentions);
  };

  const refreshTrigger = (t: string, caret: number, ms: Mention[]) => {
    const found = findTrigger(t, caret, ms);
    setTrigger(found);
    if (!found || found.at !== trigger?.at) setActive(0);
    if (!found) setDismissedAt(null);
  };

  const insert = (user: MentionUser) => {
    if (!trigger) return;
    const area = areaRef.current;
    const caret = area?.selectionStart ?? trigger.at + trigger.query.length + 1;
    const token = `@${user.name}`;
    const after = text.slice(caret);
    const spacer = after.startsWith(" ") ? "" : " ";
    const nextText = text.slice(0, trigger.at) + token + spacer + after;
    const delta = token.length + spacer.length - (caret - trigger.at);
    const nextMentions = [
      ...mentions.map((m) => (m.start >= caret ? { ...m, start: m.start + delta, end: m.end + delta } : m)),
      { id: user.id, label: token, start: trigger.at, end: trigger.at + token.length },
    ].sort((a, b) => a.start - b.start);
    pendingCaret.current = trigger.at + token.length + 1;
    emit(nextText, nextMentions);
    setTrigger(null);
    setFresh(`${user.id}:${trigger.at}`);
  };

  // The token that just landed glows for a moment, then settles into the text.
  useEffect(() => {
    if (!fresh) return;
    const t = window.setTimeout(() => setFresh(null), 700);
    return () => window.clearTimeout(t);
  }, [fresh]);

  // Grow with the text up to maxRows; restore the caret after programmatic edits.
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const lh = parseFloat(getComputedStyle(area).lineHeight) || 20;
    const pad = parseFloat(getComputedStyle(area).paddingTop) * 2;
    area.style.height = "auto";
    area.style.height = `${Math.min(Math.max(area.scrollHeight, lh * rows + pad), lh * maxRows + pad)}px`;
    if (mirrorRef.current) mirrorRef.current.scrollTop = area.scrollTop;
    const caret = pendingCaret.current;
    if (caret !== null && document.activeElement === area) {
      pendingCaret.current = null;
      area.setSelectionRange(caret, caret);
    }
  }, [text, rows, maxRows]);

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    const caret = e.target.selectionStart ?? next.length;
    // Diff old and new to find the edited span, then carry every mention across it:
    // before it stays, after it shifts, touching it turns back into plain text.
    let p = 0;
    while (p < text.length && p < next.length && text[p] === next[p]) p++;
    let s = 0;
    while (s < text.length - p && s < next.length - p && text[text.length - 1 - s] === next[next.length - 1 - s]) s++;
    const oldEnd = text.length - s;
    const delta = next.length - text.length;
    const nextMentions = mentions.flatMap((m) =>
      m.end <= p ? [m] : m.start >= oldEnd ? [{ ...m, start: m.start + delta, end: m.end + delta }] : [],
    );
    emit(next, nextMentions);
    refreshTrigger(next, caret, nextMentions);
  };

  const segments = useMemo(() => {
    const out: { text: string; mention?: Mention; anchor?: boolean }[] = [];
    let at = 0;
    const anchorAt = open && trigger ? trigger.at : -1;
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
      out.push({ text: text.slice(m.start, m.end), mention: m });
      at = m.end;
    }
    push(text.slice(at));
    return out;
  }, [text, mentions, open, trigger]);

  const setAnchor = useCallback((el: HTMLSpanElement | null) => setPositionReference(el), [setPositionReference]);
  const shared = "whitespace-pre-wrap break-words [scrollbar-gutter:stable] px-3 py-2 text-base leading-6 sm:text-[13px] sm:leading-5";

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-1.5", className)} data-disabled={disabled || undefined}>
      {label && (
        <label htmlFor={id} className="w-fit text-[12.5px] font-medium leading-4 text-fg">
          {label}
        </label>
      )}
      <div
        className={cn(
          "relative rounded-lg border border-line-2 bg-raised",
          "transition-[border-color,box-shadow] duration-150 ease-out",
          "hover:border-fg-4 focus-within:border-fg-3 focus-within:ring-3 focus-within:ring-fg/8 focus-within:hover:border-fg-3",
          disabled && "pointer-events-none opacity-50",
          readOnly && "bg-hover",
        )}
      >
        {/* The visible text, drawn behind a transparent textarea so mentions can be styled as tokens. */}
        <div ref={mirrorRef} aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden text-fg", shared)}>
          {segments.map((seg, i) =>
            seg.mention ? (
              <span
                key={i}
                data-fresh={fresh === `${seg.mention.id}:${seg.mention.start}` || undefined}
                className={cn(
                  // Background and a same-color ring give the token room without changing its width.
                  "rounded-[4px] bg-fg/10 text-fg shadow-[0_0_0_2px_color-mix(in_oklab,var(--fg)_10%,transparent)] [box-decoration-break:clone]",
                  "transition-[background-color,box-shadow] duration-500 ease-out",
                  "data-[fresh]:bg-fg/25 data-[fresh]:shadow-[0_0_0_2px_color-mix(in_oklab,var(--fg)_25%,transparent)] data-[fresh]:duration-75",
                )}
              >
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
          {/* A trailing newline needs a character after it to take up a line. */}
          {"​"}
        </div>

        <textarea
          {...rest}
          ref={areaRef}
          id={id}
          rows={rows}
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open && matches[activeIndex] ? `${listId}-${matches[activeIndex].id}` : undefined}
          onChange={onChange}
          onSelect={(e) => {
            const el = e.currentTarget;
            if (el.selectionStart === el.selectionEnd) refreshTrigger(text, el.selectionStart, mentions);
            else setTrigger(null);
          }}
          onScroll={(e) => {
            if (mirrorRef.current) mirrorRef.current.scrollTop = e.currentTarget.scrollTop;
          }}
          onBlur={(e) => {
            setTrigger(null);
            onBlur?.(e);
          }}
          onKeyDown={(e) => {
            onKeyDown?.(e);
            if (e.defaultPrevented || e.nativeEvent.isComposing) return;
            if (open && matches.length) {
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
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                insert(matches[activeIndex]);
                return;
              }
            }
            if (open && e.key === "Escape") {
              e.preventDefault();
              setDismissedAt(trigger?.at ?? null);
              return;
            }
            const el = e.currentTarget;
            if (el.selectionStart !== el.selectionEnd) return;
            const caret = el.selectionStart;
            // A mention goes as one piece: Backspace at its end or Delete at its start removes all of it.
            const hit =
              e.key === "Backspace"
                ? mentions.find((m) => caret > m.start && caret <= m.end)
                : e.key === "Delete"
                  ? mentions.find((m) => caret >= m.start && caret < m.end)
                  : undefined;
            if (hit) {
              e.preventDefault();
              // Take one neighboring space with it, so removing a name doesn't leave a double gap.
              const end = text[hit.end] === " " && (hit.start === 0 || /\s/.test(text[hit.start - 1])) ? hit.end + 1 : hit.end;
              const nextText = text.slice(0, hit.start) + text.slice(end);
              const len = end - hit.start;
              const nextMentions = mentions.filter((m) => m !== hit).map((m) => (m.start >= end ? { ...m, start: m.start - len, end: m.end - len } : m));
              pendingCaret.current = hit.start;
              emit(nextText, nextMentions);
            }
          }}
          className={cn(
            "relative block w-full resize-none bg-transparent text-transparent caret-fg outline-none placeholder:text-fg-4",
            "selection:bg-fg/20! selection:text-transparent!",
            "[scrollbar-width:thin]",
            shared,
          )}
        />
      </div>

      {open && (
        <FloatingPortal root={portalRoot ?? undefined}>
          <div
            ref={setFloating}
            style={floatingStyles}
            className="z-(--z-popover) w-[min(18rem,calc(100vw-16px))]"
          >
            {/* It opens from typing, dozens of times a day, so it only fades in: 100ms, no travel to wait for. */}
            <motion.div
              id={listId}
              role="listbox"
              aria-label="People"
              initial={{ opacity: 0, y: reduce ? 0 : -2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.1, ease: ease.out }}
              // Keeps focus (and the caret) in the textarea while choosing with the pointer.
              onMouseDown={(e) => e.preventDefault()}
              className="max-h-(--avail) overflow-y-auto overscroll-contain rounded-xl border border-line-2 bg-raised p-1 shadow-pop"
            >
              {matches.length === 0 ? (
                <p className="px-2.5 py-2 text-[12.5px] text-fg-3">
                  No one matches “{trigger?.query}”
                </p>
              ) : (
                matches.map((u, i) => (
                  <div
                    key={u.id}
                    id={`${listId}-${u.id}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseMove={() => i !== activeIndex && setActive(i)}
                    onClick={() => insert(u)}
                    className="flex h-10 cursor-default select-none items-center gap-2.5 rounded-lg px-2 aria-selected:bg-fg/8"
                  >
                    <span aria-hidden className="grid size-6 shrink-0 place-items-center overflow-hidden rounded-full bg-fg/10 text-[10px] font-medium text-fg-2">
                      {u.avatar ? <span className="size-full bg-cover bg-center" style={{ backgroundImage: `url(${u.avatar})` }} /> : initials(u.name)}
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
        {open ? (matches.length ? `${matches.length} ${matches.length === 1 ? "person" : "people"} found` : "No matches") : ""}
      </span>
    </div>
  );
}

/** The part of the name that matched reads a step brighter. */
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
