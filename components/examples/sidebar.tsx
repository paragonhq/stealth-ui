"use client";
import { Menu } from "@base-ui/react/menu";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { File, Filter, Folder, Inbox, Pencil, Star, Users } from "@/lib/icons";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarItem, SidebarUser } from "@/components/ui/sidebar";

const titles: Record<string, string> = {
  inbox: "Inbox",
  issues: "My issues",
  drafts: "Drafts",
  projects: "Projects",
  views: "Views",
  members: "Members",
  design: "Design",
  eng: "Engineering",
  growth: "Growth analytics and lifecycle marketing",
  q3: "Q3 launch plan",
  billing: "Billing migration",
};

// A small issue glyph drawn on the icon grid: a ring with a dot, 1.4 stroke.
function IssueIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <circle cx="8" cy="8" r="5.25" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TeamTile({ letter }: { letter: string }) {
  return <span className="grid size-4 place-items-center rounded-[4px] border border-line-2 bg-raised font-mono text-[9px] leading-none text-fg-2">{letter}</span>;
}

// A workspace in the middle of the day: opening Inbox reads it, and New issue adds to yours.
export default function Demo() {
  const [value, setValue] = useState<string | null>("issues");
  const [unread, setUnread] = useState(3);
  const [issues, setIssues] = useState(12);

  useEffect(() => {
    if (value !== "inbox" || unread === 0) return;
    const t = window.setTimeout(() => setUnread(0), 900);
    return () => window.clearTimeout(t);
  }, [value, unread]);

  return (
    <div className="flex h-[440px] w-full max-w-[240px] overflow-hidden rounded-xl border border-line-2 bg-frame shadow-[var(--shadow)] sm:max-w-[560px]">
      <Sidebar value={value} onValueChange={setValue} className="border-r-0 sm:border-r">
        <SidebarHeader>
          <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-md bg-fg text-[11px] font-semibold text-frame">N</span>
          <span className="ml-1.5 min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.01em]">Northwind</span>
          <button
            type="button"
            aria-label="New issue"
            onClick={() => {
              setIssues((n) => n + 1);
              setValue("issues");
            }}
            className="relative grid size-7 place-items-center rounded-md text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden"
          >
            <Pencil />
          </button>
        </SidebarHeader>

        <SidebarContent aria-label="Workspace">
          <SidebarGroup>
            <SidebarItem value="inbox" icon={<Inbox />} count={unread}>Inbox</SidebarItem>
            <SidebarItem value="issues" icon={<IssueIcon />} count={issues}>My issues</SidebarItem>
            <SidebarItem value="drafts" icon={<File />}>Drafts</SidebarItem>
          </SidebarGroup>
          <SidebarGroup label="Workspace" collapsible>
            <SidebarItem value="projects" icon={<Folder />}>Projects</SidebarItem>
            <SidebarItem value="views" icon={<Filter />}>Views</SidebarItem>
            <SidebarItem value="members" icon={<Users />}>Members</SidebarItem>
          </SidebarGroup>
          <SidebarGroup label="Your teams" collapsible>
            <SidebarItem value="design" icon={<TeamTile letter="D" />}>Design</SidebarItem>
            <SidebarItem value="eng" icon={<TeamTile letter="E" />}>Engineering</SidebarItem>
            <SidebarItem value="growth" icon={<TeamTile letter="G" />}>{titles.growth}</SidebarItem>
            <SidebarItem value="legal" icon={<TeamTile letter="L" />} disabled>Legal</SidebarItem>
          </SidebarGroup>
          <SidebarGroup label="Favorites" collapsible defaultOpen={false}>
            <SidebarItem value="q3" icon={<Star />}>Q3 launch plan</SidebarItem>
            <SidebarItem value="billing" icon={<Star />}>Billing migration</SidebarItem>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <Menu.Root>
            <Menu.Trigger render={<SidebarUser name="Maya Okafor" description="maya@northwind.dev" status="online" />} />
            <Menu.Portal>
              <Menu.Positioner side="top" align="start" sideOffset={6} className="z-(--z-dropdown) outline-none">
                <Menu.Popup
                  className={cn(
                    "w-(--anchor-width) origin-(--transform-origin) rounded-xl border border-line-2 bg-raised p-1 text-[13px] text-fg shadow-pop outline-none",
                    "transition-[opacity,scale,translate] duration-180 ease-out-expo data-starting-style:translate-y-1 data-starting-style:scale-96 data-starting-style:opacity-0",
                    "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-120 data-instant:duration-0 motion-reduce:scale-100 motion-reduce:translate-none",
                  )}
                >
                  {["Profile", "Keyboard shortcuts"].map((label) => (
                    <Menu.Item key={label} className="flex h-8 cursor-default select-none items-center rounded-lg px-2 outline-none data-highlighted:bg-hover pointer-coarse:h-10">
                      {label}
                    </Menu.Item>
                  ))}
                  <Menu.Separator className="-mx-1 my-1 h-px bg-line" />
                  <Menu.Item className="flex h-8 cursor-default select-none items-center rounded-lg px-2 outline-none data-highlighted:bg-hover pointer-coarse:h-10">Sign out</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </SidebarFooter>
      </Sidebar>

      <Page value={value} unread={unread} issues={issues} />
    </div>
  );
}

function Page({ value, unread, issues }: { value: string | null; unread: number; issues: number }) {
  const title = value ? titles[value] : "";
  const rows =
    value === "inbox"
      ? ["Priya mentioned you in ENG-412", "Deploy to production finished", "Tom assigned you DES-88"]
      : value === "issues"
        ? [...(issues > 12 ? [`ENG-${401 + issues} Untitled issue`] : []), "ENG-412 Retry failed webhooks", "DES-88 Empty state for Projects", "ENG-397 Rate limit the export API"].slice(0, 4)
        : [];
  return (
    <main className="hidden min-w-0 flex-1 flex-col sm:flex">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
        <h2 className="min-w-0 truncate text-[13px] font-medium tracking-[-0.01em]">{title}</h2>
        {value === "inbox" && <span className="shrink-0 text-[12px] tabular text-fg-3">{unread ? `${unread} unread` : "All read"}</span>}
        {value === "issues" && <span className="shrink-0 text-[12px] tabular text-fg-3">{issues} open</span>}
      </div>
      {rows.length ? (
        <ul className="flex flex-col p-2">
          {rows.map((row, i) => (
            <li key={row} className="flex h-9 items-center gap-2.5 rounded-md px-2 text-[12.5px] text-fg-2">
              <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full transition-colors duration-300", value === "inbox" && unread && i < unread ? "bg-fg" : "bg-line-2")} />
              <span className="truncate">{row}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-auto px-6 text-center text-[12.5px] text-fg-3">Nothing in {title} yet</p>
      )}
    </main>
  );
}
