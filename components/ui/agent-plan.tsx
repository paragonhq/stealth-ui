"use client";
import { Collapsible } from "@base-ui/react/collapsible";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

export type PlanStepStatus = "pending" | "active" | "done" | "failed" | "skipped";

export type PlanStep = {
  /** Stable across edits, so a renamed step crossfades instead of being replaced. */
  id: string;
  label: React.ReactNode;
  status: PlanStepStatus;
  /** One line under the label: progress while active, the reason when failed. */
  detail?: React.ReactNode;
  substeps?: PlanStep[];
};

export type AgentPlanProps = Omit<React.ComponentProps<"div">, "children" | "title"> & {
  steps: PlanStep[];
  /** What the plan is for. Defaults to “Plan”. */
  title?: React.ReactNode;
  /** The whole plan collapses to its header, which keeps showing the current step. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const spoken: Record<PlanStepStatus, string> = { pending: "to do", active: "in progress", done: "done", failed: "failed", skipped: "skipped" };
const text = (n: React.ReactNode) => (typeof n === "string" || typeof n === "number" ? String(n) : "");

/**
 * A checklist the agent keeps up to date. Pass the whole plan on every change;
 * steps are matched by id, so additions grow in, removals fold away and
 * renamed steps crossfade, while everything else stays put.
 */
export function AgentPlan({ steps, title = "Plan", open, defaultOpen = true, onOpenChange, className, ...rest }: AgentPlanProps) {
  const reduce = useReducedMotion();
  const total = steps.length;
  const done = steps.filter((s) => s.status === "done" || s.status === "skipped").length;
  const activeIndex = steps.findIndex((s) => s.status === "active");
  const failedIndex = steps.findIndex((s) => s.status === "failed");
  const current = activeIndex >= 0 ? steps[activeIndex] : failedIndex >= 0 ? steps[failedIndex] : undefined;
  const complete = total > 0 && done === total;

  // Derived, so it changes exactly when something worth hearing does.
  const announcement = complete
    ? `All ${total} steps done`
    : current
      ? `Step ${steps.indexOf(current) + 1} of ${total} ${current.status === "failed" ? "failed" : "in progress"}${text(current.label) ? `: ${text(current.label)}` : ""}`
      : "";

  return (
    <Collapsible.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={(next) => onOpenChange?.(next)}
      data-state={complete ? "complete" : current?.status === "failed" ? "failed" : current ? "active" : "idle"}
      className={cn("group/plan min-w-0 rounded-xl border border-line bg-raised shadow-[var(--shadow)]", className)}
      {...rest}
    >
      <Collapsible.Trigger
        className={cn(
          "group/trigger relative flex h-11 w-full min-w-0 select-none items-center gap-2.5 rounded-[11px] pl-3 pr-3.5 text-left",
          "touch-manipulation [-webkit-tap-highlight-color:transparent]",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
          "transition-[background-color] duration-150 hover:bg-hover active:bg-fg/[0.06] active:duration-75 data-[panel-open]:rounded-b-none",
        )}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-fg-3 transition-[rotate,color] duration-[240ms] ease-in-out-quart group-hover/trigger:text-fg-2 group-data-[panel-open]/trigger:rotate-90 motion-reduce:transition-none">
          <path d="m6.25 4.5 3.5 3.5-3.5 3.5" />
        </svg>
        <span className="shrink-0 text-[13px] font-medium tracking-[-0.006em] text-fg">{title}</span>

        {/* Closed, the header still says what is happening now. */}
        <span className="relative grid min-w-0 flex-1 overflow-hidden transition-opacity duration-200 group-data-[panel-open]/trigger:opacity-0">
          <AnimatePresence initial={false}>
            {current && (
              <motion.span
                key={current.id + text(current.label)}
                aria-hidden
                className={cn(
                  "col-start-1 row-start-1 truncate text-[12.5px]",
                  current.status === "failed" ? "text-danger" : "text-fg-2",
                )}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } }}
                transition={{ duration: reduce ? 0.15 : 0.24, ease: ease.out }}
              >
                <Sheen active={current.status === "active"}>{current.label}</Sheen>
              </motion.span>
            )}
          </AnimatePresence>
        </span>

        <span className="flex shrink-0 items-center gap-2.5">
          <span className={cn("text-[12px] tabular", complete ? "text-fg-2" : "text-fg-3")}>
            <NumberFlow value={done} />
            <span className="text-fg-4">/</span>
            <NumberFlow value={total} />
          </span>
          <span aria-hidden className="relative h-1 w-10 overflow-hidden rounded-full bg-line-2 max-[360px]:hidden">
            <span
              className={cn("absolute inset-0 origin-left rounded-full transition-[scale,background-color] duration-500 ease-in-out-quart motion-reduce:transition-none", complete ? "bg-success" : "bg-fg-2")}
              style={{ scale: `${total ? done / total : 0} 1` }}
            />
          </span>
        </span>
        <span className="sr-only">
          , {done} of {total} done
        </span>
      </Collapsible.Trigger>

      <Collapsible.Panel
        className={cn(
          "group/panel h-(--collapsible-panel-height) overflow-hidden",
          "transition-[height] duration-[260ms] ease-out-quart data-ending-style:duration-200 data-ending-style:ease-in-out-quart",
          "data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none",
        )}
      >
        <div
          className={cn(
            "border-t border-line px-1.5 pb-2 pt-1.5",
            "transition-[opacity,translate] delay-[50ms] duration-[280ms] ease-out-expo",
            "group-data-[starting-style]/panel:-translate-y-1 group-data-[starting-style]/panel:opacity-0",
            "group-data-[ending-style]/panel:opacity-0 group-data-[ending-style]/panel:delay-0 group-data-[ending-style]/panel:duration-[140ms]",
            "motion-reduce:translate-y-0 motion-reduce:delay-0",
          )}
        >
          {total === 0 ? (
            <p className="px-2 py-2 text-[12.5px] text-fg-3">
              <Sheen active>Drafting a plan</Sheen>
            </p>
          ) : (
            <StepList steps={steps} />
          )}
        </div>
      </Collapsible.Panel>

      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </Collapsible.Root>
  );
}

function StepList({ steps, depth = 0 }: { steps: PlanStep[]; depth?: number }) {
  return (
    <ol className="flex flex-col">
      <AnimatePresence initial={false}>
        {steps.map((step) => (
          <Step key={step.id} step={step} depth={depth} />
        ))}
      </AnimatePresence>
    </ol>
  );
}

function Step({ step, depth }: { step: PlanStep; depth: number }) {
  const reduce = useReducedMotion();
  const { status, label, detail, substeps } = step;
  const hasSubs = !!substeps?.length;
  // Substeps follow the work (open while it's here, folded once it's behind)
  // until someone opens or closes them by hand; then their choice sticks.
  const [override, setOverride] = useState<boolean>();
  const auto = status === "active" || status === "failed";
  const expanded = hasSubs && (override ?? auto);
  const subsDone = substeps?.filter((s) => s.status === "done" || s.status === "skipped").length ?? 0;
  const sub = depth > 0;
  const labelKey = text(label) || step.id;

  const row = (
    <>
      <span className={cn("relative grid shrink-0 place-items-center", sub ? "mt-[3px] size-3.5" : "mt-0.5 size-4")}>
        <AnimatePresence initial={false}>
          <motion.span
            key={status}
            className="absolute inset-0 grid place-items-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.8, transition: { duration: 0.12, ease: ease.in } }}
            transition={reduce ? { duration: 0.15 } : spring.pop}
          >
            <Node status={status} small={sub} reduce={!!reduce} />
          </motion.span>
        </AnimatePresence>
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="grid min-w-0">
          <AnimatePresence initial={false}>
            <motion.span
              key={labelKey}
              className={cn(
                "col-start-1 row-start-1 min-w-0 text-pretty transition-colors duration-300",
                sub ? "text-[12.5px] leading-5" : "text-[13px] leading-5 tracking-[-0.003em]",
                status === "active" || status === "failed" ? "text-fg" : status === "done" ? "text-fg-3" : status === "skipped" ? "text-fg-4 line-through decoration-fg-4" : "text-fg-2",
              )}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 5, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -5, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } }}
              transition={{ duration: reduce ? 0.15 : 0.26, ease: ease.out }}
            >
              <Sheen active={status === "active"}>{label}</Sheen>
            </motion.span>
          </AnimatePresence>
        </span>
        <AnimatePresence initial={false}>
          {detail != null && (status === "active" || status === "failed") && (
            <motion.span
              key="detail"
              className="overflow-hidden"
              initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.16, ease: ease.in } }}
              transition={{ duration: reduce ? 0.15 : 0.24, ease: ease.out }}
            >
              <span className="grid">
                <AnimatePresence initial={false}>
                  <motion.span
                    key={text(detail) || "d"}
                    className={cn("col-start-1 row-start-1 text-pretty text-[12px] leading-[18px]", status === "failed" ? "text-danger" : "text-fg-3")}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    transition={{ duration: 0.2 }}
                  >
                    {detail}
                  </motion.span>
                </AnimatePresence>
              </span>
            </motion.span>
          )}
        </AnimatePresence>
      </span>

      {hasSubs && (
        <span className="mt-0.5 flex shrink-0 items-center gap-1 text-[11.5px] tabular text-fg-3">
          {subsDone}/{substeps!.length}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cn("text-fg-4 transition-[rotate,color] duration-[240ms] ease-in-out-quart group-hover/row:text-fg-2 motion-reduce:transition-none", expanded && "rotate-180")}>
            <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
          </svg>
        </span>
      )}
      <span className="sr-only">, {spoken[status]}</span>
    </>
  );

  const rowClass = cn("group/row relative flex w-full min-w-0 items-start gap-2.5 rounded-md px-2 text-left", sub ? "py-[3px]" : "py-1.5");

  return (
    <motion.li
      data-status={status}
      aria-current={status === "active" ? "step" : undefined}
      className="relative"
      initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, height: 0, x: -4, transition: { duration: 0.2, ease: ease.in } }}
      transition={{ duration: reduce ? 0.15 : 0.28, ease: ease.out }}
    >
      {/* A step the agent added mid-run keeps a soft wash for a moment so the edit can be found. */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-md bg-fg/[0.06]"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.8, delay: 1, ease: ease.outQuart }}
      />
      {hasSubs ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setOverride(!expanded)}
          className={cn(
            rowClass,
            "touch-manipulation outline-none transition-[background-color] duration-150 hover:bg-hover active:bg-fg/[0.06] active:duration-75",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
          )}
        >
          {row}
        </button>
      ) : (
        <div className={rowClass}>{row}</div>
      )}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="subs"
            className="overflow-hidden"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.2, ease: ease.inOut } }}
            transition={{ duration: reduce ? 0.15 : 0.28, ease: ease.out }}
          >
            <div className="pb-1 pl-[26px]">
              <StepList steps={substeps!} depth={depth + 1} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

const glyph = { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

function Node({ status, small, reduce }: { status: PlanStepStatus; small: boolean; reduce: boolean }) {
  // Identical attributes with and without reduced motion, so server and client agree.
  const draw = (delay = 0.08) => ({
    initial: { pathLength: reduce ? 1 : 0 },
    animate: { pathLength: 1 },
    transition: reduce ? { duration: 0 } : { duration: 0.3, ease: ease.out, delay },
  });
  const size = small ? "size-3.5" : "size-4";
  if (status === "done")
    return (
      <span className={cn("grid place-items-center rounded-full bg-fg text-frame", size)}>
        <svg {...glyph} className={small ? "size-2.5" : "size-3"}>
          <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" {...draw()} />
        </svg>
      </span>
    );
  if (status === "failed")
    return (
      <span className={cn("grid place-items-center rounded-full bg-danger text-frame", size)}>
        <svg {...glyph} className={small ? "size-2.5" : "size-3"}>
          <motion.path d="m5 5 6 6" {...draw()} />
          <motion.path d="m11 5-6 6" {...draw(0.16)} />
        </svg>
      </span>
    );
  if (status === "active")
    return (
      <span className={cn("relative grid place-items-center", size)}>
        <svg viewBox="0 0 16 16" fill="none" aria-hidden className={cn("absolute inset-0 animate-spin [animation-duration:0.9s]", size)}>
          <circle cx="8" cy="8" r="6.75" stroke="var(--line-2)" strokeWidth="1.5" />
          <path d="M8 1.25A6.75 6.75 0 0 1 14.75 8" stroke="var(--fg)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    );
  if (status === "skipped") return <span className={cn("rounded-full border border-dashed border-fg-4", size)} />;
  return <span className={cn("rounded-full border-[1.5px] border-line-2", small ? "size-3" : "size-3.5")} />;
}

// The sheen marks work in progress and nothing else. Reduced motion keeps the plain label.
function Sheen({ active, children }: { active: boolean; children: React.ReactNode }) {
  if (!active) return <>{children}</>;
  return (
    <span
      className={cn(
        "bg-[linear-gradient(90deg,var(--fg-2)_0%,var(--fg-2)_40%,var(--fg)_50%,var(--fg-2)_60%,var(--fg-2)_100%)]",
        "animate-shine bg-clip-text [background-size:250%_100%] [-webkit-box-decoration-break:clone] [box-decoration-break:clone] [-webkit-text-fill-color:transparent] rtl:[animation-direction:reverse]",
        "motion-reduce:animate-none motion-reduce:bg-none motion-reduce:[-webkit-text-fill-color:currentColor]",
      )}
    >
      {children}
    </span>
  );
}
