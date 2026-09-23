"use client";
import { useState } from "react";
import { Tabs, TabsList, TabsPanel, TabsPanels, TabsTab } from "@/components/ui/tabs";

const Box = (p: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.4}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    {...p}
  >
    <path d="M8 2.25 13.25 5v6L8 13.75 2.75 11V5zM2.75 5 8 7.75 13.25 5M8 7.75v6" />
  </svg>
);
const Pulse = (p: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.4}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    {...p}
  >
    <path d="M1.75 8h2.5l1.5-4 3 8 1.5-4h4" />
  </svg>
);
const Lines = (p: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.4}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    {...p}
  >
    <path d="M2.75 4h10.5M2.75 8h7M2.75 12h9" />
  </svg>
);

const deployments = [
  {
    id: "dpl_7f2k",
    branch: "main",
    note: "Fix invoice rounding on annual plans",
    when: "4m ago",
    state: "Ready",
  },
  {
    id: "dpl_7e9a",
    branch: "feat/usage-alerts",
    note: "Add usage alerts at 80% of quota",
    when: "38m ago",
    state: "Building",
  },
  {
    id: "dpl_7d1c",
    branch: "main",
    note: "Bump pricing page copy",
    when: "2h ago",
    state: "Ready",
  },
];

const issues = [
  {
    id: "BIL-214",
    title: "Proration shows a negative total after downgrade",
    status: "open",
  },
  {
    id: "BIL-209",
    title: "Tax ID field rejects valid VAT numbers from Ireland",
    status: "open",
  },
  {
    id: "BIL-198",
    title: "Invoice PDF cuts off long company names",
    status: "closed",
  },
];

export default function Demo() {
  const [open, setOpen] = useState(12);
  const [resolved, setResolved] = useState<string[]>([]);

  return (
    <div className="flex w-full max-w-[480px] flex-col gap-8">
      {/* A project page: overflowing underline tabs with icons, a count and a changed dot. */}
      <Tabs
        defaultValue="deployments"
        className="rounded-xl border border-line bg-raised shadow-[var(--shadow)]"
      >
        <TabsList aria-label="Project" wrapperClassName="px-2">
          <TabsTab value="overview" icon={<Box />}>
            Overview
          </TabsTab>
          <TabsTab value="deployments" icon={<Pulse />} count={24}>
            Deployments
          </TabsTab>
          <TabsTab value="logs" icon={<Lines />}>
            Logs
          </TabsTab>
          <TabsTab value="analytics">Analytics</TabsTab>
          <TabsTab value="speed">Speed insights</TabsTab>
          <TabsTab value="storage" disabled>
            Storage
          </TabsTab>
          <TabsTab value="settings" dot>
            Settings
          </TabsTab>
        </TabsList>
        <TabsPanels className="p-4">
          <TabsPanel value="overview">
            <dl className="grid grid-cols-3 gap-3">
              {[
                ["Requests", "1.28M"],
                ["Error rate", "0.04%"],
                ["p95", "182 ms"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex flex-col gap-1 rounded-lg border border-line px-3 py-2.5"
                >
                  <dt className="text-[11.5px] text-fg-3">{k}</dt>
                  <dd className="tabular text-[15px] font-medium tracking-[-0.015em]">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </TabsPanel>
          <TabsPanel value="deployments">
            <ul className="-my-1 flex flex-col">
              {deployments.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-3 border-b border-line py-2.5 last:border-0"
                >
                  <span
                    className={
                      d.state === "Ready"
                        ? "size-1.5 shrink-0 rounded-full bg-success"
                        : "size-1.5 shrink-0 animate-pulse-soft rounded-full bg-warning"
                    }
                    aria-hidden
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] text-fg">
                      {d.note}
                    </span>
                    <span className="truncate font-mono text-[11px] text-fg-3">
                      {d.branch} · {d.id}
                    </span>
                  </div>
                  <span className="shrink-0 text-[12px] text-fg-3">
                    {d.state === "Ready" ? d.when : "Building…"}
                  </span>
                </li>
              ))}
            </ul>
          </TabsPanel>
          <TabsPanel value="logs">
            <pre className="overflow-x-auto rounded-lg bg-page px-3 py-2.5 font-mono text-[11.5px] leading-[1.7] text-fg-2">
              {
                "12:04:31  GET  /api/invoices      200  41ms\n12:04:33  POST /api/checkout      201  212ms\n12:04:36  GET  /api/usage         200  18ms"
              }
            </pre>
          </TabsPanel>
          <TabsPanel value="analytics">
            <p className="text-[13px] text-fg-2">
              Visitors are up 18% on last week, mostly from the pricing page.
            </p>
          </TabsPanel>
          <TabsPanel value="speed">
            <p className="text-[13px] text-fg-2">
              Largest contentful paint is 1.4 s at the 75th percentile.
            </p>
          </TabsPanel>
          <TabsPanel value="settings">
            <p className="text-[13px] text-fg-2">
              The production branch changed to main. Review the build command
              before the next deploy.
            </p>
          </TabsPanel>
        </TabsPanels>
      </Tabs>

      {/* Pill tabs as a filter whose counts roll when an issue moves. */}
      <Tabs defaultValue="open" variant="pill" size="sm">
        <div className="flex items-center justify-between gap-3">
          <TabsList aria-label="Filter issues">
            <TabsTab value="open" count={open}>
              Open
            </TabsTab>
            <TabsTab value="closed" count={41 + resolved.length}>
              Closed
            </TabsTab>
            <TabsTab value="all" count={53}>
              All
            </TabsTab>
          </TabsList>
        </div>
        <TabsPanels className="mt-2">
          {(["open", "closed", "all"] as const).map((tab) => {
            const rows = issues
              .map((i) => ({
                ...i,
                status: resolved.includes(i.id) ? "closed" : i.status,
              }))
              .filter((i) => tab === "all" || i.status === tab);
            return (
              <TabsPanel key={tab} value={tab}>
                {rows.length === 0 && (
                  <p className="flex h-9 items-center text-[13px] text-fg-3">
                    No open issues on this page
                  </p>
                )}
                <ul className="flex flex-col">
                  {rows.map((i) => (
                    <li
                      key={i.id}
                      className="flex h-9 items-center gap-3 border-b border-line last:border-0"
                    >
                      <span className="w-[52px] shrink-0 font-mono text-[11px] text-fg-3">
                        {i.id}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        {i.title}
                      </span>
                      {i.status === "open" && (
                        <button
                          type="button"
                          onClick={() => {
                            setResolved((r) => [...r, i.id]);
                            setOpen((n) => n - 1);
                          }}
                          className="h-6 shrink-0 rounded-md px-2 text-[12px] text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.96]"
                        >
                          Close issue
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </TabsPanel>
            );
          })}
        </TabsPanels>
      </Tabs>
    </div>
  );
}
