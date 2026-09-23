"use client";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Bolt, Code, Folder, Globe, Lock, Sliders, Sparkle, Users } from "@/lib/icons";
import { MobileMenu, MobileMenuClose, type MobileMenuItem } from "@/components/ui/mobile-menu";

const items: MobileMenuItem[] = [
  {
    label: "Product",
    items: [
      { label: "Issues", href: "#issues", description: "Track work across every team", icon: <Bolt /> },
      { label: "Cycles", href: "#cycles", description: "Plan in focused two-week runs", icon: <Sliders /> },
      { label: "Insights", href: "#insights", description: "Charts built from your own data", icon: <Sparkle /> },
      { label: "Integrations", href: "#integrations", description: "Connect GitHub, Slack and 40 more tools", icon: <Code /> },
    ],
  },
  {
    label: "Solutions",
    items: [
      { label: "Engineering", href: "#engineering", description: "Ship on a steady cadence", icon: <Code /> },
      { label: "Design", href: "#design", description: "From review to handoff in one place", icon: <Folder /> },
      {
        label: "Industries",
        description: "Fintech, healthcare and public sector",
        icon: <Globe />,
        items: [
          { label: "Fintech", href: "#fintech", description: "Audit trails and approvals built in", icon: <Lock /> },
          { label: "Healthcare", href: "#healthcare", description: "HIPAA-ready workspaces", icon: <Users /> },
          { label: "Public sector", href: "#public-sector", description: "Hosted in your region", icon: <Globe /> },
        ],
      },
    ],
  },
  { label: "Pricing", href: "#pricing" },
  { label: "Customers", href: "#customers" },
  { label: "Changelog", href: "#changelog" },
];

const titles: Record<string, string> = { "#pricing": "Pricing", "#customers": "Customers", "#changelog": "Changelog", "#signin": "Sign in", "#start": "Start for free" };

// A marketing site on a phone. Open the menu, drill into Solutions → Industries, go back with the arrow or Escape.
export default function Demo() {
  const screen = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState("#home");
  const name = titles[page] ?? (page === "#home" ? null : page.slice(1).replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()));

  return (
    <div className="rounded-[38px] border border-line-2 bg-raised p-2 shadow-[var(--shadow)]">
      <div ref={screen} className="relative flex h-[500px] w-[272px] flex-col overflow-hidden rounded-[30px] bg-frame">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line pl-4 pr-2">
          <span className="flex items-center gap-2 text-[15px] font-medium tracking-[-0.02em]">
            <span aria-hidden className="grid size-6 place-items-center rounded-md bg-fg text-[11px] font-semibold text-frame">N</span>
            Northwind
          </span>
          <MobileMenu
            items={items}
            container={screen}
            current={page}
            onNavigate={(item, e) => {
              e.preventDefault();
              if (item.href) setPage(item.href);
            }}
            footer={
              <>
                <MobileMenuClose onClick={() => setPage("#signin")} className={cn(btn, "border border-line-2 bg-raised text-fg")}>
                  Sign in
                </MobileMenuClose>
                <MobileMenuClose onClick={() => setPage("#start")} className={cn(btn, "bg-fg text-frame")}>
                  Start for free
                </MobileMenuClose>
              </>
            }
          />
        </header>
        <main className="flex flex-1 flex-col gap-3 px-5 pt-10">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-3">{name ?? "Northwind"}</p>
          <h1 className="text-[26px] font-medium leading-[1.1] tracking-[-0.03em] text-balance">{name ? `${name} at Northwind` : "Plan, build and ship in one place"}</h1>
          <p className="text-[15px] leading-[1.5] text-fg-2">Issues, cycles and roadmaps for teams that would rather be building.</p>
        </main>
      </div>
    </div>
  );
}

const btn =
  "h-11 rounded-lg text-[15px] font-medium outline-none transition-[scale,opacity] duration-150 active:scale-[0.97] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3";
