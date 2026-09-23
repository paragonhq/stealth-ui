"use client";
import NumberFlow from "@number-flow/react";
import { useState } from "react";
import { EditableCells, type EditableColumn } from "@/components/ui/editable-cells";

type Line = { id: string; item: string; qty: number; price: number };

const initial: Line[] = [
  { id: "l1", item: "Laptop, 14-inch", qty: 6, price: 2399 },
  { id: "l2", item: "External display", qty: 6, price: 1599 },
  { id: "l3", item: "Standing desk", qty: 4, price: 689 },
  { id: "l4", item: "Noise-canceling headphones", qty: 10, price: 349 },
  { id: "l5", item: "USB-C dock", qty: 6, price: 229.5 },
];

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const toNumber = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/[$,\s]/g, "")));

const columns: EditableColumn<Line>[] = [
  {
    key: "item",
    header: "Item",
    placeholder: "Name the item",
    validate: (v) => (!String(v).trim() ? "Enter a name" : String(v).length > 60 ? "Keep it under 60 characters" : null),
    parse: (s) => s.trim(),
  },
  {
    key: "qty",
    header: "Qty",
    width: 64,
    numeric: true,
    parse: (s) => toNumber(s),
    validate: (v) => (!Number.isInteger(v) ? "Enter a whole number" : (v as number) < 1 ? "At least 1" : (v as number) > 500 ? "500 at most" : null),
  },
  {
    key: "price",
    header: "Unit price",
    width: 108,
    numeric: true,
    parse: (s) => toNumber(s),
    toInput: (v) => String(v),
    format: (v) => money.format(v as number),
    validate: (v, input) =>
      Number.isNaN(v) ? "Enter an amount, like 1299.00" : (v as number) <= 0 ? "Must be more than $0" : /\.\d{3,}/.test(input) ? "Use at most 2 decimals" : null,
  },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Demo() {
  const [lines, setLines] = useState(initial);
  const total = lines.reduce((sum, l) => sum + l.qty * l.price, 0);

  return (
    <div className="flex w-full max-w-[520px] flex-col gap-2.5">
      <div className="flex items-baseline justify-between px-1">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Q4 hardware budget</h3>
        <span className="text-[12px] text-fg-3">
          Total{" "}
          <NumberFlow
            value={total}
            format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}
            locales="en-US"
            className="font-medium text-fg tabular"
          />
        </span>
      </div>
      <EditableCells
        caption="Q4 hardware budget"
        columns={columns}
        rows={lines}
        getRowId={(l) => l.id}
        getRowLabel={(l) => l.item}
        minWidth={300}
        onCellChange={async ({ rowId, key, value }) => {
          // Stands in for a network save. The cell shows the new value, dimmed, until it resolves.
          await wait(450);
          setLines((ls) => ls.map((l) => (l.id === rowId ? { ...l, [key]: value } : l)));
        }}
      />
      <p className="px-1 text-[12px] text-fg-3">Click a cell or press Enter to edit. Tab moves on, Esc cancels.</p>
    </div>
  );
}
