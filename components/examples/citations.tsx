"use client";
import { Citation, Citations, CitationSources, type CitationSource } from "@/components/ui/citations";

const sources: CitationSource[] = [
  {
    id: "pg-idx",
    url: "https://www.postgresql.org/docs/current/indexes-types.html",
    siteName: "PostgreSQL docs",
    title: "Index types: B-tree, Hash, GiST, SP-GiST, GIN and BRIN",
    snippet: "B-trees can handle equality and range queries on data that can be sorted into some ordering. Hash indexes store a 32-bit hash code derived from the value of the indexed column.",
    meta: "v17",
  },
  {
    id: "concurrently",
    url: "https://www.postgresql.org/docs/current/sql-createindex.html",
    siteName: "PostgreSQL docs",
    title: "CREATE INDEX: building indexes concurrently",
    snippet: "With CONCURRENTLY, PostgreSQL builds the index without taking any locks that prevent concurrent inserts, updates, or deletes on the table.",
    meta: "v17",
  },
  {
    id: "runbook",
    url: "https://wiki.acme.dev/runbooks/postgres-migrations",
    title: "Runbook: shipping Postgres migrations without downtime",
    snippet: "Always create indexes concurrently on tables over 1M rows. Expect roughly 4 minutes per 10M rows on the primary.",
    meta: "Updated 3 weeks ago",
  },
  {
    id: "incident",
    url: "https://status.acme.dev/incidents/2291",
    title: "Incident 2291: elevated checkout latency",
    snippet: "p95 on /v1/checkout rose from 180 ms to 410 ms between 14:02 and 15:40 UTC.",
    meta: "Tue 14:02",
  },
  {
    id: "blog",
    url: "https://engineering.acme.dev/hash-vs-btree",
    title: "Why we stopped using hash indexes for session tokens",
    meta: "Mar 2025",
  },
];

// An answer that shows its sources. Hover a number to preview it; hover a row to find it in the text.
export default function Demo() {
  return (
    <Citations sources={sources} className="flex w-full max-w-[500px] flex-col gap-5">
      <div className="flex flex-col gap-3 text-[13px] leading-[1.7] text-fg">
        <p className="text-pretty">
          Use a B-tree index on <code className="rounded-[4px] border border-line bg-raised px-1 py-px font-mono text-[12px]">sessions.token_hash</code>. It covers the equality lookup your login path makes, and hash indexes buy little over it here
          <Citation id={["pg-idx", "blog"]} />.
        </p>
        <p className="text-pretty">
          Build it with <code className="rounded-[4px] border border-line bg-raised px-1 py-px font-mono text-[12px]">CONCURRENTLY</code> so checkout keeps writing while it runs
          <Citation id="concurrently" />; at 38M rows expect about 15 minutes
          <Citation id="runbook" />. That should bring p95 back under the 180 ms you saw before Tuesday
          <Citation id="incident" />.
        </p>
      </div>
      <CitationSources className="-mx-2" />
    </Citations>
  );
}
