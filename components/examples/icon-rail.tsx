"use client";
import { useState } from "react";
import { Calendar, Folder, Home, Inbox, Settings, Users } from "@/lib/icons";
import { IconRail, IconRailContent, IconRailFooter, IconRailGroup, IconRailHeader, IconRailItem, IconRailToggle } from "@/components/ui/icon-rail";

const titles: Record<string, string> = {
  home: "Home",
  inbox: "Inbox",
  calendar: "Calendar",
  projects: "Projects",
  people: "People",
  design: "Design reviews",
  support: "Customer support escalations",
  settings: "Settings",
};

const rows: Record<string, string[]> = {
  inbox: ["Priya Raman replied in Q3 roadmap", "Invoice INV-2041 was paid", "Tom Becker invited you to Growth", "Deploy to production finished"],
  projects: ["Billing migration", "Onboarding checklist v2", "Mobile app offline mode"],
  home: ["You have 4 unread in Inbox", "2 projects due this week"],
};

function TeamTile({ letter }: { letter: string }) {
  return <span className="grid size-4 place-items-center rounded-[4px] border border-line-2 bg-raised font-mono text-[9px] leading-none text-fg-2">{letter}</span>;
}

// A workspace shell: fold the rail with the button or ⌘B / Ctrl+B, then hover the icons.
export default function Demo() {
  const [value, setValue] = useState<string | null>("inbox");
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-[420px] w-full max-w-[520px] overflow-hidden rounded-xl border border-line-2 bg-frame shadow-[var(--shadow)]">
      <IconRail value={value} onValueChange={setValue} collapsed={collapsed} onCollapsedChange={setCollapsed}>
        <IconRailHeader
          mark={<span className="grid size-6 place-items-center rounded-md bg-fg text-[11px] font-semibold text-frame">N</span>}
          title="Northwind"
        />
        <IconRailContent aria-label="Workspace">
          <IconRailGroup>
            <IconRailItem value="home" icon={<Home />}>Home</IconRailItem>
            <IconRailItem value="inbox" icon={<Inbox />} count={4}>Inbox</IconRailItem>
            <IconRailItem value="calendar" icon={<Calendar />}>Calendar</IconRailItem>
            <IconRailItem value="projects" icon={<Folder />} count={12}>Projects</IconRailItem>
            <IconRailItem value="people" icon={<Users />}>People</IconRailItem>
          </IconRailGroup>
          <IconRailGroup label="Teams">
            <IconRailItem value="design" icon={<TeamTile letter="D" />}>Design reviews</IconRailItem>
            <IconRailItem value="support" icon={<TeamTile letter="S" />}>Customer support escalations</IconRailItem>
          </IconRailGroup>
        </IconRailContent>
        <IconRailFooter>
          <IconRailItem value="settings" icon={<Settings />}>Settings</IconRailItem>
          <IconRailToggle />
        </IconRailFooter>
      </IconRail>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center border-b border-line px-4">
          <h2 className="truncate text-[13px] font-medium tracking-[-0.01em]">{value ? titles[value] : ""}</h2>
        </div>
        <div className="flex flex-1 flex-col gap-1 p-2">
          {(rows[value ?? ""] ?? []).map((row) => (
            <div key={row} className="flex h-9 min-w-0 items-center gap-2.5 rounded-md px-2 text-[12.5px] text-fg-2">
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-line-2" />
              <span className="truncate">{row}</span>
            </div>
          ))}
          {!rows[value ?? ""] && <p className="px-2 py-2.5 text-[12.5px] text-fg-3">Nothing new in {value ? titles[value] : "here"}</p>}
          <p className="mt-auto hidden px-2 pb-1 text-[12px] text-fg-3 sm:block">{collapsed ? "Hover an icon for its name." : "Fold the rail to give this page more room."}</p>
        </div>
      </main>
    </div>
  );
}
