"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Check, Loader, Lock } from "@/lib/icons";
import { type CardValue, CardField } from "@/components/ui/card-field";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A payment step with test numbers only. Nothing leaves the page: 4242… is accepted,
// 4000 0000 0000 0002 is declined so the outside-error state is reachable.
export default function Demo() {
  const [card, setCard] = useState<CardValue>({ number: "", expiry: "", cvc: "" });
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"idle" | "busy" | "done">("idle");

  const pay = async () => {
    if (!complete || phase !== "idle") return;
    setPhase("busy");
    await wait(900);
    if (card.number === "4000000000000002") {
      setError("Your bank declined this card. Try another card.");
      setPhase("idle");
    } else setPhase("done");
  };

  return (
    <div className="w-full max-w-[400px] rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
      <CardField
        value={card}
        onValueChange={(v) => {
          setCard(v);
          setError("");
          if (phase === "done") setPhase("idle");
        }}
        onCompleteChange={(c) => setComplete(c)}
        error={error}
      />
      <button
        type="button"
        onClick={pay}
        disabled={!complete}
        aria-busy={phase === "busy" || undefined}
        className={cn(
          "relative mt-4 inline-flex h-9 w-full items-center justify-center rounded-lg bg-fg text-[13px] font-medium text-frame outline-none",
          "transition-[background-color,opacity,scale] duration-150 hover:bg-fg/90 active:scale-[0.98] active:duration-75",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "disabled:opacity-40 disabled:hover:bg-fg aria-busy:cursor-progress",
        )}
      >
        <span className={cn("flex items-center gap-2 transition-opacity duration-150", phase === "busy" && "opacity-0")}>
          {phase === "done" ? <Check size={15} /> : <Lock size={14} />}
          {phase === "done" ? "Paid €108.40" : "Pay €108.40"}
        </span>
        {phase === "busy" && (
          <span className="absolute inset-0 grid place-items-center">
            <Loader size={16} className="animate-spin motion-reduce:animate-none" />
          </span>
        )}
      </button>
      <p className="mt-3 text-[11.5px] leading-[1.5] text-fg-4">
        Demo only, nothing is sent. Try <span className="tabular text-fg-3">4242 4242 4242 4242</span>, or{" "}
        <span className="tabular text-fg-3">4000 0000 0000 0002</span> to see a decline.
      </p>
    </div>
  );
}
