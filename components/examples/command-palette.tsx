"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { Bolt, Folder, Inbox, Link, Moon, Plus, Refresh, Settings, User, Users } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { Kbd } from "@/components/ui/kbd";
import { CommandPalette, CommandPaletteTrigger, type CommandGroup } from "@/components/ui/command-palette";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const issues = [
  ["ENG-482", "Retry failed webhooks with backoff", "In progress"],
  ["ENG-479", "Billing page shows stale plan after upgrade", "Todo"],
  ["ENG-471", "Move invoice PDFs to the new bucket", "In review"],
  ["ENG-466", "Rate limit the public search endpoint", "Todo"],
  ["ENG-460", "Audit log misses API key rotations", "Done"],
];

// A workspace with its palette scoped to the frame: click inside, then press ⌘K.
export default function Demo() {
  const frame = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [last, setLast] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);

  const groups = useMemo<CommandGroup[]>(
    () => [
      {
        heading: "Actions",
        items: [
          { id: "new-issue", label: "Create issue", icon: <Plus />, shortcut: "c", keywords: ["new", "ticket", "bug"] },
          {
            id: "deploy",
            label: "Deploy to production",
            hint: "stealth-web · main",
            icon: <Bolt />,
            shortcut: "mod+shift+d",
            keywords: ["ship", "release"],
            onSelect: () => wait(1100),
          },
          {
            id: "sync",
            label: "Sync GitHub issues",
            icon: <Refresh />,
            keywords: ["import", "refresh"],
            // Fails the first time so the error state can be seen; works on retry.
            onSelect: async () => {
              await wait(800);
              if (!synced) {
                setSynced(true);
                throw new Error("GitHub didn’t respond. Try again.");
              }
            },
          },
          { id: "copy-link", label: "Copy link to issue", hint: "ENG-482", icon: <Link />, shortcut: "mod+shift+c" },
          { id: "theme", label: "Toggle dark mode", icon: <Moon />, shortcut: "mod+shift+l", keywords: ["theme", "light", "appearance"], keepOpen: true },
          { id: "invite", label: "Invite teammate…", icon: <Users />, keywords: ["member", "add people"] },
        ],
      },
      {
        heading: "Go to",
        items: [
          { id: "inbox", label: "Inbox", hint: "3 unread", icon: <Inbox />, shortcut: "g i" },
          { id: "projects", label: "Projects", icon: <Folder />, shortcut: "g p" },
          { id: "settings", label: "Settings", icon: <Settings />, shortcut: "mod+," },
        ],
      },
      {
        heading: "Projects",
        items: [
          { id: "p-web", label: "stealth-web", hint: "Next.js · deployed 12m ago", icon: <Folder /> },
          { id: "p-billing", label: "billing-api", hint: "Go · 2 failing checks", icon: <Folder /> },
          { id: "p-marketing", label: "marketing-site", hint: "Astro · deployed yesterday", icon: <Folder /> },
        ],
      },
      {
        heading: "People",
        items: [
          { id: "u-maya", label: "Maya Chen", hint: "maya@acme.co", icon: <User /> },
          { id: "u-jonas", label: "Jonas Weber", hint: "jonas@acme.co", icon: <User /> },
          { id: "u-priya", label: "Priya Raman", hint: "priya@acme.co", icon: <User /> },
        ],
      },
    ],
    [synced],
  );

  return (
    <div
      ref={frame}
      tabIndex={-1}
      className="relative flex h-[440px] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)] outline-none"
    >
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-3">
        <span className="flex shrink-0 items-center gap-2 text-[13px] font-medium tracking-[-0.01em] text-fg">
          <span className="grid size-5 place-items-center rounded-md bg-fg text-[10px] font-semibold text-frame">A</span>
          <span className="max-sm:hidden">Acme</span>
        </span>
        <div className="flex min-w-0 flex-1 justify-center">
          <CommandPalette
            groups={groups}
            container={frame}
            hotkeyTarget={frame}
            defaultRecent={["deploy", "p-billing"]}
            onSelect={(item) => setLast(item.label)}
            footer="Acme workspace"
          >
            <CommandPaletteTrigger />
          </CommandPalette>
        </div>
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-hover text-[10px] font-medium text-fg-2 ring-1 ring-line-2">MC</span>
      </div>

      <div className="flex-1 overflow-hidden px-2 py-2">
        <p className="px-2 pt-1 pb-2 font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">My issues</p>
        {issues.map(([id, title, status]) => (
          <div key={id} className="flex h-9 items-center gap-3 rounded-lg px-2 text-[13px]">
            <span className="w-14 shrink-0 font-mono text-[11px] text-fg-4">{id}</span>
            <span className="min-w-0 flex-1 truncate text-fg-2">{title}</span>
            <span className="shrink-0 text-[12px] text-fg-4 max-sm:hidden">{status}</span>
          </div>
        ))}
      </div>

      <div className="flex h-9 shrink-0 items-center border-t border-line px-3 text-[12px] text-fg-3">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={last ?? "hint"}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.2, ease: ease.out }}
            className="truncate"
            role="status"
          >
            {last ? (
              <>
                Ran <span className="text-fg-2">{last}</span>
              </>
            ) : (
              <>
                Click in the window, then press <Kbd keys="mod+k" size="sm" className="mx-0.5" />
              </>
            )}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
