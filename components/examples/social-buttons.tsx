"use client";
import { useState } from "react";
import { SocialButtons, type SocialProvider } from "@/components/ui/social-buttons";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A sign-in card that remembers how you came in last time. Google and GitHub
// "redirect" and become the new last used; Apple's popup gets closed.
export default function Demo() {
  const [last, setLast] = useState<SocialProvider>("github");
  const [lastWork, setLastWork] = useState<SocialProvider>("sso");

  return (
    <div className="flex w-full max-w-[360px] flex-col gap-4">
      <div className="flex flex-col gap-5 rounded-xl border border-line bg-raised p-5 shadow-[var(--shadow)] sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-medium tracking-[-0.015em] text-fg">Sign in to Halcyon</h2>
          <p className="text-[12.5px] text-fg-2">Pick up where you left off on the Q3 roadmap.</p>
        </div>
        <SocialButtons
          lastUsed={last}
          onSignIn={async (p) => {
            await wait(1400);
            if (p === "apple") throw new Error("The Apple sign-in window was closed. Try again.");
            setLast(p);
          }}
        />
      </div>

      <div className="flex flex-col gap-2 px-1">
        <p className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">Work account</p>
        <SocialButtons
          layout="grid"
          size="md"
          providers={["google", "microsoft", "sso"]}
          lastUsed={lastWork}
          onSignIn={async (p) => {
            await wait(1200);
            setLastWork(p);
          }}
        />
      </div>
    </div>
  );
}
