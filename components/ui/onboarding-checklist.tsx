"use client";
import { Accordion } from "@base-ui/react/accordion";
import { Checkbox } from "@base-ui/react/checkbox";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ArrowUpRight, ChevronDown, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type ChecklistTask = {
  id: string;
  title: string;
  description?: React.ReactNode;
  /** What does the task, shown in the open row. Usually a <ChecklistAction>. */
  action?: React.ReactNode;
  /** Rough minutes to finish, summed into “about N min left”. */
  minutes?: number;
  /** Shown with a tag and left out of the progress: the checklist completes without it. */
  optional?: boolean;
};

export type UseChecklistOptions = {
  tasks: ChecklistTask[];
  /** Ids of the finished tasks (controlled). */
  completed?: string[];
  defaultCompleted?: string[];
  onCompletedChange?: (completed: string[]) => void;
};

/** Progress, the next task and the setter, without the card. */
export function useChecklist({ tasks, completed, defaultCompleted = [], onCompletedChange }: UseChecklistOptions) {
  const [done, setDone] = useControllableState<string[]>({ value: completed, defaultValue: defaultCompleted, onChange: onCompletedChange });
  const isDone = (id: string) => done.includes(id);
  const setTask = (id: string, value: boolean) =>
    setDone((prev) => (value ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)));
  const required = tasks.filter((t) => !t.optional);
  const count = required.filter((t) => done.includes(t.id)).length;
  return {
    completed: done,
    isDone,
    setTask,
    /** Finished required tasks. Optional ones never count. */
    count,
    total: required.length,
    complete: required.length > 0 && count === required.length,
    next: tasks.find((t) => !done.includes(t.id))?.id ?? null,
    minutesLeft: required.filter((t) => !done.includes(t.id)).reduce((sum, t) => sum + (t.minutes ?? 0), 0),
  };
}

type RowCtx = { id: string; title: string; done: boolean; setTask: (id: string, value: boolean) => void };
const Row = createContext<RowCtx | null>(null);

export type OnboardingChecklistProps = Omit<React.ComponentProps<"section">, "title"> &
  UseChecklistOptions & {
    title?: React.ReactNode;
    /** Replaces the title once every required task is done. */
    completeTitle?: React.ReactNode;
    /** Controls whether the card is shown. Hiding plays the exit, then onOpenChange(false). */
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** Label of the hide control, used as its accessible name. */
    dismissLabel?: string;
  };

/**
 * The “Get started” card. The next task is open, finishing one ticks it,
 * strikes it through and moves on, and the last one closes the loop with a
 * single quiet beat of the ring.
 */
export function OnboardingChecklist({
  tasks,
  completed,
  defaultCompleted,
  onCompletedChange,
  title = "Get started",
  completeTitle = "You’re all set",
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  dismissLabel = "Hide checklist",
  className,
  ...rest
}: OnboardingChecklistProps) {
  const list = useChecklist({ tasks, completed, defaultCompleted, onCompletedChange });
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const [expanded, setExpanded] = useState<string | null>(() => list.next);
  const reduce = useReducedMotion();
  const titleId = useId();

  // When the open task becomes done (by its checkbox, its action or the parent),
  // hold long enough to see the tick, then move to the next one. Opening another
  // row in the meantime cancels the move.
  const doneKey = list.completed.join("\u0000");
  const prevDone = useRef(list.completed);
  useEffect(() => {
    const was = prevDone.current;
    prevDone.current = list.completed;
    if (!expanded || was.includes(expanded) || !list.completed.includes(expanded)) return;
    const from = tasks.findIndex((t) => t.id === expanded);
    const rest = [...tasks.slice(from + 1), ...tasks.slice(0, from)];
    const next = rest.find((t) => !list.completed.includes(t.id))?.id ?? null;
    const timer = window.setTimeout(() => setExpanded(next), reduce ? 200 : 460);
    return () => window.clearTimeout(timer);
    // doneKey stands in for the array so a parent re-render with equal contents doesn't reset the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneKey, expanded]);

  const left = list.minutesLeft;
  // The resting target is the same with or without reduced motion, so server and client render the same style.
  const swap = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" },
  };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.section
          key="checklist"
          aria-labelledby={titleId}
          data-state={list.complete ? "complete" : "active"}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.16, ease: ease.in } }}
          transition={{ duration: 0.26, ease: ease.out }}
          className={cn(
            "w-full max-w-[400px] origin-top overflow-hidden rounded-xl border border-line bg-raised text-fg shadow-[var(--shadow)]",
            className,
          )}
          {...(rest as React.ComponentProps<typeof motion.section>)}
        >
          <header className="flex items-center gap-3 py-3.5 pl-4 pr-2.5">
            <ProgressRing value={list.total ? list.count / list.total : 0} complete={list.complete} />
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="grid text-[14px] font-medium leading-[1.3] tracking-[-0.015em]">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span key={list.complete ? "done" : "active"} className="col-start-1 row-start-1 truncate" transition={{ duration: 0.24, ease: ease.out }} {...swap}>
                    {list.complete ? completeTitle : title}
                  </motion.span>
                </AnimatePresence>
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-fg-3">
                <span className="tabular">
                  <NumberFlow value={list.count} className="text-fg-2" /> of {list.total} done
                </span>
                {!list.complete && left > 0 && (
                  <>
                    <span aria-hidden className="text-fg-4">·</span>
                    <span className="truncate">about {left} min left</span>
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              aria-label={dismissLabel}
              onClick={() => setOpen(false)}
              className={cn(
                "relative grid size-7 shrink-0 place-items-center self-start rounded-md text-fg-3 outline-none",
                "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
              )}
            >
              <X />
            </button>
          </header>

          <Accordion.Root
            value={expanded ? [expanded] : []}
            onValueChange={(v) => setExpanded((v[0] as string | undefined) ?? null)}
            className="border-t border-line"
          >
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} done={list.isDone(task.id)} setTask={list.setTask} />
            ))}
          </Accordion.Root>

          {/* The one closing beat: a way to put the card away, opening under the list. */}
          <div
            data-open={list.complete ? "" : undefined}
            className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-in-out-quart data-open:grid-rows-[1fr]"
          >
            <div className="min-h-0 overflow-hidden" inert={!list.complete}>
              <div className="flex items-center justify-between gap-3 border-t border-line py-2.5 pl-4 pr-2.5">
                <p className="min-w-0 text-[12.5px] text-fg-2">Everything’s ready to go.</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "inline-flex h-7 shrink-0 items-center rounded-md border border-line-2 bg-raised px-2 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none",
                    "transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75",
                    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                  )}
                >
                  {dismissLabel}
                </button>
              </div>
            </div>
          </div>

          <p role="status" className="sr-only">
            {list.complete ? "All set. Every task is done." : `${list.count} of ${list.total} done`}
          </p>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function TaskRow({ task, done, setTask }: { task: ChecklistTask; done: boolean; setTask: (id: string, value: boolean) => void }) {
  const reduce = useReducedMotion();
  return (
    <Row.Provider value={{ id: task.id, title: task.title, done, setTask }}>
      <Accordion.Item value={task.id} data-done={done ? "" : undefined} className="group/task border-b border-line last:border-b-0">
        <Accordion.Header className="flex items-center pl-4 transition-colors duration-150 hover:bg-hover">
          <Checkbox.Root
            checked={done}
            onCheckedChange={(checked) => setTask(task.id, checked)}
            aria-label={`Mark “${task.title}” as done`}
            className={cn(
              "group/check relative grid size-[18px] shrink-0 place-items-center rounded-full border border-fg-4 text-frame outline-none",
              "transition-[border-color,scale] duration-150 hover:border-fg-3 active:scale-[0.88] active:duration-75",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              "data-checked:border-fg",
              // Draws at 18px, catches a 44px finger.
              "before:absolute before:-inset-3 before:content-[''] pointer-fine:before:-inset-1",
            )}
          >
            {/* The fill grows from the center, then the tick draws over it. */}
            <span
              aria-hidden
              className={cn(
                "absolute inset-[-1px] rounded-full bg-fg transition-[scale,opacity] duration-200 ease-out-expo",
                "scale-50 opacity-0 group-data-checked/check:scale-100 group-data-checked/check:opacity-100",
                "motion-reduce:scale-100",
              )}
            />
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="relative">
              <motion.path
                d="M3.5 8.5 6.5 11.5 12.5 4.5"
                initial={false}
                animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }}
                transition={
                  reduce
                    ? { duration: 0.12 }
                    : done
                      ? { pathLength: { duration: 0.28, ease: ease.out, delay: 0.08 }, opacity: { duration: 0.05, delay: 0.08 } }
                      : { duration: 0.1 }
                }
              />
            </svg>
          </Checkbox.Root>
          <Accordion.Trigger
            className={cn(
              "group/trigger ml-2 flex min-h-11 min-w-0 flex-1 items-center gap-2 mr-1.5 self-stretch rounded-md py-2.5 pl-1.5 pr-2 text-left outline-none",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-fg-3",
            )}
          >
            <span className="relative min-w-0 flex-1">
              <span
                className={cn(
                  "relative inline text-[13px] leading-[1.4] transition-colors duration-200",
                  done ? "text-fg-3" : "text-fg",
                )}
              >
                {task.title}
                {/* A strike that draws left to right, and retracts if the task is unticked. */}
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute left-0 right-0 top-[55%] h-px origin-left bg-current opacity-70",
                    "transition-[scale] duration-300 ease-out-expo motion-reduce:transition-none",
                    done ? "scale-x-100 delay-75" : "scale-x-0",
                  )}
                />
              </span>
            </span>
            {task.optional && (
              <span className="shrink-0 rounded-full border border-line-2 px-1.5 py-px text-[10.5px] leading-[14px] text-fg-3">Optional</span>
            )}
            {task.minutes != null && !done && (
              <span className="tabular shrink-0 text-[11.5px] text-fg-4 max-[360px]:hidden">{task.minutes} min</span>
            )}
            <ChevronDown
              className="shrink-0 text-fg-3 transition-transform duration-200 ease-out-expo group-data-[panel-open]/trigger:rotate-180 motion-reduce:transition-none"
            />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel
          className={cn(
            "h-[var(--accordion-panel-height)] overflow-hidden",
            "transition-[height,opacity] duration-[260ms] ease-in-out-quart",
            "data-starting-style:h-0 data-starting-style:opacity-0 data-ending-style:h-0 data-ending-style:opacity-0 data-ending-style:duration-200",
          )}
        >
          <div className="pb-3.5 pl-12 pr-4">
            {task.description && <p className="text-[12.5px] leading-[1.5] text-fg-2 text-pretty">{task.description}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!done && task.action}
              <button
                type="button"
                onClick={() => setTask(task.id, !done)}
                className={cn(
                  "inline-flex h-7 items-center rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none",
                  "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75",
                  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                )}
              >
                {done ? "Mark as not done" : task.optional ? "Skip" : "Mark as done"}
              </button>
            </div>
          </div>
        </Accordion.Panel>
      </Accordion.Item>
    </Row.Provider>
  );
}

export type ChecklistActionProps = Omit<React.ComponentProps<"button">, "children" | "onClick"> & {
  children: string;
  /** Renders a link instead of a button, for tasks that live on another page. */
  href?: string;
  /** Runs on press. Return a promise to show the busy state; when it resolves the task is marked done. */
  onAction?: () => void | Promise<unknown>;
  /** Shown while the promise runs, e.g. “Connecting…”. */
  pendingLabel?: string;
  /** Shown under the actions when the promise rejects. */
  errorMessage?: string;
  /** Mark the task done when onAction resolves. */
  completes?: boolean;
};

/** The primary action of a task. Knows which task it belongs to, and ticks it off when its work resolves. */
export function ChecklistAction({
  children,
  href,
  onAction,
  pendingLabel,
  errorMessage = "That didn’t go through. Try again.",
  completes = true,
  className,
  disabled,
  ...rest
}: ChecklistActionProps) {
  const row = useContext(Row);
  const reduce = useReducedMotion();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const busy = state === "busy";
  const busyLabel = pendingLabel ?? `${children}…`;
  const style = cn(
    "relative inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-md bg-fg px-2.5 text-[12px] font-medium text-frame shadow-[var(--shadow)] outline-none",
    "transition-[background-color,opacity,scale] duration-150 hover:bg-fg/90 active:scale-[0.97] active:duration-75",
    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
    "disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress aria-busy:active:scale-100",
    className,
  );

  if (href)
    return (
      <a href={href} className={style}>
        {children}
        <ArrowUpRight className="size-3.5 opacity-70" />
      </a>
    );

  const run = async () => {
    if (busy) return;
    const result = onAction?.();
    if (!(result instanceof Promise)) {
      if (completes && row) row.setTask(row.id, true);
      return;
    }
    setState("busy");
    try {
      await result;
      setState("idle");
      if (completes && row) row.setTask(row.id, true);
    } catch {
      setState("failed");
    }
  };

  return (
    <>
      <button type="button" aria-busy={busy || undefined} disabled={disabled} onClick={run} className={style} {...rest}>
        {/* Both labels share one cell, so the button holds the width of the longer. */}
        <span className="grid">
          <span aria-hidden className="invisible col-start-1 row-start-1">{children}</span>
          {onAction && <span aria-hidden className="invisible col-start-1 row-start-1 pl-5">{busyLabel}</span>}
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={busy ? "busy" : "idle"}
              className="col-start-1 row-start-1 flex items-center justify-center gap-1.5"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" }}
              transition={{ duration: reduce ? 0.12 : 0.2, ease: ease.out }}
            >
              {busy && <Spinner />}
              {busy ? busyLabel : children}
            </motion.span>
          </AnimatePresence>
        </span>
      </button>
      {state === "failed" && (
        <p role="alert" className="basis-full text-[12px] leading-[1.45] text-danger">
          {errorMessage}
        </p>
      )}
    </>
  );
}

// Progress as an arc that springs forward. At 100% the arc closes into a
// filled disc and the tick draws: the one moment the card allows itself.
function ProgressRing({ value, complete }: { value: number; complete: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      className="relative grid size-8 shrink-0 place-items-center"
      animate={{ scale: complete ? [1, 1.08, 1] : 1 }}
      transition={reduce ? { duration: 0 } : { duration: 0.42, ease: ease.inOut, delay: 0.3 }}
    >
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="-rotate-90">
        <circle cx="16" cy="16" r="13" stroke="var(--line-2)" strokeWidth="2.5" />
        <motion.circle
          cx="16"
          cy="16"
          r="13"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={false}
          animate={{ pathLength: Math.max(value, 0.001), opacity: value > 0 ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : spring.soft}
        />
      </svg>
      <AnimatePresence initial={false}>
        {complete && (
          <motion.span
            key="disc"
            className="absolute inset-0 grid place-items-center rounded-full bg-fg text-frame"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={reduce ? { duration: 0.15 } : { ...spring.pop, delay: 0.22 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <motion.path
                d="M3.5 8.5 6.5 11.5 12.5 4.5"
                initial={{ pathLength: reduce ? 1 : 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.32, ease: ease.out, delay: 0.36 }}
              />
            </svg>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.span>
  );
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0 animate-[spin_0.7s_linear_infinite]">
      <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.6" />
      <path d="M8 2.25A5.75 5.75 0 0 1 13.75 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
