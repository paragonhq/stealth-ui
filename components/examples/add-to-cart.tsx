"use client";
import { useRef, useState } from "react";
import { AddToCart, CartButton } from "@/components/ui/add-to-cart";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A small shop shelf: adding rolls the cart badge, the overshirt has 2 left,
// and the pour-over's first request fails so you can see the retry.
export default function Demo() {
  const [shirt, setShirt] = useState(0);
  const [dripper, setDripper] = useState(0);
  const [wrap, setWrap] = useState(0);
  const failed = useRef(false);

  return (
    <div className="w-full max-w-[420px] rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex h-12 items-center justify-between border-b border-line pl-4 pr-2.5">
        <p className="text-[13px] font-medium tracking-[-0.01em] text-fg">New this week</p>
        <CartButton count={shirt + dripper + wrap} />
      </div>
      <div className="grid grid-cols-2 gap-3 p-3">
        <Product name="Linen overshirt" meta="Sand · M · 2 left" price="€89" art="shirt">
          <AddToCart
            block
            itemName="Linen overshirt"
            quantity={shirt}
            onQuantityChange={setShirt}
            max={2}
            onAdd={() => wait(700)}
          />
        </Product>
        <Product name="Ceramic pour-over" meta="Matte white" price="€42" art="dripper">
          <AddToCart
            block
            itemName="Ceramic pour-over"
            quantity={dripper}
            onQuantityChange={setDripper}
            onAdd={async () => {
              await wait(600);
              if (!failed.current) {
                failed.current = true;
                throw new Error("Network");
              }
            }}
          />
        </Product>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
        <p className="min-w-0 text-[12px] text-fg-3">Gift wrap · Recycled paper</p>
        <AddToCart size="sm" label="Add" failedLabel="Retry" itemName="Gift wrap" quantity={wrap} onQuantityChange={setWrap} max={3} stockMessage={(n) => `Up to ${n} per order`} />
      </div>
    </div>
  );
}

function Product({ name, meta, price, art, children }: { name: string; meta: string; price: string; art: "shirt" | "dripper"; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div aria-hidden className="grid aspect-[4/3] place-items-center rounded-lg border border-line bg-hover text-fg-4">
        <svg width="40" height="40" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round">
          {art === "shirt" ? (
            <path d="M7 3 3.5 5 2.5 8.5l2.5 1V17h10V9.5l2.5-1L16.5 5 13 3a3 3 0 0 1-6 0z" />
          ) : (
            <path d="M3.5 5.5h13l-4 7h-5zM7.5 12.5v1.5h5v-1.5M5 16.5h10" />
          )}
        </svg>
      </div>
      <div className="min-w-0 px-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="min-w-0 text-balance text-[13px] font-medium leading-[1.3] text-fg">{name}</p>
          <p className="tabular shrink-0 text-[12.5px] text-fg-2">{price}</p>
        </div>
        <p className="truncate text-[12px] text-fg-3">{meta}</p>
      </div>
      {children}
    </div>
  );
}
