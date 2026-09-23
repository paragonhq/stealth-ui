"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { File } from "@/lib/icons";
import { SessionTimeout } from "@/components/ui/session-timeout";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A planning doc left open over lunch. Go idle to see the warning, or jump to its last seconds.
export default function Demo() {
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<"active" | "refreshed" | "signed-out">("active");

  const warn = (seconds?: number) => {
    setExpiresAt(seconds ? Date.now() + seconds * 1000 : undefined);
    setOpen(true);
  };

  return (
    <div className="flex w-full max-w-[440px] flex-col items-center gap-4">
      <div ref={setFrame} className="relative min-h-[340px] w-full overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <div className="flex h-11 items-center gap-2 border-b border-line px-4">
          <File className="shrink-0 text-fg-3" />
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">Q3 planning</p>
          <span className="flex items-center gap-1.5 text-[11.5px] text-fg-3">
            <span aria-hidden className={cn("size-1.5 rounded-full", status === "signed-out" ? "bg-fg-4" : "bg-success")} />
            {status === "signed-out" ? "Signed out" : status === "refreshed" ? "Session refreshed" : "Saved 2m ago"}
          </span>
        </div>
        <div className="space-y-3 px-5 py-5 text-[13px] leading-[1.6] text-fg-2">
          <p className="text-[15px] font-medium tracking-[-0.015em] text-fg">Checkout reliability</p>
          <p>Cut failed payments from 2.1% to under 1% by moving card retries server-side and adding Apple Pay on web.</p>
          <p>Owners: Maya Chen (payments), Leo Park (web). Review on Oct 3.</p>
          <div className="space-y-2 pt-1" aria-hidden>
            <div className="h-2 w-[92%] rounded-full bg-hover" />
            <div className="h-2 w-[78%] rounded-full bg-hover" />
            <div className="h-2 w-[64%] rounded-full bg-hover" />
          </div>
        </div>

        <SessionTimeout
          container={frame}
          open={open}
          onOpenChange={setOpen}
          expiresAt={expiresAt}
          duration={60}
          onStaySignedIn={async () => {
            await wait(700);
            setStatus("refreshed");
          }}
          onSignOut={() => wait(600).then(() => setStatus("signed-out"))}
          onExpire={() => setStatus("signed-out")}
          onSignIn={() => setStatus("active")}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={() => warn()} className={cn(control, "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover")}>
          Go idle
        </button>
        <button type="button" onClick={() => warn(6)} className={cn(control, "text-fg-2 hover:bg-hover hover:text-fg")}>
          Skip to the last 6 seconds
        </button>
      </div>
    </div>
  );
}

const control = cn(
  "inline-flex h-8 items-center rounded-lg px-2.5 text-[12.5px] font-medium outline-none",
  "transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.97] active:duration-75",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
);
