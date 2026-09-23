"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CartButton } from "@/components/ui/add-to-cart";
import { ease } from "@/lib/motion";
import {
  CartDrawer,
  CartDrawerClose,
  CartDrawerContent,
  CartDrawerTrigger,
  CartEmpty,
  CartLine,
  CartLines,
  CartShippingProgress,
  CartSummary,
} from "@/components/ui/cart-drawer";

type Line = { id: string; name: string; variant: string; price: number; compareAt?: number; quantity: number; max: number };

const catalogue: Line[] = [
  { id: "shirt", name: "Linen overshirt", variant: "Sand · M", price: 89, quantity: 1, max: 4 },
  { id: "socks", name: "Merino crew socks", variant: "Charcoal · 3 pack", price: 18, quantity: 2, max: 20 },
  { id: "dripper", name: "Ceramic pour-over", variant: "Matte white", price: 42, compareAt: 54, quantity: 1, max: 12 },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A shop page inside the stage: adding the overshirt opens the cart,
// steppers roll every total, and removing a line offers an undo.
export default function Demo() {
  const frame = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState(catalogue.slice(1));
  const [removed, setRemoved] = useState<Line | null>(null);
  // The undo offer stays for six seconds.
  useEffect(() => {
    if (!removed) return;
    const t = window.setTimeout(() => setRemoved(null), 6000);
    return () => window.clearTimeout(t);
  }, [removed]);
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = lines.reduce((n, l) => n + l.price * l.quantity, 0);

  const update = (id: string, quantity: number) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, quantity } : l)));
  const remove = (line: Line) => {
    setRemoved(line);
    setLines((ls) => ls.filter((l) => l.id !== line.id));
  };
  const addShirt = () => {
    setLines((ls) => (ls.some((l) => l.id === "shirt") ? ls.map((l) => (l.id === "shirt" ? { ...l, quantity: Math.min(l.max, l.quantity + 1) } : l)) : [catalogue[0], ...ls]));
    setOpen(true);
  };

  return (
    <div ref={frame} className="relative h-[480px] w-full max-w-[560px] overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)]">
      <CartDrawer open={open} onOpenChange={setOpen} currency="EUR" locale="en-IE" modal="trap-focus">
        <header className="flex h-12 items-center justify-between border-b border-line pl-4 pr-2.5">
          <p className="font-mono text-2xs uppercase tracking-[0.12em] text-fg-2">Atelier Nord</p>
          <CartDrawerTrigger render={<CartButton count={count} />} />
        </header>

        <div className="grid gap-5 p-4 sm:grid-cols-[180px_1fr]">
          <div aria-hidden className="grid aspect-[4/5] place-items-center rounded-xl border border-line bg-hover text-fg-4 max-sm:hidden">
            <svg width="56" height="56" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 3 3.5 5 2.5 8.5l2.5 1V17h10V9.5l2.5-1L16.5 5 13 3a3 3 0 0 1-6 0z" />
            </svg>
          </div>
          <div className="flex min-w-0 flex-col gap-3 pt-1">
            <div>
              <p className="text-[15px] font-medium tracking-[-0.015em] text-fg">Linen overshirt</p>
              <p className="tabular text-[13px] text-fg-2">€89</p>
            </div>
            <p className="max-w-[36ch] text-[12.5px] leading-[1.55] text-fg-3">
              Washed Belgian linen with a relaxed shoulder and horn buttons. Sand, size M.
            </p>
            <button
              type="button"
              onClick={addShirt}
              className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-fg text-[13px] font-medium text-frame outline-none transition-[background-color,scale] duration-150 hover:bg-fg/90 active:scale-[0.98] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 sm:max-w-[220px]"
            >
              Add to cart
            </button>
          </div>
        </div>

        <CartDrawerContent container={frame} count={count} className="w-[380px]">
          {lines.length > 0 ? (
            <>
              <CartLines>
                {lines.map((l) => (
                  <CartLine
                    key={l.id}
                    name={l.name}
                    variant={l.variant}
                    price={l.price}
                    compareAt={l.compareAt}
                    quantity={l.quantity}
                    max={l.max}
                    onQuantityChange={(q) => update(l.id, q)}
                    onRemove={() => remove(l)}
                    image={<Art id={l.id} />}
                  />
                ))}
              </CartLines>
              <CartSummary subtotal={subtotal} onCheckout={() => wait(1200)}>
                <AnimatePresence initial={false}>
                  {removed && (
                    <motion.div
                      key={removed.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: ease.inOut }}
                      className="-mb-3 overflow-hidden"
                    >
                      <p className="flex items-center gap-2 pb-3 text-[12px] text-fg-3">
                        <span className="min-w-0 truncate">{removed.name} removed</span>
                        <button
                          type="button"
                          onClick={() => {
                            setLines((ls) => [...ls, removed].sort((a, b) => order(a) - order(b)));
                            setRemoved(null);
                          }}
                          className="shrink-0 rounded-sm font-medium text-fg underline decoration-fg-4 underline-offset-[3px] outline-none transition-[text-decoration-color] duration-150 hover:decoration-fg-2 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
                        >
                          Undo
                        </button>
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
                <CartShippingProgress subtotal={subtotal} threshold={200} />
              </CartSummary>
            </>
          ) : (
            <CartEmpty
              description="Anything you add shows up here, and stays for 30 days."
              action={<CartDrawerClose>Continue shopping</CartDrawerClose>}
            />
          )}
        </CartDrawerContent>
      </CartDrawer>
    </div>
  );
}

const order = (l: Line) => catalogue.findIndex((c) => c.id === l.id);

function Art({ id }: { id: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      {id === "shirt" && <path d="M7 3 3.5 5 2.5 8.5l2.5 1V17h10V9.5l2.5-1L16.5 5 13 3a3 3 0 0 1-6 0z" />}
      {id === "socks" && <path d="M8 2.5h5v7.5l-4.5 5a2.5 2.5 0 0 1-3.8-3.2L8 9.5z M8 5.5h5" />}
      {id === "dripper" && <path d="M3.5 5.5h13l-4 7h-5zM7.5 12.5v1.5h5v-1.5M5 16.5h10" />}
    </svg>
  );
}
