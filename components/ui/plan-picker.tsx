"use client";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ArrowDown, ArrowUp, Loader } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type PickerPlan = {
  id: string;
  name: string;
  /** Price per billing cycle. Upgrade or downgrade is decided by comparing prices. */
  price: number;
  description?: React.ReactNode;
  disabled?: boolean;
};

export type PlanChange = "current" | "upgrade" | "downgrade";

export type BillingCycle = {
  /** Days left in the current cycle, including today. */
  daysLeft: number;
  /** Length of the cycle in days. */
  days: number;
  /** When the next cycle starts, already formatted: "Oct 14". */
  renewsOn: string;
};

/** Money owed today when moving from one price to another partway through a cycle. Never negative. */
export function prorate(from: number, to: number, cycle: Pick<BillingCycle, "daysLeft" | "days">) {
  if (to <= from || cycle.days <= 0) return 0;
  return Math.round(((to - from) * Math.min(cycle.daysLeft, cycle.days) * 100) / cycle.days) / 100;
}

export type PlanPickerProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  plans: PickerPlan[];
  /** The plan the account is on now. */
  currentPlan: string;
  /** The chosen plan. Starts on the current plan. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (planId: string) => void;
  cycle: BillingCycle;
  currency?: string;
  locale?: Intl.LocalesArgument;
  /** Unit after each price. */
  interval?: string;
  /** Return a promise to show progress on the button; a rejection is shown under it. */
  onConfirm?: (planId: string, change: Exclude<PlanChange, "current">) => void | Promise<unknown>;
  errorMessage?: React.ReactNode;
  disabled?: boolean;
};

export function PlanPicker({
  plans,
  currentPlan,
  value: valueProp,
  defaultValue,
  onValueChange,
  cycle,
  currency = "USD",
  locale,
  interval = "mo",
  onConfirm,
  errorMessage = "Couldn’t change your plan. You haven’t been charged. Try again.",
  disabled,
  className,
  ...rest
}: PlanPickerProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue: defaultValue ?? currentPlan, onChange: onValueChange });
  const reduce = useReducedMotion();
  const ring = useId();
  const noteId = useId();
  const errorId = useId();
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "failed">("idle");
  const doneTimer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(doneTimer.current), []);

  const loc = locale ?? "en-US";
  const money = (n: number) =>
    new Intl.NumberFormat(loc, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  const current = plans.find((p) => p.id === currentPlan);
  const selected = plans.find((p) => p.id === value) ?? current;
  const changeOf = (p: PickerPlan): PlanChange =>
    !current || p.id === current.id ? "current" : p.price > current.price ? "upgrade" : "downgrade";
  const change = selected ? changeOf(selected) : "current";
  const due = current && selected ? prorate(current.price, selected.price, cycle) : 0;

  const label =
    status === "done"
      ? `Now on ${current?.name ?? ""}`
      : change === "upgrade"
        ? `Upgrade to ${selected?.name}`
        : change === "downgrade"
          ? `Downgrade to ${selected?.name}`
          : "Current plan";

  async function confirm() {
    if (!selected || change === "current" || status === "busy") return;
    setStatus("busy");
    try {
      await onConfirm?.(selected.id, change);
      setStatus("done");
      window.clearTimeout(doneTimer.current);
      doneTimer.current = window.setTimeout(() => setStatus("idle"), 1800);
    } catch {
      setStatus("failed");
    }
  }

  const locked = disabled || status === "busy";

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-3", className)} {...rest}>
      <RadioGroup
        aria-label="Plan"
        aria-describedby={noteId}
        value={value}
        disabled={locked}
        onValueChange={(next) => {
          setValue(next as string);
          if (status !== "busy") setStatus("idle");
        }}
        className="grid gap-2"
      >
        {plans.map((plan) => {
          const kind = changeOf(plan);
          const checked = plan.id === value;
          return (
            <Radio.Root
              key={plan.id}
              value={plan.id}
              disabled={plan.disabled}
              render={<div />}
              data-change={kind}
              className={cn(
                "group/plan relative flex min-w-0 select-none items-start gap-3 rounded-xl border p-3.5 text-left outline-none",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                "transition-[background-color,border-color,scale,opacity] duration-150 ease-out-expo",
                checked ? "border-transparent bg-hover" : "border-line-2 bg-raised",
                "data-disabled:cursor-not-allowed data-disabled:opacity-50",
                "not-data-disabled:motion-safe:active:scale-[0.99] not-data-disabled:active:duration-100",
                !checked && "not-data-disabled:hover:border-fg-4",
              )}
            >
              {checked && (
                <motion.span
                  layoutId={ring}
                  aria-hidden
                  className="pointer-events-none absolute -inset-px rounded-xl border border-fg"
                  transition={reduce ? { duration: 0 } : spring.snappy}
                />
              )}
              <RadioDot checked={checked} reduce={!!reduce} />

              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[13px] font-medium leading-5 tracking-[-0.005em] text-fg">{plan.name}</span>
                  {kind === "current" && (
                    <span className="shrink-0 rounded-full border border-line-2 px-1.5 text-[10.5px] leading-4 text-fg-2">Current</span>
                  )}
                </span>
                {plan.description != null && <span className="text-[12.5px] leading-[18px] text-fg-3">{plan.description}</span>}
              </span>

              <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                <span className="text-[13px] leading-5 text-fg tabular">
                  {money(plan.price)}
                  <span className="text-fg-3">/{interval}</span>
                </span>
                {kind !== "current" && (
                  <span
                    className={cn(
                      "flex items-center gap-1 text-[11.5px] leading-[18px] transition-colors duration-150",
                      checked ? "text-fg-2" : "text-fg-3",
                    )}
                  >
                    {kind === "upgrade" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    {kind === "upgrade" ? "Upgrade" : "Downgrade"}
                  </span>
                )}
              </span>
            </Radio.Root>
          );
        })}
      </RadioGroup>

      {/* What the change costs, in a box that keeps its height as the wording swaps. */}
      <div
        id={noteId}
        aria-live="polite"
        className="relative flex min-h-[78px] items-center gap-3 overflow-hidden rounded-xl border border-line bg-frame px-3.5 py-3"
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={change}
            className="flex min-w-0 flex-1 items-center gap-3"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } }}
            transition={{ duration: reduce ? 0.15 : 0.24, ease: ease.out }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium leading-[18px] text-fg">
                {change === "upgrade" ? "Due today" : change === "downgrade" ? "Nothing due today" : `You’re on ${current?.name ?? "this plan"}`}
              </p>
              <p className="text-[12px] leading-[17px] text-fg-3 text-pretty">
                {change === "upgrade"
                  ? `Prorated for the ${cycle.daysLeft} ${cycle.daysLeft === 1 ? "day" : "days"} left in this cycle, then ${money(selected!.price)}/${interval} from ${cycle.renewsOn}.`
                  : change === "downgrade"
                    ? `${current?.name} stays active until ${cycle.renewsOn}, then ${money(selected!.price)}/${interval}.`
                    : `Renews on ${cycle.renewsOn}. Choose a plan to see what changes.`}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
        {/* The amount stays mounted so moving between two upgrades rolls the number instead of swapping it. */}
        <span
          aria-hidden={change !== "upgrade"}
          className={cn(
            "shrink-0 text-[17px] font-medium tracking-[-0.02em] text-fg transition-opacity duration-150",
            change === "upgrade" ? "opacity-100" : "opacity-0",
          )}
        >
          <NumberFlow value={due} locales={loc} format={{ style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }} className="tabular" />
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={disabled || (change === "current" && status !== "done")}
          aria-busy={status === "busy" || undefined}
          aria-describedby={status === "failed" ? errorId : undefined}
          data-state={status}
          className={cn(
            "relative inline-flex h-9 w-full select-none items-center justify-center overflow-hidden rounded-lg px-3 text-[13px] font-medium tracking-[-0.005em]",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.97] active:duration-75",
            change === "downgrade" && status !== "done"
              ? "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover"
              : "bg-fg text-frame hover:bg-fg/90",
            "disabled:border disabled:border-line disabled:bg-transparent disabled:text-fg-4 disabled:shadow-none",
            (status === "busy" || status === "done") && "pointer-events-none",
          )}
        >
          <span className="relative grid w-full place-items-center">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={status === "busy" ? "busy" : label}
                className="flex items-center gap-1.5 whitespace-nowrap"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(2px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(2px)", transition: { duration: 0.12, ease: ease.in } }}
                transition={{ duration: reduce ? 0.12 : 0.2, ease: ease.out }}
              >
                {status === "busy" ? (
                  <>
                    <Loader size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />
                    <span className="sr-only">Changing plan</span>
                  </>
                ) : (
                  <>
                    {status === "done" && <DrawnCheck reduce={!!reduce} />}
                    {label}
                  </>
                )}
              </motion.span>
            </AnimatePresence>
          </span>
        </button>
        <AnimatePresence initial={false}>
          {status === "failed" && (
            <motion.div
              className="overflow-hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0, transition: { duration: reduce ? 0 : 0.16, ease: ease.inOut } }}
              transition={{ duration: reduce ? 0 : 0.22, ease: ease.inOut }}
            >
              <p id={errorId} role="alert" className="text-center text-[12px] leading-4 text-danger text-balance">
                {errorMessage}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RadioDot({ checked, reduce }: { checked: boolean; reduce: boolean }) {
  return (
    <span className="flex h-5 shrink-0 items-center" aria-hidden>
      <span
        className={cn(
          "grid size-4 place-items-center rounded-full border transition-[background-color,border-color] duration-150",
          checked ? "border-fg bg-fg" : "border-fg-4 bg-raised group-hover/plan:border-fg-3",
        )}
      >
        <motion.span
          className="block size-1.5 rounded-full bg-frame"
          initial={false}
          animate={checked ? { scale: 1, opacity: 1 } : { scale: 0.2, opacity: 0 }}
          transition={
            reduce
              ? { opacity: { duration: 0.12 }, scale: { duration: 0 } }
              : checked
                ? { ...spring.bouncy, opacity: { duration: 0.08 } }
                : { duration: 0.1, ease: ease.in }
          }
        />
      </span>
    </span>
  );
}

function DrawnCheck({ reduce }: { reduce: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <motion.path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.32, ease: ease.out, delay: 0.06 }}
      />
    </svg>
  );
}

