"use client";
import { Tooltip } from "@base-ui/react/tooltip";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useCopy } from "@/components/ui/copy-button";
import { cn } from "@/lib/cn";
import { Check, Copy, Eye, EyeOff, Plus, Trash, Warning } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type EnvVar = { id: string; key: string; value: string };

const KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;
let seq = 0;
/** A new row with a stable id. Call it in event handlers, not during render. */
export const createEnvVar = (key = "", value = ""): EnvVar => ({ id: `env-${Date.now().toString(36)}-${(seq++).toString(36)}`, key, value });

/** Reads KEY=value lines: skips blanks and comments, drops `export`, unquotes, strips trailing # comments. */
export function parseEnv(text: string): { key: string; value: string }[] {
  const out: { key: string; value: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^export\s+/, "");
    if (!line || line.startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at <= 0) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    const q = value[0];
    if ((q === '"' || q === "'" || q === "`") && value.lastIndexOf(q) > 0) {
      value = value.slice(1, value.lastIndexOf(q));
      if (q === '"') value = value.replace(/\\n/g, "\n").replace(/\\"/g, '"');
    } else {
      value = value.replace(/\s+#.*$/, "");
    }
    out.push({ key, value });
  }
  return out;
}

/** Writes rows back out as a .env file, quoting values that need it. */
export function toEnv(rows: EnvVar[]) {
  return rows
    .filter((r) => r.key.trim())
    .map((r) => `${r.key.trim()}=${/[\s#"'=]/.test(r.value) || r.value === "" ? JSON.stringify(r.value) : r.value}`)
    .join("\n");
}

export type EnvEditorProps = Omit<React.ComponentProps<"div">, "children" | "defaultValue" | "onChange"> & {
  /** The rows (controlled). */
  value?: EnvVar[];
  defaultValue?: EnvVar[];
  onValueChange?: (rows: EnvVar[]) => void;
  /** Heading above the rows. */
  title?: string;
  /** Shows values without editing, and hides add and remove. */
  readOnly?: boolean;
  disabled?: boolean;
};

export function EnvEditor({
  value: valueProp,
  defaultValue = [],
  onValueChange,
  title = "Environment variables",
  readOnly = false,
  disabled = false,
  className,
  ...rest
}: EnvEditorProps) {
  const reduce = useReducedMotion();
  const uid = useId();
  const [rows, setRows] = useControllableState<EnvVar[]>({ value: valueProp, defaultValue, onChange: onValueChange });
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  // Rows that just arrived from a paste: they cascade in and hold a wash for a moment.
  const [fresh, setFresh] = useState<{ ids: Set<string>; order: string[] }>({ ids: new Set(), order: [] });
  const [note, setNote] = useState("");
  const focusNext = useRef<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [tip] = useState(() => Tooltip.createHandle<string>());
  const { state: copyState, copy } = useCopy({ timeout: 1600 });

  // Focus a row's key after it mounts (add, or Enter at the end).
  useEffect(() => {
    const id = focusNext.current;
    if (!id) return;
    focusNext.current = null;
    root.current?.querySelector<HTMLInputElement>(`[data-key-input="${id}"]`)?.focus();
  }, [rows]);

  useEffect(() => {
    if (!fresh.ids.size && !note) return;
    const t = window.setTimeout(() => {
      setFresh({ ids: new Set(), order: [] });
      setNote("");
    }, 2600);
    return () => window.clearTimeout(t);
  }, [fresh, note]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = r.key.trim();
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [rows]);
  // For duplicates, the row whose value is actually used: the last one.
  const winner = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.key.trim()) m.set(r.key.trim(), r.id);
    return m;
  }, [rows]);

  const locked = readOnly || disabled;
  const allRevealed = rows.length > 0 && rows.every((r) => revealed.has(r.id));

  const update = (id: string, patch: Partial<EnvVar>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const add = (after?: string) => {
    const row = createEnvVar();
    focusNext.current = row.id;
    const i = after ? rows.findIndex((r) => r.id === after) : -1;
    setRows(i === -1 ? [...rows, row] : [...rows.slice(0, i + 1), row, ...rows.slice(i + 1)]);
  };

  const remove = (id: string, focusPrev = false) => {
    const i = rows.findIndex((r) => r.id === id);
    const next = rows.filter((r) => r.id !== id);
    setRows(next);
    const target = next[Math.max(0, i - (focusPrev ? 1 : 0))] ?? null;
    // Hand focus to a neighbour so the keyboard never falls back to the page.
    requestAnimationFrame(() => {
      const sel = target ? `[data-${focusPrev ? "value" : "key"}-input="${target.id}"]` : "[data-add]";
      root.current?.querySelector<HTMLElement>(sel)?.focus();
    });
  };

  // A pasted .env lands as rows: existing keys are updated in place, new keys appended.
  const paste = (text: string, into: EnvVar) => {
    const parsed = parseEnv(text);
    if (!parsed.length) return false;
    let next = [...rows];
    const touchedIds: string[] = [];
    let added = 0;
    let updated = 0;
    for (const [n, p] of parsed.entries()) {
      const existing = next.find((r) => r.key.trim() === p.key && r.id !== into.id);
      if (n === 0 && !into.key.trim() && !into.value) {
        next = next.map((r) => (r.id === into.id ? { ...r, key: p.key, value: p.value } : r));
        touchedIds.push(into.id);
        added++;
      } else if (existing) {
        next = next.map((r) => (r.id === existing.id ? { ...r, value: p.value } : r));
        touchedIds.push(existing.id);
        updated++;
      } else {
        const row = createEnvVar(p.key, p.value);
        next.push(row);
        touchedIds.push(row.id);
        added++;
      }
    }
    setRows(next);
    setFresh({ ids: new Set(touchedIds), order: touchedIds });
    const say = (n: number, verb: string) => `${verb} ${n} ${n === 1 ? "variable" : "variables"}`;
    setNote([added && say(added, "Added"), updated && say(updated, "updated")].filter(Boolean).join(", ").replace(/^u/, "U"));
    return true;
  };

  const toggleReveal = (id: string) => {
    const next = new Set(revealed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setRevealed(next);
  };

  const field = cn(
    "h-8 w-full min-w-0 rounded-lg border bg-frame px-2.5 font-mono text-base text-fg outline-none sm:text-[12.5px]",
    "transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-fg-4",
    "hover:border-fg-4 focus:border-fg-4 focus:ring-3 focus:ring-fg/10",
    "disabled:pointer-events-none disabled:opacity-50 read-only:bg-transparent read-only:hover:border-line-2",
  );

  return (
    <Tooltip.Provider delay={500}>
      <div
        ref={root}
        data-slot="env-editor"
        data-disabled={disabled || undefined}
        className={cn("flex min-w-0 flex-col rounded-xl border border-line bg-raised text-fg shadow-[var(--shadow)]", className)}
        {...rest}
      >
        <div className="flex h-11 items-center gap-2 border-b border-line pl-4 pr-2">
          <h3 className="min-w-0 truncate text-[13px] font-medium tracking-[-0.01em]">{title}</h3>
          <span className="tabular font-mono text-[11px] text-fg-4">{rows.filter((r) => r.key.trim()).length}</span>
          <div className="ml-auto flex items-center gap-0.5">
            <ToolButton
              label="Reveal all values"
              hint={allRevealed ? "Hide all values" : "Reveal all values"}
              tip={tip}
              disabled={!rows.length || disabled}
              pressed={allRevealed}
              onPress={() => setRevealed(allRevealed ? new Set() : new Set(rows.map((r) => r.id)))}
            >
              <SwapIcon k={allRevealed ? "off" : "on"} reduce={!!reduce}>
                {allRevealed ? <EyeOff size={15} /> : <Eye size={15} />}
              </SwapIcon>
            </ToolButton>
            <ToolButton
              label="Copy as .env"
              hint={copyState === "copied" ? "Copied" : copyState === "failed" ? "Couldn’t copy" : "Copy as .env"}
              tip={tip}
              disabled={!rows.some((r) => r.key.trim())}
              onPress={() => copy(() => toEnv(rows))}
            >
              <SwapIcon k={copyState} reduce={!!reduce}>
                {copyState === "copied" ? <Check size={15} /> : <Copy size={15} />}
              </SwapIcon>
            </ToolButton>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-9 text-center">
            <div>
              <p className="text-[13px] text-fg">No variables yet</p>
              <p className="mt-1 text-[12px] text-fg-3">Add one, or paste a .env file into the key field.</p>
            </div>
            {!locked && (
              <button type="button" data-add onClick={() => add()} className={primaryButton}>
                <Plus size={14} />
                Add variable
              </button>
            )}
          </div>
        ) : (
          <ul aria-label={title} className="flex flex-col px-2 pt-2">
            <AnimatePresence initial={false}>
              {rows.map((r, i) => {
                const k = r.key.trim();
                const dupe = !!k && (counts.get(k) ?? 0) > 1;
                const shadowed = dupe && winner.get(k) !== r.id;
                const invalid = !!k && !KEY.test(k) && touched.has(r.id);
                const shown = revealed.has(r.id);
                const msgId = `${uid}-${r.id}-msg`;
                const order = fresh.order.indexOf(r.id);
                return (
                  <motion.li
                    key={r.id}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.16, ease: ease.out } }}
                    transition={{
                      height: { duration: 0.24, ease: ease.out, delay: order > 0 ? Math.min(order, 8) * 0.03 : 0 },
                      opacity: { duration: 0.2, ease: ease.out, delay: order > 0 ? Math.min(order, 8) * 0.03 : 0 },
                    }}
                    className="overflow-hidden"
                  >
                    <div
                      data-fresh={fresh.ids.has(r.id) || undefined}
                      className="rounded-lg p-1.5 transition-colors duration-700 ease-out data-fresh:bg-fg/[0.05] data-fresh:duration-150"
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)_auto]">
                        <input
                          data-key-input={r.id}
                          value={r.key}
                          readOnly={readOnly}
                          disabled={disabled}
                          placeholder="KEY"
                          aria-label={`Key ${i + 1}`}
                          aria-invalid={invalid || dupe || undefined}
                          aria-describedby={invalid || dupe ? msgId : undefined}
                          autoCapitalize="characters"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          onChange={(e) => update(r.id, { key: e.target.value.replace(/\s/g, "_") })}
                          onBlur={() => r.key && !touched.has(r.id) && setTouched(new Set(touched).add(r.id))}
                          onPaste={(e) => {
                            const text = e.clipboardData.getData("text");
                            if (/[\n=]/.test(text) && paste(text, r)) e.preventDefault();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Backspace" && !r.key && !r.value && rows.length > 1) {
                              e.preventDefault();
                              remove(r.id, true);
                            }
                          }}
                          className={cn(
                            field,
                            "col-start-1 row-start-1 tracking-[0.01em]",
                            invalid ? "border-danger/60 focus:border-danger focus:ring-danger/15" : dupe ? "border-warning/60 focus:border-warning focus:ring-warning/15" : "border-line-2",
                            shadowed && "text-fg-3 line-through decoration-fg-4",
                          )}
                        />
                        <div className="relative col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                          <input
                            data-value-input={r.id}
                            type={shown ? "text" : "password"}
                            value={r.value}
                            readOnly={readOnly}
                            disabled={disabled}
                            placeholder="Value"
                            aria-label={`Value of ${k || `key ${i + 1}`}`}
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            data-1p-ignore
                            data-lpignore="true"
                            data-bwignore
                            onChange={(e) => update(r.id, { value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !locked) {
                                e.preventDefault();
                                add(r.id);
                              }
                            }}
                            className={cn(field, "peer border-line-2 pr-9", !shown && r.value && "text-transparent focus:text-fg")}
                          />
                          {/* A fixed-length mask at rest, so a hidden value doesn't give away its length. */}
                          {!shown && r.value && (
                            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center font-mono text-[12.5px] tracking-[0.1em] text-fg-3 peer-focus:hidden">
                              ••••••••••••
                            </span>
                          )}
                          <button
                            type="button"
                            aria-label={shown ? `Hide value of ${k || "this key"}` : `Reveal value of ${k || "this key"}`}
                            aria-pressed={shown}
                            disabled={disabled || !r.value}
                            onClick={() => toggleReveal(r.id)}
                            className={cn(
                              "absolute right-1 top-1 grid size-6 place-items-center rounded-md text-fg-3 outline-none",
                              "transition-[background-color,color,scale] duration-150 ease-out hover:bg-fg/[0.06] hover:text-fg active:scale-90 active:duration-75",
                              "focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3 focus-visible:outline-solid",
                              "disabled:pointer-events-none disabled:opacity-40",
                              "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
                            )}
                          >
                            <SwapIcon k={shown ? "off" : "on"} reduce={!!reduce}>
                              {shown ? <EyeOff size={14} /> : <Eye size={14} />}
                            </SwapIcon>
                          </button>
                        </div>
                        {!locked && (
                          <Tooltip.Trigger
                            handle={tip}
                            payload="Remove"
                            render={
                              <button
                                type="button"
                                aria-label={`Remove ${k || `row ${i + 1}`}`}
                                onClick={() => remove(r.id)}
                                className={cn(
                                  "relative col-start-2 row-start-1 grid size-8 place-items-center rounded-lg text-fg-3 outline-none sm:col-start-3",
                                  "transition-[background-color,color,scale] duration-150 ease-out hover:bg-danger-soft hover:text-danger active:scale-90 active:duration-75",
                                  "focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 focus-visible:outline-solid",
                                  "before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden",
                                )}
                              />
                            }
                          >
                            <Trash size={15} />
                          </Tooltip.Trigger>
                        )}
                      </div>
                      {(invalid || dupe) && (
                        <p id={msgId} className={cn("flex items-center gap-1.5 px-1 pt-1.5 text-[11.5px]", invalid ? "text-danger" : "text-warning")}>
                          <Warning size={13} className="shrink-0" />
                          {invalid
                            ? "Use letters, digits and underscores, not starting with a digit"
                            : shadowed
                              ? `Duplicate key. A later ${k} overrides this one.`
                              : `Duplicate key. This value overrides the earlier ${k}.`}
                        </p>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}

        {rows.length > 0 && (
          <div className="flex min-h-12 items-center gap-3 px-3.5 pb-2.5 pt-1">
            <span role="status" className="sr-only">
              {copyState === "copied" ? "Copied as .env" : copyState === "failed" ? "Couldn’t copy" : ""}
            </span>
            {!locked && (
              <button type="button" data-add onClick={() => add()} className={secondaryButton}>
                <Plus size={14} />
                Add variable
              </button>
            )}
            <p className="relative min-w-0 flex-1 text-right text-[12px] text-fg-4" aria-live="polite">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={note || "hint"}
                  className="block truncate"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: ease.out }}
                >
                  {note ? <span className="text-fg-2">{note}</span> : locked ? "" : <span className="hidden sm:pointer-fine:inline">Paste a .env into any key to add many</span>}
                </motion.span>
              </AnimatePresence>
            </p>
          </div>
        )}
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

const primaryButton = cn(
  "inline-flex h-8 items-center gap-1.5 rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame outline-none",
  "transition-[background-color,scale] duration-150 ease-out hover:bg-fg/90 active:scale-[0.97] active:duration-75",
  "focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid",
);
const secondaryButton = cn(
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] outline-none",
  "transition-[background-color,border-color,scale] duration-150 ease-out hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75",
  "focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid",
);

function SwapIcon({ k, reduce, children }: { k: string; reduce: boolean; children: React.ReactNode }) {
  return (
    <span className="relative grid size-4 place-items-center">
      <AnimatePresence initial={false}>
        <motion.span
          key={k}
          className="absolute inset-0 grid place-items-center"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
          transition={reduce ? { duration: 0.12 } : spring.pop}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function ToolButton({
  label,
  hint,
  tip,
  onPress,
  disabled,
  pressed,
  children,
}: {
  label: string;
  hint: string;
  tip: ReturnType<typeof Tooltip.createHandle<string>>;
  onPress: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip.Trigger
      handle={tip}
      payload={hint}
      closeOnClick={false}
      render={
        <button
          type="button"
          aria-label={label}
          aria-pressed={pressed}
          disabled={disabled}
          onClick={onPress}
          className={cn(
            "relative grid size-8 place-items-center rounded-lg text-fg-3 outline-none",
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
