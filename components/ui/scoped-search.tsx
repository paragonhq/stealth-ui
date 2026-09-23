"use client";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useMemo, useRef, useState } from "react";
import { HighlightMatch, findMatches, fold } from "@/components/ui/highlight-match";
import { cn } from "@/lib/cn";
import { CornerDownLeft, Search, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type ScopeValue = { value: string; label: string; icon?: React.ReactNode; description?: string };

export type SearchScope = {
  /** What people type before the colon: "from" for from:. Letters, digits and dashes. */
  key: string;
  /** What it narrows by, in the suggestion list: "Person". */
  label: string;
  description?: string;
  icon?: React.ReactNode;
  /** Suggestions for the value. A function receives the typed query and can return a fresh list. */
  values: ScopeValue[] | ((query: string) => ScopeValue[]);
  /** Accept a typed value that isn't in the list (dates, numbers, ids). */
  freeform?: boolean;
  /** Placeholder while the value is being typed: "a person". */
  placeholder?: string;
};

export type ScopeToken = { scope: string; value: string; label: string };
export type ScopedQuery = { tokens: ScopeToken[]; text: string };

export type ScopedSearchProps = {
  scopes: SearchScope[];
  value?: ScopedQuery;
  defaultValue?: ScopedQuery;
  onValueChange?: (query: ScopedQuery) => void;
  /** Enter with nothing highlighted. */
  onSubmit?: (query: ScopedQuery) => void;
  placeholder?: string;
  "aria-label"?: string;
  /** Portal target for the suggestions. Defaults to document.body. */
  container?: HTMLElement | null;
  className?: string;
};

type Draft = { scope: string; query: string };
type Item = { kind: "scope"; scope: SearchScope } | { kind: "value"; scope: SearchScope; option: ScopeValue } | { kind: "free"; scope: SearchScope; text: string };

const EMPTY: ScopedQuery = { tokens: [], text: "" };

export function ScopedSearch({
  scopes,
  value,
  defaultValue = EMPTY,
  onValueChange,
  onSubmit,
  placeholder = "Search",
  "aria-label": ariaLabel = "Search",
  container,
  className,
}: ScopedSearchProps) {
  const reduce = !!useReducedMotion();
  const [query, setQuery] = useControllableState({ value, defaultValue, onChange: onValueChange });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [focused, setFocused] = useState(false);
  const [highlighted, setHighlighted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [announce, setAnnounce] = useState("");
  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();

  const scopeOf = (key: string) => scopes.find((s) => s.key.toLowerCase() === key.toLowerCase());
  const draftScope = draft ? scopeOf(draft.scope) : undefined;
  const input = draft ? draft.query : query.text;

  // The word being typed at the end of the free text, which may be the start of a scope key.
  const tail = /(?:^|\s)([\w-]*)$/.exec(query.text)?.[1] ?? "";

  const items = useMemo<Item[]>(() => {
    if (draftScope) {
      const q = draft!.query.trim();
      const source = typeof draftScope.values === "function" ? draftScope.values(q) : draftScope.values;
      // Best matches first: a hit at the start of a name beats one in the middle.
      const hits = q
        ? source
            .map((o) => ({ o, m: findMatches(o.label, q) ?? findMatches(o.value, q) }))
            .filter((r) => r.m)
            .sort((a, b) => b.m!.score - a.m!.score)
            .map((r) => r.o)
        : source;
      const list: Item[] = hits.slice(0, 8).map((option) => ({ kind: "value", scope: draftScope, option }));
      const exact = hits.some((o) => fold(o.label) === fold(q) || fold(o.value) === fold(q));
      if (draftScope.freeform && q && !exact) list.push({ kind: "free", scope: draftScope, text: q });
      return list;
    }
    // Scopes are offered on an empty field, or when the last word could be the start of one.
    if (query.text.trim() === "" || tail) {
      const t = fold(tail);
      return scopes.filter((s) => !t || fold(s.key).startsWith(t) || fold(s.label).startsWith(t)).map((scope) => ({ kind: "scope", scope }));
    }
    return [];
  }, [draftScope, draft, scopes, query.text, tail]);

  const open = focused && !dismissed && (items.length > 0 || !!draftScope);

  const commit = (token: ScopeToken) => {
    setQuery({ ...query, tokens: [...query.tokens, token] });
    setDraft(null);
    const scope = scopeOf(token.scope);
    setAnnounce(`Added ${scope?.label ?? token.scope}: ${token.label}`);
  };

  const startDraft = (scope: SearchScope, withText = query.text) => {
    // The key the person typed becomes a chip; whatever came before it stays as free text.
    const text = withText.replace(/(?:^|\s)[\w-]*:?$/, (m) => (m.startsWith(" ") ? " " : "")).replace(/\s+$/, " ");
    setQuery({ ...query, text: text.trim() ? text : "" });
    setDraft({ scope: scope.key, query: "" });
    setDismissed(false);
    setAnnounce(`${scope.label} scope. Type ${scope.placeholder ?? "a value"}.`);
  };

  const pick = (item: Item) => {
    if (item.kind === "scope") startDraft(item.scope);
    else if (item.kind === "value") commit({ scope: item.scope.key, value: item.option.value, label: item.option.label });
    else commit({ scope: item.scope.key, value: item.text, label: item.text });
    inputRef.current?.focus();
  };

  const onInput = (next: string) => {
    setDismissed(false);
    if (draft) {
      setDraft({ ...draft, query: next });
      return;
    }
    // Typing a known key and its colon turns it into a scope on the same keystroke.
    const m = /(?:^|\s)([\w-]+):$/.exec(next);
    const scope = m ? scopeOf(m[1]) : undefined;
    if (scope) return startDraft(scope, next);
    setQuery({ ...query, text: next });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    if (e.key === "Backspace" && atStart) {
      if (draft && draft.query === "") {
        // Backspacing into a bare key hands it back as text, colon removed, like deleting a character.
        e.preventDefault();
        const text = `${query.text}${query.text && !query.text.endsWith(" ") ? " " : ""}${draft.scope}`;
        setDraft(null);
        setQuery({ ...query, text });
        requestAnimationFrame(() => inputRef.current?.setSelectionRange(text.length, text.length));
        return;
      }
      if (!draft && query.tokens.length) {
        // Backspacing into a finished token reopens it for editing, value and all.
        e.preventDefault();
        const last = query.tokens[query.tokens.length - 1];
        setQuery({ tokens: query.tokens.slice(0, -1), text: query.text });
        setDraft({ scope: last.scope, query: last.label });
        setDismissed(false);
        setAnnounce(`Editing ${scopeOf(last.scope)?.label ?? last.scope}: ${last.label}`);
        return;
      }
    }
    // Space after an exact value finishes the scope. Handled here because the list would otherwise
    // take the space while one of its items is highlighted.
    if (e.key === " " && draft && draftScope && atEnd(el)) {
      const q = draft.query.trim();
      const source = typeof draftScope.values === "function" ? draftScope.values(q) : draftScope.values;
      const exact = q && source.find((o) => fold(o.label) === fold(q) || fold(o.value) === fold(q));
      if (exact || (draftScope.freeform && q && !q.includes(" "))) {
        e.preventDefault();
        return commit(exact ? { scope: draftScope.key, value: exact.value, label: exact.label } : { scope: draftScope.key, value: q, label: q });
      }
    }
    // Tab completes a half-typed key ("fr" → from:) without taking a hand to the arrows.
    if (e.key === "Tab" && !e.shiftKey && !draft && tail && items[0]?.kind === "scope") {
      e.preventDefault();
      return pick(items[0]);
    }
    if (e.key === "Enter" && !highlighted) {
      e.preventDefault();
      // Mid-scope, Enter takes the best suggestion rather than searching with half a query.
      if (draft && items.length) return pick(items[0]);
      if (draftScope?.freeform && draft!.query.trim()) return commit({ scope: draftScope.key, value: draft!.query.trim(), label: draft!.query.trim() });
      onSubmit?.(query);
      setDismissed(true);
    }
    if (e.key === "Escape" && draft && !open) setDraft(null);
  };

  const removeToken = (index: number) => {
    const token = query.tokens[index];
    setQuery({ ...query, tokens: query.tokens.filter((_, i) => i !== index) });
    setAnnounce(`Removed ${scopeOf(token.scope)?.label ?? token.scope}: ${token.label}`);
    inputRef.current?.focus();
  };

  const editToken = (index: number) => {
    const token = query.tokens[index];
    setQuery({ ...query, tokens: query.tokens.filter((_, i) => i !== index) });
    setDraft({ scope: token.scope, query: token.label });
    setDismissed(false);
    inputRef.current?.focus();
  };

  const clearAll = () => {
    setQuery(EMPTY);
    setDraft(null);
    setAnnounce("Search cleared");
    inputRef.current?.focus();
  };

  const chip = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, filter: "blur(2px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.9, filter: "blur(2px)", transition: { duration: 0.12, ease: ease.out } },
    transition: reduce ? { duration: 0.12 } : { ...spring.pop, filter: { duration: 0.18, ease: ease.out } }, // blur on a tween: a spring can overshoot below zero
  };
  const empty = !query.tokens.length && !draft && !query.text;

  return (
    <Autocomplete.Root
      items={items}
      filteredItems={items}
      filter={null}
      value={input}
      onValueChange={(next, details) => {
        // Picking a suggestion is handled by the item itself; don't let it overwrite the text.
        if (details.reason === "item-press") return;
        onInput(next);
      }}
      open={open}
      onOpenChange={(next, details) => {
        if (!next && (details.reason === "escape-key" || details.reason === "outside-press")) setDismissed(true);
        if (next) setDismissed(false);
      }}
      // Only mid-scope does Enter take a suggestion; with free text it always searches, even for "h".
      autoHighlight={!!draft}
      onItemHighlighted={(item) => setHighlighted(!!item)}
      itemToStringValue={(item: Item) => (item.kind === "scope" ? `${item.scope.key}:` : item.kind === "value" ? item.option.label : item.text)}
    >
      <Autocomplete.InputGroup
        ref={fieldRef}
        onPointerDown={(e) => {
          // Clicking the field's padding or gaps puts the caret in the input, as in a native field.
          if (!(e.target as HTMLElement).closest("button, input")) {
            e.preventDefault();
            inputRef.current?.focus();
          }
        }}
        className={cn(
          "group/field relative flex min-h-9 w-full min-w-0 cursor-text items-start gap-1 rounded-lg border border-line-2 bg-raised py-1 pr-1.5 pl-2.5 text-fg shadow-[var(--shadow)]",
          "transition-[border-color,box-shadow] duration-150 ease-out hover:border-fg-4 focus-within:border-fg-4 focus-within:ring-3 focus-within:ring-fg/10",
          className,
        )}
      >
        <Search size={16} className="pointer-events-none mt-1.5 mr-1 shrink-0 text-fg-3 transition-colors group-focus-within/field:text-fg-2" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <ul aria-label="Search scopes" className="contents">
            <AnimatePresence initial={false} mode="popLayout">
              {query.tokens.map((t, i) => (
                <motion.li key={`t${i}`} layout={reduce ? false : "position"} {...chip} className="flex min-w-0">
                  <Token
                    scope={scopeOf(t.scope)}
                    keyText={t.scope}
                    label={t.label}
                    onEdit={() => editToken(i)}
                    onRemove={() => removeToken(i)}
                  />
                </motion.li>
              ))}
              {draft && query.text.trim() && (
                // Words typed before the scope wait beside it until the value is picked, then return to the input.
                <motion.li key="free" layout={reduce ? false : "position"} {...chip} className="flex min-w-0">
                  <span className="truncate px-0.5 text-[13px] text-fg">{query.text.trim()}</span>
                </motion.li>
              )}
              {draft && (
                // The draft takes the key its token will have, so committing grows this chip in place.
                <motion.li key={`t${query.tokens.length}`} layout={reduce ? false : "position"} {...chip} className="flex">
                  <span className="flex h-6 items-center gap-1 rounded-md bg-line px-1.5 font-mono text-[12px] text-fg-2">
                    {draft.scope}:
                  </span>
                </motion.li>
              )}
            </AnimatePresence>
          </ul>
          <motion.div layout={!reduce ? "position" : false} transition={spring.snappy} className="flex min-w-[7rem] flex-1">
            <Autocomplete.Input
              ref={inputRef}
              aria-label={ariaLabel}
              aria-describedby={hintId}
              placeholder={draftScope ? `Type ${draftScope.placeholder ?? "a value"}…` : empty ? placeholder : ""}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={onKeyDown}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              className="h-7 w-full min-w-0 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]"
            />
          </motion.div>
        </div>
        <AnimatePresence initial={false}>
          {!empty && (
            <motion.button
              type="button"
              aria-label="Clear search"
              onClick={clearAll}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, transition: { duration: 0.1 } }}
              transition={spring.pop}
              className={cn(
                "relative grid size-6 shrink-0 place-items-center self-start rounded-md text-fg-3 hover:bg-hover hover:text-fg",
                "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                "mt-0.5 transition-colors active:scale-[0.9] after:absolute after:-inset-2.5",
              )}
            >
              <X size={14} />
            </motion.button>
          )}
        </AnimatePresence>
      </Autocomplete.InputGroup>
      <span id={hintId} className="sr-only">
        Type a scope such as {scopes.map((s) => `${s.key}:`).join(", ")} to narrow the search. Backspace edits the last scope.
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>

      <Autocomplete.Portal container={container}>
        <Autocomplete.Positioner anchor={fieldRef} align="start" sideOffset={6} collisionPadding={8} className="z-(--z-popover) outline-none">
          <Autocomplete.Popup
            className={cn(
              "flex w-(--anchor-width) max-w-(--available-width) min-w-64 origin-(--transform-origin) flex-col overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
              "transition-[opacity,scale] duration-160 ease-out-expo data-ending-style:duration-100 data-ending-style:ease-out",
              "data-starting-style:scale-[0.97] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0",
              "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
            )}
          >
            <div className="flex h-8 shrink-0 items-center px-3 font-mono text-2xs tracking-[0.08em] text-fg-4 uppercase">
              {draftScope ? draftScope.label : "Narrow your search"}
            </div>
            <Autocomplete.Empty className="empty:hidden">
              {draftScope && (
                <p className="truncate px-3 pb-3 text-[12.5px] text-fg-3">
                  {draft!.query.trim() ? (
                    <>
                      Nothing matches <span className="text-fg-2">“{draft!.query.trim()}”</span>
                    </>
                  ) : (
                    <>Type {draftScope.placeholder ?? "a value"}</>
                  )}
                </p>
              )}
            </Autocomplete.Empty>
            <Autocomplete.List className="max-h-[min(var(--available-height),17rem)] scroll-py-1 overflow-y-auto overscroll-contain px-1 pb-1 outline-none empty:hidden">
              {(item: Item) => (
                <Autocomplete.Item key={itemKey(item)} value={item} onClick={() => pick(item)} className={itemClass}>
                  {item.kind === "scope" ? (
                    <>
                      <span className="flex w-4 shrink-0 justify-center text-fg-3 [&_svg]:size-3.5">{item.scope.icon}</span>
                      <span className="shrink-0 font-mono text-[12px] text-fg">{item.scope.key}:</span>
                      <span className="min-w-0 flex-1 truncate text-fg-2">{item.scope.label}</span>
                      {item.scope.description && <span className="hidden min-w-0 truncate text-[12px] text-fg-4 sm:block">{item.scope.description}</span>}
                    </>
                  ) : item.kind === "value" ? (
                    <>
                      {item.option.icon && <span className="flex w-4 shrink-0 justify-center text-fg-3 [&_svg]:size-3.5">{item.option.icon}</span>}
                      <HighlightMatch text={item.option.label} query={draft?.query ?? ""} className="min-w-0 truncate text-fg" />
                      {item.option.description && <span className="min-w-0 flex-1 truncate text-[12px] text-fg-3">{item.option.description}</span>}
                    </>
                  ) : (
                    <>
                      <CornerDownLeft size={14} className="shrink-0 text-fg-3" />
                      <span className="min-w-0 truncate text-fg-2">
                        Use <span className="text-fg">“{item.text}”</span>
                      </span>
                    </>
                  )}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
            <div className="flex h-8 shrink-0 items-center gap-3 border-t border-line px-3 text-[11.5px] text-fg-4">
              <span><Key>↑↓</Key> move</span>
              <span><Key>↵</Key> pick</span>
              {!draft && tail && items[0]?.kind === "scope" && (
                <span>
                  <Key>⇥</Key> complete
                </span>
              )}
              {(draft || query.tokens.length > 0) && (
                <span>
                  <Key>⌫</Key> {draft ? "back" : "edit last"}
                </span>
              )}
            </div>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}

const atEnd = (el: HTMLInputElement) => el.selectionStart === el.value.length && el.selectionEnd === el.value.length;

const itemKey = (item: Item) => (item.kind === "scope" ? `s:${item.scope.key}` : item.kind === "value" ? `v:${item.option.value}` : `f:${item.text}`);

const itemClass = cn(
  "group/item relative flex h-8 cursor-default scroll-my-1 items-center gap-2.5 rounded-lg px-2 text-[13px] outline-none select-none pointer-coarse:h-10",
  "transition-[background-color] duration-75 data-highlighted:bg-line data-disabled:text-fg-4",
);

function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="mr-1 rounded border border-line-2 px-1 font-mono text-[10.5px] text-fg-3">{children}</kbd>;
}

type TokenProps = { scope?: SearchScope; keyText: string; label: string; onEdit: () => void; onRemove: () => void };

function Token({ scope, keyText, label, onEdit, onRemove }: TokenProps) {
  return (
    <span className="group/token flex h-6 max-w-[16rem] min-w-0 items-center rounded-md bg-line text-[12.5px] transition-colors hover:bg-line-2">
      <button
        type="button"
        tabIndex={-1}
        onClick={onEdit}
        title={`Edit ${scope?.label ?? keyText}`}
        className="flex h-full min-w-0 items-center gap-1 pr-1 pl-1.5 outline-none"
      >
        <span className="shrink-0 font-mono text-[12px] text-fg-3">{keyText}:</span>
        <span className="min-w-0 truncate text-fg">{label}</span>
      </button>
      <button
        type="button"
        tabIndex={-1}
        aria-label={`Remove ${scope?.label ?? keyText}: ${label}`}
        onClick={onRemove}
        className="relative mr-0.5 grid size-5 shrink-0 place-items-center rounded text-fg-3 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.85] pointer-coarse:after:absolute pointer-coarse:after:-inset-2"
      >
        <X size={12} />
      </button>
    </span>
  );
}
