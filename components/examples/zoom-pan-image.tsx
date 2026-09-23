"use client";
import { ZoomPanImage } from "@/components/ui/zoom-pan-image";

// Checking a large aerial photo for detail before it goes to print.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[520px] flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3 px-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-fg-3">
            <rect x="2.5" y="3" width="11" height="10" rx="1.75" />
            <circle cx="6" cy="6.5" r="1.1" />
            <path d="m2.75 11.5 3.4-3 2.4 2 1.6-1.4 3.1 2.6" />
          </svg>
          <p className="truncate text-[13px] font-medium text-fg">midtown-aerial-final.jpg</p>
        </div>
        <p className="shrink-0 font-mono text-2xs text-fg-3 tabular">5472 × 3648 · 14.2 MB</p>
      </div>

      <ZoomPanImage
        src="https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=2400&q=80"
        alt="Aerial view of Midtown Manhattan at golden hour, avenues running toward the river"
        width={5472}
        height={3648}
        max={5}
        aspectRatio="3 / 2"
      />

      <p className="px-0.5 text-[12px] text-fg-3">
        Double-click to zoom, drag to move, or pinch. <span className="hidden pointer-fine:inline">Hold ⌘ and scroll to zoom where you point.</span>
      </p>
    </div>
  );
}
