"use client";
import { useState } from "react";
import { MagicLink } from "@/components/ui/magic-link";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Right after "Email me a sign-in link". The cooldown is short here so you can
// try resending; the link itself opens "in another tab" from the button below.
export default function Demo() {
  const [run, setRun] = useState(0);
  const [verified, setVerified] = useState(false);

  return (
    <div className="flex min-h-[440px] w-full max-w-[360px] flex-col items-center gap-3">
      <MagicLink
        key={run}
        email="maya@northwind.dev"
        sender="login@northwind.dev"
        expiresIn={15}
        cooldown={[10, 30]}
        verified={verified}
        onResend={() => wait(900)}
        onChangeEmail={() => {
          setVerified(false);
          setRun((r) => r + 1);
        }}
      />
      <button
        type="button"
        onClick={() => (verified ? (setVerified(false), setRun((r) => r + 1)) : setVerified(true))}
        className="rounded-sm text-[11.5px] text-fg-3 underline decoration-fg-4 underline-offset-[3px] outline-none transition-colors duration-150 hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
      >
        {verified ? "Start over" : "Open the link in another tab"}
      </button>
    </div>
  );
}
