"use client";
import { useEffect, useState } from "react";
import { SearchField } from "@/components/ui/search-field";

const people = [
  { name: "Maya Chen", role: "Design engineer", email: "maya@northwind.com" },
  { name: "Tomás Ortega", role: "Infrastructure", email: "tomas@northwind.com" },
  { name: "Priya Raman", role: "Product", email: "priya@northwind.com" },
  { name: "Jonah Fischer", role: "Support lead", email: "jonah@northwind.com" },
  { name: "Aiko Tanaka", role: "Data", email: "aiko@northwind.com" },
];

// A team directory. The search answers after a short "network" delay, so the
// spinner shows only when it's slow enough to matter; F focuses it from anywhere.
export default function Demo() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(people);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    const t = window.setTimeout(
      () => {
        setResults(people.filter((p) => `${p.name} ${p.role} ${p.email}`.toLowerCase().includes(q)));
        setLoading(false);
      },
      q ? 700 : 0,
    );
    return () => window.clearTimeout(t);
  }, [query]);

  return (
    <div className="flex w-full max-w-[400px] flex-col overflow-hidden rounded-xl border border-line bg-frame">
      <div className="flex h-12 items-center gap-3 border-b border-line pl-4 pr-2.5">
        <h3 className="shrink-0 text-[14px] font-medium tracking-[-0.015em] text-fg">Team</h3>
        <span className="shrink-0 text-[12px] tabular text-fg-3">{people.length} members</span>
        <div className="ml-auto flex min-w-0 flex-1 justify-end">
          <SearchField collapsible shortcut={false} size="sm" placeholder="Search" aria-label="Search activity" className="max-w-[200px]" />
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3">
        <SearchField
          placeholder="Filter by name, role or email"
          aria-label="Filter members"
          shortcut="f"
          value={query}
          onValueChange={(v) => {
            setQuery(v);
            setLoading(v.trim() !== "");
          }}
          loading={loading}
        />

        <ul aria-label="Members" aria-busy={loading || undefined} className="flex min-h-[180px] flex-col">
          {results.map((p) => (
            <li key={p.email} className="flex h-9 items-center gap-2.5 rounded-md px-1.5">
              <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-hover text-[10.5px] font-medium text-fg-2 ring-1 ring-line-2">
                {p.name[0]}
              </span>
              <span className="min-w-0 truncate text-[13px] font-medium text-fg">{p.name}</span>
              <span className="ml-auto shrink-0 text-[12px] text-fg-3">{p.role}</span>
            </li>
          ))}
          {results.length === 0 && !loading && (
            <li className="flex flex-1 flex-col items-center justify-center gap-1 py-8 text-center">
              <span className="text-[13px] text-fg-2">
                No members match “<span className="text-fg">{query.trim()}</span>”
              </span>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setLoading(false);
                }}
                className="rounded text-[12.5px] text-fg-3 underline decoration-fg-4 underline-offset-[3px] outline-none transition-colors hover:text-fg hover:decoration-fg-2 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid"
              >
                Clear search
              </button>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
