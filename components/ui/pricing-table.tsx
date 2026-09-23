"use client";
import { Popover } from "@base-ui/react/popover";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { Check, Loader, Minus } from "@/lib/icons";
import { ease } from "@/lib/motion";

export type BillingPeriod = "monthly" | "yearly";

export type PricingFeature =
  | string
  | {
      label: React.ReactNode;
      /** One or two sentences explaining the feature, opened from the label on hover, focus or tap. */
      hint?: React.ReactNode;
      /** false draws it struck from the plan. Defaults to true. */
      included?: boolean;
    };

export type PricingPlan = {
  id: string;
  name: string;
  description?: React.ReactNode;
  /** Monthly price, and the price of a whole year up front. null for plans priced by sales. */
  price: { monthly: number; yearly: number } | null;
  /** Shown instead of a number when price is null. */
  priceLabel?: React.ReactNode;
  /** Beside the price, e.g. "per seat / month". */
  unit?: React.ReactNode;
  /** Replaces the billing line under the price, e.g. "Free forever". */
  billingNote?: React.ReactNode;
  cta: string;
  /** A heading over the features, like "Everything in Pro, plus". */
  featuresIntro?: React.ReactNode;
  features: PricingFeature[];
  recommended?: boolean;
  /** Pill beside the name. Defaults to "Recommended" on the recommended plan. */
  badge?: React.ReactNode;
};

export type PricingTableProps = Omit<React.ComponentProps<"ul">, "children"> & {
  plans: PricingPlan[];
  period?: BillingPeriod;
  currency?: string;
  locale?: Intl.LocalesArgument;
  /** The plan the viewer is on. Its button reads "Current plan" and is disabled. */
  currentPlan?: string;
  /** Return a promise and the button shows it is working until it settles; a rejection is shown under the button. */
  onSelectPlan?: (planId: string, period: BillingPeriod) => void | Promise<unknown>;
  /** Shown under the button when onSelectPlan rejects. */
  errorMessage?: React.ReactNode;
};

// NumberFlow runs on the Web Animations API, which wants the curve as a string.
const roll = { duration: 620, easing: `cubic-bezier(${ease.out.join(",")})` };

export function PricingTable({
  plans,
  period = "monthly",
  currency = "USD",
  locale,
  currentPlan,
  onSelectPlan,
  errorMessage = "Couldn’t start checkout. Try again.",
  className,
  style,
  ...rest
}: PricingTableProps) {
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function select(id: string) {
    if (pending) return;
    setFailed(null);
    const result = onSelectPlan?.(id, period);
    if (!(result instanceof Promise)) return;
    setPending(id);
    try {
      await result;
    } catch {
      setFailed(id);
    } finally {
      setPending(null);
    }
  }

  return (
    // Columns come from the container, not the viewport, so the table works in a sidebar or a modal.
    <div className="@container w-full">
      <ul
        data-period={period}
        style={{ "--plans": plans.length, ...style } as React.CSSProperties}
        className={cn("grid grid-cols-1 gap-3 @2xl:grid-cols-[repeat(var(--plans),minmax(0,1fr))] @2xl:gap-x-3 @2xl:gap-y-0", className)}
        {...rest}
      >
        {plans.map((plan, i) => (
          <PlanColumn
            key={plan.id}
            plan={plan}
            index={i}
            period={period}
            currency={currency}
            locale={locale}
            current={plan.id === currentPlan}
            pending={pending === plan.id}
            locked={pending != null && pending !== plan.id}
            failed={failed === plan.id}
            errorMessage={errorMessage}
            onSelect={() => select(plan.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function PlanColumn({
  plan,
  index,
  period,
  currency,
  locale,
  current,
  pending,
  locked,
  failed,
  errorMessage,
  onSelect,
}: {
  plan: PricingPlan;
  index: number;
  period: BillingPeriod;
  currency: string;
  locale?: Intl.LocalesArgument;
  current: boolean;
  pending: boolean;
  locked: boolean;
  failed: boolean;
  errorMessage: React.ReactNode;
  onSelect: () => void;
}) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const errorId = useId();
  const yearly = period === "yearly";
  const { price } = plan;
  const perMonth = price ? (yearly ? price.yearly / 12 : price.monthly) : 0;
  const free = price != null && price.monthly === 0 && price.yearly === 0;
  const saves = price != null && !free && price.yearly < price.monthly * 12;
  // A fixed default locale, so the server and the browser print the same price.
  const loc = locale ?? "en-US";
  const money = (n: number) =>
    new Intl.NumberFormat(loc, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  const badge = plan.badge ?? (plan.recommended ? "Recommended" : null);

  // The billing line changes with the period; keyed so it can swap in place.
  const note: { key: string; node: React.ReactNode } = plan.billingNote
    ? { key: "note", node: plan.billingNote }
    : !price
      ? { key: "custom", node: "Billed annually, by invoice" }
      : free
        ? { key: "free", node: "Free forever" }
        : yearly
          ? {
              key: "yearly",
              node: (
                <>
                  {saves && <Struck reduce={!!reduce}>{money(price.monthly * 12)}</Struck>}
                  <span className="tabular">{money(price.yearly)}</span> billed yearly
                </>
              ),
            }
          : { key: "monthly", node: "Billed monthly" };

  return (
    <li
      aria-labelledby={titleId}
      data-recommended={plan.recommended || undefined}
      data-current={current || undefined}
      className={cn(
        "relative flex min-w-0 flex-col rounded-xl border p-4",
        "@2xl:row-span-4 @2xl:grid @2xl:grid-rows-subgrid @2xl:gap-0",
        plan.recommended ? "border-line-2 bg-raised shadow-[var(--shadow)]" : "border-line bg-frame",
      )}
    >
      {/* Name, badge, description */}
      <div className="flex min-w-0 flex-col gap-1 pb-4">
        <div className="flex min-h-5 items-center justify-between gap-2">
          <h3 id={titleId} className="truncate text-[14px] font-medium tracking-[-0.015em] text-fg">
            {plan.name}
          </h3>
          {badge != null && (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 text-[10.5px] font-medium leading-[18px]",
                plan.recommended ? "bg-fg text-frame" : "border border-line-2 text-fg-2",
              )}
            >
              {badge}
            </span>
          )}
        </div>
        {plan.description != null && <p className="text-[12.5px] leading-[18px] text-fg-3 text-pretty">{plan.description}</p>}
      </div>

      {/* Price and the billing line under it */}
      <div className="flex flex-col gap-1.5 pb-4">
        <div className="flex min-h-9 flex-wrap items-baseline gap-x-1.5">
          {price ? (
            <NumberFlow
              value={perMonth}
              locales={loc}
              format={{ style: "currency", currency, maximumFractionDigits: perMonth % 1 ? 2 : 0 }}
              // Columns roll one after another, left to right, so the eye can follow the change across.
              transformTiming={{ ...roll, delay: index * 45 }}
              spinTiming={{ ...roll, delay: index * 45 }}
              className="text-[30px] font-medium leading-9 tracking-[-0.035em] text-fg"
            />
          ) : (
            <span className="text-[30px] font-medium leading-9 tracking-[-0.035em] text-fg">{plan.priceLabel ?? "Custom"}</span>
          )}
          {price && !free && plan.unit != null && <span className="text-[12px] text-fg-3">{plan.unit}</span>}
        </div>
        <p className="relative h-[18px] overflow-hidden text-[12px] leading-[18px] text-fg-3">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={note.key}
              className="absolute inset-x-0 top-0 truncate whitespace-nowrap"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } }}
              transition={{ duration: reduce ? 0.15 : 0.24, ease: ease.out }}
            >
              {note.node}
            </motion.span>
          </AnimatePresence>
        </p>
      </div>

      {/* The action */}
      <div className="flex flex-col pb-5">
        <button
          type="button"
          onClick={onSelect}
          disabled={current || locked}
          aria-busy={pending || undefined}
          aria-describedby={failed ? errorId : undefined}
          data-variant={plan.recommended ? "primary" : "secondary"}
          className={cn(
            "relative inline-flex h-9 w-full select-none items-center justify-center rounded-lg px-3 text-[13px] font-medium tracking-[-0.005em]",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "transition-[background-color,border-color,color,scale,opacity] duration-150 ease-out active:scale-[0.97] active:duration-75",
            plan.recommended
              ? "bg-fg text-frame hover:bg-fg/90"
              : "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover",
            current && "border-line bg-transparent text-fg-3 shadow-none hover:border-line hover:bg-transparent",
            locked && !current && "opacity-50",
            "disabled:pointer-events-none",
            pending && "pointer-events-none",
          )}
        >
          <span className={cn("flex items-center gap-1.5 transition-opacity duration-150", pending && "opacity-0")}>
            {current && <Check size={14} />}
            {current ? "Current plan" : plan.cta}
          </span>
          {pending && (
            <span className="absolute inset-0 grid place-items-center" aria-hidden>
              <Loader size={16} className="animate-spin motion-reduce:animate-none" />
            </span>
          )}
        </button>
        <AnimatePresence initial={false}>
          {failed && (
            // Height opens with the message so the features below slide down instead of jumping.
            <motion.div
              className="overflow-hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0, transition: { duration: reduce ? 0 : 0.16, ease: ease.inOut } }}
              transition={{ duration: reduce ? 0 : 0.22, ease: ease.inOut, opacity: { duration: 0.18 } }}
            >
              <p id={errorId} role="alert" className="pt-2 text-center text-[12px] leading-4 text-danger text-balance">
                {errorMessage}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* What is in it */}
      <div className="flex min-w-0 flex-col gap-2.5 border-t border-line pt-4">
        {plan.featuresIntro != null && <p className="text-[12px] font-medium text-fg-2">{plan.featuresIntro}</p>}
        <ul className="flex flex-col gap-2" aria-label={`${plan.name} features`}>
          {plan.features.map((f, i) => (
            <FeatureRow key={i} feature={f} />
          ))}
        </ul>
      </div>
    </li>
  );
}

function FeatureRow({ feature }: { feature: PricingFeature }) {
  const f = typeof feature === "string" ? { label: feature } : feature;
  const included = f.included !== false;

  return (
    <li className={cn("flex min-w-0 items-start gap-2 text-[12.5px] leading-[18px]", included ? "text-fg-2" : "text-fg-4")}>
      <span className="flex h-[18px] shrink-0 items-center">
        {included ? <Check size={14} className="text-fg" /> : <Minus size={14} />}
      </span>
      <span className="min-w-0">
        {!included && <span className="sr-only">Not included: </span>}
        {f.hint != null ? <FeatureHint hint={f.hint}>{f.label}</FeatureHint> : f.label}
      </span>
    </li>
  );
}

// An infotip, not a tooltip: it opens on hover after a short delay, and also on
// focus and tap, so touch and screen reader users get the explanation too.
function FeatureHint({ hint, children }: { hint: React.ReactNode; children: React.ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={350}
        closeDelay={80}
        className={cn(
          "cursor-help rounded-[3px] text-left underline decoration-fg-4 decoration-dotted underline-offset-[3px]",
          "transition-[color,text-decoration-color] duration-150 hover:text-fg hover:decoration-fg-3 data-popup-open:text-fg data-popup-open:decoration-fg-3",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        )}
      >
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" align="start" sideOffset={6} collisionPadding={12} className="z-(--z-popover)">
          <Popover.Popup
            className={cn(
              "max-w-[240px] rounded-lg border border-line-2 bg-raised px-2.5 py-2 text-[12px] leading-[17px] text-fg-2 shadow-pop outline-none",
              "origin-(--transform-origin) transition-[opacity,scale,translate] duration-150 ease-out-expo",
              "data-starting-style:translate-y-0.5 data-starting-style:scale-96 data-starting-style:opacity-0",
              "data-ending-style:opacity-0 data-ending-style:duration-100",
              "motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:scale-100",
            )}
          >
            {hint}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

// The full-year price, struck through by a line that draws across it.
function Struck({ reduce, children }: { reduce: boolean; children: React.ReactNode }) {
  return (
    <s className="relative mr-1.5 text-fg-4 no-underline tabular">
      <span className="sr-only">was </span>
      {children}
      <motion.span
        aria-hidden
        className="absolute inset-x-[-1px] top-1/2 h-px origin-left bg-fg-3"
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.32, ease: ease.out, delay: 0.14 }}
      />
    </s>
  );
}
