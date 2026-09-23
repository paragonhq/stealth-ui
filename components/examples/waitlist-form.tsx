"use client";
import { useState } from "react";
import { WaitlistForm } from "@/components/ui/waitlist-form";

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A private beta page. Join, then play the friend who signs up with your link.
export default function Demo() {
  const [position, setPosition] = useState<number | undefined>(undefined);
  const [referrals, setReferrals] = useState(0);
  const [joined, setJoined] = useState(false);

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Ledger is in private beta</h3>
        <p className="text-pretty text-[12.5px] text-fg-2">Bookkeeping that closes the month for you. We invite teams in the order they join.</p>
      </div>
      <WaitlistForm
        hint="8,214 teams are waiting. No spam, one email when it’s your turn."
        reward="Each team that joins with your link moves you up 50 places."
        position={position}
        referrals={referrals}
        referralNoun={["team", "teams"]}
        onJoined={(e) => {
          setJoined(true);
          setPosition(e.position);
        }}
        onJoin={async (email) => {
          await pause(900);
          if (email.toLowerCase().endsWith("@example.com")) throw new Error(`${email} is already on the list`);
          const handle = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12) || "you";
          return { position: 8215, referralUrl: `https://ledger.app/r/${handle}-k2f9` };
        }}
      />
      {joined && (
        <button
          type="button"
          onClick={() => {
            setPosition((p) => Math.max(1, (p ?? 8215) - 50));
            setReferrals((r) => r + 1);
          }}
          className="self-start rounded-[3px] text-[12px] text-fg-3 underline decoration-fg-4 underline-offset-[3px] outline-none transition-colors duration-150 hover:text-fg-2 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
        >
          Preview: a team joins with your link
        </button>
      )}
    </div>
  );
}
