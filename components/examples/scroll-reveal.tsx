"use client";
import { useRef } from "react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const entries = [
  {
    date: "22 Sep",
    version: "v4.12",
    title: "Branch previews for every pull request",
    body: "Each push to a branch now builds its own preview with a stable URL, posted on the pull request and torn down when it merges.",
    stats: [
      ["38s", "median build"],
      ["1,204", "previews"],
      ["0", "config files"],
    ],
  },
  {
    date: "15 Sep",
    version: "v4.11",
    title: "Audit log export",
    body: "Owners can export up to 90 days of audit events as CSV or send them to a webhook as they happen.",
  },
  {
    date: "8 Sep",
    version: "v4.10",
    title: "Faster cold starts in eu-west-2",
    body: "Functions in London now boot from a warm snapshot. Cold starts dropped from 410 ms to 120 ms at the 95th percentile.",
  },
  {
    date: "1 Sep",
    version: "v4.9",
    title: "Roles for billing",
    body: "A new Billing role can manage invoices and payment methods without access to projects or secrets.",
  },
  {
    date: "25 Aug",
    version: "v4.8",
    title: "Keyboard shortcuts everywhere",
    body: "Press ? on any screen to see what it supports. G then P jumps to projects; G then S to settings.",
  },
];

// A changelog in its own scroll container: each entry arrives as it scrolls
// in, once; the stats in the first entry arrive together with a short stagger.
export default function Demo() {
  const scroller = useRef<HTMLDivElement>(null);

  return (
    <div className="w-full max-w-[460px] overflow-hidden rounded-xl border border-line-2 bg-raised shadow-[var(--shadow)]">
      <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Changelog</h3>
        <span className="text-[12px] text-fg-3">Scroll to read</span>
      </div>
      <div
        ref={scroller}
        tabIndex={0}
        aria-label="Changelog entries"
        className="h-[360px] overflow-y-auto overscroll-contain px-4 outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-fg-4"
      >
        <ScrollReveal as="ol" each root={scroller} className="flex flex-col py-2">
          {entries.map((e, i) => (
            <li key={e.version} className="grid gap-2 border-b sm:grid-cols-[64px_1fr] sm:gap-3 border-line py-5 last:border-b-0">
              <div className="flex items-baseline gap-2 pt-0.5 sm:flex-col sm:items-start sm:gap-1">
                <time className="text-[12px] text-fg-2 tabular">{e.date}</time>
                <span className="font-mono text-2xs text-fg-3">{e.version}</span>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <h4 className="text-[14px] font-medium leading-snug tracking-[-0.01em] text-fg text-balance">{e.title}</h4>
                <p className="text-[13px] leading-relaxed text-fg-2 text-pretty">{e.body}</p>
                {i === 0 && e.stats && (
                  <ScrollReveal root={scroller} delay={0.15} className="mt-2 grid grid-cols-3 gap-2">
                    {e.stats.map(([value, label]) => (
                      <div key={label} className="flex flex-col gap-0.5 rounded-lg border border-line bg-frame px-2.5 py-2">
                        <span className="text-[15px] font-medium tracking-[-0.015em] text-fg tabular">{value}</span>
                        <span className="text-[11.5px] leading-tight text-fg-3">{label}</span>
                      </div>
                    ))}
                  </ScrollReveal>
                )}
              </div>
            </li>
          ))}
        </ScrollReveal>
      </div>
    </div>
  );
}
