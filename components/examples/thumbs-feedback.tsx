"use client";
import { ThumbsFeedback } from "@/components/ui/thumbs-feedback";

// The end of a docs article, and the same feedback in its compact form under an assistant reply.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[440px] flex-col gap-6">
      <article className="flex flex-col gap-4 rounded-xl border border-line bg-frame p-4 shadow-[var(--shadow)] sm:p-5">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Rotating API keys without downtime</h3>
          <p className="text-[12.5px] leading-[1.5] text-fg-2">
            Create the new key first, deploy it alongside the old one, then revoke the old key once traffic has moved over.
          </p>
        </div>
        <div className="h-px bg-line" />
        <ThumbsFeedback onSubmit={() => new Promise((r) => setTimeout(r, 900))} />
      </article>

      <div className="flex flex-col gap-2 px-1">
        <p className="text-[12.5px] leading-[1.5] text-fg-2">
          Your March invoice went up because two seats were added on the 14th. They’re prorated at $9.68 each.
        </p>
        <ThumbsFeedback
          question={null}
          size="sm"
          reasons={["Wrong numbers", "Didn’t answer", "Too long"]}
          onSubmit={() => new Promise((_, reject) => setTimeout(() => reject(new Error("Offline")), 700))}
        />
      </div>
    </div>
  );
}
