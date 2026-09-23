"use client";
import { useState } from "react";
import { TransferList, type TransferItem } from "@/components/ui/transfer-list";

const people: [string, string, string][] = [
  ["priya", "Priya Raman", "Incident lead"],
  ["marcus", "Marcus Chen", "Payments · On call"],
  ["sofia", "Sofía Herrera", "Payments"],
  ["daniel", "Daniel Okoro", "Platform"],
  ["hannah", "Hannah Weiss", "Support"],
  ["kenji", "Kenji Watanabe", "Platform · On call"],
  ["amara", "Amara Nwosu", "Security"],
  ["lukas", "Lukas Becker", "Data"],
  ["chloe", "Chloé Martin", "Comms"],
  ["ravi", "Ravi Shankar", "Infrastructure"],
  ["ella", "Ella Johansson", "Design"],
  ["tomas", "Tomás Silva", "Mobile"],
  ["noor", "Noor Haddad", "Customer success, EMEA enterprise accounts"],
];

const initials = (name: string) => name.split(" ").map((w) => w[0]).join("").slice(0, 2);

const items: TransferItem[] = people.map(([value, label, description]) => ({
  value,
  label: value === "priya" ? `${label} (you)` : label,
  description,
  disabled: value === "priya",
  leading: (
    <span className="grid size-6 place-items-center rounded-full bg-fg/[0.08] text-[10px] font-medium text-fg-2" aria-hidden>
      {initials(label)}
    </span>
  ),
}));

// Pulling responders into an incident channel, with a cap so it stays a working room.
export default function Demo() {
  const [members, setMembers] = useState(["priya", "marcus"]);
  return (
    <div className="flex w-full max-w-[540px] flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium tracking-[-0.01em] text-fg">
          Responders for <span className="font-mono text-[12px] text-fg-2">#inc-2291-checkout-errors</span>
        </p>
      </div>
      <TransferList
        items={items}
        value={members}
        onValueChange={setMembers}
        titles={["Team", "In channel"]}
        max={6}
        searchPlaceholder="Filter by name or team"
        empty={["Everyone’s in the channel", "No responders yet"]}
      />
    </div>
  );
}
