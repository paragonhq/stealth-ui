"use client";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";

const people: [string, string, string][] = [
  ["mina", "Mina Okafor", "Design systems"],
  ["tom", "Tom Lindqvist", "Frontend"],
  ["ade", "Adeola Bankole", "Platform"],
  ["rui", "Rui Takahashi", "Mobile"],
  ["sofia", "Sofía Herrera", "Frontend"],
  ["jonah", "Jonah Weiss", "Security"],
  ["priya", "Priya Raman", "Data"],
  ["luca", "Luca Moretti", "Infrastructure"],
  ["hana", "Hana Kim", "Product design"],
  ["omar", "Omar Haddad", "Payments"],
  ["elena", "Elena Petrova", "QA"],
  ["felix", "Felix Brandt", "Platform"],
  ["noor", "Noor Siddiqui", "Growth"],
  ["sam", "Sam Achebe", "Support engineering"],
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

const options: MultiSelectOption[] = people.map(([value, label, team]) => ({
  value,
  label,
  description: team,
  disabled: value === "jonah",
  icon: (
    <span className="grid size-4 place-items-center rounded-full bg-line-2 text-[7.5px] font-semibold tracking-[0.02em] text-fg-2">{initials(label)}</span>
  ),
}));

// Requesting reviewers on a pull request: pick a few from a team of fourteen.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[360px] flex-col gap-4 rounded-xl border border-line bg-frame p-4 shadow-[var(--shadow)]">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate font-mono text-2xs text-fg-4">#2481 · feat/usage-billing</p>
        <p className="text-[14px] font-medium tracking-[-0.015em] text-fg">Metered usage on the billing page</p>
      </div>
      <MultiSelect
        label="Reviewers"
        options={options}
        defaultValue={["mina", "tom", "ade", "priya"]}
        placeholder="Add reviewers"
        searchPlaceholder="Search people or teams"
        noun="people"
      />
      <p className="text-[12px] text-fg-3">Jonah is out until Monday and can’t be requested.</p>
    </div>
  );
}
