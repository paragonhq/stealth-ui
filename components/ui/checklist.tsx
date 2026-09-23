"use client";
import { Checkbox } from "@base-ui/react/checkbox";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ChevronDown, Plus, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  /** Short trailing detail: a due date, an owner, an estimate. */
  meta?: string;
};

export type ChecklistProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "title"> & {
  items?: ChecklistItem[];
  defaultItems?: ChecklistItem[];
  onItemsChange?: (items: ChecklistItem[]) => void;
  /** Heading with the rolling progress count. Without it the list is labeled by aria-label. */
  title?: string;
  /** Move checked tasks into a Completed section below, after the strike has drawn. */
  moveCompleted?: boolean;
  /** Show the inline "Add task" row. */
  allowAdd?: boolean;
  addLabel?: string;
  placeholder?: string;
  /** A remove button on each task (on hover and focus with a mouse, always on touch). */
  removable?: boolean;
  /** Milliseconds between the check and the move, so the strike is seen first. */
  moveDelay?: number;
};

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);

export function Checklist({
  items: itemsProp,
  defaultItems = [],
  onItemsChange,
  title,
  moveCompleted = true,
  allowAdd = true,
  addLabel = "Add task",
  placeholder = "What needs doing?",
  removable = false,
  moveDelay = 450,
  className,
  "aria-label": ariaLabel,
  ref,
  ...rest
}: ChecklistProps) {
  const [items, setItems] = useControllableState({ value: itemsProp, defaultValue: defaultItems, onChange: onItemsChange });
  // While a task waits to move, it is held in the section it was in. Everything else is placed by `done`.
  const [held, setHeld] = useState<Record<string, "open" | "done">>({});
  const [showDone, setShowDone] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const timers = useRef(new Map<string, number>());
  const rootRef = useRef<HTMLDivElement>(null);
  // Our focus management needs the root; the caller's ref still gets it too.
  const setRootRef = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    },
    [ref],
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();
  const titleId = useId();
  const doneId = useId();

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => window.clearTimeout(t));
  }, []);

  const total = items.length;
  const complete = items.filter((i) => i.done).length;
  const section = (i: ChecklistItem) => (moveCompleted ? (held[i.id] ?? (i.done ? "done" : "open")) : "open");
  const open = items.filter((i) => section(i) === "open");
  const done = items.filter((i) => section(i) === "done");

  const focusCheckbox = (id: string | undefined) => {
    const root = rootRef.current;
    if (!root) return;
    const el = id ? root.querySelector<HTMLElement>(`[data-task="${CSS.escape(id)}"] [role=checkbox]`) : root.querySelector<HTMLElement>("[data-add]");
    el?.focus();
  };

  const toggle = (item: ChecklistItem, next: boolean) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: next } : i)));
    setAnnouncement(next ? `Completed ${item.label}` : `Reopened ${item.label}`);
    if (!moveCompleted) return;
    const from = section(item);
    window.clearTimeout(timers.current.get(item.id));
    setHeld((h) => ({ ...h, [item.id]: from }));
    timers.current.set(
      item.id,
      window.setTimeout(() => {
        timers.current.delete(item.id);
        // If the keyboard is still on this task, hand focus to the next open one before it moves away.
        const root = rootRef.current;
        const active = document.activeElement;
        const onIt = !!active && !!root?.querySelector(`[data-task="${CSS.escape(item.id)}"]`)?.contains(active);
        setHeld((h) => {
          const { [item.id]: _gone, ...restHeld } = h;
          void _gone;
          return restHeld;
        });
        if (onIt && next) {
          const list = Array.from(root?.querySelectorAll<HTMLElement>("[data-section=open] [data-task]") ?? []);
          const index = list.findIndex((el) => el.dataset.task === item.id);
          const target = list[index + 1] ?? list[index - 1];
          focusCheckbox(target?.dataset.task);
        } else if (onIt) {
          requestAnimationFrame(() => focusCheckbox(item.id));
        }
      }, reduce ? 150 : moveDelay),
    );
  };

  const remove = (item: ChecklistItem) => {
    // The button under focus is about to disappear: hand focus to the neighbouring task in the
    // same section, or to the add row, so the keyboard user isn't dropped onto the page.
    const root = rootRef.current;
    const rows = Array.from(root?.querySelectorAll<HTMLElement>(`[data-section=${section(item)}] [data-task]`) ?? []);
    const index = rows.findIndex((el) => el.dataset.task === item.id);
    const neighbour = (rows[index + 1] ?? rows[index - 1])?.dataset.task;
    window.clearTimeout(timers.current.get(item.id));
    timers.current.delete(item.id);
    setHeld((h) => {
      if (!(item.id in h)) return h;
      const { [item.id]: _gone, ...restHeld } = h;
      void _gone;
      return restHeld;
    });
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setAnnouncement(`Removed ${item.label}`);
    if (root?.querySelector(`[data-task="${CSS.escape(item.id)}"]`)?.contains(document.activeElement)) {
      requestAnimationFrame(() => focusCheckbox(neighbour));
    }
  };

  const add = () => {
    const label = draft.trim();
    if (!label) return;
    setItems((prev) => [...prev, { id: newId(), label, done: false }]);
    setDraft("");
    setAnnouncement(`Added ${label}`);
  };

  const row = (item: ChecklistItem) => (
    <TaskRow key={item.id} item={item} removable={removable} reduce={!!reduce} onToggle={(v) => toggle(item, v)} onRemove={() => remove(item)} />
  );

  return (
    <div ref={setRootRef} className={cn("flex w-full flex-col", className)} {...rest}>
      {title && (
        <div className="mb-3 flex flex-col gap-2.5 px-2">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id={titleId} className="min-w-0 truncate text-[14px] font-medium tracking-[-0.015em] text-fg">
              {title}
            </h3>
            <span className="tabular shrink-0 text-[12px] text-fg-3">
              <NumberFlow value={complete} className={cn("transition-colors", total > 0 && complete === total ? "text-success" : "text-fg-2")} /> of {total}
            </span>
          </div>
          <div aria-hidden className="h-[3px] overflow-hidden rounded-full bg-line-2">
            <motion.div
              className={cn("h-full origin-left rounded-full transition-colors duration-300", total > 0 && complete === total ? "bg-success" : "bg-fg")}
              initial={false}
              animate={{ scaleX: total ? complete / total : 0 }}
              transition={reduce ? { duration: 0 } : spring.soft}
            />
          </div>
        </div>
      )}

      <LayoutGroup>
        <ul data-section="open" aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : ariaLabel} className="flex flex-col">
          <AnimatePresence initial={false} mode="popLayout">
            {open.map(row)}
          </AnimatePresence>
        </ul>

        {total === 0 && !adding && <p className="px-2 py-1.5 text-[12.5px] text-fg-3">No tasks yet</p>}
        {total > 0 && open.length === 0 && !adding && (
          <motion.p
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: ease.out, delay: 0.1 }}
            className="px-2 py-1.5 text-[12.5px] text-fg-3"
          >
            Everything’s done
          </motion.p>
        )}

        {allowAdd && (
          <motion.div layout={reduce ? false : "position"} transition={spring.soft} className="relative">
            {adding ? (
              <form
                className="flex h-9 items-center gap-2.5 rounded-lg px-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  add();
                }}
              >
                <span aria-hidden className="size-4 shrink-0 rounded-[5px] border border-dashed border-fg-4" />
                <input
                  ref={inputRef}
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setDraft("");
                      setAdding(false);
                      requestAnimationFrame(() => focusCheckbox(undefined));
                    }
                  }}
                  onBlur={() => {
                    if (!draft.trim()) setAdding(false);
                  }}
                  aria-label="New task"
                  placeholder={placeholder}
                  enterKeyHint="done"
                  autoComplete="off"
                  className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]"
                />
                <kbd className="hidden shrink-0 font-mono text-2xs text-fg-4 sm:block">Enter</kbd>
              </form>
            ) : (
              <button
                type="button"
                data-add=""
                onClick={() => setAdding(true)}
                className={cn(
                  "flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] text-fg-3",
                  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
                  "transition-[background-color,color] duration-150 hover:bg-hover hover:text-fg-2 active:bg-hover",
                )}
              >
                <span aria-hidden className="grid size-4 shrink-0 place-items-center">
                  <Plus size={14} />
                </span>
                {addLabel}
              </button>
            )}
          </motion.div>
        )}

        {moveCompleted && done.length > 0 && (
          <motion.div layout={reduce ? false : "position"} transition={spring.soft} className="mt-3 flex flex-col border-t border-line pt-2">
            <button
              type="button"
              aria-expanded={showDone}
              aria-controls={doneId}
              onClick={() => setShowDone((s) => !s)}
              className={cn(
                "flex h-7 items-center gap-1.5 self-start rounded-md px-2 font-mono text-2xs uppercase tracking-[0.08em] text-fg-3",
                "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
                "transition-[color,scale] duration-150 ease-out hover:text-fg-2 active:scale-[0.97] active:duration-75",
              )}
            >
              Completed
              <span className="tabular text-fg-4">
                <NumberFlow value={done.length} />
              </span>
              <ChevronDown size={12} className={cn("transition-transform duration-200 ease-out-expo", !showDone && "-rotate-90")} />
            </button>
            <ul id={doneId} data-section="done" aria-label="Completed" className="flex flex-col">
              <AnimatePresence initial={false} mode="popLayout">
                {showDone && done.map(row)}
              </AnimatePresence>
            </ul>
          </motion.div>
        )}
      </LayoutGroup>

      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}

function TaskRow({
  item,
  removable,
  reduce,
  onToggle,
  onRemove,
  ref,
}: {
  item: ChecklistItem;
  removable: boolean;
  reduce: boolean;
  onToggle: (done: boolean) => void;
  onRemove: () => void;
  ref?: React.Ref<HTMLLIElement>;
}) {
  return (
    <motion.li
      ref={ref}
      layout={reduce ? false : "position"}
      layoutId={reduce ? undefined : item.id}
      data-task={item.id}
      data-state={item.done ? "done" : "open"}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, filter: "blur(2px)", transition: { duration: 0.12 } }}
      transition={reduce ? { duration: 0.15 } : { ...spring.soft, opacity: { duration: 0.2 }, filter: { duration: 0.2 } }}
      className="group/task relative"
    >
      <label className="flex min-h-9 cursor-default items-start gap-2.5 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-hover">
        <Checkbox.Root
          checked={item.done}
          onCheckedChange={(v) => onToggle(v)}
          className={cn(
            "relative mt-px grid size-4 shrink-0 place-items-center rounded-[5px] border",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "transition-[background-color,border-color,scale] duration-150 ease-out active:scale-[0.88] active:duration-75",
            "border-fg-4 bg-raised group-hover/task:border-fg-3 data-checked:border-fg data-checked:bg-fg",
            // 44px touch target around a 16px box.
            "after:absolute after:-inset-3.5 after:content-['']",
          )}
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-3 text-frame" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path
              d="M3.5 8.5 6.5 11.5 12.5 4.5"
              pathLength={1}
              strokeDasharray="1"
              className={cn(
                "transition-[stroke-dashoffset] motion-reduce:transition-none",
                item.done ? "[stroke-dashoffset:0] delay-50 duration-[260ms] ease-out" : "[stroke-dashoffset:1] duration-100 ease-out",
              )}
            />
          </svg>
        </Checkbox.Root>
        <span className="min-w-0 flex-1 text-[13px] leading-[18px]">
          {/* The strike is a 1px background that sweeps left to right, across every wrapped line in reading order. */}
          <span
            className={cn(
              "bg-[linear-gradient(var(--fg-3),var(--fg-3))] bg-no-repeat [background-position:0_55%]",
              "transition-[background-size,color] duration-300 ease-out-expo motion-reduce:transition-colors",
              item.done ? "text-fg-3 [background-size:100%_1px]" : "text-fg [background-size:0%_1px]",
            )}
          >
            {item.label}
          </span>
        </span>
        {item.meta && <span className="tabular mt-px shrink-0 text-[12px] leading-[18px] text-fg-3">{item.meta}</span>}
        {removable && <span aria-hidden className="w-6 shrink-0" />}
      </label>
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.label}`}
          className={cn(
            "absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-md text-fg-4",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
            "transition-[opacity,color,background-color,scale] duration-150 ease-out hover:bg-line hover:text-fg-2 active:scale-[0.9] active:duration-75",
            "opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/task:opacity-100 focus-visible:opacity-100",
          )}
        >
          <X size={14} />
        </button>
      )}
    </motion.li>
  );
}
