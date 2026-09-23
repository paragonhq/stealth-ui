"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Refresh } from "@/lib/icons";
import { StaggerIn } from "@/components/ui/stagger-in";

type Status = "ready" | "failed" | "building";
type Deploy = { id: string; message: string; branch: string; status: Status; age: string };

const initial: Deploy[] = [
  { id: "d12", message: "Cache invoice PDFs at the edge", branch: "main", status: "building", age: "now" },
  { id: "d11", message: "Fix timezone drift in the billing calendar", branch: "main", status: "ready", age: "18m" },
  { id: "d10", message: "Add retry to webhook delivery", branch: "maya/webhooks", status: "failed", age: "42m" },
  { id: "d9", message: "Bump Postgres driver to 3.4", branch: "main", status: "ready", age: "1h" },
  { id: "d8", message: "Move onboarding copy into the CMS", branch: "tomas/onboarding-copy", status: "ready", age: "2h" },
  { id: "d7", message: "Split the dashboard bundle by route", branch: "main", status: "ready", age: "3h" },
  { id: "d6", message: "Rate-limit the public search endpoint", branch: "main", status: "failed", age: "5h" },
  { id: "d5", message: "Seed staging with Q3 forecast fixtures", branch: "priya/seed-q3", status: "ready", age: "6h" },
  { id: "d4", message: "Drop the legacy CSV exporter", branch: "main", status: "ready", age: "8h" },
  { id: "d3", message: "Tighten CSP for embedded reports", branch: "main", status: "ready", age: "1d" },
  { id: "d2", message: "Add SSO domain verification", branch: "sam/sso", status: "ready", age: "1d" },
];

const incoming: Deploy = { id: "d13", message: "Show seat usage on the plan page", branch: "main", status: "ready", age: "now" };

const label: Record<Status, string> = { ready: "Ready", failed: "Failed", building: "Building" };

// A deploy list: skeleton first, then the rows arrive in a capped wave. Filtering and
// refreshing change the rows without replaying it. The stage's reset plays it again.
export default function Demo() {
  const [deploys, setDeploys] = useState<Deploy[] | null>(null);
  const [filter, setFilter] = useState<"all" | "failed">("all");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDeploys(initial), 900);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!refreshing) return;
    const t = window.setTimeout(() => {
      setRefreshing(false);
      setDeploys((all) => (all && !all.some((d) => d.id === incoming.id) ? [incoming, ...all] : all));
    }, 700);
    return () => window.clearTimeout(t);
  }, [refreshing]);

  const failed = deploys?.filter((d) => d.status === "failed").length ?? 0;
  const shown = deploys && (filter === "failed" ? deploys.filter((d) => d.status === "failed") : deploys);

  return (
    <div className="flex w-full max-w-[440px] flex-col overflow-hidden rounded-xl border border-line-2 bg-raised shadow-[var(--shadow)]">
      <div className="flex items-center gap-2 border-b border-line py-2 pl-3.5 pr-2">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium tracking-[-0.015em] text-fg">Deployments</p>
          <p className="truncate text-[12px] text-fg-3">acme-web · production</p>
        </div>
        <div role="group" aria-label="Filter deployments" className="flex h-7 rounded-md border border-line-2 p-0.5">
          {(["all", "failed"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              disabled={!deploys}
              onClick={() => setFilter(f)}
              className={cn(
                "flex items-center gap-1 rounded-[4px] px-2 text-[12px] font-medium outline-none transition-[background-color,color,scale] duration-150 active:scale-[0.97] active:duration-75",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 disabled:opacity-50",
                filter === f ? "bg-hover text-fg" : "text-fg-3 hover:text-fg-2",
              )}
            >
              {f === "all" ? "All" : "Failed"}
              {f === "failed" && <span className="tabular text-fg-4">{deploys ? failed : "–"}</span>}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Refresh deployments"
          aria-busy={refreshing || undefined}
          disabled={!deploys}
          onClick={() => !refreshing && setRefreshing(true)}
          className={cn(
            "relative grid size-7 place-items-center rounded-md text-fg-3 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 disabled:opacity-50",
            "pointer-coarse:before:absolute pointer-coarse:before:-inset-2",
          )}
        >
          <Refresh className={cn(refreshing && "animate-spin-slow")} />
        </button>
      </div>

      <div className="h-[334px] overflow-y-auto overscroll-contain" aria-busy={!deploys || undefined}>
        {!shown ? (
          <div aria-label="Loading deployments" role="status" className="flex flex-col py-1">
            {[0.72, 0.58, 0.8, 0.5, 0.66, 0.6, 0.74].map((w, i) => (
              <div key={i} className="flex h-11 items-center gap-3 px-3.5">
                <span className="size-2 shrink-0 rounded-full bg-fg/[0.06]" />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="h-2.5 rounded-sm bg-fg/[0.06]" style={{ width: `${w * 100}%` }} />
                  <span className="h-2 w-16 rounded-sm bg-fg/[0.06]" />
                </span>
                <span className="h-2.5 w-6 rounded-sm bg-fg/[0.06]" />
              </div>
            ))}
          </div>
        ) : (
          <StaggerIn as="ul" aria-label="Deployments" className="flex flex-col py-1">
            {shown.map((d) => (
              <li key={d.id} className="flex h-11 items-center gap-3 px-3.5">
                <span
                  aria-hidden
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    d.status === "ready" && "bg-success",
                    d.status === "failed" && "bg-danger",
                    d.status === "building" && "animate-pulse-soft bg-warning",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-fg">{d.message}</span>
                  <span className="block truncate text-[11.5px] text-fg-3">
                    <span className="sr-only">{label[d.status]}, </span>
                    <span className="font-mono">{d.branch}</span>
                  </span>
                </span>
                <span className="tabular shrink-0 text-[12px] text-fg-3">{d.age}</span>
              </li>
            ))}
          </StaggerIn>
        )}
      </div>
    </div>
  );
}
