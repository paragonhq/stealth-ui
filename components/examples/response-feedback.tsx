"use client";
import { ResponseFeedback } from "@/components/ui/response-feedback";

// Feedback under an agent's answer. Sending fails once, the first time, so the
// error state can be seen; the retry goes through.
let attempts = 0;
const send = () =>
  new Promise<void>((resolve, reject) => {
    attempts++;
    window.setTimeout(() => (attempts === 1 ? reject(new Error("offline")) : resolve()), 700);
  });

export default function Demo() {
  return (
    <div className="flex w-full max-w-[460px] flex-col gap-3">
      <div className="rounded-xl border border-line bg-raised px-4 py-3.5 text-[13.5px] leading-[1.6] text-fg-2">
        <p>
          Your <span className="text-fg">Pro</span> plan renews on <span className="text-fg">12 October</span> for $240. Annual billing saves $48 against paying monthly,
          and seats you add mid-cycle are prorated to the renewal date.
        </p>
      </div>
      <ResponseFeedback className="px-1" onSubmit={send} />
    </div>
  );
}
