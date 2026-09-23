"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { ImageCompare } from "@/components/ui/image-compare";

const shot = (q: string) => `https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&q=80${q}`;

// Reviewing a color grade: the flat camera file against the finished edit.
export default function Demo() {
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
  return (
    <div className="flex w-full max-w-[480px] flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-fg">braies-dawn.dng</p>
          <p className="truncate text-[12px] text-fg-3">Grade: Alpine morning · edited by Priya Nair</p>
        </div>
        <div role="radiogroup" aria-label="Split" className="flex shrink-0 gap-0.5 rounded-lg border border-line bg-frame p-0.5">
          {(["horizontal", "vertical"] as const).map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={orientation === o}
              aria-label={o === "horizontal" ? "Side by side" : "Top and bottom"}
              title={o === "horizontal" ? "Side by side" : "Top and bottom"}
              onClick={() => setOrientation(o)}
              className={cn(
                "grid size-7 place-items-center rounded-md text-fg-3 outline-none transition-[background-color,color,scale] duration-150",
                "hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.94]",
                orientation === o && "bg-raised text-fg shadow-[var(--shadow)] ring-1 ring-line-2",
              )}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden className={o === "vertical" ? "rotate-90" : undefined}>
                <rect x="2.5" y="3" width="11" height="10" rx="1.75" />
                <path d="M8 3v10" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <ImageCompare
        key={orientation}
        orientation={orientation}
        defaultValue={42}
        beforeLabel="Original"
        afterLabel="Graded"
        before={<img src={shot("&sat=-45&con=-30&exp=6")} alt="The lake as shot: flat and low in contrast" />}
        after={<img src={shot("")} alt="The lake after grading: deep turquoise water and warm peaks" />}
      />
      <p className="text-[12px] text-fg-3">Drag the handle or click anywhere on the photo. Double-click the handle to recenter.</p>
    </div>
  );
}
