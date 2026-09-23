"use client";
import { useState } from "react";
import { Kanban, type KanbanColumn } from "@/components/ui/kanban";

type Issue = { id: string; column: string; key: string; title: string; tag: string; owner: string };

const columns: KanbanColumn[] = [
  { id: "todo", title: "To do" },
  { id: "doing", title: "In progress", limit: 3 },
  { id: "done", title: "Done" },
];

const issues: Issue[] = [
  { id: "a", column: "todo", key: "ENG-214", title: "Retry failed webhooks with backoff", tag: "API", owner: "PN" },
  { id: "b", column: "todo", key: "ENG-219", title: "Empty state for the invoices table", tag: "Billing", owner: "TR" },
  { id: "c", column: "todo", key: "ENG-221", title: "Rate-limit password reset emails", tag: "Auth", owner: "MC" },
  { id: "d", column: "doing", key: "ENG-198", title: "Fix flaky deploy preview test", tag: "CI", owner: "LH" },
  { id: "e", column: "doing", key: "ENG-205", title: "SAML metadata upload", tag: "Auth", owner: "MC" },
  { id: "f", column: "doing", key: "ENG-207", title: "Usage chart shows the wrong timezone", tag: "Billing", owner: "AT" },
];

// A sprint board. Drag a card between columns, or open its menu (or Alt+arrows) to move it by keyboard.
// In progress has a limit of 3, so a fourth card turns the count to a warning.
export default function Demo() {
  const [cards, setCards] = useState(issues);
  return (
    <Kanban
      aria-label="Sprint 42"
      columns={columns}
      value={cards}
      onValueChange={setCards}
      getCardLabel={(c) => `${c.key} ${c.title}`}
      emptyLabel="Nothing shipped yet"
      className="h-[372px] w-full max-w-[688px]"
      renderCard={(c) => (
        <div className="flex flex-col gap-2">
          <span className="line-clamp-2 pe-5 leading-[18px] tracking-[-0.005em]">{c.title}</span>
          <div className="flex items-center gap-2 text-[11px] leading-4 text-fg-3">
            <span className="font-mono">{c.key}</span>
            <span className="rounded-full border border-line-2 px-1.5 leading-[16px] text-fg-2">{c.tag}</span>
            <span
              aria-hidden
              className="ms-auto grid size-5 place-items-center rounded-full border border-line-2 bg-hover text-[9.5px] font-medium tracking-[0.02em] text-fg-2"
            >
              {c.owner}
            </span>
          </div>
        </div>
      )}
    />
  );
}
