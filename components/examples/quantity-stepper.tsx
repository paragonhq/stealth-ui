"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { ease } from "@/lib/motion";
import { QuantityStepper } from "@/components/ui/quantity-stepper";

type Line = { id: string; name: string; variant: string; price: number; qty: number; stock: number };

const initial: Line[] = [
  { id: "sock", name: "Merino crew socks", variant: "Charcoal", price: 18, qty: 2, stock: 40 },
  { id: "shirt", name: "Linen overshirt", variant: "Sand · M", price: 89, qty: 3, stock: 4 },
  { id: "dripper", name: "Ceramic pour-over", variant: "Matte white", price: 42, qty: 1, stock: 12 },
];

const order = (l: Line) => initial.findIndex((i) => i.id === l.id);
const money = { style: "currency", currency: "EUR", maximumFractionDigits: 0 } as const;

// A small order: stepping rolls the subtotal, the shirt runs out of stock at 4,
// and the pour-over already sits at 1, so its minus is a remove button.
export default function Demo() {
  const [lines, setLines] = useState(initial);
  const [removed, setRemoved] = useState<Line | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);

  const setQty = (id: string, qty: number) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, qty } : l)));

  return (
    <div className="w-full max-w-[400px] rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <p className="px-4 pb-1 pt-3.5 font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">Your order</p>
      <ul className="px-1.5">
        <AnimatePresence initial={false}>
          {lines.map((l) => (
            <motion.li
              key={l.id}
              initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: ease.inOut }}
              // Clip only while the height moves, so the stock hint can rise above the row at rest.
              onAnimationStart={() => setMoving(l.id)}
              onAnimationComplete={() => setMoving(null)}
              className={moving === l.id ? "overflow-hidden" : undefined}
            >
              <div className="flex items-center gap-3 px-2.5 py-2.5">
                <Swatch id={l.id} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-fg">{l.name}</p>
                  <p className="truncate text-[12px] text-fg-3">
                    {l.variant} · <span className="tabular">€{l.price}</span>
                  </p>
                </div>
                <QuantityStepper
                  size="sm"
                  value={l.qty}
                  onValueChange={(q) => setQty(l.id, q)}
                  max={l.stock}
                  label={`Quantity of ${l.name}`}
                  onRemove={() => {
                    setRemoved(l);
                    setLines((ls) => ls.filter((x) => x.id !== l.id));
                  }}
                  removeLabel={`Remove ${l.name}`}
                />
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="mx-4 flex h-11 items-center justify-between border-t border-line">
        <div className="relative min-w-0 flex-1 text-[12px] text-fg-3">
          <AnimatePresence initial={false} mode="popLayout">
            {removed ? (
              <motion.p
                key="removed"
                className="flex min-w-0 items-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
              >
                <span className="truncate">{removed.name} removed</span>
                <button
                  type="button"
                  onClick={() => {
                    const back = removed;
                    setRemoved(null);
                    setLines((ls) => [...ls, back].sort((a, b) => order(a) - order(b)));
                  }}
                  className="relative shrink-0 rounded-sm font-medium text-fg underline decoration-fg-4 underline-offset-[3px] outline-none transition-[text-decoration-color] duration-150 hover:decoration-fg-2 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
                >
                  Undo
                </button>
              </motion.p>
            ) : (
              <motion.p key="count" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
                {lines.length === 0 ? "Your order is empty" : "Subtotal"}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <NumberFlow value={subtotal} format={money} locales="en-IE" className="tabular text-[13px] font-medium text-fg" />
      </div>
    </div>
  );
}

// Stand-in product thumbnails: a neutral tile with a simple drawn object.
function Swatch({ id }: { id: string }) {
  return (
    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-hover text-fg-3">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        {id === "sock" && <path d="M8 2.5h5v7.5l-4.5 5a2.5 2.5 0 0 1-3.8-3.2L8 9.5z M8 5.5h5" />}
        {id === "shirt" && <path d="M7 3 3.5 5 2.5 8.5l2.5 1V17h10V9.5l2.5-1L16.5 5 13 3a3 3 0 0 1-6 0z" />}
        {id === "dripper" && <path d="M3.5 5.5h13l-4 7h-5zM7.5 12.5v1.5h5v-1.5M5 16.5h10" />}
      </svg>
    </span>
  );
}
