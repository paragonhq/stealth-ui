"use client";
import { useRef, useState } from "react";
import { ApiKey } from "@/components/ui/api-key";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const newKey = (prefix: string) => {
  const glyphs = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return prefix + Array.from({ length: 32 }, () => glyphs[(Math.random() * glyphs.length) | 0]).join("");
};

// A project's keys page: a live key you reveal behind a fetch and can regenerate, and a test key that has never been used.
export default function Demo() {
  const [lastUsed] = useState(() => Date.now() - 4 * 60_000);
  // Stands in for the server: reveal returns whatever the latest key is.
  const current = useRef("sk_demo_51HxQ8vT2mKc9RwZpL3nYd7sE4f2a");

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-3">
      <ApiKey
        name="Production"
        prefix="sk_demo_"
        last4="4f2a"
        createdAt="2026-03-12T09:30:00Z"
        lastUsedAt={lastUsed}
        onReveal={() => wait(450).then(() => current.current)}
        onRegenerate={() =>
          wait(900).then(() => {
            current.current = newKey("sk_demo_");
            return current.current;
          })
        }
      />
      <ApiKey name="CI runner" prefix="sk_demo_" value="sk_demo_7Gk2PqW9xTnV4hBc8LmZr3Ya0e91" createdAt="2026-08-30T14:05:00Z" lastUsedAt={null} />
    </div>
  );
}
