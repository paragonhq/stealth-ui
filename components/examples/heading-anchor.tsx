"use client";
import { useState } from "react";
import { HeadingAnchor } from "@/components/ui/heading-anchor";

// A page of API docs. Hover a heading (or tab to its link) and press the # to copy a link to
// that section; the line underneath shows what reached the clipboard.
export default function Demo() {
  const [copied, setCopied] = useState<string | null>(null);
  const hash = copied ? copied.slice(copied.indexOf("#")) : null;

  return (
    <div className="flex w-full max-w-[480px] flex-col gap-4">
      <article className="rounded-xl border border-line bg-raised px-5 pt-4 pb-5 shadow-[var(--shadow)]">
        <HeadingAnchor as="h2" id="rate-limits" updateHash={false} onCopied={setCopied}>
          Rate limits
        </HeadingAnchor>
        <p className="mt-2 text-[13px] leading-[1.6] text-pretty text-fg-2">
          Each API key can make 600 requests a minute. Requests over the limit get a <code className="font-mono text-[12px] text-fg">429</code> and
          are not charged.
        </p>
        <HeadingAnchor as="h3" className="mt-5" updateHash={false} onCopied={setCopied}>
          Reading the Retry-After header
        </HeadingAnchor>
        <p className="mt-1.5 text-[13px] leading-[1.6] text-pretty text-fg-2">
          Wait the number of seconds it gives before trying again. Retrying sooner resets the window.
        </p>
        <HeadingAnchor as="h3" className="mt-5" updateHash={false} onCopied={setCopied}>
          Burst allowance for webhooks and batch imports during a migration
        </HeadingAnchor>
        <p className="mt-1.5 text-[13px] leading-[1.6] text-pretty text-fg-2">Short spikes up to 3× the limit are allowed for 10 seconds.</p>
      </article>

      <p className="flex h-5 min-w-0 items-center gap-2 px-1 font-mono text-[11.5px] text-fg-3">
        <span className="shrink-0 text-fg-4">docs.acme.dev/api/limits</span>
        <span className="truncate text-fg-2" suppressHydrationWarning>
          {hash ?? ""}
        </span>
      </p>
    </div>
  );
}
