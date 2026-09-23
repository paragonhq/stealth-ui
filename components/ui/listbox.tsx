"use client";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { createContext, use, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

type Via = "pointer" | "keyboard";

type Ctx = {
  selected: string[];
  active: string | null;
  multiple: boolean;
  via: Via;
  reduce: boolean;
  focused: string | null;
  pick: (value: string, how: { via: Via; shift?: boolean }) => void;
  setActive: (value: string) => void;
};
const ListboxContext = createContext<Ctx | null>(null);
const useListbox = () => {
  const ctx = use(ListboxContext);
  if (!ctx) throw new Error("ListboxItem must be inside a Listbox");
  return ctx;
};

type Common = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  /** Shown in place of the rows when there are none. */
  empty?: React.ReactNode;
};
type SingleProps = { multiple?: false; value?: string | null; defaultValue?: string | null; onValueChange?: (value: string | null) => void };
type MultipleProps = { multiple: true; value?: string[]; defaultValue?: string[]; onValueChange?: (value: string[]) => void };
export type ListboxProps = Common & (SingleProps | MultipleProps);

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase().trim();
const toList = (v: string | string[] | null | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]);

/**
 * An always-visible list you pick from: single (selection follows focus) or multiple
 * (click toggles, Shift extends). One tab stop; arrows, Home, End and typing move inside it.
 */
export function Listbox(props: ListboxProps) {
  const { multiple = false, value, defaultValue, onValueChange, empty, className, children, onKeyDown, onFocus, ...rest } = props;
  const reduce = !!useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const [inner, setInner] = useState<string[]>(() => toList(defaultValue));
  const controlled = value !== undefined;
  const selected = controlled ? toList(value) : inner;
  const [activeState, setActive] = useState<string | null>(null);
  const [via, setVia] = useState<Via>("pointer");
  const anchor = useRef<string | null>(null);
  const typed = useRef({ text: "", at: 0 });
  const layoutId = useId();

  const active = activeState ?? selected[0] ?? null;

  // Open on the choice: a chosen row below the fold is scrolled into view once, inside the list only.
  useEffect(() => {
    const list = root.current;
    const row = list?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
    if (!list || !row) return;
    const top = row.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2;
    if (row.offsetTop + row.offsetHeight > list.clientHeight) list.scrollTop = Math.max(0, top);
  }, []);

  const emit = (next: string[]) => {
    if (!controlled) setInner(next);
    if (multiple) (onValueChange as MultipleProps["onValueChange"])?.(next);
    else (onValueChange as SingleProps["onValueChange"])?.(next[0] ?? null);
  };

  // The rows in the order they're on screen, read from the DOM so groups and conditional rows just work.
  const options = () => [...(root.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
  const enabled = () => options().filter((o) => o.getAttribute("aria-disabled") !== "true");
  const valueOf = (el: HTMLElement) => el.dataset.value ?? "";

  const range = (from: string, to: string) => {
    const vals = enabled().map(valueOf);
    const [a, b] = [vals.indexOf(from), vals.indexOf(to)].sort((x, y) => x - y);
    return a < 0 ? [to] : vals.slice(a, b + 1);
  };

  const pick = (v: string, { via: how, shift }: { via: Via; shift?: boolean }) => {
    setVia(how);
    setActive(v);
    if (!multiple) {
      if (selected[0] !== v) emit([v]);
      return;
    }
    if (shift && anchor.current) {
      const add = range(anchor.current, v);
      emit([...selected, ...add.filter((x) => !selected.includes(x))]);
      return;
    }
    anchor.current = v;
    emit(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };

  const move = (el: HTMLElement | undefined, opts: { select?: boolean; extend?: boolean } = {}) => {
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest" });
    const v = valueOf(el);
    setVia("keyboard");
    setActive(v);
    if (opts.select && selected[0] !== v) emit([v]);
    if (opts.extend && !selected.includes(v)) emit([...selected, v]);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const list = enabled();
    if (!list.length) return;
    const current = list.findIndex((o) => valueOf(o) === active);
    const follow = !multiple; // single: selection follows focus
    const go = (i: number) => {
      e.preventDefault();
      move(list[Math.max(0, Math.min(list.length - 1, i))], { select: follow, extend: multiple && e.shiftKey });
    };
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === "ArrowDown") return go(current < 0 ? 0 : current + 1);
    if (e.key === "ArrowUp") return go(current < 0 ? 0 : current - 1);
    if (e.key === "Home") return go(0);
    if (e.key === "End") return go(list.length - 1);
    if ((e.key === " " || e.key === "Enter") && active) {
      e.preventDefault();
      return pick(active, { via: "keyboard", shift: e.shiftKey });
    }
    if (multiple && mod && e.key.toLowerCase() === "a") {
      e.preventDefault();
      const all = list.map(valueOf);
      setVia("keyboard");
      return emit(all.every((v) => selected.includes(v)) ? [] : all);
    }
    // Typeahead: letters build a prefix for half a second; the same letter again cycles its matches.
    if (e.key.length === 1 && !mod && !e.altKey && e.key !== " ") {
      const now = e.timeStamp;
      const t = typed.current;
      t.text = now - t.at > 500 ? e.key : t.text + e.key;
      t.at = now;
      const q = fold(t.text);
      const cycling = q.length > 1 && [...q].every((c) => c === q[0]);
      const needle = cycling ? q[0] : q;
      const label = (o: HTMLElement) => fold(o.dataset.label ?? o.textContent ?? "");
      const start = cycling || q.length === 1 ? current + 1 : Math.max(current, 0);
      const ordered = [...list.slice(start), ...list.slice(0, start)];
      const hit = ordered.find((o) => label(o).startsWith(needle));
      if (hit) {
        e.preventDefault();
        move(hit, { select: follow });
      }
    }
  };

  const ctx: Ctx = { selected, active, focused: activeState, multiple, via, reduce, pick, setActive };

  const hasOptions = !!children && (!Array.isArray(children) || children.length > 0);

  return (
    <ListboxContext value={ctx}>
      <LayoutGroup id={layoutId}>
        <div
          ref={root}
          role="listbox"
          aria-multiselectable={multiple || undefined}
          aria-orientation="vertical"
          // Until a row has been focused, the list itself is the tab stop and hands focus to the
          // first chosen row (or the first row). After that the last focused row keeps it.
          tabIndex={activeState ? -1 : 0}
          onKeyDown={handleKey}
          onFocus={(e) => {
            onFocus?.(e);
            if (e.target !== root.current) return;
            const rows = enabled();
            move(rows.find((o) => selected.includes(valueOf(o))) ?? rows[0]);
          }}
          data-multiple={multiple || undefined}
          className={cn(
            "relative flex flex-col overflow-y-auto overscroll-contain rounded-xl border border-line bg-raised p-1 text-[13px] text-fg shadow-[var(--shadow)] outline-none",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            className,
          )}
          {...rest}
        >
          {hasOptions ? children : <div className="px-3 py-6 text-center text-[12.5px] text-fg-3">{empty ?? "Nothing here yet"}</div>}
        </div>
      </LayoutGroup>
    </ListboxContext>
  );
}

export type ListboxGroupProps = React.ComponentProps<"div"> & { label: React.ReactNode };

/** A labeled section. Its heading sticks to the top while its rows scroll under it. */
export function ListboxGroup({ label, className, children, ...rest }: ListboxGroupProps) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className={cn("flex flex-col not-first:mt-1", className)} {...rest}>
      <div
        id={id}
        role="presentation"
        className="sticky -top-1 z-[2] -mx-1 bg-raised px-3 pt-2 pb-1 font-mono text-2xs tracking-[0.08em] text-fg-3 uppercase select-none"
      >
        {label}
      </div>
      {children}
    </div>
  );
}

export type ListboxItemProps = Omit<React.ComponentProps<"div">, "children"> & {
  value: string;
  children: React.ReactNode;
  /** Used for typeahead when the children aren't plain text. */
  label?: string;
  description?: React.ReactNode;
  /** Right-aligned mono meta: an offset, a count, a shortcut. */
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
};

export function ListboxItem({ value, label, description, hint, icon, disabled, className, children, onClick, onFocus, ...rest }: ListboxItemProps) {
  const ctx = useListbox();
  const isSelected = ctx.selected.includes(value);
  const isActive = ctx.focused === value;
  const instant = ctx.reduce || ctx.via === "keyboard";

  return (
    <div
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled || undefined}
      data-value={value}
      data-label={label ?? (typeof children === "string" ? children : undefined)}
      data-selected={isSelected || undefined}
      data-disabled={disabled || undefined}
      tabIndex={isActive && !disabled ? 0 : -1}
      onClick={(e) => {
        onClick?.(e);
        if (!disabled && !e.defaultPrevented) ctx.pick(value, { via: "pointer", shift: e.shiftKey });
      }}
      onFocus={(e) => {
        onFocus?.(e);
        if (!disabled) ctx.setActive(value);
      }}
      onMouseDown={(e) => e.shiftKey && e.preventDefault() /* no text selection on shift-click */}
      className={cn(
        "group/opt relative isolate flex shrink-0 cursor-default scroll-mt-8 scroll-mb-1 items-center gap-2.5 rounded-lg px-2 outline-none select-none",
        description ? "min-h-11 py-1.5" : "h-8 pointer-coarse:h-10",
        "hover:bg-hover data-disabled:text-fg-4 data-disabled:hover:bg-transparent",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
        // Multiple: neighboring picks merge into one block, corners only at the ends.
        ctx.multiple && "transition-[border-radius] duration-150 ease-out data-selected:bg-line data-selected:hover:bg-line [[data-selected]+&]:data-selected:rounded-t-none [&:has(+[data-selected])]:data-selected:rounded-b-none",
        className,
      )}
      {...rest}
    >
      {/* Single: one pill that slides to whichever row is chosen. Arrow keys move it instantly. */}
      {!ctx.multiple && isSelected && (
        <motion.span
          layoutId="selected"
          aria-hidden
          transition={instant ? { duration: 0 } : spring.snappy}
          className="absolute inset-0 -z-10 rounded-lg bg-line"
        />
      )}
      {ctx.multiple && <Box on={isSelected} reduce={ctx.reduce} />}
      {icon && <span className="relative flex shrink-0 text-fg-3 [&_svg]:size-4">{icon}</span>}
      <span className="relative flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate", !ctx.multiple && isSelected && "font-medium")}>{children}</span>
        {description && <span className="truncate text-[12px] leading-4 text-fg-3">{description}</span>}
      </span>
      {hint && <span className="relative shrink-0 font-mono text-2xs text-fg-3 tabular">{hint}</span>}
      {!ctx.multiple && (
        <span className="relative grid size-4 shrink-0 place-items-center">
          {isSelected && <Tick reduce={ctx.reduce || instant} />}
        </span>
      )}
    </div>
  );
}

const noop = () => () => {};

// The tick draws when a row becomes the choice, but not for the choice already there on page load.
function Tick({ reduce }: { reduce: boolean }) {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" initial={hydrated && !reduce ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 0.22, ease: ease.out, delay: 0.04 }} />
    </svg>
  );
}

function Box({ on, reduce }: { on: boolean; reduce: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative grid size-3.5 shrink-0 place-items-center rounded-[4px] border transition-[background-color,border-color,scale] duration-150 ease-out group-active/opt:scale-[0.88]",
        on ? "border-fg bg-fg text-frame" : "border-line-2 bg-frame group-hover/opt:border-fg-4",
      )}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <motion.path
          d="M2 5.2 4.1 7.2 8 2.8"
          initial={false}
          animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : { pathLength: { duration: 0.2, ease: ease.out }, opacity: { duration: 0.05 } }}
        />
      </svg>
    </span>
  );
}
