"use client";
import { useState } from "react";
import { SeatPicker } from "@/components/ui/seat-picker";

const tiers = [
  { from: 1, price: 12 },
  { from: 10, price: 10 },
  { from: 25, price: 8 },
];

// Adding seats to a workspace with seven people already in it.
export default function Demo() {
  const [seats, setSeats] = useState(8);

  return (
    <div className="w-full max-w-[420px] rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Northwind workspace</h3>
        <p className="text-[12px] text-fg-3">Team plan</p>
      </div>
      <SeatPicker
        value={seats}
        onValueChange={setSeats}
        tiers={tiers}
        min={7}
        max={60}
        minReason="7 people are already in this workspace"
        maxReason="Need more than 60 seats? Talk to sales for a custom price."
      />
    </div>
  );
}
