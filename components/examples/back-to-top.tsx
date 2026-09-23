"use client";
import { useRef } from "react";
import { BackToTop } from "@/components/ui/back-to-top";

const releases = [
  { version: "4.12.0", date: "Sep 18", kind: "Feature", notes: ["Usage-based billing is out of beta for every paid plan.", "Invoices show metered usage per project, with a CSV export."] },
  { version: "4.11.3", date: "Sep 11", kind: "Fix", notes: ["Webhooks retry with exponential backoff instead of failing after the first timeout."] },
  { version: "4.11.0", date: "Sep 4", kind: "Feature", notes: ["SSO with Okta, Google Workspace and Azure AD on the Team plan.", "SCIM provisioning keeps seats in sync with your directory."] },
  { version: "4.10.2", date: "Aug 27", kind: "Fix", notes: ["The dashboard no longer double-counts seats added and removed on the same day."] },
  { version: "4.10.0", date: "Aug 20", kind: "Feature", notes: ["Audit log export to your own bucket, daily or hourly.", "Filter the audit log by actor, action and project."] },
  { version: "4.9.1", date: "Aug 13", kind: "Fix", notes: ["Search results keep their order when new events arrive while you read them."] },
  { version: "4.9.0", date: "Aug 6", kind: "Feature", notes: ["Self-serve seat changes: add or remove seats without contacting sales.", "Prorated charges appear on the next invoice, itemised."] },
  { version: "4.8.4", date: "Jul 30", kind: "Fix", notes: ["Invoice PDFs render the tax ID on the first page again."] },
  { version: "4.8.0", date: "Jul 23", kind: "Feature", notes: ["Spending limits with an email when a project reaches 80%."] },
  { version: "4.7.2", date: "Jul 16", kind: "Fix", notes: ["Exports larger than 1 GB finish instead of timing out at 99%."] },
  { version: "4.7.0", date: "Jul 9", kind: "Feature", notes: ["Two-factor authentication can be required for everyone in a workspace.", "Recovery codes can be downloaded again from security settings."] },
  { version: "4.6.1", date: "Jul 2", kind: "Fix", notes: ["Dates in the activity feed follow your locale instead of the server’s."] },
  { version: "4.6.0", date: "Jun 25", kind: "Feature", notes: ["Project templates: start a project with its settings, roles and webhooks copied from another."] },
  { version: "4.5.3", date: "Jun 18", kind: "Fix", notes: ["Removing a teammate no longer leaves their pending invites active."] },
  { version: "4.5.0", date: "Jun 11", kind: "Feature", notes: ["A command palette, on ⌘K, for jumping to any project, invoice or setting."] },
];

// A long changelog in its own scroll region. The button appears after a
// screen of reading, fills its ring as you go, and rides you back up.
export default function Demo() {
  const scroller = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  return (
    <div className="relative h-[420px] w-full max-w-[420px] overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)]">
      <div
        ref={scroller}
        tabIndex={0}
        aria-label="Changelog"
        className="h-full overflow-y-auto overscroll-contain outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-fg-3"
      >
        <div className="px-5 pb-20 pt-6">
          <h3 ref={heading} tabIndex={-1} className="rounded-sm text-[20px] font-medium leading-[1.15] tracking-[-0.02em] text-fg outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-fg-3">
            Changelog
          </h3>
          <p className="mt-1.5 text-[12.5px] text-fg-3">Everything we shipped, newest first.</p>
          <ol className="mt-6 flex flex-col">
            {releases.map((r) => (
              <li key={r.version} className="grid grid-cols-[64px_1fr] gap-3 border-t border-line py-4">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-[11.5px] text-fg">{r.version}</span>
                  <span className="tabular text-[11.5px] text-fg-3">{r.date}</span>
                </div>
                <div className="min-w-0">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${r.kind === "Feature" ? "bg-info-soft text-info" : "bg-hover text-fg-2"}`}>{r.kind}</span>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {r.notes.map((n) => (
                      <li key={n} className="text-[13px] leading-[1.55] text-fg-2 text-pretty">
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <BackToTop scrollRoot={scroller} focusTarget={heading} position="absolute" />
    </div>
  );
}
