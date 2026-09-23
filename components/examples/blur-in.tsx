"use client";
import { useRef, useState } from "react";
import { Refresh } from "@/lib/icons";
import { BlurIn, BlurInItem } from "@/components/ui/blur-in";

const stats = [
  { label: "Revenue", value: "$48.2k", delta: "+12%", up: true },
  { label: "Teams", value: "1,284", delta: "+38", up: true },
  { label: "Churn", value: "1.9%", delta: "+0.3%", up: false },
];

const releases = [
  { v: "2.14", date: "Sep 22", title: "Deploy previews for every branch", body: "Each push gets its own URL, posted to the pull request." },
  { v: "2.13", date: "Sep 15", title: "Audit log export", body: "Download 90 days of workspace events as CSV or JSON." },
  { v: "2.12", date: "Sep 8", title: "Faster cold starts", body: "Functions now boot in under 120 ms at the 95th percentile." },
  { v: "2.11", date: "Sep 1", title: "Scoped API keys", body: "Limit a key to one project and read-only access." },
  { v: "2.10", date: "Aug 25", title: "Two-person approval for production", body: "Require a second reviewer before a deploy goes live." },
  { v: "2.9", date: "Aug 18", title: "Usage alerts", body: "Get an email when a project passes 80% of its quota." },
];

// A dashboard's first paint staggers in once; release notes further down reveal
// as they scroll into their panel.
export default function Demo() {
  const [run, setRun] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3">
      <section aria-labelledby="bi-summary" className="rounded-xl border border-line-2 bg-raised p-4 shadow-[var(--shadow)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 id="bi-summary" className="text-[14px] font-medium tracking-[-0.015em] text-fg">
              This week
            </h3>
            <p className="truncate text-[12px] text-fg-3">Sep 16–22 vs last week</p>
          </div>
          <button
            type="button"
            onClick={() => setRun((r) => r + 1)}
            className="group/replay inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
          >
            <Refresh size={14} className="transition-transform duration-300 ease-out-expo group-active/replay:-rotate-45" />
            Replay
          </button>
        </div>

        {/* A new key remounts it, which replays the reveal. */}
        <BlurIn key={run} as="ul" trigger="mount" stagger aria-label="Weekly metrics" className="mt-3 grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <BlurInItem as="li" key={s.label} className="min-w-0 rounded-lg border border-line bg-frame px-2.5 py-2">
              <p className="truncate text-[11.5px] text-fg-3">{s.label}</p>
              <p className="mt-0.5 truncate text-[16px] font-medium tracking-[-0.02em] text-fg tabular">{s.value}</p>
              <p className={`truncate text-[11.5px] tabular ${s.up ? "text-success" : "text-danger"}`}>{s.delta}</p>
            </BlurInItem>
          ))}
        </BlurIn>
      </section>

      <section aria-labelledby="bi-releases" className="overflow-hidden rounded-xl border border-line-2 bg-raised shadow-[var(--shadow)]">
        <div className="flex h-10 items-center justify-between border-b border-line px-4">
          <h3 id="bi-releases" className="text-[13px] font-medium tracking-[-0.005em] text-fg">
            What’s new
          </h3>
          <span className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3 tabular">{releases.length} releases</span>
        </div>
        <div
          ref={scroller}
          role="region"
          tabIndex={0}
          aria-label="Release notes"
          className="h-[216px] overflow-y-auto overscroll-contain outline-none [scrollbar-width:thin] focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-fg-3"
        >
          <ol key={run} className="flex flex-col">
            {releases.map((r) => (
              <BlurIn as="li" key={r.v} root={scroller} y={6} blur={3} duration={0.4} className="border-b border-line px-4 py-3 last:border-b-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 text-[13px] font-medium text-fg">{r.title}</p>
                  <p className="shrink-0 font-mono text-2xs text-fg-4 tabular">
                    v{r.v} · {r.date}
                  </p>
                </div>
                <p className="mt-0.5 text-[12px] leading-[1.5] text-fg-3">{r.body}</p>
              </BlurIn>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
