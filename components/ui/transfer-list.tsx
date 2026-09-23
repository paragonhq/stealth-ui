"use client";
import { Checkbox } from "@base-ui/react/checkbox";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight, Search } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type TransferItem = {
  value: string;
  label: string;
  description?: string;
  /** Can't be checked or moved, like the owner of a channel. */
  disabled?: boolean;
  /** An avatar or icon before the label. */
  leading?: React.ReactNode;
};

type Side = "source" | "target";
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export type TransferListProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  items: TransferItem[];
  /** Values on the right-hand (chosen) side. */
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** Headings for the two lists. */
  titles?: [string, string];
  /** Most items the chosen side can hold. */
  max?: number;
  searchPlaceholder?: string;
  /** What an empty list says, per side. */
  empty?: [string, string];
  disabled?: boolean;
};

export function TransferList({
  items,
  value: valueProp,
  defaultValue = [],
  onValueChange,
  titles = ["Available", "Selected"],
  max,
  searchPlaceholder = "Filter",
  empty = ["Nothing left to add", "Nothing selected yet"],
  disabled = false,
  className,
  ...rest
}: TransferListProps) {
  const uid = useId();
  const reduce = useReducedMotion();
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const [checked, setChecked] = useState<Record<Side, string[]>>({ source: [], target: [] });
  const [query, setQuery] = useState<Record<Side, string>>({ source: "", target: "" });
  const [active, setActive] = useState<Record<Side, string | null>>({ source: null, target: null });
  const anchor = useRef<Record<Side, string | null>>({ source: null, target: null });
  // Layout flights only for moves made with the pointer; filtering and keys never animate position.
  const [flying, setFlying] = useState(false);
  const [landed, setLanded] = useState<{ id: number; values: string[] }>({ id: 0, values: [] });
  const [announce, setAnnounce] = useState("");
  const scrollTarget = useRef<string | null>(null);
  // The active-row outline is for keyboard users; a click focuses the list without it.
  const [keyboard, setKeyboard] = useState(false);
  const pointing = useRef(false);

  const chosen = useMemo(() => new Set(value), [value]);
  // Both sides keep the items' original order, so a moved item lands where you'd look for it.
  const lists: Record<Side, TransferItem[]> = useMemo(
    () => ({ source: items.filter((i) => !chosen.has(i.value)), target: items.filter((i) => chosen.has(i.value)) }),
    [items, chosen],
  );
  const visible = (side: Side) => {
    const q = fold(query[side].trim());
    return q ? lists[side].filter((i) => fold(`${i.label} ${i.description ?? ""}`).includes(q)) : lists[side];
  };
  const shown: Record<Side, TransferItem[]> = { source: visible("source"), target: visible("target") };
  const room = max === undefined ? Infinity : Math.max(0, max - value.length);
  // Moves act on what you can see: checks hidden by a filter wait until the filter clears.
  const ready = (side: Side) => shown[side].filter((i) => !i.disabled && checked[side].includes(i.value)).map((i) => i.value);

  useLayoutEffect(() => {
    if (!scrollTarget.current) return;
    document.getElementById(scrollTarget.current)?.scrollIntoView({ block: "nearest" });
    scrollTarget.current = null;
  });

  const rowId = (side: Side, v: string) => `${uid}-${side}-${v}`;

  const move = (from: Side, values: string[], how: "pointer" | "keyboard") => {
    let moving = values.filter((v) => !items.find((i) => i.value === v)?.disabled);
    if (from === "source") moving = moving.slice(0, room === Infinity ? undefined : room);
    if (!moving.length) return;
    const set = new Set(moving);
    const next = from === "source" ? items.filter((i) => chosen.has(i.value) || set.has(i.value)).map((i) => i.value) : value.filter((v) => !set.has(v));
    setFlying(how === "pointer" && !reduce);
    setLanded((l) => ({ id: l.id + 1, values: moving }));
    setChecked((c) => ({ ...c, [from]: c[from].filter((v) => !set.has(v)) }));
    setActive((a) => ({ ...a, [from]: null }));
    setValue(next);
    const to = titles[from === "source" ? 1 : 0];
    setAnnounce(`Moved ${moving.length === 1 ? items.find((i) => i.value === moving[0])?.label : `${moving.length} items`} to ${to}`);
  };

  const toggle = (side: Side, v: string, on?: boolean) =>
    setChecked((c) => {
      const has = c[side].includes(v);
      const want = on ?? !has;
      return { ...c, [side]: want ? (has ? c[side] : [...c[side], v]) : c[side].filter((x) => x !== v) };
    });

  const range = (side: Side, to: string) => {
    const list = shown[side];
    const a = list.findIndex((i) => i.value === (anchor.current[side] ?? to));
    const b = list.findIndex((i) => i.value === to);
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const span = list.slice(lo, hi + 1).filter((i) => !i.disabled).map((i) => i.value);
    setChecked((c) => ({ ...c, [side]: [...new Set([...c[side], ...span])] }));
  };

  const onListKey = (e: React.KeyboardEvent, side: Side) => {
    const list = shown[side];
    if (!list.length) return;
    const i = list.findIndex((it) => it.value === active[side]);
    const go = (n: number) => {
      const target = list[Math.max(0, Math.min(list.length - 1, n))];
      setActive((a) => ({ ...a, [side]: target.value }));
      scrollTarget.current = rowId(side, target.value);
      if (e.shiftKey) range(side, target.value);
      else anchor.current[side] = target.value;
    };
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === "ArrowDown") (e.preventDefault(), go(i + 1));
    else if (e.key === "ArrowUp") (e.preventDefault(), go(i < 0 ? 0 : i - 1));
    else if (e.key === "Home") (e.preventDefault(), go(0));
    else if (e.key === "End") (e.preventDefault(), go(list.length - 1));
    else if (e.key === " " && active[side]) {
      e.preventDefault();
      const it = list[i];
      if (it && !it.disabled) toggle(side, it.value);
      anchor.current[side] = active[side];
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picks = ready(side).length ? ready(side) : active[side] ? [active[side]!] : [];
      move(side, picks, "keyboard");
    } else if (mod && e.key.toLowerCase() === "a") {
      e.preventDefault();
      setChecked((c) => ({ ...c, [side]: list.filter((it) => !it.disabled).map((it) => it.value) }));
    } else if (e.key === "Escape" && checked[side].length) {
      e.preventDefault();
      setChecked((c) => ({ ...c, [side]: [] }));
    }
  };

  const panel = (side: Side) => {
    const list = shown[side];
    const selectable = list.filter((i) => !i.disabled);
    const n = selectable.filter((i) => checked[side].includes(i.value)).length;
    const all = selectable.length > 0 && n === selectable.length;
    const title = titles[side === "source" ? 0 : 1];
    const q = query[side].trim();
    const titleId = `${uid}-${side}-title`;
    return (
      <section aria-labelledby={titleId} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <header className="flex h-10 shrink-0 items-center gap-2.5 border-b border-line pl-3 pr-3">
          <Checkbox.Root
            checked={all}
            indeterminate={n > 0 && !all}
            disabled={disabled || selectable.length === 0}
            onCheckedChange={(on) => setChecked((c) => ({ ...c, [side]: on ? selectable.map((i) => i.value) : [] }))}
            aria-label={`Select all ${q ? "matching " : ""}in ${title}`}
            className={cn(box, "data-[disabled]:opacity-40")}
          >
            <Checkbox.Indicator keepMounted className="grid place-items-center text-frame">
              <Tick checked={all} mixed={n > 0 && !all} reduce={!!reduce} />
            </Checkbox.Indicator>
          </Checkbox.Root>
          <h3 id={titleId} className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.01em] text-fg">
            {title}
          </h3>
          <span className="flex shrink-0 items-baseline gap-1 text-[12px] tabular text-fg-3" aria-hidden>
            {n > 0 && (
              <>
                <NumberFlow value={n} className="text-fg-2" />
                <span>of</span>
              </>
            )}
            <NumberFlow value={lists[side].length} />
            {side === "target" && max !== undefined && <span className="text-fg-4">/ {max}</span>}
          </span>
        </header>

        <label className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-3">
          <Search size={14} className="shrink-0 text-fg-4" />
          <span className="sr-only">{`${searchPlaceholder} ${title}`}</span>
          <input
            value={query[side]}
            disabled={disabled}
            onChange={(e) => {
              setFlying(false);
              setQuery((qq) => ({ ...qq, [side]: e.target.value }));
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                document.getElementById(`${uid}-${side}-list`)?.focus();
                if (!active[side] && list[0]) setActive((a) => ({ ...a, [side]: list[0].value }));
              } else if (e.key === "Escape" && query[side]) {
                e.preventDefault();
                setQuery((qq) => ({ ...qq, [side]: "" }));
              }
            }}
            placeholder={searchPlaceholder}
            autoComplete="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[12.5px]"
          />
        </label>

        <motion.ul
          layoutScroll
          id={`${uid}-${side}-list`}
          role="listbox"
          aria-multiselectable
          aria-labelledby={titleId}
          aria-activedescendant={active[side] && list.some((i) => i.value === active[side]) ? rowId(side, active[side]!) : undefined}
          tabIndex={disabled || list.length === 0 ? -1 : 0}
          data-keyboard={keyboard || undefined}
          onKeyDown={(e) => {
            setKeyboard(true);
            onListKey(e, side);
          }}
          onPointerDown={() => {
            pointing.current = true;
            setKeyboard(false);
          }}
          onFocus={() => {
            setKeyboard(!pointing.current);
            pointing.current = false;
            if (!active[side] && list[0]) setActive((a) => ({ ...a, [side]: list[0].value }));
          }}
          className="group/list relative flex h-[168px] flex-col gap-0.5 overflow-y-auto @[500px]:h-[220px] overscroll-contain p-1 outline-none"
        >
          <AnimatePresence initial={false} mode="popLayout">
            {list.map((it) => {
              const isChecked = checked[side].includes(it.value);
              const isActive = active[side] === it.value;
              const justLanded = landed.values.includes(it.value);
              return (
                <motion.li
                  key={it.value}
                  id={rowId(side, it.value)}
                  role="option"
                  aria-selected={isChecked}
                  aria-disabled={it.disabled || undefined}
                  data-active={isActive || undefined}
                  data-checked={isChecked || undefined}
                  layout={flying ? "position" : false}
                  layoutId={flying ? `${uid}-${it.value}` : undefined}
                  initial={flying ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={flying ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: { duration: 0.1 } }}
                  transition={flying ? spring.soft : { duration: 0.12 }}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    document.getElementById(`${uid}-${side}-list`)?.focus({ preventScroll: true });
                    setActive((a) => ({ ...a, [side]: it.value }));
                    if (it.disabled) return;
                    if (e.shiftKey && anchor.current[side]) range(side, it.value);
                    else {
                      toggle(side, it.value);
                      anchor.current[side] = it.value;
                    }
                  }}
                  onDoubleClick={() => !it.disabled && move(side, [it.value], "pointer")}
                  className={cn(
                    "relative flex h-10 shrink-0 cursor-default select-none items-center gap-2.5 rounded-lg pl-2 pr-2 outline-none",
                    "transition-colors duration-100 hover:bg-fg/[0.04] data-[checked]:bg-fg/[0.06]",
                    "group-focus/list:group-data-[keyboard]/list:data-[active]:outline-solid group-focus/list:group-data-[keyboard]/list:data-[active]:outline-1 group-focus/list:group-data-[keyboard]/list:data-[active]:-outline-offset-1 group-focus/list:group-data-[keyboard]/list:data-[active]:outline-fg-4",
                    it.disabled && "text-fg-4",
                  )}
                >
                  {justLanded && (
                    // Where it landed: a wash that fades once the flight settles.
                    <motion.span
                      key={landed.id}
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-lg bg-fg/[0.08]"
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 0 }}
                      transition={{ duration: 0.9, delay: 0.3, ease: ease.outQuart }}
                    />
                  )}
                  <span aria-hidden data-checked={isChecked || undefined} className={cn(box, "relative", it.disabled && "opacity-40")}>
                    <span className="grid place-items-center text-frame">
                      <Tick checked={isChecked} reduce={!!reduce} />
                    </span>
                  </span>
                  {it.leading && <span className="relative shrink-0">{it.leading}</span>}
                  <span className="relative flex min-w-0 flex-1 flex-col">
                    <span className={cn("truncate text-[13px] leading-[1.3]", it.disabled ? "text-fg-3" : "text-fg")}>{it.label}</span>
                    {it.description && <span className="truncate text-[11.5px] leading-[1.3] text-fg-3">{it.description}</span>}
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
          {list.length === 0 && (
            <li role="presentation" className="flex flex-1 flex-col items-center justify-center gap-1 px-4 text-center">
              <span className="text-[12.5px] text-fg-2">{q ? `No matches for “${q}”` : empty[side === "source" ? 0 : 1]}</span>
              {q ? (
                <button
                  type="button"
                  onClick={() => setQuery((qq) => ({ ...qq, [side]: "" }))}
                  className="mt-1 h-7 rounded-md border border-line-2 px-2.5 text-[12px] font-medium text-fg outline-none transition-[background-color,scale] duration-150 hover:bg-fg/5 active:scale-[0.97] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
                >
                  Clear filter
                </button>
              ) : side === "target" ? (
                <span className="text-[12px] text-fg-3">Check people on the left, then move them across.</span>
              ) : null}
            </li>
          )}
        </motion.ul>
      </section>
    );
  };

  const nIn = ready("source").length;
  const nOut = ready("target").length;
  const addable = Math.min(nIn, room);
  const allIn = shown.source.filter((i) => !i.disabled).length;
  const allOut = shown.target.filter((i) => !i.disabled).length;

  return (
    <div data-disabled={disabled || undefined} className={cn("@container w-full data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className)} {...rest}>
      <LayoutGroup id={uid}>
        <div className="flex flex-col gap-2 @[500px]:flex-row @[500px]:items-stretch">
          {panel("source")}
          <div role="group" aria-label="Move items" className="flex shrink-0 items-center justify-center gap-1.5 @[500px]:flex-col">
            <MoveButton label={addable ? `Move ${addable} to ${titles[1]}` : `Move checked to ${titles[1]}`} disabled={!addable || disabled} onClick={() => move("source", ready("source"), "pointer")} count={addable}>
              <ChevronRight size={16} className="rotate-90 @[500px]:rotate-0" />
            </MoveButton>
            <MoveButton label={nOut ? `Move ${nOut} to ${titles[0]}` : `Move checked to ${titles[0]}`} disabled={!nOut || disabled} onClick={() => move("target", ready("target"), "pointer")} count={nOut}>
              <ChevronLeft size={16} className="rotate-90 @[500px]:rotate-0" />
            </MoveButton>
            <span aria-hidden className="mx-1 h-3 w-px bg-line @[500px]:mx-0 @[500px]:my-1 @[500px]:h-px @[500px]:w-3" />
            <MoveButton label={`Move all to ${titles[1]}`} disabled={!allIn || !room || disabled} onClick={() => move("source", shown.source.map((i) => i.value), "pointer")} quiet>
              <DoubleChevron className="rotate-90 @[500px]:rotate-0" />
            </MoveButton>
            <MoveButton label={`Move all to ${titles[0]}`} disabled={!allOut || disabled} onClick={() => move("target", shown.target.map((i) => i.value), "pointer")} quiet>
              <DoubleChevron className="-rotate-90 @[500px]:rotate-180" />
            </MoveButton>
          </div>
          {panel("target")}
        </div>
      </LayoutGroup>
      {max !== undefined && nIn > room && (
        <p className="mt-2 text-[12px] text-fg-3">
          {room === 0
            ? `${titles[1]} is full at ${max}. Move someone back to make room.`
            : `${titles[1]} holds ${max}, so only the first ${room} checked will move.`}
        </p>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}

const box =
  "grid size-4 shrink-0 place-items-center rounded-[5px] border border-line-2 bg-transparent outline-none transition-[background-color,border-color] duration-150 data-[checked]:border-fg data-[checked]:bg-fg data-[indeterminate]:border-fg data-[indeterminate]:bg-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3";

function Tick({ checked, mixed, reduce }: { checked: boolean; mixed?: boolean; reduce: boolean }) {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {mixed ? (
        <path d="M4 8h8" />
      ) : (
        <motion.path
          d="M3.5 8.5 6.5 11.5 12.5 4.5"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : { pathLength: { duration: 0.22, ease: ease.out }, opacity: { duration: 0.05 } }}
        />
      )}
    </svg>
  );
}

function DoubleChevron({ className }: { className?: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="m4 4.5 3.5 3.5L4 11.5M8.5 4.5 12 8l-3.5 3.5" />
    </svg>
  );
}

function MoveButton({ label, disabled, onClick, children, count, quiet }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode; count?: number; quiet?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative grid size-8 place-items-center rounded-lg outline-none transition-[background-color,border-color,color,opacity,scale] duration-150 active:scale-[0.92] disabled:pointer-events-none disabled:opacity-35",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        quiet ? "text-fg-3 hover:bg-fg/5 hover:text-fg" : "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4",
      )}
    >
      {children}
      <AnimatePresence>
        {!!count && (
          <motion.span
            aria-hidden
            className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-fg px-1 text-[10px] font-medium tabular text-frame"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.1 } }}
            transition={spring.pop}
          >
            <NumberFlow value={count} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
