"use client";
import { useState } from "react";
import { SubNav, SubNavItem } from "@/components/ui/sub-nav";

const pages = [
  { id: "overview", label: "Overview", note: "Last commit 4m ago by Maya Okafor on main." },
  { id: "issues", label: "Issues", count: 12, note: "12 open, 41 closed. 3 are assigned to you." },
  { id: "pulls", label: "Pull requests", count: 3, note: "3 open. “Add usage alerts” is waiting on your review." },
  { id: "deployments", label: "Deployments", note: "Production is on dpl_7f2k, deployed 4m ago." },
  { id: "observability", label: "Observability", note: "p95 latency 182 ms over the last 24 hours." },
  { id: "storage", label: "Storage", note: "2 buckets, 14.2 GB of 50 GB used." },
  { id: "firewall", label: "Firewall", disabled: true, note: "" },
  { id: "settings", label: "Settings", note: "Production branch, build command and environment variables." },
];

// A repository header: the strip overflows at this width, so the fades and arrows show.
export default function Demo() {
  const [current, setCurrent] = useState("issues");

  return (
    <div className="w-full max-w-[460px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex items-center gap-2 px-4 pt-3.5 text-[13px]">
        <span className="text-fg-3">northwind</span>
        <span className="text-fg-4">/</span>
        <span className="truncate font-medium text-fg">billing-service</span>
      </div>
      <SubNav aria-label="Repository" className="px-2">
        {pages.map((p) => (
          <SubNavItem
            key={p.id}
            href={`#${p.id}`}
            active={current === p.id}
            count={p.count}
            disabled={p.disabled}
            onClick={(e) => {
              e.preventDefault();
              setCurrent(p.id);
            }}
          >
            {p.label}
          </SubNavItem>
        ))}
      </SubNav>
      <div className="flex h-28 flex-col justify-center gap-1 px-4">
        <p className="text-[14px] font-medium tracking-[-0.015em] text-fg">{pages.find((p) => p.id === current)?.label}</p>
        <p className="text-[12.5px] text-fg-3">{pages.find((p) => p.id === current)?.note}</p>
      </div>
    </div>
  );
}
