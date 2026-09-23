"use client";
import { useState } from "react";
import { AnnouncementBar } from "@/components/ui/announcement-bar";

const messages = [
  { id: "ui", content: "Stealth UI 2.0 is out with 40 new components", cta: "Read the changelog", href: "#changelog" },
  { id: "qa", content: "Live Q&A with the design team on 3 Oct, 17:00 UTC", cta: "Save a seat", href: "#events" },
  { id: "pricing", content: "Team plans change on 1 Nov; yours keeps its price", cta: "See what’s changing", href: "#pricing" },
];

// The top of a product site: three rotating notes that wait while you read them.
export default function Demo() {
  const [open, setOpen] = useState(true);

  return (
    <div className="flex w-full max-w-[640px] flex-col gap-3">
      <div className="flex min-h-[320px] w-full flex-col overflow-hidden rounded-2xl border border-line bg-frame">
        <AnnouncementBar messages={messages} dismissible open={open} onOpenChange={setOpen} />

        <nav className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4" aria-label="Site">
          <span className="text-[13px] font-medium tracking-[-0.01em] text-fg">Stealth</span>
          <div className="flex items-center gap-4 text-[12.5px] text-fg-3 max-sm:hidden">
            <span>Product</span>
            <span>Pricing</span>
            <span>Changelog</span>
          </div>
          <span className="h-7 rounded-md bg-fg px-2.5 text-[12px] font-medium leading-7 text-frame">Sign in</span>
        </nav>

        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <p className="text-[22px] font-medium leading-tight tracking-[-0.025em] text-fg text-balance">Interfaces people trust with their work</p>
          <p className="max-w-[40ch] text-[13px] text-fg-3 text-pretty">Point at the bar to hold a message, or press pause. It also waits while it’s off screen.</p>
        </div>
      </div>

      <div className="flex h-7 items-center justify-center">
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-7 rounded-md px-2.5 text-[12px] text-fg-3 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.97]"
          >
            Show the bar again
          </button>
        )}
      </div>
    </div>
  );
}
