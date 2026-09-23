"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { PasskeyButton } from "@/components/ui/passkey-button";

type Outcome = "approve" | "cancel" | "unsupported";

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), reject(new DOMException("Aborted", "AbortError"))));
  });

// The real ceremony opens the device's own sheet, so here the "device" is
// simulated: pick how it answers, then press the button.
export default function Demo() {
  const [outcome, setOutcome] = useState<Outcome>("approve");
  const [run, setRun] = useState(0);
  const [fellBack, setFellBack] = useState(false);

  return (
    <div className="flex w-full max-w-[360px] flex-col gap-4">
      <div role="radiogroup" aria-label="How the device answers" className="flex items-center justify-center gap-1 self-center rounded-lg border border-line bg-raised p-0.5 shadow-[var(--shadow)]">
        {(
          [
            ["approve", "Approves"],
            ["cancel", "Cancels"],
            ["unsupported", "No passkeys"],
          ] as const
        ).map(([value, text]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={outcome === value}
            onClick={() => {
              setOutcome(value);
              setFellBack(false);
              setRun((r) => r + 1);
            }}
            className={cn(
              "h-7 rounded-md px-2.5 text-[12px] outline-none transition-[background-color,color,scale] duration-150 active:scale-[0.97]",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
              outcome === value ? "bg-hover text-fg" : "text-fg-3 hover:text-fg",
            )}
          >
            {text}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-5 rounded-xl border border-line bg-raised p-5 shadow-[var(--shadow)] sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-medium tracking-[-0.015em] text-fg">Welcome back, Maya</h2>
          <p className="text-[12.5px] text-fg-2">Use the passkey on this device to open Northwind.</p>
        </div>
        <PasskeyButton
          key={run}
          variant="primary"
          supported={outcome === "unsupported" ? false : undefined}
          onAuthenticate={async (signal) => {
            await wait(2400, signal);
            if (outcome === "cancel") throw new DOMException("The operation either timed out or was not allowed.", "NotAllowedError");
          }}
          onFallback={() => setFellBack(true)}
        />
        {fellBack && <p className="-mt-2 text-[12px] text-fg-3">Opening email sign-in for maya@northwind.dev…</p>}
      </div>
    </div>
  );
}
