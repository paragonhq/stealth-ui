"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Refresh } from "@/lib/icons";
import { clearLinkPreviews, LinkPreview, LinkPreviewLink, type LinkMeta } from "@/components/ui/link-preview";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A stand-in brand mark, drawn in currentColor so it follows the theme.
const northwind = (
  <svg viewBox="0 0 16 16" width="100%" height="100%" aria-hidden>
    <rect x="1" y="1" width="14" height="14" rx="4" fill="currentColor" />
    <path d="M5 11V5l6 6V5" fill="none" className="stroke-raised" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const pages: Record<string, LinkMeta> = {
  "https://northwind.co/blog/usage-based-billing": {
    url: "https://northwind.co/blog/usage-based-billing",
    siteName: "Northwind",
    favicon: northwind,
    meta: "6 min read",
    title: "Moving to usage-based billing without surprising anyone",
    description: "What we changed in metering, invoices and alerts so the first bill on the new plan matched what customers expected.",
    image: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=720&q=70",
    imageAlt: "Morning light over a green valley",
  },
  "https://docs.northwind.co/api/rate-limits": {
    url: "https://docs.northwind.co/api/rate-limits",
    siteName: "Northwind Docs",
    favicon: northwind,
    meta: "Updated 3 days ago",
    title: "Rate limits and retry headers",
    description: "How requests are counted per key, what the X-RateLimit headers mean, and how to back off after a 429.",
  },
  "https://status.relay.dev/incidents/q7m2": {
    url: "https://status.relay.dev/incidents/q7m2",
    siteName: "Relay status",
    title: "Elevated webhook latency in eu-west",
    description: "Resolved · Deliveries were delayed by up to 4 minutes between 14:02 and 14:31 UTC.",
  },
};

// The status page fails once, so the error and retry are there to try; it has no image or icon,
// so the fallbacks show once it loads.
let statusAttempts = 0;
const load = async (url: string) => {
  if (url.includes("status.relay.dev")) {
    await wait(900);
    if (statusAttempts++ % 2 === 0) throw new Error("Timed out");
  } else {
    await wait(url.includes("docs.") ? 600 : 1300);
  }
  return pages[url];
};

function Avatar({ initials }: { initials: string }) {
  return (
    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-frame text-[11px] font-medium text-fg-2">
      {initials}
    </span>
  );
}

// A team channel: a link in a sentence that previews on hover, a post that unfurls with its
// image, and a status link that fails once, retries, and falls back to the site's letter.
export default function Demo() {
  const [run, setRun] = useState(0);
  const [removed, setRemoved] = useState(false);

  return (
    <section aria-label="#launch" className="flex w-full max-w-[440px] flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-fg">
          <span className="text-fg-4">#</span>launch
        </p>
        <button
          type="button"
          onClick={() => {
            clearLinkPreviews();
            statusAttempts = 0;
            setRemoved(false);
            setRun((r) => r + 1);
          }}
          className={cn(
            "-mr-2 inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none",
            "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          )}
        >
          <Refresh size={14} className="text-fg-3" />
          Reload previews
        </button>
      </div>

      <ul key={run} className="flex flex-col gap-5">
        <li className="flex gap-3">
          <Avatar initials="MC" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-[13px] leading-5 text-fg-2 text-pretty">
              <span className="font-medium text-fg">Maya Chen</span> Post is up, same shape as the{" "}
              <LinkPreviewLink href="https://docs.northwind.co/api/rate-limits" load={load} onClick={(e) => e.preventDefault()}>
                rate limits guide
              </LinkPreviewLink>
              .
            </p>
            <LinkPreview url="https://northwind.co/blog/usage-based-billing" load={load} className="max-w-[300px]" onClick={(e) => e.preventDefault()} />
          </div>
        </li>
        <li className="flex gap-3">
          <Avatar initials="DP" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-[13px] leading-5 text-fg-2">
              <span className="font-medium text-fg">Dev Patel</span> For the incident review:
            </p>
            {removed ? (
              <p className="text-[12px] text-fg-4">Preview removed</p>
            ) : (
              <LinkPreview
                url="https://status.relay.dev/incidents/q7m2"
                load={load}
                layout="row"
                onRemove={() => setRemoved(true)}
                onClick={(e) => e.preventDefault()}
              />
            )}
          </div>
        </li>
      </ul>
    </section>
  );
}
