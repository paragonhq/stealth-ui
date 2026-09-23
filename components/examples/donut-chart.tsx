"use client";
import { DonutChart } from "@/components/ui/donut-chart";

// A workspace's storage, by what is using it. The long tail folds into Other.
const storage = [
  { label: "Video", value: 48.2 },
  { label: "Design files", value: 26.7 },
  { label: "Images", value: 14.9 },
  { label: "Documents", value: 6.3 },
  { label: "Backups", value: 4.1 },
  { label: "Audio", value: 1.2 },
  { label: "Archives", value: 0.8 },
];

export default function Demo() {
  return (
    <div className="w-full max-w-[520px] rounded-xl border border-line bg-raised p-5 shadow-[var(--shadow)]">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium tracking-[-0.01em] text-fg">Storage</span>
        <span className="text-[11.5px] text-fg-3 tabular">102.2 GB of 200 GB used</span>
      </div>
      <DonutChart
        data={storage}
        label="Storage by file type"
        format={{ maximumFractionDigits: 1 }}
        suffix=" GB"
        totalLabel="Used"
      />
    </div>
  );
}
