"use client";
import { useState } from "react";
import { Rating } from "@/components/ui/rating";

const LABELS = ["Poor", "Fair", "Good", "Great", "Excellent"];

// A post-call review: rate it, see the product's standing, and a half-step score.
export default function Demo() {
  const [call, setCall] = useState(0);
  const [docs, setDocs] = useState(3.5);

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-3">
      <div className="flex flex-col gap-4 rounded-xl border border-line bg-frame p-4 shadow-[var(--shadow)] sm:p-5">
        <div className="flex flex-col gap-1">
          <h3 id="call-q" className="text-[14px] font-medium tracking-[-0.015em] text-fg">
            How was your onboarding call?
          </h3>
          <p className="text-[12.5px] text-fg-3">With Maya Okafor · 32 min · Tuesday</p>
        </div>
        <Rating aria-labelledby="call-q" size="lg" value={call} onValueChange={setCall} labels={LABELS} placeholder="Not rated" />
        <div className="h-px bg-line" />
        <div className="flex items-center justify-between gap-3">
          <span id="docs-q" className="text-[12.5px] text-fg-2">
            Setup guide
          </span>
          <div className="flex items-center gap-2.5">
            <Rating aria-labelledby="docs-q" step={0.5} value={docs} onValueChange={setDocs} />
            <span className="tabular w-6 text-right text-[12.5px] text-fg-3">{docs ? docs.toFixed(1) : "–"}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-1">
        <span className="text-[12px] text-fg-3">Marketplace average</span>
        <span className="flex items-center gap-2">
          <Rating readOnly value={4.3} size="sm" aria-label="Average rating" />
          <span className="tabular text-[12px] text-fg-2">4.3</span>
          <span className="tabular text-[12px] text-fg-3">(2,184)</span>
        </span>
      </div>
    </div>
  );
}
