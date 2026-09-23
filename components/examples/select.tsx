"use client";
import { Select, SelectGroup, SelectItem, SelectLabel, SelectPopup, SelectTrigger } from "@/components/ui/select";

const regions = [
  {
    value: "Americas",
    items: [
      { value: "iad1", label: "Washington, D.C." },
      { value: "cle1", label: "Cleveland" },
      { value: "pdx1", label: "Portland" },
      { value: "sfo1", label: "San Francisco" },
      { value: "yul1", label: "Montréal" },
      { value: "gru1", label: "São Paulo" },
    ],
  },
  {
    value: "Europe",
    items: [
      { value: "lhr1", label: "London" },
      { value: "dub1", label: "Dublin" },
      { value: "cdg1", label: "Paris" },
      { value: "fra1", label: "Frankfurt" },
      { value: "arn1", label: "Stockholm" },
    ],
  },
  {
    value: "Asia-Pacific",
    items: [
      { value: "bom1", label: "Mumbai" },
      { value: "sin1", label: "Singapore" },
      { value: "hkg1", label: "Hong Kong" },
      { value: "icn1", label: "Seoul" },
      { value: "hnd1", label: "Tokyo" },
      { value: "syd1", label: "Sydney" },
    ],
  },
];

const machines = [
  { value: "standard", label: "Standard", description: "4 vCPU · 8 GB memory" },
  { value: "enhanced", label: "Enhanced", description: "8 vCPU · 16 GB memory" },
  { value: "turbo", label: "Turbo", description: "30 vCPU · 60 GB memory · Pro plan", disabled: true },
];

// Two fields from a project's deploy settings: a long grouped list and a short one with detail.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[360px] flex-col gap-4 rounded-xl border border-line bg-frame p-4 shadow-[var(--shadow)]">
      <div className="flex flex-col gap-0.5">
        <p className="text-[14px] font-medium tracking-[-0.015em] text-fg">Deploy settings</p>
        <p className="text-[12.5px] text-fg-3">Applies to the next production deploy.</p>
      </div>

      <Select items={regions} defaultValue="fra1">
        <div className="flex flex-col gap-1.5">
          <SelectLabel>Function region</SelectLabel>
          <SelectTrigger placeholder="Choose a region" />
        </div>
        <SelectPopup>
          {regions.map((group) => (
            <SelectGroup key={group.value} label={group.value}>
              {group.items.map((region) => (
                <SelectItem key={region.value} value={region.value} hint={region.value}>
                  {region.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectPopup>
      </Select>

      <Select items={machines} defaultValue="standard">
        <div className="flex flex-col gap-1.5">
          <SelectLabel>Build machine</SelectLabel>
          <SelectTrigger />
        </div>
        <SelectPopup>
          {machines.map((m) => (
            <SelectItem key={m.value} value={m.value} description={m.description} disabled={m.disabled}>
              {m.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </div>
  );
}
