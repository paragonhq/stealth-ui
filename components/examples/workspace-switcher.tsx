"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Folder, Inbox, Settings, Users } from "@/lib/icons";
import { type Workspace, WorkspaceSwitcher } from "@/components/ui/workspace-switcher";

const Mark = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path d="M2 13 8 3l6 10H10.5L8 8.6 5.5 13z" />
  </svg>
);

const initial: Workspace[] = [
  { id: "northwind", name: "Northwind", plan: "Pro", detail: "24 members", logo: <Mark /> },
  { id: "acme", name: "Acme Studio", plan: "Team", detail: "8 members" },
  { id: "halcyon", name: "Halcyon Labs", plan: "Enterprise", detail: "SSO required" },
  { id: "paperplane", name: "Paperplane", plan: "Pro", detail: "3 members" },
  { id: "riley", name: "Riley’s projects", plan: "Free", detail: "Personal" },
];

// A sidebar header. Switching takes a beat like a real one (the data reloads), and
// Halcyon Labs refuses without SSO, so the revert can be seen too.
export default function Demo() {
  const [workspaces, setWorkspaces] = useState(initial);
  const [current, setCurrent] = useState("northwind");

  const nav = [
    { icon: Inbox, label: "Inbox", count: 4 },
    { icon: Folder, label: "Projects" },
    { icon: Users, label: "Members" },
    { icon: Settings, label: "Settings" },
  ];
  const name = workspaces.find((w) => w.id === current)?.name;

  return (
    <div className="flex w-full max-w-[520px] items-stretch overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)]">
      <aside className="flex w-[240px] shrink-0 flex-col gap-3 border-r border-line p-2 max-sm:w-full max-sm:border-r-0">
        <WorkspaceSwitcher
          workspaces={workspaces}
          value={current}
          shortcut="alt"
          onValueChange={(id) =>
            new Promise<void>((resolve, reject) =>
              setTimeout(() => {
                if (id === "halcyon") return reject(new Error("SSO required"));
                setCurrent(id);
                resolve();
              }, 700),
            )
          }
          onCreate={(typed) => {
            const title = typed || `Untitled ${workspaces.length + 1}`;
            const id = `ws-${workspaces.length + 1}`;
            setWorkspaces((all) => [...all, { id, name: title, plan: "Free", detail: "Just you" }]);
            setCurrent(id);
          }}
        />
        <nav aria-label="Workspace" className="flex flex-col gap-px">
          {nav.map(({ icon: Icon, label, count }, i) => (
            <a
              key={label}
              href="#"
              onClick={(e) => e.preventDefault()}
              aria-current={i === 0 ? "page" : undefined}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] outline-none transition-colors focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
                i === 0 ? "bg-hover text-fg" : "text-fg-2 hover:bg-hover hover:text-fg",
              )}
            >
              <Icon size={15} className="text-fg-3" />
              <span className="flex-1">{label}</span>
              {count && <span className="text-[11.5px] text-fg-3 tabular">{count}</span>}
            </a>
          ))}
        </nav>
        <p className="mt-auto px-2.5 pb-1 text-[11.5px] leading-[16px] text-fg-4">
          <kbd className="font-mono">⌥1</kbd>–<kbd className="font-mono">⌥{Math.min(workspaces.length, 9)}</kbd> switch from anywhere
        </p>
      </aside>
      <section className="flex min-h-[300px] flex-1 flex-col gap-2 p-5 max-sm:hidden">
        <p className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">Inbox</p>
        <p className="text-[15px] font-medium tracking-[-0.015em] text-fg">{name}</p>
        {[72, 88, 60].map((w) => (
          <div key={w} className="mt-2 h-2 rounded-full bg-hover" style={{ width: `${w}%` }} />
        ))}
      </section>
    </div>
  );
}
