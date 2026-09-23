"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { Link, Monitor, Moon, Sun } from "@/lib/icons";
import { spring } from "@/lib/motion";
import { Kbd } from "@/components/ui/kbd";
import { CommandPaletteTrigger } from "@/components/ui/command-palette";
import { CommandPages, type CommandPage } from "@/components/ui/command-pages";

type Status = "backlog" | "todo" | "progress" | "review" | "done";
const statuses: [Status, string][] = [
  ["backlog", "Backlog"],
  ["todo", "Todo"],
  ["progress", "In progress"],
  ["review", "In review"],
  ["done", "Done"],
];
const people = [
  ["none", "Unassigned", ""],
  ["maya", "Maya Chen", "MC"],
  ["jonas", "Jonas Weber", "JW"],
  ["priya", "Priya Raman", "PR"],
  ["sam", "Sam Okafor", "SO"],
] as const;
const priorities = [
  ["urgent", "Urgent", 4],
  ["high", "High", 3],
  ["medium", "Medium", 2],
  ["low", "Low", 1],
] as const;

// An issue whose status, owner and priority are set from nested palette pages.
export default function Demo() {
  const frame = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("progress");
  const [owner, setOwner] = useState<string>("maya");
  const [priority, setPriority] = useState<string>("high");
  const [theme, setTheme] = useState("system");

  const pages = useMemo<Record<string, CommandPage>>(
    () => ({
      root: {
        title: "ENG-482",
        placeholder: "Type a command or search…",
        groups: [
          {
            heading: "ENG-482",
            items: [
              { id: "status", label: "Change status…", icon: <StatusIcon status={status} />, to: "status", keywords: ["state", "move"] },
              { id: "assign", label: "Assign to…", icon: <PersonIcon initials={people.find((p) => p[0] === owner)?.[2] ?? ""} />, to: "assign", keywords: ["owner", "assignee"] },
              { id: "priority", label: "Set priority…", icon: <PriorityIcon level={priorities.find((p) => p[0] === priority)?.[2] ?? 0} />, to: "priority" },
              { id: "copy", label: "Copy issue link", icon: <Link />, shortcut: "mod+shift+c" },
            ],
          },
          { heading: "Workspace", items: [{ id: "theme", label: "Change theme…", icon: <Sun />, to: "theme", keywords: ["dark", "light", "appearance"] }] },
        ],
      },
      status: {
        title: "Status",
        placeholder: "Change status…",
        groups: [{ heading: "Status", items: statuses.map(([id, label]) => ({ id, label, icon: <StatusIcon status={id} />, checked: status === id, onSelect: () => setStatus(id) })) }],
      },
      assign: {
        title: "Assign",
        placeholder: "Assign to…",
        groups: [
          {
            heading: "People",
            items: people.map(([id, label, initials]) => ({
              id,
              label,
              hint: id === "maya" ? "You" : undefined,
              icon: <PersonIcon initials={initials} />,
              checked: owner === id,
              onSelect: () => setOwner(id),
            })),
          },
        ],
      },
      priority: {
        title: "Priority",
        placeholder: "Set priority…",
        groups: [{ heading: "Priority", items: priorities.map(([id, label, n]) => ({ id, label, icon: <PriorityIcon level={n} />, checked: priority === id, onSelect: () => setPriority(id) })) }],
      },
      theme: {
        title: "Theme",
        placeholder: "Change theme…",
        groups: [
          {
            heading: "Theme",
            items: [
              { id: "system", label: "Match system", icon: <Monitor />, checked: theme === "system", onSelect: () => setTheme("system") },
              { id: "light", label: "Light", icon: <Sun />, checked: theme === "light", onSelect: () => setTheme("light") },
              { id: "dark", label: "Dark", icon: <Moon />, checked: theme === "dark", onSelect: () => setTheme("dark") },
            ],
          },
        ],
      },
    }),
    [status, owner, priority, theme],
  );

  const person = people.find((p) => p[0] === owner)!;
  const prio = priorities.find((p) => p[0] === priority)!;

  return (
    <div
      ref={frame}
      tabIndex={-1}
      className="relative flex h-[440px] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)] outline-none"
    >
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-3">
        <span className="shrink-0 font-mono text-[11px] text-fg-3">ENG-482</span>
        <div className="flex min-w-0 flex-1 justify-end">
          <CommandPages pages={pages} container={frame} hotkeyTarget={frame} footer="ENG-482">
            <CommandPaletteTrigger label="Command…" className="max-w-[200px]" />
          </CommandPages>
        </div>
      </div>

      <div className="flex-1 px-5 py-5">
        <h3 className="text-[15px] font-medium tracking-[-0.015em] text-fg text-balance">Retry failed webhooks with exponential backoff</h3>
        <p className="mt-1.5 max-w-[46ch] text-[12.5px] leading-[1.5] text-fg-3 text-pretty">
          Deliveries that time out are dropped today. Retry up to 8 times over 24 hours, then mark the endpoint unhealthy.
        </p>
        <dl className="mt-5 grid grid-cols-[88px_1fr] gap-y-2.5 text-[12.5px]">
          <dt className="text-fg-3">Status</dt>
          <Prop k={status}>
            <StatusIcon status={status} />
            {statuses.find((s) => s[0] === status)![1]}
          </Prop>
          <dt className="text-fg-3">Assignee</dt>
          <Prop k={owner}>
            <PersonIcon initials={person[2]} />
            {person[1]}
          </Prop>
          <dt className="text-fg-3">Priority</dt>
          <Prop k={priority}>
            <PriorityIcon level={prio[2]} />
            {prio[1]}
          </Prop>
        </dl>
      </div>

      <p className="flex h-9 shrink-0 items-center border-t border-line px-3 text-[12px] text-fg-3">
        <span className="truncate">
          Click in the window, press <Kbd keys="mod+k" size="sm" className="mx-0.5" /> and choose <span className="text-fg-2">Change status…</span>
        </span>
      </p>
    </div>
  );
}

// A property value that swaps in place when the palette changes it.
function Prop({ k, children }: { k: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <dd className="relative flex h-5 items-center overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={k}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(2px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(2px)" }}
          transition={reduce ? { duration: 0.12 } : spring.pop}
          className="flex items-center gap-2 text-fg [&_svg]:shrink-0"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </dd>
  );
}

function StatusIcon({ status }: { status: Status }) {
  const fill = { backlog: 0, todo: 0, progress: 0.5, review: 0.75, done: 1 }[status];
  const r = 3.5;
  const c = 2 * Math.PI * r;
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden className={status === "done" ? "text-success" : "text-fg-2"}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth={1.4} strokeDasharray={status === "backlog" ? "2 2.2" : undefined} />
      {fill > 0 && fill < 1 && (
        <circle cx="8" cy="8" r={r} stroke="currentColor" strokeWidth={r * 2} strokeDasharray={`${c * fill} ${c}`} transform="rotate(-90 8 8)" />
      )}
      {status === "done" && (
        <>
          <circle cx="8" cy="8" r="6" fill="currentColor" />
          <path d="m5.4 8.2 1.8 1.8 3.4-3.8" stroke="var(--frame)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

function PersonIcon({ initials }: { initials: string }) {
  if (!initials)
    return (
      <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeDasharray="2 2" aria-hidden className="text-fg-3">
        <circle cx="8" cy="8" r="6" />
      </svg>
    );
  return <span className="grid size-4 place-items-center rounded-full bg-fg/10 text-[7.5px] font-semibold tracking-[0.02em] text-fg-2">{initials}</span>;
}

function PriorityIcon({ level }: { level: number }) {
  if (level === 4)
    return (
      <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden className="text-warning">
        <rect x="2" y="2" width="12" height="12" rx="3" fill="currentColor" />
        <path d="M8 4.8v3.6" stroke="var(--frame)" strokeWidth={1.6} strokeLinecap="round" />
        <circle cx="8" cy="11" r="0.9" fill="var(--frame)" />
      </svg>
    );
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden className="text-fg-2">
      {[0, 1, 2].map((i) => (
        <rect key={i} x={2.5 + i * 4} y={10 - i * 3} width="3" height={4 + i * 3} rx="1" fill="currentColor" opacity={i < level ? 1 : 0.25} />
      ))}
    </svg>
  );
}
