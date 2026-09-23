"use client";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ChevronRight } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type TreeNode = {
  id: string;
  label: string;
  /** Replaces the default folder or file glyph. */
  icon?: React.ReactNode;
  /** Child nodes. An empty array is an empty folder. */
  children?: TreeNode[];
  /** A folder whose children come from loadChildren the first time it opens. */
  hasChildren?: boolean;
  disabled?: boolean;
  /** Quiet right-aligned detail: a size, a count, a status. */
  meta?: React.ReactNode;
};

export type TreeViewProps = Omit<React.ComponentProps<"div">, "children" | "onSelect"> & {
  items: TreeNode[];
  expanded?: string[];
  defaultExpanded?: string[];
  onExpandedChange?: (ids: string[]) => void;
  selected?: string[];
  defaultSelected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  selectionMode?: "single" | "multiple" | "none";
  /** Arrow keys move the selection along with focus, the way file explorers do. Single mode only. */
  selectionFollowsFocus?: boolean;
  /** Clicking a folder's row also opens or closes it. The chevron always does. */
  expandOnClick?: boolean;
  /** Enter or double-click on a leaf. */
  onAction?: (node: TreeNode) => void;
  /** Fetches the children of a node marked hasChildren, the first time it opens. */
  loadChildren?: (node: TreeNode) => Promise<TreeNode[]>;
  /** Vertical lines under each open folder. The branch holding the selection draws brighter. */
  indentGuides?: boolean;
};

type Row =
  | { kind: "node"; node: TreeNode; level: number; parent: string | null; ancestors: string[]; pos: number; size: number; branch: boolean; open: boolean }
  | { kind: "status"; status: "loading" | "error" | "empty"; parent: TreeNode; level: number; ancestors: string[] };

const ROW = 28;
const INDENT = 16;

export function TreeView({
  items,
  expanded: expandedProp,
  defaultExpanded = [],
  onExpandedChange,
  selected: selectedProp,
  defaultSelected = [],
  onSelectedChange,
  selectionMode = "single",
  selectionFollowsFocus = false,
  expandOnClick = true,
  onAction,
  loadChildren,
  indentGuides = true,
  className,
  onKeyDown,
  ...rest
}: TreeViewProps) {
  const reduce = !!useReducedMotion();
  const [expanded, setExpanded] = useControllableState({ value: expandedProp, defaultValue: defaultExpanded, onChange: onExpandedChange });
  const [selected, setSelected] = useControllableState({ value: selectedProp, defaultValue: defaultSelected, onChange: onSelectedChange });
  const [loaded, setLoaded] = useState<Record<string, TreeNode[] | "loading" | "error">>({});
  const [focusId, setFocusId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<string | null>(null);
  // Changes made from the keyboard render on the same frame; pointer changes animate.
  const [instant, setInstant] = useState(false);
  const [announce, setAnnounce] = useState("");
  const rowEls = useRef(new Map<string, HTMLDivElement>());
  const moveFocus = useRef(false);
  const typed = useRef({ text: "", at: 0 });
  const treeRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const openSet = useMemo(() => new Set(expanded), [expanded]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const childrenOf = useCallback(
    (node: TreeNode): TreeNode[] | "loading" | "error" | undefined => {
      if (node.children) return node.children;
      if (!node.hasChildren) return undefined;
      return loaded[node.id] ?? "loading";
    },
    [loaded],
  );

  // The tree, flattened to the rows you can see. One flat list keeps the keyboard model,
  // the hover highlight and the height animation simple, and is how large trees virtualise.
  const rows = useMemo(() => {
    const out: Row[] = [];
    const walk = (nodes: TreeNode[], level: number, parent: string | null, ancestors: string[]) => {
      nodes.forEach((node, i) => {
        const kids = childrenOf(node);
        const branch = kids !== undefined;
        const open = branch && openSet.has(node.id);
        out.push({ kind: "node", node, level, parent, ancestors, pos: i + 1, size: nodes.length, branch, open });
        if (!open) return;
        const next = [...ancestors, node.id];
        if (kids === "loading" || kids === "error") out.push({ kind: "status", status: kids, parent: node, level: level + 1, ancestors: next });
        else if (kids!.length === 0) out.push({ kind: "status", status: "empty", parent: node, level: level + 1, ancestors: next });
        else walk(kids!, level + 1, node.id, next);
      });
    };
    walk(items, 1, null, []);
    return out;
  }, [items, openSet, childrenOf]);

  const nodeRows = rows.filter((r): r is Extract<Row, { kind: "node" }> => r.kind === "node");
  const byId = new Map(nodeRows.map((r) => [r.node.id, r]));

  // If the focused row was folded away, focus falls back to its nearest visible ancestor.
  let current = focusId && byId.has(focusId) ? focusId : null;
  if (focusId && !current) {
    const lost = findPath(items, focusId, childrenOf);
    current = lost?.reverse().find((a) => byId.has(a)) ?? null;
  }
  const tabStop = current ?? selected.find((s) => byId.has(s)) ?? nodeRows[0]?.node.id ?? null;

  // The branch holding the selection (or focus) lights its guides.
  const litTarget = byId.get(selected[0] ?? "") ?? byId.get(current ?? "");
  const lit = new Set(litTarget?.ancestors ?? []);

  useEffect(() => {
    if (!moveFocus.current || !tabStop) return;
    moveFocus.current = false;
    rowEls.current.get(tabStop)?.focus();
  }, [tabStop]);

  /* ---------------------------------------------------------------- actions */

  const load = useCallback(
    (node: TreeNode) => {
      if (!loadChildren || node.children || !node.hasChildren) return;
      const state = loaded[node.id];
      if (state && state !== "error") return;
      setLoaded((l) => ({ ...l, [node.id]: "loading" }));
      setAnnounce(`Loading ${node.label}`);
      loadChildren(node).then(
        (kids) => {
          setLoaded((l) => ({ ...l, [node.id]: kids }));
          setAnnounce(kids.length ? `${node.label}, ${kids.length} ${kids.length === 1 ? "item" : "items"}` : `${node.label} is empty`);
        },
        () => {
          setLoaded((l) => ({ ...l, [node.id]: "error" }));
          setAnnounce(`Couldn't load ${node.label}. Press Right arrow to try again.`);
        },
      );
    },
    [loadChildren, loaded],
  );

  const setOpen = (node: TreeNode, open: boolean) => {
    if (open) load(node);
    if (open === openSet.has(node.id)) return;
    setExpanded(open ? [...expanded, node.id] : expanded.filter((e) => e !== node.id));
  };

  const select = (nodeId: string, mode: "replace" | "toggle" | "range") => {
    if (selectionMode === "none") return;
    const node = byId.get(nodeId)?.node;
    if (!node || node.disabled) return;
    if (selectionMode === "single" || mode === "replace") {
      setSelected([nodeId]);
      setAnchor(nodeId);
    } else if (mode === "toggle") {
      setSelected(selectedSet.has(nodeId) ? selected.filter((s) => s !== nodeId) : [...selected, nodeId]);
      setAnchor(nodeId);
    } else {
      const from = nodeRows.findIndex((r) => r.node.id === (anchor ?? nodeId));
      const to = nodeRows.findIndex((r) => r.node.id === nodeId);
      const [a, b] = from < to ? [from, to] : [to, from];
      setSelected(nodeRows.slice(a, b + 1).filter((r) => !r.node.disabled).map((r) => r.node.id));
    }
  };

  const focusRow = (nodeId: string | undefined, fromKeyboard: boolean) => {
    if (!nodeId) return;
    moveFocus.current = true;
    setFocusId(nodeId);
    if (fromKeyboard && nodeId === tabStop) rowEls.current.get(nodeId)?.focus();
  };

  /* ---------------------------------------------------------------- keyboard (APG tree view) */

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || !tabStop) return;
    const row = byId.get(tabStop);
    if (!row) return;
    const index = nodeRows.indexOf(row);
    const { node } = row;
    const multi = selectionMode === "multiple";
    setInstant(true);

    const go = (target: (typeof nodeRows)[number] | undefined) => {
      if (!target) return;
      focusRow(target.node.id, true);
      if (multi && e.shiftKey) select(target.node.id, "range");
      else if (selectionMode === "single" && selectionFollowsFocus) select(target.node.id, "replace");
    };

    switch (e.key) {
      case "ArrowDown":
        go(nodeRows[index + 1]);
        break;
      case "ArrowUp":
        go(nodeRows[index - 1]);
        break;
      case "Home":
        go(nodeRows[0]);
        break;
      case "End":
        go(nodeRows[nodeRows.length - 1]);
        break;
      case "ArrowRight":
        if (!row.branch) return;
        if (!row.open || loaded[node.id] === "error") setOpen(node, true);
        else go(nodeRows[index + 1]?.parent === node.id ? nodeRows[index + 1] : undefined);
        break;
      case "ArrowLeft":
        if (row.branch && row.open) setOpen(node, false);
        else go(row.parent ? byId.get(row.parent) : undefined);
        break;
      case "Enter":
        if (row.branch) setOpen(node, !row.open);
        else if (!node.disabled) {
          select(node.id, "replace");
          onAction?.(node);
        }
        break;
      case " ":
        select(node.id, multi ? "toggle" : "replace");
        break;
      case "*": {
        // Opens every sibling folder at this level, per the tree pattern.
        const siblings = nodeRows.filter((r) => r.parent === row.parent && r.branch && !r.open);
        siblings.forEach((s) => load(s.node));
        setExpanded([...expanded, ...siblings.map((s) => s.node.id)]);
        break;
      }
      case "a":
        if (!(multi && (e.metaKey || e.ctrlKey))) return typeahead(e);
        setSelected(nodeRows.filter((r) => !r.node.disabled).map((r) => r.node.id));
        break;
      default:
        return typeahead(e);
    }
    e.preventDefault();
  };

  // Typing jumps to the next visible row whose label starts with what you typed.
  const typeahead = (e: React.KeyboardEvent) => {
    if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return;
    const now = e.timeStamp;
    const t = typed.current;
    t.text = now - t.at > 500 ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
    t.at = now;
    const start = nodeRows.findIndex((r) => r.node.id === tabStop);
    // A repeated single letter cycles through matches; a longer string refines the current one.
    const repeated = t.text.length > 1 && [...t.text].every((c) => c === t.text[0]);
    const needle = repeated ? t.text[0] : t.text;
    const from = needle.length === 1 ? start + 1 : start;
    for (let i = 0; i < nodeRows.length; i++) {
      const r = nodeRows[(from + i) % nodeRows.length];
      if (r.node.label.toLowerCase().startsWith(needle)) {
        focusRow(r.node.id, true);
        if (selectionMode === "single" && selectionFollowsFocus) select(r.node.id, "replace");
        break;
      }
    }
    e.preventDefault();
  };

  /* ---------------------------------------------------------------- render */

  const { onMove, onLeave, glide } = useGlide(treeRef, reduce);
  const enter = { duration: instant ? 0 : reduce ? 0.12 : 0.2, ease: ease.out };

  return (
    <div
      ref={treeRef}
      role="tree"
      aria-multiselectable={selectionMode === "multiple" || undefined}
      onKeyDown={handleKey}
      onPointerDown={() => setInstant(false)}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={cn("relative isolate overflow-y-auto overscroll-contain p-1 text-[13px] outline-none select-none", className)}
      {...rest}
    >
      <motion.div aria-hidden style={glide} className="pointer-events-none absolute inset-x-1 top-0 -z-10 rounded-md bg-fg/[0.04]" />
      <AnimatePresence initial={false}>
        {rows.map((row) => {
          const key = row.kind === "node" ? row.node.id : `${row.parent.id}:${row.status}`;
          return (
            <motion.div
              key={key}
              // Rows open by height, so everything below slides down instead of jumping.
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: ROW, opacity: 1 }}
              exit={{ height: 0, opacity: 0, transition: { ...enter, duration: instant ? 0 : reduce ? 0.1 : 0.15 } }}
              transition={reduce ? { height: { duration: 0 }, opacity: enter } : enter}
              className="overflow-hidden"
              role="none"
            >
              {row.kind === "node" ? (
                <TreeRow
                  row={row}
                  selected={selectedSet.has(row.node.id)}
                  tabbable={row.node.id === tabStop}
                  lit={lit}
                  guides={indentGuides}
                  instant={instant}
                  failed={loaded[row.node.id] === "error"}
                  busy={row.open && childrenOf(row.node) === "loading"}
                  ref={(el) => {
                    if (el) rowEls.current.set(row.node.id, el);
                    else rowEls.current.delete(row.node.id);
                  }}
                  onFocus={() => setFocusId(row.node.id)}
                  onToggle={() => setOpen(row.node, !row.open)}
                  onPress={(e) => {
                    setFocusId(row.node.id);
                    if (row.node.disabled) return;
                    if (selectionMode === "multiple" && (e.metaKey || e.ctrlKey)) select(row.node.id, "toggle");
                    else if (selectionMode === "multiple" && e.shiftKey) select(row.node.id, "range");
                    else select(row.node.id, "replace");
                    if (row.branch && expandOnClick && !e.shiftKey && !e.metaKey && !e.ctrlKey) setOpen(row.node, !row.open);
                  }}
                  onDoubleClick={() => !row.branch && !row.node.disabled && onAction?.(row.node)}
                />
              ) : (
                <StatusRow row={row} lit={lit} guides={indentGuides} onRetry={() => load(row.parent)} />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
      {rows.length === 0 && <p className="px-2 py-1.5 text-[12.5px] text-fg-3">No files</p>}
      <span id={`${id}-status`} role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Rows
 * -----------------------------------------------------------------------------------------------*/

type NodeRow = Extract<Row, { kind: "node" }>;

function TreeRow({
  row,
  selected,
  tabbable,
  lit,
  guides,
  instant,
  failed,
  busy,
  ref,
  onFocus,
  onToggle,
  onPress,
  onDoubleClick,
}: {
  row: NodeRow;
  selected: boolean;
  tabbable: boolean;
  lit: Set<string>;
  guides: boolean;
  instant: boolean;
  failed: boolean;
  busy: boolean;
  ref: React.Ref<HTMLDivElement>;
  onFocus: () => void;
  onToggle: () => void;
  onPress: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}) {
  const { node, level, branch, open } = row;
  return (
    <div
      ref={ref}
      role="treeitem"
      aria-level={level}
      aria-posinset={row.pos}
      aria-setsize={row.size}
      aria-expanded={branch ? open : undefined}
      aria-selected={selected}
      aria-disabled={node.disabled || undefined}
      aria-busy={busy || undefined}
      tabIndex={tabbable ? 0 : -1}
      data-row
      data-selected={selected || undefined}
      onFocus={onFocus}
      onClick={onPress}
      onDoubleClick={onDoubleClick}
      style={{ paddingLeft: 6 + (level - 1) * INDENT }}
      className={cn(
        "group/row relative flex h-7 cursor-default items-center gap-1.5 rounded-md pr-2 text-fg-2 outline-none",
        "transition-[background-color,color] duration-100",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
        selected && "bg-fg/[0.08] text-fg",
        node.disabled && "text-fg-4",
      )}
    >
      {guides && <Guides row={row} lit={lit} />}
      <span
        aria-hidden
        onClick={(e) => {
          if (!branch) return;
          e.stopPropagation();
          onToggle();
        }}
        className={cn("relative grid size-4 shrink-0 place-items-center text-fg-4", branch && "hover:text-fg-2 pointer-coarse:after:absolute pointer-coarse:after:-inset-2.5")}
      >
        {branch &&
          (busy ? (
            <Spinner />
          ) : (
            <ChevronRight
              size={14}
              className={cn("transition-transform duration-180 ease-out-expo motion-reduce:transition-none", open && "rotate-90", instant && "duration-0")}
            />
          ))}
      </span>
      <span aria-hidden className={cn("flex shrink-0 [&_svg]:size-4", selected ? "text-fg-2" : "text-fg-3", failed && "text-danger")}>
        {node.icon ?? (branch ? <FolderGlyph open={open} /> : <FileGlyph />)}
      </span>
      <span className="min-w-0 flex-1 truncate">{node.label}</span>
      {failed ? (
        <span className="shrink-0 text-[11.5px] text-danger">Couldn’t load</span>
      ) : (
        node.meta != null && <span className="shrink-0 font-mono text-2xs text-fg-4 tabular">{node.meta}</span>
      )}
    </div>
  );
}

function StatusRow({ row, lit, guides, onRetry }: { row: Extract<Row, { kind: "status" }>; lit: Set<string>; guides: boolean; onRetry: () => void }) {
  return (
    <div
      aria-hidden
      onClick={row.status === "error" ? onRetry : undefined}
      style={{ paddingLeft: 6 + (row.level - 1) * INDENT + 22 }}
      className={cn("relative flex h-7 items-center gap-1.5 pr-2 text-[12.5px] text-fg-4", row.status === "error" && "cursor-pointer text-fg-3 hover:text-fg")}
    >
      {guides && <Guides row={row} lit={lit} />}
      {row.status === "loading" && <span className="h-2 w-24 animate-pulse-soft rounded-full bg-hover motion-reduce:animate-none" />}
      {row.status === "empty" && "Empty folder"}
      {row.status === "error" && (
        <>
          Couldn’t load <span className="text-fg underline decoration-fg-4 underline-offset-2">Try again</span>
        </>
      )}
    </div>
  );
}

// One hairline per ancestor level, centered under that ancestor's chevron.
function Guides({ row, lit }: { row: { level: number; ancestors: string[] }; lit: Set<string> }) {
  return (
    <>
      {row.ancestors.map((a, i) => (
        <span
          key={a}
          aria-hidden
          style={{ left: 6 + i * INDENT + 7.5 }}
          className={cn("pointer-events-none absolute inset-y-0 w-px transition-colors duration-200", lit.has(a) ? "bg-fg-4" : "bg-line-2")}
        />
      ))}
    </>
  );
}

/* -------------------------------------------------------------------------------------------------
 * The hover highlight that glides between rows
 * -----------------------------------------------------------------------------------------------*/

function useGlide(treeRef: React.RefObject<HTMLDivElement | null>, reduce: boolean) {
  const y = useMotionValue(0);
  const opacity = useMotionValue(0);
  const shown = useRef(false);

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const row = (e.target as HTMLElement).closest<HTMLElement>("[data-row]");
    if (!row || !treeRef.current?.contains(row) || row.hasAttribute("data-selected")) {
      if (shown.current) animate(opacity, 0, { duration: 0.12 });
      shown.current = false;
      return;
    }
    const top = row.offsetTop;
    if (!shown.current || reduce) {
      y.jump(top);
      animate(opacity, 1, { duration: 0.08 });
    } else animate(y, top, spring.follow);
    shown.current = true;
  };
  const onLeave = () => {
    shown.current = false;
    animate(opacity, 0, { duration: 0.15 });
  };
  useEffect(() => () => opacity.stop(), [opacity]);

  return { onMove, onLeave, glide: { y, opacity, height: ROW } };
}

/* -------------------------------------------------------------------------------------------------
 * Helpers and glyphs
 * -----------------------------------------------------------------------------------------------*/

function findPath(nodes: TreeNode[], target: string, childrenOf: (n: TreeNode) => TreeNode[] | "loading" | "error" | undefined, trail: string[] = []): string[] | null {
  for (const n of nodes) {
    if (n.id === target) return trail;
    const kids = childrenOf(n);
    if (Array.isArray(kids)) {
      const found = findPath(kids, target, childrenOf, [...trail, n.id]);
      if (found) return found;
    }
  }
  return null;
}

function FolderGlyph({ open }: { open: boolean }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" aria-hidden>
      {open ? (
        <path d="M2.5 11.75v-7.5c0-.4.35-.75.75-.75h3l1.5 1.5h4.5c.4 0 .75.35.75.75V7M2.5 11.75 4.2 7.6a1 1 0 0 1 .93-.6h8.37a.5.5 0 0 1 .46.7l-1.6 3.9a1 1 0 0 1-.93.65H3.25a.75.75 0 0 1-.75-.5z" />
      ) : (
        <path d="M2.5 4.25c0-.4.35-.75.75-.75h3l1.5 1.5h5c.4 0 .75.35.75.75v6.5c0 .4-.35.75-.75.75h-9.5a.75.75 0 0 1-.75-.75z" />
      )}
    </svg>
  );
}

function FileGlyph() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" aria-hidden>
      <path d="M4 2.5h5l3.5 3.5v7.5H4zM9 2.5V6h3.5" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" className="animate-spin-slow motion-reduce:animate-none" aria-hidden>
      <path d="M8 2.25a5.75 5.75 0 1 0 5.75 5.75" />
    </svg>
  );
}
