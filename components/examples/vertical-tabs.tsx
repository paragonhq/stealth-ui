"use client";
import { useState } from "react";
import { Bell, CreditCard, Lock, Settings, User, Users } from "@/lib/icons";
import { VerticalTabs, VerticalTabsLabel, VerticalTabsList, VerticalTabsPanel, VerticalTabsPanels, VerticalTabsTab } from "@/components/ui/vertical-tabs";

const Key = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
    <circle cx="5.5" cy="10.5" r="2.75" />
    <path d="m7.5 8.5 5.25-5.25M11 5l1.5 1.5M9.5 6.5 11 8" />
  </svg>
);

function Row({ label, value, action = "Edit" }: { label: string; value: React.ReactNode; action?: string }) {
  return (
    <div className="flex min-h-12 items-center gap-3 border-b border-line py-2 last:border-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[12px] text-fg-3">{label}</span>
        <span className="truncate text-[13px] text-fg">{value}</span>
      </div>
      <button
        type="button"
        className="h-7 shrink-0 rounded-md border border-line-2 bg-raised px-2 text-[12px] text-fg outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.96]"
      >
        {action}
      </button>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-col gap-0.5">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">{title}</h3>
        <p className="text-[12.5px] text-fg-3 text-pretty">{description}</p>
      </header>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

export default function Demo() {
  const [narrow, setNarrow] = useState(false);

  return (
    <div className="flex w-full max-w-[560px] flex-col items-center gap-5">
      <div role="group" aria-label="Preview width" className="flex items-center gap-1 rounded-lg border border-line bg-page p-0.5 text-[12px]">
        {[false, true].map((n) => (
          <button
            key={String(n)}
            type="button"
            aria-pressed={narrow === n}
            onClick={() => setNarrow(n)}
            className="h-6 rounded-md px-2 text-fg-3 outline-none transition-[background-color,color,scale] duration-150 hover:text-fg-2 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.96] aria-pressed:bg-fg/[0.07] aria-pressed:text-fg"
          >
            {n ? "Narrow" : "Wide"}
          </button>
        ))}
      </div>

      <VerticalTabs
        defaultValue="members"
        className={narrow ? "w-full max-w-[340px]" : "w-full"}
      >
        <VerticalTabsList aria-label="Settings">
          <VerticalTabsLabel>Account</VerticalTabsLabel>
          <VerticalTabsTab value="profile" icon={<User />}>Profile</VerticalTabsTab>
          <VerticalTabsTab value="notifications" icon={<Bell />}>Notifications</VerticalTabsTab>
          <VerticalTabsTab value="security" icon={<Lock />}>Security</VerticalTabsTab>
          <VerticalTabsLabel>Workspace</VerticalTabsLabel>
          <VerticalTabsTab value="general" icon={<Settings />}>General</VerticalTabsTab>
          <VerticalTabsTab value="members" icon={<Users />} hint="12">Members</VerticalTabsTab>
          <VerticalTabsTab value="billing" icon={<CreditCard />} hint="Pro">Billing</VerticalTabsTab>
          <VerticalTabsTab value="keys" icon={<Key />} disabled hint="Owner">API keys</VerticalTabsTab>
        </VerticalTabsList>

        <VerticalTabsPanels>
          <VerticalTabsPanel value="profile">
            <Section title="Profile" description="How you appear to people in Northwind.">
              <Row label="Name" value="Maya Okafor" />
              <Row label="Email" value="maya@northwind.dev" />
            </Section>
          </VerticalTabsPanel>
          <VerticalTabsPanel value="notifications">
            <Section title="Notifications" description="Where we reach you when something needs you.">
              <Row label="Deploy failures" value="Email and desktop" action="Change" />
              <Row label="Mentions" value="Desktop only" action="Change" />
              <Row label="Weekly summary" value="Off" action="Turn on" />
            </Section>
          </VerticalTabsPanel>
          <VerticalTabsPanel value="security">
            <Section title="Security" description="Sign-in methods and active sessions.">
              <Row label="Two-factor" value="Authenticator app" action="Manage" />
              <Row label="Sessions" value="3 devices, last active 4m ago" action="Review" />
            </Section>
          </VerticalTabsPanel>
          <VerticalTabsPanel value="general">
            <Section title="General" description="The workspace name and address everyone sees.">
              <Row label="Workspace name" value="Northwind" />
              <Row label="URL" value="app.northwind.dev/team" />
            </Section>
          </VerticalTabsPanel>
          <VerticalTabsPanel value="members">
            <Section title="Members" description="12 people, 3 pending invites. Admins can change roles.">
              <Row label="Maya Okafor · Owner" value="maya@northwind.dev" action="Manage" />
              <Row label="Jonas Lindqvist · Admin" value="jonas@northwind.dev" action="Manage" />
              <Row label="Priya Raman · Member" value="priya.raman@northwind.dev" action="Manage" />
            </Section>
          </VerticalTabsPanel>
          <VerticalTabsPanel value="billing">
            <Section title="Billing" description="Pro plan, renews on 1 Oct 2026.">
              <Row label="Plan" value="Pro · $240 / month" action="Change plan" />
              <Row label="Payment method" value="Visa ending 4242" action="Update" />
            </Section>
          </VerticalTabsPanel>
        </VerticalTabsPanels>
      </VerticalTabs>
    </div>
  );
}
