"use client";
import { useState } from "react";
import { MentionInput, type Mention, type MentionUser } from "@/components/ui/mention-input";

const team: MentionUser[] = [
  { id: "u_maya", name: "Maya Chen", detail: "Design · Lisbon" },
  { id: "u_theo", name: "Theo Okafor", detail: "Engineering · Lagos" },
  { id: "u_priya", name: "Priya Raman", detail: "Product · Bengaluru" },
  { id: "u_lucas", name: "Lucas Meyer", detail: "Engineering · Berlin" },
  { id: "u_ana", name: "Ana Souza", detail: "Support · São Paulo" },
  { id: "u_jonah", name: "Jonah Kim", detail: "Design · Seoul" },
  { id: "u_sofia", name: "Sofia Rossi", detail: "Finance · Milan" },
];

const start = "Checkout drops on Safari 17 when the promo field is empty. @Theo Okafor can you take a look?";

// A comment on an issue: type @ to mention a teammate; the footer shows who gets notified.
export default function Demo() {
  const [text, setText] = useState(start);
  const [mentions, setMentions] = useState<Mention[]>([{ id: "u_theo", label: "@Theo Okafor", start: 59, end: 71 }]);
  const notified = [...new Map(mentions.map((m) => [m.id, m.label.slice(1)])).values()];

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 rounded-xl border border-line bg-frame p-4 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="truncate text-[13px] font-medium text-fg">
          <span className="font-mono text-[12px] text-fg-3">WEB-2184</span> Checkout fails on Safari
        </h3>
      </div>
      <MentionInput
        users={team}
        defaultValue={start}
        defaultMentions={mentions}
        onValueChange={(t, m) => {
          setText(t);
          setMentions(m);
        }}
        aria-label="Comment"
        placeholder="Leave a comment. Type @ to mention someone."
      />
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[12px] text-fg-3">
          {notified.length ? (
            <>
              Notifies <span className="text-fg-2">{notified.join(", ")}</span>
            </>
          ) : (
            "Type @ to notify a teammate"
          )}
        </p>
        <button
          type="button"
          disabled={!text.trim()}
          className="h-7 shrink-0 rounded-md bg-fg px-2.5 text-[12px] font-medium text-frame outline-none transition-[background-color,scale,opacity] duration-150 hover:bg-fg/90 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] disabled:opacity-40"
        >
          Comment
        </button>
      </div>
    </div>
  );
}
