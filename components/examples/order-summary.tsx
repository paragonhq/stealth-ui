"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { OrderSummary, OrderSummaryItem, OrderSummaryItems, OrderSummaryRow, OrderSummaryRows, OrderSummaryTotal } from "@/components/ui/order-summary";

const items = [
  { id: "shirt", name: "Linen overshirt", variant: "Sand · M", price: 89, quantity: 1 },
  { id: "socks", name: "Merino crew socks", variant: "Charcoal · 3 pack", price: 18, quantity: 2 },
  { id: "dripper", name: "Ceramic pour-over", variant: "Matte white", price: 42, quantity: 1 },
];

const delivery = [
  { id: "standard", label: "Standard", when: "3–5 days", price: 0 },
  { id: "express", label: "Express", when: "Tomorrow", price: 12 },
] as const;

// A checkout sidebar. Changing delivery recalculates shipping (with a short wait)
// and the total rolls; on a phone the summary folds behind a header with the total.
export default function Demo() {
  const [method, setMethod] = useState<(typeof delivery)[number]["id"]>("standard");
  const [loading, setLoading] = useState(false);
  const [discounted, setDiscounted] = useState(true);
  useEffect(() => {
    if (!loading) return;
    const t = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(t);
  }, [loading]);

  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
  const discount = discounted ? Math.round(subtotal * 0.2 * 100) / 100 : 0;
  const shipping = delivery.find((d) => d.id === method)!.price;
  const total = subtotal - discount + (loading ? 0 : shipping);
  const vat = Math.round((total - total / 1.21) * 100) / 100;

  return (
    <div className="flex w-full max-w-[380px] flex-col gap-3">
      <div role="radiogroup" aria-label="Delivery" className="grid grid-cols-2 gap-2">
        {delivery.map((d) => (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={method === d.id}
            onClick={() => {
              if (method === d.id) return;
              setMethod(d.id);
              setLoading(true);
            }}
            className={cn(
              "flex flex-col items-start rounded-lg border px-3 py-2 text-left outline-none transition-[background-color,border-color,scale] duration-150 active:scale-[0.98] active:duration-75",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              method === d.id ? "border-fg-3 bg-raised" : "border-line bg-transparent hover:border-line-2 hover:bg-hover",
            )}
          >
            <span className="text-[12.5px] font-medium text-fg">{d.label}</span>
            <span className="text-[11.5px] text-fg-3">
              {d.when} · {d.price ? `€${d.price}` : "Free"}
            </span>
          </button>
        ))}
      </div>

      <OrderSummary total={total} currency="EUR" locale="en-IE" count={4}>
        <OrderSummaryItems>
          {items.map((i) => (
            <OrderSummaryItem key={i.id} name={i.name} variant={i.variant} price={i.price} quantity={i.quantity} image={<Art id={i.id} />} />
          ))}
        </OrderSummaryItems>
        <OrderSummaryRows>
          <OrderSummaryRow label="Subtotal" amount={subtotal} />
          {discounted && (
            <OrderSummaryRow
              label="Discount"
              detail={
                <button type="button" onClick={() => setDiscounted(false)} aria-label="Remove code SPRING20" className="outline-none hover:underline focus-visible:underline">
                  SPRING20 ×
                </button>
              }
              amount={-discount}
              tone="discount"
            />
          )}
          <OrderSummaryRow label="Shipping" detail={method === "express" ? "Express" : undefined} amount={shipping} loading={loading} />
        </OrderSummaryRows>
        <OrderSummaryTotal note={loading ? "Updating…" : `Including €${vat.toFixed(2)} in VAT`} />
      </OrderSummary>
    </div>
  );
}

function Art({ id }: { id: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      {id === "shirt" && <path d="M7 3 3.5 5 2.5 8.5l2.5 1V17h10V9.5l2.5-1L16.5 5 13 3a3 3 0 0 1-6 0z" />}
      {id === "socks" && <path d="M8 2.5h5v7.5l-4.5 5a2.5 2.5 0 0 1-3.8-3.2L8 9.5z M8 5.5h5" />}
      {id === "dripper" && <path d="M3.5 5.5h13l-4 7h-5zM7.5 12.5v1.5h5v-1.5M5 16.5h10" />}
    </svg>
  );
}
