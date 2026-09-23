"use client";
import { ScrollArea } from "@/components/ui/scroll-area";

const activity = [
  ["Maya Okafor", "merged", "#2291 Make invoice finalization idempotent", "2m"],
  ["Jonas Lindqvist", "approved", "#2291 Make invoice finalization idempotent", "14m"],
  ["Deploy bot", "promoted", "stealth-web to production", "22m"],
  ["Priya Raman", "commented on", "#2287 Retry webhooks with backoff", "41m"],
  ["Sam Whitaker", "opened", "#2293 Cache exchange rates for an hour", "1h"],
  ["Deploy bot", "rolled back", "billing-worker to v1.18.2", "2h"],
  ["Maya Okafor", "closed", "#2270 Flaky checkout test on webkit", "3h"],
  ["Lena Park", "requested changes on", "#2288 Split the settings page", "5h"],
  ["Jonas Lindqvist", "created", "release v2.4.0", "6h"],
];

const regions = ["us-east-1", "eu-west-2", "ap-south-1", "sa-east-1", "eu-central-1", "us-west-2", "ap-northeast-1", "af-south-1"];
const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
// Deterministic numbers, so the server and the browser render the same table.
const usage = (r: number, m: number) => ((r * 37 + m * 53) % 90) + 12 + m * 4;

export default function Demo() {
  return (
    <div className="grid w-full max-w-[600px] gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <section className="flex min-w-0 flex-col rounded-xl border border-line-2 bg-raised shadow-[var(--shadow)]">
        <h3 className="border-b border-line px-4 py-2.5 text-[12px] font-medium text-fg-2">Activity</h3>
        <ScrollArea className="h-[200px] rounded-b-xl sm:h-[260px]" contentClassName="py-1">
          <ul aria-label="Recent activity">
            {activity.map(([who, verb, what, when], i) => (
              <li key={i} className="flex gap-2.5 px-4 py-2">
                <span aria-hidden className="mt-[5px] size-1.5 shrink-0 rounded-full bg-fg-4" />
                <p className="min-w-0 flex-1 text-[12.5px] leading-[1.45] text-fg-3">
                  <span className="font-medium text-fg">{who}</span> {verb} <span className="text-fg-2">{what}</span>
                </p>
                <span className="shrink-0 text-[11px] tabular text-fg-4">{when}</span>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </section>

      <section className="flex min-w-0 flex-col rounded-xl border border-line-2 bg-raised shadow-[var(--shadow)]">
        <h3 className="border-b border-line px-4 py-2.5 text-[12px] font-medium text-fg-2">Requests by region, millions</h3>
        {/* The header row and region column are sticky, so only the far edges fade. */}
        <ScrollArea axis="both" fade={["bottom", "right"]} className="h-[200px] rounded-b-xl sm:h-[260px]">
          <table className="border-separate border-spacing-0 text-[12px]">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 top-0 z-[2] bg-raised px-4 py-2 text-left font-medium text-fg-3">Region</th>
                {months.map((m) => (
                  <th key={m} scope="col" className="sticky top-0 z-[1] bg-raised px-3 py-2 text-right font-medium text-fg-3">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regions.map((r, ri) => (
                <tr key={r}>
                  <th scope="row" className="sticky left-0 z-[1] whitespace-nowrap border-t border-line bg-raised px-4 py-2 text-left font-mono text-[11px] font-normal text-fg-2">{r}</th>
                  {months.map((m, mi) => (
                    <td key={m} className="border-t border-line px-3 py-2 text-right tabular text-fg">{usage(ri, mi).toFixed(1)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </section>
    </div>
  );
}
