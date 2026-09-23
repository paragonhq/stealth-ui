"use client";
import { InviteField } from "@/components/ui/invite-field";

// Inviting teammates to a workspace: one address is outside the company, one is missing its domain.
export default function Demo() {
  return (
    <div className="w-full max-w-[520px] rounded-xl border border-line bg-frame p-4 shadow-[var(--shadow)]">
      <div className="mb-3.5 flex flex-col gap-0.5">
        <p className="text-[14px] font-medium tracking-[-0.015em] text-fg">Invite to Northwind Labs</p>
        <p className="text-[12.5px] text-fg-3">They’ll get an email with a link to join the workspace.</p>
      </div>
      <InviteField
        defaultValue={["mara@northwind.com", "leo.brandt@gmail.com", "jonah@northwind"]}
        defaultRole="editor"
        organizationDomain="northwind.com"
        max={20}
        onInvite={() => new Promise((resolve) => setTimeout(resolve, 900))}
      />
    </div>
  );
}
