"use client";
import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// Two real choices on a project settings page: who can see it (with the
// consequence under each option) and where it runs (short, side by side).
export default function Demo() {
  const [visibility, setVisibility] = useState("workspace");

  return (
    <div className="w-full max-w-[420px] rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <section className="px-4 pb-4 pt-3.5">
        <h3 id="visibility" className="text-[14px] font-medium tracking-[-0.015em] text-fg">Visibility</h3>
        <p className="mb-3.5 mt-0.5 text-[12.5px] text-fg-3">Who can open northwind/checkout-web</p>
        <RadioGroup aria-labelledby="visibility" name="visibility" value={visibility} onValueChange={setVisibility}>
          <RadioGroupItem value="private" label="Private" description="Only people you invite" />
          <RadioGroupItem value="workspace" label="Workspace" description="Everyone at Northwind, 48 members" />
          <RadioGroupItem value="public" label="Public" description="Anyone with the link. Turned off by your admin" disabled />
        </RadioGroup>
      </section>

      <section className="border-t border-line px-4 py-3.5">
        <h3 id="region" className="mb-2.5 text-[12.5px] text-fg-2">Deploy region</h3>
        <RadioGroup aria-labelledby="region" name="region" orientation="horizontal" size="sm" defaultValue="fra1">
          <RadioGroupItem value="fra1" label="Frankfurt" />
          <RadioGroupItem value="iad1" label="Virginia" />
          <RadioGroupItem value="hnd1" label="Tokyo" />
        </RadioGroup>
      </section>
    </div>
  );
}
