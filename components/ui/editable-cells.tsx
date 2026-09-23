"use client";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

export type EditableColumn<T> = {
  /** The row field this column shows and edits. */
  key: keyof T & string;
  header: React.ReactNode;
  /** Plain words for labels and announcements when header isn't a string. */
  label?: string;
  width?: number | string;
  /** Right-aligned, tabular figures, and a decimal keypad on phones. */
  numeric?: boolean;
  /** Read-only columns can still be focused and copied. Default true. */
  editable?: boolean;
  /** How the value reads in the cell. Defaults to String(value). */
  format?: (value: T[keyof T], row: T) => React.ReactNode;
  /** The text the editor starts from. Defaults to String(value). */
  toInput?: (value: T[keyof T], row: T) => string;
  /** Turns what was typed into the stored value. Defaults to the text itself. */
  parse?: (input: string) => T[keyof T];
  /** Return a message to reject the value; it stays in the editor with the message beside it. */
  validate?: (value: T[keyof T], input: string, row: T) => string | null | undefined;
  /** A cell under the column, e.g. a total. */
  footer?: (rows: T[]) => React.ReactNode;
  placeholder?: string;
};

export type EditableCellsProps<T> = Omit<React.ComponentProps<"div">, "children" | "onChange"> & {
  columns: EditableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Names a row in labels and announcements, e.g. the item name. */
  getRowLabel?: (row: T) => string;
  caption: string;
  /**
   * Persist one cell. Update your rows here. Return a promise to show the new value as saving
   * until it settles; throw or reject with an Error to put the old value back and show why.
   */
  onCellChange: (change: { rowId: string; key: keyof T & string; value: T[keyof T]; row: T }) => void | Promise<unknown>;
  minWidth?: number;
};

type Pos = { r: number; c: number };
type Editing = Pos & { text: string; error?: string; caret: "select" | "end" };

const cellKey = (id: string, key: string) => `${id}\u0000${key}`;

export function EditableCells<T>({
  columns,
  rows,
  getRowId,
  getRowLabel,
  caption,
  onCellChange,
  minWidth,
  className,
  ...rest
}: EditableCellsProps<T>) {
  const [active, setActive] = useState<Pos>({ r: 0, c: 0 });
  // Pointer moves glide the highlight; keyboard moves land on the same frame.
  const [via, setVia] = useState<"pointer" | "keyboard">("keyboard");
  const [editing, setEditing] = useState<Editing | null>(null);
  // A rejected value left behind by clicking away: kept, marked, and picked up again on the next edit.
  const [drafts, setDrafts] = useState<Record<string, { text: string; error: string }>>({});
  const [pending, setPending] = useState<Record<string, T[keyof T]>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, number>>({});
  const [announce, setAnnounce] = useState("");
  const grid = useRef<HTMLTableElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  // Which sides hide more columns, for the edge shadows when the grid scrolls sideways.
  const measure = (el: HTMLDivElement) => {
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  };
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measure(el));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const input = useRef<HTMLInputElement>(null);
  const focusAfter = useRef(false);
  // True only while an editor is open, so the blur that follows Enter, Tab or a click elsewhere can't save twice.
  const live = useRef(false);
  const alive = useRef(true);
  const reduce = useReducedMotion();
  const uid = useId();
  const captionId = `${uid}-caption`;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const clampR = Math.min(active.r, Math.max(0, rows.length - 1));
  const clampC = Math.min(active.c, Math.max(0, columns.length - 1));
  const editable = (c: number) => columns[c]?.editable !== false;
  const nameOf = (c: number) => columns[c].label ?? (typeof columns[c].header === "string" ? (columns[c].header as string) : columns[c].key);
  const rowName = (r: number) => (getRowLabel ? getRowLabel(rows[r]) : `row ${r + 1}`);

  // Focus follows the active cell after keyboard moves and closed editors.
  useEffect(() => {
    if (editing) {
      const el = input.current;
      if (el && document.activeElement !== el) {
        el.focus();
        if (editing.caret === "select") el.select();
        else el.setSelectionRange(el.value.length, el.value.length);
      }
      return;
    }
    if (!focusAfter.current) return;
    focusAfter.current = false;
    grid.current?.querySelector<HTMLElement>(`[data-cell="${clampR}:${clampC}"]`)?.focus({ preventScroll: false });
  }, [editing, clampR, clampC]);

  const startEdit = (p: Pos, how: { text?: string; caret?: "select" | "end" } = {}) => {
    if (!editable(p.c) || !rows[p.r]) return;
    const row = rows[p.r];
    const col = columns[p.c];
    const k = cellKey(getRowId(row), col.key);
    const draft = drafts[k];
    const value = k in pending ? pending[k] : row[col.key];
    const text = how.text ?? draft?.text ?? (col.toInput ? col.toInput(value, row) : String(value ?? ""));
    live.current = true;
    setActive(p);
    setFailed((f) => omit(f, k));
    setEditing({ ...p, text, error: how.text == null ? draft?.error : undefined, caret: how.caret ?? (how.text != null ? "end" : "select") });
  };

  /** Next editable cell in reading order, or null at the end. */
  const step = (p: Pos, dir: 1 | -1): Pos | null => {
    let { r, c } = p;
    for (;;) {
      c += dir;
      if (c >= columns.length) {
        c = 0;
        r++;
      } else if (c < 0) {
        c = columns.length - 1;
        r--;
      }
      if (r < 0 || r >= rows.length) return null;
      if (editable(c)) return { r, c };
    }
  };

  const move = (p: Pos, how: "pointer" | "keyboard" = "keyboard") => {
    setVia(how);
    setActive({ r: Math.max(0, Math.min(rows.length - 1, p.r)), c: Math.max(0, Math.min(columns.length - 1, p.c)) });
    if (how === "keyboard") focusAfter.current = true;
  };

  /** Validates and saves the open editor. Returns false when the value was rejected. */
  const commit = (then?: Pos | null, keepDraftOnError = false): boolean => {
    if (!editing || !live.current) return true;
    const { r, c, text } = editing;
    const row = rows[r];
    const col = columns[c];
    const id = getRowId(row);
    const k = cellKey(id, col.key);
    const value = (col.parse ? col.parse(text) : text) as T[keyof T];
    const error = col.validate?.(value, text, row) ?? undefined;
    if (error) {
      if (keepDraftOnError) {
        live.current = false;
        setDrafts((d) => ({ ...d, [k]: { text, error } }));
        setEditing(null);
      } else {
        setEditing({ ...editing, error, caret: "end" });
        setAnnounce(error);
      }
      return false;
    }
    live.current = false;
    setDrafts((d) => omit(d, k));
    setEditing(null);
    if (then) move(then);
    else if (!keepDraftOnError) focusAfter.current = true;

    const before = col.toInput ? col.toInput(row[col.key], row) : String(row[col.key] ?? "");
    const after = col.toInput ? col.toInput(value, row) : String(value ?? "");
    if (before === after) return true;

    const flash = () => {
      setSaved((s) => ({ ...s, [k]: (s[k] ?? 0) + 1 }));
      setAnnounce(`Saved ${nameOf(c)} for ${rowName(r)}`);
    };
    let result: void | Promise<unknown>;
    try {
      result = onCellChange({ rowId: id, key: col.key, value, row });
    } catch (e) {
      setFailed((f) => ({ ...f, [k]: messageOf(e) }));
      setAnnounce(messageOf(e));
      return true;
    }
    if (result && typeof (result as Promise<unknown>).then === "function") {
      // Optimistic: the new value shows at once, dimmed, until the save settles.
      setPending((p) => ({ ...p, [k]: value }));
      (result as Promise<unknown>)
        .then(() => alive.current && flash())
        .catch((e) => {
          if (!alive.current) return;
          setFailed((f) => ({ ...f, [k]: messageOf(e) }));
          setAnnounce(messageOf(e));
        })
        .finally(() => alive.current && setPending((p) => omit(p, k)));
    } else flash();
    return true;
  };

  const cancel = () => {
    live.current = false;
    setEditing(null);
    focusAfter.current = true;
  };

  const onCellKey = (e: React.KeyboardEvent, p: Pos) => {
    if (editing) return;
    const row = rows[p.r];
    const col = columns[p.c];
    const k = cellKey(getRowId(row), col.key);
    const mod = e.metaKey || e.ctrlKey;
    const go = (to: Pos) => {
      e.preventDefault();
      move(to);
    };
    switch (e.key) {
      case "ArrowUp":
        return go({ r: mod ? 0 : p.r - 1, c: p.c });
      case "ArrowDown":
        return go({ r: mod ? rows.length - 1 : p.r + 1, c: p.c });
      case "ArrowLeft":
        return go({ r: p.r, c: p.c - 1 });
      case "ArrowRight":
        return go({ r: p.r, c: p.c + 1 });
      case "Home":
        return go({ r: mod ? 0 : p.r, c: 0 });
      case "End":
        return go({ r: mod ? rows.length - 1 : p.r, c: columns.length - 1 });
      case "Tab": {
        const next = step(p, e.shiftKey ? -1 : 1);
        if (next) go(next);
        return;
      }
      case "Enter":
      case "F2":
        e.preventDefault();
        return startEdit(p, { caret: e.key === "F2" ? "end" : "select" });
      case "Escape":
        if (drafts[k]) {
          e.preventDefault();
          setDrafts((d) => omit(d, k));
        }
        return;
      case "Backspace":
      case "Delete":
        e.preventDefault();
        return startEdit(p, { text: "" });
    }
    if (mod && e.key.toLowerCase() === "c") {
      e.preventDefault();
      const value = k in pending ? pending[k] : row[col.key];
      navigator.clipboard?.writeText(col.toInput ? col.toInput(value, row) : String(value ?? "")).then(
        () => alive.current && setAnnounce("Copied"),
        () => alive.current && setAnnounce("Couldn’t copy"),
      );
      return;
    }
    // Typing on a cell replaces its contents, as a spreadsheet does.
    if (e.key.length === 1 && !mod && !e.altKey && editable(p.c)) {
      e.preventDefault();
      startEdit(p, { text: e.key });
    }
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!editing) return;
    const p = { r: editing.r, c: editing.c };
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Enter saves and drops to the cell below; Shift+Enter goes up.
      const to = { r: Math.max(0, Math.min(rows.length - 1, p.r + (e.shiftKey ? -1 : 1))), c: p.c };
      commit(to);
    } else if (e.key === "Tab") {
      // Tab saves and moves to the next editable cell. At the last one it saves and stays; the next Tab leaves the grid.
      e.preventDefault();
      commit(step(p, e.shiftKey ? -1 : 1));
    }
  };

  const hasFooter = columns.some((c) => c.footer);

  return (
    <div className={cn("group/grid relative flex flex-col overflow-hidden rounded-xl border border-line bg-frame", className)} {...rest}>
      <div ref={scroller} onScroll={(e) => measure(e.currentTarget)} className="max-h-[inherit] min-h-0 flex-1 overflow-auto overscroll-contain">
        <LayoutGroup id={uid}>
          <table
            ref={grid}
            role="grid"
            aria-labelledby={captionId}
            style={{ minWidth }}
            className="w-full table-fixed border-separate border-spacing-0 text-[13px]"
          >
            <caption id={captionId} className="sr-only">
              {caption}
            </caption>
            <colgroup>
              {columns.map((c) => (
                <col key={c.key} style={c.width != null ? { width: c.width } : undefined} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "sticky top-0 z-(--z-sticky) h-9 whitespace-nowrap border-b border-line bg-frame px-3 text-[12px] font-medium text-fg-3",
                      col.numeric ? "text-right" : "text-left",
                    )}
                  >
                    {col.header}
                    {col.editable === false && <span className="sr-only"> (read-only)</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => {
                const id = getRowId(row);
                return (
                  <tr key={id} className="group/row">
                    {columns.map((col, c) => {
                      const k = cellKey(id, col.key);
                      const isActive = r === clampR && c === clampC;
                      const isEditing = editing?.r === r && editing?.c === c;
                      const draft = drafts[k];
                      const saving = k in pending;
                      const value = saving ? pending[k] : row[col.key];
                      const error = isEditing ? editing?.error : (draft?.error ?? failed[k]);
                      const errorId = `${uid}-err-${r}-${c}`;
                      const canEdit = col.editable !== false;
                      // Errors open below, except near the bottom where they'd be cut off.
                      const above = r >= rows.length - 2 && rows.length > 2;
                      return (
                        <td
                          key={col.key}
                          data-cell={`${r}:${c}`}
                          tabIndex={isActive && !isEditing ? 0 : -1}
                          aria-readonly={!canEdit || undefined}
                          aria-invalid={error ? true : undefined}
                          aria-describedby={error && !isEditing ? errorId : undefined}
                          aria-busy={saving || undefined}
                          onFocus={() => !isActive && move({ r, c }, "pointer")}
                          onKeyDown={(e) => onCellKey(e, { r, c })}
                          onPointerDown={(e) => {
                            if (isEditing || e.button !== 0) return;
                            if (editing) commit(null, true);
                            move({ r, c }, "pointer");
                          }}
                          onClick={() => {
                            if (!isEditing && canEdit) startEdit({ r, c });
                          }}
                          className={cn(
                            "relative h-10 border-b border-line p-0 outline-none group-last/row:border-b-0",
                            canEdit ? "cursor-text" : "cursor-default",
                            !isEditing && canEdit && "hover:bg-hover",
                            "transition-colors duration-100",
                          )}
                        >
                          {/* One highlight for the whole grid, handed from cell to cell. */}
                          {isActive && (
                            // The wrapper owns visibility (while the grid has focus, is editing, or holds an error);
                            // the inner span is the one highlight, handed from cell to cell.
                            <span
                              aria-hidden
                              className={cn(
                                "pointer-events-none absolute -inset-px z-[2] opacity-0 transition-opacity duration-150 group-focus-within/grid:opacity-100",
                                (isEditing || error) && "opacity-100",
                              )}
                            >
                              <motion.span
                                layoutId="active-cell"
                                transition={via === "keyboard" || reduce ? { duration: 0 } : spring.follow}
                                className={cn(
                                  "absolute inset-0 rounded-[5px] border",
                                  isEditing
                                    ? error
                                      ? "border-danger shadow-[0_0_0_3px_var(--danger-soft)]"
                                      : "border-fg-3 shadow-[0_0_0_3px_color-mix(in_srgb,var(--fg)_8%,transparent)]"
                                    : error
                                      ? "border-danger"
                                      : "border-fg-4",
                                )}
                              />
                            </span>
                          )}

                          {/* The saved flash: a wash of the success tint that fades on its own. */}
                          <AnimatePresence>
                            {saved[k] != null && (
                              <motion.span
                                key={saved[k]}
                                aria-hidden
                                initial={{ opacity: 1 }}
                                animate={{ opacity: 0 }}
                                transition={{ duration: 1.1, ease: ease.outQuart, delay: 0.15 }}
                                className="pointer-events-none absolute inset-0 bg-success-soft"
                              />
                            )}
                          </AnimatePresence>

                          {isEditing ? (
                            <input
                              ref={input}
                              value={editing.text}
                              onChange={(e) => setEditing({ ...editing, text: e.target.value, error: undefined })}
                              onKeyDown={onInputKey}
                              // Clicking elsewhere saves; a rejected value is kept as a marked draft, never thrown away.
                              onBlur={() => commit(null, true)}
                              aria-label={`${nameOf(c)}, ${rowName(r)}`}
                              aria-invalid={error ? true : undefined}
                              aria-describedby={error ? errorId : undefined}
                              inputMode={col.numeric ? "decimal" : undefined}
                              placeholder={col.placeholder}
                              autoComplete="off"
                              spellCheck={false}
                              // Same box, padding and alignment as the text it replaces, so nothing moves when editing starts.
                              className={cn(
                                "absolute inset-0 z-[1] h-full w-full min-w-0 rounded-[4px] bg-raised px-3 text-[13px] text-fg outline-none placeholder:text-fg-4 pointer-coarse:text-base",
                                col.numeric && "text-right tabular",
                              )}
                            />
                          ) : (
                            <span
                              className={cn(
                                "relative flex h-full min-w-0 items-center px-3",
                                col.numeric && "justify-end tabular",
                                saving && "text-fg-3",
                              )}
                            >
                              {draft ? (
                                <span className="truncate text-danger">{draft.text || " "}</span>
                              ) : (
                                <span className={cn("truncate", value == null || value === "" ? "text-fg-4" : "text-fg")}>
                                  {value == null || value === "" ? (col.placeholder ?? "—") : col.format ? col.format(value, row) : String(value)}
                                </span>
                              )}
                              {saving && <Saving side={col.numeric ? "left" : "right"} />}
                            </span>
                          )}

                          <AnimatePresence>
                            {error && (isEditing || isActive) && (
                              <motion.span
                                id={errorId}
                                role={isEditing ? undefined : "note"}
                                initial={reduce ? { opacity: 0 } : { opacity: 0, y: above ? 4 : -4, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                                transition={{ duration: 0.16, ease: ease.out }}
                                className={cn(
                                  "pointer-events-none absolute z-(--z-dropdown) w-max max-w-[240px] rounded-md border border-line-2 bg-raised px-2 py-1 text-[12px] leading-4 text-danger shadow-pop",
                                  above ? "bottom-[calc(100%+4px)] origin-bottom" : "top-[calc(100%+4px)] origin-top",
                                  col.numeric ? "right-0" : "left-0",
                                )}
                              >
                                {error}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            {hasFooter && (
              <tfoot>
                <tr>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn("h-10 border-t border-line px-3 font-medium text-fg", col.numeric ? "text-right tabular" : "text-left")}
                    >
                      {col.footer?.(rows)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </LayoutGroup>
      </div>
      <div aria-hidden className={cn("pointer-events-none absolute inset-y-0 left-0 z-(--z-sticky) w-4 bg-linear-to-r from-overlay to-transparent transition-opacity duration-200", edges.left ? "opacity-50" : "opacity-0")} />
      <div aria-hidden className={cn("pointer-events-none absolute inset-y-0 right-0 z-(--z-sticky) w-4 bg-linear-to-l from-overlay to-transparent transition-opacity duration-200", edges.right ? "opacity-50" : "opacity-0")} />
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

function Saving({ side }: { side: "left" | "right" }) {
  // Only appears if the save is slow enough to notice.
  return (
    <motion.svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.15, duration: 0.15 }}
      className={cn("absolute top-1/2 -mt-1.5 text-fg-3 motion-safe:animate-spin", side === "left" ? "left-2" : "right-2")}
    >
      <path d="M8 2.25a5.75 5.75 0 1 0 5.75 5.75" />
    </motion.svg>
  );
}

function omit<V>(record: Record<string, V>, key: string) {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

function messageOf(e: unknown) {
  return e instanceof Error && e.message ? e.message : "Couldn’t save. Try again.";
}
