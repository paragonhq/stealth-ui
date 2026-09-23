"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useId, useState } from "react";
import { cn } from "@/lib/cn";
import { Cart, ChevronDown, Image as ImageIcon } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

type Money = { currency: string; locale: string; total: number };
const MoneyContext = createContext<Money>({ currency: "USD", locale: "en-US", total: 0 });

const format = (amount: number, currency: string) =>
  ({ style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }) as const;

/** Rolling money, pinned to one line height so the digits' mask never moves the row. */
function Amount({ value, className }: { value: number; className?: string }) {
  const { currency, locale } = useContext(MoneyContext);
  return (
    <span className={cn("inline-flex h-[1.4em] items-center", className)}>
      <NumberFlow value={value} locales={locale} format={format(value, currency)} className="tabular leading-none" />
    </span>
  );
}

export type OrderSummaryProps = Omit<React.ComponentProps<"section">, "title"> & {
  /** The grand total, shown in the phone header and in OrderSummaryTotal. */
  total: number;
  currency?: string;
  locale?: string;
  /** Units in the order, shown in the phone header. */
  count?: number;
  title?: string;
  /**
   * "auto" folds the summary behind a header on phones (below 640px) and shows it open on wider
   * screens. true always folds, false never does.
   */
  collapsible?: "auto" | boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function OrderSummary({
  total,
  currency = "USD",
  locale = "en-US",
  count,
  title = "Order summary",
  collapsible = "auto",
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  className,
  children,
  ...rest
}: OrderSummaryProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const id = useId();
  const auto = collapsible === "auto";
  const folds = collapsible !== false;

  return (
    <MoneyContext.Provider value={{ currency, locale, total }}>
      <section
        aria-label={title}
        data-state={open ? "open" : "closed"}
        className={cn("flex flex-col rounded-xl border border-line bg-raised shadow-[var(--shadow)]", className)}
        {...rest}
      >
        {folds && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`${id}-panel`}
            onClick={() => setOpen(!open)}
            className={cn(
              "group/head flex h-12 w-full items-center gap-2.5 rounded-xl px-4 text-left outline-none",
              "transition-colors duration-150 hover:bg-hover/60 active:bg-hover",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
              open && "rounded-b-none",
              auto && "sm:hidden",
            )}
          >
            <Cart size={16} className="shrink-0 text-fg-3" />
            <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-medium text-fg">
              {/* Both labels share a cell, so the chevron doesn't jump when the verb changes. */}
              <span className="grid min-w-0">
                <span aria-hidden className="invisible col-start-1 row-start-1 truncate">Hide order summary</span>
                <span className="col-start-1 row-start-1 truncate">{open ? "Hide order summary" : "Show order summary"}</span>
              </span>
              <ChevronDown size={14} className="shrink-0 text-fg-3 transition-transform duration-200 ease-out-expo group-aria-expanded/head:rotate-180 motion-reduce:transition-none" />
            </span>
            {count != null && <span className="tabular shrink-0 text-[12px] text-fg-3 max-[420px]:hidden">{count === 1 ? "1 item" : `${count} items`}</span>}
            <Amount value={total} className="shrink-0 text-[14px] font-medium text-fg" />
          </button>
        )}
        <div
          id={`${id}-panel`}
          className={cn(
            "grid transition-[grid-template-rows,visibility] duration-300 ease-in-out-quart motion-reduce:transition-none",
            !folds || open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]",
            // On wider screens "auto" is always open, whatever the phone state says.
            auto && "sm:visible sm:grid-rows-[1fr]",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className={cn("flex flex-col gap-3.5 p-4", folds && "border-t border-line", auto && "sm:border-t-0")}>
              {auto && <h2 className="hidden text-[14px] font-medium tracking-[-0.015em] text-fg sm:block">{title}</h2>}
              {children}
            </div>
          </div>
        </div>
      </section>
    </MoneyContext.Provider>
  );
}

export type OrderSummaryItemsProps = React.ComponentProps<"ul">;

export function OrderSummaryItems({ className, children, ...rest }: OrderSummaryItemsProps) {
  return (
    <ul aria-label="Items" className={cn("flex flex-col", className)} {...rest}>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </ul>
  );
}

export type OrderSummaryItemProps = Omit<React.ComponentProps<"li">, "children"> & {
  name: string;
  variant?: string;
  quantity: number;
  /** Unit price; the line shows price × quantity. */
  price: number;
  /** Image URL or any node. */
  image?: string | React.ReactNode;
};

export function OrderSummaryItem({ name, variant, quantity, price, image, className, ...rest }: OrderSummaryItemProps) {
  const reduce = useReducedMotion();
  const [broken, setBroken] = useState(false);
  const [moving, setMoving] = useState(false);
  return (
    <motion.li
      initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={{ duration: 0.26, ease: ease.inOut }}
      // Clipped only while the height moves, so the quantity badge can overhang at rest.
      onAnimationStart={() => setMoving(true)}
      onAnimationComplete={() => setMoving(false)}
      className={cn(moving && "overflow-hidden", className)}
      {...(rest as React.ComponentProps<typeof motion.li>)}
    >
      <div className="flex items-center gap-3 py-1.5">
        <span className="relative shrink-0">
          <span className="grid size-11 place-items-center overflow-hidden rounded-lg border border-line bg-hover text-fg-4">
            {typeof image === "string" && !broken ? (
              // eslint-disable-next-line @next/next/no-img-element -- a copied component can't assume next/image
              <img src={image} alt="" width={44} height={44} loading="lazy" onError={() => setBroken(true)} className="size-full object-cover" />
            ) : typeof image === "string" || image == null ? (
              <ImageIcon size={16} />
            ) : (
              image
            )}
          </span>
          <span
            aria-hidden
            className="tabular absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-fg px-1 text-[10.5px] font-medium text-frame ring-2 ring-raised"
          >
            <NumberFlow value={quantity} className="leading-none" />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-[1.35] text-fg">
            {name}
            <span className="sr-only">, quantity {quantity}</span>
          </p>
          {variant && <p className="truncate text-[12px] text-fg-3">{variant}</p>}
        </div>
        <Amount value={price * quantity} className="shrink-0 text-[13px] text-fg" />
      </div>
    </motion.li>
  );
}

export type OrderSummaryRowsProps = React.ComponentProps<"dl">;

export function OrderSummaryRows({ className, ...rest }: OrderSummaryRowsProps) {
  return <dl className={cn("flex flex-col gap-2 border-t border-line pt-3.5", className)} {...rest} />;
}

export type OrderSummaryRowProps = Omit<React.ComponentProps<"div">, "children"> & {
  label: React.ReactNode;
  /** A small note after the label, like a code or a rate: "SPRING20", "VAT 21%". */
  detail?: React.ReactNode;
  /** The amount. 0 shows freeLabel; null shows pendingLabel. Discounts are negative. */
  amount: number | null;
  /** Show a placeholder while the amount is being worked out. */
  loading?: boolean;
  tone?: "default" | "discount";
  freeLabel?: string;
  pendingLabel?: string;
};

export function OrderSummaryRow({
  label,
  detail,
  amount,
  loading = false,
  tone = "default",
  freeLabel = "Free",
  pendingLabel = "Calculated at next step",
  className,
  ...rest
}: OrderSummaryRowProps) {
  const reduce = useReducedMotion();
  const discount = tone === "discount";
  const state = loading ? "loading" : amount == null ? "pending" : amount === 0 ? "free" : "amount";

  return (
    <div className={cn("flex min-h-5 items-center justify-between gap-4 text-[13px]", className)} {...rest}>
      <dt className="flex min-w-0 items-center gap-2 text-fg-2">
        <span className="shrink-0">{label}</span>
        {detail && (
          <span className={cn("truncate rounded-[4px] px-1.5 py-px font-mono text-[11px] tracking-[0.02em]", discount ? "bg-success-soft text-success" : "bg-hover text-fg-3")}>
            {detail}
          </span>
        )}
      </dt>
      <dd aria-busy={loading || undefined} className={cn("relative flex shrink-0 justify-end", discount ? "text-success" : "text-fg")}>
        {/* Loading, pending and free swap in place; a real amount rolls instead of swapping. */}
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={state}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)", transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: ease.out }}
            className="flex items-center"
          >
            {state === "loading" ? (
              <span className="block h-3 w-12 animate-pulse-soft rounded-[4px] bg-line-2 motion-reduce:animate-none">
                <span className="sr-only">Calculating</span>
              </span>
            ) : state === "pending" ? (
              <span className="text-[12.5px] text-fg-3">{pendingLabel}</span>
            ) : state === "free" ? (
              <span className="font-medium">{freeLabel}</span>
            ) : discount ? (
              <span className="flex items-center">
                −<Amount value={Math.abs(amount ?? 0)} />
              </span>
            ) : (
              <Amount value={amount ?? 0} />
            )}
          </motion.span>
        </AnimatePresence>
      </dd>
    </div>
  );
}

export type OrderSummaryTotalProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The total to show. Defaults to the summary's total. */
  value?: number;
  label?: string;
  /** One quiet line under the total, like "Including €18.80 in VAT". */
  note?: React.ReactNode;
};

export function OrderSummaryTotal({ value, label = "Total", note, className, ...rest }: OrderSummaryTotalProps) {
  const { currency, total } = useContext(MoneyContext);
  return (
    <div className={cn("flex flex-col gap-1 border-t border-line pt-3.5", className)} {...rest}>
      <div className="flex items-center justify-between gap-4">
        <span className="text-[14px] font-medium text-fg">{label}</span>
        <span className="flex items-baseline gap-1.5">
          <span className="font-mono text-2xs text-fg-4">{currency}</span>
          <Amount value={value ?? total} className="text-[17px] font-medium tracking-[-0.015em] text-fg" />
        </span>
      </div>
      {note && <p className="text-[12px] text-fg-3">{note}</p>}
    </div>
  );
}
