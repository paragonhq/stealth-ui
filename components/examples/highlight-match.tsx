"use client";
import { motion, useReducedMotion } from "motion/react";
import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { Search, X } from "@/lib/icons";
import { spring } from "@/lib/motion";
import { HighlightMatch, findMatches, type MatchMode } from "@/components/ui/highlight-match";

const docs = [
  { title: "Łódź office handbook", path: "People / Offices", body: "Door codes, the Wi-Fi password and who to call when the heating in the Łódź studio stops working over the weekend." },
  { title: "Q3 forecast review", path: "Finance / Planning", body: "Notes from the review with José Álvarez. Renewal revenue came in 4% under plan; the enterprise pipeline covers the gap if two deals close in September." },
  { title: "Vendor contract: Café Müller", path: "Operations / Vendors", body: "Catering for the Berlin offsite. The renewal clause auto-extends the contract for twelve months unless canceled 30 days before the end date." },
  { title: "Onboarding checklist for Zoë Martín", path: "People / Onboarding", body: "Laptop ordered, accounts created in the admin console, first-week pairing sessions booked with the design team." },
  { title: "Invoice overdue reminders", path: "Finance / Billing", body: "Reminder emails go out 3, 7 and 14 days after the due date. The third one copies the account owner and pauses renewal." },
  { title: "Straßenfest sponsorship", path: "Marketing / Events", body: "Budget, logo placement and the volunteer rota for the summer street festival outside the Kreuzberg office." },
];

const tries = ["lodz", "renewal", "zoe mar", "strasse"];

export default function Demo() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<MatchMode>("words");
  const inputId = useId();

  const results = useMemo(() => {
    if (!query.trim()) return docs.map((d) => ({ doc: d, score: 0 }));
    return docs
      .map((doc) => {
        // Fuzzy is for titles; letters scattered across a paragraph match everything.
        const title = findMatches(doc.title, query, mode);
        const whole = mode === "fuzzy" ? null : findMatches(`${doc.title} ${doc.body}`, query, mode);
        const score = (title?.score ?? 0) * 2 + (whole?.score ?? 0);
        return title || whole ? { doc, score } : null;
      })
      .filter((r): r is { doc: (typeof docs)[number]; score: number } => !!r)
      .sort((a, b) => b.score - a.score);
  }, [query, mode]);

  return (
    <div className="flex w-full max-w-[440px] flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex items-center gap-2 border-b border-line px-3">
        <label htmlFor={inputId} className="sr-only">Search documents</label>
        <Search size={16} className="shrink-0 text-fg-3" />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search documents"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className="h-11 min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px] [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="relative grid size-6 shrink-0 place-items-center rounded-md text-fg-3 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.92] after:absolute after:-inset-2.5"
          >
            <X size={14} />
          </button>
        )}
        <ModeSwitch mode={mode} onChange={setMode} />
      </div>

      <div className="flex h-9 items-center gap-1.5 border-b border-line px-3 text-[12px] text-fg-3">
        <span className="shrink-0">Try</span>
        {tries.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setQuery(t)}
            aria-pressed={query === t}
            className="h-6 shrink-0 rounded-md border border-line-2 px-1.5 font-mono text-[11px] text-fg-2 outline-none transition-[background-color,border-color,color,scale] duration-150 hover:border-fg-4 hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 active:scale-[0.95] aria-pressed:border-fg-4 aria-pressed:bg-hover aria-pressed:text-fg"
          >
            {t}
          </button>
        ))}
      </div>

      <ul aria-label="Results" className="h-[292px] overflow-y-auto overscroll-contain p-1">
        {results.map(({ doc }) => (
          <li key={doc.title} className="flex flex-col gap-0.5 rounded-lg px-2.5 py-2">
            <div className="flex min-w-0 items-baseline justify-between gap-3">
              <HighlightMatch text={doc.title} query={query} mode={mode} className="min-w-0 truncate text-[13px] font-medium text-fg" />
              <span className="shrink-0 text-2xs text-fg-4">{doc.path}</span>
            </div>
            <HighlightMatch
              text={doc.body}
              query={mode === "fuzzy" ? "" : query}
              mode={mode}
              excerpt={84}
              className="line-clamp-1 text-[12.5px] text-fg-3"
            />
          </li>
        ))}
        {results.length === 0 && (
          <li className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="max-w-full truncate text-[13px] text-fg-2">
              No documents match <span className="text-fg">“{query.trim()}”</span>
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="h-7 rounded-md border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
            >
              Clear search
            </button>
          </li>
        )}
      </ul>

      <div role="status" className="flex h-8 items-center border-t border-line px-3 text-[12px] text-fg-3 tabular">
        {query.trim() ? `${results.length} ${results.length === 1 ? "result" : "results"}` : `${docs.length} documents`}
        <span className="ml-auto text-fg-4">{mode === "fuzzy" ? "Letters in order, titles only" : "Every word, any order"}</span>
      </div>
    </div>
  );
}

function ModeSwitch({ mode, onChange }: { mode: MatchMode; onChange: (m: MatchMode) => void }) {
  const reduce = useReducedMotion();
  const id = useId();
  return (
    <div role="group" aria-label="Match mode" className="flex shrink-0 rounded-md border border-line-2 p-0.5">
      {([["words", "Words"], ["fuzzy", "Fuzzy"]] as const).map(([m, label]) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => onChange(m)}
          className={cn(
            "relative h-5 rounded-[4px] px-1.5 text-[11.5px] outline-none transition-[color,scale] duration-150 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.95]",
            mode === m ? "text-fg" : "text-fg-3 hover:text-fg-2",
          )}
        >
          {mode === m && <motion.span layoutId={`${id}-pill`} transition={reduce ? { duration: 0 } : spring.snappy} className="absolute inset-0 rounded-[4px] bg-line-2" />}
          <span className="relative">{label}</span>
        </button>
      ))}
    </div>
  );
}
