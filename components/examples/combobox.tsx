"use client";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

const projects: ComboboxOption[] = [
  { value: "web", label: "Website redesign", hint: "42" },
  { value: "mobile", label: "Mobile app v3", hint: "118" },
  { value: "billing", label: "Billing migration", hint: "27" },
  { value: "search", label: "Search relevance", hint: "9" },
  { value: "onboard", label: "Onboarding checklist", hint: "14" },
  { value: "sso", label: "SAML single sign-on", hint: "6" },
  { value: "perf", label: "Dashboard performance", hint: "31" },
  { value: "i18n", label: "Localization: Español, Français, Português", hint: "53" },
  { value: "api", label: "Public API v2", hint: "71" },
  { value: "q3", label: "Q3 forecast model", hint: "4", disabled: true },
];

// Moving an issue into a project, with a new project a keystroke away.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[360px] flex-col gap-4 rounded-xl border border-line bg-frame p-4 shadow-[var(--shadow)]">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-mono text-2xs text-fg-4">ENG-1932</p>
        <p className="truncate text-[14px] font-medium tracking-[-0.015em] text-fg">Invoices render the wrong currency symbol</p>
      </div>
      <Combobox
        label="Project"
        options={projects}
        defaultValue="billing"
        placeholder="Find or create a project"
        noun="projects"
        createLabel={(q) => (
          <>
            Create project <span className="font-medium text-fg">“{q}”</span>
          </>
        )}
        onCreate={async (name) => {
          await new Promise((r) => setTimeout(r, 900));
          if (/fail/i.test(name)) throw new Error("Rejected");
          return { value: name.toLowerCase().replace(/\s+/g, "-"), label: name, hint: "0" };
        }}
      />
      <p className="text-[12px] text-fg-3">Try “portugues”, “api”, or a project that doesn’t exist yet.</p>
    </div>
  );
}
