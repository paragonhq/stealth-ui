"use client";
import { Drawer } from "@base-ui/react/drawer";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { cn } from "@/lib/cn";
import { ArrowRight, Cart, Check, Image as ImageIcon, Loader, X } from "@/lib/icons";
import { ease } from "@/lib/motion";

type Money = { currency: string; locale: string };
const MoneyContext = createContext<Money>({ currency: "USD", locale: "en-US" });

/** Formats an amount in the drawer's currency. Whole amounts drop the ".00". */
export function useMoney() {
  const { currency, locale } = useContext(MoneyContext);
  return (amount: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
}

function moneyFormat(amount: number, currency: string) {
  return { style: "currency", currency, minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 } as const;
}

export type CartDrawerProps = Omit<Drawer.Root.Props, "swipeDirection" | "snapPoints" | "snapPoint" | "defaultSnapPoint" | "onSnapPointChange"> & {
  /** ISO currency code for every amount inside. */
  currency?: string;
  /** Locale for number formatting. Set it explicitly so server and client agree. */
  locale?: string;
};

/** The cart as a slide-over from the right edge. Swipe right to dismiss on touch. */
export function CartDrawer({ currency = "USD", locale = "en-US", ...rest }: CartDrawerProps) {
  return (
    <MoneyContext.Provider value={{ currency, locale }}>
      <Drawer.Root swipeDirection="right" {...rest} />
    </MoneyContext.Provider>
  );
}

export type CartDrawerTriggerProps = Drawer.Trigger.Props;
export function CartDrawerTrigger(props: CartDrawerTriggerProps) {
  return <Drawer.Trigger {...props} />;
}

export type CartDrawerCloseProps = Omit<Drawer.Close.Props, "className"> & { className?: string };
/** A secondary button that closes the drawer, e.g. "Continue shopping". */
export function CartDrawerClose({ className, ...rest }: CartDrawerCloseProps) {
  return (
    <Drawer.Close
      className={cn(
        "inline-flex h-8 select-none items-center justify-center gap-2 rounded-lg border border-line-2 bg-raised px-3 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] outline-none",
        "transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        className,
      )}
      {...rest}
    />
  );
}

export type CartDrawerContentProps = Omit<Drawer.Popup.Props, "className" | "style" | "title"> & {
  className?: string;
  style?: React.CSSProperties;
  /** Render into this element instead of document.body. Backdrop and panel become absolute to it. */
  container?: Drawer.Portal.Props["container"];
  title?: React.ReactNode;
  /** Units in the cart, shown and rolled beside the title. */
  count?: number;
};

export function CartDrawerContent({ container, title = "Cart", count, className, style, children, ...rest }: CartDrawerContentProps) {
  const contained = container != null;
  return (
    <Drawer.Portal container={container}>
      <Drawer.Backdrop
        className={cn(
          contained ? "absolute" : "fixed",
          "inset-0 z-(--z-overlay) bg-overlay",
          "opacity-[calc(1-var(--drawer-swipe-progress,0))] transition-opacity duration-300 ease-drawer",
          "data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-200 data-swiping:duration-0",
        )}
      />
      <Drawer.Viewport className={cn(contained ? "absolute" : "fixed", "inset-0 z-(--z-dialog) flex justify-end p-2")}>
        <Drawer.Popup
          style={style}
          className={cn(
            "relative flex h-full w-[400px] max-w-full flex-col overflow-hidden rounded-2xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
            // Slides in on the drawer curve, follows the finger 1:1, and a flick shortens the exit.
            "[transform:translateX(var(--drawer-swipe-movement-x,0px))] transition-transform duration-[340ms] ease-drawer data-swiping:duration-0 data-swiping:select-none",
            "data-starting-style:[transform:translateX(calc(100%+8px))] data-ending-style:[transform:translateX(calc(100%+8px))]",
            "data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*240ms)]",
            className,
          )}
          {...rest}
        >
          <div className="flex h-13 shrink-0 items-center gap-2 border-b border-line pl-4 pr-2.5">
            <Drawer.Title className="text-[14px] font-medium tracking-[-0.015em] text-fg">{title}</Drawer.Title>
            {count != null && count > 0 && (
              <span className="tabular grid h-5 min-w-5 place-items-center rounded-full bg-hover px-1.5 text-[11px] font-medium text-fg-2">
                <NumberFlow value={count} className="leading-none" />
                <span className="sr-only">{count === 1 ? " item" : " items"}</span>
              </span>
            )}
            <Drawer.Close
              aria-label="Close cart"
              className={cn(
                "relative ml-auto grid size-8 place-items-center rounded-lg text-fg-3 outline-none",
                "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                "before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden",
              )}
            >
              <X />
            </Drawer.Close>
          </div>
          <Drawer.Content className="flex min-h-0 flex-1 flex-col">{children}</Drawer.Content>
        </Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  );
}

export type CartLinesProps = React.ComponentProps<"ul">;

/** The scrolling list of lines. Hairlines appear at the edges only when there is more to scroll. */
export function CartLines({ className, children, ...rest }: CartLinesProps) {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const top = el.scrollTop > 1;
      const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
      setEdges((e) => (e.top === top && e.bottom === bottom ? e : { top, bottom }));
    };
    // Lines grow and collapse without scrolling, so watch their sizes too.
    const ro = new ResizeObserver(read);
    const watch = () => {
      ro.disconnect();
      ro.observe(el);
      for (const c of el.children) ro.observe(c);
      read();
    };
    const mo = new MutationObserver(watch);
    mo.observe(el, { childList: true });
    watch();
    el.addEventListener("scroll", read, { passive: true });
    return () => {
      el.removeEventListener("scroll", read);
      mo.disconnect();
      ro.disconnect();
    };
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <span aria-hidden className={cn("pointer-events-none absolute inset-x-0 top-0 z-1 h-px bg-line transition-opacity duration-150", edges.top ? "opacity-100" : "opacity-0")} />
      <ul
        ref={ref}
        aria-label="Items in your cart"
        className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-8 pt-1.5", className)}
        {...rest}
      >
        <AnimatePresence initial={false}>{children}</AnimatePresence>
      </ul>
      <span aria-hidden className={cn("pointer-events-none absolute inset-x-0 bottom-0 z-1 h-px bg-line transition-opacity duration-150", edges.bottom ? "opacity-100" : "opacity-0")} />
    </div>
  );
}

export type CartLineProps = Omit<React.ComponentProps<"li">, "onChange"> & {
  name: string;
  /** Size, colour and other options, as one short line. */
  variant?: string;
  /** Unit price. The line shows the total and, above 1, the unit price. */
  price: number;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  /** An image URL, or any node (a thumbnail component). */
  image?: string | React.ReactNode;
  /** Units available. */
  max?: number;
  /** Price before a sale, struck through beside the total. */
  compareAt?: number;
};

export function CartLine({ name, variant, price, quantity, onQuantityChange, onRemove, image, max, compareAt, className, ...rest }: CartLineProps) {
  const { currency, locale } = useContext(MoneyContext);
  const money = useMoney();
  const reduce = useReducedMotion();
  const [moving, setMoving] = useState(false);
  const total = price * quantity;

  return (
    <motion.li
      // Collapse on remove: the rows below close the gap instead of jumping.
      initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, filter: "blur(2px)" }}
      transition={{ duration: 0.26, ease: ease.inOut }}
      // Clipped only while the height moves, so the stock hint can overhang the row at rest.
      onAnimationStart={() => setMoving(true)}
      onAnimationComplete={() => setMoving(false)}
      className={cn("relative", moving && "overflow-hidden", className)}
      {...(rest as React.ComponentProps<typeof motion.li>)}
    >
      <div className="flex gap-3 rounded-xl px-2 py-2.5">
        <Thumb image={image} name={name} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium leading-[1.35] text-fg">{name}</p>
              {variant && <p className="truncate text-[12px] text-fg-3">{variant}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end">
              {/* Fixed height: the rolling digits carry their own mask padding, which must not move the row. */}
              <span className="flex h-[18px] items-center">
                <NumberFlow value={total} locales={locale} format={moneyFormat(total, currency)} className="tabular text-[13px] font-medium leading-none text-fg" />
              </span>
              {/* Always one line tall, so the stepper row never moves when "each" appears. */}
              <span className="tabular h-4 text-[11.5px] leading-4 text-fg-4">
                {compareAt != null && compareAt > price ? (
                  <s className="decoration-fg-4">{money(compareAt * quantity)}</s>
                ) : quantity > 1 ? (
                  `${money(price)} each`
                ) : null}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <QuantityStepper
              size="sm"
              value={quantity}
              onValueChange={onQuantityChange}
              max={max}
              label={`Quantity of ${name}`}
              onRemove={onRemove}
              removeLabel={`Remove ${name}`}
              hintSide="bottom"
            />
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${name}`}
              className={cn(
                "relative rounded-sm text-[12px] text-fg-3 outline-none transition-colors duration-150 hover:text-fg",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                "before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] pointer-fine:before:hidden",
              )}
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </motion.li>
  );
}

function Thumb({ image, name }: { image: CartLineProps["image"]; name: string }) {
  const [failed, setFailed] = useState(false);
  const frame = "relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-hover text-fg-4";
  if (typeof image === "string" && !failed)
    return (
      <span className={frame}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a copied component can't assume next/image */}
        <img src={image} alt={name} width={64} height={64} loading="lazy" onError={() => setFailed(true)} className="size-full object-cover" />
      </span>
    );
  return (
    <span aria-hidden className={frame}>
      {typeof image === "string" || image == null ? <ImageIcon size={18} /> : image}
    </span>
  );
}

export type CartShippingProgressProps = React.ComponentProps<"div"> & {
  subtotal: number;
  /** Subtotal at which shipping becomes free. */
  threshold: number;
};

/** "€23 away from free shipping", with a bar that fills as the cart grows. */
export function CartShippingProgress({ subtotal, threshold, className, ...rest }: CartShippingProgressProps) {
  const { currency, locale } = useContext(MoneyContext);
  const reduce = useReducedMotion();
  const left = Math.max(0, threshold - subtotal);
  const done = left === 0;
  const progress = Math.min(1, subtotal / threshold);

  return (
    <div className={cn("flex flex-col gap-2", className)} {...rest}>
      <p className="flex h-4 items-center gap-1.5 text-[12px] text-fg-2" aria-live="polite">
        <AnimatePresence initial={false} mode="popLayout">
          {done ? (
            <motion.span
              key="done"
              className="flex items-center gap-1.5 text-fg"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.24, ease: ease.out }}
            >
              <Check size={14} className="text-success" />
              Free shipping unlocked
            </motion.span>
          ) : (
            <motion.span
              key="left"
              className="flex items-center"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.24, ease: ease.out }}
            >
              <NumberFlow value={left} locales={locale} format={moneyFormat(left, currency)} className="tabular font-medium text-fg" />
              <span>&nbsp;away from free shipping</span>
            </motion.span>
          )}
        </AnimatePresence>
      </p>
      <div
        role="progressbar"
        aria-label="Progress to free shipping"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className="h-1 overflow-hidden rounded-full bg-hover"
      >
        <div
          className={cn(
            "h-full origin-left rounded-full transition-[transform,background-color] duration-500 ease-out-expo",
            done ? "bg-success" : "bg-fg",
          )}
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </div>
  );
}

export type CartSummaryProps = Omit<React.ComponentProps<"div">, "children"> & {
  subtotal: number;
  /** One quiet line under the subtotal. */
  note?: React.ReactNode;
  /** Runs on Check out. Return a promise to show the busy state on the button. */
  onCheckout?: () => void | Promise<unknown>;
  checkoutLabel?: string;
  /** Anything above the totals, like CartShippingProgress. */
  children?: React.ReactNode;
};

export function CartSummary({ subtotal, note = "Shipping and taxes are calculated at checkout.", onCheckout, checkoutLabel = "Check out", className, children, ...rest }: CartSummaryProps) {
  const { currency, locale } = useContext(MoneyContext);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div className={cn("flex shrink-0 flex-col gap-3 border-t border-line px-4 pb-4 pt-3.5", className)} {...rest}>
      {children}
      <div className="flex h-5 items-center justify-between">
        <span className="text-[13px] text-fg-2">Subtotal</span>
        <NumberFlow value={subtotal} locales={locale} format={moneyFormat(subtotal, currency)} className="tabular text-[15px] font-medium leading-none tracking-[-0.01em] text-fg" />
      </div>
      {note && <p className="-mt-2 text-[12px] text-fg-3">{note}</p>}
      <button
        type="button"
        aria-busy={busy || undefined}
        onClick={async () => {
          // One checkout at a time, even before the spinner shows.
          if (pending.current) return;
          const result = onCheckout?.();
          if (!(result instanceof Promise)) return;
          pending.current = true;
          const shownAt = { t: 0 };
          timer.current = window.setTimeout(() => {
            shownAt.t = performance.now();
            setBusy(true);
          }, 150);
          try {
            await result;
          } finally {
            window.clearTimeout(timer.current);
            const hold = shownAt.t ? Math.max(0, 300 - (performance.now() - shownAt.t)) : 0;
            timer.current = window.setTimeout(() => {
              pending.current = false;
              setBusy(false);
            }, hold);
          }
        }}
        className={cn(
          "group/checkout relative inline-flex h-9 w-full select-none items-center justify-center rounded-lg bg-fg text-[13px] font-medium text-frame outline-none",
          "transition-[background-color,scale] duration-150 hover:bg-fg/90 active:scale-[0.98] active:duration-75 aria-busy:cursor-progress aria-busy:active:scale-100",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        )}
      >
        <span className={cn("flex items-center gap-2 transition-opacity duration-150", busy && "opacity-0")}>
          {checkoutLabel}
          <ArrowRight size={15} className="transition-transform duration-200 ease-out-expo group-hover/checkout:translate-x-0.5" />
        </span>
        {busy && (
          <span className="absolute inset-0 grid place-items-center">
            <Loader size={16} className="animate-spin motion-reduce:animate-none" />
            <span className="sr-only">Starting checkout</span>
          </span>
        )}
      </button>
    </div>
  );
}

export type CartEmptyProps = React.ComponentProps<"div"> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** One action, usually a CartDrawerClose that says "Continue shopping". */
  action?: React.ReactNode;
};

export function CartEmpty({ title = "Your cart is empty", description, action, className, ...rest }: CartEmptyProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: ease.out, delay: 0.12 }}
      className={cn("flex flex-1 flex-col items-center justify-center gap-3 px-6 pb-10 text-center", className)}
      {...(rest as React.ComponentProps<typeof motion.div>)}
    >
      <span aria-hidden className="grid size-10 place-items-center rounded-full border border-line bg-hover text-fg-3">
        <Cart />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-[13px] font-medium text-fg">{title}</p>
        {description && <p className="max-w-[28ch] text-balance text-[12.5px] text-fg-3">{description}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </motion.div>
  );
}
