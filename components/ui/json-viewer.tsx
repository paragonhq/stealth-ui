"use client";
import { Tooltip } from "@base-ui/react/tooltip";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useCopy } from "@/components/ui/copy-button";
import { cn } from "@/lib/cn";
import { ChevronDown, ChevronRight, ChevronUp, Copy, Link, Search, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

type Kind = "object" | "array" | "string" | "number" | "boolean" | "null" | "other";

type Node = {
  /** The node's path, which is also its id: `users[0].email`, `headers["content-type"]`. The root is "". */
  id: string;
  key: string | number | null;
  value: unknown;
  kind: Kind;
  depth: number;
  parent: Node | null;
  children: Node[];
};

type Row = { type: "node"; node: Node } | { type: "more"; id: string; parent: Node; shown: number };

const IDENT = /^[A-Za-z_$][\w$]*$/;
const INDENT = 14;

const kindOf = (v: unknown): Kind =>
  v === null
    ? "null"
    : Array.isArray(v)
      ? "array"
      : typeof v === "object"
        ? "object"
        : typeof v === "string" || typeof v === "number" || typeof v === "boolean"
          ? (typeof v as "string" | "number" | "boolean")
          : "other";

/** Formats a child path the way you'd write it in code: `a.b`, `a[0]`, `a["x-y"]`. */
export function childPath(parent: string, key: string | number) {
  if (typeof key === "number") return `${parent}[${key}]`;
  if (IDENT.test(key)) return parent ? `${parent}.${key}` : key;
  return `${parent}[${JSON.stringify(key)}]`;
}

function build(value: unknown, key: string | number | null, parent: Node | null): Node {
  const node: Node = {
    id: key === null ? "" : childPath(parent?.id ?? "", key),
    key,
    value,
    kind: kindOf(value),
    depth: parent ? parent.depth + 1 : -1,
    parent,
    children: [],
  };
  if (node.kind === "array") node.children = (value as unknown[]).map((v, i) => build(v, i, node));
  else if (node.kind === "object") node.children = Object.entries(value as object).map(([k, v]) => build(v, k, node));
  return node;
}

const isBranch = (n: Node) => n.kind === "object" || n.kind === "array";

/** The text a primitive shows, JSON-escaped so a newline reads as \n rather than breaking the row. */
function display(n: Node) {
  if (n.kind === "string") return JSON.stringify(n.value as string).slice(1, -1);
  if (n.kind === "other") return String(n.value);
  return String(n.value);
}

function walk(n: Node, visit: (n: Node) => void) {
  visit(n);
  for (const c of n.children) walk(c, visit);
}

function toDepth(root: Node, depth: number) {
  const out: string[] = [];
  walk(root, (n) => {
    if (isBranch(n) && n.depth < depth - 1 && n.children.length) out.push(n.id);
  });
  return out;
}

function findMatches(root: Node, q: string) {
  const needle = q.trim().toLowerCase();
  const out: string[] = [];
  if (!needle) return out;
  walk(root, (n) => {
    if (n === root) return;
    const inKey = typeof n.key === "string" && n.key.toLowerCase().includes(needle);
    const inValue = !isBranch(n) && display(n).toLowerCase().includes(needle);
    if (inKey || inValue) out.push(n.id);
  });
  return out;
}

const count = (n: Node) =>
  n.kind === "array"
    ? `${n.children.length} ${n.children.length === 1 ? "item" : "items"}`
    : `${n.children.length} ${n.children.length === 1 ? "key" : "keys"}`;

/** A one-line glance at a folded node: its keys, or its first values. */
function preview(n: Node) {
  const parts = n.children.slice(0, 5).map((c) =>
    n.kind === "object" ? String(c.key) : isBranch(c) ? (c.kind === "array" ? "[…]" : "{…}") : c.kind === "string" ? `"${display(c)}"` : display(c),
  );
  const more = n.children.length > 5 ? ", …" : "";
  return n.kind === "array" ? `[${parts.join(", ")}${more}]` : `{ ${parts.join(", ")}${more} }`;
}

function Marked({ text, query, current }: { text: string; query: string; current: boolean }) {
  const q = query.trim().toLowerCase();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const out: React.ReactNode[] = [];
  let at = 0;
  for (let i = lower.indexOf(q); i !== -1; i = lower.indexOf(q, at)) {
    if (i > at) out.push(text.slice(at, i));
    out.push(
      <mark key={i} className={cn("rounded-[2px] text-fg", current ? "bg-fg text-frame" : "bg-fg/15")}>
        {text.slice(i, i + q.length)}
      </mark>,
    );
    at = i + q.length;
  }
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}

export type JsonViewerProps = Omit<React.ComponentProps<"div">, "children" | "onCopy"> & {
  /** Any JSON-serialisable value: an object, array or primitive. */
  data: unknown;
  /** How many levels start open when `defaultExpanded` isn't given. */
  defaultExpandDepth?: number;
  /** Open node paths (controlled), e.g. `["user", "user.roles"]`. */
  expanded?: string[];
  defaultExpanded?: string[];
  onExpandedChange?: (paths: string[]) => void;
  /** Shows the search field. `/` focuses it from the tree. */
  searchable?: boolean;
  /** Names the tree for screen readers. */
  label?: string;
  /** Height before the tree scrolls. */
  maxHeight?: number | string;
  /** Arrays longer than this render in pages, with a row to show the rest. */
  pageSize?: number;
  /** Shows skeleton rows while the value is fetched. */
  loading?: boolean;
  onCopied?: (text: string, what: "path" | "value") => void;
};

export function JsonViewer({
  data,
  defaultExpandDepth = 2,
  expanded: expandedProp,
  defaultExpanded,
  onExpandedChange,
  searchable = true,
  label = "JSON",
  maxHeight = 340,
  pageSize = 100,
  loading = false,
  onCopied,
  className,
  ...rest
}: JsonViewerProps) {
  const reduce = useReducedMotion();
  const uid = useId();
  const tree = useMemo(() => build(data, null, null), [data]);
  const index = useMemo(() => {
    const m = new Map<string, Node>();
    walk(tree, (n) => m.set(n.id, n));
    return m;
  }, [tree]);

  // Controlled or uncontrolled open paths, kept as an array so the prop can be plain data.
  const [inner, setInner] = useState<string[]>(() => defaultExpanded ?? toDepth(tree, defaultExpandDepth));
  const openList = expandedProp ?? inner;
  const open = useMemo(() => new Set(openList), [openList]);
  const setOpen = (next: Set<string>) => {
    const list = [...next];
    if (expandedProp === undefined) setInner(list);
    onExpandedChange?.(list);
  };

  const [active, setActive] = useState<string | null>(null);
  const [wrapped, setWrapped] = useState<Set<string>>(() => new Set());
  const [limits, setLimits] = useState<Record<string, number>>({});
  // Toggles from the keyboard land on the same frame; from the pointer they unfold.
  const [instant, setInstant] = useState(false);
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState(0);
  const matches = useMemo(() => findMatches(tree, query), [tree, query]);
  const matchSet = useMemo(() => new Set(matches), [matches]);
  const currentId = matches.length ? matches[Math.min(current, matches.length - 1)] : null;

  const treeRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [tip] = useState(() => Tooltip.createHandle<string>());

  const { state: copyState, copy } = useCopy({ timeout: 1400 });
  const [copied, setCopied] = useState<{ id: string; what: "path" | "value"; text: string } | null>(null);
  const doCopy = (n: Node, what: "path" | "value") => {
    const text = what === "path" ? n.id : n.kind === "string" ? (n.value as string) : (JSON.stringify(n.value, null, 2) ?? String(n.value));
    setCopied({ id: n.id, what, text: n.id || "root" });
    copy(text);
    onCopied?.(text, what);
  };

  // The flat, visible order of rows: what arrow keys walk through.
  const rows = useMemo(() => {
    const out: Row[] = [];
    const visit = (n: Node) => {
      const limit = limits[n.id] ?? pageSize;
      for (const c of n.children.slice(0, limit)) {
        out.push({ type: "node", node: c });
        if (isBranch(c) && open.has(c.id)) visit(c);
      }
      if (n.children.length > limit) out.push({ type: "more", id: `${n.id}#more`, parent: n, shown: limit });
    };
    if (isBranch(tree)) visit(tree);
    else out.push({ type: "node", node: tree });
    return out;
  }, [tree, open, limits, pageSize]);

  const rowId = (id: string) => `${uid}-${id}`;
  const activeRow = rows.find((r) => (r.type === "node" ? r.node.id : r.id) === active);
  const activeNode = activeRow?.type === "node" ? activeRow.node : null;

  // Keep the active row in view as the keyboard or a search moves it.
  useEffect(() => {
    if (active === null) return;
    const el = treeRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(active)}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const toggle = (n: Node, kb: boolean) => {
    setInstant(kb);
    const next = new Set(open);
    if (next.has(n.id)) next.delete(n.id);
    else next.add(n.id);
    setOpen(next);
  };

  const runSearch = (q: string) => {
    setQuery(q);
    setCurrent(0);
    const found = findMatches(tree, q);
    if (!found.length) return;
    // Unfold every match's ancestors so each one is on screen.
    const next = new Set(open);
    for (const id of found) for (let p = index.get(id)?.parent; p && p !== tree; p = p.parent) next.add(p.id);
    setInstant(true);
    if (next.size !== open.size) setOpen(next);
    setActive(found[0]);
  };

  const step = (by: number) => {
    if (!matches.length) return;
    const i = (Math.min(current, matches.length - 1) + by + matches.length) % matches.length;
    setCurrent(i);
    setActive(matches[i]);
  };

  const activate = (r: Row, kb: boolean) => {
    if (r.type === "more") {
      setLimits((l) => ({ ...l, [r.parent.id]: r.shown + pageSize }));
      return;
    }
    const n = r.node;
    if (isBranch(n) && n.children.length) return toggle(n, kb);
    // A long value that's cut off unfolds to wrap in place, and folds back.
    const label = treeRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(n.id)}"] [data-label]`);
    const cut = label && label.scrollWidth > label.clientWidth + 1;
    if (cut || wrapped.has(n.id)) {
      const next = new Set(wrapped);
      if (next.has(n.id)) next.delete(n.id);
      else next.add(n.id);
      setWrapped(next);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !rows.length) return;
    const i = Math.max(0, rows.findIndex((r) => (r.type === "node" ? r.node.id : r.id) === active));
    const r = rows[i];
    const idOf = (x: Row) => (x.type === "node" ? x.node.id : x.id);
    const go = (x: Row | undefined) => x && setActive(idOf(x));
    const n = r.type === "node" ? r.node : null;
    const key = e.key;
    if (active === null && ["ArrowDown", "ArrowUp", "j", "k", "Home", "End"].includes(key)) {
      e.preventDefault();
      return go(key === "End" ? rows[rows.length - 1] : rows[0]);
    }
    switch (key) {
      case "ArrowDown":
      case "j":
        e.preventDefault();
        return go(rows[Math.min(rows.length - 1, i + 1)]);
      case "ArrowUp":
      case "k":
        e.preventDefault();
        return go(rows[Math.max(0, i - 1)]);
      case "Home":
        e.preventDefault();
        return go(rows[0]);
      case "End":
        e.preventDefault();
        return go(rows[rows.length - 1]);
      case "ArrowRight":
        e.preventDefault();
        if (n && isBranch(n) && n.children.length) {
          if (!open.has(n.id)) return toggle(n, true);
          return go(rows[i + 1]);
        }
        return;
      case "ArrowLeft": {
        e.preventDefault();
        if (n && isBranch(n) && open.has(n.id)) return toggle(n, true);
        const parent = r.type === "more" ? r.parent : n?.parent;
        if (parent && parent !== tree) setActive(parent.id);
        return;
      }
      case "Enter":
      case " ":
        e.preventDefault();
        return activate(r, true);
      case "*": {
        // Open every sibling branch, per the tree pattern.
        e.preventDefault();
        const siblings = (n?.parent ?? tree).children.filter((c) => isBranch(c) && c.children.length);
        setInstant(true);
        setOpen(new Set([...open, ...siblings.map((c) => c.id)]));
        return;
      }
      case "c":
      case "C":
        if (n) {
          e.preventDefault();
          doCopy(n, "value");
        }
        return;
      case "p":
      case "P":
        if (n && n.id) {
          e.preventDefault();
          doCopy(n, "path");
        }
        return;
      case "/":
        if (searchable) {
          e.preventDefault();
          searchRef.current?.focus();
        }
        return;
    }
  };

  const allBranches = useMemo(() => {
    const out: string[] = [];
    walk(tree, (n) => n !== tree && isBranch(n) && n.children.length && out.push(n.id));
    return out;
  }, [tree]);

  // Folding everything moves the cursor to the top-level row that held it.
  const topmost = (id: string | null) => {
    let n = id === null ? undefined : index.get(id.replace(/#more$/, ""));
    while (n?.parent && n.parent !== tree) n = n.parent;
    return n ? n.id : id;
  };

  const fold = { duration: instant || reduce ? 0 : 0.22, ease: ease.inOut };
  // The scope line: the guide under the active branch (or the active row's parent) lights up.
  const scope = activeNode ? (isBranch(activeNode) && open.has(activeNode.id) ? activeNode.id : activeNode.parent?.id ?? null) : null;

  const renderRow = (n: Node, pos: number, size: number): React.ReactNode => {
    const branch = isBranch(n) && n.children.length > 0;
    const isOpen = branch && open.has(n.id);
    const isActive = active === n.id;
    const limit = limits[n.id] ?? pageSize;
    const labelId = `${rowId(n.id)}-label`;
    const ancestors: string[] = [];
    for (let p = n.parent; p && p !== tree; p = p.parent) ancestors.unshift(p.id);
    const wrap = wrapped.has(n.id);
    const matched = matchSet.has(n.id);
    const isCurrent = currentId === n.id;
    const q = matched ? query : "";

    return (
      <li
        key={n.id}
        id={rowId(n.id)}
        role="treeitem"
        aria-level={n.depth + 1}
        aria-setsize={size}
        aria-posinset={pos}
        aria-expanded={branch ? isOpen : undefined}
        aria-selected={isActive}
        aria-labelledby={labelId}
      >
        <div
          data-row={n.id}
          data-active={isActive || undefined}
          onClick={() => {
            setActive(n.id);
            activate({ type: "node", node: n }, false);
          }}
          className={cn(
            // The row's fill lives in --row so the copy actions can fade into exactly the same colour.
            "group/row relative flex min-h-6 cursor-default items-center pr-1.5 bg-(--row) [--row:var(--raised)]",
            "hover:[--row:color-mix(in_oklab,var(--fg)_4%,var(--raised))] data-active:[--row:color-mix(in_oklab,var(--fg)_7%,var(--raised))]",
            "group-focus-visible/tree:data-active:outline-1 group-focus-visible/tree:data-active:-outline-offset-1 group-focus-visible/tree:data-active:outline-fg-3 group-focus-visible/tree:data-active:outline-solid",
            wrap && "items-start py-0.5",
          )}
          style={{ paddingLeft: 6 + n.depth * INDENT }}
        >
          {ancestors.map((a, d) => (
            <span
              key={a}
              aria-hidden
              className={cn("absolute inset-y-0 w-px transition-colors duration-150", scope === a ? "bg-fg-4" : "bg-line")}
              style={{ left: 6 + d * INDENT + 7.5 }}
            />
          ))}
          <span aria-hidden className={cn("grid size-4 shrink-0 place-items-center text-fg-3", wrap && "mt-px")}>
            {branch && (
              <ChevronRight
                size={12}
                className={cn(
                  "transition-transform ease-out-expo motion-reduce:transition-none",
                  instant ? "duration-0" : "duration-200",
                  isOpen && "rotate-90",
                )}
              />
            )}
          </span>
          <span
            id={labelId}
            data-label
            className={cn("min-w-0 flex-1 pl-1", wrap ? "whitespace-pre-wrap pr-12 leading-5 [overflow-wrap:anywhere]" : "truncate")}
          >
            {n.key !== null && (
              <>
                <span className={typeof n.key === "number" ? "tabular text-fg-3" : "text-fg-2"}>
                  <Marked text={String(n.key)} query={typeof n.key === "string" ? q : ""} current={isCurrent} />
                </span>
                <span className="text-fg-4">: </span>
              </>
            )}
            <Value n={n} open={isOpen} query={q} current={isCurrent} />
            {branch && <span className={cn("tabular text-fg-4", !isOpen && "ml-2")}>{count(n)}</span>}
          </span>
          <span
            aria-hidden
            className={cn(
              // Overlaid, not reserved: long values keep the full width until the row is pointed at.
              "absolute flex items-center gap-0.5 pl-5 pr-[5px] opacity-0 pointer-events-none",
              "[background:linear-gradient(to_right,transparent,var(--row)_16px)]",
              "group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-data-active/row:pointer-events-auto group-data-active/row:opacity-100",
              wrap ? "top-0.5 right-px" : "inset-y-px right-px",
            )}
          >
            {n.id && (
              <RowAction
                label="Copy path"
                tip={tip}
                state={copied?.id === n.id && copied.what === "path" ? copyState : "idle"}
                onPress={() => doCopy(n, "path")}
                reduce={!!reduce}
              >
                <Link size={13} />
              </RowAction>
            )}
            <RowAction
              label="Copy value"
              tip={tip}
              state={copied?.id === n.id && copied.what === "value" ? copyState : "idle"}
              onPress={() => doCopy(n, "value")}
              reduce={!!reduce}
            >
              <Copy size={13} />
            </RowAction>
          </span>
        </div>
        {branch && (
          <AnimatePresence initial={false}>
            {isOpen && (
              <motion.ul
                role="group"
                className="overflow-hidden"
                initial={{ height: 0, opacity: reduce ? 0 : 0.4 }}
                animate={{ height: "auto", opacity: 1, transition: reduce ? { duration: instant ? 0 : 0.12 } : fold }}
                exit={{ height: 0, opacity: reduce ? 0 : 0.4, transition: reduce ? { duration: instant ? 0 : 0.1 } : { ...fold, duration: fold.duration * 0.7 } }}
              >
                {n.children.slice(0, limit).map((c, i) => renderRow(c, i + 1, n.children.length))}
                {n.children.length > limit && renderMore(n, limit)}
              </motion.ul>
            )}
          </AnimatePresence>
        )}
      </li>
    );
  };

  const renderMore = (parent: Node, shown: number) => {
    const id = `${parent.id}#more`;
    const left = parent.children.length - shown;
    return (
      <li key={id} id={rowId(id)} role="treeitem" aria-level={parent.depth + 2} aria-selected={active === id}>
        <div
          data-row={id}
          data-active={active === id || undefined}
          onClick={() => {
            setActive(id);
            activate({ type: "more", id, parent, shown }, false);
          }}
          className="group/row relative flex h-6 cursor-default items-center text-fg-3 hover:bg-fg/[0.04] hover:text-fg data-active:bg-fg/[0.07] data-active:text-fg group-focus-visible/tree:data-active:outline-1 group-focus-visible/tree:data-active:-outline-offset-1 group-focus-visible/tree:data-active:outline-fg-3 group-focus-visible/tree:data-active:outline-solid"
          style={{ paddingLeft: 6 + (parent.depth + 1) * INDENT + 20 }}
        >
          <span className="tabular">
            Show {Math.min(left, pageSize)} more
            <span className="text-fg-4">
              {" "}· {shown} of {parent.children.length} shown
            </span>
          </span>
        </div>
      </li>
    );
  };

  const top = isBranch(tree) ? tree.children : [tree];
  const topLimit = limits[tree.id] ?? pageSize;
  const empty = isBranch(tree) && tree.children.length === 0;
  const status = copyState === "copied" && copied ? `Copied ${copied.what} of ${copied.text}` : copyState === "failed" ? "Couldn’t copy. Select the text instead." : "";

  return (
    <Tooltip.Provider delay={500}>
      <div
        data-slot="json-viewer"
        data-state={loading ? "loading" : "ready"}
        aria-busy={loading || undefined}
        className={cn("flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-raised text-fg shadow-[var(--shadow)]", className)}
        {...rest}
      >
        {searchable && (
          <div className="flex h-10 items-center gap-1 border-b border-line pl-2.5 pr-1.5">
            <Search size={14} className="shrink-0 text-fg-3" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              disabled={loading}
              onChange={(e) => runSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  step(e.shiftKey ? -1 : 1);
                } else if (e.key === "Escape" && query) {
                  e.preventDefault();
                  runSearch("");
                } else if (e.key === "ArrowDown" && !query) {
                  e.preventDefault();
                  treeRef.current?.focus();
                }
              }}
              placeholder="Search keys and values"
              aria-label={`Search ${label}`}
              aria-controls={`${uid}-tree`}
              enterKeyHint="search"
              spellCheck={false}
              autoComplete="off"
              className="h-full min-w-0 flex-1 bg-transparent pl-1.5 text-base text-fg outline-none placeholder:text-fg-4 sm:text-[12.5px] [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <>
                <span className="tabular shrink-0 px-1 font-mono text-[11px] text-fg-3" aria-live="polite">
                  {matches.length ? `${Math.min(current, matches.length - 1) + 1}/${matches.length}` : "No matches"}
                </span>
                <ToolButton label="Previous match" tip={tip} onPress={() => step(-1)} disabled={!matches.length}>
                  <ChevronUp size={14} />
                </ToolButton>
                <ToolButton label="Next match" tip={tip} onPress={() => step(1)} disabled={!matches.length}>
                  <ChevronDown size={14} />
                </ToolButton>
                <ToolButton label="Clear search" tip={tip} onPress={() => { runSearch(""); searchRef.current?.focus(); }}>
                  <X size={14} />
                </ToolButton>
                <span aria-hidden className="mx-0.5 h-4 w-px bg-line" />
              </>
            )}
            <ToolButton label="Expand all" tip={tip} disabled={loading || !allBranches.length} onPress={() => { setInstant(false); setOpen(new Set(allBranches)); }}>
              <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m5 6 3-3 3 3M5 10l3 3 3-3" />
              </svg>
            </ToolButton>
            <ToolButton label="Collapse all" tip={tip} disabled={loading || !open.size} onPress={() => { setInstant(false); setOpen(new Set()); setActive((a) => topmost(a)); }}>
              <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m5 2.5 3 3 3-3M5 13.5l3-3 3 3" />
              </svg>
            </ToolButton>
          </div>
        )}

        <div className="min-h-0 overflow-auto overscroll-contain py-1" style={{ maxHeight }}>
          {loading ? (
            <div aria-hidden className="flex flex-col py-0.5">
              {[64, 38, 52, 30, 46, 58].map((w, i) => (
                <div key={i} className="flex h-6 items-center gap-2" style={{ paddingLeft: 26 + (i % 3 === 0 ? 0 : INDENT) }}>
                  <span className="h-2.5 animate-pulse-soft rounded-sm bg-hover" style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
          ) : empty ? (
            <p className="flex h-12 items-center px-3 font-mono text-[12px] text-fg-3">
              {tree.kind === "array" ? "[] Empty array" : "{} Empty object"}
            </p>
          ) : (
            <ul
              ref={treeRef}
              id={`${uid}-tree`}
              role="tree"
              aria-label={label}
              aria-activedescendant={active !== null && rows.some((r) => (r.type === "node" ? r.node.id : r.id) === active) ? rowId(active) : undefined}
              aria-describedby={`${uid}-keys`}
              tabIndex={0}
              onKeyDown={onKeyDown}
              onFocus={(e) => {
                // Only a keyboard arrival picks the first row; a click picks its own row.
                if (e.target === e.currentTarget && e.currentTarget.matches(":focus-visible") && active === null && rows[0]) setActive(rows[0].type === "node" ? rows[0].node.id : rows[0].id);
              }}
              className="group/tree font-mono text-[12px] leading-6 outline-none"
            >
              {top.slice(0, topLimit).map((c, i) => renderRow(c, i + 1, top.length))}
              {top.length > topLimit && renderMore(tree, topLimit)}
            </ul>
          )}
        </div>

        <div className="flex h-8 items-center gap-3 border-t border-line px-3 text-[11px]">
          <span className="min-w-0 flex-1 truncate font-mono text-fg-3" title={activeNode?.id || undefined}>
            {activeNode ? (
              <>
                <span className="text-fg-4">$</span>
                {activeNode.id.startsWith("[") ? "" : "."}
                {activeNode.id}
              </>
            ) : (
              <span className="text-fg-4">$</span>
            )}
          </span>
          <span id={`${uid}-keys`} className="hidden shrink-0 items-center gap-2.5 text-fg-4 pointer-fine:sm:flex">
            <span className="sr-only">Arrow keys move and fold. </span>
            <span className="flex items-center gap-1" aria-hidden>
              <Kbd>C</Kbd> value
            </span>
            <span className="sr-only">Press C to copy the value. </span>
            <span className="flex items-center gap-1" aria-hidden>
              <Kbd>P</Kbd> path
            </span>
            <span className="sr-only">Press P to copy the path.</span>
          </span>
        </div>

        <span role="status" aria-live="polite" className="sr-only">
          {status}
        </span>
      </div>

      <Tooltip.Root handle={tip}>
        {({ payload }) => (
          <Tooltip.Portal>
            <Tooltip.Positioner side="top" sideOffset={6} collisionPadding={8} className="z-(--z-tooltip)">
              <Tooltip.Popup
                className={cn(
                  "flex min-h-6 items-center rounded-md border border-line-2 bg-raised px-2 py-1 text-[12px] leading-4 text-fg shadow-pop",
                  "origin-(--transform-origin) transition-[opacity,scale,translate] duration-150 ease-out-expo",
                  "data-starting-style:translate-y-0.5 data-starting-style:scale-96 data-starting-style:opacity-0 data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-100",
                  "data-instant:duration-0",
                )}
              >
                {payload}
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        )}
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function Value({ n, open, query, current }: { n: Node; open: boolean; query: string; current: boolean }) {
  if (n.kind === "object" || n.kind === "array") {
    if (!n.children.length) return <span className="text-fg-3">{n.kind === "array" ? "[]" : "{}"}</span>;
    if (open) return null;
    return <span className="text-fg-3">{preview(n)}</span>;
  }
  const text = display(n);
  if (n.kind === "string")
    return (
      <span className="text-fg">
        <span className="text-fg-4">&quot;</span>
        <Marked text={text} query={query} current={current} />
        <span className="text-fg-4">&quot;</span>
      </span>
    );
  if (n.kind === "null") return <span className="italic text-fg-3"><Marked text={text} query={query} current={current} /></span>;
  if (n.kind === "boolean") return <span className="text-fg-2"><Marked text={text} query={query} current={current} /></span>;
  return (
    <span className={cn("text-fg", n.kind === "number" && "tabular")}>
      <Marked text={text} query={query} current={current} />
    </span>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="grid h-4 min-w-4 place-items-center rounded-[4px] border border-line-2 px-1 font-mono text-[10px] leading-none text-fg-3">
      {children}
    </kbd>
  );
}

type Handle = ReturnType<typeof Tooltip.createHandle<string>>;

function ToolButton({ label, tip, onPress, disabled, children }: { label: string; tip: Handle; onPress: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip.Trigger
      handle={tip}
      payload={label}
      disabled={disabled}
      render={
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          onClick={onPress}
          className={cn(
            "relative grid size-7 shrink-0 place-items-center rounded-md text-fg-3 outline-none",
            "transition-[background-color,color,scale] duration-150 ease-out hover:bg-fg/[0.06] hover:text-fg active:scale-[0.92] active:duration-75",
            "focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 focus-visible:outline-solid",
            "disabled:pointer-events-none disabled:opacity-40",
            "before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden",
          )}
        />
      }
    >
      {children}
    </Tooltip.Trigger>
  );
}

function RowAction({
  label,
  tip,
  state,
  onPress,
  reduce,
  children,
}: {
  label: string;
  tip: Handle;
  state: "idle" | "copied" | "failed";
  onPress: () => void;
  reduce: boolean;
  children: React.ReactNode;
}) {
  const draw = reduce ? {} : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 0.28, ease: ease.out, delay: 0.04 } };
  return (
    <Tooltip.Trigger
      handle={tip}
      payload={state === "copied" ? "Copied" : state === "failed" ? "Couldn’t copy" : label}
      closeOnClick={false}
      render={
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onPress();
          }}
          className={cn(
            "relative grid size-5 place-items-center rounded-[5px] outline-none",
            "transition-[background-color,color,scale] duration-150 ease-out hover:bg-fg/[0.07] hover:text-fg active:scale-90 active:duration-75",
            "before:absolute before:-inset-2.5 before:content-[''] pointer-fine:before:hidden",
            state === "failed" ? "text-danger" : state === "copied" ? "text-fg" : "text-fg-3",
          )}
        />
      }
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={state}
          className="grid place-items-center"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
          transition={reduce ? { duration: 0.12 } : spring.pop}
        >
          {state === "copied" ? (
            <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" {...draw} />
            </svg>
          ) : state === "failed" ? (
            <X size={13} />
          ) : (
            children
          )}
        </motion.span>
      </AnimatePresence>
    </Tooltip.Trigger>
  );
}

