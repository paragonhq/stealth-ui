"use client";
import { useEffect, useRef, useState } from "react";
import { type ZoomChangeReason, ZoomControl } from "@/components/ui/zoom-control";

const BOARD = { w: 280, h: 440 };

// A design canvas: pinch or Ctrl/⌘ + scroll over it, use the shortcuts while it
// has focus, or drive the control. Buttons and presets glide; pinches follow 1:1.
export default function Demo() {
  const canvas = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.33);
  const [reason, setReason] = useState<ZoomChangeReason>("button");
  const [fit, setFit] = useState(0.5);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setFit(Math.round(Math.min((width - 48) / BOARD.w, (height - 112) / BOARD.h) * 100) / 100);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="w-full max-w-[520px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div
        ref={canvas}
        tabIndex={0}
        role="region"
        aria-label="Canvas"
        className="relative h-[320px] overflow-hidden rounded-t-[11px] bg-frame outline-none [background-image:radial-gradient(var(--line-2)_1px,transparent_1px)] [background-size:16px_16px] focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3"
      >
        <div
          style={{ width: BOARD.w, height: BOARD.h, transform: `translate(-50%, calc(-50% - 16px)) scale(${zoom})` }}
          className={
            reason === "wheel"
              ? "absolute left-1/2 top-1/2"
              : "absolute left-1/2 top-1/2 transition-transform duration-200 ease-out-quart motion-reduce:transition-none"
          }
        >
          <p className="absolute bottom-full left-0 mb-1.5 text-[11px] text-fg-3">Checkout — Mobile</p>
          <Board />
        </div>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <ZoomControl
            value={zoom}
            onValueChange={(v, why) => {
              setReason(why);
              setZoom(v);
            }}
            fitValue={fit}
            target={canvas}
            side="top"
          />
        </div>
      </div>
      <p className="border-t border-line px-4 py-2.5 text-[11.5px] text-fg-3">
        Pinch or hold Ctrl and scroll over the canvas. Click it for ⌘+ ⌘− ⌘0 and ⇧1.
      </p>
    </div>
  );
}

function Board() {
  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-line-2 bg-raised p-4 shadow-[var(--shadow)]">
      <p className="text-[15px] font-medium tracking-[-0.015em] text-fg">Checkout</p>
      <div className="flex items-center gap-3 rounded-lg border border-line p-2.5">
        <div className="size-10 rounded-md bg-hover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] text-fg">Linen overshirt</p>
          <p className="text-[11.5px] text-fg-3">Sand · M</p>
        </div>
        <p className="tabular text-[12.5px] text-fg">$98.00</p>
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-line p-2.5">
        <div className="size-10 rounded-md bg-hover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] text-fg">Canvas tote</p>
          <p className="text-[11.5px] text-fg-3">Natural</p>
        </div>
        <p className="tabular text-[12.5px] text-fg">$30.00</p>
      </div>
      <div className="mt-auto flex flex-col gap-1.5 text-[12.5px]">
        <div className="flex justify-between text-fg-2"><span>Subtotal</span><span className="tabular">$128.00</span></div>
        <div className="flex justify-between text-fg-2"><span>Shipping</span><span className="tabular">$8.40</span></div>
        <div className="flex justify-between font-medium text-fg"><span>Total</span><span className="tabular">$136.40</span></div>
      </div>
      <div className="grid h-9 place-items-center rounded-lg bg-fg text-[13px] font-medium text-frame">Pay $136.40</div>
    </div>
  );
}
