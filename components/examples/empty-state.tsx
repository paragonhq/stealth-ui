"use client";
import { Tabs } from "@base-ui/react/tabs";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { EmptyState } from "@/components/ui/empty-state";

// Three empties a product actually meets: nothing made yet, a search that
// found nothing, and an inbox that's done. Each can be filled and emptied.
export default function Demo() {
  return (
    <Tabs.Root defaultValue="projects" className="flex w-full max-w-[420px] flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <Tabs.List className="relative flex gap-1 border-b border-line px-2 py-1.5">
        {[
          ["projects", "First use"],
          ["files", "No results"],
          ["inbox", "Inbox zero"],
        ].map(([value, label]) => (
          <Tabs.Tab
            key={value}
            value={value}
            className={cn(
              "relative z-[1] h-7 select-none rounded-md px-2.5 text-[12.5px] font-medium text-fg-3 outline-none",
              "transition-[color,scale] duration-150 hover:text-fg-2 active:scale-[0.97] data-active:text-fg",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
            )}
          >
            {label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator className="absolute left-0 top-1/2 h-7 w-(--active-tab-width) -translate-y-1/2 translate-x-(--active-tab-left) rounded-md bg-hover transition-[translate,width] duration-200 ease-in-out-quart" />
      </Tabs.List>
      <div className="h-[340px]">
        <Tabs.Panel value="projects" className="h-full outline-none">
          <Projects />
        </Tabs.Panel>
        <Tabs.Panel value="files" className="h-full outline-none">
          <Files />
        </Tabs.Panel>
        <Tabs.Panel value="inbox" className="h-full outline-none">
          <Inbox />
        </Tabs.Panel>
      </div>
    </Tabs.Root>
  );
}

function Projects() {
  const [projects, setProjects] = useState<string[]>([]);
  const reduce = useReducedMotion();
  return (
    <div className="flex h-full flex-col p-3">
      <AnimatePresence mode="wait" initial={false}>
        {projects.length === 0 ? (
          <motion.div key="empty" className="flex flex-1" exit={{ opacity: 0, transition: { duration: 0.12 } }}>
            <EmptyState
              variant="first-use"
              heading="No projects yet"
              description="A project holds your deploys, domains and environment variables."
              className="flex-1"
            >
              <button type="button" className={btn("primary")} onClick={() => setProjects(["acme-web"])}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                  <path d="M8 3.5v9M3.5 8h9" />
                </svg>
                Create project
              </button>
              <button type="button" className={btn("ghost")}>
                Import from Git
              </button>
            </EmptyState>
          </motion.div>
        ) : (
          <motion.ul key="list" className="flex flex-col" aria-label="Projects">
            {projects.map((p) => (
              <motion.li
                key={p}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: ease.out }}
                className="flex items-center gap-3 rounded-lg border border-line bg-frame px-3 py-2.5"
              >
                <span aria-hidden className="grid size-8 place-items-center rounded-lg border border-line-2 bg-raised text-[12px] font-medium text-fg-2">
                  A
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-fg">{p}</p>
                  <p className="truncate font-mono text-[11px] text-fg-3">Created just now · no deploys yet</p>
                </div>
                <button type="button" className={btn("ghost")} onClick={() => setProjects([])}>
                  Delete
                </button>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

const files = [
  { name: "q3-forecast.xlsx", owner: "Maya Okafor", meta: "Edited 2h ago" },
  { name: "board-deck-q3.pdf", owner: "Maya Okafor", meta: "Edited yesterday" },
  { name: "payroll-sept.csv", owner: "Jonas Berg", meta: "Edited Mon" },
  { name: "onboarding-notes.docx", owner: "Priya Raman", meta: "Edited 9 Sep" },
];

function Files() {
  const [query, setQuery] = useState("q3 forcast");
  const [owner, setOwner] = useState<string | null>("Maya Okafor");
  const input = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase().replace(/\s+/g, "");
  const shown = files.filter((f) => (!owner || f.owner === owner) && f.name.toLowerCase().replace(/[-\s]/g, "").includes(q.replace(/-/g, "")));
  const filtered = !!q || !!owner;

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line-2 bg-frame px-2.5 text-fg-3 transition-[border-color,box-shadow] duration-150 focus-within:border-fg-4 focus-within:ring-2 focus-within:ring-fg/10">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
            <circle cx="7" cy="7" r="4.25" />
            <path d="m10.25 10.25 3 3" />
          </svg>
          <span className="sr-only">Search files</span>
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files"
            className="min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]"
          />
        </label>
        {owner && (
          <button type="button" onClick={() => setOwner(null)} className={cn(btn("secondary"), "shrink-0")} aria-label={`Remove filter: owner ${owner}`}>
            Owner: Maya
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden className="text-fg-3">
              <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
            </svg>
          </button>
        )}
      </div>
      {shown.length === 0 ? (
        <EmptyState
          key="none"
          variant="no-results"
          size="sm"
          className="flex-1"
          heading={
            <>
              No files match <span className="text-fg">“{query.trim()}”</span>
            </>
          }
          description={owner ? `Check the spelling, or search everyone’s files, not just ${owner.split(" ")[0]}’s.` : "Check the spelling or try a shorter search."}
        >
          <button
            type="button"
            className={btn("secondary")}
            onClick={() => {
              setQuery("");
              setOwner(null);
              // The button that had focus is gone; put it back where the search starts.
              input.current?.focus();
            }}
          >
            Clear filters
          </button>
        </EmptyState>
      ) : (
        <ul className="flex flex-col" aria-label={filtered ? `${shown.length} matching files` : "All files"}>
          {shown.map((f) => (
            <li key={f.name} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-hover">
              <span aria-hidden className="grid size-7 place-items-center rounded-md border border-line bg-frame font-mono text-[9.5px] uppercase text-fg-3">
                {f.name.split(".").pop()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-fg">{f.name}</p>
                <p className="truncate text-[11.5px] text-fg-3">
                  {f.owner} · {f.meta}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const messages = [
  { id: 1, from: "Stripe", subject: "Payout of $18,420.50 is on its way" },
  { id: 2, from: "Jonas Berg", subject: "Re: checkout rounding bug" },
];

function Inbox() {
  const [mail, setMail] = useState(messages);
  const reduce = useReducedMotion();
  return (
    <div className="flex h-full flex-col p-3">
      {mail.length === 0 ? (
        <EmptyState variant="inbox-zero" heading="You’re all caught up" description="New messages will show up here." className="flex-1">
          <button type="button" className={btn("ghost")} onClick={() => setMail(messages)}>
            Undo archive
          </button>
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-1" aria-label="Inbox">
          <AnimatePresence initial={false}>
            {mail.map((m) => (
              <motion.li
                key={m.id}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24, transition: { duration: 0.18, ease: ease.in } }}
                className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors duration-150 hover:bg-hover"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-fg">{m.from}</p>
                  <p className="truncate text-[12px] text-fg-2">{m.subject}</p>
                </div>
                <button type="button" className={btn("secondary")} onClick={() => setMail((x) => x.filter((y) => y.id !== m.id))} aria-label={`Archive ${m.subject}`}>
                  Archive
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function btn(variant: "primary" | "secondary" | "ghost") {
  return cn(
    "inline-flex h-8 select-none items-center justify-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium",
    "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
    "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.97] active:duration-75",
    variant === "primary" && "bg-fg text-frame shadow-[var(--shadow)] hover:bg-fg/90",
    variant === "secondary" && "h-7 border border-line-2 bg-raised px-2.5 text-[12px] text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover",
    variant === "ghost" && "text-fg-2 hover:bg-hover hover:text-fg",
  );
}
