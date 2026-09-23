"use client";
import { useState } from "react";
import { ScrollShadow } from "@/components/ui/scroll-shadow";

const roles = ["All", "Owners", "Admins", "Engineers", "Designers", "Finance", "Support", "Contractors"];

const members = [
  { name: "Maya Chen", email: "maya@northwind.io", role: "Owners" },
  { name: "Leo Park", email: "leo@northwind.io", role: "Admins" },
  { name: "Priya Raman", email: "priya@northwind.io", role: "Engineers" },
  { name: "Tom Weiss", email: "tom@northwind.io", role: "Finance" },
  { name: "Ana Souza", email: "ana@northwind.io", role: "Designers" },
  { name: "Jordan Lee", email: "jordan@northwind.io", role: "Engineers" },
  { name: "Sofia Marín", email: "sofia@northwind.io", role: "Support" },
  { name: "Kenji Watanabe", email: "kenji@northwind.io", role: "Engineers" },
  { name: "Amara Okafor", email: "amara@northwind.io", role: "Admins" },
  { name: "Lukas Brandt", email: "lukas.brandt@contractors.northwind.io", role: "Contractors" },
  { name: "Nadia Haddad", email: "nadia@northwind.io", role: "Designers" },
  { name: "Owen Gallagher", email: "owen@northwind.io", role: "Support" },
];

const initials = (name: string) => name.split(" ").map((p) => p[0]).join("");

// Team settings: a row of role filters that scrolls sideways with its ends
// fading, over a member list that shades its edges only where more rows wait.
export default function Demo() {
  const [role, setRole] = useState("All");
  const shown = role === "All" ? members : members.filter((m) => m.role === role);

  return (
    <div className="w-full max-w-[380px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-3.5">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Members</h3>
        <span className="tabular text-[12px] text-fg-3">{shown.length === 1 ? "1 person" : `${shown.length} people`}</span>
      </div>

      <ScrollShadow orientation="horizontal" variant="fade" size={40} scrollbar={false} label="Filter by role">
        <div role="group" aria-label="Role" className="flex w-max gap-1.5 px-4 pb-3 pt-0.5">
          {roles.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={role === r}
              onClick={() => setRole(r)}
              className="h-7 shrink-0 rounded-full border border-line-2 px-2.5 text-[12px] text-fg-2 outline-none transition-[background-color,border-color,color,scale] duration-150 hover:border-fg-4 hover:text-fg active:scale-[0.96] aria-pressed:border-fg aria-pressed:bg-fg aria-pressed:text-frame focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
            >
              {r}
            </button>
          ))}
        </div>
      </ScrollShadow>

      <ScrollShadow label="Members" className="h-[252px] border-t border-line">
        <ul className="py-1">
          {shown.map((m) => (
            <li key={m.email} className="flex items-center gap-3 px-4 py-2">
              <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-hover text-[10.5px] font-medium text-fg-2">
                {initials(m.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-fg">{m.name}</span>
                <span className="block truncate text-[12px] text-fg-3">{m.email}</span>
              </span>
              <span className="shrink-0 text-[12px] text-fg-3">{m.role.replace(/s$/, "")}</span>
            </li>
          ))}
        </ul>
      </ScrollShadow>
    </div>
  );
}
