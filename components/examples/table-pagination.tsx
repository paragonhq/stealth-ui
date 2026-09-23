"use client";
import { useEffect, useState } from "react";
import { TablePageTransition, TablePagination } from "@/components/ui/table-pagination";

// A deterministic audit log, so server and client render the same rows.
const actors = ["Maya Lin", "Theo Park", "Ana Souza", "Jonas Weber", "Priya Raman", "deploy-bot"];
const actions = ["Rotated API key", "Invited a member", "Changed billing plan", "Deployed checkout-web", "Updated SSO settings", "Exported invoices", "Removed a domain"];
const TOTAL = 243;
const start = Date.UTC(2026, 8, 22, 16, 40);
const time = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
let minutesAgo = 0;
const events = Array.from({ length: TOTAL }, (_, i) => {
  if (i) minutesAgo += 9 + ((i * 7) % 31);
  return {
    id: `evt_${(9_021_400 - i * 37).toString(36)}`,
    actor: actors[(i * 5 + 1) % actors.length],
    action: actions[(i * 3 + 2) % actions.length],
    at: time.format(start - minutesAgo * 60_000),
  };
});

export default function Demo() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // What the table shows lags the footer by a simulated 320ms request, like a real server page.
  const [shown, setShown] = useState({ page: 1, pageSize: 10 });
  const busy = shown.page !== page || shown.pageSize !== pageSize;
  useEffect(() => {
    const t = window.setTimeout(() => setShown({ page, pageSize }), 320);
    return () => window.clearTimeout(t);
  }, [page, pageSize]);

  const rows = events.slice((shown.page - 1) * shown.pageSize, shown.page * shown.pageSize);

  return (
    <div className="w-full max-w-[560px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="h-[397px] overflow-y-auto overscroll-contain">
        <table className="w-full table-fixed border-separate border-spacing-0 text-[13px]" aria-busy={busy || undefined}>
          <caption className="sr-only">Audit log</caption>
          <thead className="sticky top-0 z-(--z-sticky) bg-raised">
            <tr className="text-left text-[12px] text-fg-3">
              <th className="h-9 w-[112px] border-b border-line pl-4 font-normal">Time</th>
              <th className="h-9 w-[124px] border-b border-line px-3 font-normal max-sm:hidden">Actor</th>
              <th className="h-9 border-b border-line px-3 font-normal max-sm:pr-4">Action</th>
              <th className="h-9 w-[112px] border-b border-line pr-4 text-right font-normal max-sm:hidden">Event</th>
            </tr>
          </thead>
          <TablePageTransition page={shown.page * 1000 + shown.pageSize}>
            {rows.map((e) => (
              // While the next page loads the current rows stay, dimmed, instead of blanking.
              <tr key={e.id} className={`group/row transition-[background-color,opacity] duration-200 hover:bg-hover ${busy ? "opacity-55" : ""}`}>
                <td className="h-9 border-b border-line pl-4 text-fg-2 tabular group-last/row:border-b-0">{e.at}</td>
                <td className="h-9 truncate border-b border-line px-3 text-fg group-last/row:border-b-0 max-sm:hidden">{e.actor}</td>
                <td className="h-9 truncate border-b border-line px-3 text-fg-2 group-last/row:border-b-0">{e.action}</td>
                <td className="h-9 truncate border-b border-line pr-4 text-right font-mono text-[12px] text-fg-3 group-last/row:border-b-0 max-sm:hidden">{e.id}</td>
              </tr>
            ))}
          </TablePageTransition>
        </table>
      </div>
      <TablePagination
        total={TOTAL}
        page={page}
        pageSize={pageSize}
        busy={busy}
        itemLabel="events"
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        className="border-t border-line px-3"
      />
    </div>
  );
}
