"use client";
import { useState } from "react";
import { Plus } from "@/lib/icons";
import { MemberList, type Member } from "@/components/ui/member-list";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const daysAgo = (d: number) => Date.now() - d * 86_400_000;

const people: Member[] = [
  { id: "u1", name: "Maya Chen", email: "maya@northwind.dev", role: "owner" },
  { id: "u2", name: "Jonas Weber", email: "jonas.weber@northwind.dev", role: "admin" },
  { id: "u4", name: "Diego Alvarez-Castellanos", email: "diego.alvarez-castellanos@northwind.dev", role: "member" },
  { id: "u5", name: "Aiko Tanaka", email: "aiko@studio-kanso.jp", role: "guest" },
  { id: "i1", email: "sam.okafor@northwind.dev", role: "member", pending: true, invitedAt: daysAgo(2) },
  { id: "i2", email: "lena@fieldnotes.studio", role: "guest", pending: true, invitedAt: daysAgo(6) },
];

const nextInvites = ["alex.kim@northwind.dev", "noor.haddad@northwind.dev"];

// A workspace's people page. Aiko's first role change fails and rolls back;
// removing waits on the server; Invite adds a pending row that grows in.
export default function Demo() {
  const [members, setMembers] = useState(people);
  const [failedOnce, setFailedOnce] = useState(false);
  const [invited, setInvited] = useState(0);

  return (
    <div className="w-full max-w-[520px]">
      <MemberList
        members={members}
        onMembersChange={setMembers}
        currentUserId="u1"
        workspaceName="Northwind"
        onRoleChange={async (m) => {
          await wait(600);
          if (m.id === "u5" && !failedOnce) {
            setFailedOnce(true);
            throw new Error("Guests need an admin's approval");
          }
        }}
        onRemove={() => wait(700)}
        onResend={() => wait(800)}
        onRevoke={() => wait(300)}
        toolbar={
          <button
            type="button"
            disabled={invited >= nextInvites.length}
            onClick={() => {
              const email = nextInvites[invited];
              setInvited(invited + 1);
              setMembers((list) => [...list, { id: `n${invited}`, email, role: "member", pending: true, invitedAt: Date.now() }]);
            }}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-fg px-2.5 text-[12.5px] font-medium text-frame outline-none transition-[background-color,scale,opacity] duration-150 hover:bg-fg/90 active:scale-[0.97] active:duration-75 disabled:opacity-50 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
          >
            <Plus size={14} />
            Invite
          </button>
        }
      />
    </div>
  );
}
