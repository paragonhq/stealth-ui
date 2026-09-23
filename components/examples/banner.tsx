"use client";
import { useState } from "react";
import { Banner, BannerAction, useBannerDismissal } from "@/components/ui/banner";

const deploys = [
  { id: "a8f31c2", msg: "Tighten rate limits on /v1/export", who: "Maya Chen", when: "4m ago", ok: true },
  { id: "19bd07e", msg: "Move invoice PDFs to the new bucket", who: "Theo Park", when: "1h ago", ok: true },
  { id: "c42e9aa", msg: "Retry webhook deliveries with backoff", who: "You", when: "Yesterday", ok: false },
];

// A billing failure pinned across the top of the app, and a maintenance note
// inside the page that remembers it was dismissed on this device.
export default function Demo() {
  const [billing, setBilling] = useState(true);
  const maintenance = useBannerDismissal("maintenance-2026-09-28");
  const allGone = !billing && maintenance.dismissed;

  return (
    <div className="flex w-full max-w-[540px] flex-col gap-3">
      <div className="flex min-h-[400px] w-full flex-col overflow-hidden rounded-2xl border border-line bg-frame">
        <Banner
          tone="danger"
          title="Payment failed."
          open={billing}
          onOpenChange={setBilling}
          dismissible
          dismissLabel="Dismiss payment notice"
          action={<BannerAction onClick={() => setBilling(false)}>Update card</BannerAction>}
        >
          We couldn’t charge Visa •••• 4242 for INV-2041. Update it by 30 Sep to keep deploys running.
        </Banner>

        <div className="flex min-h-0 flex-1 flex-col p-4">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-[15px] font-medium tracking-[-0.015em] text-fg">Deployments</h3>
            <span className="text-[12px] text-fg-3">production</span>
          </div>

          <Banner
            variant="inset"
            tone="info"
            storageKey="maintenance-2026-09-28"
            dismissible
            dismissLabel="Dismiss maintenance notice"
            // Space it with a margin inside the banner, not the parent's gap, so the gap collapses with it.
            className="mb-4"
          >
            Builds queue during maintenance on 28 Sep, 02:00–03:00 UTC. Running deploys finish first.
          </Banner>

          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-raised">
            {deploys.map((d) => (
              <li key={d.id} className="flex h-12 items-center gap-3 px-3">
                <span aria-hidden className={d.ok ? "size-1.5 shrink-0 rounded-full bg-success" : "size-1.5 shrink-0 rounded-full bg-danger"} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] leading-[18px] text-fg">{d.msg}</span>
                  <span className="truncate text-[12px] leading-4 text-fg-3">
                    <span className="font-mono text-[11.5px]">{d.id}</span> · {d.who}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] text-fg-4">{d.when}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex h-7 items-center justify-center">
        {allGone && (
          <button
            type="button"
            onClick={() => {
              setBilling(true);
              maintenance.restore();
            }}
            className="h-7 rounded-md px-2.5 text-[12px] text-fg-3 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.97]"
          >
            Show both banners again
          </button>
        )}
      </div>
    </div>
  );
}
