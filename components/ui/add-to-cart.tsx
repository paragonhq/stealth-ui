"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { cn } from "@/lib/cn";
import { Alert, Cart, Loader } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

type Phase = "idle" | "busy" | "failed";

export type AddToCartProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  /** Units of this item in the cart. 0 shows the button; 1 or more shows the stepper. */
  quantity?: number;
  defaultQuantity?: number;
  onQuantityChange?: (quantity: number) => void;
  /**
   * Runs on the first press. Return a promise to show the busy state; the button turns into the
   * stepper when it resolves and says it couldn't add when it rejects.
   */
  onAdd?: () => void | Promise<unknown>;
  /** Units in stock. 0 shows the sold-out state. */
  max?: number;
  /** What the stepper's hint says at max. */
  stockMessage?: (max: number) => string;
  /** Used in accessible names: "Quantity of …", "Remove …". */
  itemName?: string;
  label?: string;
  failedLabel?: string;
  soldOutLabel?: string;
  size?: "sm" | "md" | "lg";
  /** Fill the width of the container, for product pages and sheets. */
  block?: boolean;
  disabled?: boolean;
  onError?: (error: unknown) => void;
};

export function AddToCart({
  quantity: quantityProp,
  defaultQuantity = 0,
  onQuantityChange,
  onAdd,
  max,
  stockMessage,
  itemName,
  label = "Add to cart",
  failedLabel = "Try again",
  soldOutLabel = "Sold out",
  size = "md",
  block = false,
  disabled = false,
  onError,
  className,
  ...rest
}: AddToCartProps) {
  const [quantity, setQuantity] = useControllableState({ value: quantityProp, defaultValue: defaultQuantity, onChange: onQuantityChange });
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const [spinner, setSpinner] = useState(false);
  const [announce, setAnnounce] = useState("");
  const soldOut = max === 0;
  const inCart = quantity > 0;

  const addButton = useRef<HTMLButtonElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  // Where focus should land after the morph, when the control that had it disappears.
  const refocus = useRef<"add" | "count" | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  useEffect(() => {
    const target = refocus.current;
    refocus.current = null;
    if (target === "add") addButton.current?.focus();
    if (target === "count") shell.current?.querySelector("input")?.focus();
  }, [inCart]);

  const add = async (keyboard: boolean) => {
    if (phase === "busy" || disabled || soldOut) return;
    const done = () => {
      if (keyboard) refocus.current = "count";
      setPhase("idle");
      setSpinner(false);
      setQuantity(1);
      setAnnounce(itemName ? `Added ${itemName} to your cart` : "Added to your cart");
    };
    const result = onAdd?.();
    if (!(result instanceof Promise)) return done();

    setPhase("busy");
    // No spinner for fast answers; once shown, it stays long enough to read as intentional.
    let shownAt = 0;
    const t = window.setTimeout(() => {
      shownAt = performance.now();
      setSpinner(true);
    }, 150);
    try {
      await result;
      window.clearTimeout(t);
      const wait = shownAt ? Math.max(0, 300 - (performance.now() - shownAt)) : 0;
      if (wait) later(done, wait);
      else done();
    } catch (error) {
      window.clearTimeout(t);
      setSpinner(false);
      setPhase("failed");
      setAnnounce(itemName ? `Couldn’t add ${itemName} to your cart. Try again.` : "Couldn’t add to your cart. Try again.");
      onError?.(error);
      later(() => setPhase((p) => (p === "failed" ? "idle" : p)), 2800);
    }
  };

  const text = soldOut ? soldOutLabel : phase === "failed" ? failedLabel : label;
  const h = size === "sm" ? "h-7 text-[12px]" : size === "lg" ? "h-9 text-[13px]" : "h-8 text-[12.5px]";

  // The shell owns the fill and animates its size; the content inside only crossfades.
  // The resting pose is the same either way, so server and client render the same styles.
  const swap = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, filter: "blur(3px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.94, filter: "blur(3px)", transition: { duration: 0.12 } },
  };

  return (
    <div
      data-state={inCart ? "in-cart" : soldOut ? "sold-out" : phase}
      data-size={size}
      className={cn(block ? "flex w-full" : "inline-flex", className)}
      {...rest}
    >
      <motion.div
        ref={shell}
        layout={!reduce && !block}
        transition={spring.snappy}
        style={{ borderRadius: size === "sm" ? 6 : 8 }}
        className={cn(
          "relative flex items-center transition-[background-color,opacity,scale] duration-200",
          // The whole fill presses, not just the label inside it.
          "has-[>button:not([aria-busy]):not(:disabled):active]:scale-[0.97] has-[>button:active]:duration-75",
          phase === "failed" ? "bg-danger" : "bg-fg",
          (soldOut || disabled) && "opacity-50",
          block && "w-full",
          h,
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {inCart ? (
            <motion.div key="stepper" layout={!reduce && !block} className={cn("flex h-full", block && "w-full")} transition={{ layout: spring.snappy, duration: 0.2, ease: ease.out }} {...swap}>
              <QuantityStepper
                bare
                variant="primary"
                size={size}
                value={quantity}
                onValueChange={setQuantity}
                max={max}
                stockMessage={stockMessage}
                disabled={disabled}
                label={itemName ? `Quantity of ${itemName} in cart` : "Quantity in cart"}
                removeLabel={itemName ? `Remove ${itemName} from cart` : "Remove from cart"}
                onRemove={() => {
                  if (shell.current?.contains(document.activeElement)) refocus.current = "add";
                  setQuantity(0);
                  setAnnounce(itemName ? `Removed ${itemName} from your cart` : "Removed from your cart");
                }}
                className={cn("h-full", block && "w-full")}
              />
            </motion.div>
          ) : (
            <motion.button
              key="add"
              ref={addButton}
              type="button"
              layout={!reduce && !block}
              disabled={disabled || soldOut}
              aria-busy={phase === "busy" || undefined}
              aria-disabled={phase === "busy" || undefined}
              // detail is 0 for Enter and Space, so focus follows keyboard users into the stepper.
              onClick={(e) => add(e.detail === 0)}
              transition={{ layout: spring.snappy, duration: 0.2, ease: ease.out }}
              {...swap}
              className={cn(
                "group/add relative inline-flex h-full select-none items-center justify-center gap-2 whitespace-nowrap font-medium tracking-[-0.005em] text-frame outline-none",
                "rounded-[inherit] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                "aria-busy:cursor-progress disabled:cursor-not-allowed",
                size === "sm" ? "px-2.5" : size === "lg" ? "px-4" : "px-3",
                block && "w-full",
              )}
            >
              <span className={cn("flex items-center gap-2 transition-opacity duration-150", spinner && "opacity-0")}>
                <span className="relative grid size-4 place-items-center">
                  <AnimatePresence initial={false}>
                    <motion.span
                      key={phase === "failed" ? "failed" : "cart"}
                      className="absolute inset-0 grid place-items-center"
                      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                      transition={reduce ? { duration: 0.12 } : spring.pop}
                    >
                      {phase === "failed" ? <Alert size={size === "sm" ? 14 : 16} /> : <Cart size={size === "sm" ? 14 : 16} />}
                    </motion.span>
                  </AnimatePresence>
                </span>
                {/* The spinner overlays the label, so busy never changes the width; a failure may,
                    and the shell morphs to it instead of jumping. */}
                <span>{text}</span>
              </span>
              {spinner && (
                <span className="absolute inset-0 grid place-items-center">
                  <Loader size={16} className="animate-spin motion-reduce:animate-none" />
                  <span className="sr-only">Adding</span>
                </span>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

export type CartButtonProps = Omit<React.ComponentProps<"button">, "children"> & {
  /** Items in the cart. The badge rolls to the new number and bumps when it grows. */
  count: number;
  label?: string;
  size?: "sm" | "md";
};

/** The cart in the header. Its badge rolls and gives a small bump each time something is added. */
export function CartButton({ count, label = "Cart", size = "md", className, ...rest }: CartButtonProps) {
  const reduce = useReducedMotion();
  const [scope, animate] = useAnimate();
  const prev = useRef(count);

  useEffect(() => {
    const grew = count > prev.current;
    prev.current = count;
    if (!grew || reduce || !scope.current) return;
    animate("[data-bump]", { scale: [1, 1.22, 1] }, { duration: 0.36, ease: ease.out });
    animate("[data-cart]", { y: [0, 1.5, 0], rotate: [0, -6, 0] }, { duration: 0.32, ease: ease.out });
  }, [count, reduce, animate, scope]);

  const items = count === 1 ? "1 item" : `${count} items`;

  return (
    <button
      ref={scope}
      type="button"
      aria-label={count > 0 ? `${label}, ${items}` : label}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-lg text-fg-2 outline-none",
        "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.94] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden",
        size === "sm" ? "size-7" : "size-8",
        className,
      )}
      {...rest}
    >
      <span data-cart className="grid place-items-center">
        <Cart size={size === "sm" ? 15 : 16} />
      </span>
      <AnimatePresence initial={false}>
        {count > 0 && (
          <motion.span
            key="badge"
            aria-hidden
            className="absolute -right-1 -top-1 flex"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, transition: { duration: 0.12 } }}
            transition={reduce ? { duration: 0.12 } : spring.pop}
          >
            <span
              data-bump
              className="tabular flex h-4 min-w-4 items-center justify-center rounded-full bg-fg px-1 text-[10px] font-medium leading-none text-frame ring-2 ring-frame"
            >
              <NumberFlow value={count} animated={!reduce} className="leading-none" />
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
