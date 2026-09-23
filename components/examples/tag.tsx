"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Hash } from "@/lib/icons";
import { Tag, TagGroup, type TagTone } from "@/components/ui/tag";

type Label = { id: string; name: string; tone?: TagTone; topic?: boolean };
type Person = { id: string; name: string; src?: string };

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=64&h=64&fit=crop&crop=faces&q=70`;

const initialLabels: Label[] = [
  { id: "bug", name: "bug", tone: "danger" },
  { id: "billing", name: "billing", topic: true },
  { id: "needs-design", name: "needs-design", tone: "warning" },
  { id: "customer-reported", name: "customer-reported", tone: "info" },
];

const initialPeople: Person[] = [
  { id: "maya", name: "Maya Okafor", src: photo("1494790108377-be9c29b29330") },
  { id: "jon", name: "Jon Park", src: photo("1507003211169-0a1dd7228f2d") },
  { id: "theo", name: "Theo Nakamura" },
];

type Removed = { kind: "label"; item: Label; at: number } | { kind: "person"; item: Person; at: number };

// The sidebar of an issue: labels you can filter by or remove, assignees you can take off, and
// an undo for whatever was removed last.
export default function Demo() {
  const [labels, setLabels] = useState(initialLabels);
  const [people, setPeople] = useState(initialPeople);
  const [removed, setRemoved] = useState<Removed | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  const undo = () => {
    if (!removed) return;
    if (removed.kind === "label") setLabels((l) => [...l.slice(0, removed.at), removed.item, ...l.slice(removed.at)]);
    else setPeople((p) => [...p.slice(0, removed.at), removed.item, ...p.slice(removed.at)]);
    setRemoved(null);
  };

  return (
    <div className="flex w-full max-w-[360px] flex-col rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <section className="flex flex-col gap-2 px-4 pb-3.5 pt-3.5">
        <h3 className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">Labels</h3>
        <TagGroup label="Labels" empty={<p className="text-[12.5px] text-fg-3">No labels</p>}>
          {labels.map((l, i) => (
            <Tag
              key={l.id}
              dot={!!l.tone}
              tone={l.tone}
              icon={l.topic ? <Hash /> : undefined}
              onClick={() => setFilter(l.name)}
              onRemove={() => {
                setLabels((all) => all.filter((x) => x.id !== l.id));
                setRemoved({ kind: "label", item: l, at: i });
                if (filter === l.name) setFilter(null);
              }}
            >
              {l.name}
            </Tag>
          ))}
        </TagGroup>
      </section>

      <section className="flex flex-col gap-2 border-t border-line px-4 pb-3.5 pt-3.5">
        <h3 className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">Assignees</h3>
        <TagGroup label="Assignees" empty={<p className="text-[12.5px] text-fg-3">Nobody assigned</p>}>
          {people.map((p, i) => (
            <Tag
              key={p.id}
              avatar={{ name: p.name, src: p.src }}
              onRemove={() => {
                setPeople((all) => all.filter((x) => x.id !== p.id));
                setRemoved({ kind: "person", item: p, at: i });
              }}
            />
          ))}
        </TagGroup>
      </section>

      <div className="flex h-10 items-center justify-between gap-3 border-t border-line px-4 text-[12px]">
        <p aria-live="polite" className="min-w-0 truncate text-fg-3">
          {removed ? (
            <>
              Removed <span className="text-fg-2">{removed.item.name}</span>
            </>
          ) : filter ? (
            <>
              Showing issues labeled <span className="text-fg-2">{filter}</span>
            </>
          ) : (
            "Click a label to filter by it"
          )}
        </p>
        {removed && (
          <button
            type="button"
            onClick={undo}
            className={cn(
              "-mr-1.5 h-7 shrink-0 rounded-md px-1.5 font-medium text-fg",
              "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              "transition-[background-color,scale] duration-150 hover:bg-hover active:scale-[0.97] active:duration-75",
            )}
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
