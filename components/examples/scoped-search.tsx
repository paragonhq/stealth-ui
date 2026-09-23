"use client";
import { useState } from "react";
import { Calendar, Hash, Paperclip, User } from "@/lib/icons";
import { ScopedSearch, type ScopedQuery, type SearchScope } from "@/components/ui/scoped-search";

const Avatar = ({ name }: { name: string }) => (
  <span aria-hidden className="grid size-4 place-items-center rounded-full bg-line-2 text-[7.5px] font-medium text-fg-2">
    {name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
  </span>
);

const people = ["Maya Chen", "Jonas Weber", "Priya Raman", "Tomás Ferreira", "Aiko Tanaka", "Sam Okafor"];

const scopes: SearchScope[] = [
  {
    key: "in",
    label: "Channel",
    description: "Only this channel",
    icon: <Hash />,
    placeholder: "a channel",
    values: ["design", "eng-platform", "launch-q4", "support-escalations", "random"].map((c) => ({ value: c, label: `#${c}` })),
  },
  {
    key: "from",
    label: "Person",
    description: "Sent by someone",
    icon: <User />,
    placeholder: "a name",
    values: people.map((p) => ({ value: p.toLowerCase().replace(" ", "."), label: p, icon: <Avatar name={p} /> })),
  },
  {
    key: "has",
    label: "Attachment",
    description: "Links, files, images",
    icon: <Paperclip />,
    placeholder: "link, file or image",
    values: [
      { value: "link", label: "link" },
      { value: "file", label: "file" },
      { value: "image", label: "image" },
      { value: "reaction", label: "reaction" },
    ],
  },
  {
    key: "before",
    label: "Date",
    description: "Sent before a day",
    icon: <Calendar />,
    placeholder: "a date like 2026-09-01",
    freeform: true,
    values: [
      { value: "today", label: "today" },
      { value: "yesterday", label: "yesterday" },
      { value: "last-week", label: "last week" },
    ],
  },
];

const scopeNoun: Record<string, string> = { in: "in", from: "from", has: "with a", before: "before" };

export default function Demo() {
  const [query, setQuery] = useState<ScopedQuery>({ tokens: [{ scope: "in", value: "launch-q4", label: "#launch-q4" }], text: "pricing" });
  const [submitted, setSubmitted] = useState<ScopedQuery | null>(null);

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-3">
      <ScopedSearch
        scopes={scopes}
        value={query}
        onValueChange={setQuery}
        onSubmit={setSubmitted}
        placeholder="Search messages, or type from:"
        aria-label="Search messages"
      />
      <p className="min-h-10 px-1 text-[12.5px] leading-5 text-fg-3 text-pretty">
        {query.text.trim() || query.tokens.length ? (
          <>
            Messages
            {query.text.trim() && (
              <>
                {" "}matching <span className="text-fg">“{query.text.trim()}”</span>
              </>
            )}
            {query.tokens.map((t, i) => (
              <span key={i}>
                {" "}
                {scopeNoun[t.scope]} <span className="text-fg">{t.label}</span>
              </span>
            ))}
            <span className="text-fg-4">{JSON.stringify(submitted) === JSON.stringify(query) ? " · searched" : " · press Enter to search"}</span>
          </>
        ) : (
          <>
            Type <kbd className="rounded border border-line-2 px-1 font-mono text-[11px] text-fg-2">from:</kbd> or{" "}
            <kbd className="rounded border border-line-2 px-1 font-mono text-[11px] text-fg-2">in:</kbd> to narrow by person or channel.
          </>
        )}
      </p>
    </div>
  );
}
