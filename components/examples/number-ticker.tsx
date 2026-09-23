"use client";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { useEffect, useRef, useState } from "react";
import { NumberTicker } from "@/components/ui/number-ticker";

const locales = [
  { tag: "en-US", label: "US" },
  { tag: "de-DE", label: "DE" },
  { tag: "fr-FR", label: "FR" },
];

// A store's live revenue: orders tick it up on their own, a refund rolls it back down.
export default function Demo() {
  const [revenue, setRevenue] = useState(48210.4);
  const [orders, setOrders] = useState(1284);
  const [locale, setLocale] = useState("en-US");
  const root = useRef<HTMLDivElement>(null);

  // Orders arrive every few seconds while the card is on screen and the tab is visible.
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let visible = false;
    let timer = 0;
    const tick = () => {
      window.clearTimeout(timer);
      if (!visible || document.hidden) return;
      timer = window.setTimeout(() => {
        const amount = [29, 49, 49, 79, 129, 240][Math.floor(Math.random() * 6)] + Math.round(Math.random() * 99) / 100;
        setRevenue((r) => Math.round((r + amount) * 100) / 100);
        setOrders((o) => o + 1);
        tick();
      }, 2600 + Math.random() * 1800);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      tick();
    });
    io.observe(node);
    document.addEventListener("visibilitychange", tick);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const refund = () => {
    setRevenue((r) => Math.round((r - 129) * 100) / 100);
    setOrders((o) => o - 1);
  };

  return (
    <div ref={root} className="w-full max-w-[380px] rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <span className="flex items-center gap-2 text-[12.5px] text-fg-2">
          <span className="relative flex size-1.5">
            <span className="absolute inset-0 rounded-full bg-success motion-safe:animate-ping-soft" />
            <span className="relative size-1.5 rounded-full bg-success" />
          </span>
          Revenue today
        </span>
        <RadioGroup
          value={locale}
          onValueChange={(v) => setLocale(v as string)}
          aria-label="Number format"
          className="flex rounded-md border border-line bg-page p-0.5"
        >
          {locales.map((l) => (
            <Radio.Root
              key={l.tag}
              value={l.tag}
              nativeButton
              render={<button type="button" />}
              aria-label={l.tag}
              className="h-5 rounded-[4px] px-1.5 font-mono text-[10.5px] text-fg-3 outline-none transition-[background-color,color,scale] duration-150 hover:text-fg-2 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.95] data-checked:bg-raised data-checked:text-fg data-checked:shadow-[var(--shadow)]"
            >
              {l.label}
            </Radio.Root>
          ))}
        </RadioGroup>
      </div>

      <div className="px-4 pb-4 pt-2">
        <NumberTicker value={revenue} currency="USD" locale={locale} flash className="text-[32px] font-medium leading-none tracking-[-0.03em] text-fg" />
      </div>

      <dl className="grid grid-cols-2 border-t border-line">
        <div className="flex flex-col gap-1 px-4 py-3">
          <dt className="text-[12px] text-fg-3">Orders</dt>
          <dd className="text-[15px] font-medium tracking-[-0.015em] text-fg">
            <NumberTicker value={orders} locale={locale} />
          </dd>
        </div>
        <div className="flex flex-col gap-1 border-l border-line px-4 py-3">
          <dt className="text-[12px] text-fg-3">Store visits</dt>
          <dd className="text-[15px] font-medium tracking-[-0.015em] text-fg">
            <NumberTicker value={orders * 37.6} compact locale={locale} from={0} />
          </dd>
        </div>
      </dl>

      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
        <span className="min-w-0 truncate text-[12px] text-fg-3">Order #4821 · Linen shirt</span>
        <button
          type="button"
          onClick={refund}
          className="h-7 shrink-0 rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
        >
          Refund $129
        </button>
      </div>
    </div>
  );
}
